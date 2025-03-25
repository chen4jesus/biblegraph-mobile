import { neo4jDriverService } from '../../src/services/neo4jDriver';
import { Verse, Note } from '../../src/types/bible';

// Mock Neo4j driver
jest.mock('neo4j-driver', () => {
  return {
    default: {
      driver: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          run: jest.fn().mockImplementation((query, params) => {
            // Mock implementation for different queries
            if (query.includes('CREATE CONSTRAINT')) {
              return Promise.resolve({ records: [] });
            }
            
            if (query.includes('MATCH (v:Verse) WHERE v.id')) {
              return Promise.resolve({
                records: [
                  {
                    get: (key: string) => {
                      if (key === 'v') {
                        return {
                          properties: {
                            id: 'John-3-16',
                            book: 'John',
                            chapter: 3,
                            verse: 16,
                            text: 'For God so loved the world...',
                            translation: 'NIV',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        };
                      }
                      return null;
                    },
                  },
                ],
              });
            }
            
            if (query.includes('MATCH (v:Verse) WHERE v.book')) {
              return Promise.resolve({
                records: [
                  {
                    get: (key: string) => {
                      if (key === 'v') {
                        return {
                          properties: {
                            id: 'John-3-16',
                            book: 'John',
                            chapter: 3,
                            verse: 16,
                            text: 'For God so loved the world...',
                            translation: 'NIV',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        };
                      }
                      return null;
                    },
                  },
                ],
              });
            }
            
            if (query.includes('MATCH (n:Note)')) {
              return Promise.resolve({
                records: [
                  {
                    get: (key: string) => {
                      if (key === 'n') {
                        return {
                          properties: {
                            id: 'note-1',
                            content: 'Test note',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        };
                      } else if (key === 'verseId') {
                        return 'John-3-16';
                      } else if (key === 'tags') {
                        return ['test', 'important'];
                      }
                      return null;
                    },
                  },
                ],
              });
            }
            
            // Default empty response
            return Promise.resolve({ records: [] });
          }),
          close: jest.fn(),
        }),
        close: jest.fn(),
      }),
      auth: {
        basic: jest.fn(),
      },
    },
  };
});

describe('Neo4jDriverService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the driver initialization
    Object.defineProperty(neo4jDriverService, 'driver', {
      value: {
        session: jest.fn().mockReturnValue({
          run: jest.fn().mockImplementation((query, params) => {
            if (query.includes('MATCH (v:Verse) WHERE v.id')) {
              return Promise.resolve({
                records: [
                  {
                    get: (key: string) => {
                      if (key === 'v') {
                        return {
                          properties: {
                            id: 'John-3-16',
                            book: 'John',
                            chapter: 3,
                            verse: 16,
                            text: 'For God so loved the world...',
                            translation: 'NIV',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        };
                      }
                      return null;
                    },
                  },
                ],
              });
            }
            
            if (query.includes('MATCH (v:Verse) WHERE v.book')) {
              return Promise.resolve({
                records: [
                  {
                    get: (key: string) => {
                      if (key === 'v') {
                        return {
                          properties: {
                            id: 'John-3-16',
                            book: 'John',
                            chapter: 3,
                            verse: 16,
                            text: 'For God so loved the world...',
                            translation: 'NIV',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        };
                      }
                      return null;
                    },
                  },
                ],
              });
            }
            
            if (query.includes('MATCH (n:Note)')) {
              return Promise.resolve({
                records: [
                  {
                    get: (key: string) => {
                      if (key === 'n') {
                        return {
                          properties: {
                            id: 'note-1',
                            content: 'Test note',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          },
                        };
                      } else if (key === 'verseId') {
                        return 'John-3-16';
                      } else if (key === 'tags') {
                        return ['test', 'important'];
                      }
                      return null;
                    },
                  },
                ],
              });
            }
            
            return Promise.resolve({ records: [] });
          }),
          close: jest.fn(),
        }),
      },
      writable: true
    });
  });

  describe('getVerse', () => {
    it('should return a verse by ID', async () => {
      const verse = await neo4jDriverService.getVerse('John-3-16');
      
      expect(verse).not.toBeNull();
      expect(verse?.id).toBe('John-3-16');
      expect(verse?.book).toBe('John');
      expect(verse?.chapter).toBe(3);
      expect(verse?.verse).toBe(16);
    });
  });

  describe('getVerseByReference', () => {
    it('should return a verse by book, chapter, and verse number', async () => {
      const verse = await neo4jDriverService.getVerseByReference('John', 3, 16);
      
      expect(verse).not.toBeNull();
      expect(verse?.id).toBe('John-3-16');
      expect(verse?.book).toBe('John');
      expect(verse?.chapter).toBe(3);
      expect(verse?.verse).toBe(16);
    });
  });

  describe('getNotes', () => {
    it('should return notes with tags', async () => {
      const notes = await neo4jDriverService.getNotes();
      
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0].id).toBe('note-1');
      expect(notes[0].content).toBe('Test note');
      expect(notes[0].tags).toEqual(['test', 'important']);
      expect(notes[0].verseId).toBe('John-3-16');
    });
  });
}); 