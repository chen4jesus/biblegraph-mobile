import { Verse, Connection, Note, User, Tag } from '../types/bible';
import { neo4jDatabaseService } from './neo4jDatabase';
import { storageService } from './storage';
import { 
  ConnectionType, 
  VerseGroup, 
  GroupConnection,
  NodeType
} from '../types/bible';

class Neo4jService {
  private static instance: Neo4jService;
  private token: string | null = null;

  private constructor() {}

  public static getInstance(): Neo4jService {
    if (!Neo4jService.instance) {
      Neo4jService.instance = new Neo4jService();
    }
    return Neo4jService.instance;
  }

  public setToken(token: string) {
    this.token = token;
  }

  // Authentication methods
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      const result = await neo4jDatabaseService.login(email, password);
      this.setToken(result.token);
      return result;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async signUp(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      const result = await neo4jDatabaseService.signUp(name, email, password);
      this.setToken(result.token);
      return result;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await neo4jDatabaseService.logout();
      this.token = null;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Bible verse methods
  async getVerses(signal?: AbortSignal, verseIds?: string[]): Promise<Verse[]> {
    try {
      return await neo4jDatabaseService.getVerses(signal, verseIds);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.debug('Verse fetch aborted');
        return [];
      }
      console.error('Error fetching verses:', error);
      return [];
    }
  }

  async getVerse(id: string, signal?: AbortSignal): Promise<Verse | null> {
    console.debug(`[Neo4jService] Getting verse with id: ${id}`);
    try {
      const result = await neo4jDatabaseService.getVerse(id, signal);
      if (result) {
        console.debug(`[Neo4jService] Successfully fetched verse: ${result.book} ${result.chapter}:${result.verse}`);
      } else {
        console.warn(`[Neo4jService] Verse with id ${id} not found`);
      }
      return result;
    } catch (error) {
      console.error(`[Neo4jService] Error getting verse: ${error}`, error);
      return null; // Return null instead of throwing to handle gracefully in UI
    }
  }

  async getVerseByReference(book: string, chapter: number, verse: number): Promise<Verse | null> {
    try {
      return await neo4jDatabaseService.getVerseByReference(book, chapter, verse);
    } catch (error) {
      console.error(`Error fetching verse ${book} ${chapter}:${verse}:`, error);
      return null;
    }
  }

  async createVerse(verse: Verse): Promise<Verse> {
    try {
      return await neo4jDatabaseService.createVerse(verse);
    } catch (error) {
      console.error('Error creating verse:', error);
      throw error;
    }
  }

  async searchVerses(query: string): Promise<Verse[]> {
    try {
      return await neo4jDatabaseService.searchVerses(query);
    } catch (error) {
      console.error(`Error searching verses with query "${query}":`, error);
      return [];
    }
  }

  // Connection methods
  async getConnections(signal?: AbortSignal): Promise<Connection[]> {
    try {
      return await neo4jDatabaseService.getConnections(signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.debug('Connections fetch aborted');
        return [];
      }
      console.error('Error fetching connections:', error);
      return [];
    }
  }

  async getConnectionsForVerse(verseId: string, signal?: AbortSignal): Promise<Connection[]> {
    try {
      return await neo4jDatabaseService.getConnectionsForVerse(verseId, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.debug(`Connections for verse ${verseId} fetch aborted`);
        return [];
      }
      console.error(`Error fetching connections for verse ${verseId}:`, error);
      return [];
    }
  }

  // Add getConnectionsByVerseId as an alias for getConnectionsForVerse
  async getConnectionsByVerseId(verseId: string, signal?: AbortSignal): Promise<Connection[]> {
    // This is just an alias for getConnectionsForVerse for backward compatibility
    return this.getConnectionsForVerse(verseId, signal);
  }

