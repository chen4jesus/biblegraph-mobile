import { Verse } from '../types/bible';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Main: undefined;
  MainTabs: undefined;
  Search: undefined;
  VerseDetail: { verseId: string, activeTab?: 'notes' | 'connections' };
  GraphView: { verseId?: string; verseIds?: string[] };
  Notes: undefined;
  Profile: undefined;
  Settings: undefined;
  LanguageSettings: undefined;
  TagsManagement: {
    onReturn?: () => void;
    noteId?: string;
    noteContent?: string;
    noteTags?: string[];
    slideAnimation?: boolean;
  };
  ConnectionDetail: { connectionId: string };
  BibleSelector: {
    onVersesSelected?: (verses: Verse[]) => void;
    onViewGraph?: (verseIds: string[]) => void;
    multiSelect?: boolean;
  };
  GroupDetail: { groupId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Graph: undefined;
  Notes: undefined;
  Profile: undefined;
}; 