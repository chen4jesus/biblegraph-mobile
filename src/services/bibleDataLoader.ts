import { neo4jDriverService } from './neo4jDriver';
import { Verse, Connection, ConnectionType } from '../types/bible';
import { v4 as uuidv4 } from 'uuid';

// Sample Bible verses 
const sampleVerses: Omit<Verse, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    book: 'Genesis',
    chapter: 1,
    verse: 1,
    text: 'In the beginning God created the heavens and the earth.',
    translation: 'NIV',
  },
  {
    book: 'Genesis',
    chapter: 1,
    verse: 2,
    text: 'Now the earth was formless and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters.',
    translation: 'NIV',
  },
  {
    book: 'John',
    chapter: 1,
    verse: 1,
    text: 'In the beginning was the Word, and the Word was with God, and the Word was God.',
    translation: 'NIV',
  },
  {
    book: 'John',
    chapter: 1,
    verse: 2,
    text: 'He was with God in the beginning.',
    translation: 'NIV',
  },
  {
    book: 'John',
    chapter: 1,
    verse: 3,
    text: 'Through him all things were made; without him nothing was made that has been made.',
    translation: 'NIV',
  },
  {
    book: 'Romans',
    chapter: 8,
    verse: 28,
    text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
    translation: 'NIV',
  },
  {
    book: 'Philippians',
    chapter: 4,
    verse: 13,
    text: 'I can do all this through him who gives me strength.',
    translation: 'NIV',
  },
  {
    book: 'Psalm',
    chapter: 23,
    verse: 1,
    text: 'The LORD is my shepherd, I lack nothing.',
    translation: 'NIV',
  },
  {
    book: 'John',
    chapter: 3,
    verse: 16,
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    translation: 'NIV',
  },
  {
    book: 'Romans',
    chapter: 3,
    verse: 23,
    text: 'For all have sinned and fall short of the glory of God.',
    translation: 'NIV',
  },
];

// Sample connections
const createSampleConnections = (verseIds: string[]): Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>[] => [
  {
    sourceVerseId: verseIds[0], // Genesis 1:1
    targetVerseId: verseIds[2], // John 1:1
    type: ConnectionType.CROSS_REFERENCE,
    description: 'Both verses speak about "In the beginning"',
  },
  {
    sourceVerseId: verseIds[2], // John 1:1
    targetVerseId: verseIds[3], // John 1:2
    type: ConnectionType.PARALLEL,
    description: 'Continuing narrative',
  },
  {
    sourceVerseId: verseIds[3], // John 1:2
    targetVerseId: verseIds[4], // John 1:3
    type: ConnectionType.PARALLEL,
    description: 'Continuing narrative about the Word',
  },
  {
    sourceVerseId: verseIds[0], // Genesis 1:1
    targetVerseId: verseIds[4], // John 1:3
    type: ConnectionType.THEME,
    description: 'Creation theme',
  },
  {
    sourceVerseId: verseIds[8], // John 3:16
    targetVerseId: verseIds[9], // Romans 3:23
    type: ConnectionType.THEME,
    description: 'Salvation theme',
  },
];

class BibleDataLoader {
  private static instance: BibleDataLoader;

  private constructor() {}

  public static getInstance(): BibleDataLoader {
    if (!BibleDataLoader.instance) {
      BibleDataLoader.instance = new BibleDataLoader();
    }
    return BibleDataLoader.instance;
  }

  public async loadSampleData(): Promise<void> {
    try {
      // Connect to Neo4j
      await neo4jDriverService.connect();
      
      // Initialize database schema
      await neo4jDriverService.initializeDatabase();
      
      // Check if there's already data
      const existingVerses = await this.getVerseCount();
      
      if (existingVerses > 0) {
        console.log(`Database already contains ${existingVerses} verses, skipping sample data loading`);
        return;
      }
      
      console.log('Loading sample Bible data into Neo4j database...');
      
      // Create verses
      const verseIds: string[] = [];
      
      for (const verse of sampleVerses) {
        const verseId = await this.createVerse(verse);
        verseIds.push(verseId);
      }
      
      // Create connections
      const sampleConnections = createSampleConnections(verseIds);
      
      for (const connection of sampleConnections) {
        await this.createConnection(connection);
      }
      
      console.log('Sample data loaded successfully!');
    } catch (error) {
      console.error('Error loading sample data:', error);
      throw error;
    }
  }
  
  private async getVerseCount(): Promise<number> {
    const session = neo4jDriverService.getSession();
    try {
      const result = await session.run('MATCH (v:Verse) RETURN count(v) as count');
      return parseInt(result.records[0].get('count').toString());
    } finally {
      await session.close();
    }
  }
  
  private async createVerse(verse: Omit<Verse, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const session = neo4jDriverService.getSession();
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      await session.run(`
        CREATE (v:Verse {
          id: $id,
          book: $book,
          chapter: $chapter,
          verse: $verse,
          text: $text,
          translation: $translation,
          createdAt: $now,
          updatedAt: $now
        })
        RETURN v
      `, {
        id,
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse,
        text: verse.text,
        translation: verse.translation,
        now
      });
      
      return id;
    } finally {
      await session.close();
    }
  }
  
  private async createConnection(connection: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const session = neo4jDriverService.getSession();
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      await session.run(`
        MATCH (v1:Verse {id: $sourceVerseId})
        MATCH (v2:Verse {id: $targetVerseId})
        CREATE (v1)-[c:CONNECTS_TO {
          id: $id,
          type: $type,
          description: $description,
          createdAt: $now,
          updatedAt: $now
        }]->(v2)
        RETURN c
      `, {
        id,
        sourceVerseId: connection.sourceVerseId,
        targetVerseId: connection.targetVerseId,
        type: connection.type,
        description: connection.description,
        now
      });
      
      return id;
    } finally {
      await session.close();
    }
  }
}

export const bibleDataLoader = BibleDataLoader.getInstance(); 