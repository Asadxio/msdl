import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type TabIconName =
  | 'home'
  | 'home-outline'
  | 'book'
  | 'book-outline'
  | 'people'
  | 'people-outline'
  | 'library'
  | 'library-outline'
  | 'information-circle'
  | 'information-circle-outline'
  | 'person'
  | 'person-outline'
  | 'notifications'
  | 'notifications-outline'
  | 'chatbubbles'
  | 'chatbubbles-outline'
  | 'help-circle'
  | 'help-circle-outline'
  | 'calendar'
  | 'calendar-outline'
  | 'stats-chart'
  | 'stats-chart-outline'
  | 'ribbon'
  | 'ribbon-outline';

function TabIcon({ name, color, focused }: { name: TabIconName; color: string; focused: boolean }) {
  return (
    <View style={styles.tabIconContainer}>
      <Ionicons name={name} size={20} color={color} />
      {focused ? <View style={styles.activeIndicator} /> : null}
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadNotifications(0);
      setUnreadChats(0);
      return;
    }

    const notifQ = query(
      collection(db, 'notifications'),
      where('user_id', 'in', [user.uid, 'all']),
      orderBy('created_at', 'desc'),
    );
    const unsubNotif = onSnapshot(notifQ, (snap) => {
      let count = 0;
      snap.forEach((d) => {
        const data = d.data() as any;
        if (!data.read?.[user.uid]) count += 1;
      });
      setUnreadNotifications(count);
    }, () => setUnreadNotifications(0));

    const chatsQ = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const unsubChats = onSnapshot(chatsQ, (snap) => {
      let count = 0;
      snap.forEach((d) => {
        const data = d.data() as any;
        count += Number(data.unread_counts?.[user.uid] || 0);
      });
      setUnreadChats(count);
    }, () => setUnreadChats(0));

    return () => {
      unsubNotif();
      unsubChats();
    };
  }, [user?.uid]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
        lazy: true,
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} /> }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'book' : 'book-outline'} color={color} focused={focused} /> }} />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chat',
          tabBarBadge: unreadChats > 0 ? (unreadChats > 99 ? '99+' : unreadChats) : undefined,
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarBadge: unreadNotifications > 0 ? (unreadNotifications > 99 ? '99+' : unreadNotifications) : undefined,
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'notifications' : 'notifications-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="about" options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} /> }} />
      <Tabs.Screen name="teachers" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="quiz" options={{ href: null }} />
      <Tabs.Screen name="attendance" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
      <Tabs.Screen name="certificate" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    paddingTop: SPACING.xs,
    paddingBottom: Platform.OS === 'ios' ? SPACING.lg : SPACING.sm,
    height: Platform.OS === 'ios' ? 84 : 66,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  activeIndicator: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
});
