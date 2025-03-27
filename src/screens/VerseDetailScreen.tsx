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
  Modal,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { Verse, Note, Connection, ConnectionType, VerseGroup, GroupConnection } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MultiConnectionSelector from '../components/MultiConnectionSelector';
import VerseGroupSelector from '../components/VerseGroupSelector';
import theme from 'theme';

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

// Add this type near the top of the file after the existing types
interface ConnectionWithVerse extends Connection {
  connectedVerse: Verse | null;
  isGrouped?: boolean; // Flag for grouped connections
  groupedConnections?: Connection[]; // Holds all connections in the group
  connectedVerseCount?: number; // How many verses are in this group
  isExpanded?: boolean; // Controls UI expansion state
}

const VerseDetailScreen: React.FC = () => {
  const { t } = useTranslation(['verseDetail', 'common']);
  const route = useRoute<VerseDetailScreenRouteProp>();
  const navigation = useNavigation<VerseDetailNavigationProp>();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [connections, setConnections] = useState<ConnectionWithVerse[]>([]);
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
  const [activeTab, setActiveTab] = useState<'notes' | 'connections'>(
    route.params.activeTab || 'notes'
  );
  const [showMultiConnectionSelector, setShowMultiConnectionSelector] = useState(false);
  const [isGroupSelectorVisible, setIsGroupSelectorVisible] = useState(false);

  useEffect(() => {
    loadVerseDetails();
    loadLabelPreference();
    
    // Update active tab if provided in route params
    if (route.params.activeTab) {
      setActiveTab(route.params.activeTab);
    }
  }, [route.params.verseId, route.params.activeTab]);

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
        
        // Process and group connections
        const uniqueConnectionsMap = new Map<string, Connection>();
        const groupedConnectionsMap = new Map<string, Connection[]>();
        
        // Group connections by their common source and target pattern
        // First, organize connections by source book/chapter and target book/chapter
        const connectionsBySourceAndTarget = new Map<string, Connection[]>();
        
        verseConnections.forEach(connection => {
          if (connection.groupConnectionId) {
            // If this connection already has a groupConnectionId, use it
            if (!groupedConnectionsMap.has(connection.groupConnectionId)) {
              groupedConnectionsMap.set(connection.groupConnectionId, []);
            }
            groupedConnectionsMap.get(connection.groupConnectionId)!.push(connection);
          } else {
            // For connections without a groupConnectionId, try to detect patterns
            // Like multiple connections from the same verse to sequential verses
            const sourceId = connection.sourceVerseId;
            const targetId = connection.targetVerseId;
            
            // Parse verse IDs to check for sequential verses
            const sourceParts = sourceId.split('-');
            const targetParts = targetId.split('-');
            
            if (sourceParts.length >= 3 && targetParts.length >= 3) {
              const sourceBook = sourceParts[0];
              const sourceChapter = sourceParts[1];
              const targetBook = targetParts[0];
              const targetChapter = targetParts[1];
              
              // Group by source book/chapter and target book/chapter
              const groupKey = `${sourceBook}-${sourceChapter}-to-${targetBook}-${targetChapter}`;
              
              if (!connectionsBySourceAndTarget.has(groupKey)) {
                connectionsBySourceAndTarget.set(groupKey, []);
              }
              connectionsBySourceAndTarget.get(groupKey)!.push(connection);
            } else {
              // Handle regular connections as before
              const uniqueKey = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
              if (!uniqueConnectionsMap.has(uniqueKey) ||
                  new Date(connection.updatedAt) > new Date(uniqueConnectionsMap.get(uniqueKey)!.updatedAt)) {
                uniqueConnectionsMap.set(uniqueKey, connection);
              }
            }
          }
        });
        
        // Check each potential group to see if it should be grouped
        connectionsBySourceAndTarget.forEach((connections, groupKey) => {
          if (connections.length >= 3) {
            // If we have 3+ connections with the same source/target pattern, group them
            // Create a synthetic group ID
            const groupId = `auto-group-${groupKey}-${Date.now()}`;
            groupedConnectionsMap.set(groupId, connections);
          } else {
            // Otherwise, treat them as individual connections
            connections.forEach(connection => {
              const uniqueKey = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
              if (!uniqueConnectionsMap.has(uniqueKey) ||
                  new Date(connection.updatedAt) > new Date(uniqueConnectionsMap.get(uniqueKey)!.updatedAt)) {
                uniqueConnectionsMap.set(uniqueKey, connection);
              }
            });
          }
        });
        
        // Convert maps to arrays
        const regularConnections = Array.from(uniqueConnectionsMap.values()) as ConnectionWithVerse[];
        const groupedConnections = Array.from(groupedConnectionsMap.entries()).map(([groupId, connections]) => ({
          id: groupId,
          isGrouped: true,
          groupedConnections: connections,
          type: connections[0]?.type || ConnectionType.THEMATIC,
          description: connections[0]?.description || '',
          sourceVerseId: verseToDisplay.id, // Use current verse as reference
          targetVerseId: '', // This will be filled when fetching connected verses
          createdAt: connections[0]?.createdAt || new Date().toISOString(),
          updatedAt: connections[0]?.updatedAt || new Date().toISOString(),
        })) as ConnectionWithVerse[];
        
        // Combine regular and grouped connections
        const allConnections = [...regularConnections, ...groupedConnections];
        
        // Continue with fetching verse content for connections...
        const connectionsWithVerses = await Promise.all(
          allConnections.map(async (connection) => {
            if (connection.isGrouped) {
              // Handle grouped connection (first one is enough for display)
              const groupConns = (connection as any).groupedConnections || [];
              const firstConn = groupConns[0];
              if (firstConn) {
                const connectedVerseId = firstConn.targetVerseId === verseToDisplay.id ? 
                  firstConn.sourceVerseId : firstConn.targetVerseId;
                
                try {
                  const connectedVerse = await neo4jService.getVerse(connectedVerseId);
                  return {
                    ...connection,
                    connectedVerse,
                    connectedVerseCount: groupConns.length
                  };
                } catch (error) {
                  console.error(`Error fetching verse ${connectedVerseId}:`, error);
                  return {
                    ...connection,
                    connectedVerse: null
                  };
                }
              }
              return connection;
            } else {
              // Handle regular connection as before
              const isOutgoing = connection.sourceVerseId === verseToDisplay.id;
              const connectedVerseId = isOutgoing ? connection.targetVerseId : connection.sourceVerseId;
              
              try {
                const connectedVerse = await neo4jService.getVerse(connectedVerseId);
                return {
                  ...connection,
                  connectedVerse
                };
              } catch (error) {
                console.error(`Error fetching verse ${connectedVerseId}:`, error);
                return {
                  ...connection,
                  connectedVerse: null
                };
              }
            }
          })
        );
        
        setConnections(connectionsWithVerses);
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
        connectedVerse: targetVerse
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
    const isProtectedConnection = item.type === ConnectionType.PARALLEL && item.description === 'Consecutive verses';
    
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
                  : 'git-compare'
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
                <Text style={[styles.connectionTypeLabel, { backgroundColor: isOutgoing ? '#E1F0FF' : '#FFF5E6' }]}>
                  {item.type === ConnectionType.THEMATIC
                    ? t('verseDetail:thematic')
                    : item.type === ConnectionType.PROPHECY
                    ? t('verseDetail:prophecy')
                    : t('verseDetail:crossReference')}
                </Text>
                <Text style={[styles.connectionDirectionLabel, { backgroundColor: isOutgoing ? '#E1F0FF' : '#FFF5E6' }]}>
                  {isOutgoing ? t('verseDetail:connectsTo') : t('verseDetail:connectedBy')}
                </Text>
                {isProtectedConnection && (
                  <Text style={[styles.protectedLabel, { backgroundColor: '#E9FFF0' }]}>
                    {t('verseDetail:systemProtected')}
                  </Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        {!isProtectedConnection && (
          // Simplified delete button implementation
          <TouchableOpacity
            style={[styles.deleteConnectionButton, { padding: 12 }]}
            onPress={() => {
              console.log('Directly deleting connection with ID:', item.id);
              neo4jService.deleteConnection(item.id);
              console.log('Connection deleted from database');
              
              // Update the connections state to remove this connection
              setConnections(prev => prev.filter(c => c.id !== item.id));
              
              // Show success message
              showNotification(t('verseDetail:connectionDeleted'));
            }}
          >
            <Ionicons name="trash" size={26} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Add a new function to render grouped connections
  const renderGroupedConnection = (item: ConnectionWithVerse) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const groupedConnections = item.groupedConnections || [];
    const connectionColor = '#5B8FF9'; // Special color for grouped connections
    
    // Get the common book/chapter for displaying a better group title
    let groupTitle = t('verseDetail:groupedConnection');
    
    if (groupedConnections.length > 0) {
      // Extract target verse IDs
      const verseIds = groupedConnections.map(conn => {
        return conn.sourceVerseId === verse?.id ? conn.targetVerseId : conn.sourceVerseId;
      });
      
      // Parse the first verse ID to extract book/chapter
      const firstParts = verseIds[0].split('-');
      if (firstParts.length >= 3) {
        const book = firstParts[0];
        const chapter = firstParts[1];
        groupTitle = `${book} ${chapter}`;
      }
    }
    
    const toggleExpand = () => {
      setIsExpanded(!isExpanded);
    };
    
    const deleteGroupedConnection = async () => {
      try {
        console.log('Deleting group connection with ID:', item.id);
        
        // Confirm deletion
        Alert.alert(
          t('common:confirm'),
          t('verseDetail:confirmDeleteGroupConnection').replace('{count}', 
            String(groupedConnections.length)),
          [
            { text: t('common:cancel'), style: 'cancel' },
            {
              text: t('common:delete'),
              style: 'destructive',
              onPress: async () => {
                try {
                  // Delete all connections in the group
                  for (const conn of groupedConnections) {
                    await neo4jService.deleteConnection(conn.id);
                  }
                  
                  // Update local state
                  setConnections(prevConnections => 
                    prevConnections.filter(conn => conn.id !== item.id)
                  );
                  
                  showNotification(t('verseDetail:groupConnectionDeleted'));
                } catch (error) {
                  console.error('Error deleting group connection:', error);
                  showNotification(t('verseDetail:failedToDeleteConnection'));
                }
              }
            }
          ]
        );
      } catch (error) {
        console.error('Error displaying delete confirmation:', error);
      }
    };
    
    return (
      <View style={styles.groupedConnectionContainer}>
        <View style={styles.groupedConnectionHeader}>
          <TouchableOpacity 
            style={styles.groupedConnectionToggle}
            onPress={toggleExpand}
          >
            <Ionicons 
              name={isExpanded ? "chevron-down" : "chevron-forward"} 
              size={22} 
              color={connectionColor} 
            />
            <Text style={[styles.groupedConnectionTitle, {color: connectionColor}]}>
              {groupTitle}
              <Text style={styles.groupCount}> ({groupedConnections.length} verses)</Text>
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.deleteConnectionButton}
            onPress={deleteGroupedConnection}
          >
            <Ionicons name="trash" size={26} color="#FF3B30" />
          </TouchableOpacity>
        </View>
        
        {isExpanded && (
          <View style={styles.expandedGroupContent}>
            {groupedConnections.map((conn, index) => {
              const isOutgoing = conn.sourceVerseId === verse?.id;
              const connectedVerseId = isOutgoing ? conn.targetVerseId : conn.sourceVerseId;
              
              // Format the verse reference for better display
              let formattedReference = connectedVerseId;
              const parts = connectedVerseId.split('-');
              if (parts.length >= 3) {
                formattedReference = `${parts[0]} ${parts[1]}:${parts[2]}`;
              }
              
              return (
                <TouchableOpacity
                  key={`group-conn-${conn.id}`}
                  style={styles.groupConnectionItem}
                  onPress={() => navigateToConnectedVerse(connectedVerseId)}
                >
                  <View style={styles.groupConnectionDetails}>
                    <Ionicons 
                      name={isOutgoing ? "arrow-forward" : "arrow-back"}
                      size={16}
                      color={connectionColor}
                      style={{marginRight: 8}}
                    />
                    <Text style={styles.groupConnectionText}>
                      {formattedReference}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
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

        {/* Notes Tab Content */}
        {activeTab === 'notes' && (
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
        )}

        {/* Connections Tab Content */}
        {activeTab === 'connections' && (
          renderConnectionsTab()
        )}
      </ScrollView>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={toggleGroupSelector}
        >
          <Text style={styles.actionButtonText}>{t('verseDetail:manageGroups')}</Text>
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
    minHeight: 200,
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
  },
  activeTabButton: {
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  connectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  addButtonText: {
    fontSize: 14,
    color: '#fff',
    marginRight: 8,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  singleConnectionSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 10,
  },
  multiConnectionContainer: {
    padding: 16,
  },
  multiConnectionHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#fff',
    marginRight: 8,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    marginTop: 50,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeButton: {
    fontSize: 20,
    color: theme.colors.text,
    padding: 4,
  },
  groupedConnectionContainer: {
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
  expandedGroupContent: {
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  groupedConnectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
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
});

export default VerseDetailScreen; 