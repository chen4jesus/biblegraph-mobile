import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import { Verse, Connection, Note, ConnectionType, VerseGroup, GroupConnection, NodeType } from '../types/bible';
import { v4 as uuidv4 } from 'uuid';

// Type for creating a new connection
interface ConnectionCreateInput {
  sourceVerseId: string;
  targetVerseId: string;
  type: ConnectionType;
  description?: string;
}

class Neo4jDriver {
  private static instance: Neo4jDriver;
  private driver: Driver | null = null;
  private uri: string;
  private username: string;
  private password: string;

  private constructor() {
    // These should be loaded from environment variables or secure storage
    this.uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
    this.username = process.env.NEO4J_USERNAME || 'neo4j';
    this.password = process.env.NEO4J_PASSWORD || 'password';
  }

  public static getInstance(): Neo4jDriver {
    if (!Neo4jDriver.instance) {
      Neo4jDriver.instance = new Neo4jDriver();
    }
    return Neo4jDriver.instance;
  }

  public async connect(): Promise<void> {
    if (this.driver) {
      return;
    }

    try {
      this.driver = neo4j.driver(
        this.uri,
        neo4j.auth.basic(this.username, this.password),
        { encrypted: process.env.NODE_ENV === 'production' }
      );
      
      // Test the connection
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      
      console.debug('Successfully connected to Neo4j database');
    } catch (error) {
      console.error('Error connecting to Neo4j:', error);
      throw new Error('Failed to connect to Neo4j database');
    }
  }

