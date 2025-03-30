import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Verse } from '../types/bible';
import { DatabaseService } from '../services';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';

type SearchScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Search'>;

const SearchScreen: React.FC = () => {
  const { t } = useTranslation(['common', 'navigation']);
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchVerses = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const verses = await DatabaseService.searchVerses(searchQuery);
        setResults(verses);
        
        console.debug(`Search returned ${verses.length} results`);
        if (verses.length > 0) {
          console.debug('First verse:', verses[0]);
        }
      } catch (error) {
        console.error('Search error:', error);
        Alert.alert('Search Error', 'There was a problem with your search. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 500),
    []
  );

  const handleSearch = (text: string) => {
    setQuery(text);
    searchVerses(text);
  };

  const renderVerseItem = ({ item }: { item: Verse }) => (
    <TouchableOpacity
      style={styles.verseItem}
      onPress={() => navigation.navigate('VerseDetail', { verseId: item.id })}
    >
      <View style={styles.verseHeader}>
        <Text style={styles.verseReference}>
          {item.book || 'Unknown'} {item.chapter || '?'}:{item.verse || '?'}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
      <Text style={styles.verseText} numberOfLines={2}>
        {item.text || 'No verse text available'}
      </Text>
      {item.translation && (
        <Text style={styles.translation}>{item.translation}</Text>
      )}
    </TouchableOpacity>
  );

  const EmptyState = ({ query }: { query: string }) => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={50} color="#ddd" />
      {query.length > 0 ? (
        <>
          <Text style={styles.emptyText}>{t('common:noVersesFound')}</Text>
          <Text style={styles.emptySubtext}>{t('common:tryDifferentSearchTerm')}</Text>
        </>
      ) : (
        <Text style={styles.emptyText}>{t('common:enterAtLeast2Chars')}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('common:search')}
            value={query}
            onChangeText={handleSearch}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setQuery('');
                setResults([]);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#007AFF" />
      ) : (
        <FlatList
          data={results}
          renderItem={renderVerseItem}
          keyExtractor={(item) => item.id || `temp-${Math.random()}`}
          contentContainerStyle={[
            styles.resultsList,
            results.length === 0 && styles.emptyResultsList
          ]}
          ListEmptyComponent={<EmptyState query={query} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 8,
    marginRight: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    padding: 8,
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
  loader: {
    marginTop: 20,
  },
  resultsList: {
    padding: 16,
  },
  verseItem: {
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  emptyResultsList: {
    flex: 1,
    justifyContent: 'center',
  },
  translation: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default SearchScreen; 