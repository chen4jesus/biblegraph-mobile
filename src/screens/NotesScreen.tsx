import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Note, Verse } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

type NotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

interface NoteWithVerse extends Note {
  verse?: Verse;
}

const NotesScreen: React.FC = () => {
  const { t } = useTranslation(['notes', 'common']);
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const [notes, setNotes] = useState<NoteWithVerse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState<NoteWithVerse[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

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

  const loadNotes = async () => {
    try {
      // Fetch notes from the Neo4j database
      const fetchedNotes = await neo4jService.getNotes();
      
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
      
      setNotes(notesWithVerses);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

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
      filtered = filtered.filter(
        (note) =>
          note.content.toLowerCase().includes(query) ||
          note.verse?.text.toLowerCase().includes(query) ||
          note.tags.some((tag) => tag.toLowerCase().includes(query))
      );
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

  const renderNoteItem = ({ item }: { item: NoteWithVerse }) => (
    <TouchableOpacity
      style={styles.noteItem}
      onPress={() => {
        if (item.verse) {
          navigation.navigate('VerseDetail', { verseId: item.verseId });
        }
      }}
    >
      <View style={styles.noteHeader}>
        <Text style={styles.verseReference}>
          {item.verse?.book} {item.verse?.chapter}:{item.verse?.verse}
        </Text>
        <Text style={styles.noteDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.noteContent} numberOfLines={3}>
        {item.content}
      </Text>
      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('notes:title')}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('TagsManagement')}
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
        renderItem={renderNoteItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.notesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || selectedTag ? t('notes:noNotesFound') : t('notes:noNotesYet')}
            </Text>
          </View>
        }
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
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  noteContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
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
});

export default NotesScreen; 