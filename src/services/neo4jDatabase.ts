import { neo4jDriverService } from './neo4jDriver';
import { Verse, Connection, Note, ConnectionType, User, VerseGroup, GroupConnection, NodeType, Tag } from '../types/bible';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService } from './storage';

// Token storage key
const TOKEN_KEY = '@biblegraph:auth_token';

// Add a mock data service for offline mode
const offlineDataService = {
  isOfflineMode: true,
  
  async getVerses(signal?: AbortSignal, verseIds?: string[]) {
    console.log('Using offline mode for getVerses');
    // Retrieve verses from local storage
    const storedVerses = await storageService.getVerses();
    
    // Filter if verseIds are provided
    if (verseIds && verseIds.length > 0) {
      return storedVerses.filter(verse => verseIds.includes(verse.id));
    }
    
    return storedVerses;
  },
  
  async getVerse(id: string) {
    console.log('Using offline mode for getVerse');
    const verses = await storageService.getVerses();
    return verses.find(verse => verse.id === id) || null;
  },
  
  async getConnections() {
    console.log('Using offline mode for getConnections');
    return storageService.getConnections();
  },
  
  async getConnectionsForVerse(verseId: string) {
    console.log('Using offline mode for getConnectionsForVerse');
    const connections = await storageService.getConnections();
    return connections.filter(
      conn => conn.sourceVerseId === verseId || conn.targetVerseId === verseId
    );
  },
  
  // Implement other required methods with local storage fallbacks
  // ...
};

class Neo4jDatabaseService {
  private static instance: Neo4jDatabaseService;
  private initialized = false;
  private offlineMode = false;
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
    if (this.initialized) {
      return;
    }

    try {
      // Try to connect to Neo4j
      await neo4jDriverService.connect();
      
      // If successful, initialize the database
      await neo4jDriverService.initializeDatabase();
      
      this.initialized = true;
      this.offlineMode = false;
      console.log('Neo4j database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Neo4j database:', error);
      // If Neo4j connection fails, switch to offline mode
      this.offlineMode = true;
      this.initialized = true; // We're still initialized, just in offline mode
      console.log('Switching to offline mode due to Neo4j connection failure');
    }
  }

  isOfflineMode(): boolean {
    return this.offlineMode;
  }

  // Authentication
  public async login(email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      await this.ensureInitialized();
      
      // Use the driver method to authenticate user
      const user = await neo4jDriverService.getUserByEmailAndPassword(email, password);
      
      // Generate a token for the user
      const token = `auth_token_${Date.now()}_${user.id}`;
      
      // Store the token
      await AsyncStorage.setItem(TOKEN_KEY, token);
      this.user = user;
      
      return { token, user };
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  public async signUp(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      await this.ensureInitialized();
      
      // Use the driver method to create a new user
      const user = await neo4jDriverService.createUser(name, email, password);
      
      // Generate a token for the user
      const token = `auth_token_${Date.now()}_${user.id}`;
      
      // Store the token
      await AsyncStorage.setItem(TOKEN_KEY, token);
      this.user = user;
      
      return { token, user };
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
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

    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return null;
      
      // Extract user ID from token
      const tokenParts = token.split('_');
      if (tokenParts.length < 3) return null;
      
      const userId = tokenParts[2]; // Assuming token format is 'auth_token_timestamp_userId'
      
      // Fetch the user from the database using the userId
      const user = await neo4jDriverService.getUserById(userId);
      if (!user) return null;
      
      this.user = user;
      return this.user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Verse methods
  public async getVerses(signal?: AbortSignal, verseIds?: string[]): Promise<Verse[]> {
    await this.ensureInitialized();
    
    if (this.offlineMode) {
      return offlineDataService.getVerses(signal, verseIds);
    }
    
    return neo4jDriverService.getVerses(signal, verseIds);
  }

  public async getVerse(id: string, signal?: AbortSignal): Promise<Verse | null> {
    await this.ensureInitialized();
    
    if (this.offlineMode) {
      return offlineDataService.getVerse(id);
    }
    
    return neo4jDriverService.getVerse(id, signal);
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
  public async getConnections(signal?: AbortSignal): Promise<Connection[]> {
    await this.ensureInitialized();
    
    if (this.offlineMode) {
      return offlineDataService.getConnections();
    }
    
    return neo4jDriverService.getConnections(signal);
  }

  public async getConnectionsForVerse(verseId: string, signal?: AbortSignal): Promise<Connection[]> {
    await this.ensureInitialized();
    
    if (this.offlineMode) {
      return offlineDataService.getConnectionsForVerse(verseId);
    }
    
    return neo4jDriverService.getConnectionsForVerse(verseId, signal);
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
  public async getNotes(skip: number = 0, limit: number = 20): Promise<Note[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getNotes(skip, limit);
  }

  public async getNote(noteId: string): Promise<Note | null> {
    await this.ensureInitialized();
    return neo4jDriverService.getNote(noteId);
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

  // Tag methods
  public async getTags(): Promise<Tag[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getTags();
  }

  public async getTagsWithCount(): Promise<(Tag & { count: number })[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getTagsWithCount();
  }

  public async createTag(name: string, color: string): Promise<Tag> {
    await this.ensureInitialized();
    return neo4jDriverService.createTag(name, color);
  }

  public async updateTag(tagId: string, updates: Partial<Tag>): Promise<Tag> {
    await this.ensureInitialized();
    return neo4jDriverService.updateTag(tagId, updates);
  }

  public async deleteTag(tagId: string): Promise<boolean> {
    await this.ensureInitialized();
    return neo4jDriverService.deleteTag(tagId);
  }

  // Helper methods
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public async createConnectionsBatch(
    connections: Array<Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Connection[]> {
    await this.ensureInitialized();
    return neo4jDriverService.createConnectionsBatch(connections);
  }

  public async createVerseGroup(
    name: string, 
    verseIds: string[], 
    description: string = ''
  ): Promise<VerseGroup> {
    return neo4jDriverService.createVerseGroup(name, verseIds, description);
  }

  public async getVerseGroup(groupId: string): Promise<VerseGroup | null> {
    return neo4jDriverService.getVerseGroup(groupId);
  }

  public async getVerseGroups(): Promise<VerseGroup[]> {
    return neo4jDriverService.getVerseGroups();
  }

  public async createGroupConnection(
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
    await this.ensureInitialized();
    // Ensure all required properties are set
    const fullOptions = {
      sourceType: options.sourceType || 'VERSE' as NodeType,
      targetType: options.targetType || 'VERSE' as NodeType,
      relationshipType: options.relationshipType,
      metadata: options.metadata || {},
      name: options.name
    };
    
    return neo4jDriverService.createGroupConnection(
      sourceIds, 
      targetIds, 
      type, 
      description, 
      fullOptions
    );
  }

  public async getGroupConnectionsByVerseId(verseId: string): Promise<GroupConnection[]> {
    return neo4jDriverService.getGroupConnectionsByVerseId(verseId);
  }
}

export const neo4jDatabaseService = Neo4jDatabaseService.getInstance(); 