import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Verse, ConnectionType, Connection, GroupConnection, User } from '../types/bible';
import { DatabaseService, AuthService } from '../services';
import { useTranslation } from 'react-i18next';

interface VerseConnection {
  verse: Verse;
  selected: boolean;
  connectionType: ConnectionType;
}

interface MultiConnectionSelectorProps {
  targetVerseId: string;
  targetVerse?: Verse;
  onConnectionsCreated?: (connections: (Connection | GroupConnection)[], userId?: string) => void;
  shouldAutoCloseOnSuccess?: boolean;
  onClose?: () => void;
}

const CONNECTION_TYPES = [
  { value: ConnectionType.PROPHECY, label: '预言/应验' },
  { value: ConnectionType.CROSS_REFERENCE, label: '引用' },
  { value: ConnectionType.PARALLEL, label: '平行对应' },
  { value: ConnectionType.THEMATIC, label: '主题相关' },
];

const MultiConnectionSelector: React.FC<MultiConnectionSelectorProps> = ({
  targetVerseId,
  targetVerse,
  onConnectionsCreated,
  shouldAutoCloseOnSuccess,
  onClose,
}) => {
  const { t } = useTranslation(['verseDetail', 'common']);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Verse[]>([]);
  const [selectedVerses, setSelectedVerses] = useState<VerseConnection[]>([]);
  const [connectionType, setConnectionType] = useState<ConnectionType>(ConnectionType.CROSS_REFERENCE);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [useGroupConnection, setUseGroupConnection] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isErrorVisible, setIsErrorVisible] = useState(false);

  // Load the current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Load the target verse if not provided
  useEffect(() => {
    if (!targetVerse && targetVerseId) {
      loadTargetVerse();
    }
  }, [targetVerseId, targetVerse]);

  const loadTargetVerse = async () => {
    try {
      const verse = await DatabaseService.getVerse(targetVerseId);
      // Do something with the verse if needed
    } catch (error) {
      console.error('Error loading target verse:', error);
    }
  };

  const handleToggleVerseSelection = (verse: Verse) => {
    const existingIndex = selectedVerses.findIndex(v => v.verse.id === verse.id);
    
    if (existingIndex >= 0) {
      // Remove verse if already selected
      setSelectedVerses(prev => prev.filter(v => v.verse.id !== verse.id));
    } else {
      // Add verse if not selected
      setSelectedVerses(prev => [
        ...prev,
        { verse, selected: true, connectionType }
      ]);
    }
  };

  const handleChangeConnectionType = (type: ConnectionType) => {
    setConnectionType(type);
    
    // Update connection type for all selected verses
    setSelectedVerses(prev => 
      prev.map(item => ({ ...item, connectionType: type }))
    );
  };

  const handleSearchVerses = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const results = await DatabaseService.searchVerses(query);
      // Filter out the target verse itself
      setSearchResults(results.filter(v => v.id !== targetVerseId));
    } catch (error) {
      console.error('Error searching verses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConnections = async () => {
    if (!targetVerse) return;
    
    try {
      // Get current user for ownership
      const currentUser = await AuthService.getCurrentUser();
      
      // Prepare selected verses for batch connection
      const connections = selectedVerses.map(verseConnection => ({
        sourceVerseId: targetVerseId,
        targetVerseId: verseConnection.verse.id,
        type: connectionType,
        description: ''
      }));
      
      // Create connections in a batch with user ownership
      const createdConnections = await DatabaseService.createConnectionsBatch(connections, currentUser?.id);
      
      if (onConnectionsCreated && currentUser) {
        onConnectionsCreated(createdConnections, currentUser.id);
      }
      
      // Reset state
      setSelectedVerses([]);
      
      setStatusMessage(t('multiConnectionSelector:connectionsCreated', { count: createdConnections.length }));
      setIsSuccessVisible(true);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setIsSuccessVisible(false);
        
        // Auto-close the component if requested
        if (shouldAutoCloseOnSuccess && onClose) {
          onClose();
        }
      }, 3000);
    } catch (error) {
      console.error('Error creating connections:', error);
      setErrorMessage(t('multiConnectionSelector:errorCreatingConnections'));
      setIsErrorVisible(true);
      
      // Auto-hide error message after 3 seconds
      setTimeout(() => {
        setIsErrorVisible(false);
      }, 3000);
    }
  };

  const isVerseSelected = (verse: Verse) => {
    return selectedVerses.some(v => v.verse.id === verse.id);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('verseDetail:addMultipleConnections')}</Text>
      
      {/* Connection type selector */}
      <View style={styles.typeSelector}>
        <Text style={styles.sectionTitle}>{t('verseDetail:connectionType')}:</Text>
        <FlatList
          horizontal
          data={CONNECTION_TYPES}
          keyExtractor={item => item.value.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.typeButton,
                connectionType === item.value && styles.selectedTypeButton
              ]}
              onPress={() => handleChangeConnectionType(item.value)}
            >
              <Text 
                style={[
                  styles.typeButtonText,
                  connectionType === item.value && styles.selectedTypeText
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>
      
      {/* Group connection option */}
      <View style={styles.optionContainer}>
        <Text style={styles.optionLabel}>{t('verseDetail:useGroupConnection')}:</Text>
        <Switch
          value={useGroupConnection}
          onValueChange={setUseGroupConnection}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={useGroupConnection ? '#007AFF' : '#f4f3f4'}
        />
      </View>
      
      {/* Group name input (only shown if group connection is enabled) */}
      {useGroupConnection && (
        <View style={styles.groupNameContainer}>
          <Text style={styles.optionLabel}>{t('verseDetail:groupName')}:</Text>
          <TextInput
            style={styles.groupNameInput}
            placeholder={t('verseDetail:enterGroupName')}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>
      )}
      
      {/* Search input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('verseDetail:searchVerses')}
          value={searchQuery}
          onChangeText={text => {
            setSearchQuery(text);
            handleSearchVerses(text);
          }}
        />
        {isLoading && <ActivityIndicator size="small" color="#007AFF" />}
      </View>
      
      {/* Search results */}
      {searchResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>{t('verseDetail:searchResults')}:</Text>
          <FlatList
            data={searchResults}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.resultItem,
                  isVerseSelected(item) && styles.selectedResultItem
                ]}
                onPress={() => handleToggleVerseSelection(item)}
              >
                <View style={styles.verseInfo}>
                  <Text style={styles.verseReference}>
                    {item.book} {item.chapter}:{item.verse}
                  </Text>
                  <Text style={styles.verseText} numberOfLines={2}>
                    {item.text}
                  </Text>
                </View>
                <View style={styles.checkboxContainer}>
                  {isVerseSelected(item) ? (
                    <Ionicons name="checkbox" size={24} color="#007AFF" />
                  ) : (
                    <Ionicons name="square-outline" size={24} color="#999" />
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
      
      {/* Selected verses */}
      {selectedVerses.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.sectionTitle}>
            {t('verseDetail:selectedVerses')} ({selectedVerses.length}):
          </Text>
          <FlatList
            data={selectedVerses}
            keyExtractor={item => item.verse.id}
            renderItem={({ item }) => (
              <View style={styles.selectedItem}>
                <Text style={styles.selectedVerseText}>
                  {item.verse.book} {item.verse.chapter}:{item.verse.verse}
                </Text>
                <TouchableOpacity
                  onPress={() => handleToggleVerseSelection(item.verse)}
                >
                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}
      
      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.saveButton, selectedVerses.length === 0 && styles.disabledButton]}
          onPress={handleSaveConnections}
          disabled={selectedVerses.length === 0 || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {useGroupConnection 
                ? t('verseDetail:createGroupConnection') 
                : t('verseDetail:createIndividualConnections')} 
              {selectedVerses.length > 0 ? `(${selectedVerses.length})` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  typeSelector: {
    marginBottom: 16,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  selectedTypeButton: {
    backgroundColor: '#E1F0FF',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  selectedTypeText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  optionLabel: {
    fontSize: 14,
    color: '#555',
  },
  groupNameContainer: {
    marginBottom: 16,
  },
  groupNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  resultsContainer: {
    marginBottom: 16,
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedResultItem: {
    backgroundColor: '#E1F0FF',
  },
  verseInfo: {
    flex: 1,
  },
  verseReference: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  verseText: {
    fontSize: 13,
    color: '#666',
  },
  checkboxContainer: {
    marginLeft: 8,
  },
  selectedContainer: {
    marginBottom: 16,
  },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  selectedVerseText: {
    fontSize: 14,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
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

export default MultiConnectionSelector; 