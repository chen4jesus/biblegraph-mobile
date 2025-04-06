import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Modal,
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { Verse, Note, Connection, ConnectionType, VerseGroup, GroupConnection, NodeType, Tag } from '../types/bible';
import { DatabaseService, AuthService } from '../services';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MultiConnectionSelector from '../components/MultiConnectionSelector';
import VerseGroupSelector from '../components/VerseGroupSelector';
import NoteEditorModal from '../components/NoteEditorModal';
import WebViewModal from '../components/WebViewModal';
import { theme, globalStyles } from '../styles/theme';

type VerseDetailScreenRouteProp = RouteProp<RootStackParamList, 'VerseDetail'>;
type VerseDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SHOW_LABELS_KEY = '@biblegraph:show_connection_labels';

// Tag colors for random assignment
const TAG_COLORS = [
  '#8B4513', '#2E8B57', '#9932CC', '#FF69B4', '#4682B4',
  '#DC143C', '#20B2AA', '#FF8C00', '#9370DB', '#3CB371',
  '#FF1493', '#00CED1', '#FFA07A', '#7B68EE', '#32CD32',
  '#FF4500', '#48D1CC', '#DDA0DD', '#6495ED', '#98FB98',
  '#FF0000', '#40E0D0', '#FA8072', '#483D8B', '#90EE90',
  '#FF6347', '#00FA9A', '#FFB6C1', '#4169E1', '#87CEEB',
  '#FF7F50', '#66CDAA', '#DB7093', '#1E90FF', '#7FFFD4',
  '#CD5C5C', '#00FF7F', '#FFE4E1', '#0000FF', '#E0FFFF',
  '#F08080', '#7CFC00', '#FFC0CB', '#0000CD', '#AFEEEE',
  '#FA8072', '#7FFF00', '#FFB6C1', '#000080', '#B0E0E6',
  '#E9967A', '#ADFF2F', '#FF69B4', '#00008B', '#87CEFA',
  '#FFA07A', '#32CD32', '#FF1493', '#191970', '#ADD8E6'
];

// Add this after the SHOW_LABELS_KEY constant
const CONNECTION_COLORS = {
  OUTGOING: '#007AFF', // Blue for outgoing connections
  INCOMING: '#FF9500'  // Orange for incoming connections
};

// Extended Connection interface that includes the connected verse and node
interface ConnectionWithVerse extends Connection {
  connectedVerse?: Verse | null;
  connectedNode?: any; // Could be Verse, Note, Tag, etc.
  connectedNodeType?: NodeType;
  isGrouped?: boolean;
  groupedConnections?: Connection[];
  connectedVerseCount?: number;
  expanded?: boolean;
  metadata?: Record<string, any>;
}

