import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';
import resourcesToBackend from 'i18next-resources-to-backend';

// Import translation files directly to avoid dynamic imports
import enTranslation from './locales/en.json';
import zhTranslation from './locales/zh.json';

// Define supported languages
export const LANGUAGES = {
  en: { name: 'English', nativeName: 'English' },
  zh: { name: 'Chinese', nativeName: '中文' },
};

// Resource bundles
const resources = {
  en: enTranslation,
  zh: zhTranslation
};

export const NAMESPACES = ['common', 'home', 'navigation', 'verses', 'notes', 'connections', 'verseDetail', 'graph', 'settings', 'auth', 'group'];

// Custom language detector
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    // Try to get stored language from AsyncStorage
    try {
      const storedLanguage = await AsyncStorage.getItem('@biblegraph:language');
      if (storedLanguage) {
        return callback(storedLanguage);
      }
    } catch (error) {
      console.error('Error reading language from AsyncStorage:', error);
    }

    // If no stored language, use device language
    const deviceLanguages = RNLocalize.getLocales().map(locale => locale.languageCode);
    const detectedLanguage = deviceLanguages.find(language => Object.keys(LANGUAGES).includes(language)) || 'en';
    
    // Store the detected language for future use
    try {
      await AsyncStorage.setItem('@biblegraph:language', detectedLanguage);
    } catch (error) {
      console.error('Error saving language to AsyncStorage:', error);
    }
    
    callback(detectedLanguage);
  },
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem('@biblegraph:language', language);
    } catch (error) {
      console.error('Error saving language to AsyncStorage:', error);
    }
  }
};

// Initialize i18next
i18next
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    ns: NAMESPACES,
    defaultNS: 'common',
    debug: __DEV__,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

// Function to change language
export const changeLanguage = async (language: string) => {
  if (Object.keys(LANGUAGES).includes(language)) {
    await i18next.changeLanguage(language);
    // Cache the language selection
    try {
      await AsyncStorage.setItem('@biblegraph:language', language);
    } catch (error) {
      console.error('Error saving language to AsyncStorage:', error);
    }
  }
};

export default i18next; 