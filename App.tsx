import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { neo4jDriverService } from './src/services/neo4jDriver';
import { bibleDataLoader } from './src/services/bibleDataLoader';
import { LanguageProvider } from './src/i18n/LanguageProvider';
import './src/i18n'; // Import i18n configuration

export default function App() {
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // Initialize Neo4j database
        await neo4jDriverService.connect();
        
        // Load sample data
        await bibleDataLoader.loadSampleData();
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeDatabase();
  }, []);

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AppNavigator />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
