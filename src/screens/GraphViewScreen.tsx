import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import BibleGraph from '../components/BibleGraph';
import { useBibleGraph } from '../hooks/useBibleGraph';
import { Verse, Connection } from '../types/bible';
import { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';

type GraphViewScreenRouteProp = RouteProp<RootStackParamList, 'GraphView'>;

const GraphViewScreen: React.FC = () => {
  const { t } = useTranslation(['graph']);
  const navigation = useNavigation();
  const route = useRoute<GraphViewScreenRouteProp>();
  const initialVerseId = route.params?.verseId;
  
  const [showControls, setShowControls] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  
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
    initialVerseId,
    onVersePress: (verse) => {
      // Navigate to verse detail when a verse is pressed
      navigation.navigate('VerseDetail', { verseId: verse.id });
    },
  });

  const handleRefresh = async () => {
    await refreshGraph();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading graph data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
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
      </View>
      
      {verses.length === 0 || connections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="map-outline" size={64} color="#8E8E93" />
          <Text style={styles.emptyText}>No graph data available</Text>
          <TouchableOpacity style={styles.button} onPress={handleRefresh}>
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>
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
            <Text style={styles.controlLabel}>Show Labels</Text>
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
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
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
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
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
});

export default GraphViewScreen; 