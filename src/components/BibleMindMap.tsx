import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState, Animated, Platform } from 'react-native';
import { Verse, Connection, ConnectionType, Note } from '../types/bible';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line } from 'react-native-svg';

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
  
  // State declarations - always keep these at the top level
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const lastScrollPos = useRef({ x: 0, y: 0 });
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Transform verses, notes, and connections into nodes and edges with positions
  const transformData = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      // If no verses or notes, return empty data
      if ((!verses || verses.length === 0) && (!notes || notes.length === 0)) {
        console.warn('BibleMindMap: No content to display');
        setIsLoading(false);
        setError('No content to display');
        return;
      }

      // Create a Map to track node IDs we've already seen
      const uniqueIds = new Map<string, number>();
      
      // Calculate layout dimensions based on number of nodes
      const nodeCount = verses.length + (notes?.length || 0);
      const columns = Math.ceil(Math.sqrt(nodeCount));
      const rows = Math.ceil(nodeCount / columns);
      const mapWidth = Math.max(screenWidth * 2, columns * 200);
      const mapHeight = Math.max(screenHeight * 2, rows * 150);
      
      setMapSize({ width: mapWidth, height: mapHeight });

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
          x: 100 + col * 200,
          y: 100 + row * 150,
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
          ? `Note on ${relatedVerse.book} ${relatedVerse.chapter}:${relatedVerse.verse}` 
          : 'Note';
        
        return {
          id: uniqueId,
          label: noteLabel,
          x: 100 + col * 200,
          y: 100 + row * 150,
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
          label: connection.type,
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
                label: ConnectionType.NOTE,
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
            label: ConnectionType.THEME,
            color: '#dddddd',
            data: {
              type: ConnectionType.THEME,
              description: 'Shown together'
            }
          });
        }
      }

      setNodes(newNodes);
      setEdges(newEdges);
      setIsLoading(false);
    } catch (err) {
      console.error('Error transforming mind map data:', err);
      setError('Failed to create mind map');
      setIsLoading(false);
    }
  }, [verses, notes, connections, screenWidth, screenHeight]);

  // Run transformData when verses, notes, or connections change
  useEffect(() => {
    console.log(`BibleMindMap: Received ${verses.length} verses, ${notes?.length || 0} notes, and ${connections.length} connections`);
    transformData();
  }, [verses, notes, connections, transformData]);

  // Function to determine if a node has any connections
  const hasConnections = useCallback((nodeId: string): boolean => {
    return edges.some(edge => edge.source === nodeId || edge.target === nodeId);
  }, [edges]);

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
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        setActiveNodeId(nodeId);

        // Save current scroll position
        if (scrollViewRef.current) {
          scrollViewRef.current.flashScrollIndicators();
        }
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

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading mind map...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer, 
          { width: mapSize.width, height: mapSize.height }
        ]}
        horizontal={true}
        maximumZoomScale={2}
        minimumZoomScale={0.5}
        showsHorizontalScrollIndicator={true}
        showsVerticalScrollIndicator={true}
        scrollEnabled={!isDragging}
      >
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
        {edges.map((edge, index) => {
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
              ]}>{edge.label}</Text>
            </TouchableOpacity>
          );
        })}
        {nodes
          .filter(node => hasConnections(node.id))
          .map((node, index) => renderNode(node, index))}
      </ScrollView>
      
      {/* Tooltip for displaying full content */}
      <Tooltip 
        content={tooltipContent}
        position={tooltipPosition}
        visible={tooltipVisible}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default BibleMindMap; 