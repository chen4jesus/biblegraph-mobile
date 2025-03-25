import { useState, useCallback, useEffect } from 'react';
import { Verse, Connection, Note, ConnectionType } from '../types/bible';
import { neo4jService } from '../services/neo4j';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';

interface UseBibleGraphProps {
  initialVerseId?: string;
  onVersePress?: (verse: Verse) => void;
  onConnectionPress?: (connection: Connection) => void;
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
  onVersePress,
  onConnectionPress,
}: UseBibleGraphProps = {}): UseBibleGraphReturn => {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to fetch from online service first
      const [onlineVerses, onlineConnections, onlineNotes] = await Promise.all([
        neo4jService.getVerses(),
        neo4jService.getConnections(),
        neo4jService.getNotes(),
      ]);

      // Get offline data
      const [offlineVerses, offlineConnections, offlineNotes] = await Promise.all([
        storageService.getVerses(),
        storageService.getConnections(),
        storageService.getNotes(),
      ]);

      // Merge online and offline data
      const mergedVerses = mergeVerses(onlineVerses, offlineVerses);
      const mergedConnections = mergeConnections(onlineConnections, offlineConnections);
      
      // Process notes and create note-to-verse connections
      const mergedNotes = mergeNotes(onlineNotes, offlineNotes);
      
      // Create virtual connections for notes
      const noteConnections: Connection[] = mergedNotes.map(note => ({
        id: `note-${note.id}`,
        sourceVerseId: note.verseId,
        targetVerseId: note.verseId, // Self-connection but will be displayed differently
        type: ConnectionType.NOTE,
        description: note.content.length > 30 ? note.content.substring(0, 30) + '...' : note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }));

      // Combine regular connections with note connections
      const allConnections = [...mergedConnections, ...noteConnections];

      setVerses(mergedVerses);
      setConnections(allConnections);

      // If we have an initial verse, select it
      if (initialVerseId) {
        const initialVerse = mergedVerses.find(v => v.id === initialVerseId);
        if (initialVerse) {
          setSelectedVerse(initialVerse);
        }
      }

      // Sync data in the background
      syncService.syncData().catch(console.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
    } finally {
      setLoading(false);
    }
  }, [initialVerseId]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

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
    await fetchGraphData();
  }, [fetchGraphData]);

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