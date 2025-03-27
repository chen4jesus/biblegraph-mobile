import { Platform, ToastAndroid } from 'react-native';
import Toast from 'react-native-toast-message';

/**
 * Shows a notification to the user
 * Uses Toast on Android and react-native-toast-message on iOS
 * 
 * @param message The message to display
 * @param type The type of message: 'success', 'error', 'info'
 * @param duration Duration in milliseconds (Android only)
 */
export const showNotification = (
  message: string, 
  type: 'success' | 'error' | 'info' = 'info',
  duration = 3000
): void => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, duration < 2000 ? ToastAndroid.SHORT : ToastAndroid.LONG);
  } else {
    // For iOS and other platforms
    Toast.show({
      type: type,
      text1: message,
      position: 'bottom',
      visibilityTime: duration,
    });
  }
};

/**
 * Shows an error notification
 * 
 * @param message The error message to display
 */
export const showErrorNotification = (message: string): void => {
  showNotification(message, 'error');
};

/**
 * Shows a success notification
 * 
 * @param message The success message to display
 */
export const showSuccessNotification = (message: string): void => {
  showNotification(message, 'success');
};

export default {
  showNotification,
  showErrorNotification,
  showSuccessNotification
}; 