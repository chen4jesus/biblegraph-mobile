import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState, Animated, Platform, Switch, TouchableWithoutFeedback } from 'react-native';
import { Verse, Connection, ConnectionType, Note } from '../types/bible';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

interface BibleMindMapProps {
  verses: Verse[];
  notes: Note[];
  connections: Connection[];
  onNodeSelect?: (nodeId: string, nodeType: string) => void;
  onConnectionSelect?: (connectionId: string) => void;
}

// Node type for rendering
interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'verse' | 'note' | 'theme';
  data: {
    text?: string;
    reference?: string;
    content?: string;
    verseId?: string;
  };
}

// Edge type for rendering
interface Edge {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
  data: {
    type: ConnectionType;
    description?: string;
  };
}

// Tooltip component for displaying full content
interface TooltipProps {
  content: string;
  position: { x: number; y: number };
  visible: boolean;
  maxWidth?: number;
}

const Tooltip: React.FC<TooltipProps> = ({ content, position, visible, maxWidth = 300 }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.tooltip, 
        {
          left: position.x,
          top: position.y,
          maxWidth: maxWidth,
          opacity: opacity,
          transform: [{ scale: opacity.interpolate({
            inputRange: [0, 1],
            outputRange: [0.9, 1]
          })}]
        }
      ]}
    >
      <Text style={styles.tooltipText}>{content}</Text>
      <View style={styles.tooltipArrow} />
    </Animated.View>
  );
};

