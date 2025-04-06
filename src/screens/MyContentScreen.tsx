import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useFocusEffect } from '@react-navigation/native';
import { DatabaseService, AuthService } from '../services';
import { Note, Connection, ConnectionType, User } from '../types/bible';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';

// Define colors here instead of using useTheme
const colors = {
  primary: '#4F46E5',
  background: '#FFFFFF',
  cardBackground: '#FFFFFF',
  text: '#0F172A',
  textLight: '#94A3B8',
  error: '#DC2626',
  white: '#FFFFFF',
  border: '#E2E8F0',
  inputBackground: '#F8FAFF',
};

type MyContentScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MyContent'>;
};

const MyContentScreen: React.FC<MyContentScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['myContent', 'common']);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myNotes, setMyNotes] = useState<Note[]>([]);
  const [myConnections, setMyConnections] = useState<Connection[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [itemToShare, setItemToShare] = useState<{ id: string; type: 'note' | 'connection' } | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'connections'>('notes');

  // Fetch user's notes and connections when screen is focused
  useFocusEffect(
    useCallback(() => {
      const loadUserContent = async () => {
        setIsLoading(true);
        try {
          const user = await AuthService.getCurrentUser();
          setCurrentUser(user);

          if (user) {
            const [notes, connections] = await Promise.all([
              DatabaseService.getNotes(),
              DatabaseService.getConnections(),
            ]);
            setMyNotes(notes);
            setMyConnections(connections);
          }
        } catch (error) {
          console.error('Error loading user content:', error);
          Alert.alert('Error', 'Failed to load your content. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };

      loadUserContent();
    }, [])
  );

  // Handle refreshing the content
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [notes, connections] = await Promise.all([
        DatabaseService.getNotes(),
        DatabaseService.getConnections(),
      ]);
      setMyNotes(notes);
      setMyConnections(connections);
    } catch (error) {
      console.error('Error refreshing content:', error);
      Alert.alert('Error', 'Failed to refresh content. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Navigate to verse detail for a note or connection
  const handleItemPress = (item: Note | Connection) => {
    if ('verseId' in item) {
      // It's a note
      navigation.navigate('VerseDetail', { verseId: item.verseId });
    } else {
      // It's a connection
      navigation.navigate('VerseDetail', { verseId: item.sourceVerseId });
    }
  };

  // Show share modal for an item
  const handleSharePress = (id: string, type: 'note' | 'connection') => {
    setItemToShare({ id, type });
    setShareEmail('');
    setShareModalVisible(true);
  };

  // Share the item with another user
  const handleShareSubmit = async () => {
    if (!itemToShare || !shareEmail.trim()) return;

    try {
      setIsLoading(true);
      
      // This functionality is commented out because these methods aren't implemented yet
      /*
      if (itemToShare.type === 'note') {
        await DatabaseService.attachUserToNote(itemToShare.id, userData.id);
        Alert.alert(t('common.success'), t('myContent.shareSuccess'));
      } else {
        await DatabaseService.attachUserToConnection(itemToShare.id, userData.id);
        Alert.alert(t('common.success'), t('myContent.shareSuccess'));
      }
      */
      
      // Simple alert for now
      Alert.alert('Sharing feature', 'Sharing functionality will be available in a future update');
      setShareModalVisible(false);
    } catch (error) {
      console.error('Error sharing item:', error);
      Alert.alert('Error', 'Failed to share item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete an item
  const handleDeletePress = (id: string, type: 'note' | 'connection') => {
    Alert.alert(
      'Confirm',
      'Are you sure you want to delete this item?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              if (type === 'note') {
                await DatabaseService.deleteNote(id);
                setMyNotes(prevNotes => prevNotes.filter(note => note.id !== id));
              } else {
                await DatabaseService.deleteConnection(id);
                setMyConnections(prevConnections => 
                  prevConnections.filter(connection => connection.id !== id)
                );
              }
              
              Alert.alert('Success', 'Item deleted successfully');
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // Connection type to readable text
  const getConnectionTypeText = (type: ConnectionType) => {
    switch (type) {
      case 'CROSS_REFERENCE':
        return t('connections:connectionTypes.crossReference');
      case 'THEMATIC':
        return t('connections:connectionTypes.thematic');
      case 'PARALLEL':
        return t('connections:connectionTypes.parallel');
      case 'PROPHETIC':
        return t('connections:connectionTypes.prophetic');
      case 'NOTE':
        return t('connections:connectionTypes.note');
      default:
        return type;
    }
  };

  // Render note item
  const renderNoteItem = ({ item }: { item: Note }) => (
    <View style={[styles.itemContainer, { backgroundColor: colors.cardBackground }]}>
      <TouchableOpacity
        style={styles.itemContent}
        onPress={() => handleItemPress(item)}
      >
        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
          {item.verseId}
        </Text>
        <Text style={[styles.itemContent, { color: colors.text }]} numberOfLines={2}>
          {item.content}
        </Text>
        <View style={styles.tagsContainer}>
          {item.tags && item.tags.map((tag, index) => (
            <View key={index} style={[styles.tagBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSharePress(item.id, 'note')}
        >
          <MaterialIcons name="share" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeletePress(item.id, 'note')}
        >
          <MaterialIcons name="delete" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render connection item
  const renderConnectionItem = ({ item }: { item: Connection }) => (
    <View style={[styles.itemContainer, { backgroundColor: colors.cardBackground }]}>
      <TouchableOpacity
        style={styles.itemContent}
        onPress={() => handleItemPress(item)}
      >
        <View style={styles.connectionHeader}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {item.sourceVerseId} → {item.targetVerseId}
          </Text>
          <View style={[styles.connectionTypeBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.connectionTypeText}>
              {getConnectionTypeText(item.type)}
            </Text>
          </View>
        </View>
        {item.description && (
          <Text style={[styles.itemContent, { color: colors.text }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </TouchableOpacity>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSharePress(item.id, 'connection')}
        >
          <MaterialIcons name="share" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeletePress(item.id, 'connection')}
        >
          <MaterialIcons name="delete" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons 
        name={activeTab === 'notes' ? 'note-outline' : 'connection'} 
        size={80} 
        color={colors.textLight} 
      />
      <Text style={[styles.emptyText, { color: colors.text }]}>
        {activeTab === 'notes' 
          ? t('myContent:noNotes') 
          : t('myContent:noConnections')}
      </Text>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('VerseSearch')}
      >
        <Text style={styles.createButtonText}>
          {activeTab === 'notes' 
            ? t('myContent:createNote') 
            : t('myContent:createConnection')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Fix FlatList typing issues with a separate function for each type
  const renderList = () => {
    if (activeTab === 'notes') {
      return (
        <FlatList<Note>
          data={myNotes}
          renderItem={renderNoteItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      );
    } else {
      return (
        <FlatList<Connection>
          data={myConnections}
          renderItem={renderConnectionItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      );
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loginPromptContainer}>
          <Text style={[styles.loginPromptText, { color: colors.text }]}>
            Please log in to view your content
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('myContent:title')}
        </Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'notes' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setActiveTab('notes')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'notes' ? colors.white : colors.text }
            ]}
          >
            {t('myContent:notes')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'connections' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setActiveTab('connections')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'connections' ? colors.white : colors.text }
            ]}
          >
            {t('myContent:connections')}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        renderList()
      )}

      {/* Share Modal */}
      <Modal
        visible={shareModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('myContent:shareTitle')}
            </Text>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.border
              }]}
              value={shareEmail}
              onChangeText={setShareEmail}
              placeholder={t('myContent:emailPlaceholder')}
              placeholderTextColor={colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShareModalVisible(false)}
              >
                <Text style={{ color: colors.text }}>{t('common:cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.shareButton, { backgroundColor: colors.primary }]}
                onPress={handleShareSubmit}
                disabled={!shareEmail.trim()}
              >
                <Text style={styles.shareButtonText}>{t('common:share')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  itemContainer: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemContent: {
    padding: 16,
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  itemText: {
    fontSize: 14,
    marginTop: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  connectionTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  connectionTypeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.48,
  },
  cancelButton: {
    borderWidth: 1,
  },
  shareButton: {
    backgroundColor: '#2196F3',
  },
  shareButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginPromptText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default MyContentScreen; 