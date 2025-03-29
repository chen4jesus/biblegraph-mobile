import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Dimensions, Platform, Pressable, PanResponder, GestureResponderEvent } from 'react-native';
import Svg, { SvgProps } from 'react-native-svg';
import { Circle, Line, G, Text } from 'react-native-svg';
import { GraphNode, GraphEdge } from '../types/bible';

// Add extended interface for GraphEdge
interface ExtendedGraphEdge extends GraphEdge {
  weight?: number;
}

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
  const [graphLinks, setGraphLinks] = useState<ExtendedGraphEdge[]>([]);
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
        console.debug(`Touch at (${locationX}, ${locationY})`);
        
        // Find which node was touched
        const touchedNode = findNodeAtPosition(locationX, locationY);
        if (touchedNode) {
          console.debug(`Started dragging node: ${touchedNode.id}`);
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
        
        console.debug(`Dragging node to (${x}, ${y})`);
        
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
        
        console.debug(`Finished dragging node: ${draggingNode.current}`);
        
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
  console.debug(`ForceGraph render: ${nodes.length} nodes, ${links.length} links`);
  
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
      console.debug(`ForceGraph: Initializing ${nodes.length} nodes`);
      
      // Calculate optimal initial positions for nodes
      const calculateInitialPositions = () => {
        // Increase padding from edges for better visibility
        const padding = Math.min(dimensions.width, dimensions.height) * 0.15;
        const availableWidth = dimensions.width - (padding * 2);
        const availableHeight = dimensions.height - (padding * 2);
        
        // Choose layout based on node count
        if (nodes.length <= 10) {
          // Circular layout for small number of nodes with more spacing
          return nodes.map((node, i) => {
            const angle = (i / nodes.length) * 2 * Math.PI;
            // Use a larger radius to push nodes further out
            const radius = Math.min(availableWidth, availableHeight) * 0.45;
            
            return {
              ...node,
              x: Math.cos(angle) * radius + dimensions.width / 2,
              y: Math.sin(angle) * radius + dimensions.height / 2,
              fx: null,
              fy: null
            };
          });
        } else if (nodes.length <= 20) {
          // Spiral layout for medium number of nodes
          return nodes.map((node, i) => {
            // Golden ratio for more natural spacing
            const goldenRatio = (1 + Math.sqrt(5)) / 2;
            const theta = i * 2 * Math.PI / goldenRatio;
            
            // Radius increases as we move out in the spiral
            const distance = Math.sqrt(i) / Math.sqrt(nodes.length) * Math.min(availableWidth, availableHeight) * 0.45;
            
            return {
              ...node,
              x: Math.cos(theta) * distance + dimensions.width / 2,
              y: Math.sin(theta) * distance + dimensions.height / 2,
              fx: null,
              fy: null
            };
          });
        } else {
          // Grid layout for larger number of nodes with better spacing
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
          
          // Calculate cell size with more space between nodes
          const cellWidth = availableWidth / (cols + 0.5);  // Add extra space
          const cellHeight = availableHeight / (rows + 0.5);  // Add extra space
          
          // Position nodes in a grid with some randomness
          return nodes.map((node, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Add some randomness within the cell for more natural layout
            const jitterX = (Math.random() - 0.5) * cellWidth * 0.3;
            const jitterY = (Math.random() - 0.5) * cellHeight * 0.3;
            
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
        console.debug(`ForceGraph: Calculating positions for ${newNodeIds.length} new nodes`);
        
        // Calculate positions for all nodes to maintain layout consistency
        const allPositions = calculateInitialPositions();
        
        // Only use positions for new nodes
        const newNodes = allPositions.filter(node => newNodeIds.includes(node.id));
        initialNodes.push(...newNodes);
      }
      
      // Important: Update both state and ref
      setGraphNodes(initialNodes);
      currentNodesRef.current = [...initialNodes];
      setGraphLinks(links as ExtendedGraphEdge[]);
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
      
      console.debug(`ForceGraph: Started simulation with ${initialNodes.length} nodes`);
    } else if (links.length !== prevLinksRef.current.length || 
            links.some((link, i) => prevLinksRef.current[i]?.id !== link.id)) {
      // Links changed but nodes didn't
      setGraphLinks(links as ExtendedGraphEdge[]);
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
    
    // Force parameters - adjusted to match D3 behavior
    const nodeSeparationFactor = Math.min(dimensions.width, dimensions.height) * 0.01;
    const linkDistance = Math.min(dimensions.width, dimensions.height) * 0.15; // Link distance relative to screen size
    const linkStrength = 0.7; // Stronger links to keep related nodes together
    const chargeStrength = -30 * nodeSeparationFactor; // Repulsion force
    const centerStrength = 0.1; // Center force
    const clusteringStrength = 0.5; // Strength of type-based clustering
    
    // Group nodes by type for clustering
    const nodesByType: Record<string, Array<GraphNode & {x: number, y: number}>> = {};
    currentNodesRef.current.forEach(node => {
      if (!nodesByType[node.type]) {
        nodesByType[node.type] = [];
      }
      nodesByType[node.type].push(node);
    });
    
    const runSimulation = () => {
      // Check if we should stop
      if (iteration >= maxIterations || alpha < alphaMin || !simulationActive.current) {
        simulationActive.current = false;
        console.debug(`ForceGraph: Simulation completed after ${iteration} iterations`);
        return;
      }
      
      iteration++;
      // D3-style alpha cooling
      alpha = Math.max(alphaMin, alpha * (1 - alphaDecay) + alphaTarget * alphaDecay);
      
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
        
        // Force many body - charge (repulsion or attraction)
        currentNodesRef.current.forEach(otherNode => {
          if (node.id === otherNode.id) return;
          
          const dx = node.x - otherNode.x;
          const dy = node.y - otherNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Inverse square law with distance clamping (like D3)
          const strength = chargeStrength * alpha;
          // Apply stronger forces between nodes of the same type (clustering)
          const typeFactor = node.type === otherNode.type ? 0.2 : 1.0;
          
          // D3 uses a distance-clamped charge force
          if (distance < 180) {
            let force;
            if (distance < 30) {
              // Strong repulsion for very close nodes to prevent overlap
              force = strength * typeFactor * 10 / Math.max(9, distance * distance);
            } else {
              // Regular inverse square law for moderate distances
              force = strength * typeFactor / distance;
            }
            
            fx += (dx / distance) * force;
            fy += (dy / distance) * force;
          }
        });
        
        // Apply forces from links (attraction - like d3.forceLink)
        let hasLinks = false;
        
        graphLinks.forEach(link => {
          if (link.source === node.id || link.target === node.id) {
            hasLinks = true;
            const targetId = link.source === node.id ? link.target : link.source;
            const target = currentNodesRef.current.find(n => n.id === targetId);
            
            if (target) {
              const dx = node.x - target.x;
              const dy = node.y - target.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              
              // Link force with bias based on node type
              // Links between same type nodes are stronger (cluster by type)
              const sameType = node.type === target.type;
              const bias = sameType ? 1.2 : 0.8; // Bias to create clusters by type
              
              // D3-style link force with distance constraint
              let strength = linkStrength * bias;
              // More important links can be stronger
              const extendedLink = link as ExtendedGraphEdge;
              if (extendedLink.weight) {
                strength *= extendedLink.weight;
              }
              
              // The link acts like a spring
              const force = (distance - linkDistance) * strength * alpha;
              fx -= (dx / distance) * force;
              fy -= (dy / distance) * force;
            }
          }
        });
        
        // Type-based clustering force (encourages nodes of same type to cluster)
        if (nodesByType[node.type] && nodesByType[node.type].length > 1) {
          let clusterX = 0, clusterY = 0;
          
          // Calculate center of mass for nodes of this type
          nodesByType[node.type].forEach(typeNode => {
            if (typeNode.id !== node.id) {
              clusterX += typeNode.x;
              clusterY += typeNode.y;
            }
          });
          
          const count = nodesByType[node.type].length - 1;
          if (count > 0) {
            clusterX /= count;
            clusterY /= count;
            
            // Apply a gentle force toward the cluster center
            const dx = clusterX - node.x;
            const dy = clusterY - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Only apply if not too far away
            if (distance < Math.min(dimensions.width, dimensions.height) * 0.3) {
              fx += dx * clusteringStrength * alpha * 0.01;
              fy += dy * clusteringStrength * alpha * 0.01;
            }
          }
        }
        
        // Add centering force (like d3.forceCenter)
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        
        // Create radial sectors based on node type for better separation
        const typeCount = Object.keys(nodesByType).length;
        const typeIndex = Object.keys(nodesByType).indexOf(node.type);
        let sectorAngle = 0;
        
        if (typeCount > 1 && typeIndex >= 0) {
          sectorAngle = (typeIndex / typeCount) * 2 * Math.PI;
          // Offset center for each type to create separate clusters
          const offset = Math.min(dimensions.width, dimensions.height) * 0.25;
          const offsetX = Math.cos(sectorAngle) * offset;
          const offsetY = Math.sin(sectorAngle) * offset;
          
          // Apply graduated centering force
          const dx = (centerX + offsetX) - node.x;
          const dy = (centerY + offsetY) - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Center force increases with distance from center
          const centerFactor = Math.min(1, distance / (Math.min(dimensions.width, dimensions.height) * 0.4));
          fx += dx * centerStrength * alpha * (0.5 + centerFactor);
          fy += dy * centerStrength * alpha * (0.5 + centerFactor);
        } else {
          // Standard centering for graphs with one type
          fx += (centerX - node.x) * centerStrength * alpha;
          fy += (centerY - node.y) * centerStrength * alpha;
        }
        
        // Collision detection to prevent overlap (like d3.forceCollide)
        currentNodesRef.current.forEach(otherNode => {
          if (node.id === otherNode.id) return;
          
          const dx = node.x - otherNode.x;
          const dy = node.y - otherNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Sum of node radii with padding
          const minDistance = getNodeSize(node) + getNodeSize(otherNode) + 5;
          
          // Only apply collision force if nodes are overlapping
          if (distance < minDistance) {
            const force = (minDistance - distance) / distance * alpha * 0.5;
            fx += dx * force;
            fy += dy * force;
          }
        });
        
        // Boundary forces - keep nodes within view
        const boundaryPadding = 30;
        const boundaryStrength = 0.3 * alpha;
        
        // Left boundary
        if (node.x < boundaryPadding) {
          fx += boundaryStrength * (boundaryPadding - node.x);
        }
        // Right boundary
        if (node.x > dimensions.width - boundaryPadding) {
          fx -= boundaryStrength * (node.x - (dimensions.width - boundaryPadding));
        }
        // Top boundary
        if (node.y < boundaryPadding) {
          fy += boundaryStrength * (boundaryPadding - node.y);
        }
        // Bottom boundary
        if (node.y > dimensions.height - boundaryPadding) {
          fy -= boundaryStrength * (node.y - (dimensions.height - boundaryPadding));
        }
        
        // Apply velocity verlet integration (D3 style)
        return {
          ...node,
          // Enforce boundaries
          x: Math.max(10, Math.min(dimensions.width - 10, node.x + fx)),
          y: Math.max(10, Math.min(dimensions.height - 10, node.y + fy))
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
    console.debug(`Node pressed: ${node.id}`);
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
                  strokeWidth={link.weight ? 1 + Math.min(link.weight, 3) : 1.5}
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
