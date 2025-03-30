import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, FlatList, Pressable, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../navigation/types';
import { Verse, VerseGroup } from '../types/bible';
import { DatabaseService } from '../services';
import { showNotification } from '../utils/notifications';
import theme from '../theme';

type GroupDetailScreenRouteProp = RouteProp<RootStackParamList, 'GroupDetail'>;
type GroupDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupDetail'>;

const GroupDetailScreen: React.FC = () => {
  const { t } = useTranslation(['group', 'common']);
  const route = useRoute<GroupDetailScreenRouteProp>();
  const navigation = useNavigation<GroupDetailScreenNavigationProp>();
  const { groupId } = route.params;

  const [groupData, setGroupData] = useState<VerseGroup | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroupData = useCallback(async () => {
    console.debug(`[GroupDetailScreen] Loading group data for groupId: ${groupId}`);
    setError(null);
    
    if (!groupId) {
      setError(t('group:invalidGroupId'));
      setLoading(false);
      return;
    }

    try {
      // First load the group data
      const group = await DatabaseService.getVerseGroup(groupId);
      console.debug(`[GroupDetailScreen] Group loaded: ${JSON.stringify(group)}`);
      setGroupData(group);

      // Then load all verses in the group
      if (group && group.verseIds && group.verseIds.length > 0) {
        console.debug(`[GroupDetailScreen] Loading ${group.verseIds.length} verses for group`);
        
        // Use Promise.allSettled to handle potential failures with individual verses
        const versePromises = group.verseIds.map(id => DatabaseService.getVerse(id));
        const results = await Promise.allSettled(versePromises);
        
        // Filter out any failed promises or null results
        const loadedVerses = results
          .filter((result): result is PromiseFulfilledResult<Verse> => 
            result.status === 'fulfilled' && result.value !== null)
          .map(result => result.value);
        
        console.debug(`[GroupDetailScreen] Successfully loaded ${loadedVerses.length} out of ${group.verseIds.length} verses`);
        
        // Sort verses by book, chapter, and verse for consistent display
        const sortedVerses = [...loadedVerses].sort((a, b) => {
          if (a.book !== b.book) return a.book.localeCompare(b.book);
          if (a.chapter !== b.chapter) return a.chapter - b.chapter;
          return a.verse - b.verse;
        });
        
        setVerses(sortedVerses);
      } else {
        console.warn('[GroupDetailScreen] No verse IDs found in group data');
        setVerses([]);
      }
    } catch (err) {
      console.error('[GroupDetailScreen] Error loading group data:', err);
      setError(t('group:loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGroupData();
  };

  const handleVersePress = (verse: Verse) => {
    navigation.navigate('VerseDetail', { verseId: verse.id });
  };

  const handleEditGroup = () => {
    // Navigate to edit screen or open modal
    Alert.alert(t('group:editNotImplemented'));
  };

  const handleShare = () => {
    // Share functionality
    Alert.alert(t('group:shareNotImplemented'));
  };

  const renderVerseItem = ({ item }: { item: Verse }) => (
    <Pressable
      style={styles.verseItem}
      onPress={() => handleVersePress(item)}
      android_ripple={{ color: 'rgba(0, 0, 0, 0.1)' }}
    >
      <View style={styles.verseContent}>
        <Text style={styles.verseReference}>
          {item.book} {item.chapter}:{item.verse} ({item.translation})
        </Text>
        <Text style={styles.verseText} numberOfLines={3}>
          {item.text}
        </Text>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('common:loading')}</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadGroupData}>
          <Text style={styles.retryButtonText}>{t('common:retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!groupData) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('group:notFound')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>{t('common:goBack')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{groupData.name}</Text>
        {groupData.description ? (
          <Text style={styles.description}>{groupData.description}</Text>
        ) : null}
        <Text style={styles.infoText}>
          {t('group:containsVerses', { count: verses.length })}
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleEditGroup}>
          <MaterialCommunityIcons name="pencil" size={20} color="white" />
          <Text style={styles.actionButtonText}>{t('common:edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <MaterialCommunityIcons name="share-variant" size={20} color="white" />
          <Text style={styles.actionButtonText}>{t('common:share')}</Text>
        </TouchableOpacity>
      </View>

      {verses.length > 0 ? (
        <FlatList
          data={verses}
          keyExtractor={(item) => item.id}
          renderItem={renderVerseItem}
          contentContainerStyle={styles.versesList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>{t('group:verses')}</Text>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('group:noVerses')}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.disabled,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.disabled,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: theme.colors.text,
  },
  versesList: {
    padding: 16,
  },
  verseItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  verseContent: {
    flex: 1,
  },
  verseReference: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  verseText: {
    fontSize: 15,
    color: theme.colors.text,
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
});

export default GroupDetailScreen; 