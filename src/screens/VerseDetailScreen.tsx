import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  Switch,
  FlatList,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { Verse, Note, Connection, ConnectionType } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

type VerseDetailScreenRouteProp = RouteProp<RootStackParamList, 'VerseDetail'>;
type VerseDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SHOW_LABELS_KEY = '@biblegraph:show_connection_labels';

// Tag colors for random assignment
const TAG_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', 
  '#EF476F', '#FFC43D', '#1B9AAA', '#6F2DBD', '#84BC9C'
];

// Add this after the SHOW_LABELS_KEY constant
const CONNECTION_COLORS = {
  OUTGOING: '#007AFF', // Blue for outgoing connections
  INCOMING: '#FF9500'  // Orange for incoming connections
};

const VerseDetailScreen: React.FC = () => {
  const { t } = useTranslation(['verseDetail', 'common']);
  const route = useRoute<VerseDetailScreenRouteProp>();
  const navigation = useNavigation<VerseDetailNavigationProp>();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [targetVerseRef, setTargetVerseRef] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteContent, setEditedNoteContent] = useState('');
  const [editedNoteTags, setEditedNoteTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    loadVerseDetails();
    loadLabelPreference();
  }, [route.params.verseId]);

  // Extract all unique tags from notes
  useEffect(() => {
    const uniqueTags = Array.from(
      new Set(notes.flatMap(note => note.tags || []))
    );
    setAllTags(uniqueTags);
  }, [notes]);

  const loadLabelPreference = async () => {
    try {
      const labelPreference = await AsyncStorage.getItem(SHOW_LABELS_KEY);
      if (labelPreference !== null) {
        setShowLabels(labelPreference === 'true');
      }
    } catch (error) {
      console.error('Error loading label preference:', error);
    }
  };

  const toggleLabels = async (value: boolean) => {
    setShowLabels(value);
    try {
      await AsyncStorage.setItem(SHOW_LABELS_KEY, value.toString());
    } catch (error) {
      console.error('Error saving label preference:', error);
    }
  };

  const loadVerseDetails = async () => {
    try {
      // First try to get the verse by ID from the database
      let verseToDisplay = await neo4jService.getVerse(route.params.verseId);
      
      // If verse not found by ID, check if it exists by reference (book, chapter, verse)
      if (!verseToDisplay) {
        // Parse the verseId to extract book, chapter, verse (assuming format like "John-3-16")
        const parts = route.params.verseId.split('-');
        if (parts.length >= 3) {
          const book = parts[0];
          const chapter = parseInt(parts[1]);
          const verse = parseInt(parts[2]);
          
          // If we could parse valid reference, first check if it exists
          if (book && !isNaN(chapter) && !isNaN(verse)) {
            // Try to find by reference first
            verseToDisplay = await neo4jService.getVerseByReference(book, chapter, verse);
            
            // If not found, create it
            if (!verseToDisplay) {
              const mockVerse: Verse = {
                id: route.params.verseId,
                book,
                chapter,
                verse,
                text: 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.',
                translation: 'ESV',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              try {
                verseToDisplay = await neo4jService.createVerse(mockVerse);
              } catch (error) {
                // If creation fails, try to fetch by book, chapter, verse again (race condition handling)
                console.log('Error creating verse, trying to fetch existing one:', error);
                verseToDisplay = await neo4jService.getVerseByReference(book, chapter, verse);
              }
            }
          }
        }
      }
      
      // If we found or created a verse, use it
      if (verseToDisplay) {
        setVerse(verseToDisplay);
        
        // Load notes for this verse
        const verseNotes = await neo4jService.getNotesForVerse(verseToDisplay.id);
        setNotes(verseNotes);
        
        // Load connections for this verse
        const verseConnections = await neo4jService.getConnectionsForVerse(verseToDisplay.id);
        
        // Deduplicate connections by source-target-type
        const uniqueConnectionsMap = new Map<string, Connection>();
        
        verseConnections.forEach(connection => {
          const uniqueKey = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
          if (!uniqueConnectionsMap.has(uniqueKey) || 
              new Date(connection.updatedAt) > new Date(uniqueConnectionsMap.get(uniqueKey)!.updatedAt)) {
            uniqueConnectionsMap.set(uniqueKey, connection);
          }
        });
        
        setConnections(Array.from(uniqueConnectionsMap.values()));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading verse details:', error);
      setIsLoading(false);
    }
  };

  // Generate a readable reference from verse ID (e.g. "John-3-16" to "John 3:16")
  const formatVerseId = (verseId: string): string => {
    const parts = verseId.split('-');
    if (parts.length >= 3) {
      return `${parts[0]} ${parts[1]}:${parts[2]}`;
    }
    return verseId;
  };

  const handleAddTag = (isNewNote: boolean = true) => {
    if (!newTagInput.trim()) return;
    
    if (isNewNote) {
      // Adding tag to new note
      if (!newNoteTags.includes(newTagInput.trim())) {
        setNewNoteTags([...newNoteTags, newTagInput.trim()]);
      }
    } else {
      // Adding tag to note being edited
      if (!editedNoteTags.includes(newTagInput.trim())) {
        setEditedNoteTags([...editedNoteTags, newTagInput.trim()]);
      }
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string, isNewNote: boolean = true) => {
    if (isNewNote) {
      setNewNoteTags(newNoteTags.filter(t => t !== tag));
    } else {
      setEditedNoteTags(editedNoteTags.filter(t => t !== tag));
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !verse) return;

    try {
      const note = await neo4jService.createNote(verse.id, newNote, newNoteTags);
      setNotes([...notes, note]);
      setNewNote('');
      setNewNoteTags([]);
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert(t('common:error'), t('verseDetail:failedToAddNote'));
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditedNoteContent(note.content);
    setEditedNoteTags(note.tags || []);
  };

  const handleSaveNote = async () => {
    if (!editingNoteId || !verse || !editedNoteContent.trim()) {
      setEditingNoteId(null);
      return;
    }

    try {
      const updatedNote = {
        ...notes.find(note => note.id === editingNoteId)!,
        content: editedNoteContent,
        tags: editedNoteTags,
        updatedAt: new Date().toISOString()
      };

      const savedNote = await neo4jService.updateNote(editingNoteId, {
        content: editedNoteContent,
        tags: editedNoteTags
      });
      
      // Update the notes array with the edited note
      setNotes(notes.map(note => 
        note.id === editingNoteId ? savedNote : note
      ));
      
      // Exit edit mode
      setEditingNoteId(null);
      setEditedNoteContent('');
      setEditedNoteTags([]);
    } catch (error) {
      console.error('Error updating note:', error);
      Alert.alert(t('common:error'), t('verseDetail:failedToUpdateNote'));
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const success = await neo4jService.deleteNote(noteId);
      
      if (success) {
        setNotes(notes.filter(note => note.id !== noteId));
        if (editingNoteId === noteId) {
          setEditingNoteId(null);
          setEditedNoteContent('');
          setEditedNoteTags([]);
        }
      } else {
        console.error(`Failed to delete note ${noteId}`);
        Alert.alert(t('common:error'), t('verseDetail:failedToDeleteNote'));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      Alert.alert(t('common:error'), t('verseDetail:failedToDeleteNote'));
    }
  };

  const formatVerseReference = (reference: string): string => {
    // Check if the reference is in a simple format like "John 3:16"
    const simplePattern = /^([a-z]+)\s*(\d+)\s*:\s*(\d+)$/i;
    const match = reference.match(simplePattern);
    
    if (match) {
      const [, book, chapter, verse] = match;
      return `${book}-${chapter}-${verse}`;
    }
    
    // If not in the simple format, return as is (might be already in the right format)
    return reference;
  };

  const handleAddConnection = async (type: ConnectionType) => {
    if (!verse || !targetVerseRef.trim()) {
      Alert.alert(
        t('common:error'), 
        t('verseDetail:enterValidReference')
      );
      return;
    }

    try {
      const formattedRef = formatVerseReference(targetVerseRef);
      
      // First check if the target verse exists
      let targetVerse = await neo4jService.getVerse(formattedRef);
      
      // If not found by ID, try to parse it as a reference
      if (!targetVerse) {
        const parts = formattedRef.split('-');
        if (parts.length >= 3) {
          const book = parts[0];
          const chapter = parseInt(parts[1]);
          const verseNum = parseInt(parts[2]);
          
          if (book && !isNaN(chapter) && !isNaN(verseNum)) {
            targetVerse = await neo4jService.getVerseByReference(book, chapter, verseNum);
            
            // Create the verse if it doesn't exist
            if (!targetVerse) {
              const mockVerse: Verse = {
                id: formattedRef,
                book,
                chapter,
                verse: verseNum,
                text: 'Verse text will be loaded on demand.',
                translation: 'ESV',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              targetVerse = await neo4jService.createVerse(mockVerse);
            }
          }
        }
      }
      
      if (!targetVerse) {
        Alert.alert(
          t('common:error'), 
          t('verseDetail:targetVerseNotFound')
        );
        return;
      }
      
      const connection: Connection = {
        id: Date.now().toString(),
        sourceVerseId: verse.id,
        targetVerseId: targetVerse.id,
        type,
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await neo4jService.createConnection(connection);
      setConnections([...connections, connection]);
      setTargetVerseRef(''); // Clear the input after successful connection
      
      Alert.alert(
        t('common:success'), 
        t('verseDetail:connectionAdded')
      );
    } catch (error) {
      console.error('Error adding connection:', error);
      Alert.alert(t('common:error'), t('verseDetail:failedToAddConnection'));
    }
  };

  const navigateToConnectedVerse = (verseId: string) => {
    navigation.navigate('VerseDetail', { verseId });
  };

  const getTagColor = (tag: string) => {
    // Generate a consistent color based on tag name
    const tagIndex = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % TAG_COLORS.length;
    return TAG_COLORS[tagIndex];
  };

  const renderTag = (tag: string, isNewNote: boolean = true) => (
    <View key={tag} style={[styles.tagItem, { backgroundColor: getTagColor(tag) }]}>
      <Text style={styles.tagText}>{tag}</Text>
      <TouchableOpacity 
        onPress={() => handleRemoveTag(tag, isNewNote)}
        style={styles.tagRemoveButton}
      >
        <Ionicons name="close-circle" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderTagsSection = (tags: string[], isNewNote: boolean = true) => (
    <View style={styles.tagsContainer}>
      <View style={styles.tagsHeader}>
        <Text style={styles.tagsTitle}>{t('verseDetail:tags')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('TagsManagement')}
          style={styles.manageTagsButton}
        >
          <Text style={styles.manageTagsText}>{t('verseDetail:manageTags')}</Text>
          <Ionicons name="pricetags-outline" size={16} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.tagsInputContainer}>
        <TextInput
          style={styles.tagInput}
          placeholder={t('verseDetail:addTag')}
          value={newTagInput}
          onChangeText={setNewTagInput}
          onSubmitEditing={() => handleAddTag(isNewNote)}
          returnKeyType="done"
        />
        <TouchableOpacity 
          style={styles.addTagButton}
          onPress={() => handleAddTag(isNewNote)}
        >
          <Ionicons name="add-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {allTags.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.suggestedTagsContainer}
        >
          {allTags.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.suggestedTag, { backgroundColor: getTagColor(tag) }]}
              onPress={() => {
                if (isNewNote) {
                  if (!newNoteTags.includes(tag)) {
                    setNewNoteTags([...newNoteTags, tag]);
                  }
                } else {
                  if (!editedNoteTags.includes(tag)) {
                    setEditedNoteTags([...editedNoteTags, tag]);
                  }
                }
              }}
            >
              <Text style={styles.suggestedTagText}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.tagsList}>
        {tags.map(tag => renderTag(tag, isNewNote))}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>{t('common:loading')}</Text>
      </View>
    );
  }

  if (!verse) {
    return (
      <View style={styles.errorContainer}>
        <Text>{t('verseDetail:verseNotFound')}</Text>
      </View>
    );
  }

  const renderNoteItem = (note: Note) => {
    const isEditing = editingNoteId === note.id;
    
    return (
      <View key={note.id} style={styles.noteItem}>
        {isEditing ? (
          <View style={styles.editNoteContainer}>
            <TextInput
              style={styles.editNoteInput}
              value={editedNoteContent}
              onChangeText={setEditedNoteContent}
              multiline
              autoFocus
            />
            {renderTagsSection(editedNoteTags, false)}
            <View style={styles.noteActionButtons}>
              <TouchableOpacity
                style={styles.noteSaveButton}
                onPress={handleSaveNote}
              >
                <Ionicons name="checkmark" size={20} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noteCancelButton}
                onPress={() => {
                  setEditingNoteId(null);
                  setEditedNoteContent('');
                  setEditedNoteTags([]);
                }}
              >
                <Ionicons name="close" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.noteContent}>{note.content}</Text>
            {note.tags && note.tags.length > 0 && (
              <View style={styles.noteTagsContainer}>
                {note.tags.map(tag => (
                  <View 
                    key={tag} 
                    style={[styles.noteTag, { backgroundColor: getTagColor(tag) }]}
                  >
                    <Text style={styles.noteTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.noteFooter}>
              <Text style={styles.noteDate}>
                {new Date(note.createdAt).toLocaleDateString()}
              </Text>
              <View style={styles.noteActions}>
                <TouchableOpacity
                  style={styles.noteActionButton}
                  onPress={() => handleEditNote(note)}
                >
                  <Ionicons name="pencil" size={18} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.noteActionButton}
                  onPress={() => handleDeleteNote(note.id)}
                >
                  <Ionicons name="trash" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.verseContainer}>
          <Text style={styles.reference}>
            {verse.book} {verse.chapter}:{verse.verse}
          </Text>
          <Text style={styles.text}>{verse.text}</Text>
          <Text style={styles.translation}>{verse.translation}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verseDetail:notes')}</Text>
          {notes.map(renderNoteItem)}
          <View style={styles.addNoteContainer}>
            <TextInput
              style={styles.noteInput}
              placeholder={t('verseDetail:addNoteHint')}
              value={newNote}
              onChangeText={setNewNote}
              multiline
            />
            <TouchableOpacity
              style={styles.addNoteButton}
              onPress={handleAddNote}
            >
              <Ionicons name="add-circle" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          {renderTagsSection(newNoteTags)}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('verseDetail:connections')}</Text>
            <View style={styles.labelToggle}>
              <Text style={styles.labelToggleText}>{t('verseDetail:showLabels')}</Text>
              <Switch
                value={showLabels}
                onValueChange={toggleLabels}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={showLabels ? '#007AFF' : '#f4f3f4'}
              />
            </View>
          </View>
          
          {connections.length === 0 ? (
            <Text style={styles.emptyMessage}>{t('verseDetail:noConnections')}</Text>
          ) : (
            connections.map((connection) => {
              // Skip if the connection is a self-connection
              if (connection.sourceVerseId === connection.targetVerseId) {
                return null;
              }
              
              // Determine if this is an outgoing or incoming connection
              const isOutgoing = connection.sourceVerseId === verse.id;
              const connectedVerseId = isOutgoing ? connection.targetVerseId : connection.sourceVerseId;
              const connectionColor = isOutgoing ? CONNECTION_COLORS.OUTGOING : CONNECTION_COLORS.INCOMING;
              
              return (
                <TouchableOpacity
                  key={connection.id}
                  style={[styles.connectionItem, { borderLeftColor: connectionColor, borderLeftWidth: 4 }]}
                  onPress={() => navigateToConnectedVerse(connectedVerseId)}
                >
                  <Ionicons
                    name={
                      connection.type === ConnectionType.THEMATIC
                        ? 'link'
                        : connection.type === ConnectionType.PROPHECY
                        ? 'star'
                        : 'git-compare'
                    }
                    size={20}
                    color={connectionColor}
                  />
                  <View style={styles.connectionContent}>
                    <View style={styles.connectionHeader}>
                      <Text style={[styles.connectionText, { color: connectionColor }]}>
                        {formatVerseId(connectedVerseId)}
                      </Text>
                      {isOutgoing ? (
                        <Ionicons name="arrow-forward" size={14} color={connectionColor} />
                      ) : (
                        <Ionicons name="arrow-back" size={14} color={connectionColor} />
                      )}
                    </View>
                    {showLabels && (
                      <View style={styles.connectionLabels}>
                        <Text style={[styles.connectionTypeLabel, { backgroundColor: isOutgoing ? '#E1F0FF' : '#FFF5E6' }]}>
                          {connection.type === ConnectionType.THEMATIC
                            ? t('verseDetail:thematic')
                            : connection.type === ConnectionType.PROPHECY
                            ? t('verseDetail:prophecy')
                            : t('verseDetail:crossReference')}
                        </Text>
                        <Text style={[styles.connectionDirectionLabel, { backgroundColor: isOutgoing ? '#E1F0FF' : '#FFF5E6' }]}>
                          {isOutgoing ? t('verseDetail:connectsTo') : t('verseDetail:connectedBy')}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verseDetail:addConnection')}</Text>
          <TextInput
            style={styles.connectionInput}
            placeholder={t('verseDetail:enterVerseReference')}
            value={targetVerseRef}
            onChangeText={setTargetVerseRef}
          />
          <View style={styles.connectionTypeContainer}>
            <TouchableOpacity
              style={styles.connectionTypeButton}
              onPress={() => handleAddConnection(ConnectionType.THEMATIC)}
            >
              <Ionicons name="link" size={20} color="#007AFF" />
              <Text style={styles.connectionTypeText}>{t('verseDetail:thematic')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.connectionTypeButton}
              onPress={() => handleAddConnection(ConnectionType.CROSS_REFERENCE)}
            >
              <Ionicons name="git-compare" size={20} color="#007AFF" />
              <Text style={styles.connectionTypeText}>{t('verseDetail:crossReference')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.connectionTypeButton}
              onPress={() => handleAddConnection(ConnectionType.PROPHECY)}
            >
              <Ionicons name="star" size={20} color="#007AFF" />
              <Text style={styles.connectionTypeText}>{t('verseDetail:prophecy')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verseContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reference: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  translation: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  labelToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelToggleText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  noteItem: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  noteContent: {
    fontSize: 14,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  noteActions: {
    flexDirection: 'row',
  },
  noteActionButton: {
    padding: 4,
    marginLeft: 8,
  },
  editNoteContainer: {
    width: '100%',
  },
  editNoteInput: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    minHeight: 60,
    marginBottom: 8,
  },
  noteActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  noteSaveButton: {
    padding: 6,
    marginRight: 8,
    backgroundColor: '#E1F0FF',
    borderRadius: 4,
  },
  noteCancelButton: {
    padding: 6,
    backgroundColor: '#FFEEEE',
    borderRadius: 4,
  },
  addNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    minHeight: 40,
  },
  addNoteButton: {
    marginLeft: 8,
    padding: 4,
  },
  tagsContainer: {
    marginTop: 12,
  },
  tagsHeader: {
    marginBottom: 8,
  },
  tagsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  tagsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    height: 40,
  },
  addTagButton: {
    marginLeft: 8,
    padding: 4,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    margin: 4,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
    marginRight: 4,
  },
  tagRemoveButton: {
    padding: 2,
  },
  noteTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  noteTag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  noteTagText: {
    color: 'white',
    fontSize: 12,
  },
  suggestedTagsContainer: {
    marginVertical: 8,
    maxHeight: 36,
  },
  suggestedTag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  suggestedTagText: {
    color: 'white',
    fontSize: 12,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  connectionContent: {
    flex: 1,
    marginLeft: 8,
    flexDirection: 'column',
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  connectionTypeLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  connectionLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionDirectionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  connectionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    minHeight: 40,
    marginBottom: 12,
  },
  connectionTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  connectionTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  connectionTypeText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  manageTagsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  manageTagsText: {
    fontSize: 12,
    color: '#007AFF',
    marginRight: 4,
  },
});

export default VerseDetailScreen; 