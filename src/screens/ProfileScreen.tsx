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
  Button,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService, StorageService } from '../services';
import { User } from '../types/bible';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

interface UserSettings {
  darkMode: boolean;
  offlineMode: boolean;
  notifications: boolean;
  defaultTranslation: string;
}

const ProfileScreen: React.FC = () => {
  const { t } = useTranslation(['profile', 'common', 'settings']);
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    darkMode: false,
    offlineMode: false,
    notifications: true,
    defaultTranslation: 'ESV',
  });

  useEffect(() => {
    loadUserData();
    loadSettings();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AuthService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadSettings = async () => {
    try {
      // Get Bible settings from the storage service
      const bibleSettings = await StorageService.getSettings();
      
      // Get user interface settings from AsyncStorage
      const savedUISettings = await AsyncStorage.getItem('userSettings');
      if (savedUISettings) {
        setSettings(JSON.parse(savedUISettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSettingChange = async (key: keyof UserSettings, value: boolean | string) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      
      // Save UI settings to AsyncStorage
      await AsyncStorage.setItem('userSettings', JSON.stringify(newSettings));
      
      // If this setting also affects Bible display, update those settings too
      if (key === 'defaultTranslation') {
        const bibleSettings = await StorageService.getSettings();
        // Update only relevant Bible settings, preserving the rest
        if (bibleSettings) {
          await StorageService.saveSettings(bibleSettings);
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleLogout = async () => {
    console.log("Logout button pressed");
    
    // Implement direct logout without alert for reliable functionality
    try {
      // Clear all user data and settings
      await AuthService.debugout();
      
      // Clear any additional stored data
      await AsyncStorage.removeItem('userSettings');
      
      // Navigate to Login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      
      console.log("Logout completed successfully");
    } catch (error) {
      console.error('Error logging out:', error);
      // Show error as text alert instead of using Alert API
      Alert.alert(t('common:error'), t('profile:logoutError'));
    }
  };

  const renderSettingItem = (
    title: string,
    description: string,
    type: 'switch' | 'select',
    key: keyof UserSettings,
    value: boolean | string,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={type === 'select' ? onPress : undefined}
    >
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      {type === 'switch' ? (
        <Switch
          value={value as boolean}
          onValueChange={(newValue) => handleSettingChange(key, newValue)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={value ? '#007AFF' : '#f4f3f4'}
        />
      ) : (
        <View style={styles.selectValue}>
          <Text style={styles.selectValueText}>{value}</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('title')}</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {user && (
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('appearance')}</Text>
          {renderSettingItem(
            t('darkMode'),
            t('darkModeDescription'),
            'switch',
            'darkMode',
            settings.darkMode
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('preferences')}</Text>
          {renderSettingItem(
            t('offlineMode'),
            t('offlineModeDescription'),
            'switch',
            'offlineMode',
            settings.offlineMode
          )}
          {renderSettingItem(
            t('notifications'),
            t('notificationsDescription'),
            'switch',
            'notifications',
            settings.notifications
          )}
          {renderSettingItem(
            t('defaultTranslation'),
            t('defaultTranslationDescription'),
            'select',
            'defaultTranslation',
            settings.defaultTranslation,
            () => {
              // Show translation selection modal
            }
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('account')}</Text>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.6}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profile:logout')}
            accessibilityHint={t('profile:confirmLogout')}
          >
            <Text style={styles.logoutText}>{t('profile:logout')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.menuItem]}
            onPress={() => navigation.navigate('MyContent')}
          >
            <MaterialIcons name="library-books" size={24} color="#4F46E5" />
            <Text style={styles.menuItemText}>
              {t('profile:myContent')}
            </Text>
            <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
          </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  settingsButton: {
    padding: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
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
  selectValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValueText: {
    fontSize: 16,
    color: '#666',
    marginRight: 4,
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 16,
  },
});

export default ProfileScreen; 