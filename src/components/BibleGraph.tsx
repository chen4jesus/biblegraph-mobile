import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  PanResponder,
  Animated,
  Platform,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  SafeAreaView,
} from 'react-native';
import Svg, { Line, Circle, Text as SvgText, Path } from 'react-native-svg';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Verse, Connection, ConnectionType } from '../types/bible';
import { Ionicons } from '@expo/vector-icons';

interface Node {
  id: string;
  verse: Verse;
  x: number;
  y: number;
  radius: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: ConnectionType;
  description: string;
}

interface BibleGraphProps {
  verses: Verse[];
  connections: Connection[];
  onVersePress?: (verse: Verse) => void;
  onConnectionPress?: (connection: Connection) => void;
  showLabels?: boolean;
}

// Enhanced styling with modern color palette
const NODE_RADIUS = 35;
const EDGE_STROKE_WIDTH = 2;
const NODE_STROKE_WIDTH = 2;
const NODE_FILL_COLOR = '#ffffff';
const NODE_STROKE_COLOR = '#4285F4';
const NODE_SELECTED_COLOR = '#EA4335';
const EDGE_COLORS = {
  [ConnectionType.CROSS_REFERENCE]: '#FF9500',
  [ConnectionType.THEME]: '#34C759',
  [ConnectionType.PARALLEL]: '#5856D6',
  [ConnectionType.NOTE]: '#4285F4',
  [ConnectionType.THEMATIC]: '#EA4335',
  [ConnectionType.PROPHECY]: '#FBBC05',
};

