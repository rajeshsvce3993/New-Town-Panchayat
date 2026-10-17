import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { prefs } from '../storage/preferences';
import { activeNotifications } from '../types/models';
import { HeaderBrand } from './HeaderBrand';

export function HeaderBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      const load = async () => {
        const n = activeNotifications(await prefs.getNotifications());
        const read = new Set(await prefs.getReadIds());
        if (live) setUnread(n.filter((x) => !read.has(x.id)).length);
      };
      void load();
      const t = setInterval(() => void load(), 4000);
      return () => {
        live = false;
        clearInterval(t);
      };
    }, [])
  );

  return (
    <Pressable onPress={() => router.push('/notifications')} style={styles.bell}>
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={20} color="#fff" />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function AppHeader() {
  const { palette, isTamil } = useApp();

  return (
    <View style={[styles.bar, { backgroundColor: palette.primary }]}>
      <StatusBar style="light" />
      <HeaderBrand />
      <Text style={styles.title} numberOfLines={2}>
        {isTamil ? 'பேரூராட்சிகள் மேலாண்மை அமைப்பு' : 'Town Panchayats Management System'}
      </Text>
      <HeaderBell />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center', marginHorizontal: 8 },
  bell: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#E11D48', borderRadius: 8, paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
});
