import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  StatusBar,
  BackHandler,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Note, Tag } from '../types/bible';
import { AuthService, DatabaseService } from '../services';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';

type TagsManagementScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TagsManagementScreenRouteProp = RouteProp<RootStackParamList, 'TagsManagement'>;

// Tag colors for random assignment
const TAG_COLORS = [
  '#8B4513', '#2E8B57', '#9932CC', '#FF69B4', '#4682B4',
  '#DC143C', '#20B2AA', '#FF8C00', '#9370DB', '#3CB371',
  '#FF1493', '#00CED1', '#FFA07A', '#7B68EE', '#32CD32',
  '#FF4500', '#48D1CC', '#DDA0DD', '#6495ED', '#98FB98',
  '#FF0000', '#40E0D0', '#FA8072', '#483D8B', '#90EE90',
  '#FF6347', '#00FA9A', '#FFB6C1', '#4169E1', '#87CEEB',
  '#FF7F50', '#66CDAA', '#DB7093', '#1E90FF', '#7FFFD4',
  '#CD5C5C', '#00FF7F', '#FFE4E1', '#0000FF', '#E0FFFF',
  '#F08080', '#7CFC00', '#FFC0CB', '#0000CD', '#AFEEEE',
  '#FA8072', '#7FFF00', '#FFB6C1', '#000080', '#B0E0E6',
  '#E9967A', '#ADFF2F', '#FF69B4', '#00008B', '#87CEFA',
  '#FFA07A', '#32CD32', '#FF1493', '#191970', '#ADD8E6'
];

interface TagWithCount extends Tag {
  count: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_WIDTH = SCREEN_WIDTH; // Use full width for the modal

const TagsManagementScreen: React.FC = () => {
  const { t } = useTranslation(['tags', 'common']);
  const navigation = useNavigation<TagsManagementScreenNavigationProp>();
  const route = useRoute<TagsManagementScreenRouteProp>();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editedTagName, setEditedTagName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [isVisible, setIsVisible] = useState(true);

  useLayoutEffect(() => {
    // Ensure proper modal presentation
    navigation.setOptions({
      presentation: 'transparentModal',
      headerShown: false,
      animation: 'slide_from_right',
    });
  }, [navigation]);

  useEffect(() => {
    // Set initial position off-screen to the right
    slideAnim.setValue(SCREEN_WIDTH);
    
    // Start animation after a short delay to ensure proper rendering
    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      
      // Load data after animation starts
      loadData();
    }, 50);

    // Add hardware back button handler
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );

