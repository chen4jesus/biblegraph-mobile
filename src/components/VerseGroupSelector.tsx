import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Verse, VerseGroup } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import theme from '../theme';

interface VerseGroupSelectorProps {
  selectedVerses: Verse[];
  onSelect: (groupId: string) => void;
  onCreateGroup: (group: VerseGroup) => void;
}

const VerseGroupSelector: React.FC<VerseGroupSelectorProps> = ({ 
  selectedVerses, 
  onSelect,
  onCreateGroup 
}) => {
  const { t } = useTranslation(['group', 'common']);
  const [groups, setGroups] = useState<VerseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('[VerseGroupSelector] Loading verse groups');
        const loadedGroups = await neo4jService.getVerseGroups();
        console.log(`[VerseGroupSelector] Loaded ${loadedGroups.length} verse groups`);
        
        // Ensure each group has valid verseIds to prevent rendering issues
        const validatedGroups = loadedGroups.map(group => ({
          ...group,
          verseIds: Array.isArray(group.verseIds) ? group.verseIds : []
        }));
        
        setGroups(validatedGroups);
      } catch (error) {
        console.error('[VerseGroupSelector] Error loading verse groups:', error);
        setError(t('group:loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, [t]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert(t('common:error'), t('group:nameRequired'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const verseIds = selectedVerses.map(verse => verse.id);
      
      // Create a description if none provided
      let description = newGroupDescription.trim();
      if (!description && selectedVerses.length > 0) {
        const firstVerse = selectedVerses[0];
        description = `${verseIds.length} verses connected to ${firstVerse.book} ${firstVerse.chapter}:${firstVerse.verse}`;
      }
      
      console.log(`[VerseGroupSelector] Creating verse group "${newGroupName}" with ${verseIds.length} verses`);
      const newGroup = await neo4jService.createVerseGroup(
        newGroupName,
        verseIds,
        description
      );
      console.log(`[VerseGroupSelector] Verse group created with ID: ${newGroup.id}`);
      
      // Reset form
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateForm(false);
      
      // Notify parent
      onCreateGroup(newGroup);
      
      // Refresh groups list
      setGroups(prevGroups => [newGroup, ...prevGroups]);
      
      // Show success message
      Alert.alert(t('common:success'), t('group:createSuccess'));
    } catch (error) {
      console.error('[VerseGroupSelector] Error creating verse group:', error);
      Alert.alert(t('common:error'), t('group:createError'));
    } finally {
      setLoading(false);
    }
  };

  const renderGroup = ({ item }: { item: VerseGroup }) => (
    <TouchableOpacity 
      style={styles.groupItem}
      onPress={() => onSelect(item.id)}
      // Add a key to ensure uniqueness
      key={item.id}
    >
      <Text style={styles.groupName}>{item.name}</Text>
      {item.description && (
        <Text style={styles.groupDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <Text style={styles.groupVersesCount}>
        {t('group:versesCount', { count: item.verseIds.length })}
      </Text>
    </TouchableOpacity>
  );

  const renderCreateForm = () => (
    <View style={styles.createForm}>
      <Text style={styles.formTitle}>{t('group:create')}</Text>
      
      <TextInput
        style={styles.input}
        placeholder={t('group:enterName')}
        value={newGroupName}
        onChangeText={setNewGroupName}
      />
      
      <TextInput
        style={[styles.input, styles.multilineInput]}
        placeholder={t('group:enterDescription')}
        value={newGroupDescription}
        onChangeText={setNewGroupDescription}
        multiline
      />
      
      <View style={styles.formButtons}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => setShowCreateForm(false)}
        >
          <Text style={styles.cancelButtonText}>{t('common:cancel')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.createButton]}
          onPress={handleCreateGroup}
        >
          <Text style={styles.createButtonText}>{t('common:save')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {!showCreateForm ? (
        <>
          <TouchableOpacity
            style={styles.createGroupButton}
            onPress={() => setShowCreateForm(true)}
          >
            <Text style={styles.createGroupButtonText}>
              {t('group:create')}
            </Text>
          </TouchableOpacity>
          
          {groups.length > 0 ? (
            <FlatList
              data={groups}
              renderItem={renderGroup}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.groupsList}
              ListHeaderComponent={
                <Text style={styles.sectionTitle}>{t('group:title')}</Text>
              }
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {loading ? t('common:loading') : t('group:noGroupsYet')}
              </Text>
            </View>
          )}
        </>
      ) : renderCreateForm()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  groupsList: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.text,
  },
  groupItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  groupVersesCount: {
    fontSize: 12,
    color: theme.colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  createGroupButton: {
    backgroundColor: theme.colors.primary,
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createGroupButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  createForm: {
    padding: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.disabled,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.disabled,
  },
  cancelButtonText: {
    color: theme.colors.text,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
  },
});

export default VerseGroupSelector; 