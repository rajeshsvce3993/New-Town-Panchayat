import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { api, resolveMediaUrl } from '../src/api/client';
import { HeaderBrand } from '../src/components/HeaderBrand';
import { useApp } from '../src/context/AppContext';
import { prefs } from '../src/storage/preferences';
import type { NotificationItem } from '../src/types/models';
import { activeNotifications, effectiveFileType, effectiveMediaUrl, resolvedTpId } from '../src/types/models';
import { formatTo12Hr } from '../src/utils/dates';

type FileKind = 'image' | 'pdf' | 'excel' | 'file' | 'none';

function fileMeta(type: string, isTamil: boolean): { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string } {
  switch (type as FileKind) {
    case 'image':
      return { icon: 'image-outline', label: isTamil ? 'புகைப்படம்' : 'Photo', color: '#0369A1', bg: '#E0F2FE' };
    case 'pdf':
      return { icon: 'document-text-outline', label: isTamil ? 'PDF சுற்றறிக்கை' : 'PDF Circular', color: '#B91C1C', bg: '#FEE2E2' };
    case 'excel':
      return { icon: 'grid-outline', label: isTamil ? 'விரிதாள்' : 'Spreadsheet', color: '#15803D', bg: '#DCFCE7' };
    case 'file':
      return { icon: 'attach-outline', label: isTamil ? 'இணைப்பு' : 'Attachment', color: '#6D28D9', bg: '#EDE9FE' };
    default:
      return { icon: 'megaphone-outline', label: isTamil ? 'அறிவிப்பு' : 'Notice', color: '#1D4ED8', bg: '#DBEAFE' };
  }
}

function noticeDate(n: NotificationItem) {
  const raw = n.createdAt || n.expiresAt || '';
  if (!raw) return '';
  const formatted = formatTo12Hr(String(raw));
  return formatted || String(raw);
}

function mediaSrc(raw: string) {
  if (raw.startsWith('http') || raw.startsWith('file:')) return resolveMediaUrl(raw);
  return resolveMediaUrl(raw);
}