    return () => {
      backHandler.remove();
    };
  }, []);

  // Handle animation and navigation on back press
  const handleBackPress = () => {
    if (isVisible) {
      closeModal();
      return true; // Prevent default behavior
    }
    return false;
  };

  // Add navigation handler to support returning to NoteEditorModal
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If we're visible and it's a user-initiated back action, animate first
      if (isVisible && !e.data.action.source) {
        e.preventDefault();
        animateOut();
      }
      // Otherwise just let the navigation happen
    });

    return unsubscribe;
  }, [navigation, isVisible]);

  const animateIn = () => {
    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: 0, // Slide to fully cover the screen
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 100);
  };

  const animateOut = () => {
    // Set isVisible to false immediately to prevent any unwanted interactions
    setIsVisible(false);
    
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH, // Slide completely off-screen
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      navigation.goBack();
    });
  };

  const closeModal = () => {
    // First set visibility to false to prevent further interactions
    setIsVisible(false);
    
    // Then animate out
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      // Once animation completes, actually close the modal
      navigation.goBack();
    });
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      // Fetch tags with their usage counts
      const currentUser = await AuthService.getCurrentUser();
      const fetchedTags = await DatabaseService.getTagsWithCount(currentUser?.id);
      setTags(fetchedTags);
    } catch (error) {
      console.error('Error loading tags:', error);
      Alert.alert(t('common:error'), t('tags:errorLoadingTags'));
    } finally {
      setIsLoading(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      setIsLoading(true);
      const color = generateRandomColor();
      
      // Call the service with proper parameters
      const currentUser = await AuthService.getCurrentUser();
      const newTag = await DatabaseService.createTag(newTagName.trim(), color, currentUser?.id);
      
      // Add the new tag to local state with count=0 for new tags
      setTags(prevTags => [...prevTags, {...newTag, count: 0}]);
      
      // Clear input
      setNewTagName('');
      
      // Show success message
      Alert.alert(t('common:success'), t('tags:createSuccess'));
    } catch (error) {
      console.error('Error creating tag:', error);
      Alert.alert(t('common:error'), t('tags:createError'));
    } finally {
      setIsLoading(false);
    }
  };

  const startEditTag = (tag: TagWithCount) => {
    setEditingTag(tag.id);
    setEditedTagName(tag.name);
  };

  const saveEditedTag = async (tag: TagWithCount) => {
    if (!editedTagName.trim()) {
      Alert.alert(t('common:error'), t('tags:tagNameRequired'));
      return;
    }
    
    try {
      // Update tag in database
      const currentUser = await AuthService.getCurrentUser();
      await DatabaseService.updateTag(tag.id, {
        name: editedTagName.trim(),
      }, currentUser?.id);
      
      // Reload data to ensure consistency
      await loadData();
      
      setEditingTag(null);
      setEditedTagName('');
    } catch (error) {
      console.error('Error updating tag:', error);
      Alert.alert(t('common:error'), t('tags:errorUpdatingTag'));
    }
  };

  const deleteTag = async (tagId: string) => {
    try {
      setIsLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      const success = await DatabaseService.deleteTag(tagId, currentUser?.id);
      // Remove the tag from local state
      setTags(prevTags => prevTags.filter(tag => tag.id !== tagId));
      Alert.alert(t('common:success'), t('tags:deleteSuccess'));
    } catch (error) {
      console.error('Error deleting tag:', error);
      Alert.alert(t('common:error'), t('tags:deleteError'));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    return tags.filter(tag => 
      tag.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tags, searchQuery]);

  const renderTagItem = ({ item }: { item: Tag }) => (
    <View style={styles.tagItem}>
      <View style={[styles.tagColorIndicator, { backgroundColor: item.color }]} />
      <Text style={styles.tagName}>{item.name}</Text>
      <TouchableOpacity
        onPress={() => deleteTag(item.id)}
        style={{ padding: 8 }}
      >
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  // Handle random color generation
  const generateRandomColor = () => {
    const colors = [
      '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', 
      '#EC4899', '#06B6D4', '#84CC16', '#6366F1', '#F97316',
      '#14B8A6', '#8B5CF6', '#22D3EE', '#F43F5E', '#64748B'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.overlay} 
        onPress={animateOut}
      />
      
      <Animated.View 
        style={[
          styles.modalContainer,
          {
            width: MODAL_WIDTH,
            transform: [{ translateX: slideAnim }],
          }
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('tags:manageTags')}</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeModal}
            accessibilityLabel={t('common:close')}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('tags:searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
        
        <FlatList
          data={filteredTags}
          renderItem={renderTagItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.tagList}
          refreshing={isLoading}
          onRefresh={loadData}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery.trim() 
                ? t('tags:noSearchResults') 
                : t('tags:noTags')}
            </Text>
          }
        />
        
        <View style={styles.addTagContainer}>
          <TextInput
            style={styles.addTagInput}
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder={t('tags:newTagPlaceholder')}
            returnKeyType="done"
            onSubmitEditing={createTag}
          />
          <TouchableOpacity
            style={[
              styles.addTagButton,
              (!newTagName.trim() || isLoading) && styles.disabledButton,
            ]}
            onPress={createTag}
            disabled={!newTagName.trim() || isLoading}
          >
            <Text style={styles.buttonText}>{t('tags:addTag')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999, // Extremely high z-index, higher than anything else
    elevation: 100, // Very high elevation for Android
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent overlay
    zIndex: 99998, // Just below the container but higher than everything else
  },
  blurView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100000, // Very high z-index
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: -3,
      height: 0,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 101, // Higher than the container
    zIndex: 100001, // Higher than blurView
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,0,0,0.1)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4B5563',
    lineHeight: 28,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  tagList: {
    flex: 1,
    padding: 16,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tagContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagColorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  tagName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  tagCount: {
    marginRight: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  tagActions: {
    flexDirection: 'row',
  },
  tagAction: {
    padding: 8,
    marginLeft: 4,
  },
  tagEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagEditInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    fontSize: 16,
  },
  tagEditActions: {
    flexDirection: 'row',
  },
  tagEditButton: {
    padding: 8,
    marginLeft: 4,
  },
  addTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16, // Extra padding for iOS
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  addTagInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginRight: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  addTagButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    padding: 24,
    color: '#6B7280',
    fontSize: 16,
  },
});

export default TagsManagementScreen; 