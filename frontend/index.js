import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import { ExpoRoot } from 'expo-router';

// Keep the app route context explicit so Android exports do not depend on
// Expo Router's node_modules _ctx files having EXPO_ROUTER_APP_ROOT inlined.
export function App() {
  const ctx = require.context('./app');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ExpoRoot context={ctx} />
    </GestureHandlerRootView>
  );
}

registerRootComponent(App);
