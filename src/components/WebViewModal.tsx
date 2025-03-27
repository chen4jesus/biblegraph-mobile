import React, { useRef, useEffect } from 'react';
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
  PanResponder,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface WebViewModalProps {
  visible: boolean;
  url: string;
  onClose: () => void;
  id: string; // Unique ID for this WebView instance
  onMinimize?: (id: string, url: string, title: string) => void; // Callback when minimized
  autoMinimizeOnNavigate?: boolean; // Option to auto-minimize
}

// Helper function to determine if we're running on the web platform
const isWebPlatform = (): boolean => {
  return Platform.OS === 'web' || typeof window !== 'undefined';
};

const WebViewModal: React.FC<WebViewModalProps> = ({ 
  visible, 
  url, 
  onClose, 
  id, 
  onMinimize,
  autoMinimizeOnNavigate = false
}) => {
  const { t } = useTranslation(['common']);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [renderKey, setRenderKey] = React.useState(0);
  const [showLoadingTimeout, setShowLoadingTimeout] = React.useState(false);
  const [pageTitle, setPageTitle] = React.useState(url); // Track page title
  const [cspError, setCspError] = React.useState(false);
  
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const webViewRef = React.useRef<WebView>(null);
  
  // For dragging functionality
  const pan = useRef(new Animated.ValueXY()).current;
  const [draggablePosition, setDraggablePosition] = React.useState({ x: 0, y: 0 });
  
  // Debug mode
  const DEBUG_MODE = __DEV__;
  
  // Debug helper
  const debug = (message: string, ...args: any[]) => {
    if (DEBUG_MODE) {
      console.log(`[WebViewModal:${id}] ${message}`, ...args);
    }
  };

  // Set up PanResponder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isMinimized,
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        // Update the draggable position
        setDraggablePosition({
          x: draggablePosition.x + gestureState.dx,
          y: draggablePosition.y + gestureState.dy
        });
        
        // Reset the animated values
        pan.extractOffset();
      },
    })
  ).current;

  // Auto-minimize effect when navigating away
  useEffect(() => {
    if (autoMinimizeOnNavigate && visible && !isMinimized) {
      // This would hook into navigation events in a real implementation
      // For demonstration, we'll set up a listener on app state/blur events
      const handleAppStateChange = () => {
        if (document.visibilityState === 'hidden') {
          handleMinimize();
        }
      };

      if (isWebPlatform()) {
        document.addEventListener('visibilitychange', handleAppStateChange);
      }

      return () => {
        if (isWebPlatform()) {
          document.removeEventListener('visibilitychange', handleAppStateChange);
        }
      };
    }
  }, [autoMinimizeOnNavigate, visible, isMinimized]);

  // Reset state when URL changes or modal opens
  useEffect(() => {
    if (visible) {
      setRetryCount(0);
      setRenderKey(prev => prev + 1);
      setShowLoadingTimeout(false);
      setCspError(false);
      
      // Set a loading timeout
      const timeoutDuration = 8000;
      
      loadingTimeoutRef.current = setTimeout(() => {
        if (isLoading) {
          debug(`Loading timeout after ${timeoutDuration}ms for URL: ${url}`);
          setShowLoadingTimeout(true);
        }
      }, timeoutDuration);
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [visible, url, isLoading]);

  // Add useEffect to apply navigation fixes for web
  useEffect(() => {
    if (isWebPlatform()) {
      // Ensure the body/html elements don't get blocked by the modal
      const updateBodyStyles = () => {
        if (document.body) {
          if (visible && !isMinimized) {
            // When modal is visible and not minimized, prevent scrolling
            document.body.style.overflow = 'hidden';
          } else {
            // When minimized or not visible, allow scrolling
            document.body.style.overflow = 'auto';
          }
        }
      };
      
      updateBodyStyles();
      
      return () => {
        // Reset body styles when component unmounts
        if (document.body) {
          document.body.style.overflow = 'auto';
        }
      };
    }
  }, [visible, isMinimized]);

  // Handle minimize action
  const handleMinimize = () => {
    setIsMinimized(true);
    if (onMinimize) {
      onMinimize(id, url, pageTitle || url);
    }
  };

  // Handle expand action
  const handleExpand = () => {
    setIsMinimized(false);
  };

  // Toggle minimize state
  const toggleMinimize = () => {
    if (isMinimized) {
      handleExpand();
    } else {
      handleMinimize();
    }
  };

  // Extract page title from loaded content
  const extractPageTitle = (html: string): string | null => {
    const titleMatch = /<title>(.*?)<\/title>/i.exec(html);
    return titleMatch && titleMatch[1] ? titleMatch[1] : null;
  };

  // URL cleaning and validation
  const cleanAndValidateUrl = (inputUrl: string): string | null => {
    try {
      if (!inputUrl) return null;
      
      let cleanUrl = inputUrl.trim();
      if (cleanUrl.length === 0) return null;
      
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      
      new URL(cleanUrl);
      return cleanUrl;
    } catch (error) {
      debug('URL validation error:', error);
      return null;
    }
  };
  
  // Get valid URL
  const getValidUrl = (inputUrl: string): string => {
    if (!inputUrl || inputUrl.trim() === '') {
      return `data:text/html,<html><body style="font-family: sans-serif; padding: 20px; text-align: center;">
        <h3>Error: Empty URL</h3>
        <p>No URL was provided to load.</p>
        </body></html>`;
    }
    
    if (urlError) {
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

  // Memoize valid URL
  const validUrl = React.useMemo(() => {
    return getValidUrl(url || '');
  }, [url, urlError]);

  // Force reload the WebView
  const forceReload = () => {
    setIsLoading(true);
    setRetryCount(0);
    setRenderKey(prev => prev + 1);
  };

  // Open in external browser
  const openInBrowser = () => {
    try {
      if (validUrl) {
        debug('Opening in browser:', validUrl);
        Linking.openURL(validUrl);
      }
    } catch (error) {
      debug('Error opening URL in browser:', error);
      Alert.alert(
        'Error',
        'Failed to open the webpage in browser',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle WebView message events
  const handleWebViewMessage = (event: any) => {
    try {
      const { data } = event.nativeEvent;
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'pageTitle':
          if (message.title) {
            setPageTitle(message.title);
          }
          break;
        case 'error':
          debug('WebView error:', message.error);
          break;
        default:
          debug('WebView message:', message);
      }
    } catch (error) {
      debug('Error parsing WebView message:', error);
    }
  };

  // JavaScript to inject
  const injectedJavaScript = `
    (function() {
      // Send the page title back to React Native
      if (document.title) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pageTitle',
          title: document.title
        }));
      }
      
      // Watch for title changes
      const originalTitle = document.title;
      const titleObserver = new MutationObserver(function() {
        if (document.title !== originalTitle) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'pageTitle',
            title: document.title
          }));
        }
      });
      
      try {
        titleObserver.observe(
          document.querySelector('title'),
          { childList: true, characterData: true, subtree: true }
        );
      } catch(e) {}
      
      return true;
    })();
  `;

  // Animated style for draggable
  const animatedStyle = {
    transform: [
      { translateX: Animated.add(pan.x, new Animated.Value(draggablePosition.x)) },
      { translateY: Animated.add(pan.y, new Animated.Value(draggablePosition.y)) }
    ]
  };

  // Check if we're on web platform for sizing
  const isWeb = isWebPlatform();

  // For full mode: Use Modal with properly styled content
  const renderFullScreenModal = () => {
    if (isWebPlatform()) {
      // For web, add some styles directly to ensure proper modal behavior
      if (typeof document !== 'undefined') {
        const modalStyles = document.getElementById('webview-modal-fullscreen-styles');
        if (!modalStyles) {
          const style = document.createElement('style');
          style.id = 'webview-modal-fullscreen-styles';
          style.innerHTML = `
            .webview-modal-full {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              z-index: 9000 !important;
              background-color: white !important;
              display: flex !important;
              flex-direction: column !important;
            }
          `;
          document.head.appendChild(style);
        }
      }
      
      // Web-specific rendering
      return (
        <Modal
          visible={visible}
          transparent={false}
          animationType="fade"
          onRequestClose={onClose}
        >
          {/* Use div for web to apply className */}
          <div className="webview-modal-full">
            <View style={styles.fullContainerWebRoot}>
              <View style={styles.header}>
                {/* Header content */}
                <TouchableOpacity style={styles.titleContainer} onPress={toggleMinimize}>
                  <Ionicons name="globe-outline" size={16} color="#555" style={styles.titleIcon} />
                  <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
                    {pageTitle || url}
                  </Text>
                </TouchableOpacity>
                
                <View style={styles.headerButtons}>
                  <TouchableOpacity style={styles.headerButton} onPress={handleMinimize}>
                    <Ionicons name="remove-outline" size={20} color="#555" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerButton} onPress={openInBrowser}>
                    <Ionicons name="open-outline" size={20} color="#555" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerButton} onPress={onClose}>
                    <Ionicons name="close-outline" size={20} color="#555" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.webViewContainer}>
                {isLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading...</Text>
                  </View>
                )}
                
                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                  <iframe 
                    src={validUrl}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      border: 'none',
                    }}
                    onLoad={() => {
                      debug('Iframe loaded');
                      setTimeout(() => {
                        setIsLoading(false);
                        
                        // Try to extract title from iframe
                        try {
                          const iframe = document.querySelector('iframe');
                          if (iframe && iframe.contentDocument && iframe.contentDocument.title) {
                            setPageTitle(iframe.contentDocument.title);
                          }
                        } catch (e) {
                          // Cross-origin restrictions may prevent accessing iframe content
                        }
                      }, 500);
                    }}
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </View>
            </View>
          </div>
        </Modal>
      );
    }
    
    // Native platform rendering
    return (
      <Modal
        visible={visible}
        transparent={false}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.fullContainer}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.titleContainer} onPress={toggleMinimize}>
              <Ionicons name="globe-outline" size={16} color="#555" style={styles.titleIcon} />
              <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
                {pageTitle || url}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.headerButton} onPress={handleMinimize}>
                <Ionicons name="remove-outline" size={20} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={openInBrowser}>
                <Ionicons name="open-outline" size={20} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={onClose}>
                <Ionicons name="close-outline" size={20} color="#555" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.webViewContainer}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
            
            <WebView
              ref={webViewRef}
              key={`webview-${renderKey}`}
              source={{ uri: validUrl }}
              style={styles.webView}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              injectedJavaScript={injectedJavaScript}
              onMessage={handleWebViewMessage}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              onNavigationStateChange={(navState) => {
                if (navState.title) {
                  setPageTitle(navState.title);
                }
              }}
            />
          </View>
        </View>
      </Modal>
    );
  };

  // Use different rendering approach based on minimized state
  const renderContent = () => {
    if (isMinimized && isWebPlatform()) {
      // For web minimized mode: Use a positioned div rather than Modal
      // Add custom CSS styling for web platform
      if (Platform.OS === 'web') {
        // Add CSS class for fixed positioning on web
        const styleElement = document.getElementById('webview-modal-styles');
        if (!styleElement) {
          const style = document.createElement('style');
          style.id = 'webview-modal-styles';
          style.innerHTML = `
            .webview-minimized {
              position: fixed !important;
              z-index: 9999 !important;
              pointer-events: auto !important;
              background-color: white !important;
              border-radius: 20px !important;
              box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.2) !important;
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              justify-content: space-between !important;
              bottom: 20px !important;
              right: 20px !important;
              width: 220px !important;
              height: 40px !important;
            }
          `;
          document.head.appendChild(style);
        }
        
        // Use div for web platform to enable fixed positioning and className
        return (
          <div className="webview-minimized">
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.modalContainer,
                styles.minimizedContainer,
                { borderRadius: 0, position: 'relative' },
                animatedStyle
              ]}
            >
              <TouchableOpacity style={styles.titleContainer} onPress={handleExpand}>
                <Ionicons name="globe-outline" size={16} color="#555" style={styles.titleIcon} />
                <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
                  {pageTitle || url}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.headerButtons}>
                <TouchableOpacity style={styles.headerButton} onPress={openInBrowser}>
                  <Ionicons name="open-outline" size={20} color="#555" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerButton} onPress={onClose}>
                  <Ionicons name="close-outline" size={20} color="#555" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </div>
        );
      }
      
      // For non-web platforms that support minimized mode
      return (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.modalContainer,
            styles.minimizedContainer,
            animatedStyle
          ]}
        >
          <TouchableOpacity style={styles.titleContainer} onPress={handleExpand}>
            <Ionicons name="globe-outline" size={16} color="#555" style={styles.titleIcon} />
            <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
              {pageTitle || url}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={openInBrowser}>
              <Ionicons name="open-outline" size={20} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close-outline" size={20} color="#555" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    // For full mode: use the enhanced modal
    return renderFullScreenModal();
  };

  // Handle the different rendering approaches
  return isWebPlatform() && isMinimized ? (
    renderContent()
  ) : (
    visible ? renderContent() : null
  );
};

// Get window dimensions
const { width, height } = Dimensions.get('window');

// For web-specific styling
const webStyles = Platform.OS === 'web' ? {
  minimizedFloating: {
    position: 'fixed',
    zIndex: 9999,
    bottom: 20,
    right: 20,
    pointerEvents: 'auto',
  }
} : {};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fullContainer: {
    position: 'absolute',
    width: width * 0.9,
    height: height * 0.8,
    top: height * 0.1,
    left: width * 0.05,
  },
  fullContainerWeb: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    borderRadius: 0,
  },
  fullContainerWebRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
  minimizedContainer: {
    position: 'absolute',
    width: 220,
    height: 40,
    bottom: 20,
    right: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    ...(Platform.OS === 'web' ? { position: 'absolute' } : {}), // Use absolute for all platforms
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  titleIcon: {
    marginRight: 5,
  },
  urlText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 6,
    marginLeft: 2,
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
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
});

export default WebViewModal; 