import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Verse, Connection, ConnectionType } from '../types/bible';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line } from 'react-native-svg';

interface BibleMindMapProps {
  verses: Verse[];
  connections: Connection[];
  onNodeSelect?: (verseId: string) => void;
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

const BibleMindMap: React.FC<BibleMindMapProps> = ({
  verses,
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

  // Transform verses and connections into nodes and edges with positions
  const transformData = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      // If no verses, return empty data
      if (!verses || verses.length === 0) {
        console.warn('BibleMindMap: No verses provided');
        setIsLoading(false);
        setError('No verses to display');
        return;
      }

      // Create a Map to track verse IDs we've already seen
      const uniqueVerseIds = new Map<string, number>();
      
      // Calculate layout dimensions based on number of nodes
      const nodeCount = verses.length;
      const columns = Math.ceil(Math.sqrt(nodeCount));
      const rows = Math.ceil(nodeCount / columns);
      const mapWidth = Math.max(screenWidth * 2, columns * 200);
      const mapHeight = Math.max(screenHeight * 2, rows * 150);
      
      setMapSize({ width: mapWidth, height: mapHeight });

      // Create nodes from verses with positions in a grid layout
      const newNodes: Node[] = verses.map((verse, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        
        // Track if we've seen this ID before to handle duplicates
        let uniqueId = verse.id;
        const count = uniqueVerseIds.get(verse.id) || 0;
        
        if (count > 0) {
          // If we've seen this ID before, make it unique by appending the count
          uniqueId = `${verse.id}-dup${count}`;
          console.warn(`BibleMindMap: Duplicate verse ID found: ${verse.id}, creating unique ID: ${uniqueId}`);
        }
        
        // Increment the count for this ID
        uniqueVerseIds.set(verse.id, count + 1);
        
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

      // Update connection references if we've modified any verse IDs
      const updatedConnections = connections.map(connection => {
        // Clone the connection to avoid modifying the original
        return { ...connection };
      });

      // Create edges from connections with updated references if needed
      const newEdges: Edge[] = updatedConnections.map(connection => {
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

        // Find the correct source and target nodes from our newNodes array
        // In case we've renamed any node IDs to make them unique
        const sourceNode = newNodes.find(node => 
          node.id === connection.sourceVerseId || 
          node.id.startsWith(connection.sourceVerseId + '-dup')
        );
        
        const targetNode = newNodes.find(node => 
          node.id === connection.targetVerseId || 
          node.id.startsWith(connection.targetVerseId + '-dup')
        );

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

      // If we have nodes but no edges, create some default edges to make a nicer layout
      if (newNodes.length > 0 && newEdges.length === 0 && newNodes.length > 1) {
        console.log('BibleMindMap: Creating default layout for disconnected nodes');
        // Create a chain layout connecting all nodes
        for (let i = 0; i < newNodes.length - 1; i++) {
          newEdges.push({
            id: `default-edge-${i}`,
            source: newNodes[i].id,
            target: newNodes[i + 1].id,
            label: ConnectionType.THEME,
            color: '#dddddd',
            data: {
              type: ConnectionType.THEME,
              description: 'Verses displayed together'
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
  }, [verses, connections, screenWidth, screenHeight]);

  // Run transformData when verses or connections change
  useEffect(() => {
    console.log(`BibleMindMap: Received ${verses.length} verses and ${connections.length} connections`);
    transformData();
  }, [verses, connections, transformData]);

  // Render each verse node
  const renderNode = useCallback((node: Node, index: number) => {
    const handlePress = () => {
      if (onNodeSelect) {
        onNodeSelect(node.id);
      }
    };

    return (
      <TouchableOpacity
        key={`node-${node.id}-${index}`}
        style={[
          styles.node,
          {
            left: node.x - 80,
            top: node.y - 40,
            backgroundColor: node.type === 'verse' ? '#ffffff' : 
                            node.type === 'theme' ? '#f0f8ff' : '#fffef0',
            borderColor: node.type === 'verse' ? '#4285F4' : 
                        node.type === 'theme' ? '#34C759' : '#FF9500',
          }
        ]}
        onPress={handlePress}
      >
        <Text style={styles.nodeLabel}>{node.label}</Text>
        {node.data.text && (
          <Text 
            style={styles.nodeText} 
            numberOfLines={2}
          >
            {node.data.text}
          </Text>
        )}
      </TouchableOpacity>
    );
  }, [onNodeSelect]);

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

  // Render all edges as components
  const renderEdges = () => {
    return edges.map((edge, index) => {
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
    });
  };

  // Render edge touch targets
  const renderEdgeTouchTargets = () => {
    return edges.map((edge, index) => {
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
          <Text style={styles.edgeLabel}>{edge.label}</Text>
        </TouchableOpacity>
      );
    });
  };

  return (
    <ScrollView 
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
    >
      <Svg width={mapSize.width} height={mapSize.height}>
        {renderEdges()}
      </Svg>
      {renderEdgeTouchTargets()}
      {nodes.map((node, index) => renderNode(node, index))}
    </ScrollView>
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
  nodeLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  nodeText: {
    fontSize: 12,
    color: '#666',
  },
  edgeTouchTarget: {
    position: 'absolute',
    width: 60,
    height: 30,
    backgroundColor: 'transparent',
  },
  edgeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
});

export default BibleMindMap; 