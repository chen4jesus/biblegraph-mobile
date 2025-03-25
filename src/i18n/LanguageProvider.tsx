import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGES, changeLanguage } from './index';

interface LanguageContextType {
  currentLanguage: string;
  switchLanguage: (language: string) => Promise<void>;
  isRTL: boolean;
  languages: typeof LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');

  useEffect(() => {
    // Load saved language from storage on mount
    const loadSavedLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('@biblegraph:language');
        if (savedLanguage && Object.keys(LANGUAGES).includes(savedLanguage)) {
          await changeLanguage(savedLanguage);
        }
      } catch (error) {
        console.error('Failed to load language setting:', error);
      }
    };

    loadSavedLanguage();
  }, []);

  // Update local state when i18n language changes
  useEffect(() => {
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  const switchLanguage = async (language: string) => {
    if (Object.keys(LANGUAGES).includes(language)) {
      await changeLanguage(language);
      setCurrentLanguage(language);
    }
  };

  // Check if the current language is RTL (Right-to-Left)
  // For this app, none of our languages are RTL, but we include this for future-proofing
  const isRTL = ['ar', 'he', 'fa', 'ur'].includes(currentLanguage);

  const contextValue: LanguageContextType = {
    currentLanguage,
    switchLanguage,
    isRTL,
    languages: LANGUAGES,
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  
  return context;
}; 