// Update the component type declaration
const VerseDetailScreen: React.FC = () => {
  const { t } = useTranslation(['verseDetail', 'common', 'connections', 'navigation']);
  const route = useRoute<RouteProp<RootStackParamList, 'VerseDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'notes' | 'connections'>(
    route.params.activeTab || 'notes'
  );
  const [showMultiConnectionSelector, setShowMultiConnectionSelector] = useState(false);
  const [isGroupSelectorVisible, setIsGroupSelectorVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  // Add state to track expanded notes
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [webViewUrl, setWebViewUrl] = useState<string>('');
  const [isWebViewVisible, setIsWebViewVisible] = useState<boolean>(false);
  // Add state for tracking recently updated notes
  const [recentlyUpdatedNote, setRecentlyUpdatedNote] = useState<string | null>(null);
  // Add state for visualization options modal
  const [showVisualizationModal, setShowVisualizationModal] = useState<boolean>(false);
  
  // Animation value for the highlight effect
  const highlightAnimation = useRef(new Animated.Value(0)).current;

  // Add state for active bottom tab
  const [activeBottomTab, setActiveBottomTab] = useState<string>('none');

  // Add these state variables with the other state declarations
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Add this function to extract all unique tags from notes
  const extractAllTags = useCallback((notesList: Note[]) => {
    const tagsSet = new Set<string>();
    notesList.forEach(note => {
      if (note.tags && Array.isArray(note.tags)) {
        note.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, []);

  useEffect(() => {
    loadVerseDetails();
    loadLabelPreference();
    loadTagColors();
    
    // Update active tab if provided in route params
    if (route.params.activeTab) {
      setActiveTab(route.params.activeTab);
    }
  }, [route.params.verseId, route.params.activeTab]);

  // Extract all unique tags from notes
  useEffect(() => {
    const uniqueTags = extractAllTags(notes);
    setAllTags(uniqueTags);
  }, [notes, extractAllTags]);

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

  const loadTagColors = async () => {
    try {
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

  const loadVerseDetails = async () => {
    try {
      // First try to get the verse by ID from the database
      let verseToDisplay = await DatabaseService.getVerse(route.params.verseId);
      
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
            verseToDisplay = await DatabaseService.getVerseByReference(book, chapter, verse);
            
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
                verseToDisplay = await DatabaseService.createVerse(mockVerse);
              } catch (error) {
                // If creation fails, try to fetch by book, chapter, verse again (race condition handling)
                console.debug('Error creating verse, trying to fetch existing one:', error);
                verseToDisplay = await DatabaseService.getVerseByReference(book, chapter, verse);
              }
            }
          }
        }
      }
      
      // If we found or created a verse, use it
      if (verseToDisplay) {
        setVerse(verseToDisplay);
        
        // Load notes for this verse
        const currentUser = await AuthService.getCurrentUser();
        const verseNotes = await DatabaseService.getNotesForVerse(verseToDisplay.id, currentUser?.id);
        setNotes(verseNotes);
        
        // First load regular connections for this verse
        const regularConnections = await DatabaseService.getConnectionsForVerse(verseToDisplay.id, currentUser?.id);
        
        // Filter out connections that are part of groups (have a groupConnectionId)
        const singleConnections = regularConnections.filter(conn => !conn.groupConnectionId);
        
        // Process single connections
        const connectionsWithVerses = await Promise.all(
          singleConnections.map(async (connection) => {
            const isOutgoing = connection.sourceVerseId === verseToDisplay.id;
            const connectedVerseId = isOutgoing ? connection.targetVerseId : connection.sourceVerseId;
            
            try {
              const connectedVerse = await DatabaseService.getVerse(connectedVerseId);
              return {
                ...connection,
                connectedVerse
              } as ConnectionWithVerse;
            } catch (error) {
              console.error(`Error fetching verse ${connectedVerseId}:`, error);
              return {
                ...connection,
                connectedVerse: null
              } as ConnectionWithVerse;
            }
          })
        );
        
        // Then load group connections
        const groupConnections = await DatabaseService.getGroupConnectionsByVerseId(verseToDisplay.id);
        
        // Process group connections
        const groupConnectionsWithVerses = await Promise.all(
          groupConnections.map(async (group) => {
            // For group connections, get information based on node types
            let sampleConnectedNode: any = null;
            const isSource = group.sourceIds?.includes(verseToDisplay.id);
            const isTarget = group.targetIds?.includes(verseToDisplay.id);
            
            try {
              // Determine which node to fetch based on whether the current verse is a source or target
              if (isSource && group.targetIds?.length) {
                // This is a connection where our verse is a source - fetch a target
                if (group.targetType === 'VERSE') {
                  sampleConnectedNode = await DatabaseService.getVerse(group.targetIds[0]);
                } else if (group.targetType === 'NOTE') {
                  sampleConnectedNode = await DatabaseService.getNote(group.targetIds[0]);
                } else if (group.targetType === 'TAG') {
                  // Handle tag fetching - we may need to implement this method
                  // For now just create a placeholder object
                  sampleConnectedNode = { id: group.targetIds[0], name: "Tag", color: "#cccccc" };
                }
              } 
              else if (isTarget && group.sourceIds?.length) {
                // This is a connection where our verse is a target - fetch a source
                if (group.sourceType === 'VERSE') {
                  sampleConnectedNode = await DatabaseService.getVerse(group.sourceIds[0]);
                } else if (group.sourceType === 'NOTE') {
                  sampleConnectedNode = await DatabaseService.getNote(group.sourceIds[0]);
                } else if (group.sourceType === 'TAG') {
                  // Handle tag fetching - we may need to implement this method
                  // For now just create a placeholder object
                  sampleConnectedNode = { id: group.sourceIds[0], name: "Tag", color: "#cccccc" };
                }
              }
              
              // Get all individual connections for this group - will be needed for expanding/collapsing
              const groupedConnections = regularConnections.filter(conn => 
                conn.groupConnectionId === group.id
              );
              
              return {
                id: group.id,
                sourceVerseId: verseToDisplay.id, // Use current verse as reference point
                targetVerseId: isSource ? (group.targetIds?.[0] || '') : (group.sourceIds?.[0] || ''), 
                type: group.type,
                description: group.description || '',
                createdAt: group.createdAt,
                updatedAt: group.updatedAt,
                isGrouped: true,
                groupedConnections: groupedConnections,
                connectedVerse: group.sourceType === 'VERSE' || group.targetType === 'VERSE' 
                  ? sampleConnectedNode 
                  : null,
                connectedNode: sampleConnectedNode,
                connectedNodeType: isSource ? group.targetType : group.sourceType,
                connectedVerseCount: (isSource ? group.targetIds?.length : group.sourceIds?.length) || 0,
                metadata: group.metadata
              } as ConnectionWithVerse;
            } catch (error) {
              console.error(`Error processing group connection ${group.id}:`, error);
              return {
                id: group.id,
                sourceVerseId: verseToDisplay.id,
                targetVerseId: '',
                type: group.type,
                description: group.description || '',
                createdAt: group.createdAt,
                updatedAt: group.updatedAt,
                isGrouped: true,
                groupedConnections: [],
                connectedVerse: null,
                connectedNodeType: isSource ? group.targetType : group.sourceType,
                connectedVerseCount: 0
              } as ConnectionWithVerse;
            }
          })
        );
        
        // Combine single and group connections
        setConnections([...connectionsWithVerses, ...groupConnectionsWithVerses]);
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
      // Get current user for ownership
      const currentUser = await AuthService.getCurrentUser();
      const note = await DatabaseService.createNote(verse.id, newNote, newNoteTags, currentUser?.id);
      setNotes([...notes, note]);
      setNewNote('');
      setNewNoteTags([]);
      showNotification('Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      showNotification('Failed to add note');
    }
  };

  const handleEditNote = async (note: Note) => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      setCurrentNote({
        ...note,
        updatedContent: note.content,
        updatedTags: [...(note.tags || [])]
      });
      setNoteModalVisible(true);
    } catch (error) {
      console.error('Error preparing to edit note:', error);
    }
  };

  const handleSaveNote = async (content: string, tags: string[]) => {
    try {
      if (!currentNote) return;
      
      // Get current user for ownership check
      const currentUser = await AuthService.getCurrentUser();
      
      // Update the note with user ownership
      const updatedNote = await DatabaseService.updateNote(
        currentNote.id,
        { content, tags },
        currentUser?.id
      );
      
      // Update the UI
      setNotes(notes.map(note => 
        note.id === updatedNote.id ? updatedNote : note
      ));
      
      // Clear editing state
      setCurrentNote(null);
      
      // Update note in the notes screen if in verse detail
      const notesScreenRef = getNotesScreenRef();
      if (notesScreenRef) {
        notesScreenRef.updateSingleNote(updatedNote.id, false, currentUser?.id);
      }
      
      setNoteModalVisible(false);
      showNotification('Note updated successfully');
    } catch (error) {
      console.error('Error saving note:', error);
      showNotification('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const success = await DatabaseService.deleteNote(noteId);
                
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
      // Get current user for ownership
      const currentUser = await AuthService.getCurrentUser();
      
      const formattedRef = formatVerseReference(targetVerseRef);
      
      // First check if the target verse exists
      let targetVerse = await DatabaseService.getVerse(formattedRef);
      
      // If not found by ID, try to parse it as a reference
      if (!targetVerse) {
        const parts = formattedRef.split('-');
        if (parts.length >= 3) {
          const book = parts[0];
          const chapter = parseInt(parts[1]);
          const verseNum = parseInt(parts[2]);
          
          if (book && !isNaN(chapter) && !isNaN(verseNum)) {
            targetVerse = await DatabaseService.getVerseByReference(book, chapter, verseNum);
            
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
              
              targetVerse = await DatabaseService.createVerse(mockVerse);
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
      
      // Create a truly unique ID with a random component
      const uniqueId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const connection: ConnectionWithVerse = {
        id: uniqueId,
        sourceVerseId: verse.id,
        targetVerseId: targetVerse.id,
        type,
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        connectedVerse: targetVerse,
        userId: currentUser?.id
      };
      
      await DatabaseService.createConnection(connection);
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
    // Pass the active tab parameter to preserve the tab state
    navigation.push('VerseDetail', { 
      verseId,
      activeTab: 'connections' 
    });
  };

  const handleConnectionsCreated = async (newConnections: Array<Connection | GroupConnection>) => {
    // Reload connections after batch creation
    if (newConnections.length > 0 && verse) {
      // Show success notification
      Alert.alert(
        t('common:success'),
        t('verseDetail:connectionsAdded').replace('{count}', String(newConnections.length)),
        [{ text: t('common:ok'), style: 'default' }]
      );
      
      // Refresh connections list
      await loadVerseDetails();
        
      // Switch to connections tab
      setActiveTab('connections');
      
      // Hide the selector
      setShowMultiConnectionSelector(false);
    }
  };

  const getTagColor = (tag: string) => {
    // First check if we have the color in our tagColors state
    if (tagColors[tag]) {
      return tagColors[tag];
    }
    
    // Fallback to generating a color if not found in database
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
          onPress={() => {
            // Use any to bypass TypeScript navigation typing issues
            (navigation as any).navigate('TagsManagement');
          }}
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

  const renderConnectionItem = ({ item }: { item: ConnectionWithVerse }) => {
    // Skip if the connection is a self-connection
    if (item.sourceVerseId === item.targetVerseId || !verse) {
      return null;
    }
    
    // Handle grouped connections differently
    if (item.isGrouped && item.groupedConnections?.length) {
      return renderGroupedConnection(item);
    }
    
    // Regular connection rendering (existing code)
    const isOutgoing = item.sourceVerseId === verse.id;
    const connectedVerseId = isOutgoing ? item.targetVerseId : item.sourceVerseId;
    const connectionColor = isOutgoing ? CONNECTION_COLORS.OUTGOING : CONNECTION_COLORS.INCOMING;
    
    // Check if this is a protected "Consecutive verses" connection
    const isProtectedConnection = item.type === ConnectionType.DEFAULT;
    
    return (
      <View style={styles.connectionItemContainer}>
        <TouchableOpacity
          style={[styles.connectionItem, { borderLeftColor: connectionColor, borderLeftWidth: 4 }]}
          onPress={() => navigateToConnectedVerse(connectedVerseId)}
        >
          <View style={styles.connectionIconContainer}>
            <Ionicons
              name={
                item.type === ConnectionType.THEMATIC
                  ? 'link'
                  : item.type === ConnectionType.PROPHECY
                  ? 'star'  
                  : item.type === ConnectionType.CROSS_REFERENCE
                  ? 'git-compare'
                  : item.type === ConnectionType.PARALLEL
                  ? 'git-compare'
                  : 'shield-checkmark'
              }
              size={20}
              color={connectionColor}
            />
          </View>
          <View style={styles.connectionContent}>
            <View style={styles.connectionHeader}>
              {item.connectedVerse && (
                <Text style={[styles.connectionText, { color: connectionColor }]}>
                  {item.connectedVerse.book} {item.connectedVerse.chapter}:{item.connectedVerse.verse}
                </Text>
              )}
              {isOutgoing ? (
                <Ionicons name="arrow-forward" size={14} color={connectionColor} />
              ) : (
                <Ionicons name="arrow-back" size={14} color={connectionColor} />
              )}
            </View>
            
            {item.connectedVerse && (
              <Text style={styles.connectionVerseText} numberOfLines={2}>
                {item.connectedVerse.text}
              </Text>
            )}
            
            {showLabels && (
              <View style={styles.connectionLabels}>
                {!isProtectedConnection && (
                  <Text style={[styles.connectionTypeLabel, { backgroundColor: isOutgoing ? '#E1F0FF' : '#FFF5E6' }]}>
                    {item.type === ConnectionType.THEMATIC
                      ? t('connections:connectionTypes.thematic')
                      : item.type === ConnectionType.PROPHECY
                      ? t('connections:connectionTypes.prophecy')
                      : item.type === ConnectionType.CROSS_REFERENCE
                      ? t('connections:connectionTypes.crossReference') 
                      : item.type === ConnectionType.PARALLEL
                      ? t('connections:connectionTypes.parallel')
                      : t('connections:connectionTypes.note')}
                  </Text>
                )}
                {isProtectedConnection && (
                  <Text style={[styles.protectedLabel, { backgroundColor: '#E9FFF0' }]}>
                    {t('verseDetail:systemProtected')}
                  </Text>
                )}
                <Text style={[styles.connectionDirectionLabel, { backgroundColor: isOutgoing ? '#E1F0FF' : '#FFF5E6' }]}>
                  {isOutgoing ? t('verseDetail:connectsTo') : t('verseDetail:connectedBy')}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        {!isProtectedConnection && (
          // Simplified delete button implementation
          <TouchableOpacity
            style={[styles.deleteConnectionButton, { padding: 12 }]}
            onPress={() => {
              console.debug('Directly deleting connection with ID:', item.id);
              // Get current user for ownership
              AuthService.getCurrentUser().then(currentUser => {
                DatabaseService.deleteConnection(item.id, currentUser?.id);
                console.debug('Connection deleted from database');
                
                // Update the connections state to remove this connection
                setConnections(prev => prev.filter(c => c.id !== item.id));
                
                // Show success message
                showNotification(t('verseDetail:connectionDeleted'));
              });
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Function to render a grouped connection
  const renderGroupedConnection = (connection: ConnectionWithVerse) => {
    const sampleNode = connection.connectedNode;
    const connectionCount = connection.connectedVerseCount || 0;
    const nodeType = connection.connectedNodeType || 'VERSE';
    
    // Get a display name for the connected node based on its type
    let nodeDisplayName = '';
    let nodeDetails = '';
    
    if (sampleNode) {
      if (nodeType === 'VERSE' && connection.connectedVerse) {
        nodeDisplayName = `${connection.connectedVerse.book} ${connection.connectedVerse.chapter}:${connection.connectedVerse.verse}`;
        nodeDetails = connection.connectedVerse.text;
      } else if (nodeType === 'NOTE') {
        nodeDisplayName = `Note ${sampleNode.id.substring(0, 8)}`;
        nodeDetails = sampleNode.content.substring(0, 60) + (sampleNode.content.length > 60 ? '...' : '');
      } else if (nodeType === 'TAG') {
        nodeDisplayName = `Tag: ${sampleNode.name}`;
        nodeDetails = '';
      } else if (nodeType === 'TOPIC') {
        nodeDisplayName = `Topic: ${sampleNode.name}`;
        nodeDetails = sampleNode.description ? (sampleNode.description.substring(0, 60) + (sampleNode.description.length > 60 ? '...' : '')) : '';
      }
    }
    
    // Color coding by node type
    const nodeTypeColors = {
      VERSE: '#5B8FF9', // Blue
      NOTE: '#F6BD16',  // Yellow
      TAG: '#5AD8A6',   // Green
      TOPIC: '#FF6B3B', // Orange
      GROUP: '#945FB9'  // Purple
    };
    
    const borderColor = nodeTypeColors[nodeType] || '#5B8FF9';
    
    return (
      <View key={connection.id} style={[styles.groupedConnectionItem, { borderLeftColor: borderColor }]}>
        <TouchableOpacity 
          style={styles.groupedConnectionHeader}
          onPress={() => {
            setConnections(prev => 
              prev.map(conn => 
                conn.id === connection.id 
                  ? { ...conn, expanded: !conn.expanded } 
                  : conn
              )
            );
          }}
        >
          <View style={styles.groupHeaderLeft}>
            <Ionicons 
              name={connection.expanded ? "chevron-down-outline" : "chevron-forward-outline"} 
              size={18} 
              color="#666" 
            />
            <Text style={styles.connectionTypeText}>
              {t(`connections:types.${connection.type}`)} 
              <Text style={styles.groupCount}>({connectionCount} {nodeType.toLowerCase()}s)</Text>
            </Text>
          </View>
          
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation(); // Prevent triggering the parent onPress
              handleDeleteGroupConnection(connection);
            }} 
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
          </TouchableOpacity>
        </TouchableOpacity>
        
        {connection.description ? (
          <Text style={styles.connectionDescription}>{connection.description}</Text>
        ) : null}
        
        {/* Display connected node info based on its type */}
        {sampleNode && (
          <View style={styles.connectedNodeInfo}>
            <Text style={styles.nodeTypeBadge}>
              {nodeType}
            </Text>
            <Text style={styles.verseReference}>
              {nodeDisplayName}
              <Text style={styles.sampleLabel}> ({t('verseDetail:sampleNode')})</Text>
            </Text>
            {nodeDetails ? (
              <Text style={styles.verseText} numberOfLines={2} ellipsizeMode="tail">
                {nodeDetails}
              </Text>
            ) : null}
          </View>
        )}
        
        {/* Expanded section with all group connections */}
        {connection.expanded && connection.groupedConnections && connection.groupedConnections.length > 0 && (
          <View style={styles.expandedGroupContent}>
            <Text style={styles.expandedGroupTitle}>{t('verseDetail:allGroupedConnections')}:</Text>
            {connection.groupedConnections.map(groupConn => {
              // For each connection in group, determine the node to display
              const isOutgoing = groupConn.sourceVerseId === verse?.id;
              const connectedId = isOutgoing ? groupConn.targetVerseId : groupConn.sourceVerseId;
              
              return (
                <TouchableOpacity
                  key={groupConn.id}
                  style={styles.groupedVerseItem}
                  onPress={() => handleNodePress(connectedId, nodeType)}
                >
                  <Text style={styles.groupedVerseReference}>
                    {nodeType === 'VERSE' ? connectedId.replace(/-/g, ' ') : connectedId}
                    {groupConn.description ? `: ${groupConn.description}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };
  
  // Function to handle pressing on a node (verse, note, tag, etc.)
  const handleNodePress = (nodeId: string, nodeType: NodeType) => {
    if (nodeType === 'VERSE') {
      navigation.navigate('VerseDetail', { verseId: nodeId, activeTab: 'connections' });
    } else if (nodeType === 'NOTE') {
      // Navigate to note detail screen if you have one
      Alert.alert('Note', `Navigate to note with ID: ${nodeId}`);
    } else if (nodeType === 'TAG') {
      // Navigate to tag detail or filtered results
      Alert.alert('Tag', `Show verses with tag ID: ${nodeId}`);
    } else if (nodeType === 'TOPIC') {
      // Navigate to topic detail
      Alert.alert('Topic', `Show topic with ID: ${nodeId}`);
    }
  };

  const renderConnectionsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.connectionActions}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowMultiConnectionSelector(!showMultiConnectionSelector)}
        >
          <Text style={styles.addButtonText}>
            {showMultiConnectionSelector ? t('common:cancel') : t('verseDetail:addMultipleConnections')}
          </Text>
          <Ionicons
            name={showMultiConnectionSelector ? "close-circle" : "add-circle"}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
        
        {!showMultiConnectionSelector && connections.length > 0 && (
          <TouchableOpacity
            style={styles.labelToggleButton}
            onPress={() => toggleLabels(!showLabels)}
          >
            <Text style={styles.labelToggleText}>
              {showLabels ? t('verseDetail:hideLabels') : t('verseDetail:showLabels')}
            </Text>
            <Ionicons
              name={showLabels ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#007AFF"
            />
          </TouchableOpacity>
        )}
      </View>
      
      {showMultiConnectionSelector && verse ? (
        <View style={styles.multiConnectionContainer}>
          <Text style={styles.multiConnectionHint}>{t('verseDetail:multiConnectionHint')}</Text>
          <View style={styles.separator} />
          <MultiConnectionSelector
            targetVerseId={verse.id}
            targetVerse={verse}
            onConnectionsCreated={handleConnectionsCreated}
          />
        </View>
      ) : (
        <>
          {connections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('verseDetail:noConnections')}</Text>
              <Text style={styles.emptyHint}>{t('verseDetail:addConnectionHint')}</Text>
            </View>
          ) : (
            <FlatList
              data={connections}
              keyExtractor={(item) => `connection-${item.id}-${item.sourceVerseId}-${item.targetVerseId}`}
              renderItem={renderConnectionItem}
              
            />
          )}
        </>
      )}
    </View>
  );

  // Add a function to toggle the verse group selector
  const toggleGroupSelector = () => {
    setIsGroupSelectorVisible(!isGroupSelectorVisible);
  };

  // Add a function to handle selecting a verse group
  const handleGroupSelect = (groupId: string) => {
    navigation.navigate('GroupDetail', { groupId });
  };

  // Add a function to handle creating a new verse group
  const handleCreateGroup = (group: VerseGroup) => {
    showNotification(t('verseDetail:groupCreated'));
    setIsGroupSelectorVisible(false);
    // Optionally navigate to the new group
    navigation.navigate('GroupDetail', { groupId: group.id });
  };

  // Add a function to show notifications
  const showNotification = (message: string) => {
    Alert.alert('', message);
  };

  // Function to handle deleting a group connection
  const handleDeleteGroupConnection = async (connection: ConnectionWithVerse) => {
    try {
      Alert.alert(
        t('common:confirm'),
        t('verseDetail:confirmDeleteGroupConnection').replace('{count}', 
          String(connection.connectedVerseCount || 0)),
        [
          { text: t('common:cancel'), style: 'cancel' },
          {
            text: t('common:delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                // Get current user for ownership
                const currentUser = await AuthService.getCurrentUser();
                
                // Delete all individual connections in the group
                if (connection.groupedConnections && connection.groupedConnections.length > 0) {
                  for (const conn of connection.groupedConnections) {
                    await DatabaseService.deleteConnection(conn.id, currentUser?.id);
                  }
                }
                
                // Update the connections state to remove this group
                setConnections(prev => prev.filter(c => c.id !== connection.id));
                
                // Show success message
                Alert.alert(t('common:success'), t('verseDetail:groupConnectionDeleted'));
              } catch (error) {
                console.error('Error deleting group connection:', error);
                Alert.alert(t('common:error'), t('verseDetail:failedToDeleteConnection'));
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error displaying delete confirmation:', error);
    }
  };

  // Add function for adding new notes via modal
  const handleAddNoteViaModal = async () => {
    // Get current user for ownership
    const currentUser = await AuthService.getCurrentUser();
    
    // Create a temporary note object
    const tempNote: Note = {
      id: 'temp-' + Date.now(),
      verseId: verse?.id || '',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: currentUser?.id
    };
    
    setCurrentNote(tempNote);
    setNoteModalVisible(true);
  };

  // Update the handleSaveNoteFromModal function to trigger animation
  const handleSaveNoteFromModal = async (content: string, tags: string[], noteId?: string, isNew?: boolean) => {
    try {
      // Get current user for ownership
      const currentUser = await AuthService.getCurrentUser();
      
      // Check if this is a new note by checking for temp- prefix in the ID
      const isNewNote = !noteId || noteId.startsWith('temp-') || isNew === true;
      
      if (!isNewNote) {
        // Editing existing note
        await DatabaseService.updateNote(noteId, {
          content,
          tags,
        }, currentUser?.id);
        
        // Update local notes state
        setNotes(prevNotes => 
          prevNotes.map(note => 
            note.id === noteId ? { ...note, content, tags } : note
          )
        );
        
        // Set it as recently updated for animation
        setRecentlyUpdatedNote(noteId);
        
        // Try to update the note in the NotesScreen if it's in the navigation stack
        const notesScreen = getNotesScreenRef();
        if (notesScreen) {
          notesScreen.updateSingleNote(noteId, false);
        }
      } else {
        // Creating new note with user ID for ownership
        const newNote = await DatabaseService.createNote(verse!.id, content, tags, currentUser?.id);
        
        // Add to local notes state
        setNotes(prevNotes => [newNote, ...prevNotes]);
        
        // Set it as recently updated for animation
        setRecentlyUpdatedNote(newNote.id);
        
        // Try to update the NotesScreen if it's in the navigation stack
        const notesScreen = getNotesScreenRef();
        if (notesScreen) {
          notesScreen.updateSingleNote(newNote.id, true);
        }
      }
      
      // Close the modal after saving is complete
      setNoteModalVisible(false);
      setCurrentNote(null);
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert(t('common:error'), t('verseDetail:errorSavingNote'));
    }
  };
  
  // Helper function to get the NotesScreen ref if available
  const getNotesScreenRef = () => {
    // Navigate through the navigation hierarchy to find the NotesScreen
    try {
      // Try to get NotesScreen directly from tab navigation
      const mainNavigation = navigation.getParent();
      if (mainNavigation && mainNavigation.getState) {
        const mainState = mainNavigation.getState();
        
        // Look for the NotesScreen in the navigation state
        for (const route of mainState.routes) {
          if (route.name === 'Notes') {
            // Type assertion for the params
            const params = route.params as { notesScreenRef?: { updateSingleNote: (noteId: string, isNew: boolean) => void } };
            if (params?.notesScreenRef) {
              return params.notesScreenRef;
            }
          }
          
          // Check nested navigators like tabs
          if (route.name === 'MainTabs' && route.state) {
            const tabRoutes = route.state.routes;
            for (const tabRoute of tabRoutes) {
              if (tabRoute.name === 'Notes') {
                // Type assertion for nested params
                const params = tabRoute.params as { notesScreenRef?: { updateSingleNote: (noteId: string, isNew: boolean) => void } };
                if (params?.notesScreenRef) {
                  return params.notesScreenRef;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.debug('Could not find NotesScreen reference:', error);
    }
    
    return null;
  };

  // Add toggle function for note expansion
  const toggleNoteExpansion = (noteId: string) => {
    setExpandedNotes(prev => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  // Check if text is truncated by its length
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
    setWebViewUrl(url);
    setIsWebViewVisible(true);
  };

  // Function to create clickable text with URLs
  const renderTextWithClickableUrls = (text: string) => {
    const urls = detectUrls(text);
    if (!urls) return text;

    // Split by URLs but preserve them in the result
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    
    return (
      <>
        {parts.map((part, index) => {
          // Check if this part is a URL
          if (urls.includes(part)) {
            return (
              <Text 
                key={index}
                style={styles.urlText}
                onPress={() => handleUrlClick(part)}
              >
                {part}
              </Text>
            );
          }
          // Regular text
          return <Text key={index}>{part}</Text>;
        })}
      </>
    );
  };

  // Update the renderNoteItem to match NotesScreen style and animations
  const renderNoteItem = (note: Note) => {
    const isExpanded = expandedNotes[note.id] || false;
    const shouldTruncate = isTextTruncated(note.content);
    const containsUrls = hasUrls(note.content);
    
    // Check if this item should be animated
    const isRecentlyUpdated = recentlyUpdatedNote === note.id;
    
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
    const isStandaloneUrl = note.content.trim().match(/^https?:\/\/[^\s]+/);
    
    return (
      <Animated.View 
        key={`note-${note.id || note.content.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)}`}
        style={[
          styles.noteItem,
          { backgroundColor },
          // On web, we need to use style directly since Animated.View interpolation doesn't work well
          Platform.OS === 'web' && isRecentlyUpdated ? 
            { backgroundColor: recentlyUpdatedNote ? '#e6f7ff' : '#ffffff' } : null
        ]}
      >
        <View>
          {/* Special case for notes that are just URLs */}
          {isStandaloneUrl ? (
            <TouchableOpacity onPress={() => handleUrlClick(isStandaloneUrl[0])}>
              <Text style={[styles.noteContent, styles.urlText]} numberOfLines={isExpanded ? undefined : 3}>
                {note.content}
              </Text>
            </TouchableOpacity>
          ) : (
            <View>
              {isExpanded ? (
                <>
                  <Text style={styles.noteContent}>
                    {renderTextWithClickableUrls(note.content)}
                  </Text>
                  {containsUrls && renderUrlButtons(note.content)}
                  {showToggleButton && (
                    <TouchableOpacity 
                      style={styles.toggleButton}
                      onPress={() => toggleNoteExpansion(note.id)}
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
                    {note.content}
                  </Text>
                  {showToggleButton && (
                    <TouchableOpacity 
                      style={styles.toggleButton}
                      onPress={() => toggleNoteExpansion(note.id)}
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
        </View>
        
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
      </Animated.View>
    );
  };

  // Helper function to extract and render URL buttons (copied from NotesScreen)
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

  // Add a useEffect hook to set up header options with custom back button behavior
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          style={{ marginLeft: 16 }}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Add this useEffect to set the active bottom tab based on navigation source
  useEffect(() => {
    // Set the active bottom tab based on the screen tab user is coming from
    if (route.params?.activeTab === 'notes') {
      setActiveBottomTab('Notes');
    } else if (route.params?.activeTab === 'connections') {
      // If user is viewing connections, they're likely coming from GraphView
      setActiveBottomTab('Graph');
    }
  }, [route.params?.activeTab]);

  // Updated showVisualizationOptions function
  const showVisualizationOptions = () => {
    // Set the active bottom tab
    setActiveBottomTab('Graph');
    
    // Show custom visualization modal
    setShowVisualizationModal(true);
  };

  // Add this to filter notes based on search query and selected tags
  const getFilteredNotes = useCallback(() => {
    if (!searchQuery && selectedTags.length === 0) {
      return notes; // Return all notes if no filters applied
    }
    
    return notes.filter(note => {
      // Filter by search query
      const matchesQuery = !searchQuery || 
        note.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter by selected tags
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.every(tag => note.tags?.includes(tag));
      
      return matchesQuery && matchesTags;
    });
  }, [notes, searchQuery, selectedTags]);

  // Add this function to handle tag selection/deselection
  const toggleTagFilter = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag));
    } else {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  // Add this function to clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
  };

  const loadVerseConnections = async (verseId: string) => {
    try {
      // Get current user for ownership
      const currentUser = await AuthService.getCurrentUser();
      
      const connectionsData = await DatabaseService.getConnectionsForVerse(verseId, currentUser?.id);
      
      // Process connections to include connected verse data
      const connectionsWithVerses: ConnectionWithVerse[] = [];
      
      for (const connection of connectionsData) {
        const connectedVerseId = connection.sourceVerseId === verseId
          ? connection.targetVerseId
          : connection.sourceVerseId;
          
        const connectedVerse = await DatabaseService.getVerse(connectedVerseId);
        
        connectionsWithVerses.push({
          ...connection,
          connectedVerse,
          expanded: false
        });
      }
      
      setConnections(connectionsWithVerses);
    } catch (error) {
      console.error('Error loading verse connections:', error);
    }
  };

  // Add a function to toggle a connection's ownership (public/private)
  const toggleConnectionOwnership = async (connection: ConnectionWithVerse) => {
    try {
      // Get current user for ownership check
      const currentUser = await AuthService.getCurrentUser();
      
      // Only allow toggling ownership if the user owns the connection
      if (!currentUser || connection.userId !== currentUser.id) {
        Alert.alert(
          t('common:error'),
          t('verseDetail:cannotChangeOwnership')
        );
        return;
      }
      
      // Toggle ownership between PUBLIC and PRIVATE
      const newOwnership = connection.ownership === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
      
      // Update the connection
      const updatedConnection = await DatabaseService.updateConnection(
        connection.id,
        { ownership: newOwnership },
        currentUser.id
      );
      
      // Update the connections in state
      setConnections(prev => 
        prev.map(conn => 
          conn.id === connection.id 
            ? { ...conn, ownership: newOwnership } 
            : conn
        )
      );
      
      // Show success message
      showNotification(t('verseDetail:ownershipChanged', { status: newOwnership.toLowerCase() }));
    } catch (error) {
      console.error('Error toggling connection ownership:', error);
      showNotification(t('verseDetail:failedToChangeOwnership'));
    }
  };

  // Add UI component to render ownership badge
  const renderOwnershipBadge = (connection: ConnectionWithVerse) => {
    // Get current user to check if they own this connection
    const currentUser = currentUserRef.current;
    const isOwner = currentUser && connection.userId === currentUser.id;
    
    if (!isOwner) return null;
    
    const isPrivate = connection.ownership === 'PRIVATE';
    
    return (
      <TouchableOpacity
        style={[
          styles.ownershipBadge, 
          isPrivate ? styles.privateBadge : styles.publicBadge
        ]}
        onPress={() => toggleConnectionOwnership(connection)}
      >
        <Ionicons 
          name={isPrivate ? 'lock-closed' : 'globe'} 
          size={12} 
          color={isPrivate ? '#ffffff' : '#ffffff'} 
          style={styles.ownershipIcon}
        />
        <Text style={styles.ownershipText}>
          {isPrivate ? t('verseDetail:private') : t('verseDetail:public')}
        </Text>
      </TouchableOpacity>
    );
  };

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header Section */}
      <View style={styles.fixedHeaderContainer}>
        <View style={styles.verseHeader}>
          <Text style={styles.reference}>
            {verse.book} {verse.chapter}:{verse.verse}
          </Text>
        </View>
        <View style={styles.verseContent}>
          <Text style={styles.text}>{verse.text}</Text>
          <Text style={styles.translation}>{verse.translation}</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'notes' && styles.activeTabButton
            ]}
            onPress={() => setActiveTab('notes')}
          >
            <Ionicons 
              name="book" 
              size={20} 
              color={activeTab === 'notes' ? '#007AFF' : '#666'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'notes' && styles.activeTabText
            ]}>
              {t('verseDetail:notes')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'connections' && styles.activeTabButton
            ]}
            onPress={() => setActiveTab('connections')}
          >
            <Ionicons 
              name="git-network" 
              size={20} 
              color={activeTab === 'connections' ? '#007AFF' : '#666'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'connections' && styles.activeTabText
            ]}>
              {t('verseDetail:connections')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notes section header - fixed in place */}
        {activeTab === 'notes' && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('verseDetail:notes')}</Text>
            <TouchableOpacity 
              style={styles.addNoteButton}
              onPress={handleAddNoteViaModal}
            >
              <Ionicons name="add-circle" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Scrollable Content Section */}
      <ScrollView style={styles.scrollableContent}>
        {/* Notes Tab Content */}
        {activeTab === 'notes' && (
          <View style={styles.section}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('common:searchNotes')}
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              
              {(searchQuery.length > 0 || selectedTags.length > 0) && (
                <TouchableOpacity 
                  style={styles.clearFiltersButton} 
                  onPress={clearFilters}
                >
                  <Text style={styles.clearFiltersText}>{t('common:clearFilters')}</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Tags Filtering */}
            {allTags.length > 0 && (
              <ScrollView 
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tagsScrollContainer}
                contentContainerStyle={styles.tagsContainer}
              >
                {allTags.map(tag => (
                  <TouchableOpacity
                    key={`filter-${tag}`}
                    style={[
                      styles.tagFilterChip,
                      selectedTags.includes(tag) && styles.tagFilterChipSelected
                    ]}
                    onPress={() => toggleTagFilter(tag)}
                  >
                    <Text 
                      style={[
                        styles.tagFilterText,
                        selectedTags.includes(tag) && styles.tagFilterTextSelected
                      ]}
                    >
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            {/* Notes List */}
            {getFilteredNotes().length > 0 ? (
              getFilteredNotes().map((note, index) => (
                <React.Fragment key={`note-${note.id || index}`}>
                  {renderNoteItem(note)}
                </React.Fragment>
              ))
            ) : (
              <View style={styles.emptyFilterContainer}>
                {notes.length > 0 ? (
                  <>
                    <Ionicons name="filter" size={24} color="#999" />
                    <Text style={styles.emptyFilterText}>{t('verseDetail:noMatchingNotes')}</Text>
                  </>
                ) : (
                  <Text style={styles.emptyNotesText}>{t('verseDetail:noNotesYet')}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Connections Tab Content */}
        {activeTab === 'connections' && (
          renderConnectionsTab()
        )}
      </ScrollView>
      
      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, globalStyles.tabBar]}>
        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => {
            setActiveBottomTab('Home');
            navigation.navigate('MainTabs', { screen: 'Home' });
          }}
        >
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: theme.spacing.xs,
          }}>
            <Ionicons 
              name="home-outline" 
              size={24} 
              color={activeBottomTab === 'Home' ? theme.colors.primary : theme.colors.textSecondary} 
            />
            {activeBottomTab === 'Home' && (
              <View style={globalStyles.tabBarDot} />
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => {
            console.log('Visualization button pressed');
            showVisualizationOptions();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: theme.spacing.xs,
          }}>
            <Ionicons 
              name="logo-electron" 
              size={24} 
              color={activeBottomTab === 'Graph' ? theme.colors.primary : theme.colors.textSecondary} 
            />
            {activeBottomTab === 'Graph' && (
              <View style={globalStyles.tabBarDot} />
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => {
            setActiveBottomTab('Notes');
            navigation.navigate('MainTabs', { screen: 'Notes' });
          }}
        >
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: theme.spacing.xs,
          }}>
            <Ionicons 
              name="document-text-outline" 
              size={24} 
              color={activeBottomTab === 'Notes' ? theme.colors.primary : theme.colors.textSecondary} 
            />
            {activeBottomTab === 'Notes' && (
              <View style={globalStyles.tabBarDot} />
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => {
            setActiveBottomTab('Profile');
            navigation.navigate('MainTabs', { screen: 'Profile' });
          }}
        >
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: theme.spacing.xs,
          }}>
            <Ionicons 
              name="person-outline" 
              size={24} 
              color={activeBottomTab === 'Profile' ? theme.colors.primary : theme.colors.textSecondary} 
            />
            {activeBottomTab === 'Profile' && (
              <View style={globalStyles.tabBarDot} />
            )}
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Add the verse group selector modal */}
      <Modal
        visible={isGroupSelectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsGroupSelectorVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('verseDetail:verseGroups')}</Text>
              <TouchableOpacity onPress={() => setIsGroupSelectorVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <VerseGroupSelector
              selectedVerses={[verse]}
              onSelect={handleGroupSelect}
              onCreateGroup={handleCreateGroup}
            />
          </View>
        </View>
      </Modal>

      {/* Add Note Editor Modal */}
      <NoteEditorModal
        visible={noteModalVisible}
        note={currentNote}
        onClose={() => setNoteModalVisible(false)}
        onSave={handleSaveNoteFromModal}
      />

      {/* Add WebView Modal */}
      <WebViewModal
        visible={isWebViewVisible}
        url={webViewUrl}
        onClose={() => setIsWebViewVisible(false)}
        id="verse-detail-webview"
      />

      {/* Custom Visualization Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showVisualizationModal}
        onRequestClose={() => setShowVisualizationModal(false)}
      >

        <Pressable 
          style={styles.visualizationModalOverlay} 
          onPress={() => setShowVisualizationModal(false)}
        >
      
          <View style={styles.visualizationModalContent}>
            <View style={styles.visualizationModalHeader}>
              <Text style={styles.visualizationModalTitle}>{t('visualization:title')}</Text>
              <TouchableOpacity onPress={() => setShowVisualizationModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.visualizationOptionButton}
              onPress={() => {
                setShowVisualizationModal(false);
                navigation.navigate('GraphView', { verseId: verse?.id });
              }}
            >
              <Ionicons name="git-pull-request-outline" size={24} color="#007AFF" />
              <Text style={styles.visualizationOptionLabel}>{t('visualization:graph')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.visualizationOptionButton}
              onPress={() => {
                setShowVisualizationModal(false);
                navigation.navigate('MindMap', { verseId: verse?.id });
              }}
            >
              <Ionicons name="map-outline" size={24} color="#007AFF" />
              <Text style={styles.visualizationOptionLabel}>{t('visualization:mindMap')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  fixedHeaderContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  scrollableContent: {
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
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  verseContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  homeButton: {
    marginRight: 12,
    padding: 4,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  labelToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  labelToggleText: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 8,
  },
  noteItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  noteContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '400',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  noteDate: {
    fontSize: 12,
    color: '#888',
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  noteActions: {
    flexDirection: 'row',
  },
  noteActionButton: {
    padding: 8,
    marginLeft: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 20,
  },
  noteTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 10,
  },
  noteTag: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  noteTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
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
  connectionItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    marginHorizontal: 12,
  },
  connectionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  connectionIconContainer: {
    marginRight: 8,
    paddingTop: 2,
  },
  connectionContent: {
    flex: 1,
    flexDirection: 'column',
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  connectionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  connectionVerseText: {
    fontSize: 13,
    color: '#333',
    marginTop: 2,
    marginBottom: 4,
    lineHeight: 18,
  },
  connectionLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  connectionTypeLabel: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  connectionDirectionLabel: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  protectedLabel: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  deleteConnectionButton: {
    padding: 4,
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
    marginBottom: 8,
  },
  addConnectionContainer: {
    marginVertical: 12,
  },
  addConnectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  addConnectionInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addConnectionButton: {
    marginLeft: 8,
    padding: 4,
  },
  connectionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  connectionTypeButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    alignItems: 'center',
    minWidth: 100,
  },
  multiConnectionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  multiConnectionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  connectionTypeButtonText: {
    color: '#333',
    fontSize: 12,
  },
  connectionTypeIcon: {
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  activeTabButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
  },
  actionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  groupedConnectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  groupedConnectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupedConnectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  groupCount: {
    fontWeight: 'normal',
    fontSize: 14,
  },
  groupConnectionItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  groupConnectionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  groupConnectionText: {
    fontSize: 14,
    color: '#333',
  },
  groupedConnectionItem: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    marginBottom: 12,
    marginHorizontal: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: '#5B8FF9',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 4,
  },
  connectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  connectedNodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nodeTypeBadge: {
    backgroundColor: '#5B8FF9',
    color: 'white',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  verseReference: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  sampleLabel: {
    fontSize: 12,
    color: '#999',
  },
  verseText: {
    fontSize: 14,
    color: '#666',
  },
  expandedGroupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  groupedVerseItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  groupedVerseReference: {
    fontSize: 14,
    color: '#666',
  },
  emptyNotesText: {
    color: '#888',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  border: {
    borderWidth: 1,
    borderRadius: 5,
    borderColor: '#555',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  manageTags: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
  },
  manageTagsText: {
    color: '#007AFF',
    fontSize: 14,
  },
  urlText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  manageTagsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  expandedGroupContent: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  tabContent: {
    flex: 1,
    padding: 8,
  },
  connectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  multiConnectionContainer: {
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  multiConnectionHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
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
    maxWidth: 200,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualizationModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizationModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  visualizationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  visualizationModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  visualizationOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  visualizationOptionLabel: {
    marginLeft: 16,
    fontSize: 16,
    color: '#007AFF',
  },
  searchContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  clearFiltersButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
  },
  clearFiltersText: {
    fontSize: 13,
    color: '#666',
  },
  tagsScrollContainer: {
    marginBottom: 12,
  },
  tagFilterChip: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tagFilterChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  tagFilterText: {
    fontSize: 13,
    color: '#666',
  },
  tagFilterTextSelected: {
    color: '#fff',
  },
  emptyFilterContainer: {
    alignItems: 'center',
    padding: 24,
  },
  emptyFilterText: {
    marginTop: 8,
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
  },
  ownershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  ownershipIcon: {
    marginRight: 4,
  },
  ownershipText: {
    fontSize: 12,
    color: '#666',
  },
  privateBadge: {
    backgroundColor: '#FF4500',
  },
  publicBadge: {
    backgroundColor: '#7CFC00',
  },
});

export default VerseDetailScreen; 
