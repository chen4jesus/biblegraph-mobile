import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet, Platform } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { LanguageProvider } from './src/i18n/LanguageProvider';
import './src/i18n'; // Import i18n configuration
import { useTranslation } from 'react-i18next';
import { DatabaseService, BibleDataService } from './src/services';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading Bible Graph...');
  const { t } = useTranslation();

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // Initialize database services
        setLoadingMessage('Initializing database...');
        await DatabaseService.initialize();
        
        // Check if we're in offline mode after initialization
        const isOffline = DatabaseService.isOfflineMode();
        if (isOffline) {
          setWarning('Neo4j database is not available. Running in offline mode with limited functionality.');
          console.warn('Neo4j database not available. Running in offline mode.');
        }
        
        console.debug('Checking if Bible data is already loaded...');
        setLoadingMessage('Checking database...');
        
        // Check if Bible data is already loaded
        const isLoaded = await BibleDataService.isBibleDataLoaded();
        
        if (!isLoaded && !isOffline) {
          console.debug('Bible data not loaded. Loading XML data...');
          setLoadingMessage('Loading Bible data from XML (limited to 5000 verses)...');
          
          try {
            // Load data from XML file
            await BibleDataService.loadBibleData();
          } catch (xmlError) {
            console.error('Error loading XML data:', xmlError);
            setWarning(`Failed to load full Bible data: ${xmlError instanceof Error ? xmlError.message : 'Unknown error'}`);
          }
        } else if (!isLoaded && isOffline) {
          setWarning('Running in offline mode with no Bible data. Some features will be unavailable.');
        } else {
          console.debug('Bible data available. Ready to proceed.');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setError(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoading(false);
      }
    };

    initializeDatabase();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>{loadingMessage}</Text>
        <Text style={styles.subText}>
          {t('common:databasePerformance')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('common:error')}</Text>
        <Text style={styles.text}>{error}</Text>
        <Text style={styles.text}>
          {t('common:pleaseCheckInternetConnection')}
          {Platform.OS === 'web' && ' ' + t('common:someFeaturesMayNotWorkInWebBrowsers')}
        </Text>
      </View>
    );
  }

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        {warning && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        )}
        <AppNavigator />
      </SafeAreaProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '500',
    marginVertical: 10,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    marginVertical: 10,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
    maxWidth: '80%',
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 20,
  },
  warningContainer: {
    backgroundColor: '#FFF3CD',
    padding: 10,
    width: '100%',
    zIndex: 999,
  },
  warningText: {
    color: '#856404',
    textAlign: 'center',
    fontSize: 14,
  }
});

