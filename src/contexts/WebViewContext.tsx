import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform, AppState, AppStateStatus } from 'react-native';
import WebViewModal from '../components/WebViewModal';

// Interface for minimized webview items
export interface MinimizedWebView {
  id: string;
  url: string;
  title: string;
  favicon?: string;
}

// Interface for context value
interface WebViewContextValue {
  activeWebView: { url: string; title: string; favicon?: string } | null;
  minimizedWebViews: MinimizedWebView[];
  openWebView: (url: string, title?: string, favicon?: string) => void;
  closeWebView: (id?: string) => void;
  minimizeWebView: () => void;
  expandWebView: (id: string) => void;
  isWebViewModalVisible: boolean;
}

// Create context with default values
const WebViewContext = createContext<WebViewContextValue | undefined>(undefined);

// Hook for using the context
export const useWebView = (): WebViewContextValue => {
  const context = useContext(WebViewContext);
  if (context === undefined) {
    throw new Error('useWebView must be used within a WebViewProvider');
  }
  return context;
};

// Provider component
export const WebViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeWebView, setActiveWebView] = useState<{ url: string; title: string; favicon?: string } | null>(null);
  const [minimizedWebViews, setMinimizedWebViews] = useState<MinimizedWebView[]>([]);
  const [isWebViewModalVisible, setIsWebViewModalVisible] = useState<boolean>(false);
  const appState = useRef(AppState.currentState);

  // Handle app state changes to ensure minimized webviews remain active
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to the foreground
      // We could refresh minimized webviews here if needed
    }
    appState.current = nextAppState;
  };

  const openWebView = (url: string, title: string = 'Web Page', favicon?: string) => {
    setActiveWebView({ url, title, favicon });
    setIsWebViewModalVisible(true);
  };

  const closeWebView = (id?: string) => {
    if (id) {
      // Close specific minimized webview
      setMinimizedWebViews(prev => prev.filter(webview => webview.id !== id));
    } else {
      // Close active webview
      setActiveWebView(null);
      setIsWebViewModalVisible(false);
    }
  };

  const minimizeWebView = () => {
    if (activeWebView) {
      const newMinimizedWebView: MinimizedWebView = {
        id: Date.now().toString(),
        url: activeWebView.url,
        title: activeWebView.title,
        favicon: activeWebView.favicon,
      };
      
      setMinimizedWebViews(prev => [...prev, newMinimizedWebView]);
      setActiveWebView(null);
      setIsWebViewModalVisible(false);
    }
  };

  const expandWebView = (id: string) => {
    const webviewToExpand = minimizedWebViews.find(webview => webview.id === id);
    if (webviewToExpand) {
      setActiveWebView({
        url: webviewToExpand.url,
        title: webviewToExpand.title,
        favicon: webviewToExpand.favicon,
      });
      setIsWebViewModalVisible(true);
      setMinimizedWebViews(prev => prev.filter(webview => webview.id !== id));
    }
  };

  return (
    <WebViewContext.Provider
      value={{
        activeWebView,
        minimizedWebViews,
        openWebView,
        closeWebView,
        minimizeWebView,
        expandWebView,
        isWebViewModalVisible,
      }}
    >
      {children}
      
      {/* Render the active WebView modal */}
      {activeWebView && isWebViewModalVisible && (
        <WebViewModal
          visible={isWebViewModalVisible}
          url={activeWebView.url}
          id={Date.now().toString()}
          onClose={() => closeWebView()}
          onMinimize={(id, url, title) => minimizeWebView()}
        />
      )}
      
      {/* Persistent minimized WebViews */}
      <View style={styles.minimizedContainer}>
        {minimizedWebViews.map(webView => (
          <WebViewModal
            key={webView.id}
            visible={true}
            url={webView.url}
            id={webView.id}
            onClose={() => closeWebView(webView.id)}
            onMinimize={minimizeWebView}
            // Start in minimized mode
            autoMinimizeOnNavigate={true}
          />
        ))}
      </View>
    </WebViewContext.Provider>
  );
};

// Styles for the container
const styles = StyleSheet.create({
  minimizedContainer: {
    position: 'absolute',
    bottom: 20, // Adjust position as needed
    right: 20,
    zIndex: 9999,
    elevation: 25, // For Android
    // Ensure this doesn't interfere with touch events for other components
    pointerEvents: 'box-none',
  },
});

export default WebViewProvider; 