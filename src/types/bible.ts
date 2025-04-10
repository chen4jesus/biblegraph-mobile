export enum ConnectionType {
  DEFAULT = 'DEFAULT',
  CROSS_REFERENCE = 'CROSS_REFERENCE',
  PARALLEL = 'PARALLEL',
  THEMATIC = 'THEMATIC',
  PROPHECY = 'PROPHECY',
  NOTE = 'NOTE',
}

export interface Verse {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerseGroup {
  id: string;
  name: string;
  description?: string;
  verseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  id: string;
  sourceVerseId: string;
  targetVerseId: string;
  type: ConnectionType;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  ownership?: 'PUBLIC' | 'PRIVATE';
  expanded?: boolean;
}

export type NodeType = 'VERSE' | 'GROUP' | 'NOTE' | 'TAG' | 'TOPIC';

export interface GroupConnection {
  id: string;
  name: string;
  connectionIds: string[];
  type: ConnectionType;
  description?: string;
  createdAt: string;
  updatedAt: string;
  
  // Arrays of related node IDs by type
  sourceIds: string[];
  targetIds: string[];
  
  // Source and target node types (allows connecting between different node types)
  sourceType: NodeType;
  targetType: NodeType;
  
  // Optional metadata for rich connections
  metadata?: Record<string, any>;
  userId?: string;
}

export interface Note {
  id: string;
  verseId: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface BibleSettings {
  fontSize: number;
  lineHeight: number;
  autoSave: boolean;
  showVerseNumbers: boolean;
  showCrossReferences: boolean;
  graphLayout: 'force-directed' | 'circular' | 'grid';
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface VerseTag {
  id: string;
  verseId: string;
  tagId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  data: Verse | VerseGroup | GroupConnection | Tag | Note;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: ConnectionType | 'GROUP_MEMBER';
  data: Connection | GroupConnection | { type: 'GROUP_MEMBER' };
} 