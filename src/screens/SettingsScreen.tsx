import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../i18n/LanguageProvider';

interface AppSettings {
  fontSize: number;
  lineHeight: number;
  autoSave: boolean;
  showVerseNumbers: boolean;
  showCrossReferences: boolean;
  graphLayout: 'force-directed' | 'hierarchical' | 'circular';
}

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { currentLanguage } = useLanguage();
  
  const [settings, setSettings] = useState<AppSettings>({
    fontSize: 16,
    lineHeight: 1.5,
    autoSave: true,
    showVerseNumbers: true,
    showCrossReferences: true,
    graphLayout: 'force-directed',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const renderSettingItem = (
    title: string,
    description: string,
    type: 'switch' | 'slider' | 'select',
    key: keyof AppSettings,
    value: any,
    options?: { label: string; value: any }[]
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      {type === 'switch' ? (
        <Switch
          value={value}
          onValueChange={(newValue) => handleSettingChange(key, newValue)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={value ? '#007AFF' : '#f4f3f4'}
        />
      ) : type === 'select' ? (
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => {
            if (options) {
              Alert.alert(
                title,
                'Select an option',
                options.map((option) => ({
                  text: option.label,
                  onPress: () => handleSettingChange(key, option.value),
                }))
              );
            }
          }}
        >
          <Text style={styles.selectValue}>
            {options?.find((opt) => opt.value === value)?.label || value}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      ) : (
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderValue}>{value}</Text>
          <TouchableOpacity
            style={styles.sliderButton}
            onPress={() => handleSettingChange(key, Math.max(12, value - 1))}
          >
            <Ionicons name="remove" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sliderButton}
            onPress={() => handleSettingChange(key, Math.min(24, value + 1))}
          >
            <Ionicons name="add" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderNavigableSettingItem = (
    title: string,
    description: string, 
    currentValue: string,
    onPress: () => void
  ) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
    >
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <View style={styles.navigationItem}>
        <Text style={styles.currentValue}>{currentValue}</Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings:title')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings:readingSection')}</Text>
          {renderSettingItem(
            t('settings:fontSize'),
            t('settings:fontSizeDescription'),
            'slider',
            'fontSize',
            settings.fontSize
          )}
          {renderSettingItem(
            t('settings:lineHeight'),
            t('settings:lineHeightDescription'),
            'slider',
            'lineHeight',
            settings.lineHeight
          )}
          {renderSettingItem(
            t('settings:showVerseNumbers'),
            t('settings:showVerseNumbersDescription'),
            'switch',
            'showVerseNumbers',
            settings.showVerseNumbers
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings:graphViewSection')}</Text>
          {renderSettingItem(
            t('settings:graphLayout'),
            t('settings:graphLayoutDescription'),
            'select',
            'graphLayout',
            settings.graphLayout,
            [
              { label: t('settings:forceDirected'), value: 'force-directed' },
              { label: t('settings:hierarchical'), value: 'hierarchical' },
              { label: t('settings:circular'), value: 'circular' },
            ]
          )}
          {renderSettingItem(
            t('settings:showCrossReferences'),
            t('settings:showCrossReferencesDescription'),
            'switch',
            'showCrossReferences',
            settings.showCrossReferences
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings:generalSection')}</Text>
          {renderSettingItem(
            t('settings:autoSave'),
            t('settings:autoSaveDescription'),
            'switch',
            'autoSave',
            settings.autoSave
          )}
          
          {renderNavigableSettingItem(
            t('settings:language'),
            t('settings:languageDescription'),
            currentLanguage === 'en' ? 'English' : '中文',
            () => navigation.navigate('LanguageSettings')
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  selectValue: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
    minWidth: 24,
    textAlign: 'right',
  },
  sliderButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    marginHorizontal: 4,
  },
  navigationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentValue: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
});

export default SettingsScreen; 