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
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { Verse, Note, Connection, ConnectionType } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type VerseDetailScreenRouteProp = RouteProp<RootStackParamList, 'VerseDetail'>;
type VerseDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const VerseDetailScreen: React.FC = () => {
  const { t } = useTranslation(['verseDetail', 'common']);
  const route = useRoute<VerseDetailScreenRouteProp>();
  const navigation = useNavigation<VerseDetailNavigationProp>();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [newNote, setNewNote] = useState('');
  const [targetVerseRef, setTargetVerseRef] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVerseDetails();
  }, [route.params.verseId]);

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
        setConnections(verseConnections);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading verse details:', error);
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !verse) return;

    try {
      const note = await neo4jService.createNote(verse.id, newNote);
      setNotes([...notes, note]);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert(t('common:error'), t('verseDetail:failedToAddNote'));
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
          {notes.map((note) => (
            <View key={note.id} style={styles.noteItem}>
              <Text style={styles.noteContent}>{note.content}</Text>
              <Text style={styles.noteDate}>
                {new Date(note.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('verseDetail:connections')}</Text>
          {connections.length === 0 ? (
            <Text style={styles.emptyMessage}>{t('verseDetail:noConnections')}</Text>
          ) : (
            connections.map((connection) => (
              <TouchableOpacity
                key={connection.id}
                style={styles.connectionItem}
                onPress={() => navigateToConnectedVerse(connection.targetVerseId)}
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
                  color="#007AFF"
                />
                <Text style={styles.connectionText}>{connection.targetVerseId}</Text>
              </TouchableOpacity>
            ))
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
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
    marginTop: 4,
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
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  connectionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
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
});

export default VerseDetailScreen; 