import VerseDetailScreen from './screens/VerseDetailScreen';
import GraphViewScreen from './screens/GraphViewScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';

<Stack.Navigator 
  initialRouteName={initialScreen}
  screenOptions={{ 
    headerShown: false 
  }}
>
  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="Home" component={HomeScreen} />
  <Stack.Screen name="VerseDetail" component={VerseDetailScreen} />
  <Stack.Screen name="GraphView" component={GraphViewScreen} />
  <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
  <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
  <Stack.Screen name="TagsManagement" component={TagsManagementScreen} />
</Stack.Navigator> 