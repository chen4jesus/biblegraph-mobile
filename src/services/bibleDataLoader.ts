import { neo4jDriverService } from './neo4jDriver';
import { Verse, Connection, ConnectionType } from '../types/bible';
import { v4 as uuidv4 } from 'uuid';
import { XMLParser } from 'fast-xml-parser';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

class BibleDataLoader {
  private static instance: BibleDataLoader;

  private constructor() {}

  public static getInstance(): BibleDataLoader {
    if (!BibleDataLoader.instance) {
      BibleDataLoader.instance = new BibleDataLoader();
    }
    return BibleDataLoader.instance;
  }

  /**
   * Checks if Bible data is already loaded in the database
   */
  public async isBibleLoaded(): Promise<boolean> {
    try {
      const verseCount = await this.getVerseCount();
      // If we have verses, we consider the Bible as loaded
      return verseCount > 0;
    } catch (error) {
      console.error("Error checking if Bible is loaded:", error);
      return false;
    }
  }

  /**
   * Loads Bible data from the XML file into Neo4j
   */
  public async loadXmlData(): Promise<void> {
    try {
      // Connect to Neo4j
      await neo4jDriverService.connect();
      
      // Initialize database schema
      await neo4jDriverService.initializeDatabase();
      
      // Check if there's already data
      const existingVerses = await this.getVerseCount();
      
      if (existingVerses > 0) {
        console.debug(`Database already contains ${existingVerses} verses, skipping XML data loading`);
        return;
      }
      
      console.debug('Loading Bible data from XML into Neo4j database...');
      
      // Read the XML file
      console.debug('Reading XML file...');
      const xmlContent = await this.readXmlFile();
      console.debug('XML file read successfully, parsing content...');
      
      // Parse XML
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        textNodeName: '_text'
      });
      
      console.debug('Parsing XML content...');
      const parsedXml = parser.parse(xmlContent);
      const bibleData = parsedXml.bible;
      console.debug('XML parsing complete, beginning database loading...');
      
      // Keep track of created verse IDs for creating connections later
      const verseIdMap: Record<string, string> = {};
      let totalBooks = 0;
      let totalChapters = 0;
      let totalVerses = 0;
      
      // Set limits for loading to prevent overloading
      const MAX_VERSES_TO_LOAD = 5000;
      const MAX_CONNECTIONS_TO_CREATE = 5000;
      let shouldStopLoadingVerses = false;
      
      // Process books
      if (bibleData.book && Array.isArray(bibleData.book)) {
        totalBooks = bibleData.book.length;
        console.debug(`Found ${totalBooks} books in the Bible XML`);
        
        for (let bookIndex = 0; bookIndex < bibleData.book.length && !shouldStopLoadingVerses; bookIndex++) {
          const book = bibleData.book[bookIndex];
          const bookName = book.name;
          const bookCode = book.code;
          
          // Process chapters
          if (book.chapter && Array.isArray(book.chapter)) {
            const bookChapters = book.chapter.length;
            totalChapters += bookChapters;
            
            console.debug(`Processing book ${bookIndex + 1}/${totalBooks}: ${bookName} (${bookChapters} chapters)`);
            
            for (let chapterIndex = 0; chapterIndex < book.chapter.length && !shouldStopLoadingVerses; chapterIndex++) {
              const chapter = book.chapter[chapterIndex];
              const chapterNumber = parseInt(chapter.number);
              
              // Process verses
              if (chapter.verse && Array.isArray(chapter.verse)) {
                const chapterVerses = chapter.verse.length;
                
                if (chapterIndex === 0 || chapterIndex === book.chapter.length - 1 || chapterIndex % 10 === 0) {
                  console.debug(`  - Chapter ${chapterNumber}: ${chapterVerses} verses`);
                }
                
                for (const verse of chapter.verse) {
                  if (totalVerses >= MAX_VERSES_TO_LOAD) {
                    console.debug(`Reached maximum verse limit of ${MAX_VERSES_TO_LOAD}. Stopping verse loading.`);
                    shouldStopLoadingVerses = true;
                    break;
                  }
                  
                  const verseNumber = parseInt(verse.number);
                  const verseText = verse._text || '';
                  
                  // Create verse in Neo4j
                  const verseData = {
                    book: bookName,
                    chapter: chapterNumber,
                    verse: verseNumber,
                    text: verseText.trim(),
                    translation: '中文和合本', // Chinese Union Version Simplified
                  };
                  
                  const verseId = await this.createVerse(verseData);
                  
                  // Store verse ID for later connection creation
                  const verseKey = `${bookCode}_${chapterNumber}_${verseNumber}`;
                  verseIdMap[verseKey] = verseId;
                  totalVerses++;
                  
                  // Log progress occasionally
                  if (totalVerses % 500 === 0) {
                    console.debug(`Processed ${totalVerses} verses so far...`);
                  }
                }
              }
            }
          }
        }
      }
      
