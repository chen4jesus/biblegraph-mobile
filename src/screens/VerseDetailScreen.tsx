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
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { Verse, Note, Connection, ConnectionType } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { Ionicons } from '@expo/vector-icons';

type VerseDetailScreenRouteProp = RouteProp<RootStackParamList, 'VerseDetail'>;

const VerseDetailScreen: React.FC = () => {
  const route = useRoute<VerseDetailScreenRouteProp>();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [newNote, setNewNote] = useState('');
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
      Alert.alert('Error', 'Failed to add note');
    }
  };

  const handleAddConnection = async (targetVerseId: string, type: ConnectionType) => {
    if (!verse) return;

    try {
      const connection: Connection = {
        id: Date.now().toString(),
        sourceVerseId: verse.id,
        targetVerseId,
        type,
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await neo4jService.createConnection(connection);
      setConnections([...connections, connection]);
    } catch (error) {
      console.error('Error adding connection:', error);
      Alert.alert('Error', 'Failed to add connection');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!verse) {
    return (
      <View style={styles.errorContainer}>
        <Text>Verse not found</Text>
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
          <Text style={styles.sectionTitle}>Notes</Text>
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
              placeholder="Add a note..."
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
          <Text style={styles.sectionTitle}>Connections</Text>
          {connections.map((connection) => (
            <TouchableOpacity
              key={connection.id}
              style={styles.connectionItem}
              onPress={() => {
                // Navigate to connected verse
              }}
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
              <Text style={styles.connectionType}>
                {connection.type.toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  text: {
    fontSize: 18,
    lineHeight: 26,
    color: '#333',
    marginBottom: 8,
  },
  translation: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  noteItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  noteContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  addNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  noteInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    minHeight: 40,
  },
  addNoteButton: {
    padding: 8,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  connectionType: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
  },
});

export default VerseDetailScreen; 