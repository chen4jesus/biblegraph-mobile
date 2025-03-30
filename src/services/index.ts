/**
 * Services API
 * 
 * This module serves as the central access point for all services.
 * UI components should only import from this file, not directly from service implementations.
 * This provides a clean separation between UI and services, improving security and maintainability.
 */

// Re-export only the public interface of each service
// This hides implementation details from UI components

// Database Services
import { neo4jDatabaseService } from './neo4jDatabase';
import { neo4jService } from './neo4j';

// Authentication Service
import { authService } from './auth';

// Data Management Services
import { storageService } from './storage';
import { syncService } from './sync';
import { bibleDataLoader } from './bibleDataLoader';

// Neo4j Driver (should not be directly accessed by UI)
// Only exported for use by other services
import { neo4jDriverService } from './neo4jDriver';

// Import necessary types
import {
  Verse,
  Connection,
  ConnectionType,
  Note,
  User,
  VerseGroup,
  GroupConnection,
  NodeType,
  Tag,
  BibleSettings
} from '../types/bible';

// Re-export types
export type {
  Verse,
  Connection,
  ConnectionType,
  Note,
  User,
  VerseGroup,
  GroupConnection,
  NodeType,
  Tag,
  BibleSettings
};

// Database Services API
export const DatabaseService = {
  /**
   * Initialize database connection
   */
  initialize: () => neo4jDatabaseService.initialize(),

  /**
   * Check if the database is in offline mode
   */
  isOfflineMode: () => neo4jDatabaseService.isOfflineMode(),

  /**
   * Get verses from the database
   */
  getVerses: (signal?: AbortSignal, verseIds?: string[]) => 
    neo4jDatabaseService.getVerses(signal, verseIds),

  /**
   * Get a specific verse by ID
   */
  getVerse: (id: string, signal?: AbortSignal) => 
    neo4jDatabaseService.getVerse(id, signal),

  /**
   * Get a verse by book, chapter, and verse reference
   */
  getVerseByReference: (book: string, chapter: number, verse: number) => 
    neo4jDatabaseService.getVerseByReference(book, chapter, verse),

  /**
   * Create a new verse
   */
  createVerse: (verse: Verse) =>
    neo4jDatabaseService.createVerse(verse),

  /**
   * Search verses with a text query
   */
  searchVerses: (query: string) => 
    neo4jDatabaseService.searchVerses(query),

  /**
   * Get connections between verses
   */
  getConnections: (signal?: AbortSignal) => 
    neo4jDatabaseService.getConnections(signal),

  /**
   * Get connections for a specific verse
   */
  getConnectionsForVerse: (verseId: string, signal?: AbortSignal) => 
    neo4jDatabaseService.getConnectionsForVerse(verseId, signal),

  /**
   * Create a connection between verses
   */
  createConnection: (connection: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>) => 
    neo4jDatabaseService.createConnection(connection),

  /**
   * Create multiple connections in a batch
   */
  createConnectionsBatch: (connections: Array<Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>>) => 
    neo4jDatabaseService.createConnectionsBatch(connections),

  /**
   * Update an existing connection
   */
  updateConnection: (connectionId: string, updates: Partial<Connection>) => 
    neo4jDatabaseService.updateConnection(connectionId, updates),

  /**
   * Delete a connection
   */
  deleteConnection: (connectionId: string) => 
    neo4jDatabaseService.deleteConnection(connectionId),

  /**
   * Get notes (with optional pagination)
   */
  getNotes: (skip?: number, limit?: number) => 
    neo4jDatabaseService.getNotes(skip, limit),

  /**
   * Get a specific note by ID
   */
  getNote: (noteId: string) =>
    neo4jDatabaseService.getNote(noteId),

  /**
   * Get notes for a specific verse
   */
  getNotesForVerse: (verseId: string) => 
    neo4jDatabaseService.getNotesForVerse(verseId),

  /**
   * Create a new note
   */
  createNote: (verseId: string, content: string, tags?: string[]) => 
    neo4jDatabaseService.createNote(verseId, content, tags),

  /**
   * Update an existing note
   */
  updateNote: (noteId: string, updates: Partial<Note>) => 
    neo4jDatabaseService.updateNote(noteId, updates),

  /**
   * Delete a note
   */
  deleteNote: (noteId: string) => 
    neo4jDatabaseService.deleteNote(noteId),

  /**
   * Get all tags
   */
  getTags: () => neo4jDatabaseService.getTags(),

  /**
   * Get tags with usage count
   */
  getTagsWithCount: () => neo4jDatabaseService.getTagsWithCount(),

  /**
   * Create a new tag
   */
  createTag: (name: string, color: string) => 
    neo4jDatabaseService.createTag(name, color),

  /**
   * Update an existing tag
   */
  updateTag: (tagId: string, updates: Partial<Tag>) => 
    neo4jDatabaseService.updateTag(tagId, updates),

  /**
   * Delete a tag
   */
  deleteTag: (tagId: string) => 
    neo4jDatabaseService.deleteTag(tagId),

  /**
   * Create a verse group
   */
  createVerseGroup: (name: string, verseIds: string[], description?: string) =>
    neo4jDatabaseService.createVerseGroup(name, verseIds, description),

  /**
   * Get a verse group by ID
   */
  getVerseGroup: (groupId: string) =>
    neo4jDatabaseService.getVerseGroup(groupId),

  /**
   * Get all verse groups
   */
  getVerseGroups: () =>
    neo4jDatabaseService.getVerseGroups(),

  /**
   * Create a connection between groups
   */
  createGroupConnection: (
    sourceIds: string[],
    targetIds: string[],
    type: ConnectionType,
    description?: string,
    options?: {
      sourceType?: NodeType,
      targetType?: NodeType,
      relationshipType?: string,
      metadata?: Record<string, any>,
      name?: string
    }
  ) => neo4jDatabaseService.createGroupConnection(
    sourceIds,
    targetIds,
    type,
    description,
    options
  ),

  /**
   * Get group connections for a verse
   */
  getGroupConnectionsByVerseId: (verseId: string) =>
    neo4jDatabaseService.getGroupConnectionsByVerseId(verseId)
};

