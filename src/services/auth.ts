import AsyncStorage from '@react-native-async-storage/async-storage';
import { neo4jService } from './neo4j';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface AuthResponse {
  user: User;
  token: string;
}

class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await neo4jService.login(email, password);
      await this.setSession(response);
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async signUp(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await neo4jService.signUp(name, email, password);
      await this.setSession(response);
      return response;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      this.currentUser = null;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        this.currentUser = JSON.parse(userData);
        return this.currentUser;
      }
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return !!token;
    } catch (error) {
      console.error('Check authentication error:', error);
      return false;
    }
  }

  private async setSession(response: AuthResponse): Promise<void> {
    try {
      await AsyncStorage.setItem('userToken', response.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.user));
      this.currentUser = response.user;
    } catch (error) {
      console.error('Set session error:', error);
      throw error;
    }
  }
}

export const authService = AuthService.getInstance(); 