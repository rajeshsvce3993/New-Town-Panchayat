import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAndroidExitOnDashboard, useApp } from '../../src/context/AppContext';

export default function TabsLayout() {
  const { user, isTamil, palette, pendingOpen, setPendingOpen } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, 10);
  useAndroidExitOnDashboard(true);

  useEffect(() => {
    if (pendingOpen === 'NOTIFICATIONS') {
      setPendingOpen(null);
      router.push('/notifications');
    } else if (pendingOpen === 'REPORTS') {
      setPendingOpen(null);
      router.push('/(tabs)/reports');
    }
  }, [pendingOpen, router, setPendingOpen]);

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1220' }}>
    <StatusBar style="light" />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#fff',
          elevation: 16,
          height: 58 + tabBarBottom,
          paddingTop: 8,
          paddingBottom: tabBarBottom,
          borderTopWidth: 0,
          shadowColor: '#0F172A',
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isTamil ? 'முகப்பு' : 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-work"
        options={{
          title: isTamil ? 'புதிய பணி' : 'Add Work',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: isTamil ? 'அறிக்கை' : 'Reports',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: isTamil ? 'அமைப்பு' : 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
    </View>
  );
}
