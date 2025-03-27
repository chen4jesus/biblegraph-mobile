import { useState, useCallback, useEffect, useRef } from 'react';
import { Verse, Connection, Note, ConnectionType, GraphNode, GraphEdge, VerseGroup, GroupConnection } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';

interface UseBibleGraphProps {
  initialVerseId?: string;
  initialVerseIds?: string[];
  onVersePress?: (verse: Verse) => void;
  onConnectionPress?: (connection: Connection) => void;
  onConnectionError?: () => void;
  timeoutMs?: number; // New param to customize timeout
}

interface UseBibleGraphReturn {
  nodes: GraphNode[];
  edges: GraphEdge[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  expandNode: (nodeId: string) => Promise<void>;
  currentVerseId: string | null;
  setCurrentVerseId: (verseId: string | null) => void;
  zoomToNode: (nodeId: string | null) => Promise<void>;
  handleVersePress: (verse: Verse) => void;
  handleConnectionPress: (connection: Connection) => void;
}

export const useBibleGraph = ({
  initialVerseId,
  initialVerseIds = [],
  onVersePress,
  onConnectionPress,
  onConnectionError,
  timeoutMs = 10000, // Default timeout of 10 seconds
}: UseBibleGraphProps = {}): UseBibleGraphReturn => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentVerseId, setCurrentVerseId] = useState<string | null>(initialVerseId || null);
  
  // Use a ref to prevent multiple fetch operations running concurrently
  const isFetchingRef = useRef(false);
  // Add a timeout ref to reset fetching state in case of hung operations
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Add an abort controller ref for cancelling fetch operations
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track component mount state
  const isMountedRef = useRef(true);
  // Add a ref to track the last processed verse IDs
  const lastProcessedVerseIdsRef = useRef<string | null>(null);
  // Add a ref to track processed nodes
  const processedNodes = useRef<Set<string>>(new Set());

  const resetFetchingState = useCallback(() => {
    isFetchingRef.current = false;
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setNodes([]);
    setEdges([]);
    setError(null);
    processedNodes.current.clear();
  }, []);

  const fetchGraphData = useCallback(async () => {
    if ((!initialVerseId && (!initialVerseIds || initialVerseIds.length === 0)) || isFetchingRef.current) {
      return;
    }

    console.debug("Starting fetchGraphData with initialVerseIds:", initialVerseIds);
    isFetchingRef.current = true;
    setIsFetching(true);
    
    // Set up abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    // Set up timeout to prevent hung operations
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
      console.warn(`fetchGraphData timed out after ${timeoutMs}ms`);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isFetchingRef.current = false;
      setIsFetching(false);
      setIsLoading(false);
      if (isMountedRef.current) {
        setError(new Error("Loading timed out. Please try again."));
      }
    }, timeoutMs);
    
    try {
      // Create node and edge collections
      const nodeMap = new Map<string, GraphNode>();
      const edgeMap = new Map<string, GraphEdge>();
      
      const startingIds = initialVerseId ? [initialVerseId] : initialVerseIds;
      console.debug(`Processing ${startingIds.length} initial verse IDs`);
      
      // Fetch verses
      for (const id of startingIds) {
        if (signal.aborted) break;
        if (processedNodes.current.has(id)) continue;
        
        try {
          const verse = await neo4jService.getVerse(id, signal);
          if (verse) {
            const node: GraphNode = {
              id: verse.id,
              type: 'VERSE',
              label: `${verse.book} ${verse.chapter}:${verse.verse}`,
              data: verse
            };
            nodeMap.set(verse.id, node);
            processedNodes.current.add(verse.id);
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            console.debug('Verse fetch aborted');
            break;
          }
          console.error(`Error fetching verse ${id}:`, err);
        }
      }
      
      // Fetch connections
      for (const id of startingIds) {
        if (signal.aborted) break;
        
        try {
          const connections = await neo4jService.getConnectionsForVerse(id, signal);
          
          for (const connection of connections) {
            if (signal.aborted) break;
            
            // Add source verse to nodes if not already present
            if (!nodeMap.has(connection.sourceVerseId) && !processedNodes.current.has(connection.sourceVerseId)) {
              try {
                const sourceVerse = await neo4jService.getVerse(connection.sourceVerseId, signal);
                if (sourceVerse) {
                  const node: GraphNode = {
                    id: sourceVerse.id,
                    type: 'VERSE',
                    label: `${sourceVerse.book} ${sourceVerse.chapter}:${sourceVerse.verse}`,
                    data: sourceVerse
                  };
                  nodeMap.set(sourceVerse.id, node);
                  processedNodes.current.add(sourceVerse.id);
                }
              } catch (err) {
                if (err.name === 'AbortError') break;
                console.error(`Error fetching source verse ${connection.sourceVerseId}:`, err);
              }
            }
            
            // Add target verse to nodes if not already present
            if (!nodeMap.has(connection.targetVerseId) && !processedNodes.current.has(connection.targetVerseId)) {
              try {
                const targetVerse = await neo4jService.getVerse(connection.targetVerseId, signal);
                if (targetVerse) {
                  const node: GraphNode = {
                    id: targetVerse.id,
                    type: 'VERSE',
                    label: `${targetVerse.book} ${targetVerse.chapter}:${targetVerse.verse}`,
                    data: targetVerse
                  };
                  nodeMap.set(targetVerse.id, node);
                  processedNodes.current.add(targetVerse.id);
                }
              } catch (err) {
                if (err.name === 'AbortError') break;
                console.error(`Error fetching target verse ${connection.targetVerseId}:`, err);
              }
            }
            
            // Add edge for the connection
            const edgeId = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
            if (!edgeMap.has(edgeId)) {
              const edge: GraphEdge = {
                id: edgeId,
                source: connection.sourceVerseId,
                target: connection.targetVerseId,
                type: connection.type,
                data: connection
              };
              edgeMap.set(edgeId, edge);
            }
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            console.debug('Connections fetch aborted');
            break;
          }
          console.error(`Error fetching connections for verse ${id}:`, err);
        }
      }
      
      console.debug(`Graph data loaded: ${nodeMap.size} nodes, ${edgeMap.size} edges`);
      
      // Update state with all nodes and edges at once
      if (isMountedRef.current && !signal.aborted) {
        setNodes(Array.from(nodeMap.values()));
        setEdges(Array.from(edgeMap.values()));
      }
      
      if (!currentVerseId && startingIds.length > 0) {
        setCurrentVerseId(startingIds[0]);
      }
    } catch (err) {
      console.error("Error fetching graph data:", err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      clearTimeout(fetchTimeoutRef.current!);
      fetchTimeoutRef.current = null;
      
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
      isFetchingRef.current = false;
      console.debug("Finished fetchGraphData");
    }
  }, [initialVerseId, initialVerseIds, currentVerseId, timeoutMs]);

  // Initial data fetch
  useEffect(() => {
    isMountedRef.current = true;
    
    if ((initialVerseId || (initialVerseIds && initialVerseIds.length > 0)) && isMountedRef.current) {
      const currentVerseIdsKey = JSON.stringify(initialVerseIds.sort());
      if (!isFetchingRef.current && currentVerseIdsKey !== lastProcessedVerseIdsRef.current) {
        lastProcessedVerseIdsRef.current = currentVerseIdsKey;
        resetFetchingState();
        fetchGraphData();
      }
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [initialVerseId, initialVerseIds, fetchGraphData, resetFetchingState]);

  // Expand a node (verse or group) to fetch its connections
  const expandNode = useCallback(async (nodeId: string) => {
    if (isFetchingRef.current) return;
    
    setIsFetching(true);
    isFetchingRef.current = true;
    
    try {
      const node = nodes.find(n => n.id === nodeId);
      
      if (!node) {
        throw new Error(`Node with ID ${nodeId} not found`);
      }
      
      if (node.type === 'VERSE') {
        // Handle verse node expansion
        const connections = await neo4jService.getConnectionsForVerse(nodeId);
        
        for (const connection of connections) {
          // Add target verse to nodes if not already present
          const targetId = connection.targetVerseId === nodeId 
            ? connection.sourceVerseId
            : connection.targetVerseId;
          
          if (!processedNodes.current.has(targetId)) {
            const targetVerse = await neo4jService.getVerse(targetId);
            if (targetVerse) {
              setNodes(prevNodes => {
                if (prevNodes.some(node => node.id === targetVerse.id)) {
                  return prevNodes;
                }
                return [...prevNodes, {
                  id: targetVerse.id,
                  type: 'VERSE',
                  label: `${targetVerse.book} ${targetVerse.chapter}:${targetVerse.verse}`,
                  data: targetVerse
                }];
              });
              processedNodes.current.add(targetVerse.id);
            }
          }
          
          // Add edge for the connection
          const edgeId = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
          setEdges(prevEdges => {
            if (prevEdges.some(edge => edge.id === edgeId)) {
              return prevEdges;
            }
            return [...prevEdges, {
              id: edgeId,
              source: connection.sourceVerseId,
              target: connection.targetVerseId,
              type: connection.type,
              data: connection
            }];
          });
        }
        
        // Fetch group connections for this verse
        const groupConnections = await neo4jService.getGroupConnectionsByVerseId(nodeId);
        
        for (const groupConnection of groupConnections) {
          // Add group node if not present
          const groupId = groupConnection.id;
          if (!processedNodes.current.has(groupId)) {
            setNodes(prevNodes => {
              if (prevNodes.some(node => node.id === groupId)) {
                return prevNodes;
              }
              return [...prevNodes, {
                id: groupId,
                type: 'GROUP',
                label: groupConnection.type,
                data: groupConnection
              }];
            });
            processedNodes.current.add(groupId);
            
            // Process all verses in the group connection
            const allVerseIds = [...new Set([...groupConnection.sourceIds, ...groupConnection.targetIds])];
            
            for (const verseId of allVerseIds) {
              if (verseId !== nodeId && !processedNodes.current.has(verseId)) {
                const verse = await neo4jService.getVerse(verseId);
                if (verse) {
                  setNodes(prevNodes => {
                    if (prevNodes.some(node => node.id === verse.id)) {
                      return prevNodes;
                    }
                    return [...prevNodes, {
                      id: verse.id,
                      type: 'VERSE',
                      label: `${verse.book} ${verse.chapter}:${verse.verse}`,
                      data: verse
                    }];
                  });
                  processedNodes.current.add(verse.id);
                }
              }
              
              // Add edges between verses and group
              const isSource = groupConnection.sourceIds.includes(verseId);
              
              if (isSource) {
                const edgeId = `${verseId}-${groupId}-SOURCE`;
                setEdges(prevEdges => {
                  if (prevEdges.some(edge => edge.id === edgeId)) {
                    return prevEdges;
                  }
                  return [...prevEdges, {
                    id: edgeId,
                    source: verseId,
                    target: groupId,
                    type: 'GROUP_MEMBER',
                    data: { type: 'GROUP_MEMBER' }
                  }];
                });
              } else {
                const edgeId = `${groupId}-${verseId}-TARGET`;
                setEdges(prevEdges => {
                  if (prevEdges.some(edge => edge.id === edgeId)) {
                    return prevEdges;
                  }
                  return [...prevEdges, {
                    id: edgeId,
                    source: groupId,
                    target: verseId,
                    type: 'GROUP_MEMBER',
                    data: { type: 'GROUP_MEMBER' }
                  }];
                });
              }
            }
          }
        }
      } else if (node.type === 'GROUP') {
        // Handle group node expansion
        const groupConnection = node.data as GroupConnection;
        
        // Process all verses in the group
        const allVerseIds = [...new Set([...groupConnection.sourceIds, ...groupConnection.targetIds])];
        
        for (const verseId of allVerseIds) {
          if (!processedNodes.current.has(verseId)) {
            const verse = await neo4jService.getVerse(verseId);
            if (verse) {
              setNodes(prevNodes => {
                if (prevNodes.some(node => node.id === verse.id)) {
                  return prevNodes;
                }
                return [...prevNodes, {
                  id: verse.id,
                  type: 'VERSE',
                  label: `${verse.book} ${verse.chapter}:${verse.verse}`,
                  data: verse
                }];
              });
              processedNodes.current.add(verse.id);
            }
          }
          
          // Add edges between verses and group
          const isSource = groupConnection.sourceIds.includes(verseId);
          
          if (isSource) {
            const edgeId = `${verseId}-${node.id}-SOURCE`;
            setEdges(prevEdges => {
              if (prevEdges.some(edge => edge.id === edgeId)) {
                return prevEdges;
              }
              return [...prevEdges, {
                id: edgeId,
                source: verseId,
                target: node.id,
                type: 'GROUP_MEMBER',
                data: { type: 'GROUP_MEMBER' }
              }];
            });
          } else {
            const edgeId = `${node.id}-${verseId}-TARGET`;
            setEdges(prevEdges => {
              if (prevEdges.some(edge => edge.id === edgeId)) {
                return prevEdges;
              }
              return [...prevEdges, {
                id: edgeId,
                source: node.id,
                target: verseId,
                type: 'GROUP_MEMBER',
                data: { type: 'GROUP_MEMBER' }
              }];
            });
          }
        }
      }
      
      setCurrentVerseId(nodeId);
    } catch (err) {
      console.error("Error expanding node:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsFetching(false);
      isFetchingRef.current = false;
    }
  }, [nodes]);

  // Zoom to a specific node (implemented by UI components)
  const zoomToNode = useCallback(async (nodeId: string | null) => {
    if (nodeId) {
      setCurrentVerseId(nodeId);
      // If the node hasn't been loaded yet, expand it
      if (!processedNodes.current.has(nodeId)) {
        await expandNode(nodeId);
      }
    }
  }, [expandNode]);

  const handleVersePress = useCallback(
    (verse: Verse) => {
      setCurrentVerseId(verse.id);
      onVersePress?.(verse);
    },
    [onVersePress]
  );

  const handleConnectionPress = useCallback(
    (connection: Connection) => {
      // Don't proceed if connection is not valid (missing properties)
      if (!connection || !connection.id || !connection.sourceVerseId || !connection.targetVerseId) {
        console.warn('Invalid connection object received in handleConnectionPress:', connection);
        return;
      }

      setCurrentVerseId(connection.sourceVerseId);
      onConnectionPress?.(connection);
    },
    [onConnectionPress]
  );

  return {
    nodes,
    edges,
    isLoading,
    isFetching,
    error,
    expandNode,
    currentVerseId,
    setCurrentVerseId,
    zoomToNode,
    handleVersePress,
    handleConnectionPress,
  };
};

// Helper functions for merging data
function mergeVerses(online: Verse[], offline: Verse[]): Verse[] {
  const verseMap = new Map<string, Verse>();
  
  // Add offline verses first (they might be newer)
  offline.forEach(verse => {
    verseMap.set(verse.id, verse);
  });

  // Update with online verses if they're newer
  online.forEach(verse => {
    const existing = verseMap.get(verse.id);
    if (!existing || new Date(verse.updatedAt) > new Date(existing.updatedAt)) {
      verseMap.set(verse.id, verse);
    }
  });

  return Array.from(verseMap.values());
}

function mergeConnections(online: Connection[], offline: Connection[]): Connection[] {
  const connectionMap = new Map<string, Connection>();
  
  // Add offline connections first (they might be newer)
  offline.forEach(connection => {
    connectionMap.set(connection.id, connection);
  });

  // Update with online connections if they're newer
  online.forEach(connection => {
    const existing = connectionMap.get(connection.id);
    if (!existing || new Date(connection.updatedAt) > new Date(existing.updatedAt)) {
      connectionMap.set(connection.id, connection);
    }
  });

  return Array.from(connectionMap.values());
}

function mergeNotes(online: Note[], offline: Note[]): Note[] {
  const noteMap = new Map<string, Note>();
  
  // Add offline notes first (they might be newer)
  offline.forEach(note => {
    noteMap.set(note.id, note);
  });

  // Update with online notes if they're newer
  online.forEach(note => {
    const existing = noteMap.get(note.id);
    if (!existing || new Date(note.updatedAt) > new Date(existing.updatedAt)) {
      noteMap.set(note.id, note);
    }
  });

  return Array.from(noteMap.values());
} 