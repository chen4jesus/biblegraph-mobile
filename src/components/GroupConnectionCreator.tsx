import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput,
  ActivityIndicator,
  Modal,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { VerseGroup, ConnectionType, GroupConnection } from '../types/bible';
import { DatabaseService } from '../services';

// Define theme colors since we might not have access to the actual theme file
const theme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    primary: '#007AFF',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    error: '#FF3B30',
  }
};

interface GroupConnectionCreatorProps {
  sourceGroup: VerseGroup;
  onConnectionCreated: (connection: GroupConnection) => void;
}

const GroupConnectionCreator: React.FC<GroupConnectionCreatorProps> = ({ 
  sourceGroup,
  onConnectionCreated 
}) => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<VerseGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<VerseGroup[]>([]);
  const [connectionType, setConnectionType] = useState<ConnectionType>(ConnectionType.THEME);
  const [connectionDescription, setConnectionDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      // This would need to be implemented in the neo4jService
      // For now, we'll mock empty groups or you can implement it
      const result: VerseGroup[] = [];
      
      // Filter out the source group
      const filteredGroups = result.filter(group => group.id !== sourceGroup.id);
      
      setGroups(filteredGroups);
    } catch (err) {
      console.error('Error loading verse groups:', err);
      setError(t('groups.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupSelection = (group: VerseGroup) => {
    if (selectedGroups.some(g => g.id === group.id)) {
      setSelectedGroups(selectedGroups.filter(g => g.id !== group.id));
    } else {
      setSelectedGroups([...selectedGroups, group]);
    }
  };

  const filteredGroups = searchText.trim().length > 0
    ? groups.filter(group => 
        group.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (group.description && group.description.toLowerCase().includes(searchText.toLowerCase()))
      )
    : groups;

  const handleCreateConnection = async () => {
    if (selectedGroups.length === 0) {
      setError(t('connections.noGroupsSelected'));
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Collect all target verse IDs
      const targetGroupIds = selectedGroups.map(group => group.id);
      
      const newConnection = await DatabaseService.createGroupConnection(
        [sourceGroup.id],
        targetGroupIds,
        connectionType,
        connectionDescription.trim()
      );
      
      onConnectionCreated(newConnection);
      
      // Reset form
      setSelectedGroups([]);
      setConnectionDescription('');
      setConnectionType(ConnectionType.THEME);
      
      Alert.alert(
        t('connections.success'),
        t('connections.createdSuccessfully'),
        [{ text: t('common.ok') }]
      );
      
      // Close modal
      setConfirmModalVisible(false);
    } catch (err) {
      console.error('Error creating group connection:', err);
      setError(t('connections.createError'));
      setConfirmModalVisible(false);
    } finally {
      setCreating(false);
    }
  };

  const openConfirmModal = () => {
    if (selectedGroups.length === 0) {
      setError(t('connections.noGroupsSelected'));
      return;
    }
    
    setConfirmModalVisible(true);
  };

  const renderGroupItem = ({ item }: { item: VerseGroup }) => {
    const isSelected = selectedGroups.some(g => g.id === item.id);
    
    return (
      <TouchableOpacity
        style={[styles.groupItem, isSelected && styles.selectedGroupItem]}
        onPress={() => toggleGroupSelection(item)}
      >
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.groupDescription} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <Text style={styles.groupVersesCount}>
            {t('groups.versesCount', { count: item.verseIds.length })}
          </Text>
        </View>
        <Text style={styles.checkbox}>{isSelected ? '✓' : ''}</Text>
      </TouchableOpacity>
    );
  };

  const connectionTypes: ConnectionType[] = [
    ConnectionType.CROSS_REFERENCE,
    ConnectionType.PARALLEL,
    ConnectionType.THEMATIC,
    ConnectionType.PROPHECY,
    ConnectionType.NOTE,
  ];

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('connections.connectWith', { name: sourceGroup.name })}
        </Text>
      </View>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('groups.search')}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>
      
      <View style={styles.connectionTypeContainer}>
        <Text style={styles.sectionTitle}>{t('connections.selectType')}</Text>
        <FlatList
          data={connectionTypes}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.connectionTypeButton,
                connectionType === item && styles.selectedTypeButton
              ]}
              onPress={() => setConnectionType(item)}
            >
              <Text 
                style={[
                  styles.connectionTypeText,
                  connectionType === item && styles.selectedTypeText
                ]}
              >
                {t(`connectionTypes.${item.toLowerCase()}`)}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.connectionTypeList}
        />
      </View>
      
      <Text style={styles.sectionTitle}>{t('connections.description')}</Text>
      <TextInput
        style={styles.descriptionInput}
        value={connectionDescription}
        onChangeText={setConnectionDescription}
        placeholder={t('connections.descriptionPlaceholder')}
        placeholderTextColor={theme.colors.textSecondary}
        multiline
        numberOfLines={3}
      />
      
      <Text style={styles.sectionTitle}>{t('connections.selectGroups')}</Text>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : filteredGroups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchText.trim().length > 0 
              ? t('groups.noSearchResults') 
              : t('groups.noGroups')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          style={styles.groupsList}
        />
      )}
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={openConfirmModal}
          disabled={creating || selectedGroups.length === 0}
        >
          <Text style={styles.createButtonText}>
            {t('connections.createConnection')}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Confirmation Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('connections.confirm')}</Text>
            
            <Text style={styles.modalText}>
              {t('connections.confirmText', {
                count: selectedGroups.length,
                type: t(`connectionTypes.${connectionType.toLowerCase()}`),
                source: sourceGroup.name
              })}
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateConnection}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>{t('common.confirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  connectionTypeContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 16,
  },
  connectionTypeList: {
    paddingHorizontal: 16,
  },
  connectionTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    marginRight: 8,
  },
  selectedTypeButton: {
    backgroundColor: theme.colors.primary,
  },
  connectionTypeText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  selectedTypeText: {
    color: 'white',
  },
  descriptionInput: {
    marginHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  groupsList: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedGroupItem: {
    borderColor: theme.colors.primary,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  groupVersesCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  checkbox: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.error,
    padding: 16,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '500',
  },
});

export default GroupConnectionCreator; 