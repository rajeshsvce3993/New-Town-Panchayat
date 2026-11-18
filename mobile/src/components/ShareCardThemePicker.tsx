import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SHARE_CARD_GROUPS,
  SHARE_CARD_THEMES,
  shareCardGradient,
  type ShareCardPaint,
} from '../theme/shareCardThemes';

export function ShareCardThemePicker({
  isTamil,
  selectedId,
  onSelect,
}: {
  isTamil: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<(typeof SHARE_CARD_GROUPS)[number]['id']>('all');
  const selected = SHARE_CARD_THEMES.find((item) => item.id === selectedId) || SHARE_CARD_THEMES[0];
  const themes = useMemo(
    () => (group === 'all' ? SHARE_CARD_THEMES : SHARE_CARD_THEMES.filter((item) => item.group === group)),
    [group],
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={isTamil ? 'பகிர்வு தீம் மாற்று' : 'Change share theme'}
      >
        <MiniCard paint={selected} compact />
        <View style={styles.triggerCopy}>
          <Text style={styles.kicker}>{isTamil ? 'பகிர்வு அட்டை தீம்' : 'SHARE CARD THEME'}</Text>
          <Text style={styles.triggerName} numberOfLines={1}>
            {selected.name}
          </Text>
        </View>
        <View style={styles.changeBtn}>
          <Text style={styles.changeTxt}>{isTamil ? 'மாற்று' : 'Change'}</Text>
          <Ionicons name="chevron-forward" size={13} color="#334155" />
        </View>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{isTamil ? 'பகிர்வு தீம் தேர்வு' : 'Choose share theme'}</Text>
                <Text style={styles.sheetSub} numberOfLines={1}>
                  {isTamil ? `தற்போது: ${selected.name}` : `Current: ${selected.name}`}
                </Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={18} color="#334155" />
              </Pressable>
            </View>

            <View style={styles.seg}>
              {SHARE_CARD_GROUPS.map((item) => {
                const active = group === item.id;
                return (
                  <Pressable key={item.id} onPress={() => setGroup(item.id)} style={[styles.segItem, active && styles.segItemOn]}>
                    <Text style={[styles.segTxt, active && styles.segTxtOn]}>{isTamil ? item.labelTa : item.labelEn}</Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
              {themes.map((theme) => {
                const active = theme.id === selectedId;
                return (
                  <Pressable
                    key={theme.id}
                    onPress={() => {
                      onSelect(theme.id);
                      setOpen(false);
                    }}
                    style={[styles.gridItem, active && styles.gridItemOn]}
                  >
                    <MiniCard paint={theme} />
                    {active ? (
                      <View style={[styles.check, { backgroundColor: theme.accent }]}>
                        <Ionicons name="checkmark" size={11} color="#1A1A1A" />
                      </View>
                    ) : null}
                    <Text style={[styles.gridName, active && styles.gridNameOn]} numberOfLines={1}>
                      {theme.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MiniCard({ paint, compact }: { paint: ShareCardPaint; compact?: boolean }) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <LinearGradient colors={shareCardGradient(paint.header)} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.cardHeader} />
      <View style={[styles.cardAccent, { backgroundColor: paint.accent }]} />
      <View style={[styles.cardPhotos, { backgroundColor: paint.photoGap }]} />
      <View style={[styles.cardAccent, { backgroundColor: paint.accent, height: compact ? 1.5 : 2 }]} />
      <LinearGradient colors={shareCardGradient(paint.footer)} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.cardFooter} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
  },
  pressed: { opacity: 0.88 },
  triggerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#64748B',
  },
  triggerName: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D6DEE8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  changeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  card: {
    width: 64,
    height: 86,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.12)',
    backgroundColor: '#fff',
  },
  cardCompact: {
    width: 30,
    height: 42,
    borderRadius: 5,
  },
  cardHeader: { flex: 1.15 },
  cardAccent: { height: 3, width: '100%' },
  cardPhotos: { flex: 1.55 },
  cardFooter: { flex: 0.85 },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 10,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seg: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segItemOn: {
    backgroundColor: '#fff',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  segTxtOn: {
    color: '#0F172A',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  gridItemOn: {
    backgroundColor: '#F8FAFC',
  },
  check: {
    position: 'absolute',
    top: 12,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  gridName: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    width: '100%',
  },
  gridNameOn: {
    color: '#0F172A',
  },
});