const BibleMindMap: React.FC<BibleMindMapProps> = ({
  verses,
  notes,
  connections,
  onNodeSelect,
  onConnectionSelect,
}) => {
  // Get screen dimensions
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  
  // Get translation functions
  const { t } = useTranslation(['visualization', 'common']);
  
  // State declarations - always keep these at the top level
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const horizontalScrollViewRef = useRef<ScrollView>(null);
  const verticalScrollViewRef = useRef<ScrollView>(null);
  const lastScrollPos = useRef({ x: 0, y: 0 });
  const hasInitiallyCentered = useRef(false); // Track if initial centering has happened
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);
  
  // Control panel states
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [minimapContainerSize, setMinimapContainerSize] = useState({ width: 0, height: 0 });

  // Track scroll position for minimap
  const handleScroll = (event: any) => {
    const { contentOffset, layoutMeasurement, contentSize, scrollDirection } = event.nativeEvent;
    
    // Debug scroll info
    if (__DEV__) {
      console.debug(`BibleMindMap ${scrollDirection} scroll:`, {
        x: contentOffset.x,
        y: contentOffset.y,
        viewportWidth: layoutMeasurement.width,
        viewportHeight: layoutMeasurement.height,
        contentWidth: contentSize.width,
        contentHeight: contentSize.height,
      });
    }
    
    // Update scroll position state based on which direction scrolled
    if (scrollDirection === 'horizontal') {
      setScrollPosition(prev => ({
        x: contentOffset.x,
        y: prev.y
      }));
      lastScrollPos.current.x = contentOffset.x;
    } else {
      setScrollPosition(prev => ({
        x: prev.x,
        y: contentOffset.y
      }));
      lastScrollPos.current.y = contentOffset.y;
    }
    
    // Update viewport size
    setViewportSize({
      width: layoutMeasurement.width,
      height: layoutMeasurement.height
    });
  };

  // Create pan responder for handling map panning (separate from node dragging)
  const mapPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false, // Don't capture tap events
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only become the responder if the gesture is significant and we're not dragging a node
      return !isDragging && !activeNodeId && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
    },
    onPanResponderGrant: () => {
      // Store the initial scroll position when pan starts
      lastPanPosition.current = { x: scrollPosition.x, y: scrollPosition.y };
    },
    onPanResponderMove: (_, gestureState) => {
      if (horizontalScrollViewRef.current) {
        // Calculate new scroll position based on gesture movement
        const newScrollX = Math.max(0, lastPanPosition.current.x - gestureState.dx);
        const newScrollY = Math.max(0, lastPanPosition.current.y - gestureState.dy);
        
        // Scroll to the new position
        horizontalScrollViewRef.current.scrollTo({
          x: newScrollX,
          y: newScrollY,
          animated: false // Disable animation for smoother scrolling
        });
      }
    },
    onPanResponderRelease: () => {
      // Update the last scroll position on release
      lastPanPosition.current = { x: scrollPosition.x, y: scrollPosition.y };
    },
    onPanResponderTerminate: () => {
      // Also update on termination
      lastPanPosition.current = { x: scrollPosition.x, y: scrollPosition.y };
    },
  });

  // Add a ref to track the last pan position
  const lastPanPosition = useRef({ x: 0, y: 0 });

  // Transform verses, notes, and connections into nodes and edges with positions
  const transformData = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      // If no verses or notes, return empty data
      if ((!verses || verses.length === 0) && (!notes || notes.length === 0)) {
        console.warn('BibleMindMap: No content to display');
        setIsLoading(false);
        setError(t('visualization:noContentToDisplay'));
        return;
      }

      // Create a Map to track node IDs we've already seen
      const uniqueIds = new Map<string, number>();
      
      // Initial grid calculation for node positioning
      const nodeCount = verses.length + (notes?.length || 0);
      const columns = Math.ceil(Math.sqrt(nodeCount));
      const rows = Math.ceil(nodeCount / columns);

      // Create nodes from verses with positions in a grid layout
      const verseNodes: Node[] = verses.map((verse, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        
        // Track if we've seen this ID before to handle duplicates
        let uniqueId = verse.id;
        const count = uniqueIds.get(verse.id) || 0;
        
        if (count > 0) {
          // If we've seen this ID before, make it unique by appending the count
          uniqueId = `${verse.id}-dup${count}`;
          console.warn(`BibleMindMap: Duplicate verse ID found: ${verse.id}, creating unique ID: ${uniqueId}`);
        }
        
        // Increment the count for this ID
        uniqueIds.set(verse.id, count + 1);
        
        return {
          id: uniqueId,
          label: `${verse.book} ${verse.chapter}:${verse.verse}`,
          x: 100 + col * 250, // More spacing between nodes
          y: 100 + row * 200, // More spacing between nodes
          type: 'verse',
          data: {
            text: verse.text || '',
            reference: `${verse.book} ${verse.chapter}:${verse.verse}`,
          }
        };
      });

      // Create nodes from notes (starting from where verse nodes ended)
      const noteNodes: Node[] = notes ? notes.map((note, index) => {
        const col = (verses.length + index) % columns;
        const row = Math.floor((verses.length + index) / columns);
        
        // Track if we've seen this ID before to handle duplicates
        let uniqueId = note.id;
        const count = uniqueIds.get(note.id) || 0;
        
        if (count > 0) {
          // If we've seen this ID before, make it unique by appending the count
          uniqueId = `${note.id}-dup${count}`;
          console.warn(`BibleMindMap: Duplicate note ID found: ${note.id}, creating unique ID: ${uniqueId}`);
        }
        
        // Increment the count for this ID
        uniqueIds.set(note.id, count + 1);
        
        // Find the verse this note belongs to
        const relatedVerse = verses.find(v => v.id === note.verseId);
        const noteLabel = relatedVerse 
          ? t('visualization:noteOn', { reference: `${relatedVerse.book} ${relatedVerse.chapter}:${relatedVerse.verse}` })
          : t('visualization:note');
        
        return {
          id: uniqueId,
          label: noteLabel,
          x: 100 + col * 300, // More spacing between nodes horizontally
          y: 100 + row * 250, // More spacing between nodes vertically
          type: 'note',
          data: {
            text: note.content || '',
            content: note.content || '',
            verseId: note.verseId,
          }
        };
      }) : [];

      // Combine all nodes
      const newNodes = [...verseNodes, ...noteNodes];

      // Calculate the actual bounding box of all nodes
      let minX = Number.MAX_VALUE;
      let minY = Number.MAX_VALUE;
      let maxX = Number.MIN_VALUE;
      let maxY = Number.MIN_VALUE;

      newNodes.forEach(node => {
        minX = Math.min(minX, node.x - 80); // Account for node width
        minY = Math.min(minY, node.y - 40); // Account for node height
        maxX = Math.max(maxX, node.x + 80);
        maxY = Math.max(maxY, node.y + 40);
      });

      // Calculate map dimensions based on the bounding box with margins
      const margin = 300; // Increased margin around all nodes for better scrolling
      
      // Make sure the map is always large enough for free scrolling in any direction
      // Use at least 2x the screen size to ensure there's always room to scroll
      const contentWidth = maxX - minX + (2 * margin);
      const contentHeight = maxY - minY + (2 * margin);
      
      const mapWidth = Math.max(screenWidth * 2, contentWidth);
      const mapHeight = Math.max(screenHeight * 2, contentHeight);
      
      console.log(`BibleMindMap: Calculated map size: ${mapWidth}x${mapHeight} for ${newNodes.length} nodes`);
      setMapSize({ width: mapWidth, height: mapHeight });

      // Update connection references if needed based on node map
      const nodeMap = new Map<string, string>();
      newNodes.forEach(node => {
        // Split out the original ID from any duplicate suffix
        const originalId = node.id.includes('-dup') 
          ? node.id.substring(0, node.id.indexOf('-dup')) 
          : node.id;
        
        // Map the original ID to this node ID
        nodeMap.set(originalId, node.id);
      });
      
      // Create edges from connections with updated references if needed
      const newEdges: Edge[] = connections.map(connection => {
        // Determine edge color based on connection type
        let color = '#999999';
        switch (connection.type) {
          case ConnectionType.CROSS_REFERENCE:
            color = '#FF9500';
            break;
          case ConnectionType.THEME:
            color = '#34C759';
            break;
          case ConnectionType.NOTE:
            color = '#4285F4';
            break;
        }

        // Find the correct source and target nodes using our nodeMap
        const sourceNodeId = nodeMap.get(connection.sourceVerseId) || connection.sourceVerseId;
        const targetNodeId = nodeMap.get(connection.targetVerseId) || connection.targetVerseId;
        
        // Get the actual node objects
        const sourceNode = newNodes.find(node => node.id === sourceNodeId);
        const targetNode = newNodes.find(node => node.id === targetNodeId);

        // Skip edges whose source or target nodes don't exist
        if (!sourceNode || !targetNode) {
          console.warn(`BibleMindMap: Skipping edge ${connection.id} due to missing source or target node`);
          return null;
        }

        return {
          id: connection.id,
          source: sourceNode.id,
          target: targetNode.id,
          label: getEdgeLabel(connection.type),
          color: color,
          data: {
            type: connection.type,
            description: connection.description || '',
          }
        };
      }).filter(edge => edge !== null) as Edge[];

      // Always create edges between notes and their verses
      noteNodes.forEach(noteNode => {
        if (noteNode.data.verseId) {
          // Find the verse node for this note
          const verseNode = verseNodes.find(v => 
            v.id === noteNode.data.verseId || 
            v.id.startsWith(noteNode.data.verseId + '-dup')
          );
          
          if (verseNode) {
            // Check if this connection already exists in newEdges
            const connectionExists = newEdges.some(edge => 
              (edge.source === verseNode.id && edge.target === noteNode.id) ||
              (edge.source === noteNode.id && edge.target === verseNode.id)
            );
            
            if (!connectionExists) {
              newEdges.push({
                id: `note-edge-${noteNode.id}`,
                source: verseNode.id,
                target: noteNode.id,
                label: getEdgeLabel(ConnectionType.NOTE),
                color: '#4285F4',
                data: {
                  type: ConnectionType.NOTE,
                  description: 'Note for verse'
                }
              });
            }
          }
        }
      });

      // If we have nodes but no edges and more than one node, create some default edges
      if (newNodes.length > 1 && newEdges.length === 0) {
        console.log('BibleMindMap: Creating default layout for disconnected nodes');
        
        // If we still have no edges, create a chain layout connecting all nodes
        for (let i = 0; i < newNodes.length - 1; i++) {
          newEdges.push({
            id: `default-edge-${i}`,
            source: newNodes[i].id,
            target: newNodes[i + 1].id,
            label: getEdgeLabel(ConnectionType.THEME),
            color: '#dddddd',
            data: {
              type: ConnectionType.THEME,
              description: t('visualization:shownTogether')
            }
          });
        }
      }

      setNodes(newNodes);
      setEdges(newEdges);
      setIsLoading(false);
    } catch (err) {
      console.error('Error transforming mind map data:', err);
      setError(t('visualization:failedToCreateMindMap'));
      setIsLoading(false);
    }
  }, [verses, notes, connections, screenWidth, screenHeight, t]);

  // Run transformData when verses, notes, or connections change
  useEffect(() => {
    console.log(`BibleMindMap: Received ${verses.length} verses, ${notes?.length || 0} notes, and ${connections.length} connections`);
    // Reset centering flag when data changes
    hasInitiallyCentered.current = false;
    transformData();
  }, [verses, notes, connections, transformData]);

  // Function to determine if a node has any connections
  const hasConnections = useCallback((nodeId: string): boolean => {
    return edges.some(edge => edge.source === nodeId || edge.target === nodeId);
  }, [edges]);

  // Center view when map is first loaded or resized
  useEffect(() => {
    // Only initialize viewport position if we have a valid map size and haven't done it yet
    if (mapSize.width > 0 && mapSize.height > 0 && !isLoading && !hasInitiallyCentered.current) {
      console.log('BibleMindMap: Setting initial view to top-left corner');
      
      // Use requestAnimationFrame to ensure the ScrollView has rendered
      requestAnimationFrame(() => {
        if (horizontalScrollViewRef.current && verticalScrollViewRef.current) {
          // Scroll to top-left corner with a small padding
          horizontalScrollViewRef.current.scrollTo({
            x: 0,
            y: 0,
            animated: false
          });
          
          verticalScrollViewRef.current.scrollTo({
            x: 0,
            y: 0,
            animated: false
          });
          
          hasInitiallyCentered.current = true;
        }
      });
    }
  }, [mapSize, isLoading]);

  // Handle node movement
  const updateNodePosition = (nodeId: string, newX: number, newY: number) => {
    setNodes(prevNodes => {
      return prevNodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, x: newX, y: newY };
        }
        return node;
      });
    });
  };

  // Create pan responder for handling node drag events
  const createPanResponder = (nodeId: string) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only become the responder if the gesture is significant
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        setActiveNodeId(nodeId);
      },
      onPanResponderMove: (event: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Calculate new position
        const newX = node.x + gestureState.dx;
        const newY = node.y + gestureState.dy;
        
        // Ensure node stays within bounds
        const boundedX = Math.max(80, Math.min(mapSize.width - 80, newX));
        const boundedY = Math.max(40, Math.min(mapSize.height - 40, newY));

        updateNodePosition(nodeId, boundedX, boundedY);
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        setActiveNodeId(null);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        setActiveNodeId(null);
      },
      // Allow the scroll view to capture scroll events and capture simultaneously
      onPanResponderTerminationRequest: () => true,
    });
  };

  // Calculate the optimal tooltip position based on node position and screen boundaries
  const calculateTooltipPosition = (nodeX: number, nodeY: number, text: string) => {
    // Approximate tooltip dimensions
    const estimatedTooltipWidth = Math.min(Math.min(text.length * 8, 300), screenWidth * 0.8);
    const estimatedTooltipHeight = 120; // Rough estimate based on typical tooltip content
    
    // Default position above the node
    let x = nodeX - (estimatedTooltipWidth / 2);
    let y = nodeY - estimatedTooltipHeight - 20; // 20px gap
    
    // Check if tooltip would go off the left edge
    if (x < 20) {
      x = 20; // 20px padding from left edge
    }
    
    // Check if tooltip would go off the right edge
    if (x + estimatedTooltipWidth > mapSize.width - 20) {
      x = mapSize.width - estimatedTooltipWidth - 20; // 20px padding from right edge
    }
    
    // Check if tooltip would go off the top edge
    if (y < 20) {
      // Position below the node instead
      y = nodeY + 60; // 60px below node center (nodes are ~80px tall)
    }
    
    return { x, y };
  };
  
  // Function to show tooltip
  const showTooltip = (content: string, nodeX: number, nodeY: number) => {
    const position = calculateTooltipPosition(nodeX, nodeY, content);
    setTooltipContent(content);
    setTooltipPosition(position);
    setTooltipVisible(true);
  };

  // Function to hide tooltip
  const hideTooltip = () => {
    setTooltipVisible(false);
  };

  // Function to handle text container interactions properly
  const getTextContainerProps = (handlePress: () => void, handleMouseEnter?: () => void, handleMouseLeave?: () => void) => {
    const props: any = {
      style: styles.nodeTextContainer,
      onPress: handlePress,
      activeOpacity: 0.8,
      delayPressIn: 200,
    };

    // Only add mouse event handlers on web platform
    if (Platform.OS === 'web') {
      props.onMouseEnter = handleMouseEnter;
      props.onMouseLeave = handleMouseLeave;
    }

    return props;
  };

  // Render each node (verse, note, or theme)
  const renderNode = useCallback((node: Node, index: number) => {
    const handlePress = () => {
      if (!isDragging && onNodeSelect) {
        // Pass both node ID and type to allow proper navigation in parent component
        onNodeSelect(node.id, node.type);
      }
    };

    const handleContentHover = () => {
      if (Platform.OS === 'web' && node.data.text) {
        // Position tooltip above the node
        showTooltip(
          node.data.text,
          node.x, // Center horizontally
          node.y - 120 // Position above the node
        );
      }
    };

    const handleContentPress = () => {
      if (node.data.text && !isDragging) {
        // Position tooltip above the node
        showTooltip(
          node.data.text,
          node.x, // Center horizontally
          node.y - 120 // Position above the node
        );
      }
    };

    // Get appropriate icon based on node type
    const getNodeIcon = () => {
      switch (node.type) {
        case 'verse':
          return <Ionicons name="book-outline" size={16} color="#4285F4" />;
        case 'note':
          return <Ionicons name="document-text-outline" size={16} color="#FF9500" />;
        case 'theme':
          return <Ionicons name="pricetag-outline" size={16} color="#34C759" />;
        default:
          return null;
      }
    };

    const panResponder = createPanResponder(node.id);

    // Get props for text container with proper platform-specific event handlers
    const textContainerProps = getTextContainerProps(
      handleContentPress,
      handleContentHover,
      hideTooltip
    );

    return (
      <View
        key={`node-${node.id}-${index}`}
        style={[
          styles.node,
          {
            left: node.x - 80,
            top: node.y - 40,
            backgroundColor: node.type === 'verse' ? '#ffffff' : 
                            node.type === 'theme' ? '#f0f8ff' : '#fff9f0',
            borderColor: node.type === 'verse' ? '#4285F4' : 
                        node.type === 'theme' ? '#34C759' : '#FF9500',
            zIndex: activeNodeId === node.id ? 100 : 10,
            elevation: activeNodeId === node.id ? 10 : 3,
          }
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={handlePress}
          style={[
            styles.nodeHeaderClickable,
            node.type === 'verse' && styles.verseHeaderClickable
          ]}
          activeOpacity={0.6}
        >
          <View style={styles.nodeHeader}>
            {getNodeIcon()}
            <Text 
              style={styles.nodeLabel} 
              numberOfLines={1}
              selectable={false}
            >{node.label}</Text>
          </View>
        </TouchableOpacity>
        {node.data.text && (
          <TouchableOpacity
            {...textContainerProps}
          >
          <Text 
            style={styles.nodeText} 
            numberOfLines={2}
              selectable={false}
          >
            {node.data.text}
          </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [onNodeSelect, isDragging, activeNodeId, nodes, mapSize.width, mapSize.height, showTooltip, hideTooltip]);

  // Handle zoom controls
  const handleZoomIn = () => {
    // Use smaller zoom increments on web for more precise control
    const increment = Platform.OS === 'web' ? 0.1 : 0.25;
    const newZoom = Math.min(zoomLevel + increment, 2);
    setZoomLevel(newZoom);
    
    // Update state only - the ScrollView will use zoomLevel in its style
    // setNativeProps is not available in web environments
    if (Platform.OS !== 'web' && horizontalScrollViewRef.current && 'setNativeProps' in horizontalScrollViewRef.current) {
      // Only call this method on native platforms where it's supported
      (horizontalScrollViewRef.current as any).setNativeProps({
        maximumZoomScale: newZoom,
        zoomScale: newZoom
      });
    }
  };

  const handleZoomOut = () => {
    // Use smaller zoom increments on web for more precise control
    const increment = Platform.OS === 'web' ? 0.1 : 0.25;
    const newZoom = Math.max(zoomLevel - increment, 0.5);
    setZoomLevel(newZoom);
    
    // Update state only - the ScrollView will use zoomLevel in its style
    // setNativeProps is not available in web environments
    if (Platform.OS !== 'web' && horizontalScrollViewRef.current && 'setNativeProps' in horizontalScrollViewRef.current) {
      // Only call this method on native platforms where it's supported
      (horizontalScrollViewRef.current as any).setNativeProps({
        zoomScale: newZoom
      });
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    
    // Update state only - the ScrollView will use zoomLevel in its style
    // setNativeProps is not available in web environments
    if (Platform.OS !== 'web' && horizontalScrollViewRef.current && 'setNativeProps' in horizontalScrollViewRef.current) {
      // Only call this method on native platforms where it's supported
      (horizontalScrollViewRef.current as any).setNativeProps({
        zoomScale: 1
      });
    }
  };

  // Function to center the view
  const handleCenterView = useCallback(() => {
    if (horizontalScrollViewRef.current && verticalScrollViewRef.current && mapSize.width > 0 && mapSize.height > 0) {
      // Calculate the bounding box of connected nodes
      const connectedNodes = nodes.filter(node => hasConnections(node.id));
      
      if (connectedNodes.length > 0) {
        // Calculate the center position of connected nodes
        let minX = Number.MAX_VALUE;
        let minY = Number.MAX_VALUE;
        let maxX = Number.MIN_VALUE;
        let maxY = Number.MIN_VALUE;
        
        // Find the bounding box of connected nodes
        connectedNodes.forEach(node => {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x);
          maxY = Math.max(maxY, node.y);
        });
        
        // Calculate center of connected nodes
        const centerNodesX = (minX + maxX) / 2;
        const centerNodesY = (minY + maxY) / 2;
        
        // Calculate scroll position to center these nodes in viewport
        const targetScrollX = Math.max(0, centerNodesX - (viewportSize.width / 2));
        const targetScrollY = Math.max(0, centerNodesY - (viewportSize.height / 2));
        
        console.log('BibleMindMap: Manually centering view on connected nodes at', targetScrollX, targetScrollY);
        
        // Scroll horizontally
        horizontalScrollViewRef.current.scrollTo({
          x: targetScrollX,
          y: 0,
          animated: true
        });
        
        // Scroll vertically
        verticalScrollViewRef.current.scrollTo({
          x: 0,
          y: targetScrollY,
          animated: true
        });
      } else {
        // Fallback to center of map if no connected nodes
        const centerX = Math.max(0, (mapSize.width / 2) - (viewportSize.width / 2));
        const centerY = Math.max(0, (mapSize.height / 2) - (viewportSize.height / 2));
        
        console.log('BibleMindMap: Manually centering view at map center', centerX, centerY);
        
        // Scroll horizontally
        horizontalScrollViewRef.current.scrollTo({
          x: centerX,
          y: 0,
          animated: true
        });
        
        // Scroll vertically
        verticalScrollViewRef.current.scrollTo({
          x: 0,
          y: centerY,
          animated: true
        });
      }
    }
  }, [mapSize, viewportSize, nodes, hasConnections]);

  // Handle minimap navigation
  const handleMinimapPress = (event: GestureResponderEvent) => {
    if (horizontalScrollViewRef.current && verticalScrollViewRef.current && minimapContainerSize.width > 0 && minimapContainerSize.height > 0) {
      // Get touch position relative to minimap
      const { locationX, locationY } = event.nativeEvent;
      
      // Calculate ratio between minimap and full map
      const xRatio = mapSize.width / minimapContainerSize.width;
      const yRatio = mapSize.height / minimapContainerSize.height;
      
      // Calculate target scroll position
      const targetX = locationX * xRatio - (viewportSize.width / 2);
      const targetY = locationY * yRatio - (viewportSize.height / 2);
      
      console.log('BibleMindMap: Navigating via minimap to', targetX, targetY);
      
      // Scroll horizontally
      horizontalScrollViewRef.current.scrollTo({
        x: Math.max(0, Math.min(mapSize.width - viewportSize.width, targetX)),
        y: 0,
        animated: true
      });
      
      // Scroll vertically
      verticalScrollViewRef.current.scrollTo({
        x: 0,
        y: Math.max(0, Math.min(mapSize.height - viewportSize.height, targetY)),
        animated: true
      });
    }
  };

  // Function to determine the label for a note node
  const getNoteLabel = (verseRef: string | undefined) => {
    if (!verseRef) return t('visualization:note');
    return t('visualization:noteOn', { reference: verseRef });
  };

  // Function to get the edge label based on type
  const getEdgeLabel = (type: ConnectionType) => {
    switch (type) {
      case ConnectionType.CROSS_REFERENCE:
        return t('visualization:crossReference');
      case ConnectionType.THEME:
        return t('visualization:theme');
      case ConnectionType.NOTE:
        return t('visualization:note');
      case ConnectionType.PARALLEL:
        return t('visualization:parallel');
      default:
        return t('visualization:shownTogether');
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="map-outline" size={40} color="#4285F4" />
        <Text style={styles.loadingText}>{t('visualization:calculatingLayout')}</Text>
        <Text style={styles.loadingSubtext}>
          {t('visualization:optimizingNodes', { verses: verses.length, notes: notes?.length || 0 })}
        </Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{t('visualization:failedToCreateMindMap')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <View style={styles.container}>
        <ScrollView 
          ref={horizontalScrollViewRef}
          horizontal={true}
          showsHorizontalScrollIndicator={true}
          scrollEnabled={true}
          maximumZoomScale={Platform.OS !== 'web' ? 2 : 1}
          minimumZoomScale={Platform.OS !== 'web' ? 0.5 : 1}
          onScroll={(e) => handleScroll({ ...e, nativeEvent: { ...e.nativeEvent, scrollDirection: 'horizontal' }})}
          scrollEventThrottle={16}
          directionalLockEnabled={false}
          style={{ width: '100%', height: '100%' }}
        >
          <View>
            <ScrollView
              ref={verticalScrollViewRef}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              onScroll={(e) => handleScroll({ ...e, nativeEvent: { ...e.nativeEvent, scrollDirection: 'vertical' }})}
              scrollEventThrottle={16}
              directionalLockEnabled={false}
              contentContainerStyle={[
                styles.contentContainer,
                {
                  width: mapSize.width,
                  height: mapSize.height,
                  paddingBottom: 200,
                  paddingRight: 200,
                }
              ]}
            >
              <View style={Platform.OS === 'web' ? { 
                transform: [{ scale: zoomLevel }],
                transformOrigin: '0 0', // Origin at top-left corner
                width: mapSize.width, 
                height: mapSize.height,
                position: 'relative',
              } : {}}>
                <Svg width={mapSize.width} height={mapSize.height}>
                  {edges.map((edge, index) => {
                    const sourceNode = nodes.find(n => n.id === edge.source);
                    const targetNode = nodes.find(n => n.id === edge.target);

                    if (!sourceNode || !targetNode) return null;

                    return (
                      <Line
                        key={`edge-${edge.id}-${index}`}
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={edge.color}
                        strokeWidth="2"
                      />
                    );
                  })}
                </Svg>
                {showLabels && edges.map((edge, index) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return null;

      // Calculate line midpoint for the touch target
      const midX = (sourceNode.x + targetNode.x) / 2;
      const midY = (sourceNode.y + targetNode.y) / 2;

      return (
        <TouchableOpacity
          key={`touch-${edge.id}-${index}`}
          style={[
            styles.edgeTouchTarget,
            {
              left: midX - 30,
              top: midY - 15,
            }
          ]}
          onPress={() => onConnectionSelect && onConnectionSelect(edge.id)}
        >
                    <Text style={[
                      styles.edgeLabel,
                      { color: edge.color } 
                    ]}>{getEdgeLabel(edge.data.type)}</Text>
        </TouchableOpacity>
      );
                })}
                {nodes
                  .filter(node => hasConnections(node.id))
                  .map((node, index) => renderNode(node, index))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
        
        {/* Control Panel */}
        <View style={styles.controlPanel}>
          <TouchableOpacity 
            style={styles.controlToggle} 
            onPress={() => setControlsExpanded(!controlsExpanded)}
          >
            <Ionicons 
              name={controlsExpanded ? "chevron-down" : "chevron-up"} 
              size={24} 
              color="#333" 
            />
          </TouchableOpacity>
          
          {controlsExpanded && (
            <View style={styles.controlContent}>
              {/* Zoom Controls */}
              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>{t('visualization:zoom')}</Text>
                <View style={styles.controlButtons}>
                  <TouchableOpacity 
                    style={styles.controlButton} 
                    onPress={handleZoomOut}
                  >
                    <Ionicons name="remove" size={20} color="#333" />
                  </TouchableOpacity>
                  <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
                  <TouchableOpacity 
                    style={styles.controlButton} 
                    onPress={handleZoomIn}
                  >
                    <Ionicons name="add" size={20} color="#333" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.controlButton} 
                    onPress={handleResetZoom}
                  >
                    <Ionicons name="refresh" size={20} color="#333" />
                  </TouchableOpacity>
                </View>
                {Platform.OS === 'web' && (
                  <Text style={styles.controlNote}>
                    {t('visualization:ctrlMouseWheelToZoom')}
                  </Text>
                )}
              </View>
              
              {/* Center View Button */}
              <TouchableOpacity 
                style={styles.controlFullButton} 
                onPress={handleCenterView}
              >
                <Ionicons name="locate" size={16} color="#333" />
                <Text style={styles.controlButtonText}>{t('visualization:centerView')}</Text>
              </TouchableOpacity>
              
              {/* Show Labels Toggle */}
              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>{t('visualization:showLabels')}</Text>
                <Switch
                  value={showLabels}
                  onValueChange={setShowLabels}
                  trackColor={{ false: "#ccc", true: "#4285F4" }}
                />
              </View>
              
              {/* Show Minimap Toggle */}
              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>{t('visualization:showMinimap')}</Text>
                <Switch
                  value={showMinimap}
                  onValueChange={setShowMinimap}
                  trackColor={{ false: "#ccc", true: "#4285F4" }}
                />
              </View>
            </View>
          )}
        </View>
        
        {/* Minimap for navigation */}
        {showMinimap && (
          <View style={styles.minimapContainer}>
            <TouchableWithoutFeedback onPress={handleMinimapPress}>
              <View 
                style={styles.minimap}
                onLayout={(e) => {
                  setMinimapContainerSize({
                    width: e.nativeEvent.layout.width,
                    height: e.nativeEvent.layout.height
                  });
                }}
              >
                {/* Miniature version of the nodes */}
                {nodes
                  .filter(node => hasConnections(node.id))
                  .map((node) => (
                  <View
                    key={`minimap-${node.id}`}
                    style={[
                      styles.minimapNode,
                      {
                        left: (node.x / mapSize.width) * minimapContainerSize.width,
                        top: (node.y / mapSize.height) * minimapContainerSize.height,
                        backgroundColor: node.type === 'verse' ? '#3498db' : '#e74c3c'
                      },
                    ]}
                  />
                ))}
                
                {/* Viewport indicator */}
                <View
                  style={[
                    styles.minimapViewport,
                    {
                      left: (scrollPosition.x / mapSize.width) * minimapContainerSize.width,
                      top: (scrollPosition.y / mapSize.height) * minimapContainerSize.height,
                      // Adjust width and height based on zoom level - smaller viewport when zoomed in
                      width: (viewportSize.width / mapSize.width / zoomLevel) * minimapContainerSize.width,
                      height: (viewportSize.height / mapSize.height / zoomLevel) * minimapContainerSize.height,
                    },
                  ]}
                />
              </View>
            </TouchableWithoutFeedback>
            <View style={styles.minimapFooter}>
              <Text style={styles.minimapHint}>{t('visualization:tapToNavigate')}</Text>
              <Text style={styles.minimapZoom}>{Math.round(zoomLevel * 100)}%</Text>
            </View>
          </View>
        )}
        
        {/* Tooltip for displaying full content */}
        <Tooltip 
          content={tooltipContent}
          position={tooltipPosition}
          visible={tooltipVisible}
        />
        
        {/* Center view button */}
        <TouchableOpacity 
          style={styles.centerButton} 
          onPress={handleCenterView}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    width: '100%', 
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    position: 'relative',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  node: {
    position: 'absolute',
    width: 160,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nodeContent: {
    width: '100%',
  },
  nodeHeaderClickable: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 4,
    marginBottom: 6,
    padding: 4,
  },
  verseHeaderClickable: {
    backgroundColor: 'rgba(66, 133, 244, 0.05)', // Light blue background for verse headers
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nodeLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
    flex: 1,
  },
  nodeTextContainer: {
    paddingHorizontal: 4,
  },
  nodeText: {
    fontSize: 12,
    color: '#666',
    // Add a subtle indicator that this is interactive
    textDecorationLine: Platform.OS === 'web' ? 'underline' : 'none',
    textDecorationColor: '#bbb',
    textDecorationStyle: 'dotted',
  },
  edgeTouchTarget: {
    position: 'absolute',
    width: 60,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edgeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    borderWidth: 5,
    borderColor: 'transparent',
    borderTopColor: 'rgba(30, 30, 30, 0.95)',
    width: 0,
    height: 0,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  controlPanel: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    zIndex: 100,
  },
  controlToggle: {
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  controlContent: {
    padding: 10,
    width: 180,
  },
  controlGroup: {
    marginBottom: 10,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#666',
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 12,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'center',
  },
  controlFullButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  minimapContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 4,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 100,
  },
  minimap: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(240, 240, 240, 0.7)',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  minimapNode: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    margin: -2,
  },
  minimapViewport: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.5)',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  minimapHint: {
    fontSize: 10,
    color: '#666',
  },
  controlNote: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#333',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  centerButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#4a90e2',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  minimapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  minimapZoom: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default BibleMindMap; 