import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import NotesScreen from '../../src/screens/NotesScreen';
import { neo4jService } from '../../src/services/neo4j';

// Mock the neo4jService
jest.mock('../../src/services/neo4j', () => ({
  neo4jService: {
    getNotes: jest.fn().mockResolvedValue([
      {
        id: 'note1',
        verseId: 'John-3-16',
        content: 'Test note content',
        tags: ['test', 'important'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]),
    getVerse: jest.fn().mockResolvedValue({
      id: 'John-3-16',
      book: 'John',
      chapter: 3,
      verse: 16,
      text: 'For God so loved the world...',
      translation: 'ESV',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }
}));

// Mock the navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn()
  })
}));

describe('NotesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mock returns
    (neo4jService.getNotes as jest.Mock).mockResolvedValue([
      {
        id: 'note1',
        verseId: 'John-3-16',
        content: 'Test note content',
        tags: ['test', 'important'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);
    
    (neo4jService.getVerse as jest.Mock).mockResolvedValue({
      id: 'John-3-16',
      book: 'John',
      chapter: 3,
      verse: 16,
      text: 'For God so loved the world...',
      translation: 'ESV',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  it('should render notes with their associated verses', async () => {
    let component: any;
    
    await act(async () => {
      component = render(<NotesScreen />);
      await waitFor(() => expect(neo4jService.getNotes).toHaveBeenCalled());
    });
    
    // Verify the note is rendered with correct content
    expect(component.getByText('Test note content')).toBeTruthy();
    
    // Verify the verse reference is displayed
    expect(component.getByText('John 3:16')).toBeTruthy();
    
    // Verify the tags are displayed
    expect(component.getByText('test')).toBeTruthy();
    expect(component.getByText('important')).toBeTruthy();
  });

  it('should filter notes based on search query', async () => {
    let component: any;
    
    // Mock multiple notes for testing search
    (neo4jService.getNotes as jest.Mock).mockResolvedValue([
      {
        id: 'note1',
        verseId: 'John-3-16',
        content: 'First test note',
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'note2',
        verseId: 'Romans-8-28',
        content: 'Second note about love',
        tags: ['love'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);
    
    (neo4jService.getVerse as jest.Mock).mockImplementation(async (id) => {
      if (id === 'John-3-16') {
        return {
          id: 'John-3-16',
          book: 'John',
          chapter: 3,
          verse: 16,
          text: 'For God so loved the world...',
          translation: 'ESV',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        return {
          id: 'Romans-8-28',
          book: 'Romans',
          chapter: 8,
          verse: 28,
          text: 'And we know that in all things God works for the good...',
          translation: 'ESV',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    });
    
    await act(async () => {
      component = render(<NotesScreen />);
      await waitFor(() => expect(neo4jService.getNotes).toHaveBeenCalled());
    });
    
    // Verify both notes are initially rendered
    expect(component.getByText('First test note')).toBeTruthy();
    expect(component.getByText('Second note about love')).toBeTruthy();
    
    // Search for "love" - should only show the second note
    await act(async () => {
      const searchInput = component.getByPlaceholderText('Search notes...');
      searchInput.props.onChangeText('love');
    });
    
    // First note should no longer be visible
    expect(() => component.getByText('First test note')).toThrow();
    
    // Second note should still be visible
    expect(component.getByText('Second note about love')).toBeTruthy();
  });
}); 