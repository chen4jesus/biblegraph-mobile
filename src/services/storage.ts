import AsyncStorage from '@react-native-async-storage/async-storage';
import { Verse, Connection, Note, BibleSettings } from '../types/bible';

const STORAGE_KEYS = {
  VERSES: '@biblegraph:verses',
  CONNECTIONS: '@biblegraph:connections',
  NOTES: '@biblegraph:notes',
  SETTINGS: '@biblegraph:settings',
  LAST_SYNC: '@biblegraph:lastSync',
};

class StorageService {
  private static instance: StorageService;

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Verse methods
  async getVerses(): Promise<Verse[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.VERSES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting verses from storage:', error);
      return [];
    }
  }

  async saveVerses(verses: Verse[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VERSES, JSON.stringify(verses));
    } catch (error) {
      console.error('Error saving verses to storage:', error);
      throw error;
    }
  }

  // Connection methods
  async getConnections(userId?: string): Promise<Connection[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONNECTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting connections from storage:', error);
      return [];
    }
  }

  async saveConnections(connections: Connection[], userId?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections));
    } catch (error) {
      console.error('Error saving connections to storage:', error);
      throw error;
    }
  }

  // Note methods
  async getNotes(userId?: string): Promise<Note[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting notes from storage:', error);
      return [];
    }
  }

  async saveNotes(notes: Note[], userId?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    } catch (error) {
      console.error('Error saving notes to storage:', error);
      throw error;
    }
  }

  // Settings methods
  async getSettings(userId?: string): Promise<BibleSettings | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting settings from storage:', error);
      return null;
    }
  }

  async saveSettings(settings: BibleSettings, userId?: string ): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to storage:', error);
      throw error;
    }
  }

  // Sync methods
  async getLastSync(): Promise<Date | null> {
    try {
      const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  async updateLastSync(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Error updating last sync time:', error);
      throw error;
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }
}

export const storageService = StorageService.getInstance(); 