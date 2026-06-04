import { Stack } from 'expo-router';

export default function OnboardingFirstTimeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
