import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet, Platform } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { neo4jDriverService } from './src/services/neo4jDriver';
import { bibleDataLoader } from './src/services/bibleDataLoader';
import { LanguageProvider } from './src/i18n/LanguageProvider';
import './src/i18n'; // Import i18n configuration

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // Connect to Neo4j database
        await neo4jDriverService.connect();
        
        console.log('Checking if Bible data is already loaded...');
        // Check if Bible data is already loaded
        const isLoaded = await bibleDataLoader.isBibleLoaded();
        
        if (!isLoaded) {
          console.log('Bible data not loaded. Loading XML data...');
          try {
            // Load data from XML file
            await bibleDataLoader.loadXmlData();
          } catch (xmlError) {
            console.error('Error loading XML data:', xmlError);
            setError(`Failed to load Bible data: ${xmlError instanceof Error ? xmlError.message : 'Unknown error'}`);
          }
        } else {
          console.log('Bible data already loaded in database. Skipping initialization.');
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
        <Text style={styles.text}>Loading Bible Graph...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error</Text>
        <Text style={styles.text}>{error}</Text>
        <Text style={styles.text}>
          Please check your internet connection and restart the app.
          {Platform.OS === 'web' && ' Some features may not work in web browsers.'}
        </Text>
      </View>
    );
  }

  return (
    <LanguageProvider>
      <SafeAreaProvider>
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
  text: {
    fontSize: 16,
    marginVertical: 10,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 20,
  },
});

