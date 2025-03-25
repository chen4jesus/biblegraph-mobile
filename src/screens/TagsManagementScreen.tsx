import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Note } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

type TagsManagementScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Tag colors for random assignment
const TAG_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', 
  '#EF476F', '#FFC43D', '#1B9AAA', '#6F2DBD', '#84BC9C'
];

interface TagWithCount {
  name: string;
  count: number;
  color: string;
}

const TagsManagementScreen: React.FC = () => {
  const { t } = useTranslation(['tags', 'common']);
  const navigation = useNavigation<TagsManagementScreenNavigationProp>();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editedTagName, setEditedTagName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch all notes
      const fetchedNotes = await neo4jService.getNotes();
      setNotes(fetchedNotes);
      
      // Extract and count tags
      const tagCounts: Record<string, number> = {};
      const tagColors: Record<string, string> = {};
      
      fetchedNotes.forEach(note => {
        if (note.tags && Array.isArray(note.tags)) {
          note.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            
            // Assign a color if it doesn't have one yet
            if (!tagColors[tag]) {
              const tagIndex = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % TAG_COLORS.length;
              tagColors[tag] = TAG_COLORS[tagIndex];
            }
          });
        }
      });
      
      // Convert to array of TagWithCount objects
      const tagsArray: TagWithCount[] = Object.entries(tagCounts).map(([name, count]) => ({
        name,
        count,
        color: tagColors[name]
      }));
      
      // Sort by count (most used first)
      tagsArray.sort((a, b) => b.count - a.count);
      
      setTags(tagsArray);
    } catch (error) {
      console.error('Error loading tags:', error);
      Alert.alert(t('common:error'), t('tags:errorLoadingTags'));
    }
  };

  const addNewTag = () => {
    if (!newTagName.trim()) return;
    
    // Check if tag already exists
    if (tags.some(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      Alert.alert(t('common:error'), t('tags:tagAlreadyExists'));
      return;
    }
    
    // Generate color for new tag
    const tagIndex = newTagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % TAG_COLORS.length;
    
    // Add new tag with count 0
    setTags([...tags, { 
      name: newTagName.trim(), 
      count: 0,
      color: TAG_COLORS[tagIndex]
    }]);
    setNewTagName('');
  };

  const startEditTag = (tagName: string) => {
    setEditingTag(tagName);
    setEditedTagName(tagName);
  };

  const saveEditedTag = async (oldTagName: string) => {
    if (!editedTagName.trim()) {
      Alert.alert(t('common:error'), t('tags:tagNameRequired'));
      return;
    }
    
    // Check if new name already exists (excluding the current tag)
    if (tags.some(tag => 
      tag.name !== oldTagName && 
      tag.name.toLowerCase() === editedTagName.trim().toLowerCase()
    )) {
      Alert.alert(t('common:error'), t('tags:tagAlreadyExists'));
      return;
    }
    
    try {
      // Update tag name in all notes
      const notesToUpdate = notes.filter(note => 
        note.tags && note.tags.includes(oldTagName)
      );
      
      for (const note of notesToUpdate) {
        const updatedTags = note.tags.map(tag => 
          tag === oldTagName ? editedTagName.trim() : tag
        );
        
        await neo4jService.updateNote(note.id, {
          ...note,
          tags: updatedTags
        });
      }
      
      // Update local state
      setTags(tags.map(tag => 
        tag.name === oldTagName 
          ? { ...tag, name: editedTagName.trim() } 
          : tag
      ));
      
      // Reload data to ensure consistency
      await loadData();
      
      setEditingTag(null);
      setEditedTagName('');
    } catch (error) {
      console.error('Error updating tag:', error);
      Alert.alert(t('common:error'), t('tags:errorUpdatingTag'));
    }
  };

  const deleteTag = async (tagName: string) => {
    try {
      // Confirm deletion
      Alert.alert(
        t('tags:confirmDeleteTitle'),
        t('tags:confirmDeleteMessage', { tagName }),
        [
          { text: t('common:cancel'), style: 'cancel' },
          { 
            text: t('common:delete'), 
            style: 'destructive',
            onPress: async () => {
              // Remove tag from all notes
              const notesToUpdate = notes.filter(note => 
                note.tags && note.tags.includes(tagName)
              );
              
              for (const note of notesToUpdate) {
                const updatedTags = note.tags.filter(tag => tag !== tagName);
                
                await neo4jService.updateNote(note.id, {
                  ...note,
                  tags: updatedTags
                });
              }
              
              // Update local state
              setTags(tags.filter(tag => tag.name !== tagName));
              
              // Reload data to ensure consistency
              await loadData();
            } 
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting tag:', error);
      Alert.alert(t('common:error'), t('tags:errorDeletingTag'));
    }
  };

  const filteredTags = searchQuery.trim() 
    ? tags.filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tags;

  const renderTagItem = ({ item }: { item: TagWithCount }) => (
    <View style={styles.tagItem}>
      {editingTag === item.name ? (
        <View style={styles.tagEditContainer}>
          <TextInput
            style={styles.tagEditInput}
            value={editedTagName}
            onChangeText={setEditedTagName}
            autoFocus
          />
          <View style={styles.tagEditActions}>
            <TouchableOpacity
              style={styles.tagEditButton}
              onPress={() => saveEditedTag(item.name)}
            >
              <Ionicons name="checkmark" size={18} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tagEditButton}
              onPress={() => setEditingTag(null)}
            >
              <Ionicons name="close" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.tagContent}>
          <View style={[styles.tagColorIndicator, { backgroundColor: item.color }]} />
          <Text style={styles.tagName}>{item.name}</Text>
          <Text style={styles.tagCount}>{t('tags:tagCount', { count: item.count })}</Text>
          <View style={styles.tagActions}>
            <TouchableOpacity
              style={styles.tagAction}
              onPress={() => startEditTag(item.name)}
            >
              <Ionicons name="pencil" size={18} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tagAction}
              onPress={() => deleteTag(item.name)}
            >
              <Ionicons name="trash" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tags:manageTags')}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('tags:searchTags')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.addTagContainer}>
        <TextInput
          style={styles.addTagInput}
          placeholder={t('tags:addNewTag')}
          value={newTagName}
          onChangeText={setNewTagName}
          onSubmitEditing={addNewTag}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={styles.addTagButton}
          onPress={addNewTag}
        >
          <Ionicons name="add-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredTags}
        renderItem={renderTagItem}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.tagsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? t('tags:noTagsFound') : t('tags:noTagsYet')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  addTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  addTagInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  addTagButton: {
    marginLeft: 8,
    padding: 4,
  },
  tagsList: {
    padding: 16,
  },
  tagItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tagContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagColorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  tagName: {
    flex: 1,
    fontSize: 16,
  },
  tagCount: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#eee',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  tagActions: {
    flexDirection: 'row',
  },
  tagAction: {
    padding: 6,
    marginLeft: 4,
  },
  tagEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagEditInput: {
    flex: 1,
    fontSize: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  tagEditActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  tagEditButton: {
    padding: 6,
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default TagsManagementScreen; 