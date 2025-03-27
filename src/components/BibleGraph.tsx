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
import { useTranslation } from 'react-i18next';
import { PinchGestureHandler, State, GestureEvent } from 'react-native-gesture-handler';

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

// Add ZOOM constants with the other constants
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.1;

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
  const [nodeDragPosition, setNodeDragPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // Store last tap timestamp for double-tap detection
  const [lastTapTimestamp, setLastTapTimestamp] = useState(0);

  const pan = useRef(new Animated.ValueXY()).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const nodePan = useRef(new Animated.ValueXY()).current;
  // Track base scale for pinch gesture
  const [baseScale, setBaseScale] = useState(1);

  const { t } = useTranslation();
  const [showHint, setShowHint] = useState(true);
  
  const [iconAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    initializeGraph();
  }, [verses, connections]);

  useEffect(() => {
    if (showHint) {
      const timer = setTimeout(() => {
        setShowHint(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showHint]);

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

  // Handle zoom gestures
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: scaleValue } }],
    { useNativeDriver: false }
  );

  const onPinchHandlerStateChange = (event: GestureEvent) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Type assertion for event.nativeEvent.scale
      const gestureScale = event.nativeEvent.scale as number;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, baseScale * gestureScale));
      setScale(newScale);
      setBaseScale(newScale);
      scaleValue.setValue(1);
    }
  };

  // Handle double tap to reset zoom and position
  const handleDoubleTap = (x: number, y: number) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapTimestamp < DOUBLE_TAP_DELAY) {
      // Double tap detected
      resetView();
    }
    
    setLastTapTimestamp(now);
  };

  const resetView = () => {
    // Reset zoom and position with animation
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
        friction: 7,
        tension: 40,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setBaseScale(1);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        
        // Check for double tap
        handleDoubleTap(locationX, locationY);
        
        const touchedNodeId = findTouchedNode(locationX, locationY);
        
        if (touchedNodeId) {
          const node = nodes.find(n => n.id === touchedNodeId);
          if (node) {
            setDraggingNode(touchedNodeId);
            setSelectedNode(node);
            setDragStart({ x: node.x, y: node.y });
            
            nodePan.setValue({ x: 0, y: 0 });
            
            // Enhanced visual feedback
            Animated.parallel([
              Animated.spring(scaleValue, {
                toValue: 1.1,
                friction: 7,
                tension: 40,
                useNativeDriver: false
              }),
              Animated.timing(new Animated.Value(0), {
                toValue: 1,
                duration: 300,
                useNativeDriver: false
              })
            ]).start();
          }
          return;
        }
        
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        setIsDragging(true);
        
        if (draggingNode) {
          nodePan.setValue({ x: gestureState.dx, y: gestureState.dy });
          
          setNodes(currentNodes => 
            currentNodes.map(node => 
              node.id === draggingNode 
                ? { 
                    ...node, 
                    x: dragStart.x + gestureState.dx, 
                    y: dragStart.y + gestureState.dy 
                  } 
                : node
            )
          );
        } else {
          Animated.event(
            [null, { dx: pan.x, dy: pan.y }],
            { useNativeDriver: false }
          )(evt, gestureState);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (draggingNode) {
          Animated.spring(scaleValue, {
            toValue: 1,
            friction: 5,
            tension: 40,
            useNativeDriver: false
          }).start();
          
          Animated.spring(nodePan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            tension: 40,
            useNativeDriver: false
          }).start();
          
          setDraggingNode(null);
          
          const wasJustTap = Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5;
          if (wasJustTap && !isDragging) {
            const node = nodes.find(n => n.id === draggingNode);
            if (node) {
              handleNodePress(node);
            }
          }
          
          setIsDragging(false);
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

  const findTouchedNode = (x: number, y: number): string | null => {
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
    if (!draggingNode) {
      setSelectedNode(prevSelected => prevSelected?.id === node.id ? null : node);
      
      setModalContent({
        title: `${node.verse.book} ${node.verse.chapter}:${node.verse.verse}`,
        content: node.verse.text,
      });
      setModalVisible(true);
      
      onVersePress?.(node.verse);
    }
  };

  const handleEdgePress = (edge: Edge) => {
    // First check if this is a valid edge
    if (!edge || !edge.id || !edge.source || !edge.target) {
      console.warn('Invalid edge object in handleEdgePress');
      return;
    }
    
    // Toggle the selection state
    setSelectedEdge(prevSelected => prevSelected?.id === edge.id ? null : edge);
    
    // Find the corresponding connection
    const connection = connections.find(c => c.id === edge.id);
    
    // Only call onConnectionPress if we have a valid connection
    if (connection && connection.sourceVerseId && connection.targetVerseId) {
      onConnectionPress?.(connection);
    } else {
      console.warn('Could not find valid connection for edge:', edge.id);
    }
  };

  const toggleControls = () => {
    // Use spring animation for smoother, more natural transitions
    Animated.spring(iconAnimation, {
      toValue: controls.visible ? 0 : 1,
      friction: 8,  // Lower friction for more bounce
      tension: 50,  // Higher tension for faster animation
      useNativeDriver: true,
    }).start();

    // Add a small delay when hiding to ensure animations complete
    if (controls.visible) {
      // First hide the controls
      setControls(prev => ({ visible: false }));
    } else {
      // Show the controls
      setControls(prev => ({ visible: true }));
    }
  };

  const renderEdge = (edge: Edge) => {
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

    const midX = (sourceNode.x + targetNode.x) / 2;
    const midY = (sourceNode.y + targetNode.y) / 2;
    const curveFactor = Math.min(distance * 0.2, 60);
    
    const cpX = midX - curveFactor * Math.sin(angle);
    const cpY = midY + curveFactor * Math.cos(angle);

    const path = `M ${sourceNode.x} ${sourceNode.y} Q ${cpX} ${cpY} ${targetNode.x} ${targetNode.y}`;
    
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

    const noteX = verseNode.x + 30;
    const noteY = verseNode.y - 25;
    const isSelected = selectedEdge?.id === edge.id;
    
    return (
      <TouchableOpacity
        key={edge.id}
        onPress={() => handleEdgePress(edge)}
        style={StyleSheet.absoluteFill}
        activeOpacity={0.7}
      >
        <Svg height="100%" width="100%">
          <Line
            x1={verseNode.x}
            y1={verseNode.y}
            x2={noteX}
            y2={noteY}
            stroke={isSelected ? NODE_SELECTED_COLOR : EDGE_COLORS[edge.type]}
            strokeWidth={isSelected ? 2 : 1}
            strokeDasharray="3,3"
          />
          <Circle
            cx={noteX}
            cy={noteY}
            r={18}
            fill="#f8f9fa"
            stroke={isSelected ? NODE_SELECTED_COLOR : EDGE_COLORS[edge.type]}
            strokeWidth={isSelected ? 2 : 1}
          />
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
    
    const nodeScale = isDragging ? 1.1 : 1;
    
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
            transform: [
              { scale: nodeScale }
            ],
          },
        ]}
        activeOpacity={0.7}
      >
        <Svg height="100%" width="100%">
          {(isSelected || isDragging) && (
            <Circle
              cx={node.radius}
              cy={node.radius}
              r={node.radius - NODE_STROKE_WIDTH + 3}
              fill="rgba(0,0,0,0.15)"
              opacity={0.5}
            />
          )}
          <Circle
            cx={node.radius}
            cy={node.radius}
            r={node.radius - NODE_STROKE_WIDTH}
            fill={NODE_FILL_COLOR}
            stroke={isDragging ? '#FBBC05' : isSelected ? NODE_SELECTED_COLOR : NODE_STROKE_COLOR}
            strokeWidth={isSelected || isDragging ? NODE_STROKE_WIDTH + 1 : NODE_STROKE_WIDTH}
          />
          <SvgText
            x={node.radius}
            y={node.radius}
            fill="#333333"
            fontSize="12"
            fontWeight={isSelected || isDragging ? "bold" : "normal"}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {node.verse.book} {node.verse.chapter}:{node.verse.verse}
          </SvgText>
        </Svg>
      </TouchableOpacity>
    );
  };

  const renderControls = () => {
    // Create a smooth slide-in from the right that complements the FAB animation
    const translateX = iconAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [50, 0]
    });
    
    const translateY = iconAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [10, 0]
    });
    
    const opacity = iconAnimation.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0, 0.7, 1]
    });

    // Add a scale effect that matches the FAB
    const scale = iconAnimation.interpolate({
      inputRange: [0, 0.8, 1],
      outputRange: [0.8, 0.95, 1]
    });

    return (
      <Animated.View 
        style={[
          styles.controlsContainer,
          {
            opacity,
            transform: [
              { translateX },
              { translateY },
              { scale }
            ],
            display: controls.visible ? 'flex' : 'none'
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={resetLayout}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={22} color="#FFFFFF" />
          <Text style={styles.controlText}>Reset</Text>
        </TouchableOpacity>
        
        {selectedNode && (
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={() => centerOnNode(selectedNode.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="locate" size={22} color="#FFFFFF" />
            <Text style={styles.controlText}>Center</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

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
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderFAB = () => {
    // Create smoother, more modern rotation and transition effects
    const rotation = iconAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '135deg'] // Use 135 degrees for a more natural close icon transition
    });

    // Add additional scaling effect for a more tactile feel
    const scale = iconAnimation.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0.9, 1]
    });

    return (
      <TouchableOpacity 
        style={[styles.fab, { zIndex: 1000 }]}
        onPress={toggleControls}
        activeOpacity={0.7} // Slightly more responsive feedback
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Animated.View 
          style={{ 
            transform: [
              { rotate: rotation },
              { scale }
            ],
            width: 24,
            height: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Using a single icon type with rotation creates a cleaner transition */}
          <Ionicons 
            name="menu" 
            size={24} 
            color="#FFFFFF" 
          />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderDragHint = () => {
    if (!showHint) return null;
    
    return (
      <Animated.View style={styles.dragHint}>
        <Ionicons name="finger-print" size={24} color="#4285F4" />
        <View style={styles.dragHintTextContainer}>
          <Text style={styles.dragHintText}>
            {t('graph:dragHint')}
          </Text>
          <Text style={styles.dragHintSubtext}>
            {t('graph:doubleTapToReset')}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => setShowHint(false)}
          style={styles.hintCloseButton}
        >
          <Ionicons name="close" size={18} color="#777" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Add zoom controls
  function renderZoomControls() {
    return (
      <View style={styles.zoomControls}>
        <TouchableOpacity 
          style={styles.zoomButton}
          onPress={() => {
            const newScale = Math.min(MAX_SCALE, scale + SCALE_STEP);
            setScale(newScale);
            setBaseScale(newScale);
          }}
          accessibilityLabel={t('graph:zoomIn')}
        >
          <Ionicons name="add" size={24} color="#4285F4" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.zoomButton}
          onPress={() => {
            const newScale = Math.max(MIN_SCALE, scale - SCALE_STEP);
            setScale(newScale);
            setBaseScale(newScale);
          }}
          accessibilityLabel={t('graph:zoomOut')}
        >
          <Ionicons name="remove" size={24} color="#4285F4" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <GestureHandlerRootView style={styles.container}>
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchHandlerStateChange}
        >
          <Animated.View style={styles.container}>
            <Animated.View 
              style={[
                styles.graphContainer,
                {
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                    { scale: scaleValue }
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
            {renderDragHint()}
            {renderZoomControls()}
          </Animated.View>
        </PinchGestureHandler>
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
    backgroundColor: 'rgba(66, 133, 244, 0.95)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 999,
    // Add matching border for design consistency
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 4,
    borderRadius: 8,
  },
  controlText: {
    color: '#FFFFFF',
    marginLeft: 10,
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    // Add outer border for a refined look
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
  dragHint: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  dragHintTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  dragHintText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  dragHintSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  hintCloseButton: {
    padding: 5,
  },
  zoomControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  zoomButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
});

export default BibleGraph; 