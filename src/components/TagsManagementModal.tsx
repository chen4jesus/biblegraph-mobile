import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tag } from '../types/bible';
import { DatabaseService, AuthService } from '../services';
import { useTranslation } from 'react-i18next';

interface TagsManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onTagsUpdated?: () => void;
}

const TagsManagementModal: React.FC<TagsManagementModalProps> = ({
  visible,
  onClose,
  onTagsUpdated,
}) => {
  const { t } = useTranslation(['tags', 'common']);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editedTagName, setEditedTagName] = useState('');
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  // Load tags when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadTags();
    } else {
      // Reset state when modal closes
      setSearchQuery('');
      setNewTagName('');
      setEditingTag(null);
      setEditedTagName('');
    }
  }, [visible]);

  // Load all tags from database
  const loadTags = async () => {
    try {
      setLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      const fetchedTags = await DatabaseService.getTags(currentUser?.id);
      setTags(fetchedTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create a new tag
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      setLoading(true);
      // Generate a random color
      const colors = [
        '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', 
        '#EF476F', '#FFC43D', '#1B9AAA', '#6F2DBD', '#84BC9C'
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      // Create tag
      const currentUser = await AuthService.getCurrentUser();
      const createdTag = await DatabaseService.createTag(newTagName.trim(), randomColor, currentUser?.id);
      
      // Update local state
      setTags(prevTags => [...prevTags, createdTag]);
      setNewTagName('');
      
      // Notify parent component
      if (onTagsUpdated) {
        onTagsUpdated();
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setLoading(false);
    }
  };

  // Start editing a tag
  const startEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setEditedTagName(tag.name);
  };

  // Save edited tag
  const handleSaveEdit = async () => {
    if (!editingTag || !editedTagName.trim() || editedTagName === editingTag.name) {
      setEditingTag(null);
      return;
    }

    try {
      setLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      // Update tag in database
      const updatedTag = await DatabaseService.updateTag(
        editingTag.id, 
        { name: editedTagName.trim() },
        currentUser?.id
      );
      
      // Update local state
      setTags(prevTags => 
        prevTags.map(tag => 
          tag.id === updatedTag.id ? updatedTag : tag
        )
      );
      
      // Reset editing state
      setEditingTag(null);
      setEditedTagName('');
      
      // Notify parent component
      if (onTagsUpdated) {
        onTagsUpdated();
      }
    } catch (error) {
      console.error('Error updating tag:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete a tag
  const handleDeleteTag = (tag: Tag) => {
    Alert.alert(
      t('common:confirm'),
      t('tags:deleteTagConfirm', { tagName: tag.name }),
      [
        {
          text: t('common:cancel'),
          style: 'cancel',
        },
        {
          text: t('common:delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const currentUser = await AuthService.getCurrentUser();
              // Delete tag from database
              await DatabaseService.deleteTag(tag.id, currentUser?.id);
              
              // Update local state
              setTags(prevTags => prevTags.filter(t => t.id !== tag.id));
              
              // Notify parent component
              if (onTagsUpdated) {
                onTagsUpdated();
              }
            } catch (error) {
              console.error('Error deleting tag:', error);
              Alert.alert(
                t('common:error'),
                t('tags:deleteTagError')
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Handle editing tag color
  const handleEditTagColor = (tag: Tag) => {
    // For simplicity, we'll just cycle through a few preset colors
    const colors = [
      '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', 
      '#EF476F', '#FFC43D', '#1B9AAA', '#6F2DBD', '#84BC9C'
    ];
    
    const currentIndex = colors.indexOf(tag.color);
    const nextIndex = (currentIndex + 1) % colors.length;
    const newColor = colors[nextIndex] || colors[0];
    
    // Update the tag color
    updateTagColor(tag, newColor);
  };

  // Update tag color in DB and state
  const updateTagColor = async (tag: Tag, newColor: string) => {
    try {
      setLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      // Update the tag in database
      const updatedTag = await DatabaseService.updateTag(
        tag.id,
        { color: newColor },
        currentUser?.id
      );
      
      // Update local state
      setTags(prevTags => 
        prevTags.map(t => 
          t.id === updatedTag.id ? updatedTag : t
        )
      );
      
      // Notify parent component
      if (onTagsUpdated) {
        onTagsUpdated();
      }
    } catch (error) {
      console.error('Error updating tag color:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tags based on search query
  const filteredTags = searchQuery.trim()
    ? tags.filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tags;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('tags:manageTags')}</Text>
            <TouchableOpacity 
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
          </View>
          
          {/* Search box */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#888888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('tags:searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="#888888" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Create new tag */}
          <View style={styles.createTagContainer}>
            <TextInput
              style={styles.createTagInput}
              placeholder={t('tags:newTagPlaceholder')}
              value={newTagName}
              onChangeText={setNewTagName}
            />
            <TouchableOpacity 
              style={[
                styles.createTagButton, 
                !newTagName.trim() && styles.disabledButton
              ]}
              onPress={handleCreateTag}
              disabled={!newTagName.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createTagButtonText}>{t('tags:createTag')}</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Tags list */}
          {loading && tags.length === 0 ? (
            <ActivityIndicator style={styles.loader} size="large" color="#3B82F6" />
          ) : (
            <FlatList
              data={filteredTags}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.tagListItem}>
                  {/* Tag color indicator */}
                  <TouchableOpacity
                    style={[
                      styles.tagColorIndicator,
                      { backgroundColor: item.color }
                    ]}
                    onPress={() => handleEditTagColor(item)}
                  />
                  
                  {/* Tag name (editable or display) */}
                  {editingTag?.id === item.id ? (
                    <TextInput
                      style={styles.tagNameInput}
                      value={editedTagName}
                      onChangeText={setEditedTagName}
                      autoFocus
                      onBlur={handleSaveEdit}
                      onSubmitEditing={handleSaveEdit}
                    />
                  ) : (
                    <Text 
                      style={styles.tagListItemText}
                      onPress={() => startEditTag(item)}
                    >
                      {item.name}
                    </Text>
                  )}
                  
                  {/* Action buttons */}
                  <View style={styles.tagActions}>
                    {editingTag?.id === item.id ? (
                      <TouchableOpacity
                        style={styles.tagActionButton}
                        onPress={handleSaveEdit}
                      >
                        <Ionicons name="checkmark" size={20} color="#3B82F6" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.tagActionButton}
                        onPress={() => startEditTag(item)}
                      >
                        <Ionicons name="pencil-outline" size={20} color="#3B82F6" />
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      style={styles.tagActionButton}
                      onPress={() => handleDeleteTag(item)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  {searchQuery ? t('tags:noTagsFound') : t('tags:noTagsYet')}
                </Text>
              }
              style={styles.tagsList}
              contentContainerStyle={styles.tagsListContent}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '85%',
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    margin: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  createTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  createTagInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    fontSize: 16,
  },
  createTagButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    height: 44,
  },
  createTagButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  tagsList: {
    maxHeight: 400,
  },
  tagsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  tagListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tagColorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  tagListItemText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  tagNameInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#3B82F6',
    paddingVertical: 4,
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagActionButton: {
    padding: 8,
    marginLeft: 4,
  },
  emptyListText: {
    textAlign: 'center',
    padding: 24,
    color: '#6B7280',
  },
  loader: {
    padding: 20,
  },
});

export default TagsManagementModal; 