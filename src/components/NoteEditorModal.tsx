import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Note } from '../types/bible';
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
    if (visible && note) {
      setContent(note.content || '');
      setTags(note.tags || []);
      // Focus input after a short delay to ensure it's visible
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (visible && !note) {
      // For new notes
      setContent('');
      setTags([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, note]);

  const handleSave = () => {
    if (!content.trim()) {
      Alert.alert(t('common:error'), t('verseDetail:noteContentRequired'));
      return;
    }
    
    // Pass the noteId and isNew flag to the onSave handler
    onSave(content, tags, note?.id, !note);
  };

  // Simplified cancel handler that directly closes the modal
  const handleCancel = () => {
    // Check for unsaved changes
    const hasUnsavedChanges = note ? 
      (content !== note.content || JSON.stringify(tags) !== JSON.stringify(note.tags)) :
      (content.trim() || tags.length > 0);
    
    if (hasUnsavedChanges) {
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
            onPress: () => {
              console.debug("Discarding changes and closing modal");
              onClose();
            },
            style: 'destructive'
          }
        ]
      );
    } else {
      console.debug("No changes to discard, closing modal");
      onClose();
    }
  };

  // Create separate direct close handler
  const handleDirectClose = () => {
    console.debug("Direct close triggered");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          onPress={handleCancel}
          activeOpacity={1}
        >
          <TouchableOpacity 
            style={styles.modalContainer}
            onPress={(e) => e.stopPropagation()} 
            activeOpacity={1}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {note ? t('verseDetail:editNote') : t('verseDetail:addNote')}
              </Text>
              <TouchableOpacity 
                onPress={handleDirectClose} 
                style={styles.closeButton}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Ionicons name="close" size={24} color="#666" />
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
                <TagSelector 
                  selectedTags={tags}
                  onTagsChange={setTags}
                  label=""
                />
              </View>
            </View>
            
            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleDirectClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>
                  {t('common:cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.saveButton, 
                  !content.trim() && styles.disabledButton
                ]}
                onPress={handleSave}
                disabled={!content.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>{t('common:save')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 48,
  },
  modalContainer: {
    width: '95%',
    maxHeight: '85%',
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
    padding: 10,
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
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NoteEditorModal; 