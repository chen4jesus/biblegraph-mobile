import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  Alert,
  ToastAndroid,
  Platform,
  Button,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import BibleGraph from '../components/BibleGraph';
import { useBibleGraph } from '../hooks/useBibleGraph';
import { Verse, Connection, GraphNode, GraphEdge } from '../types/bible';
import { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import { DatabaseService, SyncService } from '../services';
import ForceGraph from '../components/ForceGraph';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import theme from '../theme';
import { showNotification } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for persistent data
const GRAPHVIEW_VERSES_KEY = '@biblegraph:graphview_verses';
const GRAPHVIEW_CONNECTIONS_KEY = '@biblegraph:graphview_connections';
const GRAPHVIEW_LAST_VERSE_IDS_KEY = '@biblegraph:graphview_last_verse_ids';

type GraphViewScreenRouteProp = RouteProp<RootStackParamList, 'GraphView'>;
type GraphViewNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const GraphViewScreen: React.FC = () => {
  const { t } = useTranslation(['graph', 'common']);
  const navigation = useNavigation<GraphViewNavigationProp>();
  const route = useRoute<GraphViewScreenRouteProp>();
  const initialVerseId = route.params?.verseId;
  const initialVerseIds = route.params?.verseIds || [];
  
  const [showControls, setShowControls] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [loadingInitialVerses, setLoadingInitialVerses] = useState(false);
  const [initialVerses, setInitialVerses] = useState<Verse[]>([]);
  const [connectionErrors, setConnectionErrors] = useState(false);
  const errorShownRef = useRef(false);
  
  // Create a state to hold the verse IDs for the useBibleGraph hook
  const [bibleGraphVerseIds, setBibleGraphVerseIds] = useState<string[]>(
    initialVerseId ? [initialVerseId] : initialVerseIds || []
  );
  // Use a ref to track if initialVerses has been processed
  const initialVersesProcessedRef = useRef(false);
  // Add a ref to track the last processed initialVerseIds
  const lastLoadedVerseIdsRef = useRef<string[]>([]);
  
  // State for data
  const [verses, setVerses] = useState<Verse[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewData, setIsNewData] = useState(false);
  
  // Update the initialVersesProcessedRef to hasLoadedDefaultVersesRef
  const hasLoadedDefaultVersesRef = useRef(false);
  
  // Load cached data on mount
  useEffect(() => {
    loadCachedData();
  }, []);
  
  // Load cached verses and connections
  const loadCachedData = async () => {
    try {
      setIsLoading(true);
      
      // Get cached verse IDs
      const cachedVerseIdsStr = await AsyncStorage.getItem(GRAPHVIEW_LAST_VERSE_IDS_KEY);
      let cachedVerseIds: string[] = [];
      
      if (cachedVerseIdsStr) {
        cachedVerseIds = JSON.parse(cachedVerseIdsStr);
        lastLoadedVerseIdsRef.current = cachedVerseIds;
      }
      
      // Check if we need to load new data based on route params
      const verseIdsToCheck = [...(initialVerseIds || [])];
      if (initialVerseId) verseIdsToCheck.push(initialVerseId);
      
      // If we have specific verse IDs in navigation params, use them (explicit selection)
      if (verseIdsToCheck.length > 0) {
        console.log('GraphViewScreen: New verse IDs from navigation, using them instead of cache');
        console.log('GraphViewScreen: Route verse IDs:', verseIdsToCheck);
        setIsNewData(true);
        fetchData();
        return;
      }
      
      // Otherwise, load cached data if we have it
      const cachedVersesStr = await AsyncStorage.getItem(GRAPHVIEW_VERSES_KEY);
      const cachedConnectionsStr = await AsyncStorage.getItem(GRAPHVIEW_CONNECTIONS_KEY);
      
      if (cachedVersesStr && cachedConnectionsStr) {
        const cachedVerses = JSON.parse(cachedVersesStr);
        const cachedConnections = JSON.parse(cachedConnectionsStr);
        
        // If we have valid cached data, use it
        if (cachedVerses.length > 0) {
          console.log('GraphViewScreen: Using cached graph view data with', cachedVerses.length, 'verses');
          setVerses(cachedVerses);
          setConnections(cachedConnections);
          setIsLoading(false);
          hasLoadedDefaultVersesRef.current = true;
          return;
        }
      }
      
      // Otherwise load default verses
      console.log('GraphViewScreen: No valid cache or explicit parameters, loading default verses');
      fetchData();
    } catch (err) {
      console.error('Error loading cached graph view data:', err);
      fetchData();
    }
  };
  
  // Cache the current verses and connections
  const cacheCurrentData = async () => {
    try {
      if (verses.length > 0) {
        console.log('GraphViewScreen: Caching', verses.length, 'verses and', connections.length, 'connections');
        await AsyncStorage.setItem(GRAPHVIEW_VERSES_KEY, JSON.stringify(verses));
        await AsyncStorage.setItem(GRAPHVIEW_CONNECTIONS_KEY, JSON.stringify(connections));
        
        // Store the verse IDs we loaded for future comparison
        const verseIds = verses.map(v => v.id);
        await AsyncStorage.setItem(GRAPHVIEW_LAST_VERSE_IDS_KEY, JSON.stringify(verseIds));
        lastLoadedVerseIdsRef.current = verseIds;
        
        console.log('GraphViewScreen: Data cached successfully');
      }
    } catch (err) {
      console.error('Error caching graph view data:', err);
    }
  };
  
  // Check if we need to load new data when navigation parameters change
  useEffect(() => {
    const verseIdsToCheck = [...(initialVerseIds || [])];
    if (initialVerseId) verseIdsToCheck.push(initialVerseId);
    
    // Only reload if we have explicit verse IDs from navigation
    if (verseIdsToCheck.length > 0) {
      console.log('GraphViewScreen: Received explicit verse IDs, will reload data');
      setIsNewData(true);
      fetchData();
    }
  }, [initialVerseId, initialVerseIds]);
  
  // Update cache when data changes
  useEffect(() => {
    if (verses.length > 0 && !isLoading) {
      cacheCurrentData();
    }
  }, [verses, connections, isLoading]);
  
  // Fetch data (verses and connections)
  const fetchData = useCallback(async () => {
    // If we don't have new data to fetch, and we're not forcing a reload
    // due to explicit verse IDs, then don't fetch
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
        console.log('GraphViewScreen: Initial verse IDs:', initialVerseIds);
        // Add all verse IDs that aren't already included
        initialVerseIds.forEach((id: string) => {
          if (!verseIdsToFetch.includes(id)) {
            verseIdsToFetch.push(id);
          }
        });
      }
      
      // Log the verse IDs we're fetching to help debugging
      console.log('GraphViewScreen: Fetching verses with IDs:', verseIdsToFetch);
      
      // If no verse IDs specified, use some defaults
      if (verseIdsToFetch.length === 0) {
        // Only do this once
        if (!hasLoadedDefaultVersesRef.current) {
          // Fetch some popular verses
          const popularReferences = [
            { book: 'John', chapter: 3, verse: 16 },
            { book: 'Psalm', chapter: 23, verse: 1 },
            { book: 'Genesis', chapter: 1, verse: 1 }
          ];
          
          for (const ref of popularReferences) {
            const verse = await DatabaseService.getVerseByReference(
              ref.book, 
              ref.chapter, 
              ref.verse
            );
            
            if (verse) {
              collectedVerses.push(verse);
              verseIdsToFetch.push(verse.id);
            }
          }
          
          hasLoadedDefaultVersesRef.current = true;
        }
      } else {
        // Fetch specified verses
        const fetchedVerses = await DatabaseService.getVerses(undefined, verseIdsToFetch);
        console.log(`GraphViewScreen: Fetched ${fetchedVerses.length} verses`);
        collectedVerses = fetchedVerses;
      }
      
      // Update state with collected verses
      setVerses(collectedVerses);
      
      // Fetch all connections for the verses
      const allConnections: Connection[] = [];
      const relatedVerseIds = new Set<string>();
      
      for (const verseId of verseIdsToFetch) {
        const verseConnections = await DatabaseService.getConnectionsForVerse(verseId);
        console.log(`GraphViewScreen: Found ${verseConnections.length} connections for verse ${verseId}`);
        
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
      }
      
      console.log(`GraphViewScreen: Total connections: ${allConnections.length}`);
      setConnections(allConnections);
      
      // Fetch related verses if any
      const relatedVerseIdsArray = Array.from(relatedVerseIds).filter(
        id => !verseIdsToFetch.includes(id)
      );
      
      if (relatedVerseIdsArray.length > 0) {
        console.log(`GraphViewScreen: Fetching ${relatedVerseIdsArray.length} related verses`);
        const relatedVerses = await DatabaseService.getVerses(undefined, relatedVerseIdsArray);
        // Add related verses to collected verses
        setVerses(prev => [...prev, ...relatedVerses]);
      }
      
      // Save the verse IDs we just loaded
      lastLoadedVerseIdsRef.current = verseIdsToFetch;
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading graph data:', err);
      setError('Failed to load Bible data');
      setIsLoading(false);
    }
  }, [initialVerseId, initialVerseIds, isNewData]);
  
  // Update the bibleGraphVerseIds whenever initialVerses changes - simplified to run only once per change
  useEffect(() => {
    if (initialVerses.length > 0 && !initialVersesProcessedRef.current) {
      const newIds = initialVerses.map(v => v.id);
      console.debug('Updating bibleGraphVerseIds with:', newIds);
      setBibleGraphVerseIds(newIds);
      initialVersesProcessedRef.current = true;
    }
  }, [initialVerses]);
  
  // Reset the processed flag only when initialVerseIds actually changes
  useEffect(() => {
    const newIdsArray = initialVerseIds && initialVerseIds.length > 0 
      ? [...initialVerseIds].sort()
      : [];
      
    // Check if arrays are different by comparing their contents
    const isDifferent = newIdsArray.length !== lastLoadedVerseIdsRef.current.length ||
                      newIdsArray.some((id, index) => id !== lastLoadedVerseIdsRef.current[index]);
    
    if (isDifferent) {
      initialVersesProcessedRef.current = false;
    }
  }, [initialVerseIds]);
  
  // Load initial verses if verseIds is provided - removed initialVerses from dependencies
  useEffect(() => {
    console.debug('GraphViewScreen - initialVerseIds changed:', initialVerseIds);
    
    // Skip empty verse IDs
    if (!initialVerseIds || initialVerseIds.length === 0) {
      return;
    }
    
    // Use the actual array for comparison, not a string
    const currentIdsArray = [...initialVerseIds].sort();
    
    // If we've already processed these exact IDs, don't reload
    const isSameArray = currentIdsArray.length === lastLoadedVerseIdsRef.current.length &&
                      currentIdsArray.every((id, index) => id === lastLoadedVerseIdsRef.current[index]);
    
    if (isSameArray) {
      console.debug('These IDs were already processed, skipping fetch');
      return;
    }
    
    const loadVerses = async () => {
      setLoadingInitialVerses(true);
      try {
        const verses: Verse[] = [];
        
        for (const id of initialVerseIds) {
          const verse = await DatabaseService.getVerse(id);
          if (verse) {
            verses.push(verse);
          }
        }
        
        console.debug(`Loaded ${verses.length} verses from ${initialVerseIds.length} IDs`);
        if (verses.length > 0) {
          setInitialVerses(verses);
          // Store the processed IDs as array
          lastLoadedVerseIdsRef.current = currentIdsArray;
        }
      } catch (error) {
        console.error('Error loading initial verses:', error);
        showNotification('加载所选经文时出错');
      } finally {
        setLoadingInitialVerses(false);
      }
    };
    
    loadVerses();
  }, [initialVerseIds]);
  
  // Helper function to show notifications cross-platform
  const showNotification = (message: string, title?: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      // Use Alert for iOS
      setTimeout(() => {
        Alert.alert(
          title || '提示',
          message,
          [{ text: '确定', style: 'default' }]
        );
      }, 500);
    }
  };
  
  const {
    nodes,
    edges,
    isLoading: bibleGraphLoading,
    isFetching,
    expandNode,
    currentVerseId,
    setCurrentVerseId,
    zoomToNode,
    error: bibleGraphError
  } = useBibleGraph({
    initialVerseId,
    initialVerseIds: bibleGraphVerseIds
  });

  // When a node is selected, navigate to verse detail
  const handleNodePress = useCallback((node: GraphNode) => {
    if (node.type === 'VERSE') {
      navigation.navigate('VerseDetail', { 
        verseId: node.id,
        activeTab: 'connections'
      });
    } else if (node.type === 'GROUP') {
      // For group nodes, we could either:
      // 1. Show a list of all verses in the group
      // 2. Navigate to a special group detail screen
      navigation.navigate('GroupDetail', { groupId: node.id });
    }
  }, [navigation]);

  const handleRefresh = async () => {
    setConnectionErrors(false);
    errorShownRef.current = false;
    await zoomToNode(currentVerseId);
  };

  const handleResetSync = () => {
    Alert.alert(
      '重置同步状态',
      '这将重置同步状态，可能有助于解决连接问题。是否继续？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '重置',
          onPress: async () => {
            SyncService.resetSyncState();
            setConnectionErrors(false);
            errorShownRef.current = false;
            await zoomToNode(currentVerseId);
            showNotification('同步状态已重置', '成功');
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Create a custom connection handler
  const handleValidatedConnectionPress = (connection: Connection) => {
    // Add additional validation before handling the connection press
    if (!connection || !connection.id || !connection.sourceVerseId || !connection.targetVerseId) {
      console.warn('Invalid connection in GraphViewScreen:', connection);
      return;
    }
    
    // Now it's safe to handle the connection
    setCurrentVerseId(connection.sourceVerseId);
  };

  if (isLoading || loadingInitialVerses) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('graph:loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Error: {String(error)}</Text>
        <View style={styles.errorButtonContainer}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>{t('graph:retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetSyncButton} onPress={handleResetSync}>
            <Text style={styles.resetButtonText}>重置同步</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Make sure we have nodes before rendering
  if (nodes.length === 0) {
    console.debug('No nodes to display yet');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('graph:preparingGraph')}</Text>
      </View>
    );
  }

  console.debug(`Rendering graph with ${nodes.length} nodes and ${edges.length} edges`);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('graph:title')}</Text>
        {currentVerseId && (
          <Text style={styles.subtitle}>
            {initialVerses.find(v => v.id === currentVerseId)?.book} {initialVerses.find(v => v.id === currentVerseId)?.chapter}:{initialVerses.find(v => v.id === currentVerseId)?.verse}
          </Text>
        )}
        {!currentVerseId && initialVerses.length > 0 && (
          <Text style={styles.subtitle}>
            {`已选择 ${initialVerses.length} 个经文`}
          </Text>
        )}
        {connectionErrors && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorSubtitle}>
              警告: 部分连接加载失败
            </Text>
            <TouchableOpacity onPress={handleResetSync} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>重置同步</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {nodes.length === 0 || edges.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="map-outline" size={64} color="#8E8E93" />
          <Text style={styles.emptyText}>{t('graph:noData')}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={handleRefresh}>
              <Text style={styles.buttonText}>{t('graph:refresh')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetSyncButton} onPress={handleResetSync}>
              <Text style={styles.resetButtonText}>重置同步</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.graphContainer}>
          <ForceGraph
            nodes={nodes}
            links={edges}
            onNodePress={handleNodePress}
            showLabels={true}
          />
        </View>
      )}
      
      {showControls && (
        <View style={styles.controls}>
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>{t('graph:showLabels')}</Text>
            <Switch
              value={showLabels}
              onValueChange={setShowLabels}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={showLabels ? '#007AFF' : '#f4f3f4'}
            />
          </View>
          
          <TouchableOpacity style={styles.controlButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={22} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}
      
      {!isLoading && !loadingInitialVerses && (
        <View style={styles.actionContainer}>
          {isFetching && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.fetchingIndicator} />
          )}
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={theme.colors.text} />
          </Pressable>
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
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  graphContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlLabel: {
    marginRight: 8,
    fontSize: 14,
    color: '#000',
  },
  controlButton: {
    padding: 8,
  },
  graph: {
    flex: 1,
  },
  actionContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFE8E6',
    padding: 8,
    marginTop: 8,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  errorSubtitle: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  resetSyncButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fetchingIndicator: {
    marginRight: 10,
  },
});

export default GraphViewScreen; 