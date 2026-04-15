import { Stack } from 'expo-router';
import { COLORS } from '@/constants/theme';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="course/[id]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="teacher/[id]"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  );
}
