import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import ReactDOM from 'react-dom';

interface WebViewPortalProps {
  children: React.ReactNode;
}

const WebViewPortal: React.FC<WebViewPortalProps> = ({ children }) => {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Create a portal container outside of the React root
    let container = document.getElementById('webview-portal-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'webview-portal-container';
      document.body.appendChild(container);
      
      // Add necessary styles
      const style = document.createElement('style');
      style.innerHTML = `
        #webview-portal-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          z-index: 9999;
          pointer-events: none;
        }
        #webview-portal-container > * {
          pointer-events: auto;
        }
      `;
      document.head.appendChild(style);
    }
    
    setPortalContainer(container);
    
    return () => {
      // Cleanup not strictly necessary but good practice
    };
  }, []);

  // Only create portal on web
  if (Platform.OS !== 'web' || !portalContainer) {
    return <>{children}</>;
  }

  return ReactDOM.createPortal(children, portalContainer);
};

export default WebViewPortal; 