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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tag } from '../types/bible';
import { DatabaseService, AuthService } from '../services';
import { useTranslation } from 'react-i18next';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  label?: string;
  disabled?: boolean;
  tagList?: Tag[]; // Optional prop for pre-loaded tags
  onModalOpen?: () => void; // Callback when modal is opened
  onModalClose?: () => void; // Callback when modal is closed
}

const TagSelector: React.FC<TagSelectorProps> = ({ 
  selectedTags, 
  onTagsChange,
  label = 'Tags',
  disabled = false,
  tagList,
  onModalOpen,
  onModalClose
}) => {
  const { t } = useTranslation(['tags', 'common']);
  const [tags, setTags] = useState<Tag[]>(tagList || []);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  // Update tags if tagList prop changes
  useEffect(() => {
    if (tagList) {
      // Ensure tags are unique by ID
      const uniqueTags = Array.from(
        new Map(tagList.map(tag => [tag.id, tag])).values()
      );
      setTags(uniqueTags);
    }
  }, [tagList]);

  useEffect(() => {
    if (modalVisible && !tagList) {
      loadTags();
    }
  }, [modalVisible, tagList]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      const fetchedTags = await DatabaseService.getTags(currentUser?.id);
      // Ensure fetched tags are unique by ID
      const uniqueTags = Array.from(
        new Map(fetchedTags.map(tag => [tag.id, tag])).values()
      );
      setTags(uniqueTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get tag by name
  const getTagByName = (tagName: string): Tag | undefined => {
    return tags.find(tag => tag.name === tagName);
  };

  // Get tag color by name
  const getTagColor = (tagName: string): string => {
    const tag = getTagByName(tagName);
    return tag?.color || '#CCCCCC'; // Default color if tag not found
  };

  const toggleTag = (tag: Tag) => {
    const tagName = tag.name;
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter(t => t !== tagName));
    } else {
      onTagsChange([...selectedTags, tagName]);
    }
  };

  const addNewTag = async () => {
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
      
      // Add to state - ensure no duplicates
      const tagExists = tags.some(t => t.id === createdTag.id);
      if (!tagExists) {
        setTags(prevTags => {
          // Using functional update to ensure we have the latest state
          const updatedTags = [...prevTags, createdTag];
          return Array.from(new Map(updatedTags.map(tag => [tag.id, tag])).values());
        });
      }
      
      // Add to selected tags if not already selected
      if (!selectedTags.includes(createdTag.name)) {
        onTagsChange([...selectedTags, createdTag.name]);
      }
      
      // Reset input
      setNewTagName('');
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update modal visibility and notify parent component
  const openModal = () => {
    setModalVisible(true);
    onModalOpen?.();
  };

  // Safely close the modal
  const handleCloseModal = () => {
    // First reset the search and new tag state
    setSearchQuery('');
    setNewTagName('');
    // Then close the modal
    setModalVisible(false);
    // Notify parent component
    onModalClose?.();
  };

  // Ensure filtered tags have unique IDs
  const filteredTags = React.useMemo(() => {
    const filtered = searchQuery.trim()
      ? tags.filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : tags;
    
    // Ensure all tags have unique IDs
    return Array.from(new Map(filtered.map(tag => [tag.id, tag])).values());
  }, [searchQuery, tags]);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      
      <View style={styles.tagsContainer}>
        {selectedTags.length > 0 ? (
          // Make sure we use unique keys by combining tag name with index as fallback
          selectedTags.map((tagName, index) => {
            const tagColor = getTagColor(tagName);
            // Create a composite key to ensure uniqueness
            const key = `tag-${tagName}-${index}`;
            return (
              <View 
                key={key} 
                style={[
                  styles.tagChip, 
                  { backgroundColor: tagColor }
                ]}
              >
                <Text style={styles.tagChipText}>{tagName}</Text>
                <TouchableOpacity
                  onPress={() => onTagsChange(selectedTags.filter(t => t !== tagName))}
                  style={styles.tagChipRemove}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <Text style={styles.noTagsText}>{t('tags:noTagsSelected')}</Text>
        )}
      </View>
      
      <TouchableOpacity 
        style={[
          styles.selectButton,
          disabled && styles.disabledSelectButton
        ]}
        onPress={openModal}
        disabled={disabled}
      >
        <Text style={[
          styles.selectButtonText,
          disabled && styles.disabledText
        ]}>{t('tags:selectTags')}</Text>
      </TouchableOpacity>
      
      {/* Use a separate component for the modal to avoid z-index issues */}
      {modalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={true}
          onRequestClose={handleCloseModal}
          statusBarTranslucent={true}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { height: Platform.OS === 'ios' ? screenHeight * 0.8 : screenHeight * 0.7 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('tags:selectTags')}</Text>
                <TouchableOpacity 
                  onPress={handleCloseModal}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>
              
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
                  onPress={addNewTag}
                  disabled={!newTagName.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createTagButtonText}>{t('tags:createTag')}</Text>
                  )}
                </TouchableOpacity>
              </View>
              
              {loading && !filteredTags.length ? (
                <ActivityIndicator style={styles.loader} size="large" color="#3B82F6" />
              ) : (
                <FlatList
                  data={filteredTags}
                  keyExtractor={(item) => `tag-list-${item.id}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.tagListItem,
                        selectedTags.includes(item.name) && styles.tagListItemSelected
                      ]}
                      onPress={() => toggleTag(item)}
                    >
                      <View 
                        style={[
                          styles.tagColorIndicator, 
                          { backgroundColor: item.color }
                        ]} 
                      />
                      <Text style={styles.tagListItemText}>{item.name}</Text>
                      {selectedTags.includes(item.name) && (
                        <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
                      )}
                    </TouchableOpacity>
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#111827',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    minHeight: 32,
  },
  noTagsText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
    marginRight: 4,
  },
  tagChipRemove: {
    marginLeft: 4,
    padding: 2,
  },
  selectButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectButtonText: {
    color: '#374151',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    height: '80%',
    width: '100%',
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
    flex: 1,
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
  tagListItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  tagColorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  tagListItemText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  emptyListText: {
    textAlign: 'center',
    padding: 24,
    color: '#6B7280',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  disabledSelectButton: {
    backgroundColor: '#F0F0F0',
    borderColor: '#E0E0E0',
  },
  disabledText: {
    color: '#999',
  },
});

export default TagSelector; 