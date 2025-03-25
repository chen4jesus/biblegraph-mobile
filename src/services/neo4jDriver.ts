import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import { Verse, Connection, Note, ConnectionType } from '../types/bible';
import { v4 as uuidv4 } from 'uuid';

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
      
      console.log('Successfully connected to Neo4j database');
    } catch (error) {
      console.error('Error connecting to Neo4j:', error);
      throw new Error('Failed to connect to Neo4j database');
    }
  }

  public async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      console.log('Disconnected from Neo4j database');
    }
  }

  public getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session();
  }

  // Verse methods
  public async getVerses(): Promise<Verse[]> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (v:Verse)
        RETURN v
        ORDER BY v.book, v.chapter, v.verse
      `);
      
      return result.records.map(record => {
        const verseProps = record.get('v').properties;
        return {
          id: verseProps.id.toString(),
          book: verseProps.book,
          chapter: parseInt(verseProps.chapter.toString()),
          verse: parseInt(verseProps.verse.toString()),
          text: verseProps.text,
          translation: verseProps.translation || 'NIV',
          createdAt: verseProps.createdAt || new Date().toISOString(),
          updatedAt: verseProps.updatedAt || new Date().toISOString(),
        };
      });
    } finally {
      await session.close();
    }
  }

  public async getVerse(id: string): Promise<Verse | null> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (v:Verse {id: $id})
        RETURN v
      `, { id });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const verseProps = result.records[0].get('v').properties;
      return {
        id: verseProps.id.toString(),
        book: verseProps.book,
        chapter: parseInt(verseProps.chapter.toString()),
        verse: parseInt(verseProps.verse.toString()),
        text: verseProps.text,
        translation: verseProps.translation || 'NIV',
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
      `, verse);
      
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
        translation: verseProps.translation || 'NIV',
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
          translation: verseProps.translation || 'NIV',
          createdAt: verseProps.createdAt || new Date().toISOString(),
          updatedAt: verseProps.updatedAt || new Date().toISOString(),
        };
      });
    } finally {
      await session.close();
    }
  }

  // Connection methods
  public async getConnections(): Promise<Connection[]> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (v1:Verse)-[c:CONNECTS_TO]->(v2:Verse)
        RETURN c, v1.id as sourceId, v2.id as targetId
      `);
      
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

  public async getConnectionsForVerse(verseId: string): Promise<Connection[]> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (v:Verse {id: $verseId})-[c:CONNECTS_TO]->(v2:Verse)
        RETURN c, v.id as sourceId, v2.id as targetId
        UNION
        MATCH (v1:Verse)-[c:CONNECTS_TO]->(v:Verse {id: $verseId})
        RETURN c, v1.id as sourceId, v.id as targetId
      `, { verseId });
      
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

  public async createConnection(connection: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Connection> {
    const session = this.getSession();
    const now = new Date().toISOString();
    const id = uuidv4();
    
    try {
      const result = await session.run(`
        MATCH (v1:Verse {id: $sourceVerseId})
        MATCH (v2:Verse {id: $targetVerseId})
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
        sourceVerseId: connection.sourceVerseId,
        targetVerseId: connection.targetVerseId,
        type: connection.type,
        description: connection.description,
        now
      });
      
      if (result.records.length === 0) {
        throw new Error('Failed to create connection');
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
  public async getNotes(): Promise<Note[]> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (n:Note)-[:ABOUT]->(v:Verse)
        RETURN n, v.id as verseId, 
               CASE WHEN n.tags IS NOT NULL THEN n.tags ELSE [] END as tags
        ORDER BY n.updatedAt DESC
      `);
      
      return result.records.map(record => {
        const noteProps = record.get('n').properties;
        const tags = record.get('tags') || [];
        return {
          id: noteProps.id.toString(),
          verseId: record.get('verseId'),
          content: noteProps.content,
          tags: Array.isArray(tags) ? tags : [],
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
      const result = await session.run(`
        MATCH (n:Note)-[:ABOUT]->(v:Verse {id: $verseId})
        RETURN n, 
               CASE WHEN n.tags IS NOT NULL THEN n.tags ELSE [] END as tags
        ORDER BY n.updatedAt DESC
      `, { verseId });
      
      return result.records.map(record => {
        const noteProps = record.get('n').properties;
        const tags = record.get('tags') || [];
        return {
          id: noteProps.id.toString(),
          verseId: verseId,
          content: noteProps.content,
          tags: Array.isArray(tags) ? tags : [],
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
        tags,
        now
      });
      
      if (result.records.length === 0) {
        throw new Error('Failed to create note');
      }
      
      const noteProps = result.records[0].get('n').properties;
      return {
        id: noteProps.id.toString(),
        content: noteProps.content.toString(),
        tags,
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
        content: updates.content,
        now
      };
      
      if (updates.tags) {
        params.tags = updates.tags;
      }
      
      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        throw new Error(`Note with id ${noteId} not found`);
      }
      
      const record = result.records[0];
      const noteProps = record.get('n').properties;
      const tags = record.get('tags') || [];
      
      return {
        id: noteProps.id.toString(),
        verseId: record.get('verseId'),
        content: noteProps.content,
        tags: Array.isArray(tags) ? tags : [],
        createdAt: noteProps.createdAt,
        updatedAt: noteProps.updatedAt,
      };
    } finally {
      await session.close();
    }
  }

  public async deleteNote(noteId: string): Promise<boolean> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (n:Note {id: $id})
        DETACH DELETE n
        RETURN count(n) as deleted
      `, { id: noteId });
      
      return result.records[0].get('deleted') > 0;
    } finally {
      await session.close();
    }
  }

  // Database initialization and management
  public async initializeDatabase(): Promise<void> {
    const session = this.getSession();
    try {
      // Create constraints
      await session.run(`
        CREATE CONSTRAINT verse_id IF NOT EXISTS
        FOR (v:Verse) REQUIRE v.id IS UNIQUE
      `);
      
      await session.run(`
        CREATE CONSTRAINT note_id IF NOT EXISTS
        FOR (n:Note) REQUIRE n.id IS UNIQUE
      `);
      
      await session.run(`
        CREATE CONSTRAINT connection_id IF NOT EXISTS
        FOR ()-[c:CONNECTS_TO]-() REQUIRE c.id IS UNIQUE
      `);
      
      // Create composite constraint for verse references (book, chapter, verse)
      try {
        await session.run(`
          CREATE CONSTRAINT verse_reference IF NOT EXISTS
          FOR (v:Verse) REQUIRE (v.book, v.chapter, v.verse) IS UNIQUE
        `);
      } catch (error) {
        // For Neo4j versions that don't support composite constraints
        console.warn('Could not create composite constraint, creating index instead:', error);
        
        // Create fallback index
        await session.run(`
          CREATE INDEX verse_reference IF NOT EXISTS
          FOR (v:Verse) ON (v.book, v.chapter, v.verse)
        `);
      }
      
      console.log('Database schema initialized');
    } catch (error) {
      console.error('Error initializing database schema:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
  
  public async getVerseByReference(book: string, chapter: number, verse: number): Promise<Verse | null> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (v:Verse)
        WHERE v.book = $book AND v.chapter = $chapter AND v.verse = $verse
        RETURN v
      `, { 
        book, 
        chapter, 
        verse 
      });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const verseProps = result.records[0].get('v').properties;
      return {
        id: verseProps.id.toString(),
        book: verseProps.book,
        chapter: parseInt(verseProps.chapter.toString()),
        verse: parseInt(verseProps.verse.toString()),
        text: verseProps.text,
        translation: verseProps.translation || 'NIV',
        createdAt: verseProps.createdAt || new Date().toISOString(),
        updatedAt: verseProps.updatedAt || new Date().toISOString(),
      };
    } finally {
      session.close();
    }
  }
}

export const neo4jDriverService = Neo4jDriver.getInstance(); 