const BibleGraph: React.FC<BibleGraphProps> = ({
  verses,
  connections,
  onVersePress,
  onConnectionPress,
  showLabels = true,
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string, content: string }>({ title: '', content: '' });
  const [controls, setControls] = useState<{ visible: boolean }>({ visible: false });

  const pan = useRef(new Animated.ValueXY()).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeGraph();
  }, [verses, connections]);

  const initializeGraph = () => {
    // Create nodes with an improved layout algorithm
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    const radius = Math.min(screenWidth, screenHeight) * 0.35;
    
    const newNodes: Node[] = verses.map((verse, index) => {
      // Arrange nodes in a circular pattern for better initial layout
      const angle = (index / verses.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      return {
        id: verse.id,
        verse,
        x,
        y,
        radius: NODE_RADIUS,
      };
    });

    // Create edges from connections
    const newEdges: Edge[] = connections.map(connection => ({
      id: connection.id,
      source: connection.sourceVerseId,
      target: connection.targetVerseId,
      type: connection.type,
      description: connection.description,
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const resetLayout = () => {
    initializeGraph();
  };

  const centerOnNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    
    // Calculate the offset required to center the node
    const offsetX = screenWidth / 2 - node.x;
    const offsetY = screenHeight / 2 - node.y;
    
    // Animate the pan to center the node
    Animated.spring(pan, {
      toValue: { x: offsetX, y: offsetY },
      useNativeDriver: false,
      friction: 7,
      tension: 40,
    }).start();
    
    // Update the offset state
    setOffset({ x: offsetX, y: offsetY });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        // Check if we're touching a node
        const { locationX, locationY } = evt.nativeEvent;
        const touchedNodeId = findTouchedNode(locationX, locationY);
        
        if (touchedNodeId) {
          setDraggingNode(touchedNodeId);
          // Select the node when starting to drag
          const touchedNode = nodes.find(n => n.id === touchedNodeId);
          if (touchedNode) {
            setSelectedNode(touchedNode);
          }
          return;
        }
        
        // If not touching a node, pan the entire graph
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        if (draggingNode) {
          // Move the specific node
          setNodes(currentNodes => 
            currentNodes.map(node => 
              node.id === draggingNode 
                ? { ...node, x: node.x + gestureState.dx, y: node.y + gestureState.dy } 
                : node
            )
          );
        } else {
          // Pan the whole graph
          Animated.event(
            [null, { dx: pan.x, dy: pan.y }],
            { useNativeDriver: false }
          )(evt, gestureState);
        }
      },
      onPanResponderRelease: () => {
        if (draggingNode) {
          setDraggingNode(null);
        } else {
          pan.flattenOffset();
          setOffset({
            x: offset.x + (pan.x as any)._value,
            y: offset.y + (pan.y as any)._value,
          });
        }
      },
    })
  ).current;

  // Function to find if a touch is on a node
  const findTouchedNode = (x: number, y: number): string | null => {
    // Adjust coordinates for current pan and scale
    const adjustedX = (x - offset.x) / scale;
    const adjustedY = (y - offset.y) / scale;

    for (const node of nodes) {
      const dx = adjustedX - node.x;
      const dy = adjustedY - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= node.radius) {
        return node.id;
      }
    }
    
    return null;
  };

  const handleNodePress = (node: Node) => {
    // Check if it's a short tap (not a drag operation)
    if (!draggingNode) {
      setSelectedNode(prevSelected => prevSelected?.id === node.id ? null : node);
      
      // Show verse details in modal
      setModalContent({
        title: `${node.verse.book} ${node.verse.chapter}:${node.verse.verse}`,
        content: node.verse.text,
      });
      setModalVisible(true);
      
      onVersePress?.(node.verse);
    }
  };

  const handleEdgePress = (edge: Edge) => {
    setSelectedEdge(prevSelected => prevSelected?.id === edge.id ? null : edge);
    const connection = connections.find(c => c.id === edge.id);
    if (connection) {
      onConnectionPress?.(connection);
    }
  };

  const toggleControls = () => {
    setControls(prev => ({ visible: !prev.visible }));
  };

  // Modern curved edge rendering
  const renderEdge = (edge: Edge) => {
    // For note connections, use a different visual style
    if (edge.type === ConnectionType.NOTE) {
      return renderNoteEdge(edge);
    }

    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return null;

    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Bezier curve parameters for a more aesthetic curve
    const midX = (sourceNode.x + targetNode.x) / 2;
    const midY = (sourceNode.y + targetNode.y) / 2;
    const curveFactor = Math.min(distance * 0.2, 60); // Limit the curve height
    
    // Perpendicular offset for the control point
    const cpX = midX - curveFactor * Math.sin(angle);
    const cpY = midY + curveFactor * Math.cos(angle);

    // Create SVG path for curved edge
    const path = `M ${sourceNode.x} ${sourceNode.y} Q ${cpX} ${cpY} ${targetNode.x} ${targetNode.y}`;
    
    // Determine if this edge is selected
    const isSelected = selectedEdge?.id === edge.id;
    const edgeColor = isSelected 
      ? NODE_SELECTED_COLOR 
      : EDGE_COLORS[edge.type] || '#999999';

    return (
      <TouchableOpacity
        key={edge.id}
        onPress={() => handleEdgePress(edge)}
        style={StyleSheet.absoluteFill}
        activeOpacity={0.7}
      >
        <Svg height="100%" width="100%">
          <Path
            d={path}
            stroke={edgeColor}
            strokeWidth={isSelected ? EDGE_STROKE_WIDTH + 1 : EDGE_STROKE_WIDTH}
            fill="none"
          />
          {showLabels && (
            <SvgText
              x={cpX}
              y={cpY - 5}
              fill="#555555"
              fontSize="12"
              fontWeight={isSelected ? "bold" : "normal"}
              textAnchor="middle"
            >
              {edge.description}
            </SvgText>
          )}
        </Svg>
      </TouchableOpacity>
    );
  };

  const renderNoteEdge = (edge: Edge) => {
    const verseNode = nodes.find(n => n.id === edge.source);
    if (!verseNode) return null;

    // Position the note indicator near the verse node
    const noteX = verseNode.x + 30; // Offset to the right
    const noteY = verseNode.y - 25; // Offset upward
    const isSelected = selectedEdge?.id === edge.id;
    
    return (
      <TouchableOpacity
        key={edge.id}
        onPress={() => handleEdgePress(edge)}
        style={StyleSheet.absoluteFill}
        activeOpacity={0.7}
      >
        <Svg height="100%" width="100%">
          {/* Dotted line connecting the note to the verse */}
          <Line
            x1={verseNode.x}
            y1={verseNode.y}
            x2={noteX}
            y2={noteY}
            stroke={isSelected ? NODE_SELECTED_COLOR : EDGE_COLORS[edge.type]}
            strokeWidth={isSelected ? 2 : 1}
            strokeDasharray="3,3"
          />
          {/* Note bubble with shadow effect */}
          <Circle
            cx={noteX}
            cy={noteY}
            r={18}
            fill="#f8f9fa"
            stroke={isSelected ? NODE_SELECTED_COLOR : EDGE_COLORS[edge.type]}
            strokeWidth={isSelected ? 2 : 1}
          />
          {/* Note icon */}
          <SvgText
            x={noteX}
            y={noteY + 1}
            fill={isSelected ? NODE_SELECTED_COLOR : "#4285F4"}
            fontSize="14"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            📝
          </SvgText>
          {/* Only show preview text if labels are enabled */}
          {showLabels && edge.description && (
            <SvgText
              x={noteX}
              y={noteY + 28}
              fill="#333"
              fontSize="10"
              textAnchor="middle"
            >
              {edge.description.length > 12 ? edge.description.substring(0, 12) + '...' : edge.description}
            </SvgText>
          )}
        </Svg>
      </TouchableOpacity>
    );
  };

  const renderNode = (node: Node) => {
    const isSelected = selectedNode?.id === node.id;
    const isDragging = draggingNode === node.id;
    
    return (
      <TouchableOpacity
        key={node.id}
        onPress={() => handleNodePress(node)}
        style={[
          styles.node,
          {
            left: node.x - node.radius,
            top: node.y - node.radius,
            width: node.radius * 2,
            height: node.radius * 2,
            zIndex: isSelected || isDragging ? 10 : 1,
          },
        ]}
        activeOpacity={0.7}
      >
        <Svg height="100%" width="100%">
          {/* Shadow effect */}
          {(isSelected || isDragging) && (
            <Circle
              cx={node.radius}
              cy={node.radius}
              r={node.radius - NODE_STROKE_WIDTH + 3}
              fill="rgba(0,0,0,0.15)"
              opacity={0.5}
            />
          )}
          {/* Main circle */}
          <Circle
            cx={node.radius}
            cy={node.radius}
            r={node.radius - NODE_STROKE_WIDTH}
            fill={NODE_FILL_COLOR}
            stroke={isSelected ? NODE_SELECTED_COLOR : NODE_STROKE_COLOR}
            strokeWidth={isSelected ? NODE_STROKE_WIDTH + 1 : NODE_STROKE_WIDTH}
          />
          {/* Text label */}
          <SvgText
            x={node.radius}
            y={node.radius}
            fill="#333333"
            fontSize="12"
            fontWeight={isSelected ? "bold" : "normal"}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {node.verse.book} {node.verse.chapter}:{node.verse.verse}
          </SvgText>
        </Svg>
      </TouchableOpacity>
    );
  };

  // Render controls overlay
  const renderControls = () => (
    <Animated.View style={[styles.controlsContainer, controls.visible ? styles.visible : styles.hidden]}>
      <TouchableOpacity style={styles.controlButton} onPress={resetLayout}>
        <Ionicons name="refresh" size={22} color="#FFFFFF" />
        <Text style={styles.controlText}>Reset</Text>
      </TouchableOpacity>
      
      {selectedNode && (
        <TouchableOpacity style={styles.controlButton} onPress={() => centerOnNode(selectedNode.id)}>
          <Ionicons name="locate" size={22} color="#FFFFFF" />
          <Text style={styles.controlText}>Center</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // Render verse detail modal
  const renderModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{modalContent.title}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#555" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalText}>{modalContent.content}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => {
                    if (selectedNode) {
                      centerOnNode(selectedNode.id);
                      setModalVisible(false);
                    }
                  }}
                >
                  <Text style={styles.modalButtonText}>Center on Graph</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // Floating action button for controls
  const renderFAB = () => (
    <TouchableOpacity 
      style={styles.fab}
      onPress={toggleControls}
      activeOpacity={0.8}
    >
      <Ionicons name={controls.visible ? "close" : "menu"} size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <GestureHandlerRootView style={styles.container}>
        <Animated.View 
          style={[
            styles.graphContainer,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {edges.map(renderEdge)}
          {nodes.map(renderNode)}
        </Animated.View>
        {renderControls()}
        {renderFAB()}
        {renderModal()}
      </GestureHandlerRootView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  graphContainer: {
    flex: 1,
    position: 'relative',
  },
  node: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: 'rgba(66, 133, 244, 0.9)',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  visible: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  hidden: {
    opacity: 0,
    transform: [{ translateY: 20 }],
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginVertical: 4,
  },
  controlText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalText: {
    fontSize: 16,
    color: '#555555',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 15,
  },
  modalButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default BibleGraph; 