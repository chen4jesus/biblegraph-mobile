import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, NavigationHelpers, ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from './types';
import { AuthService } from '../services';
import LoadingScreen from '../components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { WebViewProvider } from '../contexts/WebViewContext';
import { GlobalWebViewManager } from '../contexts/WebViewManager';
import { Platform, View, Text, Alert, Modal, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { theme, globalStyles } from '../styles/theme';
import { BottomTabNavigationEventMap, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import VerseDetailScreen from '../screens/VerseDetailScreen';
import GraphViewScreen from '../screens/GraphViewScreen';
import NotesScreen from '../screens/NotesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LanguageSettingsScreen from '../screens/LanguageSettingsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import TagsManagementScreen from '../screens/TagsManagementScreen';
import MindMapScreen from '../screens/MindMapScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => {
  const { t } = useTranslation(['navigation', 'common']);
  const [isVisualizationModalVisible, setIsVisualizationModalVisible] = useState<boolean>(false);
  const navigation = useNavigation();

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Graph') {
              iconName = focused ? 'logo-electron' : 'logo-electron';
            } else if (route.name === 'Notes') {
              iconName = focused ? 'document-text' : 'document-text-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }

            return (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: theme.spacing.xs,
              }}>
                <Ionicons name={iconName as any} size={size} color={color} />
                {focused && (
                  <View style={globalStyles.tabBarDot} />
                )}
              </View>
            );
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: globalStyles.tabBar,
          tabBarItemStyle: globalStyles.tabBarItem,
          tabBarLabelStyle: {
            ...theme.typography.tabLabel,
            marginTop: -4,
            paddingBottom: 0,
            marginBottom: 8,
          },
          headerStyle: {
            backgroundColor: theme.colors.background,
            shadowColor: theme.colors.border,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          },
          headerTintColor: theme.colors.text,
          headerTitleStyle: {
            ...theme.typography.h3,
            color: theme.colors.primary,
          },
          headerShadowVisible: true,
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ 
            title: t('home'),
          }}
        />
        <Tab.Screen 
          name="Graph" 
          component={GraphViewScreen} 
          options={{
            title: t('graph'),
          }}
          listeners={({ }) => ({
            tabPress: (e) => {
              // Prevent default behavior
              e.preventDefault();
              
              // Show the custom modal
              setIsVisualizationModalVisible(true);
            }
          })}
        />
        <Tab.Screen 
          name="Notes" 
          component={NotesScreen} 
          options={{ 
            title: t('notes'),
          }}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{ 
            title: t('profile'),
          }}
        />
      </Tab.Navigator>
      
      {/* Visualization Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isVisualizationModalVisible}
        onRequestClose={() => setIsVisualizationModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setIsVisualizationModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('visualization:title')}</Text>
              <TouchableOpacity onPress={() => setIsVisualizationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.modalOption} 
              onPress={() => {
                setIsVisualizationModalVisible(false);
                navigation.navigate('GraphView' as never);
              }}
            >
              <Ionicons name="git-pull-request-outline" size={24} color="#007AFF" />
              <Text style={styles.modalOptionText}>{t('visualization:graph')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption} 
              onPress={() => {
                setIsVisualizationModalVisible(false);
                navigation.navigate('MindMap' as never);
              }}
            >
              <Ionicons name="map-outline" size={24} color="#007AFF" />
              <Text style={styles.modalOptionText}>{t('visualization:mindMap')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const AppNavigator: React.FC = () => {
  const { t } = useTranslation(['navigation', 'common']);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check auth status on component mount and whenever the app gains focus
  const checkAuthStatus = useCallback(async () => {
    try {
      const isAuth = await AuthService.isAuthenticated();
      setIsAuthenticated(isAuth);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  }, []);

  // Check on component mount
  useEffect(() => {
    checkAuthStatus();
    
    // Subscribe to auth state changes
    const unsubscribe = AuthService.addAuthStateListener((isAuth) => {
      setIsAuthenticated(isAuth);
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [checkAuthStatus]);

  if (isAuthenticated === null) {
    return <LoadingScreen />;
  }

  return (
    <WebViewProvider>
      <NavigationContainer
        theme={{
          dark: false,
          colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.background,
            text: theme.colors.text,
            border: theme.colors.border,
            notification: theme.colors.error,
          },
          fonts: {
            regular: {
              fontFamily: 'System',
              fontWeight: '400'
            },
            medium: {
              fontFamily: 'System',
              fontWeight: '500'
            },
            bold: {
              fontFamily: 'System',
              fontWeight: '700'
            },
            heavy: {
              fontFamily: 'System',
              fontWeight: '900'
            }
          }
        }}
      >
        <Stack.Navigator
          initialRouteName={isAuthenticated ? 'MainTabs' : 'Login'}
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme.colors.background,
            },
            animation: 'slide_from_right',
            headerStyle: {
              backgroundColor: theme.colors.background,
            },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              ...theme.typography.h3,
              color: theme.colors.primary,
            },
          }}
        >
          {/* Auth Stack */}
          {!isAuthenticated && (
            <>
              <Stack.Screen 
                name="Login" 
                component={LoginScreen}
                options={{ 
                  title: t('auth:login'),
                  headerShown: false,
                }} 
              />
              <Stack.Screen 
                name="SignUp" 
                component={SignUpScreen}
                options={{ 
                  title: t('auth:signup'),
                  headerShown: true,
                  headerTransparent: true,
                  headerBlurEffect: 'light',
                }} 
              />
              <Stack.Screen 
                name="ForgotPassword" 
                component={ForgotPasswordScreen}
                options={{ 
                  title: t('auth:forgotPassword'),
                  headerShown: true,
                  headerTransparent: true,
                  headerBlurEffect: 'light',
                }} 
              />
            </>
          )}

          {/* Main Stack */}
          {isAuthenticated && (
            <>
              <Stack.Screen 
                name="MainTabs" 
                component={MainTabs}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen 
                name="Search" 
                component={SearchScreen}
                options={{ 
                  title: t('search'),
                  headerShown: true,
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerStyle: {
                    backgroundColor: theme.colors.background,
                  },
                  contentStyle: {
                    backgroundColor: theme.colors.background,
                  },
                }} 
              />
              <Stack.Screen 
                name="VerseDetail" 
                component={VerseDetailScreen} 
                options={{ 
                  title: t('verseDetail:title'),
                  headerShown: true,
                  headerTitleStyle: {
                    ...theme.typography.h3,
                    color: theme.colors.primary,
                  },
                  tabBarItemStyle: { display: 'flex' },
                }}
              />
              <Stack.Screen 
                name="GraphView" 
                component={GraphViewScreen}
                options={{ 
                  title: t('graph'),
                  headerShown: true,
                }} 
              />
              <Stack.Screen 
                name="GroupDetail" 
                component={GroupDetailScreen}
                options={{ 
                  title: t('group:detail'),
                  headerShown: true,
                }} 
              />
              <Stack.Screen 
                name="TagsManagement" 
                component={TagsManagementScreen}
                options={{ 
                  title: t('tags:title'),
                  presentation: 'transparentModal',
                  animation: 'slide_from_right',
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: theme.colors.modalOverlay,
                  },
                }} 
              />
              <Stack.Screen 
                name="Settings" 
                component={SettingsScreen}
                options={{ 
                  title: t('settings'),
                  headerShown: true,
                }} 
              />
              <Stack.Screen 
                name="LanguageSettings" 
                component={LanguageSettingsScreen}
                options={{ 
                  title: t('settings:language'),
                  headerShown: true,
                }} 
              />
              <Stack.Screen 
                name="MindMap" 
                component={MindMapScreen}
                options={{ title: t('visualization:mindMap') }}
              />
            </>
          )}
        </Stack.Navigator>
        
        {/* Global WebView Manager - always visible across screens */}
        <GlobalWebViewManager />
      </NavigationContainer>
    </WebViewProvider>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  modalOptionText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#007AFF',
  },
});

export default AppNavigator; 