// Authentication Service API
export const AuthService = {
  /**
   * Log in a user
   */
  login: (email: string, password: string) => 
    authService.login(email, password),

  /**
   * Sign up a new user
   */
  signUp: (name: string, email: string, password: string) => 
    authService.signUp(name, email, password),

  /**
   * Log out the current user
   */
  logout: () => authService.logout(),

  /**
   * Check if a user is authenticated
   */
  isAuthenticated: () => authService.isAuthenticated(),

  /**
   * Get the current user
   */
  getCurrentUser: () => authService.getCurrentUser()
};

// Storage Service API
export const StorageService = {
  /**
   * Get verses from storage
   */
  getVerses: () => storageService.getVerses(),

  /**
   * Save verses to storage
   */
  saveVerses: (verses: Verse[]) => storageService.saveVerses(verses),

  /**
   * Get connections from storage
   */
  getConnections: () => storageService.getConnections(),

  /**
   * Save connections to storage
   */
  saveConnections: (connections: Connection[]) => storageService.saveConnections(connections),

  /**
   * Get notes from storage
   */
  getNotes: () => storageService.getNotes(),

  /**
   * Save notes to storage
   */
  saveNotes: (notes: Note[]) => storageService.saveNotes(notes),

  /**
   * Get application settings
   */
  getSettings: () => storageService.getSettings(),

  /**
   * Save application settings
   */
  saveSettings: (settings: BibleSettings) => storageService.saveSettings(settings),

  /**
   * Get last sync time
   */
  getLastSync: () => storageService.getLastSync(),

  /**
   * Update last sync time
   */
  updateLastSync: () => storageService.updateLastSync(),

  /**
   * Clear all storage
   */
  clearAll: () => storageService.clearAll()
};

// Sync Service API
export const SyncService = {
  /**
   * Synchronize data with the server
   */
  syncData: () => syncService.syncData(),

  /**
   * Reset sync state
   */
  resetSyncState: () => syncService.resetSyncState(),

  /**
   * Get sync status
   */
  getSyncStatus: () => syncService.getSyncStatus(),

  /**
   * Check if device is online
   */
  isOnline: () => syncService.isOnline(),

  /**
   * Get last sync time
   */
  getLastSyncTime: () => syncService.getLastSyncTime()
};

// Bible Data Loader API
export const BibleDataService = {
  /**
   * Load Bible data from XML
   */
  loadBibleData: async () => {
    try {
      // First check if we're in offline mode
      if (neo4jDatabaseService.isOfflineMode()) {
        console.log('Database is in offline mode, using fallback data source');
        // When Neo4j is unavailable, we'll try to use whatever data exists in local storage
        return true;
      }
      
      return await bibleDataLoader.loadXmlData();
    } catch (error) {
      console.error('Error loading Bible data:', error);
      return false;
    }
  },

  /**
   * Check if Bible data is loaded
   */
  isBibleDataLoaded: async () => {
    try {
      // If in offline mode, check local storage instead of Neo4j
      if (neo4jDatabaseService.isOfflineMode()) {
        // Check if we have verses in storage
        const verses = await storageService.getVerses();
        return verses && verses.length > 0;
      }
      
      return await bibleDataLoader.isBibleLoaded();
    } catch (error) {
      console.error('Error checking if Bible data is loaded:', error);
      return false;
    }
  },

  /**
   * Get verse count (internal helper method exposed for diagnostics)
   */
  getVerseCount: async () => {
    try {
      // This is a private method in the loader, so we create a safe wrapper
      const verses = await neo4jDatabaseService.getVerses();
      return verses.length;
    } catch (error) {
      console.error('Error getting verse count:', error);
      return 0;
    }
  },
  
  /**
   * Get database connection status
   */
  getDatabaseStatus: () => {
    const isOffline = neo4jDatabaseService.isOfflineMode();
    return {
      isConnected: !isOffline,
      isOffline: isOffline,
      mode: isOffline ? 'offline' : 'online',
    };
  }
};

// Export a default object for easier imports
export default {
  Database: DatabaseService,
  Auth: AuthService,
  Storage: StorageService,
  Sync: SyncService,
  BibleData: BibleDataService
}; 