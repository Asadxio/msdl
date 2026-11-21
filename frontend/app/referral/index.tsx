import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '@/constants/theme';

export default function ReferralRedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/more');
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="small" color={COLORS.primary} />
    </View>
  );
}
