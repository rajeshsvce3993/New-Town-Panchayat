import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { api, getApiBaseUrl } from '../src/api/client';
import { useApp } from '../src/context/AppContext';
import { prefs } from '../src/storage/preferences';
import type { NotificationItem } from '../src/types/models';
import { activeNotifications, effectiveFileType, effectiveMediaUrl } from '../src/types/models';
import { resolvedTpId } from '../src/types/models';

export default function NotificationsScreen() {
  const { user, palette, isTamil, pendingMedia, setPendingMedia } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; type: string; name: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const list = await api.getNotifications(user?.id || user?.username, user?.zone, resolvedTpId(user));
    if (list) {
      setItems(list);
      await prefs.setNotifications(list);
    } else {
      setItems(activeNotifications(await prefs.getNotifications()));
    }
    setRead(await prefs.getReadIds());
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (pendingMedia) {
      setViewer(pendingMedia);
      setPendingMedia(null);
    }
  }, []);

  const unread = items.filter((i) => !read.includes(i.id)).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={palette.primary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontWeight: '700', color: palette.primary }}>{isTamil ? 'சுற்றறிக்கைகள் & அறிவிப்புகள்' : 'Announcements & Notifications'}</Text>
          {unread > 0 && <Text style={{ color: '#E11D48', fontSize: 11 }}>{isTamil ? `${unread} படிக்காத அறிவிப்புகள்` : `${unread} unread notices`}</Text>}
        </View>
        <Pressable
          onPress={async () => {
            await prefs.markAllRead(items.map((i) => i.id));
            setRead(await prefs.getReadIds());
          }}
        >
          <Ionicons name="checkmark-done" size={22} color={palette.primary} />
        </Pressable>
        <Pressable onPress={() => void load()} style={{ marginLeft: 8 }}>
          <Ionicons name="refresh" size={22} color={palette.primary} />
        </Pressable>
      </View>
      {loading && <ActivityIndicator style={{ marginTop: 20 }} color={palette.primary} />}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {!items.length && (
          <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 40 }}>
            {isTamil ? 'அறிவிப்புகள் ஏதுமில்லை' : 'No Notifications Yet'}
          </Text>
        )}
        {items.map((n) => {
          const media = effectiveMediaUrl(n);
          const type = effectiveFileType(n);
          const isRead = read.includes(n.id);
          return (
            <Pressable
              key={n.id}
              style={[styles.card, !isRead && { borderColor: palette.primary }]}
              onPress={async () => {
                await prefs.markNotificationRead(n.id);
                setRead(await prefs.getReadIds());
              }}
            >
              <Text style={{ fontWeight: '700' }}>{n.title}</Text>
              <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{n.message}</Text>
              {!!media && (
                <Pressable
                  style={[styles.viewBtn, { backgroundColor: palette.primary }]}
                  onPress={async () => {
                    await prefs.markNotificationRead(n.id);
                    setRead(await prefs.getReadIds());
                    const url = media.startsWith('/') ? `${getApiBaseUrl()}${media}` : media;
                    setViewer({ url, type, name: n.fileName || 'Attachment' });
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>{isTamil ? 'செயலியில் பார்' : 'View in App'}</Text>
                </Pressable>
              )}
              {!!n.actionUrl && (
                <Pressable onPress={() => void Linking.openURL(n.actionUrl!)}>
                  <Text style={{ color: palette.primary, marginTop: 6 }}>{n.actionUrl}</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {viewer && (
        <Modal visible animationType="slide">
          <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
            <View style={[styles.viewerBar, { paddingTop: insets.top + 12 }]}>
              <Pressable onPress={() => setViewer(null)} style={styles.x}>
                <Ionicons name="close" color="#fff" size={20} />
              </Pressable>
              <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }} numberOfLines={1}>{viewer.name}</Text>
            </View>
            {viewer.type === 'image' ? (
              <Image source={{ uri: viewer.url }} style={{ flex: 1 }} resizeMode="contain" />
            ) : (
              <WebView
                source={{
                  uri: viewer.url.startsWith('http')
                    ? `https://docs.google.com/viewer?url=${encodeURIComponent(viewer.url)}&embedded=true`
                    : viewer.url,
                }}
                javaScriptEnabled
                domStorageEnabled
                style={{ flex: 1 }}
              />
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  viewBtn: { marginTop: 8, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  viewerBar: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#1E293B' },
  x: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
});
