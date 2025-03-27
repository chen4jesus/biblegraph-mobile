import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebView, MinimizedWebView } from './WebViewContext';

interface WebViewManagerProps {
  maxItems?: number;
}

const WebViewManager: React.FC<WebViewManagerProps> = ({ maxItems = 3 }) => {
  const { minimizedWebViews, expandWebView, closeWebView } = useWebView();
  const { width: windowWidth } = Dimensions.get('window');

  // Limit the number of displayed items
  const displayedWebViews = minimizedWebViews.slice(-maxItems);

  return (
    <View style={styles.container}>
      {displayedWebViews.map((webView, index) => (
        <MinimizedWebViewItem
          key={webView.id}
          webView={webView}
          onExpand={() => expandWebView(webView.id)}
          onClose={() => closeWebView(webView.id)}
          index={index}
        />
      ))}
    </View>
  );
};

interface MinimizedWebViewItemProps {
  webView: {
    id: string;
    url: string;
    title: string;
    favicon?: string;
  };
  onExpand: () => void;
  onClose: () => void;
  index: number;
}

const MinimizedWebViewItem: React.FC<MinimizedWebViewItemProps> = ({
  webView,
  onExpand,
  onClose,
  index,
}) => {
  const position = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [dragging, setDragging] = React.useState(false);
  
  // Create a pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setDragging(true);
        Animated.spring(scale, {
          toValue: 1.1,
          friction: 5,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        setDragging(false);
        
        // If dragged far enough up or down, close the webview
        if (Math.abs(gesture.dy) > 100) {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          // Snap back to original position
          Animated.parallel([
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              friction: 5,
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Determine platform-specific styles
  const baseStyles = Platform.OS === 'web' ? styles.itemWeb : styles.item;

  return (
    <Animated.View
      style={[
        baseStyles,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { scale },
          ],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity style={styles.itemContent} onPress={onExpand}>
        {webView.favicon ? (
          <View style={styles.favicon}>
            <Text>🌐</Text> {/* Placeholder for favicon */}
          </View>
        ) : (
          <Ionicons name="globe-outline" size={18} color="#333" />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {webView.title}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={18} color="#666" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Component that uses the WebView context to manage minimized webviews
export const GlobalWebViewManager: React.FC = () => {
  const { minimizedWebViews } = useWebView();
  
  // Only render the manager if there are minimized webviews
  if (minimizedWebViews.length === 0) {
    return null;
  }
  
  return <WebViewManager />;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 999,
    alignItems: 'flex-end',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxWidth: 250,
  },
  itemWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 200,
    maxWidth: 250,
    height: 40,
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  favicon: {
    width: 16,
    height: 16,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
}); 