      console.debug(`Successfully loaded ${totalVerses} verses from ${totalChapters} chapters across ${totalBooks} books`);
      
      // Create basic connections - connect consecutive verses in each chapter
      console.debug('Creating basic verse connections...');
      await this.createBasicConnections(verseIdMap, MAX_CONNECTIONS_TO_CREATE);
      
      console.debug('XML data loaded successfully!');
    } catch (error: any) {
      console.error('Error loading XML data:', error);
      throw error;
    }
  }

  /**
   * Reads the XML file from the app bundle
   */
  private async readXmlFile(): Promise<string> {
    try {
      if (Platform.OS === 'web') {
        // For web, we can use a different approach, like fetch
        const response = await fetch('/assets/data/Bible_CUVS.xml');
        return await response.text();
      } else {
        // For native platforms, use FileSystem
        // Get the path to the XML file in the app's assets directory
        const fileUri = `${FileSystem.documentDirectory}Bible_CUVS.xml`;
        
        // Check if the file is already copied to the document directory
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        if (!fileInfo.exists) {
          // Copy the file from assets to document directory if it doesn't exist
          console.debug('Copying Bible XML file to document directory...');
          
          // For Android/iOS, we need to copy the file from the asset bundle
          const assetModule = require('../data/Bible_CUVS.xml');
          const asset = Asset.fromModule(assetModule);
          await asset.downloadAsync();
          
          if (!asset.localUri) {
            throw new Error('Failed to get local URI for Bible XML file');
          }
          
          // Copy the asset to the document directory
          await FileSystem.copyAsync({
            from: asset.localUri,
            to: fileUri
          });
          
          console.debug('Bible XML file copied successfully');
        }
        
        // Read the file from the document directory
        const content = await FileSystem.readAsStringAsync(fileUri);
        console.debug(`Read XML file successfully, size: ${content.length} bytes`);
        return content;
      }
    } catch (error: any) {
      console.error('Error reading XML file:', error);
      throw new Error(`Failed to read Bible XML file: ${error.message}`);
    }
  }

  /**
   * Creates basic connections between consecutive verses in the same chapter
   */
  private async createBasicConnections(verseIdMap: Record<string, string>, maxConnections: number = 5000): Promise<void> {
    try {
      // Group verse keys by book and chapter
      const chapterVerses: Record<string, string[]> = {};
      
      console.debug('Organizing verses by chapter for connection creation...');
      
      // Group verse keys
      for (const verseKey of Object.keys(verseIdMap)) {
        const [bookCode, chapter, verse] = verseKey.split('_');
        const chapterKey = `${bookCode}_${chapter}`;
        
        if (!chapterVerses[chapterKey]) {
          chapterVerses[chapterKey] = [];
        }
        
        chapterVerses[chapterKey].push(verseKey);
      }
      
      const totalChapters = Object.keys(chapterVerses).length;
      console.debug(`Creating connections for ${totalChapters} chapters...`);
      
      // For each chapter, connect consecutive verses
      let connectionCount = 0;
      let chapterCount = 0;
      let shouldStopCreatingConnections = false;
      
      for (const chapterKey of Object.keys(chapterVerses)) {
        if (shouldStopCreatingConnections) {
          break;
        }
        
        chapterCount++;
        const [bookCode, chapterNum] = chapterKey.split('_');
        
        const verses = chapterVerses[chapterKey]
          .sort((a, b) => {
            const verseA = parseInt(a.split('_')[2]);
            const verseB = parseInt(b.split('_')[2]);
            return verseA - verseB;
          });
        
        if (chapterCount % 20 === 0 || chapterCount === 1 || chapterCount === totalChapters) {
          console.debug(`Creating connections for chapter ${chapterCount}/${totalChapters}: ${bookCode} ${chapterNum} (${verses.length} verses)`);
        }
        
        // Connect consecutive verses
        for (let i = 0; i < verses.length - 1; i++) {
          if (connectionCount >= maxConnections) {
            console.debug(`Reached maximum connection limit of ${maxConnections}. Stopping connection creation.`);
            shouldStopCreatingConnections = true;
            break;
          }
          
          const sourceVerseId = verseIdMap[verses[i]];
          const targetVerseId = verseIdMap[verses[i + 1]];
          
          await this.createConnection({
            sourceVerseId,
            targetVerseId,
            type: ConnectionType.PARALLEL,
            description: 'Consecutive verses',
          });
          
          connectionCount++;
          
          // Log progress occasionally
          if (connectionCount % 1000 === 0) {
            console.debug(`Created ${connectionCount} connections (${Math.round(chapterCount/totalChapters*100)}% complete)...`);
          }
        }
      }
      
      console.debug(`Created ${connectionCount} consecutive verse connections across ${chapterCount} chapters`);
    } catch (error: any) {
      console.error('Error creating basic connections:', error);
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