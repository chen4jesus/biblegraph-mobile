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

interface AppSettings {
  fontSize: number;
  lineHeight: number;
  autoSave: boolean;
  showVerseNumbers: boolean;
  showCrossReferences: boolean;
  graphLayout: 'force-directed' | 'hierarchical' | 'circular';
}

const SettingsScreen: React.FC = () => {
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading</Text>
          {renderSettingItem(
            'Font Size',
            'Adjust the text size for better readability',
            'slider',
            'fontSize',
            settings.fontSize
          )}
          {renderSettingItem(
            'Line Height',
            'Adjust the spacing between lines',
            'slider',
            'lineHeight',
            settings.lineHeight
          )}
          {renderSettingItem(
            'Show Verse Numbers',
            'Display verse numbers in the text',
            'switch',
            'showVerseNumbers',
            settings.showVerseNumbers
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Graph View</Text>
          {renderSettingItem(
            'Graph Layout',
            'Choose how the graph is displayed',
            'select',
            'graphLayout',
            settings.graphLayout,
            [
              { label: 'Force Directed', value: 'force-directed' },
              { label: 'Hierarchical', value: 'hierarchical' },
              { label: 'Circular', value: 'circular' },
            ]
          )}
          {renderSettingItem(
            'Show Cross References',
            'Display cross-references in the graph',
            'switch',
            'showCrossReferences',
            settings.showCrossReferences
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          {renderSettingItem(
            'Auto Save',
            'Automatically save notes and changes',
            'switch',
            'autoSave',
            settings.autoSave
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
    color: '#666',
    marginRight: 4,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 8,
    minWidth: 30,
  },
  sliderButton: {
    padding: 8,
  },
});

export default SettingsScreen; 