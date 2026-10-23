import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { prefs } from '../storage/preferences';
import { activeNotifications } from '../types/models';
import { HeaderBrand } from './HeaderBrand';

export function HeaderBell({ inline = false }: { inline?: boolean }) {
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
    <Pressable
      onPress={() => router.push('/notifications')}
      style={inline ? styles.iconBtnInline : styles.iconBtn}
      accessibilityLabel="Notifications"
    >
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={20} color="#fff" />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function HeaderActions({ showLogout = false }: { showLogout?: boolean }) {
  const { logout, isTamil, palette } = useApp();
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const confirmLogout = () => {
    setConfirmOpen(false);
    setLoggingOut(true);
    void logout().finally(() => setLoggingOut(false));
  };

  return (
    <>
      <View style={styles.actionCluster}>
        <HeaderBell inline />
        {showLogout && (
          <>
            <View style={styles.actionDivider} />
            <Pressable
              onPress={() => setConfirmOpen(true)}
              disabled={loggingOut}
              style={styles.iconBtnInline}
              accessibilityLabel={isTamil ? 'வெளியேறு' : 'Sign out'}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="log-out-outline" size={20} color="#fff" />
              )}
            </Pressable>
          </>
        )}
      </View>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <Pressable style={styles.modalBack} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={26} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>{isTamil ? 'வெளியேற விரும்புகிறீர்களா?' : 'Sign out?'}</Text>
            <Text style={styles.modalBody}>
              {isTamil
                ? 'உங்கள் கணக்கிலிருந்து வெளியேறுவீர்கள். தொடர்ந்து பயன்படுத்த மீண்டும் உள்நுழைய வேண்டும்.'
                : 'You will leave this account. Sign in again to continue using the app.'}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setConfirmOpen(false)}>
                <Text style={styles.modalCancelText}>{isTamil ? 'திரும்பு' : 'Stay signed in'}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, { backgroundColor: palette.primary }]}
                onPress={() => void confirmLogout()}
              >
                <Text style={styles.modalConfirmText}>{isTamil ? 'வெளியேறு' : 'Sign out'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  actionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 22,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.28)', marginHorizontal: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnInline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#E11D48', borderRadius: 8, paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  modalBack: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  modalBody: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 19 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  modalCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  modalConfirm: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalConfirmText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
