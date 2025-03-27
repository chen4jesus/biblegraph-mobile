import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from './types';
import { authService } from '../services/auth';
import LoadingScreen from '../components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

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

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => {
  const { t } = useTranslation('navigation');

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Graph') {
            iconName = focused ? 'git-network' : 'git-network-outline';
          } else if (route.name === 'Notes') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: t('home') }}
      />
      <Tab.Screen 
        name="Graph" 
        component={GraphViewScreen} 
        options={{ title: t('graph') }}
      />
      <Tab.Screen 
        name="Notes" 
        component={NotesScreen} 
        options={{ title: t('notes') }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: t('profile') }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const { t } = useTranslation(['navigation', 'common']);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check auth status on component mount and whenever the app gains focus
  const checkAuthStatus = useCallback(async () => {
    try {
      const isAuth = await authService.isAuthenticated();
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
    const unsubscribe = authService.addAuthStateListener((isAuth) => {
      setIsAuthenticated(isAuth);
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [checkAuthStatus]);

  if (isAuthenticated === null) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'MainTabs' : 'Login'}
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Auth Stack */}
        {!isAuthenticated && (
          <>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ title: t('auth:login') }} 
            />
            <Stack.Screen 
              name="SignUp" 
              component={SignUpScreen}
              options={{ title: t('auth:signup') }} 
            />
            <Stack.Screen 
              name="ForgotPassword" 
              component={ForgotPasswordScreen}
              options={{ title: t('auth:forgotPassword') }} 
            />
          </>
        )}

        {/* Main Stack */}
        {isAuthenticated && (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen 
              name="Search" 
              component={SearchScreen}
              options={{ title: t('search') }} 
            />
            <Stack.Screen 
              name="VerseDetail" 
              component={VerseDetailScreen} 
              options={{ title: t('verseDetail:title') }}
            />
            <Stack.Screen 
              name="GraphView" 
              component={GraphViewScreen}
              options={{ title: t('graph') }} 
            />
            <Stack.Screen 
              name="GroupDetail" 
              component={GroupDetailScreen}
              options={{ title: t('group:detail') }} 
            />
            <Stack.Screen 
              name="TagsManagement" 
              component={TagsManagementScreen}
              options={{ title: t('tags:title') }} 
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{ title: t('settings') }} 
            />
            <Stack.Screen 
              name="LanguageSettings" 
              component={LanguageSettingsScreen}
              options={{ title: t('settings:language') }} 
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 