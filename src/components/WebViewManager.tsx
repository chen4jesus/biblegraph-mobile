import React, { useState } from 'react';
import { View } from 'react-native';
import WebViewModal from './WebViewModal';
import { isWebPlatform } from '../utils/platformUtils';
import WebViewPortal from './WebViewPortal';

interface WebViewManagerProps {
  autoMinimizeOnNavigate?: boolean;
}

const WebViewManager: React.FC<WebViewManagerProps> = ({ 
  autoMinimizeOnNavigate = false 
}) => {
  const [webViews, setWebViews] = useState<WebViewInstance[]>([]);

  // For web platform, we need to render minimized WebViews differently
  const renderMinimizedWebViews = () => {
    if (!isWebPlatform()) return null;

    return webViews
      .filter(webView => webView.minimized)
      .map(webView => (
        <WebViewModal
          key={webView.id}
          id={webView.id}
          visible={true}
          url={webView.url}
          onClose={() => closeWebView(webView.id)}
          onMinimize={minimizeWebView}
          autoMinimizeOnNavigate={autoMinimizeOnNavigate}
        />
      ));
  };

  return (
    <>
      <View style={styles.container}>
        {webViews
          .filter(webView => !webView.minimized || !isWebPlatform())
          .map(webView => (
            <WebViewModal
              key={webView.id}
              id={webView.id}
              visible={webView.visible}
              url={webView.url}
              onClose={() => closeWebView(webView.id)}
              onMinimize={minimizeWebView}
              autoMinimizeOnNavigate={autoMinimizeOnNavigate}
            />
          ))}
      </View>
      
      <WebViewPortal>
        {renderMinimizedWebViews()}
      </WebViewPortal>
    </>
  );
};

export default WebViewManager; 