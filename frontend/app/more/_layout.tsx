import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="library/index" options={{ title: 'Library', headerShown: true }} />
      <Stack.Screen name="attendance/index" options={{ title: 'Attendance', headerShown: true }} />
      <Stack.Screen name="quiz/index" options={{ title: 'Quiz', headerShown: true }} />
      <Stack.Screen name="teachers/index" options={{ title: 'Teachers', headerShown: true }} />
      <Stack.Screen name="applications/index" options={{ title: 'Applications', headerShown: true }} />
      <Stack.Screen name="applications/islamic-dashboard" options={{ title: 'Islamic Dashboard', headerShown: true }} />
    </Stack>
  );
}