export default function NotificationsScreen() {
  const { user, palette, isTamil, pendingMedia, setPendingMedia } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; type: string; name: string } | null>(null);
  const heroEnd = palette.isGradient && palette.gradientColors[1] ? palette.gradientColors[1] : palette.secondary;

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
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

  const visible = useMemo(() => {
    const unreadItems = items.filter((i) => !read.includes(i.id));
    return [...unreadItems].sort((a, b) => {
      const ta = Date.parse(String(a.createdAt || '')) || 0;
      const tb = Date.parse(String(b.createdAt || '')) || 0;
      return tb - ta;
    });
  }, [items, read]);
  const unread = visible.length;

  const markRead = async (id: string) => {
    await prefs.markNotificationRead(id);
    setRead(await prefs.getReadIds());
  };

  const openMedia = async (n: NotificationItem) => {
    const media = effectiveMediaUrl(n);
    if (!media) return;
    await markRead(n.id);
    setViewer({
      url: mediaSrc(media),
      type: effectiveFileType(n),
      name: n.fileName || n.title || (isTamil ? 'இணைப்பு' : 'Attachment'),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F8' }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0B1220', palette.primary, heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.heroTop}>
          <Pressable onPress={() => router.back()} style={styles.heroBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <HeaderBrand />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{isTamil ? 'சுற்றறிக்கைகள்' : 'CIRCULARS'}</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {isTamil ? 'அறிவிப்புகள்' : 'Announcements'}
            </Text>
          </View>
          <Pressable onPress={() => void load()} style={styles.heroBtn} hitSlop={8}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="refresh" size={18} color="#fff" />}
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, marginTop: -14 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(true)} tintColor={palette.primary} />}
      >
        <View style={styles.summary}>
          <View style={[styles.summaryIcon, { backgroundColor: unread ? '#FEF2F2' : '#ECFDF5' }]}>
            <Ionicons name={unread ? 'notifications' : 'checkmark-circle'} size={18} color={unread ? '#E11D48' : '#059669'} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.summaryTitle}>
              {unread
                ? isTamil
                  ? `${unread} படிக்காத அறிவிப்புகள்`
                  : `${unread} unread ${unread === 1 ? 'notice' : 'notices'}`
                : isTamil
                  ? 'அனைத்தும் புதுப்பிக்கப்பட்டது'
                  : 'Inbox is up to date'}
            </Text>
            <Text style={styles.summarySub}>
              {isTamil ? 'சுற்றறிக்கைகள் மற்றும் அலுவலக அறிவிப்புகள்' : 'Official circulars and office notices'}
            </Text>
          </View>
          {unread > 0 && (
            <Pressable
              onPress={async () => {
                await prefs.markAllRead(items.map((i) => i.id));
                setRead(await prefs.getReadIds());
              }}
              style={[styles.markAll, { backgroundColor: palette.primaryContainer }]}
            >
              <Ionicons name="checkmark-done" size={14} color={palette.primary} />
              <Text style={[styles.markAllText, { color: palette.primary }]}>{isTamil ? 'அனைத்தும்' : 'Read all'}</Text>
            </Pressable>
          )}
        </View>

        {!visible.length && !loading && (
          <View style={styles.empty}>
            <View style={styles.emptyRing}>
              <View style={styles.emptyCore}>
                <Ionicons name="mail-open-outline" size={32} color={palette.primary} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>{isTamil ? 'புதிய அறிவிப்புகள் இல்லை' : 'No new announcements'}</Text>
            <Text style={styles.emptySub}>
              {isTamil
                ? 'புதிய சுற்றறிக்கை வரும்போது இங்கு காட்டப்படும். படித்த அறிவிப்புகள் பட்டியலில் இருந்து நீக்கப்படும்.'
                : 'New circulars will appear here. Notices are removed from this list after you read them.'}
            </Text>
          </View>
        )}

        {visible.map((n) => {
          const media = effectiveMediaUrl(n);
          const type = effectiveFileType(n);
          const meta = fileMeta(type, isTamil);
          const when = noticeDate(n);
          const thumb = type === 'image' && media ? mediaSrc(media) : null;
          return (
            <Pressable
              key={n.id}
              style={styles.card}
              android_ripple={{ color: '#E2E8F0' }}
              onPress={() => void markRead(n.id)}
            >
              <View style={[styles.accent, { backgroundColor: palette.primary }]} />
              <View style={styles.cardInner}>
                <View style={styles.cardHead}>
                  <View style={[styles.typeIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {n.title || (isTamil ? 'அறிவிப்பு' : 'Announcement')}
                      </Text>
                      <View style={styles.newDot} />
                    </View>
                    <View style={styles.metaRow}>
                      <View style={[styles.chip, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      {!!when && (
                        <Text style={styles.when} numberOfLines={1}>
                          {when}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {!!n.message && <Text style={styles.body}>{n.message}</Text>}

                {!!thumb && (
                  <Pressable onPress={() => void openMedia(n)} style={styles.thumbWrap}>
                    <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
                    <View style={styles.thumbBadge}>
                      <Ionicons name="expand-outline" size={12} color="#fff" />
                      <Text style={styles.thumbBadgeText}>{isTamil ? 'முழுப் பார்வை' : 'Open'}</Text>
                    </View>
                  </Pressable>
                )}

                {!!media && type !== 'image' && (
                  <Pressable onPress={() => void openMedia(n)} style={[styles.attachBtn, { backgroundColor: palette.primary }]}>
                    <Ionicons name={meta.icon} size={15} color="#fff" />
                    <Text style={styles.attachText}>{isTamil ? 'இணைப்பைப் பார்' : 'View attachment'}</Text>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.85)" />
                  </Pressable>
                )}

                {!!n.actionUrl && (
                  <Pressable onPress={() => void Linking.openURL(n.actionUrl!)} style={styles.linkBtn}>
                    <Ionicons name="open-outline" size={14} color={palette.primary} />
                    <Text style={[styles.linkText, { color: palette.primary }]} numberOfLines={1}>
                      {n.actionUrl}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {viewer && (
        <Modal visible animationType="slide" onRequestClose={() => setViewer(null)}>
          <View style={{ flex: 1, backgroundColor: '#07111F' }}>
            <View style={[styles.viewerBar, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={() => setViewer(null)} style={styles.x}>
                <Ionicons name="close" color="#fff" size={18} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.viewerKicker}>{isTamil ? 'இணைப்பு' : 'ATTACHMENT'}</Text>
                <Text style={styles.viewerName} numberOfLines={1}>
                  {viewer.name}
                </Text>
              </View>
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
  hero: { paddingHorizontal: 16, paddingBottom: 26 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  summary: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EEF4',
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  summaryIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  summarySub: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '500' },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  markAllText: { fontSize: 11, fontWeight: '800' },
  empty: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EEF4',
  },
  emptyRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 19 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EEF4',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardInner: { padding: 14, paddingLeft: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  typeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A', lineHeight: 19 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E11D48', marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  chip: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  when: { flex: 1, fontSize: 11, color: '#64748B', fontWeight: '600' },
  body: { marginTop: 10, fontSize: 13, color: '#334155', lineHeight: 19 },
  thumbWrap: { marginTop: 12, borderRadius: 12, overflow: 'hidden', height: 148, backgroundColor: '#0F172A' },
  thumb: { width: '100%', height: '100%' },
  thumbBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  thumbBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  attachBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  attachText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '800' },
  linkBtn: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { flex: 1, fontSize: 12, fontWeight: '600' },
  viewerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: '#0B1220',
    gap: 10,
  },
  viewerKicker: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  viewerName: { color: '#fff', fontWeight: '800', fontSize: 14, marginTop: 1 },
  x: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