  public async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      console.debug('Disconnected from Neo4j database');
    }
  }

  public getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session();
  }

  // Helper method to ensure integers for Neo4j parameters
  private ensureInteger(value: number): number {
    return Math.floor(value);
  }

  // Verse methods
  public async getVerses(signal?: AbortSignal, verseIds?: string[]): Promise<Verse[]> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const session = this.getSession();
    try {
      // Check if aborted before executing query
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      let query: string;
      let params: any = {};
      
      if (verseIds && verseIds.length > 0) {
        // If specific verse IDs are provided, get only those verses
        query = `
          MATCH (v:Verse)
          WHERE v.id IN $verseIds
          RETURN v
          ORDER BY v.book, v.chapter, v.verse
        `;
        params = { verseIds };
      } else {
        // Fallback to original behavior if no IDs are specified
        query = `
          MATCH (v:Verse)
          RETURN v
          ORDER BY v.book, v.chapter, v.verse
          LIMIT 10
        `;
      }

      const result = await session.run(query, params);
      
      // Check if aborted after query
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      return result.records.map(record => {
        const verseProps = record.get('v').properties;
        return {
          id: verseProps.id.toString(),
          book: verseProps.book,
          // Use integer conversion for chapter and verse as they are Long types in Neo4j
          chapter: this.toLongInt(verseProps.chapter),
          verse: this.toLongInt(verseProps.verse),
          text: verseProps.text,
          translation: verseProps.translation || 'ESV',
          createdAt: verseProps.createdAt || new Date().toISOString(),
          updatedAt: verseProps.updatedAt || new Date().toISOString(),
        };
      });
    } finally {
      await session.close();
    }
  }

  // Helper method to convert Neo4j Long values to JavaScript integers
  private toLongInt(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }
    // Handle both string numbers and Neo4j integer objects
    try {
      return typeof value.toNumber === 'function' 
        ? value.toNumber() 
        : parseInt(value.toString(), 10);
    } catch (e) {
      console.warn('Error converting to integer:', e);
      return 0;
    }
  }

  public async getVerse(id: string, signal?: AbortSignal): Promise<Verse | null> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const session = this.getSession();
    try {
      // Check if aborted before executing query
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const result = await session.run(`
        MATCH (v:Verse {id: $id})
        RETURN v
      `, { id });
      
      // Check if aborted after query
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      if (result.records.length === 0) {
        return null;
      }
      
      const verseProps = result.records[0].get('v').properties;
      return {
        id: verseProps.id.toString(),
        book: verseProps.book,
        chapter: this.toLongInt(verseProps.chapter),
        verse: this.toLongInt(verseProps.verse),
        text: verseProps.text,
        translation: verseProps.translation || 'ESV',
        createdAt: verseProps.createdAt || new Date().toISOString(),
        updatedAt: verseProps.updatedAt || new Date().toISOString(),
      };
    } finally {
      session.close();
    }
  }

  public async createVerse(verse: Verse): Promise<Verse> {
    const session = this.getSession();
    try {
      // Ensure chapter and verse are integers
      const verseWithIntegerValues = {
        ...verse,
        chapter: Math.floor(verse.chapter),
        verse: Math.floor(verse.verse)
      };
      
      // Use MERGE instead of CREATE to handle existing verses
      const result = await session.run(`
        MERGE (v:Verse {book: $book, chapter: $chapter, verse: $verse})
        ON CREATE SET 
          v.id = $id,
          v.text = $text,
          v.translation = $translation,
          v.createdAt = $createdAt,
          v.updatedAt = $updatedAt
        ON MATCH SET
          v.text = CASE WHEN v.text IS NULL OR v.text = '' THEN $text ELSE v.text END,
          v.translation = CASE WHEN v.translation IS NULL THEN $translation ELSE v.translation END,
          v.updatedAt = $updatedAt
        RETURN v
      `, verseWithIntegerValues);
      
      if (result.records.length === 0) {
        throw new Error('Failed to create verse');
      }
      
      const verseProps = result.records[0].get('v').properties;
      return {
        id: verseProps.id.toString(),
        book: verseProps.book,
        chapter: parseInt(verseProps.chapter.toString()),
        verse: parseInt(verseProps.verse.toString()),
        text: verseProps.text,
        translation: verseProps.translation || 'ESV',
        createdAt: verseProps.createdAt || new Date().toISOString(),
        updatedAt: verseProps.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error creating verse:', error);
      throw error;
    } finally {
      session.close();
    }
  }

  public async searchVerses(query: string): Promise<Verse[]> {
    const session = this.getSession();
    try {
      // Use fulltext search if available, otherwise use basic CONTAINS
      const result = await session.run(`
        MATCH (v:Verse)
        WHERE v.text CONTAINS $query OR v.book CONTAINS $query
        RETURN v
        ORDER BY v.book, v.chapter, v.verse
        LIMIT 100
      `, { query });
      
      return result.records.map(record => {
        const verseProps = record.get('v').properties;
        return {
          id: verseProps.id.toString(),
          book: verseProps.book,
          chapter: parseInt(verseProps.chapter.toString()),
          verse: parseInt(verseProps.verse.toString()),
          text: verseProps.text,
          translation: verseProps.translation || 'ESV',
          createdAt: verseProps.createdAt || new Date().toISOString(),
          updatedAt: verseProps.updatedAt || new Date().toISOString(),
        };
      });
    } finally {
      await session.close();
    }
  }

  // Connection methods
  public async getConnections(signal?: AbortSignal): Promise<Connection[]> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const session = this.getSession();
    try {
      // Check if aborted before executing query
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const result = await session.run(`
        MATCH (v1:Verse)-[c:CONNECTS_TO]->(v2:Verse)
        RETURN c, v1.id as sourceId, v2.id as targetId
        LIMIT 100
      `);
      
      // Check if aborted after query
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      return result.records.map(record => {
        const connectionProps = record.get('c').properties;
        return {
          id: connectionProps.id.toString(),
          sourceVerseId: record.get('sourceId'),
          targetVerseId: record.get('targetId'),
          type: connectionProps.type as ConnectionType,
          description: connectionProps.description || '',
          createdAt: connectionProps.createdAt || new Date().toISOString(),
          updatedAt: connectionProps.updatedAt || new Date().toISOString(),
        };
      });
    } finally {
      await session.close();
    }
  }

  public async getConnectionsForVerse(verseId: string, signal?: AbortSignal): Promise<Connection[]> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const session = this.getSession();
    try {
      // Check if aborted before executing query
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const result = await session.run(`
        MATCH (v:Verse {id: $verseId})-[c:CONNECTS_TO]->(v2:Verse)
        RETURN c, v.id as sourceId, v2.id as targetId
        UNION
        MATCH (v1:Verse)-[c:CONNECTS_TO]->(v:Verse {id: $verseId})
        RETURN c, v1.id as sourceId, v.id as targetId
        LIMIT 100
      `, { verseId });
      
      // Check if aborted after query
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      // Use a Map to deduplicate connections by source-target-type
      const uniqueConnections = new Map<string, Connection>();
      
      // Add a limit check to prevent too many records
      const recordsToProcess = result.records.slice(0, 100);
      
      recordsToProcess.forEach(record => {
        try {
          const connectionProps = record.get('c')?.properties;
          // Skip this record if connection or properties are undefined
          if (!connectionProps) {
            console.warn('Connection properties undefined in record:', record);
            return;
          }
          
          const sourceId = record.get('sourceId');
          const targetId = record.get('targetId');
          // Skip this record if source or target ID is undefined
          if (!sourceId || !targetId) {
            console.warn('Source or target ID undefined in record:', record);
            return;
          }
          
          const type = connectionProps.type as ConnectionType;
          
          // Create a unique key based on source, target, and type
          const uniqueKey = `${sourceId}-${targetId}-${type}`;
          
          // Only add if not already in the map
          if (!uniqueConnections.has(uniqueKey)) {
            // Make sure all properties exist before accessing them
            uniqueConnections.set(uniqueKey, {
              id: connectionProps.id ? connectionProps.id.toString() : `temp-${Date.now()}`,
              sourceVerseId: sourceId,
              targetVerseId: targetId,
              type: type,
              description: connectionProps.description || '',
              createdAt: connectionProps.createdAt || new Date().toISOString(),
              updatedAt: connectionProps.updatedAt || new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('Error processing connection record:', error);
          // Continue with next record
        }
      });
      
      return Array.from(uniqueConnections.values());
    } finally {
      await session.close();
    }
  }

  public async createConnection(connection: ConnectionCreateInput): Promise<Connection> {
    const session = this.getSession();
    const now = new Date().toISOString();
    const id = uuidv4();
    
    try {
      // First verify both verses exist
      const versesResult = await session.run(`
        MATCH (source:Verse {id: $sourceId})
        MATCH (target:Verse {id: $targetId}) 
        RETURN source, target
      `, { 
        sourceId: connection.sourceVerseId,
        targetId: connection.targetVerseId
      });

      if (versesResult.records.length === 0) {
        throw new Error(`One or both verses not found: ${connection.sourceVerseId} -> ${connection.targetVerseId}`);
      }
      
      // Check if connection already exists
      const existingResult = await session.run(`
        MATCH (v1:Verse {id: $sourceId})-[c:CONNECTS_TO]->(v2:Verse {id: $targetId})
        WHERE c.type = $type
        RETURN c
      `, {
        sourceId: connection.sourceVerseId,
        targetId: connection.targetVerseId,
        type: connection.type
      });
      
      // If connection already exists, return it
      if (existingResult.records.length > 0) {
        const existingProps = existingResult.records[0].get('c').properties;
        return {
          id: existingProps.id.toString(),
          sourceVerseId: connection.sourceVerseId,
          targetVerseId: connection.targetVerseId,
          type: connection.type,
          description: existingProps.description,
          createdAt: existingProps.createdAt,
          updatedAt: existingProps.updatedAt,
        };
      }
      
      // Create new connection
      const result = await session.run(`
        MATCH (v1:Verse {id: $sourceId})
        MATCH (v2:Verse {id: $targetId})
        CREATE (v1)-[c:CONNECTS_TO {
          id: $id,
          type: $type,
          description: $description,
          createdAt: $now,
          updatedAt: $now
        }]->(v2)
        RETURN c, v1.id as sourceId, v2.id as targetId
      `, {
        id,
        sourceId: connection.sourceVerseId,
        targetId: connection.targetVerseId,
        type: connection.type,
        description: connection.description,
        now
      });
      
      if (result.records.length === 0) {
        throw new Error(`Failed to create connection between ${connection.sourceVerseId} and ${connection.targetVerseId}`);
      }
      
      const record = result.records[0];
      const connectionProps = record.get('c').properties;
      
      return {
        id: connectionProps.id.toString(),
        sourceVerseId: record.get('sourceId'),
        targetVerseId: record.get('targetId'),
        type: connectionProps.type as ConnectionType,
        description: connectionProps.description,
        createdAt: connectionProps.createdAt,
        updatedAt: connectionProps.updatedAt,
      };
    } catch (error) {
      console.error(`Error creating connection from ${connection.sourceVerseId} to ${connection.targetVerseId}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  public async updateConnection(connectionId: string, updates: Partial<Connection>): Promise<Connection> {
    const session = this.getSession();
    const now = new Date().toISOString();
    
    try {
      // Build dynamic update properties
      const updateProps = Object.entries(updates)
        .filter(([key]) => !['id', 'sourceVerseId', 'targetVerseId', 'createdAt'].includes(key))
        .map(([key, value]) => `c.${key} = $${key}`)
        .join(', ');
      
      const params = {
        id: connectionId,
        ...updates,
        updatedAt: now
      };
      
      const query = `
        MATCH (v1:Verse)-[c:CONNECTS_TO {id: $id}]->(v2:Verse)
        SET c.updatedAt = $updatedAt, ${updateProps}
        RETURN c, v1.id as sourceId, v2.id as targetId
      `;
      
      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        throw new Error(`Connection with id ${connectionId} not found`);
      }
      
      const record = result.records[0];
      const connectionProps = record.get('c').properties;
      
      return {
        id: connectionProps.id.toString(),
        sourceVerseId: record.get('sourceId'),
        targetVerseId: record.get('targetId'),
        type: connectionProps.type as ConnectionType,
        description: connectionProps.description,
        createdAt: connectionProps.createdAt,
        updatedAt: connectionProps.updatedAt,
      };
    } finally {
      await session.close();
    }
  }

  public async deleteConnection(connectionId: string): Promise<boolean> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (v1:Verse)-[c:CONNECTS_TO {id: $id}]->(v2:Verse)
        DELETE c
        RETURN count(c) as deleted
      `, { id: connectionId });
      
      return result.records[0].get('deleted') > 0;
    } finally {
      await session.close();
    }
  }

  // Note methods
  public async getNotes(skip: number = 0, limit: number = 20): Promise<Note[]> {
    const session = this.getSession();
    try {
      // Ensure skip and limit are integers
      const skipInt = Math.max(0, Math.floor(skip));
      const limitInt = Math.max(1, Math.floor(limit));
      
      const result = await session.run(`
        MATCH (n:Note)-[:ABOUT]->(v:Verse)
        RETURN n, v.id as verseId, 
               CASE WHEN n.tags IS NOT NULL THEN n.tags ELSE [] END as tags
        ORDER BY n.updatedAt DESC
        SKIP toInteger($skipInt)
        LIMIT toInteger($limitInt)
      `, { skipInt, limitInt });
      
      return result.records.map(record => {
        const noteProps = record.get('n').properties;
        const tags = record.get('tags') || [];
        return {
          id: noteProps.id.toString(),
          verseId: record.get('verseId'),
          content: noteProps.content,
          // Ensure tags is always an array of strings
          tags: Array.isArray(tags) ? tags.map(tag => tag.toString()) : [],
          createdAt: noteProps.createdAt,
          updatedAt: noteProps.updatedAt,
        };
      });
    } finally {
      await session.close();
    }
  }

  public async getNotesForVerse(verseId: string): Promise<Note[]> {
    const session = this.getSession();
    try {
      const limitValue = 100; // Use a constant integer
      
      const result = await session.run(`
        MATCH (n:Note)-[:ABOUT]->(v:Verse {id: $verseId})
        RETURN n, 
               CASE WHEN n.tags IS NOT NULL THEN n.tags ELSE [] END as tags
        ORDER BY n.updatedAt DESC
        LIMIT toInteger($limit)
      `, { 
        verseId,
        limit: limitValue 
      });
      
      return result.records.map(record => {
        const noteProps = record.get('n').properties;
        const tags = record.get('tags') || [];
        return {
          id: noteProps.id.toString(),
          verseId: verseId,
          content: noteProps.content,
          // Ensure tags is always an array of strings
          tags: Array.isArray(tags) ? tags.map(tag => tag.toString()) : [],
          createdAt: noteProps.createdAt,
          updatedAt: noteProps.updatedAt,
        };
      });
    } finally {
      await session.close();
    }
  }

  public async createNote(verseId: string, content: string, tags: string[] = []): Promise<Note> {
    const session = this.getSession();
    const now = new Date().toISOString();
    const id = uuidv4();
    
    try {
      // First verify the verse exists
      const verseResult = await session.run(`
        MATCH (v:Verse {id: $verseId})
        RETURN v
      `, { verseId });

      if (verseResult.records.length === 0) {
        throw new Error(`Verse with id ${verseId} not found`);
      }

      // Ensure tags is a proper string array
      const tagsArray = Array.isArray(tags) 
        ? tags.filter(tag => tag && typeof tag === 'string').map(tag => tag.trim())
        : [];

      const result = await session.run(`
        MATCH (v:Verse {id: $verseId})
        CREATE (n:Note {
          id: $id,
          content: $content,
          tags: $tags,
          createdAt: $now,
          updatedAt: $now
        })-[:ABOUT]->(v)
        RETURN n
      `, {
        id,
        verseId,
        content,
        tags: tagsArray,
        now
      });
      
      if (result.records.length === 0) {
        throw new Error('Failed to create note');
      }
      
      const noteProps = result.records[0].get('n').properties;
      return {
        id: noteProps.id.toString(),
        content: noteProps.content.toString(),
        tags: tagsArray,
        createdAt: noteProps.createdAt.toString(),
        updatedAt: noteProps.updatedAt.toString(),
        verseId
      };
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    } finally {
      session.close();
    }
  }

  public async updateNote(noteId: string, updates: Partial<Note>): Promise<Note> {
    const session = this.getSession();
    const now = new Date().toISOString();
    
    try {
      let query = `
        MATCH (n:Note {id: $id})-[:ABOUT]->(v:Verse)
        SET n.content = $content, n.updatedAt = $now
      `;
      
      // Add tags to the update if provided
      if (updates.tags) {
        query += `, n.tags = $tags`;
      }
      
      query += `
        RETURN n, v.id as verseId,
               CASE WHEN n.tags IS NOT NULL THEN n.tags ELSE [] END as tags
      `;
      
      const params: Record<string, any> = {
        id: noteId,
        content: updates.content || '',
        now
      };
      
      if (updates.tags) {
        // Ensure tags is a proper string array before updating
        params.tags = Array.isArray(updates.tags) 
          ? updates.tags.filter(tag => tag && typeof tag === 'string').map(tag => tag.trim())
          : [];
      }
      
      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        throw new Error(`Note with id ${noteId} not found`);
      }
      
      const record = result.records[0];
      const noteProps = record.get('n').properties;
      const verseId = record.get('verseId');
      const tags = record.get('tags') || [];
      
      return {
        id: noteProps.id.toString(),
        verseId,
        content: noteProps.content,
        // Ensure tags is returned as an array of strings
        tags: Array.isArray(tags) ? tags.map(tag => tag.toString()) : [],
        createdAt: noteProps.createdAt,
        updatedAt: noteProps.updatedAt
      };
    } finally {
      await session.close();
    }
  }

  public async deleteNote(noteId: string): Promise<boolean> {
    const session = this.getSession();
    try {
      // First verify the note exists
      const checkResult = await session.run(`
        MATCH (n:Note {id: $id})
        RETURN count(n) as noteExists
      `, { id: noteId });
      
      if (checkResult.records[0].get('noteExists') === 0) {
        console.debug(`Note with id ${noteId} not found, nothing to delete`);
        return false;
      }
      
      // Then delete it with explicit transaction
      const txc = session.beginTransaction();
      try {
        const deleteResult = await txc.run(`
          MATCH (n:Note {id: $id})
          DETACH DELETE n
          RETURN count(n) as deleted
        `, { id: noteId });
        
        const deleted = deleteResult.records[0].get('deleted') > 0;
        
        if (deleted) {
          await txc.commit();
          console.debug(`Successfully deleted note ${noteId}`);
          return true;
        } else {
          await txc.rollback();
          console.error(`Failed to delete note ${noteId}`);
          return false;
        }
      } catch (txError) {
        await txc.rollback();
        console.error(`Transaction error deleting note ${noteId}:`, txError);
        throw txError;
      }
    } catch (error) {
      console.error(`Error in deleteNote for ${noteId}:`, error);
      return false;
    } finally {
      await session.close();
    }
  }

  // Database initialization and management
  public async initializeDatabase(): Promise<void> {
    const session = this.getSession();
    try {
      // Create necessary constraints and indexes
      await session.run('CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE');
      await session.run('CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE');
      await session.run('CREATE INDEX user_email_idx IF NOT EXISTS FOR (u:User) ON (u.email)');
      
      // Other existing constraints and indexes
      await session.run('CREATE CONSTRAINT verse_id IF NOT EXISTS FOR (v:Verse) REQUIRE v.id IS UNIQUE');
      await session.run('CREATE CONSTRAINT connection_id IF NOT EXISTS FOR (c:Connection) REQUIRE c.id IS UNIQUE');
      await session.run('CREATE CONSTRAINT note_id IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE');
      await session.run('CREATE CONSTRAINT group_id IF NOT EXISTS FOR (g:VerseGroup) REQUIRE g.id IS UNIQUE');
      await session.run('CREATE CONSTRAINT group_connection_id IF NOT EXISTS FOR (gc:GroupConnection) REQUIRE gc.id IS UNIQUE');
      
      console.debug('Neo4j database indexes and constraints created');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
  
  public async getVerseByReference(book: string, chapter: number, verse: number): Promise<Verse | null> {
    const session = this.getSession();
    try {
      // Ensure chapter and verse are integers
      const chapterInt = Math.floor(chapter);
      const verseInt = Math.floor(verse);
      
      const result = await session.run(`
        MATCH (v:Verse)
        WHERE v.book = $book AND v.chapter = $chapter AND v.verse = $verse
        RETURN v
      `, { 
        book, 
        chapter: chapterInt, 
        verse: verseInt
      });
      
      if (result.records.length === 0) {
        // If no exact match, try a more flexible search
        return this.findVerseWithFlexibleBookName(book, chapterInt, verseInt);
      }
      
      const verseProps = result.records[0].get('v').properties;
      return {
        id: verseProps.id.toString(),
        book: verseProps.book,
        chapter: this.toLongInt(verseProps.chapter),
        verse: this.toLongInt(verseProps.verse),
        text: verseProps.text,
        translation: verseProps.translation || 'ESV',
        createdAt: verseProps.createdAt || new Date().toISOString(),
        updatedAt: verseProps.updatedAt || new Date().toISOString(),
      };
    } finally {
      session.close();
    }
  }

  // New method to find a verse with more flexible book name matching
  private async findVerseWithFlexibleBookName(bookName: string, chapter: number, verse: number): Promise<Verse | null> {
    console.debug(`Trying flexible search for: ${bookName} ${chapter}:${verse}`);
    const session = this.getSession();
    try {
      // Ensure we're using integer values
      const chapterInt = Math.floor(chapter);
      const verseInt = Math.floor(verse);
      
      // Try case-insensitive match
      const result = await session.run(`
        MATCH (v:Verse)
        WHERE toLower(v.book) = toLower($book) AND v.chapter = $chapter AND v.verse = $verse
        RETURN v
      `, { 
        book: bookName, 
        chapter: chapterInt, 
        verse: verseInt 
      });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const verseProps = result.records[0].get('v').properties;
      return {
        id: verseProps.id.toString(),
        book: verseProps.book,
        chapter: this.toLongInt(verseProps.chapter),
        verse: this.toLongInt(verseProps.verse),
        text: verseProps.text,
        translation: verseProps.translation || 'ESV',
        createdAt: verseProps.createdAt || new Date().toISOString(),
        updatedAt: verseProps.updatedAt || new Date().toISOString(),
      };
    } finally {
      session.close();
    }
  }

  // Batch create multiple connections
  public async createConnectionsBatch(connections: ConnectionCreateInput[]): Promise<Connection[]> {
    if (!connections || connections.length === 0) {
      return [];
    }
    
    const session = this.getSession();
    const now = new Date().toISOString();
    const results: Connection[] = [];
    
    try {
      // Use a transaction to ensure all-or-nothing creation
      const txc = session.beginTransaction();
      
      try {
        for (const connection of connections) {
          const id = uuidv4();
          
          // Verify both verses exist within the transaction
          const versesResult = await txc.run(`
            MATCH (source:Verse {id: $sourceId})
            MATCH (target:Verse {id: $targetId}) 
            RETURN source, target
          `, { 
            sourceId: connection.sourceVerseId,
            targetId: connection.targetVerseId
          });
  
          if (versesResult.records.length === 0) {
            console.warn(`Skipping connection: One or both verses not found: ${connection.sourceVerseId} -> ${connection.targetVerseId}`);
            continue;
          }
          
          // Check if connection already exists
          const existingResult = await txc.run(`
            MATCH (v1:Verse {id: $sourceId})-[c:CONNECTS_TO]->(v2:Verse {id: $targetId})
            WHERE c.type = $type
            RETURN c
          `, {
            sourceId: connection.sourceVerseId,
            targetId: connection.targetVerseId,
            type: connection.type
          });
          
          // If connection already exists, add it to results
          if (existingResult.records.length > 0) {
            const existingProps = existingResult.records[0].get('c').properties;
            results.push({
              id: existingProps.id.toString(),
              sourceVerseId: connection.sourceVerseId,
              targetVerseId: connection.targetVerseId,
              type: connection.type,
              description: existingProps.description,
              createdAt: existingProps.createdAt,
              updatedAt: existingProps.updatedAt,
            });
            continue;
          }
          
          // Create new connection
          const result = await txc.run(`
            MATCH (v1:Verse {id: $sourceId})
            MATCH (v2:Verse {id: $targetId})
            CREATE (v1)-[c:CONNECTS_TO {
              id: $id,
              type: $type,
              description: $description,
              createdAt: $now,
              updatedAt: $now
            }]->(v2)
            RETURN c, v1.id as sourceId, v2.id as targetId
          `, {
            id,
            sourceId: connection.sourceVerseId,
            targetId: connection.targetVerseId,
            type: connection.type,
            description: connection.description,
            now
          });
          
          if (result.records.length > 0) {
            const record = result.records[0];
            const connectionProps = record.get('c').properties;
            
            results.push({
              id: connectionProps.id.toString(),
              sourceVerseId: record.get('sourceId'),
              targetVerseId: record.get('targetId'),
              type: connectionProps.type as ConnectionType,
              description: connectionProps.description,
              createdAt: connectionProps.createdAt,
              updatedAt: connectionProps.updatedAt,
            });
          }
        }
        
        // Commit the transaction if all operations were successful
        await txc.commit();
        return results;
        
      } catch (error) {
        // Rollback the transaction if there was an error
        await txc.rollback();
        console.error('Error in batch connection creation:', error);
        throw error;
      }
    } finally {
      await session.close();
    }
  }

  // Create a verse group
  public async createVerseGroup(name: string, verseIds: string[], description: string = ''): Promise<VerseGroup> {
    const session = this.getSession();
    const id = uuidv4();
    const now = new Date().toISOString();
    
    try {
      // First verify all verses exist
      const verseCheckResult = await session.run(`
        MATCH (v:Verse)
        WHERE v.id IN $verseIds
        RETURN count(v) as verseCount
      `, { verseIds });
      
      const foundCount = verseCheckResult.records[0].get('verseCount').toNumber();
      if (foundCount !== verseIds.length) {
        throw new Error(`Not all verses exist: found ${foundCount} of ${verseIds.length} requested verses`);
      }
      
      // Create the verse group node
      const result = await session.run(`
        CREATE (g:VerseGroup {
          id: $id,
          name: $name,
          description: $description,
          verseIds: $verseIds,
          createdAt: $now,
          updatedAt: $now
        })
        RETURN g
      `, { id, name, description, verseIds, now });
      
      // Create relationships between group and verses for faster querying
      await session.run(`
        MATCH (g:VerseGroup {id: $groupId})
        MATCH (v:Verse)
        WHERE v.id IN $verseIds
        CREATE (g)-[:CONTAINS]->(v)
      `, { groupId: id, verseIds });
      
      const groupNode = result.records[0].get('g');
      const groupProps = groupNode.properties;
      
      return {
        id: groupProps.id,
        name: groupProps.name,
        description: groupProps.description,
        verseIds: groupProps.verseIds,
        createdAt: groupProps.createdAt,
        updatedAt: groupProps.updatedAt
      };
    } finally {
      session.close();
    }
  }

  // Get a verse group by ID
  public async getVerseGroup(groupId: string): Promise<VerseGroup | null> {
    const session = this.getSession();
    
    try {
      const result = await session.run(`
        MATCH (g:VerseGroup {id: $groupId})
        RETURN g
      `, { groupId });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const groupNode = result.records[0].get('g');
      const groupProps = groupNode.properties;
      
      return {
        id: groupProps.id,
        name: groupProps.name,
        description: groupProps.description,
        verseIds: groupProps.verseIds,
        createdAt: groupProps.createdAt,
        updatedAt: groupProps.updatedAt
      };
    } finally {
      session.close();
    }
  }

  // Get all verse groups
  public async getVerseGroups(): Promise<VerseGroup[]> {
    const session = this.getSession();
    
    try {
      const result = await session.run(`
        MATCH (g:VerseGroup)
        RETURN g
        ORDER BY g.createdAt DESC
      `);
      
      return result.records.map(record => {
        const groupNode = record.get('g');
        const groupProps = groupNode.properties;
        
        return {
          id: groupProps.id,
          name: groupProps.name,
          description: groupProps.description,
          verseIds: groupProps.verseIds,
          createdAt: groupProps.createdAt,
          updatedAt: groupProps.updatedAt
        };
      });
    } finally {
      session.close();
    }
  }

  // Enhanced createGroupConnection method to support many-to-many relationships between any node types
  public async createGroupConnection(
    sourceIds: string[], 
    targetIds: string[], 
    type: ConnectionType, 
    description: string = '',
    options: {
      sourceType: NodeType,
      targetType: NodeType,
      relationshipType?: string,
      metadata?: Record<string, any>,
      name?: string
    }
  ): Promise<GroupConnection> {
    const session = this.getSession();
    const groupConnectionId = uuidv4();
    const now = new Date().toISOString();
    
    // Default name if not provided
    const name = options.name || `${options.sourceType} to ${options.targetType} Group (${now.substring(0, 10)})`;
    
    // Default relationship type based on source and target types
    const relationshipType = options.relationshipType || 'CONNECTS_TO';
    
    try {
      // Start transaction
      const txc = session.beginTransaction();
      try {
        // Create connections for each source-target pair with the same groupConnectionId
        const connectionIds: string[] = [];
        
        for (const sourceId of sourceIds) {
          for (const targetId of targetIds) {
            // Skip self-connections only if same node type and same ID
            if (options.sourceType === options.targetType && sourceId === targetId) continue;
            
            const connectionId = uuidv4();
            connectionIds.push(connectionId);
            
            // Create the individual connection with the group ID reference
            // Using parameterized Cypher with dynamic node labels
            await txc.run(`
              MATCH (source:${options.sourceType} {id: $sourceId})
              MATCH (target:${options.targetType} {id: $targetId})
              CREATE (source)-[c:${relationshipType} {
                id: $connectionId,
                groupConnectionId: $groupConnectionId,
                type: $type,
                description: $description,
                createdAt: $now,
                updatedAt: $now
              }]->(target)
            `, {
              sourceId,
              targetId,
              connectionId,
              groupConnectionId,
              type,
              description,
              now
            });
          }
        }

        // Convert metadata to a JSON string if it exists
        const metadataString = options.metadata ? JSON.stringify(options.metadata) : null;

        // Create the group connection node
        const result = await txc.run(`
          CREATE (gc:GroupConnection {
            id: $groupConnectionId,
            name: $name,
            connectionIds: $connectionIds,
            type: $type,
            description: $description,
            sourceIds: $sourceIds,
            targetIds: $targetIds,
            sourceType: $sourceType,
            targetType: $targetType,
            metadata: $metadata,
            createdAt: $now,
            updatedAt: $now
          })
          RETURN gc
        `, { 
          groupConnectionId, 
          name, 
          connectionIds,
          type, 
          description,
          sourceIds,
          targetIds,
          sourceType: options.sourceType,
          targetType: options.targetType,
          metadata: metadataString, // Pass the stringified metadata
          now 
        });
        
        await txc.commit();
        
        const gcNode = result.records[0].get('gc');
        const gcProps = gcNode.properties;
        
        // Parse the metadata back from string to object if it exists
        const parsedMetadata = gcProps.metadata ? JSON.parse(gcProps.metadata) : {};
        
        return {
          id: gcProps.id,
          name: gcProps.name,
          connectionIds: gcProps.connectionIds,
          type: gcProps.type,
          description: gcProps.description,
          createdAt: gcProps.createdAt,
          updatedAt: gcProps.updatedAt,
          sourceIds: gcProps.sourceIds,
          targetIds: gcProps.targetIds,
          sourceType: gcProps.sourceType,
          targetType: gcProps.targetType,
          metadata: parsedMetadata // Return the parsed metadata
        };
      } catch (error) {
        await txc.rollback();
        throw error;
      }
    } finally {
      session.close();
    }
  }

  // Add a method to get connections by group ID
  public async getConnectionsByGroupId(groupId: string): Promise<Connection[]> {
    const session = this.getSession();
    
    try {
      const result = await session.run(`
        MATCH (v1:Verse)-[c:CONNECTS_TO]->(v2:Verse)
        WHERE c.groupConnectionId = $groupId
        RETURN c, v1.id as sourceId, v2.id as targetId
      `, { groupId });
      
      return result.records.map(record => {
        const connectionProps = record.get('c').properties;
        return {
          id: connectionProps.id.toString(),
          sourceVerseId: record.get('sourceId'),
          targetVerseId: record.get('targetId'),
          type: connectionProps.type as ConnectionType,
          description: connectionProps.description || '',
          groupConnectionId: connectionProps.groupConnectionId,
          createdAt: connectionProps.createdAt || new Date().toISOString(),
          updatedAt: connectionProps.updatedAt || new Date().toISOString(),
        };
      });
    } finally {
      session.close();
    }
  }

  // Update getGroupConnectionsByVerseId to use the new model
  public async getGroupConnectionsByVerseId(verseId: string): Promise<GroupConnection[]> {
    const session = this.getSession();
    
    try {
      // First get all connections involving this verse
      const connectionResult = await session.run(`
        MATCH (v:Verse {id: $verseId})-[c:CONNECTS_TO]->(otherV)
        WHERE c.groupConnectionId IS NOT NULL
        RETURN DISTINCT c.groupConnectionId as gcId
        UNION
        MATCH (otherV)-[c:CONNECTS_TO]->(v:Verse {id: $verseId})
        WHERE c.groupConnectionId IS NOT NULL
        RETURN DISTINCT c.groupConnectionId as gcId
      `, { verseId });
      
      // Extract the distinct group connection IDs
      const groupIds = connectionResult.records.map(record => record.get('gcId'));
      
      if (groupIds.length === 0) {
        return [];
      }
      
      // Now fetch the group connections
      const result = await session.run(`
        MATCH (gc:GroupConnection)
        WHERE gc.id IN $groupIds
        RETURN gc
      `, { groupIds });
      
      return await Promise.all(result.records.map(async record => {
        const gcProps = record.get('gc').properties;
        
        // Get all connections for this group
        const connections = await this.getConnectionsByGroupId(gcProps.id);
        
        // Parse metadata if it exists and is a string
        let metadata = {};
        if (gcProps.metadata) {
          try {
            if (typeof gcProps.metadata === 'string') {
              metadata = JSON.parse(gcProps.metadata);
            } else {
              metadata = gcProps.metadata;
            }
          } catch (e) {
            console.warn('Error parsing metadata for group connection:', e);
            metadata = gcProps.metadata; // Use as-is if parsing fails
          }
        }
        
        return {
          id: gcProps.id,
          name: gcProps.name || '',
          connectionIds: connections.map(c => c.id),
          type: gcProps.type,
          description: gcProps.description || '',
          createdAt: gcProps.createdAt,
          updatedAt: gcProps.updatedAt,
          sourceIds: gcProps.sourceIds || [],
          targetIds: gcProps.targetIds || [],
          sourceType: gcProps.sourceType || 'VERSE',
          targetType: gcProps.targetType || 'VERSE',
          metadata: metadata
        };
      }));
    } finally {
      session.close();
    }
  }

  // User methods
  public async createUser(name: string, email: string, password: string): Promise<any> {
    const session = this.getSession();
    try {
      // First check if the user already exists
      const checkResult = await session.run(`
        MATCH (u:User {email: $email})
        RETURN u
      `, { email });
      
      if (checkResult.records.length > 0) {
        throw new Error('User with this email already exists');
      }
      
      // Create a unique ID for the new user
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      
      // In a production environment, you would hash the password here
      
      // Create the user in the database
      const result = await session.run(`
        CREATE (u:User {
          id: $userId,
          name: $name,
          email: $email,
          password: $password,
          createdAt: $now,
          updatedAt: $now
        })
        RETURN u
      `, { userId, name, email, password, now });
      
      const userNode = result.records[0].get('u').properties;
      
      return {
        id: userNode.id.toString(),
        name: userNode.name,
        email: userNode.email,
        createdAt: userNode.createdAt,
        updatedAt: userNode.updatedAt,
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
  
  public async getUserByEmailAndPassword(email: string, password: string): Promise<any> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (u:User {email: $email, password: $password})
        RETURN u
      `, { email, password });
      
      if (result.records.length === 0) {
        throw new Error('Invalid email or password');
      }
      
      const userNode = result.records[0].get('u').properties;
      
      return {
        id: userNode.id.toString(),
        name: userNode.name,
        email: userNode.email,
        createdAt: userNode.createdAt,
        updatedAt: userNode.updatedAt,
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
  
  public async getUserById(userId: string): Promise<any> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (u:User {id: $userId})
        RETURN u
      `, { userId });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const userNode = result.records[0].get('u').properties;
      
      return {
        id: userNode.id.toString(),
        name: userNode.name,
        email: userNode.email,
        createdAt: userNode.createdAt,
        updatedAt: userNode.updatedAt,
      };
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
}

export const neo4jDriverService = Neo4jDriver.getInstance(); 