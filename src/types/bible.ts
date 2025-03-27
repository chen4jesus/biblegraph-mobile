export enum ConnectionType {
  CROSS_REFERENCE = 'CROSS_REFERENCE',
  THEME = 'THEME',
  PARALLEL = 'PARALLEL',
  NOTE = 'NOTE',
  THEMATIC = 'THEMATIC',
  PROPHECY = 'PROPHECY',
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
  groupConnectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupConnection {
  id: string;
  name?: string;
  connectionIds: string[];
  type: ConnectionType;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sourceType?: NodeType;
  targetType?: NodeType;
}

export interface Note {
  id: string;
  verseId: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
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
}

export interface VerseTag {
  id: string;
  verseId: string;
  tagId: string;
  createdAt: string;
  updatedAt: string;
}

export type NodeType = 'VERSE' | 'GROUP' | 'NOTE' | 'TAG';

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