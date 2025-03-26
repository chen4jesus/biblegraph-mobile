import { useState, useCallback, useEffect, useRef } from 'react';
import { Verse, Connection, Note, ConnectionType } from '../types/bible';
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
  verses: Verse[];
  connections: Connection[];
  loading: boolean;
  error: string | null;
  selectedVerse: Verse | null;
  selectedConnection: Connection | null;
  handleVersePress: (verse: Verse) => void;
  handleConnectionPress: (connection: Connection) => void;
  refreshGraph: () => Promise<void>;
}

export const useBibleGraph = ({
  initialVerseId,
  initialVerseIds = [],
  onVersePress,
  onConnectionPress,
  onConnectionError,
  timeoutMs = 10000, // Default timeout of 10 seconds
}: UseBibleGraphProps = {}): UseBibleGraphReturn => {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  
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
  }, []);

  const fetchGraphData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('Data fetch already in progress, skipping');
      return;
    }
    
    // If component is unmounted, don't proceed
    if (!isMountedRef.current) {
      console.log('Component unmounted, skipping fetch');
      return;
    }
    
    // If no verses are selected, just display an empty graph
    if (!initialVerseId && (!initialVerseIds || initialVerseIds.length === 0)) {
      console.log('No verses selected, skipping data fetch');
      if (isMountedRef.current) {
        setLoading(false);
        setVerses([]);
        setConnections([]);
      }
      return;
    }
    
    // Reset any previous aborts and create new abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    // Set fetching flag
    isFetchingRef.current = true;
    
    // Set a timeout to automatically reset the fetching flag
    fetchTimeoutRef.current = setTimeout(() => {
      console.warn(`Fetch operation timed out after ${timeoutMs}ms, resetting fetch state`);
      if (isMountedRef.current) {
        resetFetchingState();
        setLoading(false);
        setError('Operation timed out. Please try again.');
      }
    }, timeoutMs);
    
    try {
      // Check if operation was aborted before starting
      if (signal.aborted) {
        throw new Error('Operation was aborted');
      }
      
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      // Try to fetch from online service first
      const [onlineVerses, onlineNotes] = await Promise.all([
        neo4jService.getVerses(signal),
        neo4jService.getNotes(signal),
      ]);

      // Check if operation was aborted during fetch or component unmounted
      if (signal.aborted || !isMountedRef.current) {
        throw new Error('Operation was aborted');
      }

      // Get offline data
      const [offlineVerses, offlineConnections, offlineNotes] = await Promise.all([
        storageService.getVerses(),
        storageService.getConnections(),
        storageService.getNotes(),
      ]);
      
      // Check if operation was aborted or component unmounted
      if (signal.aborted || !isMountedRef.current) {
        throw new Error('Operation was aborted');
      }

      // Merge online and offline verses
      const mergedVerses = mergeVerses(onlineVerses, offlineVerses);
      
      // Only use online notes - they're the source of truth for what's been deleted
      const mergedNotes = onlineNotes;

      // Collect all verse IDs to fetch connections for
      const verseIds = new Set<string>();
      
      // If we have initialVerseIds, prioritize those
      if (initialVerseIds && initialVerseIds.length > 0) {
        initialVerseIds.forEach(id => verseIds.add(id));
      } 
      // If we have an initialVerseId, add that too
      else if (initialVerseId) {
        verseIds.add(initialVerseId);
      } 
      // We've already checked earlier that we have initial verses, so no need for a fallback here
      
      // Convert to array and limit to prevent too many requests
      const verseIdsArray = Array.from(verseIds).slice(0, 10);

      // Get connections for verses with error handling
      let allOnlineConnections: Connection[] = [];
      let hasConnectionErrors = false;
      
      try {
        // Use Promise.all with a timeout - this is crucial to prevent hanging
        const connectionPromises = verseIdsArray.map(id => 
          Promise.race([
            neo4jService.getConnectionsForVerse(id, signal).catch(err => {
              console.warn(`Error fetching connections for verse ${id}:`, err);
              hasConnectionErrors = true;
              return [] as Connection[];
            }),
            // Add individual timeouts for each connection fetch
            new Promise<Connection[]>((_, reject) => 
              setTimeout(() => reject(new Error(`Connection fetch for verse ${id} timed out`)), 
              timeoutMs / 2)) // Use half the main timeout for individual connection fetches
          ])
        );
        
        try {
          const onlineConnectionsResults = await Promise.all(connectionPromises);
          allOnlineConnections = onlineConnectionsResults.flat();
        } catch (timeoutErr) {
          console.warn('Some connection fetches timed out:', timeoutErr);
          hasConnectionErrors = true;
        }
        
        // Notify if there were any connection errors
        if (hasConnectionErrors && onConnectionError && isMountedRef.current) {
          onConnectionError();
        }
      } catch (err) {
        console.error('Error fetching connections:', err);
        if (onConnectionError && isMountedRef.current) {
          onConnectionError();
        }
        // Don't throw here, we'll continue with whatever data we have
      }
      
      // Check if operation was aborted or component unmounted
      if (signal.aborted || !isMountedRef.current) {
        throw new Error('Operation was aborted');
      }
      
      // Flatten and deduplicate connections
      const uniqueConnectionsMap = new Map<string, Connection>();
      
      // Process online connections
      allOnlineConnections.forEach(connection => {
        const uniqueKey = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
        if (!uniqueConnectionsMap.has(uniqueKey) || 
            new Date(connection.updatedAt) > new Date(uniqueConnectionsMap.get(uniqueKey)!.updatedAt)) {
          uniqueConnectionsMap.set(uniqueKey, connection);
        }
      });
      
      // Process offline connections
      offlineConnections.forEach(connection => {
        const uniqueKey = `${connection.sourceVerseId}-${connection.targetVerseId}-${connection.type}`;
        if (!uniqueConnectionsMap.has(uniqueKey) || 
            new Date(connection.updatedAt) > new Date(uniqueConnectionsMap.get(uniqueKey)!.updatedAt)) {
          uniqueConnectionsMap.set(uniqueKey, connection);
        }
      });

      // Convert map to array
      const allConnections = Array.from(uniqueConnectionsMap.values());
      
      // Get unique set of verse IDs from connections
      const connectedVerseIds = new Set<string>();
      allConnections.forEach(conn => {
        connectedVerseIds.add(conn.sourceVerseId);
        connectedVerseIds.add(conn.targetVerseId);
      });
      
      // Add initial verse IDs
      if (initialVerseId) connectedVerseIds.add(initialVerseId);
      if (initialVerseIds) initialVerseIds.forEach(id => connectedVerseIds.add(id));
      
      // Filter verses to only include those in connections or initially selected
      let filteredVerses = mergedVerses.filter(verse => connectedVerseIds.has(verse.id));
      
      // If no verses with connections, use initial verses at minimum
      if (filteredVerses.length === 0 && initialVerseIds && initialVerseIds.length > 0) {
        filteredVerses = mergedVerses.filter(v => initialVerseIds.includes(v.id));
      } else if (filteredVerses.length === 0 && initialVerseId) {
        const initialVerse = mergedVerses.find(v => v.id === initialVerseId);
        if (initialVerse) {
          filteredVerses = [initialVerse];
        }
      }
      
      // No need to show fallback verses if no search criteria was provided
      // If we have explicit search criteria but still no verses, show a message through an empty list

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setVerses(filteredVerses);
        setConnections(allConnections);

        // Select initial verse if provided
        if (initialVerseId) {
          const initialVerse = filteredVerses.find(v => v.id === initialVerseId);
          if (initialVerse) {
            setSelectedVerse(initialVerse);
          }
        } else if (initialVerseIds && initialVerseIds.length > 0 && filteredVerses.length > 0) {
          // If multiple verses, select the first one that exists
          for (const id of initialVerseIds) {
            const verse = filteredVerses.find(v => v.id === id);
            if (verse) {
              setSelectedVerse(verse);
              break;
            }
          }
        }
      }

      // Update local storage with latest notes to prevent future sync issues
      if (isMountedRef.current) {
        await storageService.saveNotes(onlineNotes);
      }

      // Skip background sync to prevent potential infinite loops
      // syncService.syncData().catch(console.error);
    } catch (err) {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
      }
    } finally {
      // Clear timeout and reset fetching state only if still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
      // Always reset the fetching state
      resetFetchingState();
    }
  }, [initialVerseId, initialVerseIds, onConnectionError, resetFetchingState, timeoutMs]);

  useEffect(() => {
    // Set mounted flag to true when component mounts
    isMountedRef.current = true;
    
    // Initial load
    fetchGraphData();
    
    // Clean-up function to prevent memory leaks and abort ongoing requests
    return () => {
      isMountedRef.current = false;
      resetFetchingState();
    };
  }, [fetchGraphData, resetFetchingState]);

  // Add an effect that responds to changes in initialVerseId or initialVerseIds
  useEffect(() => {
    console.log('useBibleGraph - initialVerseIds changed:', initialVerseIds);
    // Only trigger if we have initialVerseId or initialVerseIds
    if ((initialVerseId || (initialVerseIds && initialVerseIds.length > 0)) && isMountedRef.current) {
      // Use JSON.stringify to compare arrays properly
      const currentVerseIdsKey = JSON.stringify(initialVerseIds.sort());
      
      // Store this in a ref to avoid additional renders
      if (!isFetchingRef.current && currentVerseIdsKey !== lastProcessedVerseIdsRef.current) {
        lastProcessedVerseIdsRef.current = currentVerseIdsKey;
        resetFetchingState(); // Reset any ongoing operations
        fetchGraphData();    // Fetch with new verse IDs
      }
    }
  }, [initialVerseId, initialVerseIds, fetchGraphData, resetFetchingState]);

  const handleVersePress = useCallback(
    (verse: Verse) => {
      setSelectedVerse(verse);
      onVersePress?.(verse);
    },
    [onVersePress]
  );

  const handleConnectionPress = useCallback(
    (connection: Connection) => {
      setSelectedConnection(connection);
      onConnectionPress?.(connection);
    },
    [onConnectionPress]
  );

  const refreshGraph = useCallback(async () => {
    // Forcibly reset fetching state before refreshing
    resetFetchingState();
    //await fetchGraphData();
    await fetchGraphData();
  }, [fetchGraphData, resetFetchingState]);

  return {
    verses,
    connections,
    loading,
    error,
    selectedVerse,
    selectedConnection,
    handleVersePress,
    handleConnectionPress,
    refreshGraph,
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