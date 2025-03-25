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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Verse } from '../types/bible';
import { neo4jService } from '../services/neo4j';
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
        const verses = await neo4jService.searchVerses(searchQuery);
        setResults(verses);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300),
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
          {item.book} {item.chapter}:{item.verse}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
      <Text style={styles.verseText} numberOfLines={2}>
        {item.text}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
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

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#007AFF" />
      ) : (
        <FlatList
          data={results}
          renderItem={renderVerseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            query.length > 0 ? (
              <Text style={styles.emptyText}>{t('verses:noVersesFound')}</Text>
            ) : null
          }
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
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
});

export default SearchScreen; 