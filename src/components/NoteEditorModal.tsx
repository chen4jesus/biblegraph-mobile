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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Note } from '../types/bible';

interface NoteEditorModalProps {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: (content: string, tags: string[], noteId?: string, isNew?: boolean) => void;
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
  const inputRef = useRef<TextInput>(null);

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
    
    // Pass the noteId and isNew flag to the onSave handler
    onSave(content, tags, note?.id, !note);
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
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          <ScrollView 
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
              <View style={styles.tagsHeader}>
                <Text style={styles.sectionTitle}>{t('verseDetail:tags')}</Text>
                <TouchableOpacity 
                  style={styles.manageTagsButton}
                  onPress={() => {/* Navigate to tags management screen */}}
                >
                  <Text style={styles.manageTagsText}>{t('verseDetail:manageTags')}</Text>
                </TouchableOpacity>
              </View>
              
              {/* Add tag input */}
              <View style={styles.addTagContainer}>
                <View style={styles.tagInputWrapper}>
                  <Ionicons name="pricetag-outline" size={18} color="#999" style={styles.tagIcon} />
                  <TextInput
                    style={styles.tagInput}
                    value={tagInput}
                    onChangeText={(text) => {
                      setTagInput(text);
                      setShowTagOptions(text.length > 0);
                    }}
                    placeholder={t('verseDetail:addTag')}
                    placeholderTextColor="#aaa"
                    returnKeyType="done"
                    onSubmitEditing={handleAddTag}
                  />
                  {tagInput.trim() && (
                    <TouchableOpacity 
                      onPress={() => setTagInput('')} 
                      style={styles.clearTagButton}
                    >
                      <Ionicons name="close-circle" size={16} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {tagInput.trim() && (
                  <TouchableOpacity 
                    style={styles.addTagButton}
                    onPress={handleAddTag}
                  >
                    <Ionicons name="add-circle" size={28} color="#007AFF" />
                  </TouchableOpacity>
                )}
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
                        <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.9)" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Tag suggestions */}
              {showTagOptions && filteredTags.length > 0 && (
                <View style={styles.tagSuggestions}>
                  <Text style={styles.suggestionsTitle}>
                    {t('verseDetail:suggestedTags', 'Suggested Tags')}
                  </Text>
                  {filteredTags.slice(0, 5).map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tagSuggestion}
                      onPress={() => handleSelectExistingTag(tag)}
                    >
                      <Ionicons name="pricetag-outline" size={16} color="#666" style={styles.suggestionIcon} />
                      <Text style={styles.tagSuggestionText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
          
          {/* Footer with buttons */}
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>{t('common:cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveButton, !content.trim() && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!content.trim()}
            >
              <Text style={styles.saveButtonText}>{t('common:save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '92%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
    borderRadius: 15,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '72%',
  },
  noteSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#444',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    minHeight: 140,
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  tagsSection: {
    marginBottom: 20,
  },
  tagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageTagsButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  manageTagsText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  addTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  tagInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    height: 44,
  },
  tagIcon: {
    marginRight: 8,
  },
  tagInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 8,
  },
  clearTagButton: {
    padding: 4,
  },
  addTagButton: {
    padding: 6,
    marginLeft: 10,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  tagText: {
    color: 'white',
    marginRight: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  tagRemoveButton: {
    padding: 2,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    marginLeft: 2,
  },
  tagSuggestions: {
    marginTop: 5,
    marginBottom: 15,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  tagSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionIcon: {
    marginRight: 8,
  },
  tagSuggestionText: {
    fontSize: 15,
    color: '#333',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f8f8f8',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#97c2f7',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  urlText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});

export default NoteEditorModal; 