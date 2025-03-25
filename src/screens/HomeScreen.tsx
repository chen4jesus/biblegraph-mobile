import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { Verse } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

// Storage key for recent verses
const RECENT_VERSES_KEY = '@biblegraph:recent_verses';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

const HomeScreen: React.FC = () => {
  const { t } = useTranslation(['home', 'navigation', 'common']);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [recentVerses, setRecentVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadRecentVerses();
  }, []);

  const loadRecentVerses = async () => {
    setIsLoading(true);
    try {
      // First try to load from AsyncStorage
      const storedVerses = await AsyncStorage.getItem(RECENT_VERSES_KEY);
      if (storedVerses) {
        const parsedVerses = JSON.parse(storedVerses) as Verse[];
        setRecentVerses(parsedVerses);
      }

      // Then fetch some verses from the database to display if we don't have any stored
      if (!storedVerses || JSON.parse(storedVerses).length === 0) {
        // Get some popular verses
        const popularVerses = await fetchPopularVerses();
        if (popularVerses.length > 0) {
          setRecentVerses(popularVerses);
          // Store them for next time
          await AsyncStorage.setItem(RECENT_VERSES_KEY, JSON.stringify(popularVerses));
        }
      }
    } catch (error) {
      console.error('Error loading recent verses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPopularVerses = async (): Promise<Verse[]> => {
    try {
      // Try to fetch some well-known verses by reference
      const popularReferences = [
        { book: 'John', chapter: 3, verse: 16 },
        { book: 'Psalm', chapter: 23, verse: 1 },
        { book: 'Genesis', chapter: 1, verse: 1 },
        { book: 'Romans', chapter: 8, verse: 28 },
        { book: 'Philippians', chapter: 4, verse: 13 }
      ];
      
      const verses: Verse[] = [];
      
      for (const ref of popularReferences) {
        const verse = await neo4jService.getVerseByReference(
          ref.book, 
          ref.chapter, 
          ref.verse
        );
        
        if (verse) {
          verses.push(verse);
        }
      }
      
      return verses;
    } catch (error) {
      console.error('Error fetching popular verses:', error);
      return [];
    }
  };

  const renderVerseCard = ({ item }: { item: Verse }) => (
    <TouchableOpacity
      style={styles.verseCard}
      onPress={() => {
        navigation.navigate('VerseDetail', { verseId: item.id });
        // Update the recent verses when one is selected
        updateRecentVerses(item);
      }}
    >
      <View style={styles.verseHeader}>
        <Text style={styles.verseReference}>
          {item.book} {item.chapter}:{item.verse}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
      <Text style={styles.verseText} numberOfLines={2}>
        {item.text}
      </Text>
    </TouchableOpacity>
  );

  const updateRecentVerses = async (selectedVerse: Verse) => {
    try {
      // Get current list
      const currentList = [...recentVerses];
      
      // Remove the verse if it already exists in the list (to avoid duplicates)
      const filteredList = currentList.filter(verse => verse.id !== selectedVerse.id);
      
      // Add the selected verse to the beginning of the list
      const updatedList = [selectedVerse, ...filteredList];
      
      // Limit to 10 recent verses
      const limitedList = updatedList.slice(0, 10);
      
      // Update state and storage
      setRecentVerses(limitedList);
      await AsyncStorage.setItem(RECENT_VERSES_KEY, JSON.stringify(limitedList));
    } catch (error) {
      console.error('Error updating recent verses:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('home:title')}</Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('GraphView', {})}
        >
          <Ionicons name="git-network" size={24} color="#007AFF" />
          <Text style={styles.actionText}>{t('navigation:graph')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Notes')}
        >
          <Ionicons name="book" size={24} color="#007AFF" />
          <Text style={styles.actionText}>{t('navigation:notes')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>{t('home:recentVerses')}</Text>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : recentVerses.length > 0 ? (
          <FlatList
            data={recentVerses}
            renderItem={renderVerseCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.verseList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('home:noRecentVerses')}</Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={loadRecentVerses}
            >
              <Text style={styles.refreshButtonText}>{t('home:loadPopularVerses')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  searchButton: {
    padding: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    width: '45%',
  },
  actionText: {
    marginTop: 4,
    color: '#007AFF',
    fontWeight: '500',
  },
  recentSection: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  verseList: {
    paddingBottom: 16,
  },
  verseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verseReference: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  verseText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
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
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  refreshButton: {
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default HomeScreen; 