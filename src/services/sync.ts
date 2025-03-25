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

      // Instead of merging, prioritize online notes as they represent the current state
      // This ensures deleted notes stay deleted
      const onlineNoteIds = new Set(onlineNotes.map(note => note.id));
      
      // Only keep offline notes that don't exist online and are newer than the last sync
      const lastSync = await storageService.getLastSync() || new Date(0);
      const newOfflineNotes = offlineNotes.filter(note => 
        !onlineNoteIds.has(note.id) && new Date(note.updatedAt) > lastSync
      );
      
      // Combine online notes with new offline notes
      const finalNotes = [...onlineNotes, ...newOfflineNotes];

      // Save final notes to local storage
      await storageService.saveNotes(finalNotes);
      
      // Push new offline notes to server
      await Promise.all(
        newOfflineNotes.map(note => 
          neo4jService.createNote(note.verseId, note.content, note.tags || [])
        )
      );
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

      // Deduplicate connections by source-target-type instead of just by ID
      const uniqueConnectionsMap = new Map<string, Connection>();
      
      // Process online connections first (they're the source of truth)
      onlineConnections.forEach(connection => {
        const uniqueKey = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
        uniqueConnectionsMap.set(uniqueKey, connection);
      });
      
      // Add any offline connections that don't exist online or are newer
      offlineConnections.forEach(connection => {
        const uniqueKey = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
        const existingConnection = uniqueConnectionsMap.get(uniqueKey);
        
        if (!existingConnection || 
            new Date(connection.updatedAt) > new Date(existingConnection.updatedAt)) {
          uniqueConnectionsMap.set(uniqueKey, connection);
        }
      });
      
      const finalConnections = Array.from(uniqueConnectionsMap.values());

      // Save to local storage
      await storageService.saveConnections(finalConnections);
      
      // Sync with server - update existing connections and create new ones
      for (const connection of finalConnections) {
        const existingOnlineConnection = onlineConnections.find(c => 
          c.sourceVerseId === connection.sourceVerseId && 
          c.targetVerseId === connection.targetVerseId && 
          c.type === connection.type
        );
        
        if (existingOnlineConnection) {
          // If it exists online but has a different ID or is older, update it
          if (existingOnlineConnection.id !== connection.id || 
              new Date(existingOnlineConnection.updatedAt) < new Date(connection.updatedAt)) {
            await neo4jService.updateConnection(existingOnlineConnection.id, connection);
          }
        } else {
          // If it doesn't exist online, create it
          await neo4jService.createConnection({
            sourceVerseId: connection.sourceVerseId,
            targetVerseId: connection.targetVerseId,
            type: connection.type,
            description: connection.description || '',
          });
        }
      }
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