  async createConnection(connection: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Connection> {
    try {
      return await neo4jDatabaseService.createConnection(connection);
    } catch (error) {
      console.error('Error creating connection:', error);
      throw error;
    }
  }

  async updateConnection(connectionId: string, updates: Partial<Connection>): Promise<Connection> {
    try {
      return await neo4jDatabaseService.updateConnection(connectionId, updates);
    } catch (error) {
      console.error(`Error updating connection ${connectionId}:`, error);
      throw error;
    }
  }

  async deleteConnection(connectionId: string): Promise<void> {
    try {
      await neo4jDatabaseService.deleteConnection(connectionId);
    } catch (error) {
      console.error(`Error deleting connection ${connectionId}:`, error);
      throw error;
    }
  }

  // Note methods
  async getNotes(skip: number = 0, limit: number = 20): Promise<Note[]> {
    try {
      return await neo4jDatabaseService.getNotes(skip, limit);
    } catch (error) {
      console.error('Error fetching notes:', error);
      return [];
    }
  }

  async getNotesForVerse(verseId: string): Promise<Note[]> {
    try {
      return await neo4jDatabaseService.getNotesForVerse(verseId);
    } catch (error) {
      console.error(`Error fetching notes for verse ${verseId}:`, error);
      return [];
    }
  }

  async createNote(verseId: string, content: string, tags: string[] = []): Promise<Note> {
    try {
      return await neo4jDatabaseService.createNote(verseId, content, tags);
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  async updateNote(noteId: string, updates: Partial<Note>): Promise<Note> {
    try {
      // Make sure tags is included in the updates
      // If tags is undefined or null, get the tags from the existing note
      if (!updates.tags) {
        const existingNote = await this.getNote(noteId);
        if (existingNote) {
          updates.tags = existingNote.tags || [];
        } else {
          updates.tags = [];
        }
      }

      // Ensure tags is always an array
      if (!Array.isArray(updates.tags)) {
        updates.tags = [];
      }

      return await neo4jDatabaseService.updateNote(noteId, updates);
    } catch (error) {
      console.error(`Error updating note ${noteId}:`, error);
      throw error;
    }
  }

  async deleteNote(noteId: string): Promise<boolean> {
    try {
      const success = await neo4jDatabaseService.deleteNote(noteId);
      if (!success) {
        console.warn(`Note deletion failed for ID: ${noteId}`);
        return false;
      }
      
      // Also delete from local storage to prevent resurrection
      try {
        const storedNotes = await storageService.getNotes();
        const filteredNotes = storedNotes.filter(note => note.id !== noteId);
        await storageService.saveNotes(filteredNotes);
      } catch (storageError) {
        console.warn('Failed to remove note from local storage:', storageError);
        // Continue since the primary database deletion was successful
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting note ${noteId}:`, error);
      return false;
    }
  }

  async getNote(noteId: string): Promise<Note | null> {
    try {
      const notes = await neo4jDatabaseService.getNotes();
      return notes.find(note => note.id === noteId) || null;
    } catch (error) {
      console.error(`Error getting note ${noteId}:`, error);
      return null;
    }
  }

  // User methods
  async getCurrentUser(): Promise<User | null> {
    try {
      return await neo4jDatabaseService.getCurrentUser();
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      return await neo4jDatabaseService.isAuthenticated();
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  async createConnectionsBatch(connections: Array<Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Connection[]> {
    try {
      return await neo4jDatabaseService.createConnectionsBatch(connections);
    } catch (error) {
      console.error('Error creating connections batch:', error);
      return [];
    }
  }

  async createVerseGroup(
    name: string, 
    verseIds: string[], 
    description: string = ''
  ): Promise<VerseGroup> {
    return await neo4jDatabaseService.createVerseGroup(name, verseIds, description);
  }

  async getVerseGroup(groupId: string): Promise<VerseGroup> {
    console.debug(`[Neo4jService] Getting verse group with id: ${groupId}`);
    try {
      const result = await neo4jDatabaseService.getVerseGroup(groupId);
      console.debug(`[Neo4jService] Successfully fetched verse group: ${JSON.stringify(result)}`);
      
      // Validate the verse group structure
      if (!result) {
        console.error(`[Neo4jService] Verse group with id ${groupId} not found`);
        throw new Error(`Verse group with id ${groupId} not found`);
      }
      
      if (!result.verseIds || !Array.isArray(result.verseIds)) {
        console.error(`[Neo4jService] Verse group missing verseIds array: ${JSON.stringify(result)}`);
        // Initialize empty array if missing to prevent crashes
        result.verseIds = [];
      } else {
        console.debug(`[Neo4jService] Verse group has ${result.verseIds.length} verses`);
      }
      
      return result;
    } catch (error) {
      console.error(`[Neo4jService] Error getting verse group: ${error}`, error);
      throw error;
    }
  }

  async getVerseGroups(): Promise<VerseGroup[]> {
    console.debug(`[Neo4jService] Getting all verse groups`);
    try {
      const result = await neo4jDatabaseService.getVerseGroups();
      console.debug(`[Neo4jService] Successfully fetched ${result.length} verse groups`);
      
      // Validate each verse group
      return result.map(group => {
        if (!group.verseIds || !Array.isArray(group.verseIds)) {
          console.warn(`[Neo4jService] Verse group ${group.id} missing verseIds array, initializing empty array`);
          group.verseIds = [];
        }
        return group;
      });
    } catch (error) {
      console.error(`[Neo4jService] Error getting verse groups: ${error}`, error);
      return [];
    }
  }

  async createGroupConnection(
    sourceIds: string[], 
    targetIds: string[], 
    type: ConnectionType, 
    description: string = '',
    options: {
      sourceType?: NodeType,
      targetType?: NodeType,
      relationshipType?: string,
      metadata?: Record<string, any>,
      name?: string
    } = {}
  ): Promise<GroupConnection> {
    try {
      // Set default options if not provided
      const fullOptions = {
        sourceType: options.sourceType || 'VERSE',
        targetType: options.targetType || 'VERSE',
        relationshipType: options.relationshipType,
        metadata: options.metadata || {},
        name: options.name
      };
      
      // Ensure metadata only contains primitive values and arrays
      if (fullOptions.metadata) {
        // If needed, convert complex objects to strings
        for (const key in fullOptions.metadata) {
          if (typeof fullOptions.metadata[key] === 'object' && fullOptions.metadata[key] !== null && !Array.isArray(fullOptions.metadata[key])) {
            fullOptions.metadata[key] = JSON.stringify(fullOptions.metadata[key]);
          }
        }
      }
      
      return await neo4jDatabaseService.createGroupConnection(
        sourceIds, 
        targetIds, 
        type, 
        description,
        fullOptions
      );
    } catch (error) {
      console.error('Error creating group connection:', error);
      throw error;
    }
  }

  async getGroupConnectionsByVerseId(verseId: string): Promise<GroupConnection[]> {
    return await neo4jDatabaseService.getGroupConnectionsByVerseId(verseId);
  }

  // Tag methods
  async getTags(): Promise<Tag[]> {
    try {
      return await neo4jDatabaseService.getTags();
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  }

  async getTagsWithCount(): Promise<(Tag & { count: number })[]> {
    try {
      return await neo4jDatabaseService.getTagsWithCount();
    } catch (error) {
      console.error('Error fetching tags with count:', error);
      return [];
    }
  }

  async createTag(name: string, color: string): Promise<Tag> {
    try {
      return await neo4jDatabaseService.createTag(name, color);
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }

  async updateTag(tagId: string, updates: Partial<Tag>): Promise<Tag> {
    try {
      return await neo4jDatabaseService.updateTag(tagId, updates);
    } catch (error) {
      console.error(`Error updating tag ${tagId}:`, error);
      throw error;
    }
  }

  async deleteTag(tagId: string): Promise<boolean> {
    try {
      return await neo4jDatabaseService.deleteTag(tagId);
    } catch (error) {
      console.error(`Error deleting tag ${tagId}:`, error);
      return false;
    }
  }
}

export const neo4jService = Neo4jService.getInstance(); 