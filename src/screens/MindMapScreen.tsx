import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  SafeAreaView, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { DatabaseService } from '../services';
import BibleMindMap from '../components/BibleMindMap';
import { Verse, Connection } from '../types/bible';
import { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for persistent data
const MINDMAP_VERSES_KEY = '@biblegraph:mindmap_verses';
const MINDMAP_CONNECTIONS_KEY = '@biblegraph:mindmap_connections';
const MINDMAP_LAST_VERSE_IDS_KEY = '@biblegraph:mindmap_last_verse_ids';

type MindMapScreenRouteProp = RouteProp<RootStackParamList, 'MindMap'>;
type MindMapNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MindMapScreen: React.FC = () => {
  const { t } = useTranslation(['graph', 'common', 'visualization']);
  const navigation = useNavigation<MindMapNavigationProp>();
  const route = useRoute<MindMapScreenRouteProp>();
  const hasLoadedDefaultVersesRef = useRef(false);
  const lastLoadedVerseIdsRef = useRef<string[]>([]);
  
  // Extract parameters from route
  const initialVerseId = route.params?.verseId;
  const initialVerseIds = route.params?.verseIds || [];
  
  // State for data
  const [verses, setVerses] = useState<Verse[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewData, setIsNewData] = useState(false);
  
  // Log route params for debugging
  useEffect(() => {
    console.log('MindMapScreen initialized with params:', {
      initialVerseId,
      initialVerseIds: initialVerseIds || []
    });
  }, [initialVerseId, initialVerseIds]);
  
  // Add log for verse updates
  useEffect(() => {
    console.log(`MindMapScreen: Verses updated, now have ${verses.length} verses`);
  }, [verses]);

  // Add log for connection updates
  useEffect(() => {
    console.log(`MindMapScreen: Connections updated, now have ${connections.length} connections`);
  }, [connections]);
  
  // Load cached data on mount
  useEffect(() => {
    loadCachedData();
  }, []);
  
  // Determine if we need to load new data based on route params
  const shouldReloadData = useMemo(() => {
    const verseIdsToCheck = [...(initialVerseIds || [])];
    if (initialVerseId) verseIdsToCheck.push(initialVerseId);
    
    if (verseIdsToCheck.length === 0) return false;
    
    return verseIdsToCheck.some(id => !lastLoadedVerseIdsRef.current.includes(id)) || 
           lastLoadedVerseIdsRef.current.length !== verseIdsToCheck.length;
  }, [initialVerseId, initialVerseIds, lastLoadedVerseIdsRef.current]);
  
  // Check if we need to load new data when navigation parameters change
  useEffect(() => {
    if (shouldReloadData) {
      console.log('New verse IDs detected, loading fresh data');
      setIsNewData(true);
      fetchData();
    }
  }, [shouldReloadData]);
  
  // Load cached verses and connections
  const loadCachedData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get cached verse IDs
      const cachedVerseIdsStr = await AsyncStorage.getItem(MINDMAP_LAST_VERSE_IDS_KEY);
      let cachedVerseIds: string[] = [];
      
      if (cachedVerseIdsStr) {
        cachedVerseIds = JSON.parse(cachedVerseIdsStr);
        lastLoadedVerseIdsRef.current = cachedVerseIds;
      }
      
      // Check if we need to load new data based on route params
      const verseIdsToCheck = [...(initialVerseIds || [])];
      if (initialVerseId) verseIdsToCheck.push(initialVerseId);
      
      // If we have specific verse IDs in navigation params, check if they match cached data
      if (verseIdsToCheck.length > 0) {
        const needsReload = verseIdsToCheck.some(id => !cachedVerseIds.includes(id)) || 
                            cachedVerseIds.length !== verseIdsToCheck.length;
        
        if (needsReload) {
          console.log('New verse IDs from navigation, skipping cache');
          setIsNewData(true);
          fetchData();
          return;
        }
      }
      
      // Load cached data if we have it
      const cachedVersesStr = await AsyncStorage.getItem(MINDMAP_VERSES_KEY);
      const cachedConnectionsStr = await AsyncStorage.getItem(MINDMAP_CONNECTIONS_KEY);
      
      if (cachedVersesStr && cachedConnectionsStr) {
        const cachedVerses = JSON.parse(cachedVersesStr);
        const cachedConnections = JSON.parse(cachedConnectionsStr);
        
        // If we have valid cached data, use it
        if (cachedVerses.length > 0) {
          console.log('Using cached mind map data');
          setVerses(cachedVerses);
          setConnections(cachedConnections);
          setIsLoading(false);
          hasLoadedDefaultVersesRef.current = true;
          return;
        }
      }
      
      // Otherwise load from scratch
      fetchData();
    } catch (err) {
      console.error('Error loading cached mind map data:', err);
      fetchData();
    }
  }, [initialVerseId, initialVerseIds]);
  
  // Cache the current verses and connections
  const cacheCurrentData = useCallback(async () => {
    try {
      if (verses.length > 0) {
        await AsyncStorage.setItem(MINDMAP_VERSES_KEY, JSON.stringify(verses));
        await AsyncStorage.setItem(MINDMAP_CONNECTIONS_KEY, JSON.stringify(connections));
        
        // Store the verse IDs we loaded for future comparison
        const verseIds = verses.map(v => v.id);
        await AsyncStorage.setItem(MINDMAP_LAST_VERSE_IDS_KEY, JSON.stringify(verseIds));
        lastLoadedVerseIdsRef.current = verseIds;
        
        console.log('Mind map data cached successfully');
      }
    } catch (err) {
      console.error('Error caching mind map data:', err);
    }
  }, [verses, connections]);
  
  // Update cache when data changes
  useEffect(() => {
    if (verses.length > 0 && !isLoading) {
      cacheCurrentData();
    }
  }, [verses, connections, isLoading, cacheCurrentData]);
  
  // Fetch popular verses as default data
  const fetchDefaultVerses = useCallback(async () => {
    // Only do this once
    if (hasLoadedDefaultVersesRef.current) return [];
    
    const popularReferences = [
      { book: 'John', chapter: 3, verse: 16 },
      { book: 'Psalm', chapter: 23, verse: 1 },
      { book: 'Genesis', chapter: 1, verse: 1 }
    ];
    
    const collectedVerses: Verse[] = [];
    
    for (const ref of popularReferences) {
      const verse = await DatabaseService.getVerseByReference(
        ref.book, 
        ref.chapter, 
        ref.verse
      );
      
      if (verse) {
        collectedVerses.push(verse);
      }
    }
    
    hasLoadedDefaultVersesRef.current = true;
    return collectedVerses;
  }, []);
  
  // Fetch data (verses and connections)
  const fetchData = useCallback(async () => {
    // Skip if we've already loaded default verses and have no specific verses to fetch
    // and we're not explicitly forcing a reload
    if (!isNewData && 
        hasLoadedDefaultVersesRef.current && 
        !initialVerseId && 
        (!initialVerseIds || initialVerseIds.length === 0)) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setIsNewData(false);
    
    try {
      // Collect verse IDs to fetch
      const verseIdsToFetch: string[] = [];
      let collectedVerses: Verse[] = [];
      
      if (initialVerseId) {
        verseIdsToFetch.push(initialVerseId);
      }
      
      if (initialVerseIds && initialVerseIds.length > 0) {
        // Add all verse IDs that aren't already included
        initialVerseIds.forEach((id: string) => {
          if (!verseIdsToFetch.includes(id)) {
            verseIdsToFetch.push(id);
          }
        });
      }
      
      // If no verse IDs specified, use some defaults
      if (verseIdsToFetch.length === 0) {
        const defaultVerses = await fetchDefaultVerses();
        collectedVerses = defaultVerses;
        verseIdsToFetch.push(...defaultVerses.map(v => v.id));
      } else {
        // Fetch specified verses
        const fetchedVerses = await DatabaseService.getVerses(undefined, verseIdsToFetch);
        collectedVerses = fetchedVerses;
      }
      
      // Update state with collected verses
      setVerses(collectedVerses);
      
      // Fetch all connections for the verses
      const allConnections: Connection[] = [];
      const relatedVerseIds = new Set<string>();
      
      // Batch process connections for better performance
      await Promise.all(verseIdsToFetch.map(async (verseId) => {
        const verseConnections = await DatabaseService.getConnectionsForVerse(verseId);
        
        for (const connection of verseConnections) {
          // Add connection if not already added
          if (!allConnections.some(c => c.id === connection.id)) {
            allConnections.push(connection);
          }
          
          // Track related verse IDs
          if (connection.sourceVerseId !== verseId) {
            relatedVerseIds.add(connection.sourceVerseId);
          }
          if (connection.targetVerseId !== verseId) {
            relatedVerseIds.add(connection.targetVerseId);
          }
        }
      }));
      
      setConnections(allConnections);
      
      // Fetch related verses if any
      const relatedVerseIdsArray = Array.from(relatedVerseIds).filter(
        id => !verseIdsToFetch.includes(id)
      );
      
      if (relatedVerseIdsArray.length > 0) {
        const relatedVerses = await DatabaseService.getVerses(undefined, relatedVerseIdsArray);
        // Add related verses to collected verses
        setVerses(prev => [...prev, ...relatedVerses]); 
      }
      
      // Save the verse IDs we just loaded
      lastLoadedVerseIdsRef.current = verseIdsToFetch;
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading mind map data:', err);
      setError('Failed to load Bible data');
      setIsLoading(false);
    }
  }, [initialVerseId, initialVerseIds, isNewData, fetchDefaultVerses]);
  
  // Handle verse selection
  const handleNodeSelect = useCallback((verseId: string) => {
    // Find if this is a verse node (might be a note or other type)
    const selectedVerse = verses.find(v => v.id === verseId);
    
    if (selectedVerse) {
      navigation.navigate('VerseDetail', {
        verseId: verseId,
        activeTab: 'connections'
      });
    }
  }, [verses, navigation]);
  
  // Handle connection selection
  const handleConnectionSelect = useCallback((connectionId: string) => {
    // Optional: navigate to a connection detail screen if you have one
    // For now, we'll just show the connection info in an alert
    const connection = connections.find(c => c.id === connectionId);
    
    if (connection) {
      const sourceVerse = verses.find(v => v.id === connection.sourceVerseId);
      const targetVerse = verses.find(v => v.id === connection.targetVerseId);
      
      Alert.alert(
        `${connection.type} Connection`,
        `From: ${sourceVerse ? `${sourceVerse.book} ${sourceVerse.chapter}:${sourceVerse.verse}` : 'Unknown'}\n` +
        `To: ${targetVerse ? `${targetVerse.book} ${targetVerse.chapter}:${targetVerse.verse}` : 'Unknown'}\n` +
        `${connection.description || ''}`,
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [connections, verses]);
  
  // Handle explicit refresh
  const handleRefresh = useCallback(() => {
    setIsNewData(true);
    fetchData();
  }, [fetchData]);
  
  // Memoize the header component
  const Header = useMemo(() => {
    // Check if we navigated here from VerseDetailScreen by checking if verseId exists in params
    const isFromVerseDetail = route.params?.verseId !== undefined;
    
    return (
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          {isFromVerseDetail ? (
            // Show X button when coming from VerseDetailScreen
            <Ionicons name="close" size={24} color="#333" />
          ) : (
            // Show regular back arrow for other navigation paths
            <Ionicons name="arrow-back" size={24} color="#333" />
          )}
        </TouchableOpacity>
        <Text style={styles.title}>{t('visualization:mindMap')}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>
    );
  }, [navigation, route.params, t, handleRefresh]);
  
  // If there's an error, show error screen
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        {Header}
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.buttonText}>{t('common:retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // If still loading, show loading screen
  if (isLoading || verses.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {Header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>{t('common:loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render the mind map
  return (
    <SafeAreaView style={styles.container}>
      {Header}
      <View style={styles.mapContainer}>
        {verses.length > 0 ? (
          <BibleMindMap
            verses={verses}
            connections={connections}
            onNodeSelect={handleNodeSelect}
            onConnectionSelect={handleConnectionSelect}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No verses to display</Text>
            <TouchableOpacity 
              style={styles.refreshButton} 
              onPress={handleRefresh}
            >
              <Text style={styles.buttonText}>{t('common:retry')}</Text>
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
  },
  mapContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
});

export default MindMapScreen; 