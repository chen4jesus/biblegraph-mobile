import NetInfo from '@react-native-community/netinfo';
import { neo4jService } from './neo4j';
import { storageService } from './storage';
import { Verse, Connection, Note } from '../types/bible';

class SyncService {
  private static instance: SyncService;
  private isSyncing: boolean = false;

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public async syncData(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    try {
      this.isSyncing = true;

      // Check if we're online
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('No internet connection, skipping sync');
        return;
      }

      // Sync notes
      await this.syncNotes();

      // Sync connections
      await this.syncConnections();

      // Update last sync time
      await storageService.updateLastSync();
    } catch (error) {
      console.error('Error during sync:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncNotes(): Promise<void> {
    try {
      // Get both online and offline notes
      const [onlineNotes, offlineNotes] = await Promise.all([
        neo4jService.getNotes(),
        storageService.getNotes(),
      ]);

      // Merge notes, keeping the most recent version
      const mergedNotes = this.mergeNotes(onlineNotes, offlineNotes);

      // Save merged notes to both storage and server
      await Promise.all([
        storageService.saveNotes(mergedNotes),
        ...mergedNotes.map(note => {
          const existingNote = onlineNotes.find(n => n.id === note.id);
          if (existingNote) {
            return neo4jService.updateNote(note.id, { content: note.content });
          } else {
            return neo4jService.createNote(note.verseId, note.content);
          }
        }),
      ]);
    } catch (error) {
      console.error('Error syncing notes:', error);
      throw error;
    }
  }

  private async syncConnections(): Promise<void> {
    try {
      // Get both online and offline connections
      const [onlineConnections, offlineConnections] = await Promise.all([
        neo4jService.getConnections(),
        storageService.getConnections(),
      ]);

      // Merge connections, keeping the most recent version
      const mergedConnections = this.mergeConnections(onlineConnections, offlineConnections);

      // Save merged connections to both storage and server
      await Promise.all([
        storageService.saveConnections(mergedConnections),
        ...mergedConnections.map(connection => {
          const existingConnection = onlineConnections.find(c => c.id === connection.id);
          if (existingConnection) {
            return neo4jService.updateConnection(connection.id, connection);
          } else {
            return neo4jService.createConnection({
              sourceVerseId: connection.sourceVerseId,
              targetVerseId: connection.targetVerseId,
              type: connection.type,
              description: connection.description,
            });
          }
        }),
      ]);
    } catch (error) {
      console.error('Error syncing connections:', error);
      throw error;
    }
  }

  private mergeNotes(online: Note[], offline: Note[]): Note[] {
    const noteMap = new Map<string, Note>();

    // Add offline notes first (they might be newer)
    offline.forEach(note => {
      noteMap.set(note.id, note);
    });

    // Update with online notes if they're newer
    online.forEach(note => {
      const existing = noteMap.get(note.id);
      if (!existing || new Date(note.updatedAt) > new Date(existing.updatedAt)) {
        noteMap.set(note.id, note);
      }
    });

    return Array.from(noteMap.values());
  }

  private mergeConnections(online: Connection[], offline: Connection[]): Connection[] {
    const connectionMap = new Map<string, Connection>();

    // Add offline connections first (they might be newer)
    offline.forEach(connection => {
      connectionMap.set(connection.id, connection);
    });

    // Update with online connections if they're newer
    online.forEach(connection => {
      const existing = connectionMap.get(connection.id);
      if (!existing || new Date(connection.updatedAt) > new Date(existing.updatedAt)) {
        connectionMap.set(connection.id, connection);
      }
    });

    return Array.from(connectionMap.values());
  }

  public async isOnline(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected ?? false;
  }

  public async getLastSyncTime(): Promise<Date | null> {
    return storageService.getLastSync();
  }
}

export const syncService = SyncService.getInstance(); 