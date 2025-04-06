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
  
  async getConnections(userId?: string) {
    console.log('Using offline mode for getConnections');
    return storageService.getConnections(userId);
  },
  
  async getConnectionsForVerse(verseId: string, userId?: string) {
    console.log('Using offline mode for getConnectionsForVerse');
    const connections = await storageService.getConnections(userId);
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
  public async getConnections(userId?: string, signal?: AbortSignal): Promise<Connection[]> {
    await this.ensureInitialized();
    
    if (this.offlineMode) {
      return offlineDataService.getConnections(userId);
    }
    
    return neo4jDriverService.getConnections(userId, signal);
  }

  public async getConnectionsForVerse(verseId: string, userId?: string, signal?: AbortSignal): Promise<Connection[]> {
    await this.ensureInitialized();
    
    if (this.offlineMode) {
      return offlineDataService.getConnectionsForVerse(verseId, userId);
    }
    
    return neo4jDriverService.getConnectionsForVerse(verseId, userId, signal);
  }

  public async createConnection(connection: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Connection> {
    await this.ensureInitialized();
    
    // Get current user for ownership
    const currentUser = await this.getCurrentUser();
    const userId = currentUser?.id;
    
    return neo4jDriverService.createConnection(connection, userId);
  }

  public async updateConnection(connectionId: string, updates: Partial<Connection>, userId?: string): Promise<Connection> {
    await this.ensureInitialized();
    
    // If userId is not provided, get current user for ownership check
    if (!userId) {
      const currentUser = await this.getCurrentUser();
      userId = currentUser?.id;
    }
    
    return neo4jDriverService.updateConnection(connectionId, updates, userId);
  }

  public async deleteConnection(connectionId: string, userId?: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // If userId is not provided, get current user for ownership check
    if (!userId) {
      const currentUser = await this.getCurrentUser();
      userId = currentUser?.id;
    }
    
    return neo4jDriverService.deleteConnection(connectionId, userId);
  }

  // Method to get connections owned by the current user
  public async getMyConnections(): Promise<Connection[]> {
    await this.ensureInitialized();
    
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      return [];
    }
    
    return neo4jDriverService.getConnectionsOwnedByUser(currentUser.id);
  }

  // Note methods
  public async getNotes(skip: number = 0, limit: number = 20, userId?: string): Promise<Note[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getNotes(skip, limit, userId);
  }

  public async getNote(noteId: string, userId?: string): Promise<Note | null> {
    await this.ensureInitialized();
    return neo4jDriverService.getNote(noteId, userId);
  }

  public async getNotesForVerse(verseId: string, userId?: string): Promise<Note[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getNotesForVerse(verseId, userId);
  }

  public async createNote(verseId: string, content: string, tags: string[] = [], userId?: string): Promise<Note> {
    await this.ensureInitialized();
    
    return neo4jDriverService.createNote(verseId, content, tags, userId);
  }

  public async updateNote(noteId: string, updates: Partial<Note>, userId?: string): Promise<Note> {
    await this.ensureInitialized();
    
    return neo4jDriverService.updateNote(noteId, updates, userId);
  }

  public async deleteNote(noteId: string, userId?: string): Promise<boolean> {
    await this.ensureInitialized();
    
    return neo4jDriverService.deleteNote(noteId, userId);
  }

  // Method to get notes owned by the current user
  public async getMyNotes(userId?: string): Promise<Note[]> {
    await this.ensureInitialized();
    
    return neo4jDriverService.getNotesOwnedByUser(userId || '');
  }
  
  // Methods for managing ownership
  public async attachUserToNote(noteId: string, targetUserId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // Get current user for ownership check
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in to manage ownership');
    }
    
    // Check if current user owns the note
    const ownsNote = await neo4jDriverService.userOwnsNote(currentUser.id, noteId);
    if (!ownsNote) {
      throw new Error('You do not have permission to manage this note');
    }
    
    return neo4jDriverService.attachUserToNote(targetUserId, noteId);
  }
  
  public async detachUserFromNote(noteId: string, targetUserId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // Get current user for ownership check
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in to manage ownership');
    }
    
    // Check if current user owns the note
    const ownsNote = await neo4jDriverService.userOwnsNote(currentUser.id, noteId);
    if (!ownsNote) {
      throw new Error('You do not have permission to manage this note');
    }
    
    return neo4jDriverService.detachUserFromNote(targetUserId, noteId);
  }
  
  public async attachUserToConnection(connectionId: string, targetUserId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // Get current user for ownership check
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in to manage ownership');
    }
    
    // Check if current user owns the connection
    const ownsConnection = await neo4jDriverService.userOwnsConnection(currentUser.id, connectionId);
    if (!ownsConnection) {
      throw new Error('You do not have permission to manage this connection');
    }
    
    return neo4jDriverService.attachUserToConnection(targetUserId, connectionId);
  }
  
  public async detachUserFromConnection(connectionId: string, targetUserId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // Get current user for ownership check
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in to manage ownership');
    }
    
    // Check if current user owns the connection
    const ownsConnection = await neo4jDriverService.userOwnsConnection(currentUser.id, connectionId);
    if (!ownsConnection) {
      throw new Error('You do not have permission to manage this connection');
    }
    
    return neo4jDriverService.detachUserFromConnection(targetUserId, connectionId);
  }

  // Tag methods
  public async getTags(userId?: string): Promise<Tag[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getTags(userId);
  }

  public async getTagsWithCount(userId?: string): Promise<(Tag & { count: number })[]> {
    await this.ensureInitialized();
    return neo4jDriverService.getTagsWithCount(userId);
  }

  public async createTag(name: string, color: string, userId?: string): Promise<Tag> {
    await this.ensureInitialized();
    return neo4jDriverService.createTag(name, color, userId);
  }

  public async updateTag(tagId: string, updates: Partial<Tag>, userId?: string): Promise<Tag> {
    await this.ensureInitialized();
    return neo4jDriverService.updateTag(tagId, updates, userId);
  }

  public async deleteTag(tagId: string, userId?: string): Promise<boolean> {
    await this.ensureInitialized();
    return neo4jDriverService.deleteTag(tagId, userId);
  }

  // Helper methods
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public async createConnectionsBatch(
    connections: Array<Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>>,
    userId?: string
  ): Promise<Connection[]> {
    await this.ensureInitialized();
    
    // If userId is not provided, get the current user
    if (!userId) {
      const currentUser = await this.getCurrentUser();
      userId = currentUser?.id;
    }
    
    return neo4jDriverService.createConnectionsBatch(connections, userId);
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
    
    // Get current user for ownership
    const currentUser = await this.getCurrentUser();
    const userId = currentUser?.id;
    
    // Ensure all required properties are set
    const fullOptions = {
      sourceType: options.sourceType || 'VERSE' as NodeType,
      targetType: options.targetType || 'VERSE' as NodeType,
      relationshipType: options.relationshipType,
      metadata: options.metadata || {},
      name: options.name,
      userId: userId
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