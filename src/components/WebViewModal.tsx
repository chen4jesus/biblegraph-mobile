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
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface WebViewModalProps {
  visible: boolean;
  url: string;
  onClose: () => void;
}

// Helper function to determine if we're running on the web platform
const isWebPlatform = (): boolean => {
  return Platform.OS === 'web' || typeof window !== 'undefined';
};

const WebViewModal: React.FC<WebViewModalProps> = ({ visible, url, onClose }) => {
  const { t } = useTranslation(['common']);
  const [isLoading, setIsLoading] = React.useState(true);
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const MAX_RETRIES = 2;
  const [renderKey, setRenderKey] = React.useState(0);
  const [showLoadingTimeout, setShowLoadingTimeout] = React.useState(false);
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const webViewRef = React.useRef<WebView>(null);
  
  // Debug mode - set to true for additional console logging
  const DEBUG_MODE = __DEV__;
  
  // Maximum loading time for iframe before showing fallback options
  const IFRAME_LOAD_TIMEOUT = 5000; // 5 seconds timeout (shorter for faster feedback)
  
  // Flag to track iframe content security policy errors
  const [cspError, setCspError] = React.useState(false);
  
  // Debug helper
  const debug = (message: string, ...args: any[]) => {
    if (DEBUG_MODE) {
      console.log(`[WebViewModal] ${message}`, ...args);
    }
  };
  
  // Check if a URL is for a restricted site - we'll attempt all sites but keep this for diagnostics
  const isRestrictedSite = (urlToCheck: string): boolean => {
    return false; // Allow all sites
  };
  
  // Reset state when URL changes or modal opens
  React.useEffect(() => {
    if (visible) {
      setRetryCount(0);
      setRenderKey(prev => prev + 1);
      setShowLoadingTimeout(false);
      setCspError(false);
      
      // Set a loading timeout for both iframe and WebView
      loadingTimeoutRef.current = setTimeout(() => {
        if (isLoading) {
          debug(`Loading timeout after ${IFRAME_LOAD_TIMEOUT}ms for URL: ${url}`);
          setShowLoadingTimeout(true);
        }
      }, IFRAME_LOAD_TIMEOUT);
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [visible, url, isLoading]);

  // Listen for CSP errors and X-Frame-Options errors
  React.useEffect(() => {
    if (isWebPlatform()) {
      // Setup event listener for error messages
      const handleErrorEvent = (event: any) => {
        if (!event || !event.message) return;
        
        const errorMsg = event.message.toLowerCase();
        if (
          errorMsg.includes('refused to display') || 
          errorMsg.includes('x-frame-options') ||
          errorMsg.includes('content security policy') ||
          errorMsg.includes('frame-ancestors')
        ) {
          debug('Detected iframe security restriction:', event.message);
          setCspError(true);
          setShowLoadingTimeout(true);
        }
      };
      
      window.addEventListener('error', handleErrorEvent);
      
      return () => {
        window.removeEventListener('error', handleErrorEvent);
      };
    }
  }, [visible, isWebPlatform]);

  // Improved URL validation and handling
  React.useEffect(() => {
    if (visible) {
      if (!url) {
        debug('Empty URL provided to WebViewModal');
        setUrlError('No URL provided');
        return;
      }
      
      debug('Opening WebView with URL:', url);
      
      const cleanedUrl = cleanAndValidateUrl(url);
      
      if (!cleanedUrl) {
        debug('Invalid URL format:', url);
        setUrlError('Invalid URL format');
      } else {
        setUrlError(null);
      }
    }
  }, [url, visible]);

  // Enhanced URL cleaning and validation function
  const cleanAndValidateUrl = (inputUrl: string): string | null => {
    try {
      // Handle empty or undefined URLs
      if (!inputUrl) {
        return null;
      }
      
      // Remove whitespace
      let cleanUrl = inputUrl.trim();
      
      // Return null for empty strings after trimming
      if (cleanUrl.length === 0) {
        return null;
      }
      
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
    // Handle null or empty input
    if (!inputUrl || inputUrl.trim() === '') {
      return `data:text/html,<html><body style="font-family: sans-serif; padding: 20px; text-align: center;">
        <h3>Error: Empty URL</h3>
        <p>No URL was provided to load.</p>
        </body></html>`;
    }
    
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
      return `data:text/html,<html><body style="font-family: sans-serif; padding: 20px; text-align: center;">
        <h3>Invalid URL Format</h3>
        <p>The URL could not be validated: ${inputUrl}</p>
        </body></html>`;
    }
    
    return cleanUrl;
  };
  
  // Retry loading if it fails
  const handleLoadError = (event: any) => {
    debug('WebView error:', event.nativeEvent);
    
    // Extract error details
    const { code, description, url } = event.nativeEvent;
    
    if (retryCount < MAX_RETRIES) {
      // Try again with a slight delay
      setRetryCount(prev => prev + 1);
      debug(`Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      
      setTimeout(() => {
        setIsLoading(true);
        // Force WebView refresh with a new key
        setRenderKey(prev => prev + 1);
      }, 1000);
    } else {
      // Show error alert after max retries
      debug(`Failed after ${MAX_RETRIES} retries. Error: ${description}, Code: ${code}`);
      Alert.alert(
        t('common:error'),
        t('common:webViewError', { error: description || 'Could not load the page' }),
        [{ text: t('common:ok'), onPress: onClose }]
      );
      setIsLoading(false);
    }
  };

  // Custom error renderer
  const renderError = (errorDomain: string | undefined, errorCode: number, errorDesc: string) => {
    debug(`WebView render error: Domain: ${errorDomain || 'unknown'}, Code: ${errorCode}, Description: ${errorDesc}`);
    
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorTitle}>Error Loading Content</Text>
        <Text style={styles.errorDescription}>{errorDesc}</Text>
        <View style={styles.errorActions}>
          <TouchableOpacity style={styles.actionButton} onPress={forceReload}>
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
      </View>
    );
  };

  // JavaScript to inject for attempting to bypass some frame restrictions (only for web)
  const bypassFrameRestrictionsScript = `
    <script>
      // Try to detect frame restriction errors
      window.addEventListener('error', function(e) {
        if (e.message && (
          e.message.includes('Refused to display') || 
          e.message.includes('X-Frame-Options') ||
          e.message.includes('Content Security Policy') ||
          e.message.includes('frame-ancestors')
        )) {
          window.parent.postMessage({
            type: 'frameRestrictionError',
            message: e.message,
            url: window.location.href
          }, '*');
        }
      });
    </script>
  `;

  // Direct browser launch helper
  const directOpenInBrowser = (targetUrl: string) => {
    try {
      const urlToOpen = targetUrl || validUrl;
      if (urlToOpen) {
        debug('Directly opening in browser:', urlToOpen);
        
        // For web version
        if (isWebPlatform()) {
          // Try to open in new tab first
          const newWindow = window.open(urlToOpen, '_blank');
          
          // If popup blockers prevent window.open, offer a clickable link
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            if (cspError || showLoadingTimeout) {
              // Already showing the error UI with button
            } else {
              setShowLoadingTimeout(true);
            }
          } else {
            // Successfully opened in new tab
            onClose();
          }
        } else {
          // Native platform 
          Linking.openURL(urlToOpen);
          onClose();
        }
      }
    } catch (error) {
      debug('Error opening URL in browser:', error);
      Alert.alert(
        t('common:error'),
        'Failed to open the webpage in browser',
        [{ text: t('common:ok') }]
      );
    }
  };
  
  // Update the openInBrowser function to use directOpenInBrowser
  const openInBrowser = () => {
    directOpenInBrowser(url);
  };

  // Listen for iframe messages (for frame restriction detection)
  React.useEffect(() => {
    if (isWebPlatform() && visible) {
      const handleMessage = (event: any) => {
        try {
          const data = event.data;
          if (data && data.type === 'frameRestrictionError') {
            debug('Received frame restriction error:', data.message);
            setCspError(true);
            setShowLoadingTimeout(true);
          }
        } catch (error) {
          debug('Error handling window message:', error);
        }
      };
      
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [isWebPlatform(), visible]);

  // Force reload the WebView with cache clearing
  const forceReload = () => {
    setIsLoading(true);
    setRetryCount(0);
    
    // Clear cache if possible (only on native platforms)
    if (!isWebPlatform() && webViewRef.current) {
      debug('Clearing WebView cache before reload');
      
      try {
        // Use injected JavaScript to clear cache
        webViewRef.current.injectJavaScript(`
          (function() {
            try {
              localStorage.clear();
              sessionStorage.clear();
              if (window.applicationCache && window.applicationCache.clear) {
                window.applicationCache.clear();
              }
              console.log('Cache cleared');
            } catch (e) {
              console.error('Error clearing cache:', e);
            }
            return true;
          })();
        `);
      } catch (error) {
        debug('Error injecting JavaScript:', error);
      }
    } else if (isWebPlatform()) {
      // For web platform, try to clear cache using browser APIs
      debug('Attempting to clear browser cache on web platform');
      try {
        // These will only work if we're on the same origin
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        debug('Error clearing browser cache:', e);
      }
    }
    
    // Update render key to force WebView to re-render
    setRenderKey(prev => prev + 1);
  };

  // Memoize the valid URL calculation to avoid recalculating it on each render
  const validUrl = React.useMemo(() => {
    return getValidUrl(url || '');
  }, [url, urlError]);

  // Get an appropriate user agent for the current URL
  const getUserAgent = (): string => {
    const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 BibleGraphApp';
    
    // For restricted sites, use a more standard browser user agent without custom app suffix
    if (isRestrictedSite(url)) {
      if (Platform.OS === 'ios') {
        return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1';
      } else if (Platform.OS === 'android') {
        return 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';
      } else {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      }
    }
    
    return defaultUserAgent;
  };

  // JavaScript to inject for better error handling and compatibility
  const injectedJavaScript = `
    (function() {
      // Check if we're in a React Native WebView with postMessage support
      const hasPostMessage = typeof window.ReactNativeWebView !== 'undefined' && 
                          typeof window.ReactNativeWebView.postMessage === 'function';
      
      // Define a safe postMessage function
      const safePostMessage = (obj) => {
        if (hasPostMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(obj));
        } else {
          console.log('[WebView Bridge]', obj);
        }
      };

      // Override console methods to detect errors
      const originalConsoleError = console.error;
      console.error = function() {
        safePostMessage({
          type: 'console.error',
          data: Array.from(arguments).map(arg => String(arg)).join(' ')
        });
        originalConsoleError.apply(console, arguments);
      };

      // Send load status
      window.addEventListener('load', function() {
        safePostMessage({
          type: 'pageLoaded',
          url: window.location.href
        });
      });

      // Detect unhandled errors
      window.addEventListener('error', function(e) {
        safePostMessage({
          type: 'jsError',
          message: e.message,
          source: e.filename,
          lineno: e.lineno
        });
        return true;
      });

      // Add compatibility fixes for some sites
      try {
        // Force CORS headers acceptance
        const originalFetch = window.fetch;
        if (originalFetch) {
          window.fetch = function(url, options) {
            options = options || {};
            options.credentials = options.credentials || 'include';
            options.mode = options.mode || 'cors';
            return originalFetch(url, options);
          };
        }
        
        // Some sites check for browser features
        window.chrome = window.chrome || {};
        window.chrome.app = window.chrome.app || {};
        window.chrome.webstore = window.chrome.webstore || {};
      } catch(e) {
        console.error('Compatibility code error:', e);
      }
      
      return true;
    })();
  `;

  // Handle messages from WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const { data } = event.nativeEvent;
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'console.error':
          debug('WebView console error:', message.data);
          break;
        case 'jsError':
          debug('WebView JS error:', message.message, 'at', message.source, 'line', message.lineno);
          break;
        case 'pageLoaded':
          debug('WebView page fully loaded:', message.url);
          break;
        default:
          debug('WebView message:', message);
      }
    } catch (error) {
      debug('Error parsing WebView message:', event.nativeEvent.data);
    }
  };

  // Prompt user to open in browser
  const promptOpenInBrowser = (siteUrl: string) => {
    // Short delay to ensure modal is visible first
    setTimeout(() => {
      Alert.alert(
        'Security Restricted Site',
        `"${siteUrl}" cannot be displayed within the app due to security restrictions. Would you like to open it in your browser?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Open in Browser',
            onPress: () => {
              Linking.openURL(siteUrl);
              onClose();
            },
          },
        ]
      );
    }, 500);
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
                  
                  {isRestrictedSite(url) && (
                    <View style={styles.restrictedSiteBanner}>
                      <Ionicons name="information-circle-outline" size={20} color="#FF9500" />
                      <Text style={styles.restrictedSiteText}>
                        This site may not load properly in the app.
                      </Text>
                    </View>
                  )}
                  
                  {(showLoadingTimeout || isRestrictedSite(url)) && (
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
              
              {/* Use iframe for web platform (Windows) and WebView for native platforms */}
              {isWebPlatform() ? (
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  position: 'relative',
                  display: isLoading && !cspError ? 'none' : 'block'
                }}>
                  {/* Pseudo browser frame for sites with CSP restrictions */}
                  {cspError ? (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        padding: '10px',
                        borderBottom: '1px solid #ddd',
                        backgroundColor: '#f5f5f5',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{
                          flex: 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginRight: '10px'
                        }}>
                          {url}
                        </div>
                        <button
                          onClick={openInBrowser}
                          style={{
                            padding: '5px 10px',
                            border: 'none',
                            backgroundColor: '#007AFF',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          Open in Browser
                        </button>
                      </div>
                      <div style={{
                        flex: 1,
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#fff'
                      }}>
                        <div style={{ 
                          marginBottom: '20px', 
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}>
                          <div style={{ fontSize: '48px', color: '#FF9500', marginBottom: '15px' }}>
                            ⚠️
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                            Security Restriction Detected
                          </div>
                          <div style={{ textAlign: 'center', color: '#666', maxWidth: '500px' }}>
                            This website ({url}) has set security headers that prevent it from being displayed in an embedded view.
                            <br /><br />
                            This is a security feature of the website and not an error with the app.
                          </div>
                        </div>
                        <button
                          onClick={forceReload}
                          style={{
                            padding: '10px 20px',
                            border: '1px solid #ddd',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '4px',
                            marginRight: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <iframe 
                      src={validUrl}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        border: 'none',
                      }}
                      onLoad={() => {
                        debug('Iframe loaded');
                        
                        // Start a timer to ensure the iframe content is actually visible
                        // Some sites might still be loading assets even though onLoad fired
                        setTimeout(() => {
                          setIsLoading(false);
                        }, 500);
                      }}
                      onError={(e) => {
                        debug('Iframe error', e);
                        handleLoadError({
                          nativeEvent: {
                            code: 0,
                            description: 'Failed to load in iframe',
                            url: validUrl
                          }
                        });
                      }}
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  
                  {/* Fallback message for iframe that cannot load due to timeout */}
                  {showLoadingTimeout && !cspError && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      padding: 20,
                      zIndex: 10,
                    }}>
                      <div style={{ marginBottom: 10, color: '#FF3B30', fontSize: 20 }}>
                        Loading Timeout
                      </div>
                      <div style={{ marginBottom: 20, color: '#666', textAlign: 'center' }}>
                        The website is taking too long to load or may have security restrictions.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <button 
                          onClick={forceReload}
                          style={{
                            padding: '8px 16px',
                            marginRight: 10,
                            borderRadius: 8,
                            border: 'none',
                            backgroundColor: '#f0f0f0',
                            cursor: 'pointer'
                          }}
                        >
                          Retry
                        </button>
                        <button 
                          onClick={openInBrowser}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: 'none',
                            backgroundColor: '#007AFF',
                            color: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          Open in Browser
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <WebView
                  ref={webViewRef}
                  key={`webview-${renderKey}`}
                  source={{ uri: validUrl }}
                  style={styles.webView}
                  originWhitelist={['*']}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  allowsFullscreenVideo={true}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                  scalesPageToFit={true}
                  cacheEnabled={true}
                  incognito={!isRestrictedSite(url)}
                  userAgent={getUserAgent()}
                  thirdPartyCookiesEnabled={true}
                  sharedCookiesEnabled={true}
                  mixedContentMode="compatibility"
                  allowFileAccess={true}
                  injectedJavaScript={injectedJavaScript}
                  onMessage={handleWebViewMessage}
                  onShouldStartLoadWithRequest={(request) => {
                    const { url: requestUrl } = request;
                    debug('Should start load with URL:', requestUrl);
                    
                    // Check if navigating to a restricted site
                    if (isRestrictedSite(requestUrl) && !isRestrictedSite(url)) {
                      debug('Navigation to restricted site detected:', requestUrl);
                      // Ask user if they want to open in browser
                      Alert.alert(
                        'Restricted Site',
                        `The site "${requestUrl}" may not display properly within the app. Would you like to open it in your browser?`,
                        [
                          {
                            text: 'Cancel',
                            style: 'cancel',
                          },
                          {
                            text: 'Open in Browser',
                            onPress: () => {
                              Linking.openURL(requestUrl);
                              onClose();
                            },
                          },
                        ]
                      );
                      return false; // Don't load the URL in WebView
                    }
                    
                    return true; // Allow other URLs to load
                  }}
                  onLoadStart={(event) => {
                    debug('Starting to load:', event.nativeEvent.url);
                    setIsLoading(true);
                  }}
                  onLoad={(event) => {
                    debug('Loaded:', event.nativeEvent.url);
                  }}
                  onLoadProgress={({ nativeEvent }) => {
                    debug('Loading progress:', nativeEvent.progress);
                  }}
                  onLoadEnd={(event) => {
                    debug('Load ended:', event.nativeEvent.url);
                    setIsLoading(false);
                  }}
                  onError={handleLoadError}
                  onHttpError={(event) => {
                    debug('HTTP error:', event.nativeEvent);
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
                  renderError={renderError}
                  renderLoading={() => (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#007AFF" />
                      <Text style={styles.loadingText}>{t('common:loading')}</Text>
                    </View>
                  )}
                />
              )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#333',
  },
  errorDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  restrictedSiteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FF9500',
    borderRadius: 8,
  },
  restrictedSiteText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 10,
  },
});

export default WebViewModal; 