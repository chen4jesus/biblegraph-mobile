import { neo4jService } from '../../src/services/neo4j';
import { neo4jDatabaseService } from '../../src/services/neo4jDatabase';
import { Note, Verse, ConnectionType } from '../../src/types/bible';

// Mock the neo4jDatabaseService
jest.mock('../../src/services/neo4jDatabase', () => ({
  neo4jDatabaseService: {
    getVerse: jest.fn(),
    getVerseByReference: jest.fn(),
    createVerse: jest.fn(),
    getNotes: jest.fn(),
    getNotesForVerse: jest.fn(),
    createNote: jest.fn(),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
    getConnections: jest.fn(),
    getConnectionsForVerse: jest.fn(),
    createConnection: jest.fn(),
    updateConnection: jest.fn(),
    deleteConnection: jest.fn()
  }
}));

describe('Neo4jService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVerse', () => {
    it('should return a verse when it exists', async () => {
      const mockVerse: Verse = {
        id: 'John-3-16',
        book: 'John',
        chapter: 3,
        verse: 16,
        text: 'For God so loved the world...',
        translation: 'ESV',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      (neo4jDatabaseService.getVerse as jest.Mock).mockResolvedValue(mockVerse);

      const result = await neo4jService.getVerse('John-3-16');

      expect(neo4jDatabaseService.getVerse).toHaveBeenCalledWith('John-3-16');
      expect(result).toEqual(mockVerse);
    });

    it('should return null when verse does not exist', async () => {
      (neo4jDatabaseService.getVerse as jest.Mock).mockResolvedValue(null);

      const result = await neo4jService.getVerse('nonexistent-verse');

      expect(neo4jDatabaseService.getVerse).toHaveBeenCalledWith('nonexistent-verse');
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      (neo4jDatabaseService.getVerse as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await neo4jService.getVerse('John-3-16');

      expect(neo4jDatabaseService.getVerse).toHaveBeenCalledWith('John-3-16');
      expect(result).toBeNull();
    });
  });

  describe('getVerseByReference', () => {
    it('should return a verse when it exists by reference', async () => {
      const mockVerse: Verse = {
        id: 'John-3-16',
        book: 'John',
        chapter: 3,
        verse: 16,
        text: 'For God so loved the world...',
        translation: 'ESV',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      (neo4jDatabaseService.getVerseByReference as jest.Mock).mockResolvedValue(mockVerse);

      const result = await neo4jService.getVerseByReference('John', 3, 16);

      expect(neo4jDatabaseService.getVerseByReference).toHaveBeenCalledWith('John', 3, 16);
      expect(result).toEqual(mockVerse);
    });

    it('should return null when verse does not exist by reference', async () => {
      (neo4jDatabaseService.getVerseByReference as jest.Mock).mockResolvedValue(null);

      const result = await neo4jService.getVerseByReference('Nonexistent', 1, 1);

      expect(neo4jDatabaseService.getVerseByReference).toHaveBeenCalledWith('Nonexistent', 1, 1);
      expect(result).toBeNull();
    });
  });

  describe('createNote', () => {
    it('should create a note with tags', async () => {
      const mockNote: Note = {
        id: 'note-1',
        verseId: 'John-3-16',
        content: 'This is a test note',
        tags: ['test', 'important'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      (neo4jDatabaseService.createNote as jest.Mock).mockResolvedValue(mockNote);

      const result = await neo4jService.createNote('John-3-16', 'This is a test note', ['test', 'important']);

      expect(neo4jDatabaseService.createNote).toHaveBeenCalledWith('John-3-16', 'This is a test note', ['test', 'important']);
      expect(result).toEqual(mockNote);
    });

    it('should create a note with empty tags if not provided', async () => {
      const mockNote: Note = {
        id: 'note-1',
        verseId: 'John-3-16',
        content: 'This is a test note',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      (neo4jDatabaseService.createNote as jest.Mock).mockResolvedValue(mockNote);

      const result = await neo4jService.createNote('John-3-16', 'This is a test note');

      expect(neo4jDatabaseService.createNote).toHaveBeenCalledWith('John-3-16', 'This is a test note', []);
      expect(result).toEqual(mockNote);
    });
  });

  describe('updateNote', () => {
    it('should update a note with provided tags', async () => {
      const updatedNote: Note = {
        id: 'note-1',
        verseId: 'John-3-16',
        content: 'Updated content',
        tags: ['updated', 'tag'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updates = { content: 'Updated content', tags: ['updated', 'tag'] };

      (neo4jDatabaseService.updateNote as jest.Mock).mockResolvedValue(updatedNote);

      const result = await neo4jService.updateNote('note-1', updates);

      expect(neo4jDatabaseService.updateNote).toHaveBeenCalledWith('note-1', updates);
      expect(result).toEqual(updatedNote);
    });

    it('should maintain existing tags if not provided in update', async () => {
      const existingNote: Note = {
        id: 'note-1',
        verseId: 'John-3-16',
        content: 'Original content',
        tags: ['existing', 'tags'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updatedNote: Note = {
        id: 'note-1',
        verseId: 'John-3-16',
        content: 'Updated content',
        tags: ['existing', 'tags'],
        createdAt: existingNote.createdAt,
        updatedAt: new Date().toISOString()
      };

      jest.spyOn(neo4jService, 'getNote').mockResolvedValue(existingNote);
      (neo4jDatabaseService.updateNote as jest.Mock).mockResolvedValue(updatedNote);

      const updates = { content: 'Updated content' };
      const result = await neo4jService.updateNote('note-1', updates);

      // Verify it fetched the existing note to get tags
      expect(neo4jDatabaseService.updateNote).toHaveBeenCalledWith('note-1', {
        content: 'Updated content',
        tags: ['existing', 'tags']
      });
      expect(result).toEqual(updatedNote);
    });
  });
}); 