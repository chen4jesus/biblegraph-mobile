import { neo4jDriverService } from './neo4jDriver';
import { Verse, Connection, Note, ConnectionType, User } from '../types/bible';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Token storage key
const TOKEN_KEY = '@biblegraph:auth_token';

class Neo4jDatabaseService {
  private static instance: Neo4jDatabaseService;
  private isInitialized = false;
  private user: User | null = null;

  private constructor() {}

  public static getInstance(): Neo4jDatabaseService {
    if (!Neo4jDatabaseService.instance) {
      Neo4jDatabaseService.instance = new Neo4jDatabaseService();
    }
    return Neo4jDatabaseService.instance;
  }

  // Initialization
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await neo4jDriverService.connect();
      await neo4jDriverService.initializeDatabase();
      this.isInitialized = true;
      console.log('Neo4j database service initialized');
    } catch (error) {
      console.error('Failed to initialize Neo4j database service:', error);
      throw error;
    }
  }

  // Authentication
  public async login(email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      await this.ensureInitialized();
      
      // In a real app, you would validate credentials against a user store in Neo4j
      // For demo purposes, we'll simulate a successful login
      const token = `demo_token_${Date.now()}`;
      const user: User = {
        id: '1',
        name: 'Demo User',
        email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Store the token
      await AsyncStorage.setItem(TOKEN_KEY, token);
      this.user = user;
      
      return { token, user };
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Authentication failed. Please check your credentials.');
    }
  }

  public async signUp(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      await this.ensureInitialized();
      
      // In a real app, you would create a new user in Neo4j
      // For demo purposes, we'll simulate a successful registration
      const token = `demo_token_${Date.now()}`;
      const user: User = {
        id: '1',
        name,
        email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Store the token
      await AsyncStorage.setItem(TOKEN_KEY, token);
      this.user = user;
      
      return { token, user };
    } catch (error) {
      console.error('Sign up failed:', error);
      throw new Error('Registration failed. Please try again.');
    }
  }

  public async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      this.user = null;
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  public async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      return !!token;
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  public async getCurrentUser(): Promise<User | null> {
    if (this.user) {
      return this.user;
    }

    // In a real app, you would fetch the user from Neo4j based on the stored token
    // For demo purposes, we'll return a mock user if we have a token
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        this.user = {
          id: '1',
          name: 'Demo User',
          email: 'demo@example.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return this.user;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Verse methods
  public async getVerses(): Promise<Verse[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getVerses();
  }

  public async getVerse(id: string): Promise<Verse | null> {
    await this.ensureInitialized();
    return neo4jDriverService.getVerse(id);
  }

  public async getVerseByReference(book: string, chapter: number, verse: number): Promise<Verse | null> {
    await this.ensureInitialized();
    return neo4jDriverService.getVerseByReference(book, chapter, verse);
  }

  public async createVerse(verse: Verse): Promise<Verse> {
    await this.ensureInitialized();
    return neo4jDriverService.createVerse(verse);
  }

  public async searchVerses(query: string): Promise<Verse[]> {
    await this.ensureInitialized();
    return neo4jDriverService.searchVerses(query);
  }

  // Connection methods
  public async getConnections(): Promise<Connection[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getConnections();
  }

  public async getConnectionsForVerse(verseId: string): Promise<Connection[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getConnectionsForVerse(verseId);
  }

  public async createConnection(connection: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Connection> {
    await this.ensureInitialized();
    return neo4jDriverService.createConnection(connection);
  }

  public async updateConnection(connectionId: string, updates: Partial<Connection>): Promise<Connection> {
    await this.ensureInitialized();
    return neo4jDriverService.updateConnection(connectionId, updates);
  }

  public async deleteConnection(connectionId: string): Promise<boolean> {
    await this.ensureInitialized();
    return neo4jDriverService.deleteConnection(connectionId);
  }

  // Note methods
  public async getNotes(): Promise<Note[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getNotes();
  }

  public async getNotesForVerse(verseId: string): Promise<Note[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getNotesForVerse(verseId);
  }

  public async createNote(verseId: string, content: string, tags: string[] = []): Promise<Note> {
    await this.ensureInitialized();
    return neo4jDriverService.createNote(verseId, content, tags);
  }

  public async updateNote(noteId: string, updates: Partial<Note>): Promise<Note> {
    await this.ensureInitialized();
    return neo4jDriverService.updateNote(noteId, updates);
  }

  public async deleteNote(noteId: string): Promise<boolean> {
    await this.ensureInitialized();
    return neo4jDriverService.deleteNote(noteId);
  }

  // Helper methods
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

export const neo4jDatabaseService = Neo4jDatabaseService.getInstance(); 