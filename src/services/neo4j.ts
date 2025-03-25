import { Verse, Connection, Note, User } from '../types/bible';
import { neo4jDatabaseService } from './neo4jDatabase';
import { storageService } from './storage';

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
  async getVerses(): Promise<Verse[]> {
    try {
      return await neo4jDatabaseService.getVerses();
    } catch (error) {
      console.error('Error fetching verses:', error);
      return [];
    }
  }

  async getVerse(id: string): Promise<Verse | null> {
    try {
      return await neo4jDatabaseService.getVerse(id);
    } catch (error) {
      console.error(`Error fetching verse ${id}:`, error);
      return null;
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
  async getConnections(): Promise<Connection[]> {
    try {
      return await neo4jDatabaseService.getConnections();
    } catch (error) {
      console.error('Error fetching connections:', error);
      return [];
    }
  }

  async getConnectionsForVerse(verseId: string): Promise<Connection[]> {
    try {
      return await neo4jDatabaseService.getConnectionsForVerse(verseId);
    } catch (error) {
      console.error(`Error fetching connections for verse ${verseId}:`, error);
      return [];
    }
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
  async getNotes(): Promise<Note[]> {
    try {
      return await neo4jDatabaseService.getNotes();
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
      throw error;
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
}

export const neo4jService = Neo4jService.getInstance(); 