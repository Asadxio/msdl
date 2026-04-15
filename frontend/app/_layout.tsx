import { Stack } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { DataProvider } from '@/context/DataContext';

export default function RootLayout() {
  return (
    <DataProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="course/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="teacher/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="book/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="admin/add-book" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </DataProvider>
  );
}
