import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import BibleGraph from '../components/BibleGraph';
import { useBibleGraph } from '../hooks/useBibleGraph';
import { Verse, Connection } from '../types/bible';
import { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import { neo4jService } from '../services/neo4j';
import { syncService } from '../services/sync';

type GraphViewScreenRouteProp = RouteProp<RootStackParamList, 'GraphView'>;
type GraphViewNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const GraphViewScreen: React.FC = () => {
  const { t } = useTranslation(['graph']);
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
  const [bibleGraphVerseIds, setBibleGraphVerseIds] = useState<string[]>(initialVerseIds);
  // Use a ref to track if initialVerses has been processed
  const initialVersesProcessedRef = useRef(false);
  
  // Update the bibleGraphVerseIds whenever initialVerses changes
  useEffect(() => {
    if (initialVerses.length > 0 && !initialVersesProcessedRef.current) {
      const newIds = initialVerses.map(v => v.id);
      console.log('Updating bibleGraphVerseIds with:', newIds);
      setBibleGraphVerseIds(newIds);
      initialVersesProcessedRef.current = true;
    }
  }, [initialVerses]);
  
  // Reset the processed flag when initialVerseIds changes
  useEffect(() => {
    initialVersesProcessedRef.current = false;
  }, [initialVerseIds]);
  
  // Load initial verses if verseIds is provided
  useEffect(() => {
    console.log('GraphViewScreen - initialVerseIds changed:', initialVerseIds);
    
    // Skip empty or already processed verse IDs
    if (!initialVerseIds || initialVerseIds.length === 0) {
      return;
    }
    
    // Compare with current initialVerses to avoid redundant loading
    const currentIds = new Set(initialVerses.map(v => v.id));
    const hasAllIds = initialVerseIds.every(id => currentIds.has(id));
    
    if (hasAllIds) {
      console.log('All verse IDs already loaded, skipping fetch');
      return;
    }
    
    const loadVerses = async () => {
      setLoadingInitialVerses(true);
      try {
        const verses: Verse[] = [];
        
        for (const id of initialVerseIds) {
          const verse = await neo4jService.getVerse(id);
          if (verse) {
            verses.push(verse);
          }
        }
        
        console.log(`Loaded ${verses.length} verses from ${initialVerseIds.length} IDs`);
        if (verses.length > 0) {
          setInitialVerses(verses);
        }
      } catch (error) {
        console.error('Error loading initial verses:', error);
        showNotification('加载所选经文时出错');
      } finally {
        setLoadingInitialVerses(false);
      }
    };
    
    loadVerses();
  }, [initialVerseIds, initialVerses]);
  
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
    verses,
    connections,
    loading,
    error,
    selectedVerse,
    selectedConnection,
    handleVersePress,
    handleConnectionPress,
    refreshGraph,
  } = useBibleGraph({
    initialVerseId: initialVerseId || (initialVerses.length > 0 ? initialVerses[0].id : undefined),
    initialVerseIds: bibleGraphVerseIds,
    onVersePress: (verse) => {
      // Navigate to verse detail when a verse is pressed
      navigation.navigate('VerseDetail', { verseId: verse.id });
    },
    onConnectionError: () => {
      setConnectionErrors(true);
      // Show toast/alert only once
      if (!errorShownRef.current) {
        errorShownRef.current = true;
        showNotification('部分连接加载失败，显示部分图形', '警告');
      }
    }
  });

  const handleRefresh = async () => {
    setConnectionErrors(false);
    errorShownRef.current = false;
    await refreshGraph();
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
            syncService.resetSyncState();
            setConnectionErrors(false);
            errorShownRef.current = false;
            await refreshGraph();
            showNotification('同步状态已重置', '成功');
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (loading || loadingInitialVerses) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{t('graph:loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Error: {error}</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('graph:title')}</Text>
        {selectedVerse && (
          <Text style={styles.subtitle}>
            {selectedVerse.book} {selectedVerse.chapter}:{selectedVerse.verse}
          </Text>
        )}
        {!selectedVerse && initialVerses.length > 0 && (
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
      
      {verses.length === 0 || connections.length === 0 ? (
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
          <BibleGraph
            verses={verses}
            connections={connections}
            onVersePress={handleVersePress}
            onConnectionPress={handleConnectionPress}
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
            <Ionicons name="close" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}
      
      {selectedConnection && (
        <View style={styles.connectionInfo}>
          <Text style={styles.connectionType}>
            {selectedConnection.type.replace('_', ' ')}
          </Text>
          <Text style={styles.connectionDescription}>
            {selectedConnection.description}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  connectionInfo: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectionType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  connectionDescription: {
    fontSize: 14,
    color: '#333',
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
});

export default GraphViewScreen; 