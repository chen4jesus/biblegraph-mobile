import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Note, Verse } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import WebViewModal from '../components/WebViewModal';

type NotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notes'>;

interface NoteWithVerse extends Note {
  verse?: Verse;
}

const NOTES_PER_PAGE = 20;

const NotesScreen: React.FC = () => {
  const { t } = useTranslation(['notes', 'common']);
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const [notes, setNotes] = useState<NoteWithVerse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState<NoteWithVerse[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [webViewUrl, setWebViewUrl] = useState<string>('');
  const [isWebViewVisible, setIsWebViewVisible] = useState<boolean>(false);
  
  // Pagination states
  const [page, setPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    filterNotes();
  }, [searchQuery, notes, selectedTag]);

  // Extract all unique tags from notes
  useEffect(() => {
    const uniqueTags = Array.from(
      new Set(notes.flatMap(note => note.tags || []))
    );
    setAllTags(uniqueTags);
  }, [notes]);

  const loadNotes = async (refresh = true) => {
    if (refresh) {
      setPage(0);
      setIsRefreshing(true);
      setHasMoreData(true);
    }

    try {
      // Fetch notes from the Neo4j database with pagination
      const skip = refresh ? 0 : page * NOTES_PER_PAGE;
      const fetchedNotes = await neo4jService.getNotes(skip, NOTES_PER_PAGE);
      
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
          verse = await neo4jService.getVerse(note.verseId);
        }
        
        notesWithVerses.push({
          ...note,
          verse: verse || undefined
        });
      }
      
      // If refreshing, replace notes, otherwise append
      if (refresh) {
        setNotes(notesWithVerses);
      } else {
        setNotes(prev => [...prev, ...notesWithVerses]);
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
    if (!isLoadingMore && hasMoreData && !searchQuery && !selectedTag) {
      setIsLoadingMore(true);
      loadNotes(false);
    }
  }, [isLoadingMore, hasMoreData, searchQuery, selectedTag]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadNotes(true);
  }, []);

  const filterNotes = () => {
    let filtered = notes;
    
    // Filter by tag if one is selected
    if (selectedTag) {
      filtered = filtered.filter(note => 
        note.tags && note.tags.includes(selectedTag)
      );
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
  };

  const getTagColor = (tag: string) => {
    // Generate a consistent color based on tag name
    const tagColors = [
      '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', 
      '#EF476F', '#FFC43D', '#1B9AAA', '#6F2DBD', '#84BC9C'
    ];
    const tagIndex = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % tagColors.length;
    return tagColors[tagIndex];
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

  // Render note content with proper handling of URLs
  const renderNoteContent = (note: NoteWithVerse) => {
    const urls = detectUrls(note.content);
    const hasUrls = urls !== null;
    const truncateLength = 120;
    const shouldTruncate = note.content.length > truncateLength;
    
    // Get displayed text (truncated or full)
    const displayedText = shouldTruncate 
      ? note.content.substring(0, truncateLength) + "..." 
      : note.content;
    
    return (
      <>
        <Text style={styles.noteContent}>
          {displayedText}
        </Text>
        {(shouldTruncate || hasUrls) && (
          <TouchableOpacity onPress={() => toggleNoteExpansion(note.id)}>
            <Text style={styles.toggleButtonText}>
              {t('notes:readMore')}
              <Ionicons 
                name='chevron-down'
                size={16} 
                color="#007AFF"
                style={{ marginLeft: 4 }}
              />
            </Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  const renderNoteItem = ({ item }: { item: NoteWithVerse }) => {
    const isExpanded = expandedNotes[item.id] || false;
    const shouldTruncate = isTextTruncated(item.content);
    const containsUrls = hasUrls(item.content);
    
    // Always show toggle button if note contains URLs or is truncated
    const showToggleButton = shouldTruncate || containsUrls;
    
    // Check if the note content is just a URL (or starts with one)
    const isStandaloneUrl = item.content.trim().match(/^https?:\/\/[^\s]+/);
    
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
        
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.map((tag) => (
              <View key={tag} style={[styles.tag, {backgroundColor: getTagColor(tag)}]}>
                <Text style={[styles.tagText, {color: '#fff'}]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
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

  // Update the FlatList rendering logic to use a different renderer based on content
  const renderItem = (info: { item: NoteWithVerse }) => {
    // Check if the note is basically just a URL
    const item = info.item;
    const urlRegex = /^https?:\/\/\S+$/;
    
    if (urlRegex.test(item.content.trim())) {
      return renderUrlItem(info);
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
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.tagFilterItem,
                selectedTag === null && styles.tagFilterItemSelected
              ]}
              onPress={() => setSelectedTag(null)}
            >
              <Text style={[
                styles.tagFilterText,
                selectedTag === null && styles.tagFilterTextSelected
              ]}>
                {t('common:all')}
              </Text>
            </TouchableOpacity>
            
            {allTags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagFilterItem,
                  { backgroundColor: selectedTag === tag ? getTagColor(tag) : '#f0f0f0' }
                ]}
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                <Text style={[
                  styles.tagFilterText,
                  { color: selectedTag === tag ? '#fff' : '#333' }
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredNotes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.notesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || selectedTag ? t('notes:noNotesFound') : t('notes:noNotesYet')}
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
};

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
});

export default NotesScreen; 