import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { DatabaseService, AuthService, SyncService, BibleDataService } from '../../services';
import type { Verse, Connection } from '../../services';

/**
 * This is an example component demonstrating how to use the Services API
 * instead of directly importing service implementations.
 */
const ServiceDemoScreen: React.FC = () => {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState({ 
    isConnected: true, 
    isOffline: false,
    mode: 'online'
  });

  // Check database status on mount and update UI accordingly
  useEffect(() => {
    checkDatabaseStatus();
    checkLoginStatus();
  }, []);

  // Function to check database status
  const checkDatabaseStatus = () => {
    const status = BibleDataService.getDatabaseStatus();
    setDatabaseStatus(status);
    
    if (status.isOffline) {
      setSyncStatus(`Running in ${status.mode} mode. Some features may be limited.`);
    }
  };

  // Function to check login status
  const checkLoginStatus = async () => {
    try {
      const isAuth = await AuthService.isAuthenticated();
      setIsLoggedIn(isAuth);
    } catch (err) {
      setError(`Auth error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Function to load verses
  const loadVerses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Initialize database connection if needed
      await DatabaseService.initialize();
      
      // Get verses
      const loadedVerses = await DatabaseService.getVerses();
      setVerses(loadedVerses.slice(0, 10)); // Just get the first 10 for the demo
    } catch (err) {
      setError(`Error loading verses: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to load connections
  const loadConnections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get connections
      const loadedConnections = await DatabaseService.getConnections();
      setConnections(loadedConnections.slice(0, 5)); // Just get the first 5
    } catch (err) {
      setError(`Error loading connections: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check Bible data status
  const checkBibleData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const isLoaded = await BibleDataService.isBibleDataLoaded();
      if (isLoaded) {
        const count = await BibleDataService.getVerseCount();
        setSyncStatus(`Bible data is loaded (${count} verses)`);
      } else {
        setSyncStatus('Bible data is not loaded');
      }
    } catch (err) {
      setError(`Error checking Bible data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to sync data
  const syncData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const isOnline = await SyncService.isOnline();
      if (!isOnline) {
        setSyncStatus('Device is offline, sync not possible');
        return;
      }
      
      const synced = await SyncService.syncData();
      if (synced) {
        const lastSync = await SyncService.getLastSyncTime();
        setSyncStatus(`Sync successful at ${lastSync?.toLocaleString() || 'unknown time'}`);
      } else {
        const status = SyncService.getSyncStatus();
        setSyncStatus(`Sync failed: ${status.lastError || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Error syncing data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Services API Demo</Text>
      
      {/* Database Status section */}
      <View style={[styles.section, databaseStatus.isOffline ? styles.offlineSection : styles.onlineSection]}>
        <Text style={styles.sectionTitle}>Database Status</Text>
        <Text style={databaseStatus.isOffline ? styles.offlineText : styles.onlineText}>
          {databaseStatus.isOffline ? 'OFFLINE MODE' : 'ONLINE MODE'}
        </Text>
        <Text>Using {databaseStatus.isOffline ? 'local storage' : 'Neo4j database'}</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={checkDatabaseStatus}
        >
          <Text style={styles.buttonText}>Check Database Status</Text>
        </TouchableOpacity>
      </View>
      
      {/* Authentication section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Authentication</Text>
        <Text>Status: {isLoggedIn ? 'Logged In' : 'Not Logged In'}</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={checkLoginStatus}
        >
          <Text style={styles.buttonText}>Check Auth Status</Text>
        </TouchableOpacity>
      </View>
      
      {/* Verses section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verses</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={loadVerses}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Load Verses</Text>
        </TouchableOpacity>
        
        {verses.length > 0 && (
          <View style={styles.dataContainer}>
            {verses.map(verse => (
              <Text key={verse.id} style={styles.verse}>
                {verse.book} {verse.chapter}:{verse.verse} - {verse.text.substring(0, 50)}...
              </Text>
            ))}
          </View>
        )}
      </View>
      
      {/* Connections section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connections</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={loadConnections}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Load Connections</Text>
        </TouchableOpacity>
        
        {connections.length > 0 && (
          <View style={styles.dataContainer}>
            {connections.map(connection => (
              <Text key={connection.id} style={styles.connection}>
                {connection.type}: {connection.sourceVerseId} → {connection.targetVerseId}
              </Text>
            ))}
          </View>
        )}
      </View>
      
      {/* Sync section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync & Bible Data</Text>
        <Text>{syncStatus}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.buttonSmall}
            onPress={syncData}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Sync Data</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.buttonSmall}
            onPress={checkBibleData}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Check Bible Data</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Error display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Loading...</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  buttonSmall: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 8,
    flex: 0.48,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dataContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  verse: {
    fontSize: 14,
    marginBottom: 8,
  },
  connection: {
    fontSize: 14,
    marginBottom: 8,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 6,
    marginBottom: 16,
  },
  errorText: {
    color: '#d32f2f',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  offlineSection: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
  },
  onlineSection: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
  },
  offlineText: {
    color: '#856404',
    fontWeight: 'bold',
    fontSize: 16,
  },
  onlineText: {
    color: '#155724',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ServiceDemoScreen; 