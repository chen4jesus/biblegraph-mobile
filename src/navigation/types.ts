export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined;
  Search: undefined;
  VerseDetail: { verseId: string };
  GraphView: { verseId?: string };
  Notes: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Graph: undefined;
  Notes: undefined;
  Profile: undefined;
}; 