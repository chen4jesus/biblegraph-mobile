import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface WebViewModalProps {
  visible: boolean;
  url: string;
  onClose: () => void;
}

const WebViewModal: React.FC<WebViewModalProps> = ({ visible, url, onClose }) => {
  const { t } = useTranslation(['common']);
  const [isLoading, setIsLoading] = React.useState(true);
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const MAX_RETRIES = 2;
  const [renderKey, setRenderKey] = React.useState(0);
  const [showLoadingTimeout, setShowLoadingTimeout] = React.useState(false);
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Reset state when URL changes or modal opens
  React.useEffect(() => {
    if (visible) {
      setRetryCount(0);
      setRenderKey(prev => prev + 1);
      setShowLoadingTimeout(false);
      
      // Set a timeout to detect if loading is taking too long
      loadingTimeoutRef.current = setTimeout(() => {
        if (isLoading) {
          setShowLoadingTimeout(true);
        }
      }, 10000); // 10 seconds timeout
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [visible, url]);

  // Improved URL validation and handling
  React.useEffect(() => {
    if (visible && url) {
      console.log('Opening WebView with URL:', url);
      const cleanedUrl = cleanAndValidateUrl(url);
      
      if (!cleanedUrl) {
        console.error('Invalid URL format:', url);
        setUrlError('Invalid URL format');
        // Don't close immediately - show error in the WebView
      } else {
        setUrlError(null);
        // We'll let the WebView try to load it
      }
    }
  }, [url, visible]);

  // Enhanced URL cleaning and validation function
  const cleanAndValidateUrl = (inputUrl: string): string | null => {
    try {
      // Remove whitespace
      let cleanUrl = inputUrl.trim();
      
      // Ensure it has a protocol
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      
      // Simple validation using URL constructor
      new URL(cleanUrl);
      return cleanUrl;
    } catch (error) {
      console.error('URL validation error:', error);
      return null;
    }
  };

  // Get a valid URL or fallback to about:blank
  const getValidUrl = (inputUrl: string): string => {
    if (urlError) {
      // If we have a URL error, show an error page
      return `data:text/html,<html><body style="font-family: sans-serif; padding: 20px; text-align: center;">
        <h3>Error Loading URL</h3>
        <p>${urlError}</p>
        <p>URL: ${inputUrl}</p>
        </body></html>`;
    }
    
    const cleanUrl = cleanAndValidateUrl(inputUrl);
    if (!cleanUrl) {
      return 'about:blank';
    }
    
    return cleanUrl;
  };
  
  // Retry loading if it fails
  const handleLoadError = (event: any) => {
    console.error('WebView error:', event.nativeEvent);
    
    if (retryCount < MAX_RETRIES) {
      // Try again with a slight delay
      setRetryCount(prev => prev + 1);
      setTimeout(() => {
        setIsLoading(true);
        // Force WebView refresh
      }, 1000);
    } else {
      // Show error alert after max retries
      Alert.alert(
        t('common:error'),
        t('common:webViewError', { error: event.nativeEvent.description || 'Could not load the page' }),
        [{ text: t('common:ok'), onPress: onClose }]
      );
      setIsLoading(false);
    }
  };

  // Open URL in external browser
  const openInBrowser = () => {
    // Use Linking API from react-native
    try {
      const validUrl = getValidUrl(url);
      console.log('Opening in browser:', validUrl);
      Linking.openURL(validUrl);
      onClose(); // Close the modal
    } catch (error) {
      console.error('Failed to open URL in browser:', error);
      Alert.alert(
        t('common:error'),
        t('common:browserOpenError')
      );
    }
  };

  // Force reload the WebView
  const forceReload = () => {
    setIsLoading(true);
    setRetryCount(0);
    setRenderKey(prev => prev + 1);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
                {url}
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.webViewContainer}>
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>{t('common:loading')}</Text>
                  
                  {showLoadingTimeout && (
                    <View style={styles.loadingActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={forceReload}
                      >
                        <Text style={styles.actionButtonText}>{t('common:reload')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.primaryButton]}
                        onPress={openInBrowser}
                      >
                        <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
                          {t('common:openInBrowser')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              
              <WebView
                key={`webview-${renderKey}`}
                source={{ uri: getValidUrl(url) }}
                style={styles.webView}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                scalesPageToFit={true}
                cacheEnabled={true}
                userAgent="Mozilla/5.0 BibleGraphApp"
                onLoadStart={(event) => {
                  console.log('Starting to load:', event.nativeEvent.url);
                  setIsLoading(true);
                }}
                onLoad={(event) => {
                  console.log('Loaded:', event.nativeEvent.url);
                }}
                onLoadProgress={({ nativeEvent }) => {
                  console.log('Loading progress:', nativeEvent.progress);
                }}
                onLoadEnd={(event) => {
                  console.log('Load ended:', event.nativeEvent.url);
                  setIsLoading(false);
                }}
                onError={handleLoadError}
                onHttpError={(event) => {
                  console.error('HTTP error:', event.nativeEvent);
                  if (event.nativeEvent.statusCode >= 400) {
                    Alert.alert(
                      t('common:error'),
                      t('common:webViewHttpError', { 
                        status: event.nativeEvent.statusCode,
                        url: event.nativeEvent.url 
                      }),
                      [{ text: t('common:ok'), onPress: onClose }]
                    );
                  }
                }}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>{t('common:loading')}</Text>
                  </View>
                )}
              />
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');
const modalWidth = width * 0.9;
const modalHeight = height * 0.8;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: modalWidth,
    height: modalHeight,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  urlText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 8,
  },
  closeButton: {
    padding: 8,
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  loadingActions: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 6,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#333',
  },
  primaryButtonText: {
    color: '#fff',
  },
});

export default WebViewModal; 