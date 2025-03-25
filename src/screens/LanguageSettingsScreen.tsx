import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../i18n/LanguageProvider';

const LanguageSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage, switchLanguage, languages } = useLanguage();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings:language')}</Text>
      <Text style={styles.description}>{t('settings:languageDescription')}</Text>
      
      {Object.entries(languages).map(([code, { name, nativeName }]) => (
        <TouchableOpacity
          key={code}
          style={[
            styles.languageOption,
            currentLanguage === code && styles.selectedLanguage,
          ]}
          onPress={() => switchLanguage(code)}
        >
          <Text style={[
            styles.languageName,
            currentLanguage === code && styles.selectedLanguageText,
          ]}>
            {nativeName} ({name})
          </Text>
          {currentLanguage === code && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedLanguage: {
    borderColor: '#3498db',
    backgroundColor: '#ebf5fb',
  },
  languageName: {
    fontSize: 18,
    color: '#333',
  },
  selectedLanguageText: {
    fontWeight: 'bold',
    color: '#3498db',
  },
  checkmark: {
    fontSize: 20,
    color: '#3498db',
  },
});

export default LanguageSettingsScreen; 