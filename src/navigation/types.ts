export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Main: undefined;
  Search: undefined;
  VerseDetail: { verseId: string };
  GraphView: { verseId?: string; verseIds?: string[] };
  Notes: undefined;
  Profile: undefined;
  Settings: undefined;
  LanguageSettings: undefined;
  TagsManagement: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Graph: undefined;
  Notes: undefined;
  Profile: undefined;
}; 