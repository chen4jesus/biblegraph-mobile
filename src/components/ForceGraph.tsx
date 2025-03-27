import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Dimensions, Platform, TouchableWithoutFeedback, PanResponder, GestureResponderEvent } from 'react-native';
import Svg, { SvgProps } from 'react-native-svg';
import { Circle, Line, G, Text } from 'react-native-svg';
import { GraphNode, GraphEdge } from '../types/bible';

const { width, height } = Dimensions.get('window');

interface ForceGraphProps {
  width?: number;
  height?: number;
  nodes: GraphNode[];
  links: GraphEdge[];
  onNodePress?: (node: GraphNode) => void;
  onLinkPress?: (link: GraphEdge) => void;
  showLabels?: boolean;
}

// Enhanced force-directed graph component with D3-style physics
const ForceGraph: React.FC<ForceGraphProps> = ({ 
  width: propWidth = width,
  height: propHeight = height,
  nodes = [], 
  links = [], 
  onNodePress,
  onLinkPress,
  showLabels = true
}) => {
  const [graphNodes, setGraphNodes] = useState<Array<GraphNode & {x: number, y: number, fx?: number | null, fy?: number | null}>>([]);
  const [graphLinks, setGraphLinks] = useState<GraphEdge[]>([]);
  const [dimensions] = useState({ width: propWidth, height: propHeight });
  const svgRef = useRef<View>(null);
  const animationRef = useRef<number>();
  const simulationActive = useRef(false);
  const draggingNode = useRef<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  // Create a pan responder for handling node dragging
  const panResponder = useRef(
    PanResponder.create({
      // We want to handle all touches
      onStartShouldSetPanResponder: () => true,
      // Only start panning if we're over a node
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only if we already have a dragging node or are near a node
        return draggingNode.current !== null;
      },
      // When touch begins, check if we're touching a node
      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        console.log(`Touch at (${locationX}, ${locationY})`);
        
        // Find which node was touched
        const touchedNode = findNodeAtPosition(locationX, locationY);
        if (touchedNode) {
          console.log(`Started dragging node: ${touchedNode.id}`);
          draggingNode.current = touchedNode.id;
          
          // Fix the node position at current position
          const updatedNodes = currentNodesRef.current.map(n => {
            if (n.id === touchedNode.id) {
              return {
                ...n,
                fx: n.x,
                fy: n.y
              };
            }
            return n;
          });
          
          currentNodesRef.current = updatedNodes;
          setGraphNodes(updatedNodes);
          setSelectedNode(touchedNode.id);
          
          // Reheat the simulation
          if (!simulationActive.current) {
            simulationActive.current = true;
            simulateForces();
          }
        }
      },
      // Update the node position during drag
      onPanResponderMove: (evt, gestureState) => {
        if (!draggingNode.current) return;
        
        // Use the gesture state to get the absolute position
        const x = gestureState.moveX;
        const y = gestureState.moveY;
        
        console.log(`Dragging node to (${x}, ${y})`);
        
        // Update node position
        const updatedNodes = currentNodesRef.current.map(n => {
          if (n.id === draggingNode.current) {
            return {
              ...n,
              x,
              y,
              fx: x,
              fy: y
            };
          }
          return n;
        });
        
        currentNodesRef.current = updatedNodes;
        setGraphNodes(updatedNodes);
      },
      // When drag ends, release the node
      onPanResponderRelease: () => {
        if (!draggingNode.current) return;
        
        console.log(`Finished dragging node: ${draggingNode.current}`);
        
        // Unfix the node position but keep its current position
        const node = currentNodesRef.current.find(n => n.id === draggingNode.current);
        if (node) {
          const updatedNodes = currentNodesRef.current.map(n => {
            if (n.id === draggingNode.current) {
              return {
                ...n,
                fx: null,
                fy: null
              };
            }
            return n;
          });
          
          currentNodesRef.current = updatedNodes;
          setGraphNodes(updatedNodes);
        }
        
        draggingNode.current = null;
      },
      onPanResponderTerminate: () => {
        if (draggingNode.current) {
          // Same as release
          const updatedNodes = currentNodesRef.current.map(n => {
            if (n.id === draggingNode.current) {
              return {
                ...n,
                fx: null,
                fy: null
              };
            }
            return n;
          });
          
          currentNodesRef.current = updatedNodes;
          setGraphNodes(updatedNodes);
          draggingNode.current = null;
        }
      }
    })
  ).current;
  
  // Find node at specific position
  const findNodeAtPosition = (x: number, y: number) => {
    // Find a node that contains the touch point
    return graphNodes.find(node => {
      const nodeSize = getNodeSize(node);
      const distanceSquared = Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2);
      // Increase hit area for easier touch
      return distanceSquared <= Math.pow(nodeSize + 15, 2);
    });
  };

  // Keep track of current nodes/links to prevent unnecessary re-renders
  const prevNodesRef = useRef<GraphNode[]>([]);
  const prevLinksRef = useRef<GraphEdge[]>([]);
  
  // Add a ref to keep track of current node positions during simulation
  const currentNodesRef = useRef<Array<GraphNode & {x: number, y: number, fx?: number | null, fy?: number | null}>>([]);
  
  // Log render for debugging
  console.log(`ForceGraph render: ${nodes.length} nodes, ${links.length} links`);
  
  // Initialize graph with nodes data
  useEffect(() => {
    // Only initialize if nodes have changed or we have new nodes
    if (nodes.length === 0) {
      setGraphNodes([]);
      currentNodesRef.current = [];
      return;
    }
    
    // Check if nodes have changed
    const nodesChanged = 
      nodes.length !== prevNodesRef.current.length || 
      nodes.some((node, i) => prevNodesRef.current[i]?.id !== node.id);
    
    if (nodesChanged) {
      console.log(`ForceGraph: Initializing ${nodes.length} nodes`);
      
      // Calculate optimal initial positions for nodes
      const calculateInitialPositions = () => {
        // Padding from edges
        const padding = Math.min(dimensions.width, dimensions.height) * 0.1;
        const availableWidth = dimensions.width - (padding * 2);
        const availableHeight = dimensions.height - (padding * 2);
        
        // Choose layout based on node count
        if (nodes.length <= 10) {
          // Circular layout for small number of nodes
          return nodes.map((node, i) => {
            const angle = (i / nodes.length) * 2 * Math.PI;
            const radius = Math.min(availableWidth, availableHeight) * 0.4;
            
            return {
              ...node,
              x: Math.cos(angle) * radius + dimensions.width / 2,
              y: Math.sin(angle) * radius + dimensions.height / 2,
              fx: null,
              fy: null
            };
          });
        } else {
          // Grid layout for larger number of nodes
          // Calculate grid dimensions based on aspect ratio
          const aspectRatio = availableWidth / availableHeight;
          const totalNodes = nodes.length;
          
          let cols = Math.ceil(Math.sqrt(totalNodes * aspectRatio));
          let rows = Math.ceil(totalNodes / cols);
          
          // Ensure we have enough cells
          if (cols * rows < totalNodes) {
            cols = Math.ceil(Math.sqrt(totalNodes * aspectRatio)) + 1;
            rows = Math.ceil(totalNodes / cols);
          }
          
          // Calculate cell size
          const cellWidth = availableWidth / cols;
          const cellHeight = availableHeight / rows;
          
          // Position nodes in a grid with some randomness
          return nodes.map((node, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Add some randomness within the cell to avoid perfect grid
            const jitterX = (Math.random() - 0.5) * cellWidth * 0.5;
            const jitterY = (Math.random() - 0.5) * cellHeight * 0.5;
            
            return {
              ...node,
              x: padding + (col + 0.5) * cellWidth + jitterX,
              y: padding + (row + 0.5) * cellHeight + jitterY,
              fx: null,
              fy: null
            };
          });
        }
      };
      
      // Create initial positions - start from existing positions for nodes that exist
      const initialNodes = nodes.map(node => {
        const existingNode = graphNodes.find(n => n.id === node.id);
        if (existingNode) {
          // Keep existing position and fixed status
          return {
            ...node,
            x: existingNode.x,
            y: existingNode.y,
            fx: existingNode.fx,
            fy: existingNode.fy
          };
        }
        return null; // Will be positioned in the next step
      }).filter(Boolean) as Array<GraphNode & {x: number, y: number, fx?: number | null, fy?: number | null}>;
      
      // Calculate initial positions for new nodes
      const newNodeIds = nodes.filter(node => !initialNodes.some(n => n.id === node.id)).map(n => n.id);
      
      if (newNodeIds.length > 0) {
        console.log(`ForceGraph: Calculating positions for ${newNodeIds.length} new nodes`);
        
        // Calculate positions for all nodes to maintain layout consistency
        const allPositions = calculateInitialPositions();
        
        // Only use positions for new nodes
        const newNodes = allPositions.filter(node => newNodeIds.includes(node.id));
        initialNodes.push(...newNodes);
      }
      
      // Important: Update both state and ref
      setGraphNodes(initialNodes);
      currentNodesRef.current = [...initialNodes];
      setGraphLinks(links);
      prevNodesRef.current = [...nodes];
      prevLinksRef.current = [...links];
      
      // Stop any existing simulation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        simulationActive.current = false;
      }
      
      // Start the simulation
      simulationActive.current = true;
      simulateForces();
      
      console.log(`ForceGraph: Started simulation with ${initialNodes.length} nodes`);
    } else if (links.length !== prevLinksRef.current.length || 
            links.some((link, i) => prevLinksRef.current[i]?.id !== link.id)) {
      // Links changed but nodes didn't
      setGraphLinks(links);
      prevLinksRef.current = [...links];
    }
  }, [nodes, links, dimensions]);
  
  // Clear animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        simulationActive.current = false;
      }
    };
  }, []);

  // D3-style force simulation
  const simulateForces = () => {
    let iteration = 0;
    const maxIterations = 300; 
    let alpha = 1.0;
    const alphaMin = 0.001;
    const alphaDecay = 0.0228; // Similar to D3's default
    const alphaTarget = 0;
    
    // Force parameters - adjusted for better spacing
    const linkDistance = Math.min(dimensions.width, dimensions.height) * 0.15; // Relative to screen size
    const linkStrength = 0.7;
    const chargeStrength = -40; // Stronger repulsion
    const centerStrength = 0.05;
    
    const runSimulation = () => {
      // Check if we should stop
      if (iteration >= maxIterations || alpha < alphaMin || !simulationActive.current) {
        simulationActive.current = false;
        console.log(`ForceGraph: Simulation completed after ${iteration} iterations`);
        return;
      }
      
      iteration++;
      alpha = Math.max(alphaMin, alpha * (1 - alphaDecay) + alphaTarget * (1 - (1 - alphaDecay)));
      
      // Important: Use currentNodesRef.current for latest positions
      const updatedNodes = [...currentNodesRef.current].map(node => {
        // Skip fixed nodes (being dragged)
        if (node.fx !== undefined && node.fx !== null && 
            node.fy !== undefined && node.fy !== null) {
          return {
            ...node,
            x: node.fx,
            y: node.fy
          };
        }
        
        // Calculate forces from all other nodes (repulsion - like d3.forceManyBody)
        let fx = 0, fy = 0;
        
        currentNodesRef.current.forEach(otherNode => {
          if (node.id === otherNode.id) return;
          
          const dx = node.x - otherNode.x;
          const dy = node.y - otherNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Charge force (like d3.forceManyBody)
          if (distance < 100) {
            const force = chargeStrength / distance;
            fx += (dx / distance) * force * alpha;
            fy += (dy / distance) * force * alpha;
          }
        });
        
        // Apply forces from links (attraction - like d3.forceLink)
        graphLinks.forEach(link => {
          if (link.source === node.id || link.target === node.id) {
            const targetId = link.source === node.id ? link.target : link.source;
            const target = currentNodesRef.current.find(n => n.id === targetId);
            
            if (target) {
              const dx = node.x - target.x;
              const dy = node.y - target.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              
              // Link force (like d3.forceLink)
              const force = (distance - linkDistance) * linkStrength * alpha;
              fx -= (dx / distance) * force;
              fy -= (dy / distance) * force;
            }
          }
        });
        
        // Add centering force (like d3.forceCenter)
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        fx += (centerX - node.x) * centerStrength * alpha;
        fy += (centerY - node.y) * centerStrength * alpha;
        
        // Update position based on forces
        return {
          ...node,
          x: Math.max(20, Math.min(dimensions.width - 20, node.x + fx)),
          y: Math.max(20, Math.min(dimensions.height - 20, node.y + fy))
        };
      });
      
      // Important: Update ref first to ensure next tick has latest positions
      currentNodesRef.current = updatedNodes;
      
      // Update state less frequently to avoid render thrashing
      if (iteration % 3 === 0 || iteration >= maxIterations - 1) {
        setGraphNodes(updatedNodes);
      }
      
      // Continue simulation
      animationRef.current = requestAnimationFrame(runSimulation);
    };
    
    // Start the simulation
    runSimulation();
  };

  // Handle node press
  const handleNodePress = (node: GraphNode) => {
    console.log(`Node pressed: ${node.id}`);
    setSelectedNode(node.id);
    if (onNodePress) onNodePress(node);
  };

  // Handle link press
  const handleLinkPress = (link: GraphEdge) => {
    if (onLinkPress) onLinkPress(link);
  };

  // Create props for touch handling based on platform
  const createTouchProps = (handler: () => void) => {
    return Platform.OS === 'web'
      ? { onClick: handler }
      : { onPress: handler };
  };

  // Handle node click/tap
  const handleNodeClick = (nodeId: string) => {
    const node = graphNodes.find(n => n.id === nodeId);
    if (node && onNodePress) {
      onNodePress(node);
    }
    setSelectedNode(nodeId);
  };

  return (
    <View 
      style={[styles.container, { width: dimensions.width, height: dimensions.height }]} 
      {...panResponder.panHandlers}
    >
      <Svg width={dimensions.width} height={dimensions.height}>
        <G>
          {/* Draw links */}
          {graphLinks.map((link, i) => {
            const source = graphNodes.find(n => n.id === link.source);
            const target = graphNodes.find(n => n.id === link.target);
            
            if (!source || !target) return null;
            
            // Use a wrapper element for touch handling
            return (
              <G key={`link-${link.id || i}`} {...createTouchProps(() => handleLinkPress(link))}>
                <Line
                  x1={source.x || 0}
                  y1={source.y || 0}
                  x2={target.x || 0}
                  y2={target.y || 0}
                  stroke={getLinkColor(link)}
                  strokeOpacity={0.6}
                  strokeWidth={2}
                />
              </G>
            );
          })}
          
          {/* Draw nodes */}
          {graphNodes.map((node) => (
            <G key={`node-${node.id}`}>
              <Circle
                cx={node.x || 0}
                cy={node.y || 0}
                r={getNodeSize(node)}
                fill={getNodeColor(node)}
                stroke={selectedNode === node.id ? "#FF5722" : "#FFFFFF"} 
                strokeWidth={selectedNode === node.id ? 2.5 : 1.5}
              />
              {showLabels && node.label && (
                <Text
                  x={node.x || 0}
                  y={(node.y || 0) + getNodeSize(node) + 12}
                  fontSize={11}
                  fill="#333"
                  textAnchor="middle"
                  fontWeight={selectedNode === node.id ? "bold" : "normal"}
                >
                  {node.label}
                </Text>
              )}
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
};

// Helper functions for node and link styling
const getNodeSize = (node: GraphNode): number => {
  switch (node.type) {
    case 'VERSE':
      return 12;
    case 'GROUP':
      return 18;
    case 'NOTE':
      return 10;
    case 'TAG':
      return 8;
    default:
      return 10;
  }
};

const getNodeColor = (node: GraphNode): string => {
  switch (node.type) {
    case 'VERSE':
      return '#1e88e5'; // Blue
    case 'GROUP':
      return '#43a047'; // Green
    case 'NOTE':
      return '#ffb300'; // Amber
    case 'TAG':
      return '#e53935'; // Red
    default:
      return '#9e9e9e'; // Grey
  }
};

const getLinkColor = (link: GraphEdge): string => {
  switch (link.type) {
    case 'CROSS_REFERENCE':
      return '#1e88e5'; // Blue
    case 'THEME':
      return '#43a047'; // Green
    case 'NOTE':
      return '#ffb300'; // Amber
    case 'GROUP_MEMBER':
      return '#9e9e9e'; // Grey
    default:
      return '#9e9e9e'; // Grey
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
  },
});

export default ForceGraph;
