import NetInfo from '@react-native-community/netinfo';
import { neo4jService } from './neo4j';
import { storageService } from './storage';
import { Verse, Connection, Note } from '../types/bible';

class SyncService {
  private static instance: SyncService;
  private isSyncing: boolean = false;
  private syncAttempts: number = 0;
  private maxSyncAttempts: number = 3;
  private syncTimeout: NodeJS.Timeout | null = null;
  private lastSyncError: Error | null = null;
  private syncBackoffMs: number = 60000; // 1 minute backoff

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public async syncData(): Promise<boolean> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return false;
    }

    // Check if we've exceeded max attempts in this session
    if (this.syncAttempts >= this.maxSyncAttempts) {
      console.log(`Exceeded maximum sync attempts (${this.maxSyncAttempts}), backing off for ${this.syncBackoffMs/1000} seconds`);
      
      // Reset attempts after some time
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
      }
      
      this.syncTimeout = setTimeout(() => {
        this.syncAttempts = 0;
        this.lastSyncError = null;
        console.log('Sync backoff period ended, resetting attempts counter');
      }, this.syncBackoffMs);
      
      return false;
    }

    try {
      this.isSyncing = true;
      this.syncAttempts++;
      console.log(`Starting sync attempt ${this.syncAttempts} of ${this.maxSyncAttempts}`);

      // Check if we're online
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('No internet connection, skipping sync');
        return false;
      }

      // Sync notes
      await this.syncNotes().catch(err => {
        console.warn('Error syncing notes:', err);
        // Don't throw, try to sync connections anyway
      });

      // Sync connections
      await this.syncConnections().catch(err => {
        console.warn('Error syncing connections:', err);
        // Don't throw, still mark sync as partially successful
      });

      // Update last sync time
      await storageService.updateLastSync();
      
      // Reset attempts on successful sync
      this.syncAttempts = 0;
      this.lastSyncError = null;
      
      console.log('Sync completed successfully');
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Fatal error during sync:', err);
      this.lastSyncError = err;
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncNotes(): Promise<void> {
    try {
      // Get both online and offline notes
      const [onlineNotes, offlineNotes] = await Promise.all([
        neo4jService.getNotes().catch(err => {
          console.warn('Failed to fetch online notes:', err);
          return [] as Note[];
        }),
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
      
      // Push new offline notes to server with error handling
      // Limit the number of operations to prevent overload
      const MAX_NOTE_OPS = 10;
      const notesToSync = newOfflineNotes.slice(0, MAX_NOTE_OPS);
      
      const createPromises = notesToSync.map(note => {
        return neo4jService.createNote(note.verseId, note.content, note.tags || [])
          .catch(error => {
            console.warn(`Failed to create note for verse ${note.verseId}:`, error);
            return null;
          });
      });
      
      await Promise.all(createPromises);
      console.log(`Synced ${createPromises.length} notes`);
    } catch (error) {
      console.error('Error syncing notes:', error);
      throw error; // Re-throw to be caught by caller
    }
  }

  private async syncConnections(): Promise<void> {
    try {
      // Get both online and offline connections
      const [onlineConnections, offlineConnections] = await Promise.all([
        neo4jService.getConnections().catch(err => {
          console.warn('Failed to fetch online connections:', err);
          return [] as Connection[];
        }),
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
      
      // Limit number of connection operations to avoid overloading
      const MAX_CONNECTION_OPS = 10;
      const connectionsToSync = finalConnections.slice(0, MAX_CONNECTION_OPS);
      
      console.log(`Attempting to sync ${connectionsToSync.length} connections`);
      
      // Sync with server - update existing connections and create new ones with error handling
      const connectionPromises = connectionsToSync.map(async (connection) => {
        try {
          const existingOnlineConnection = onlineConnections.find(c => 
            c.sourceVerseId === connection.sourceVerseId && 
            c.targetVerseId === connection.targetVerseId && 
            c.type === connection.type
          );
          
          // Check if source and target verses actually exist before attempting to create connections
          const [sourceExists, targetExists] = await Promise.all([
            neo4jService.getVerse(connection.sourceVerseId).then(v => !!v),
            neo4jService.getVerse(connection.targetVerseId).then(v => !!v)
          ]);
          
          if (!sourceExists || !targetExists) {
            console.warn(`Skipping connection sync: one or both verses don't exist (${connection.sourceVerseId} -> ${connection.targetVerseId})`);
            return false;
          }
          
          if (existingOnlineConnection) {
            // If it exists online but has a different ID or is older, update it
            if (existingOnlineConnection.id !== connection.id || 
                new Date(existingOnlineConnection.updatedAt) < new Date(connection.updatedAt)) {
              await neo4jService.updateConnection(existingOnlineConnection.id, connection)
                .catch(err => {
                  console.warn(`Failed to update connection ${existingOnlineConnection.id}:`, err);
                  return false;
                });
              return true;
            }
            return false; // No update needed
          } else {
            // If it doesn't exist online, create it
            await neo4jService.createConnection({
              sourceVerseId: connection.sourceVerseId,
              targetVerseId: connection.targetVerseId,
              type: connection.type,
              description: connection.description || '',
            }).catch(err => {
              console.warn(`Failed to create connection from ${connection.sourceVerseId} to ${connection.targetVerseId}:`, err);
              return false;
            });
            return true;
          }
        } catch (connErr) {
          console.warn(`Error processing connection ${connection.id}:`, connErr);
          return false;
        }
      });
      
      const results = await Promise.all(connectionPromises);
      const successCount = results.filter(Boolean).length;
      console.log(`Successfully synced ${successCount} of ${connectionsToSync.length} connections`);
    } catch (error) {
      console.error('Error syncing connections:', error);
      throw error; // Re-throw to be caught by caller
    }
  }

  // Reset sync state - useful for debugging
  public resetSyncState(): void {
    this.isSyncing = false;
    this.syncAttempts = 0;
    this.lastSyncError = null;
    
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    
    console.log('Sync state has been reset');
  }
  
  // Get information about the current sync state
  public getSyncStatus(): {
    isSyncing: boolean;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
  } {
    return {
      isSyncing: this.isSyncing,
      attempts: this.syncAttempts,
      maxAttempts: this.maxSyncAttempts,
      lastError: this.lastSyncError ? this.lastSyncError.message : null
    };
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