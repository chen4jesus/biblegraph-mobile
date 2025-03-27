import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Note } from '../types/bible';

interface NoteEditorModalProps {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: (content: string, tags: string[]) => void;
  availableTags: string[];
}

const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  visible,
  note,
  onClose,
  onSave,
  availableTags,
}) => {
  const { t } = useTranslation(['verseDetail', 'common']);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagOptions, setShowTagOptions] = useState(false);

  // Initialize state when modal becomes visible or note changes
  useEffect(() => {
    if (visible && note) {
      setContent(note.content || '');
      setTags(note.tags || []);
    } else if (visible && !note) {
      // For new notes
      setContent('');
      setTags([]);
    }
  }, [visible, note]);

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    
    if (!tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
    }
    setTagInput('');
    setShowTagOptions(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSelectExistingTag = (tagToAdd: string) => {
    if (!tags.includes(tagToAdd)) {
      setTags([...tags, tagToAdd]);
    }
    setTagInput('');
    setShowTagOptions(false);
  };

  const handleSave = () => {
    if (!content.trim()) {
      Alert.alert(t('common:error'), t('verseDetail:noteContentRequired'));
      return;
    }
    
    onSave(content, tags);
  };

  const handleCancel = () => {
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
  };

  const getTagColor = (tag: string) => {
    // Simple hash function to generate colors based on tag text
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colorOptions = [
      '#3498db', // Blue
      '#2ecc71', // Green
      '#e74c3c', // Red
      '#9b59b6', // Purple
      '#e67e22', // Orange
      '#1abc9c', // Teal
      '#f1c40f', // Yellow
    ];
    
    const index = Math.abs(hash) % colorOptions.length;
    return colorOptions[index];
  };

  // Filter available tags based on input
  const filteredTags = tagInput.trim() 
    ? availableTags.filter(
        tag => tag.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(tag)
      )
    : availableTags.filter(tag => !tags.includes(tag));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {note ? t('verseDetail:editNote') : t('verseDetail:addNote')}
              </Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <Text style={styles.sectionTitle}>{t('verseDetail:myNote')}</Text>
              <TextInput
                style={styles.noteInput}
                value={content}
                onChangeText={setContent}
                multiline
                placeholder={t('verseDetail:enterNoteHere')}
                autoFocus
              />
              
              <View style={styles.tagsSection}>
                <View style={styles.tagsHeader}>
                  <Text style={styles.sectionTitle}>{t('verseDetail:tags')}</Text>
                  <TouchableOpacity 
                    style={styles.manageTagsButton}
                    onPress={() => {/* Navigate to tags management screen */}}
                  >
                    <Text style={styles.manageTagsText}>{t('verseDetail:manageTags')}</Text>
                    <Ionicons name="pencil" size={16} color="#007AFF" />
                  </TouchableOpacity>
                </View>
                
                {/* Existing tags */}
                {tags.length > 0 && (
                  <View style={styles.tagsList}>
                    {tags.map(tag => (
                      <View 
                        key={tag} 
                        style={[styles.tagItem, { backgroundColor: getTagColor(tag) }]}
                      >
                        <Text style={styles.tagText}>{tag}</Text>
                        <TouchableOpacity
                          style={styles.tagRemoveButton}
                          onPress={() => handleRemoveTag(tag)}
                        >
                          <Ionicons name="close-circle" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Add tag input */}
                <View style={styles.addTagContainer}>
                  <TextInput
                    style={styles.tagInput}
                    value={tagInput}
                    onChangeText={(text) => {
                      setTagInput(text);
                      setShowTagOptions(text.length > 0);
                    }}
                    placeholder={t('verseDetail:addTag')}
                    returnKeyType="done"
                    onSubmitEditing={handleAddTag}
                  />
                  {tagInput.trim() ? (
                    <View style={styles.tagActions}>
                      <TouchableOpacity onPress={handleAddTag} style={styles.tagActionButton}>
                        <Ionicons name="checkmark" size={24} color="#4CAF50" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => setTagInput('')} 
                        style={styles.tagActionButton}
                      >
                        <Ionicons name="close" size={24} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.addButton}
                      onPress={() => setShowTagOptions(true)}
                    >
                      <Ionicons name="add" size={24} color="#007AFF" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Tag suggestions */}
                {showTagOptions && filteredTags.length > 0 && (
                  <View style={styles.tagSuggestions}>
                    {filteredTags.slice(0, 5).map(tag => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.tagSuggestion}
                        onPress={() => handleSelectExistingTag(tag)}
                      >
                        <Text style={styles.tagSuggestionText}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>{t('common:cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>{t('common:save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
    maxHeight: '70%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  tagsSection: {
    marginTop: 8,
  },
  tagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  manageTagsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  manageTagsText: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 4,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  tagText: {
    color: 'white',
    marginRight: 6,
    fontSize: 14,
  },
  tagRemoveButton: {
    padding: 2,
  },
  addTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    height: 40,
  },
  tagActions: {
    flexDirection: 'row',
  },
  tagActionButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
    marginLeft: 8,
  },
  tagSuggestions: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  tagSuggestion: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tagSuggestionText: {
    fontSize: 14,
    color: '#333',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default NoteEditorModal; 