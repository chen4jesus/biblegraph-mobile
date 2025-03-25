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

export interface Connection {
  id: string;
  sourceVerseId: string;
  targetVerseId: string;
  type: ConnectionType;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  verseId: string;
  content: string;
  tags: string[];
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
}

export interface GraphNode {
  id: string;
  type: 'VERSE' | 'NOTE' | 'TAG';
  data: Verse | Note | Tag;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: ConnectionType;
  data: Connection;
} 