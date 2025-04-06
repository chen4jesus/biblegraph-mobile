import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Note, Verse } from '../types/bible';
import { DatabaseService, AuthService } from '../services';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import WebViewModal from '../components/WebViewModal';

type NotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notes'>;

interface NoteWithVerse extends Note {
  verse?: Verse;
}

const NOTES_PER_PAGE = 20;

// Add interface for animated notes to track which notes should be animated
interface AnimatedNoteInfo {
  id: string;
  timestamp: number;
}

// Define the ref interface
export interface NotesScreenRef {
  updateSingleNote: (noteId: string, isNew?: boolean, userId?: string) => Promise<void>;
}

const NotesScreen = forwardRef<NotesScreenRef, {}>((props, ref) => {
  const { t } = useTranslation(['notes', 'common']);
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const [notes, setNotes] = useState<NoteWithVerse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState<NoteWithVerse[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [webViewUrl, setWebViewUrl] = useState<string>('');
  const [isWebViewVisible, setIsWebViewVisible] = useState<boolean>(false);
  
  // Pagination states
  const [page, setPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);

  // Add state for tracking recently updated notes
  const [recentlyUpdatedNote, setRecentlyUpdatedNote] = useState<AnimatedNoteInfo | null>(null);
  
  // Animation value for the highlight effect
  const highlightAnimation = useRef(new Animated.Value(0)).current;

  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  // Keep the previous selectedTag for backward compatibility during refactoring
  const selectedTag = selectedTags.length === 1 ? selectedTags[0] : null;

  // Add a flatlist ref for scrolling
  const flatListRef = useRef<FlatList>(null);

  // Add a cache for note keys to prevent duplicate keys
  const noteKeysCache = useRef<Record<string, string>>({}).current;

  useEffect(() => {
    loadNotes();
    loadTagColors();
    
    // Clean up cache when component unmounts
    return () => {
      // Clear the cache
      Object.keys(noteKeysCache).forEach(key => {
        delete noteKeysCache[key];
      });
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    
    // Clear the note keys cache when refreshing
    Object.keys(noteKeysCache).forEach(key => {
      delete noteKeysCache[key];
    });
    
    loadNotes(true);
  }, [noteKeysCache]);
  
  // Function to deduplicate notes by ID
  const deduplicateNotes = useCallback((notesArray: NoteWithVerse[]) => {
    const uniqueNotes: NoteWithVerse[] = [];
    const seenIds = new Set<string>();
    
    for (const note of notesArray) {
      if (!seenIds.has(note.id)) {
        seenIds.add(note.id);
        uniqueNotes.push(note);
      }
    }
    
    return uniqueNotes;
  }, []);
  
  // Define filterNotes before using it in useEffect
  const filterNotes = useCallback(() => {
    // Start with deduplicated notes for filtering
    let filtered = deduplicateNotes(notes);
    
    // Filter by tags if any are selected (AND debugic - note must have ALL selected tags)
    if (selectedTags.length > 0) {
      filtered = filtered.filter(note => {
        // If note has no tags, it can't match our filter
        if (!note.tags || note.tags.length === 0) {
          return false;
        }
        
        // Now we know note.tags exists and is non-empty
        const noteTags = note.tags as string[];
        return selectedTags.every(tag => noteTags.includes(tag));
      });
    }
    
    // Filter by search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      
      // Check if query looks like a verse reference (e.g., "Genesis 1:1")
      const verseReferencePattern = /^([a-z0-9\s]+)\s*(\d+):(\d+)$/i;
      const match = query.match(verseReferencePattern);
      
      if (match) {
        // Extract book, chapter, and verse from the reference
        const [, book, chapter, verse] = match;
        const normalizedBook = book.trim().toLowerCase();
        
        // Filter notes that match this verse reference
        filtered = filtered.filter(note => 
          note.verse && 
          note.verse.book.toLowerCase().includes(normalizedBook) &&
          note.verse.chapter.toString() === chapter &&
          note.verse.verse.toString() === verse
        );
      } else {
        // Perform regular text search if not a verse reference
        filtered = filtered.filter(
          (note) =>
            note.content.toLowerCase().includes(query) ||
            note.verse?.text.toLowerCase().includes(query) ||
            (note.verse && `${note.verse.book} ${note.verse.chapter}:${note.verse.verse}`.toLowerCase().includes(query)) ||
            (note.tags && note.tags.some((tag) => tag.toLowerCase().includes(query)))
        );
      }
    }
    
    setFilteredNotes(filtered);
  }, [notes, selectedTags, searchQuery, deduplicateNotes]);

  useEffect(() => {
    filterNotes();
  }, [filterNotes]);
  
  // Add useEffect to ensure notes array is always deduplicated
  useEffect(() => {
    // Deduplicate notes if there are any duplicates
    const uniqueNotes = deduplicateNotes(notes);
    if (uniqueNotes.length !== notes.length) {
      console.debug(`Deduplicated notes: removed ${notes.length - uniqueNotes.length} duplicates`);
      setNotes(uniqueNotes);
    }
  }, [notes, deduplicateNotes]);

  // Extract all unique tags from notes
  useEffect(() => {
    const uniqueTags = Array.from(
      new Set(notes.flatMap(note => note.tags || []))
    );
    setAllTags(uniqueTags);
  }, [notes]);

  // Run animation when a note is updated
  useEffect(() => {
    if (recentlyUpdatedNote) {
      // Reset animation value
      highlightAnimation.setValue(0);
      
      // Run animation sequence
      Animated.sequence([
        // Quick fade in of highlight
        Animated.timing(highlightAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web', // Native driver doesn't work well with backgroundColor on web
        }),
        // Slower fade out
        Animated.timing(highlightAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        // Clear the updated note reference after animation completes
        setRecentlyUpdatedNote(null);
      });
    }
  }, [recentlyUpdatedNote, highlightAnimation]);

  const loadNotes = async (refresh = true) => {
    if (refresh) {
      setPage(0);
      setIsRefreshing(true);
      setHasMoreData(true);
    }

    try {
      // Get current user for ownership
      const currentUser = await AuthService.getCurrentUser();
      
      // Fetch notes from the Neo4j database with pagination
      const skip = refresh ? 0 : page * NOTES_PER_PAGE;
      const fetchedNotes = await DatabaseService.getNotes(skip, NOTES_PER_PAGE, currentUser?.id);
      
      // If we got fewer notes than requested, there are no more to load
      if (fetchedNotes.length < NOTES_PER_PAGE) {
        setHasMoreData(false);
      }
      
      // Create an array to store notes with their associated verses
      const notesWithVerses: NoteWithVerse[] = [];
      
      // For each note, fetch its associated verse
      for (const note of fetchedNotes) {
        let verse = null;
        if (note.verseId) {
          verse = await DatabaseService.getVerse(note.verseId);
        }
        
        const noteWithVerse = {
          ...note,
          verse: verse || undefined
        };
        
        // Cache the note id to prevent duplicates
        if (noteWithVerse.id) {
          noteKeysCache[noteWithVerse.id] = noteWithVerse.id;
        }
        
        notesWithVerses.push(noteWithVerse);
      }
      
      // If refreshing, replace notes, otherwise append
      if (refresh) {
        setNotes(notesWithVerses);
      } else {
        // Deduplicate before updating state
        setNotes(prev => {
          // Create a set of existing note IDs
          const existingNoteIds = new Set(prev.map(note => note.id));
          
          // Filter out any new notes that already exist in the previous notes
          const uniqueNewNotes = notesWithVerses.filter(note => !existingNoteIds.has(note.id));
          
          return [...prev, ...uniqueNewNotes];
        });
      }
      
      // If we successfully loaded data, increment the page
      if (!refresh && fetchedNotes.length > 0) {
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const loadMoreNotes = useCallback(() => {
    if (!isLoadingMore && hasMoreData && !searchQuery && selectedTags.length === 0) {
      setIsLoadingMore(true);
      loadNotes(false);
    }
  }, [isLoadingMore, hasMoreData, searchQuery, selectedTags]);

  const loadTagColors = async () => {
    try {
      // Get current user for ownership
      const currentUser = await AuthService.getCurrentUser();
      
      const tags = await DatabaseService.getTags(currentUser?.id);
      const colorMap: Record<string, string> = {};
      
      tags.forEach(tag => {
        colorMap[tag.name] = tag.color;
      });
      
      setTagColors(colorMap);
    } catch (error) {
      console.error('Error loading tag colors:', error);
    }
  };

  const getTagColor = (tag: string) => {
    // First check if we have the color in our tagColors state
    if (tagColors[tag]) {
      return tagColors[tag];
    }
    
    // Fallback to generating a color if not found in database
    const tagColorOptions = [
      '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', 
      '#EF476F', '#FFC43D', '#1B9AAA', '#6F2DBD', '#84BC9C'
    ];
    const tagIndex = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % tagColorOptions.length;
    return tagColorOptions[tagIndex];
  };

  const toggleNoteExpansion = (noteId: string) => {
    setExpandedNotes(prev => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  const isTextTruncated = (text: string) => {
    return text.length > 120; // Arbitrary threshold - adjust as needed
  };

  // Improved URL detection function with better handling of various formats
  const detectUrls = (text: string): RegExpMatchArray | null => {
    // Enhanced regex that catches more URL patterns, including those after line breaks
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return text.match(urlRegex);
  };

  // Check if note content has URLs
  const hasUrls = (text: string): boolean => {
    const urls = detectUrls(text);
    return urls !== null;
  };

  // Function to handle URL click
  const handleUrlClick = (url: string) => {
    // Clean up the URL before opening - remove any trailing punctuation
    const cleanUrl = url.replace(/[.,;:!?)"'\]]+$/, '');
    setWebViewUrl(cleanUrl);
    setIsWebViewVisible(true);
  };

  // Add this new method to update a single note
  const updateSingleNote = async (noteId: string, isNew = false, userId?: string) => {
    try {
      // Get current user for ownership if userId not provided
      if (!userId) {
        const currentUser = await AuthService.getCurrentUser();
        userId = currentUser?.id;
      }
      
      // If it's a new note, we'll add it to the top of the list after fetching
      if (isNew) {
        // For new notes, get just the latest note and add it to the existing list
        const latestNotes = await DatabaseService.getNotes(0, 1, userId);
        if (latestNotes.length > 0) {
          const newNote = latestNotes[0];
          
          // Fetch the verse for this note if it has one
          let verse = null;
          if (newNote.verseId) {
            verse = await DatabaseService.getVerse(newNote.verseId);
          }
          
          const noteWithVerse: NoteWithVerse = {
            ...newNote,
            verse: verse || undefined
          };
          
          // Add to cache to prevent duplicate keys
          if (noteWithVerse.id) {
            noteKeysCache[noteWithVerse.id] = noteWithVerse.id;
          }
          
          // Add the new note to the top of the list
          setNotes(prevNotes => {
            // Check if note already exists
            const existingNoteIndex = prevNotes.findIndex(note => note.id === noteWithVerse.id);
            
            if (existingNoteIndex !== -1) {
              // If note exists, replace it instead of adding a duplicate
              const updatedNotes = [...prevNotes];
              updatedNotes[existingNoteIndex] = noteWithVerse;
              return updatedNotes;
            }
            
            // Otherwise add it to the top
            return [noteWithVerse, ...prevNotes];
          });
          
          // Set it as recently updated for animation
          setRecentlyUpdatedNote({
            id: newNote.id,
            timestamp: Date.now(),
          });
        }
      } else {
        // For existing notes, fetch just that specific note and update it in the list
        const updatedNote = await DatabaseService.getNote(noteId, userId);
        if (updatedNote) {
          // Fetch the verse for this note if it has one
          let verse = null;
          if (updatedNote.verseId) {
            verse = await DatabaseService.getVerse(updatedNote.verseId);
          }
          
          const noteWithVerse: NoteWithVerse = {
            ...updatedNote,
            verse: verse || undefined
          };
          
          // Add to cache to prevent duplicate keys
          if (noteWithVerse.id) {
            noteKeysCache[noteWithVerse.id] = noteWithVerse.id;
          }
          
          // Update only this note in the list
          setNotes(prevNotes => {
            // Check if note exists
            const existingNoteIndex = prevNotes.findIndex(note => note.id === noteId);
            
            if (existingNoteIndex === -1) {
              // If note doesn't exist, add it (shouldn't normally happen)
              return [noteWithVerse, ...prevNotes];
            }
            
            // Otherwise update the existing note
            const updatedNotes = [...prevNotes];
            updatedNotes[existingNoteIndex] = noteWithVerse;
            return updatedNotes;
          });
          
          // Set it as recently updated for animation
          setRecentlyUpdatedNote({
            id: noteId,
            timestamp: Date.now(),
          });
        }
      }
      
      // Re-filter notes with updated data
      filterNotes();
    } catch (error) {
      console.error('Error updating single note:', error);
    }
  };

  // Modify the render function to include the animation
  const renderNoteItem = ({ item }: { item: NoteWithVerse }) => {
    const isExpanded = expandedNotes[item.id] || false;
    const shouldTruncate = isTextTruncated(item.content);
    const containsUrls = hasUrls(item.content);
    
    // Check if this item should be animated
    const isRecentlyUpdated = recentlyUpdatedNote?.id === item.id;
    
    // Interpolate animation value for background color
    const backgroundColor = isRecentlyUpdated
      ? highlightAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: ['#ffffff', '#e6f7ff'] // white to light blue
        })
      : '#ffffff';
    
    // Always show toggle button if note contains URLs or is truncated
    const showToggleButton = shouldTruncate || containsUrls;
    
    // Check if the note content is just a URL (or starts with one)
    const isStandaloneUrl = item.content.trim().match(/^https?:\/\/[^\s]+/);
    
    return (
      <Animated.View 
        style={[
          styles.noteItem,
          { backgroundColor },
          // On web, we need to use style directly since Animated.View interpolation doesn't work well
          Platform.OS === 'web' && isRecentlyUpdated ? 
            { backgroundColor: recentlyUpdatedNote ? '#e6f7ff' : '#ffffff' } : null
        ]}
      >
        <View style={styles.noteHeader}>
          {item.verse && (
            <TouchableOpacity
              onPress={() => navigation.navigate('VerseDetail', { verseId: item.verseId })}
            >
              <Text style={[styles.verseReference, styles.clickableText]}>
                {item.verse.book} {item.verse.chapter}:{item.verse.verse}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.noteDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        
        {/* Special case for notes that are just URLs */}
        {isStandaloneUrl ? (
          <TouchableOpacity onPress={() => handleUrlClick(isStandaloneUrl[0])}>
            <Text style={[styles.noteContent, styles.urlText]} numberOfLines={isExpanded ? undefined : 3}>
              {item.content}
            </Text>
          </TouchableOpacity>
        ) : (
          <View>
            {isExpanded ? (
              <>
                <Text style={styles.noteContent}>
                  {item.content}
                </Text>
                {containsUrls && renderUrlButtons(item.content)}
                {showToggleButton && (
                  <TouchableOpacity 
                    style={styles.toggleButton}
                    onPress={() => toggleNoteExpansion(item.id)}
                  >
                    <Text style={styles.toggleButtonText}>
                      {t('notes:showLess')}
                    </Text>
                    <Ionicons 
                      name='chevron-up'
                      size={16} 
                      color="#007AFF"
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <Text style={styles.noteContent} numberOfLines={3}>
                  {item.content}
                </Text>
                {showToggleButton && (
                  <TouchableOpacity 
                    style={styles.toggleButton}
                    onPress={() => toggleNoteExpansion(item.id)}
                  >
                    <Text style={styles.toggleButtonText}>
                      {t('notes:readMore')}
                    </Text>
                    <Ionicons 
                      name='chevron-down'
                      size={16} 
                      color="#007AFF"
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
        
        {item.tags && item.tags.length > 0 && renderTagsForNote(item.tags)}
      </Animated.View>
    );
  };

  // Helper function to extract and render URL buttons
  const renderUrlButtons = (content: string) => {
    const urls = detectUrls(content);
    if (!urls) return null;
    
    // Clean each URL and remove duplicates
    const cleanUrls = Array.from(new Set(urls.map(url => 
      url.replace(/[.,;:!?)"'\]]+$/, '')
    )));
    
    return (
      <View style={styles.urlButtonsContainer}>
        {cleanUrls.map((url, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.urlButton}
            onPress={() => handleUrlClick(url)}
          >
            <Ionicons name="link-outline" size={16} color="#007AFF" />
            <Text style={styles.urlButtonText} numberOfLines={1} ellipsizeMode="middle">
              {url}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Add this function to render standalone URL items
  const renderUrlItem = ({ item }: { item: NoteWithVerse }) => {
    // Get the URL from the content
    const url = item.content.trim();
    
    return (
      <View style={styles.noteItem}>
        <View style={styles.noteHeader}>
          {item.verse && (
            <TouchableOpacity
              onPress={() => navigation.navigate('VerseDetail', { verseId: item.verseId })}
            >
              <Text style={[styles.verseReference, styles.clickableText]}>
                {item.verse.book} {item.verse.chapter}:{item.verse.verse}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.noteDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => handleUrlClick(url)}
          style={styles.urlContainer}
        >
          <Ionicons name="link-outline" size={18} color="#007AFF" style={styles.urlIcon} />
          <Text style={styles.urlText} numberOfLines={2} ellipsizeMode="middle">
            {url}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Update the FlatList rendering debugic to use a different renderer based on content
  const renderItem = (info: { item: NoteWithVerse }) => {
    // Check if the note is basically just a URL
    const item = info.item;
    const urlRegex = /^https?:\/\/\S+$/;
    
    if (urlRegex.test(item.content.trim())) {
      // For URL-only notes, we need to wrap in Animated.View
      const isRecentlyUpdated = recentlyUpdatedNote?.id === item.id;
      
      // Interpolate animation value for background color
      const backgroundColor = isRecentlyUpdated
        ? highlightAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ['#ffffff', '#e6f7ff']
          })
        : '#ffffff';
      
      return (
        <Animated.View
          style={[
            styles.noteItem,
            { backgroundColor },
            // On web, we need to use style directly
            Platform.OS === 'web' && isRecentlyUpdated ? 
              { backgroundColor: recentlyUpdatedNote ? '#e6f7ff' : '#ffffff' } : null
          ]}
        >
          {renderUrlItem({ item }).props.children}
        </Animated.View>
      );
    }
    
    return renderNoteItem(info);
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>{t('common:loading')}</Text>
      </View>
    );
  };

  // Expose the updateSingleNote method via ref
  useImperativeHandle(ref, () => ({
    updateSingleNote,
  }), [updateSingleNote]);

  // Set the screen options to include our ref
  useEffect(() => {
    // Set the screen options with our ref
    navigation.setOptions({
      // Use type assertion to allow our custom property
      ...(navigation.getParent()?.getState().routes.find(r => r.name === 'Notes')?.params || {}),
      // @ts-ignore - Custom property for our ref
      notesScreenRef: {
        updateSingleNote,
      },
    });
  }, [navigation, updateSingleNote]);

  // Add a function to toggle a tag in the selected tags array
  const toggleTagSelection = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  // Add a function to handle tag click from note items
  const handleTagClick = (tag: string) => {
    // If holding Ctrl/Cmd key (simulated in mobile by long press), add to selection
    // Otherwise replace selection with this tag
    toggleTagSelection(tag);
    
    // Scroll to top after filtering
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  // Update tag rendering in note item to make them clickable
  const renderTagsForNote = (tags: string[]) => (
    <View style={styles.tagsContainer}>
      {tags.map((tag) => (
        <TouchableOpacity 
          key={tag} 
          style={[
            styles.tag, 
            {backgroundColor: getTagColor(tag)},
            // Highlight if this tag is in the selected tags
            selectedTags.includes(tag) && styles.tagSelected
          ]}
          onPress={() => handleTagClick(tag)}
        >
          <Text style={[styles.tagText, {color: '#fff'}]}>{tag}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Add function to clean noteKeysCache for keys that aren't in the notes array
  const cleanupNoteKeysCache = useCallback(() => {
    const currentNoteIds = new Set(notes.map(note => note.id));
    
    // Remove keys from cache that aren't in the current notes array
    Object.keys(noteKeysCache).forEach(key => {
      if (!currentNoteIds.has(key)) {
        delete noteKeysCache[key];
      }
    });
  }, [notes, noteKeysCache]);
  
  // Call cleanup after notes are filtered
  useEffect(() => {
    cleanupNoteKeysCache();
  }, [filteredNotes, cleanupNoteKeysCache]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('notes:title')}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              (navigation as any).navigate('TagsManagement');
            }}
          >
            <Ionicons name="pricetags" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="search" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('notes:searchNotes')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {allTags.length > 0 && (
        <View style={styles.tagsFilterContainer}>
          <View style={styles.tagsFilterHeader}>
            <Text style={styles.tagsFilterTitle}>{t('notes:filterByTags')}</Text>
            {selectedTags.length > 0 && (
              <TouchableOpacity
                style={styles.clearTagsButton}
                onPress={() => setSelectedTags([])}
              >
                <Text style={styles.clearTagsButtonText}>{t('notes:clearAll')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.tagFilterItem,
                selectedTags.length === 0 && styles.tagFilterItemSelected
              ]}
              onPress={() => setSelectedTags([])}
            >
              <Text style={[
                styles.tagFilterText,
                selectedTags.length === 0 && styles.tagFilterTextSelected
              ]}>
                {t('common:all')}
              </Text>
            </TouchableOpacity>
            
            {allTags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagFilterItem,
                  { 
                    backgroundColor: selectedTags.includes(tag) 
                      ? getTagColor(tag) 
                      : '#f0f0f0' 
                  }
                ]}
                onPress={() => toggleTagSelection(tag)}
              >
                <Text style={[
                  styles.tagFilterText,
                  { color: selectedTags.includes(tag) ? '#fff' : '#333' }
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={filteredNotes}
        renderItem={renderItem}
        keyExtractor={(item) => {
          // Use cached key if exists, otherwise create and cache a new one
          if (!noteKeysCache[item.id]) {
            noteKeysCache[item.id] = item.id;
          }
          return noteKeysCache[item.id];
        }}
        extraData={notes.length}
        contentContainerStyle={styles.notesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || selectedTags.length > 0 
                ? t('notes:noNotesFound') 
                : t('notes:noNotesYet')}
            </Text>
          </View>
        }
        onEndReached={loadMoreNotes}
        onEndReachedThreshold={0.2}
        ListFooterComponent={renderFooter}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
      
      <WebViewModal
        visible={isWebViewVisible}
        url={webViewUrl}
        onClose={() => setIsWebViewVisible(false)}
        id="notes-webview"
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  notesList: {
    padding: 16,
  },
  noteItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verseReference: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  noteContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#007AFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  tagsFilterContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tagsScrollContent: {
    paddingRight: 16,
  },
  tagFilterItem: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  tagFilterItemSelected: {
    backgroundColor: '#007AFF',
  },
  tagFilterText: {
    fontSize: 14,
    color: '#333',
  },
  tagFilterTextSelected: {
    color: '#fff',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 8,
  },
  toggleButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  clickableText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  urlText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  urlIcon: {
    marginRight: 8,
  },
  urlButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  urlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  urlButtonText: {
    fontSize: 13,
    color: '#007AFF',
    marginLeft: 4,
  },
  tagsFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagsFilterTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  clearTagsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearTagsButtonText: {
    fontSize: 12,
    color: '#007AFF',
  },
  tagSelected: {
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
});

export default NotesScreen; 