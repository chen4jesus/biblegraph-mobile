import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  Pressable,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Note, Tag } from '../types/bible';
import TagSelector from './TagSelector';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { neo4jService } from '../services/neo4j';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type NoteEditorNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface NoteEditorModalProps {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: (content: string, tags: string[], noteId?: string, isNew?: boolean) => void;
}

const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  visible,
  note,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation(['verseDetail', 'common']);
  const navigation = useNavigation<NoteEditorNavigationProp>();
  const isFocused = useIsFocused();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  
  // Add a state to track if any inner modal is open
  const [isTagSelectorModalOpen, setIsTagSelectorModalOpen] = useState(false);

  // Register back handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        if (isTagSelectorModalOpen) {
          // Let TagSelector handle its own back press
          return false;
        }
        handleCancel();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [visible, isTagSelectorModalOpen]);

  // Keyboard listeners to adjust layout
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Initialize state when modal becomes visible or note changes
  useEffect(() => {
    if (visible) {
      loadTags();
      
      if (note) {
        setContent(note.content || '');
        setTags(note.tags || []);
        // Focus input after a short delay to ensure it's visible
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        // For new notes
        setContent('');
        setTags([]);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [visible, note]);

  // Load all tags from the database
  const loadTags = async () => {
    try {
      setIsLoadingTags(true);
      const fetchedTags = await neo4jService.getTags();
      setAllTags(fetchedTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  // Monitor tag selector modal state
  const handleTagSelectorModalOpen = useCallback(() => {
    setIsTagSelectorModalOpen(true);
  }, []);

  const handleTagSelectorModalClose = useCallback(() => {
    setIsTagSelectorModalOpen(false);
  }, []);

  const handleTagsChange = useCallback((newTags: string[]) => {
    // Update tags state
    setTags(newTags);
    
    // Reload all tags to ensure new tags are properly reflected
    loadTags();
  }, []);

  const handleSave = useCallback(() => {
    if (!content.trim()) {
      Alert.alert(t('common:error'), t('verseDetail:noteContentRequired'));
      return;
    }
    
    // Pass the noteId and isNew flag to the onSave handler
    onSave(content, tags, note?.id, !note);
  }, [content, tags, note, onSave, t]);

  const handleCancel = useCallback(() => {
    // Don't allow closing if tag selector modal is open
    if (isTagSelectorModalOpen) {
      return;
    }
    
    // Confirm if there are unsaved changes
    if (note && (content !== note.content || JSON.stringify(tags) !== JSON.stringify(note.tags))) {
      Alert.alert(
        t('common:confirm'),
        t('verseDetail:discardChanges'),
        [
          { 
            text: t('common:cancel'), 
            style: 'cancel' 
          },
          {
            text: t('common:discard'),
            onPress: onClose,
            style: 'destructive'
          }
        ]
      );
    } else if (!note && (content.trim() || tags.length > 0)) {
      Alert.alert(
        t('common:confirm'),
        t('verseDetail:discardChanges'),
        [
          { 
            text: t('common:cancel'), 
            style: 'cancel' 
          },
          {
            text: t('common:discard'),
            onPress: onClose,
            style: 'destructive'
          }
        ]
      );
    } else {
      onClose();
    }
  }, [isTagSelectorModalOpen, note, content, tags, t, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {note ? t('verseDetail:editNote') : t('verseDetail:addNote')}
              </Text>
              <TouchableOpacity 
                onPress={handleCancel} 
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={isTagSelectorModalOpen}
              >
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={isTagSelectorModalOpen ? "#ccc" : "#666"} 
                />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <View style={styles.contentContainer}>
              <View style={styles.noteSection}>
                <Text style={styles.sectionTitle}>{t('verseDetail:myNote')}</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.noteInput}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  placeholder={t('verseDetail:enterNoteHere')}
                  placeholderTextColor="#aaa"
                  textAlignVertical="top"
                />
              </View>
              
              <View style={styles.tagsSection}>
                <Text style={styles.sectionTitle}>{t('verseDetail:tags')}</Text>
                
                {/* Tag Selector */}
                {isLoadingTags ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>{t('common:loading')}</Text>
                  </View>
                ) : (
                  <TagSelector 
                    selectedTags={tags}
                    onTagsChange={handleTagsChange}
                    label=""
                    tagList={allTags}
                    onModalOpen={handleTagSelectorModalOpen}
                    onModalClose={handleTagSelectorModalClose}
                  />
                )}
              </View>
            </View>
            
            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isTagSelectorModalOpen}
              >
                <Text style={[
                  styles.cancelButtonText,
                  isTagSelectorModalOpen && styles.disabledText
                ]}>
                  {t('common:cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.saveButton, 
                  (!content.trim() || isTagSelectorModalOpen) && styles.disabledButton
                ]}
                onPress={handleSave}
                disabled={!content.trim() || isTagSelectorModalOpen}
              >
                <Text style={styles.saveButtonText}>{t('common:save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '95%',
    height: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 6,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    overflow: 'scroll',
  },
  noteSection: {
    flex: 3,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#444',
  },
  noteInput: {
    flex: 1,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  tagsSection: {
    flex: 1,
    marginBottom: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    zIndex: 10,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  disabledText: {
    color: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
});

export default NoteEditorModal; 