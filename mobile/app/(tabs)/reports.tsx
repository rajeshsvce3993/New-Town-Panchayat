import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderBell } from '../../src/components/AppHeader';
import { HeaderBrand } from '../../src/components/HeaderBrand';
import { WorkDetailModal } from '../../src/components/WorkDetailModal';
import { useApp } from '../../src/context/AppContext';
import { prefs } from '../../src/storage/preferences';
import { QUEUE_STATUS, type InspectionWork, type PortalState, type QueuedWorkEntry } from '../../src/types/models';
import { todayDdMmYyyy } from '../../src/utils/dates';
import { normalizeWard, resolveUserTpId } from '../../src/utils/wards';
import { filterByDateRange, filterUserWorks, sortRecentFirst } from '../../src/utils/workFilters';

function shortWorkId(workId?: string | null) {
  const raw = String(workId || '').trim();
  const match = raw.match(/^(WRK-)([^-]+)(-.*)$/i);
  if (!match) return raw;
  return `${match[1]}${match[2].slice(0, 4)}${match[3]}`;
}

function localizedStreet(portal: PortalState, street: string, ward: string, isTamil: boolean) {
  const match =
    portal.wardsAndStreets?.find(
      (w) =>
        w.wardNo === ward &&
        (w.streetNameEn.trim().toLowerCase() === street.trim().toLowerCase() ||
          w.streetNameTa?.trim().toLowerCase() === street.trim().toLowerCase())
    ) ||
    portal.wardsAndStreets?.find(
      (w) =>
        w.streetNameEn.trim().toLowerCase() === street.trim().toLowerCase() ||
        w.streetNameTa?.trim().toLowerCase() === street.trim().toLowerCase()
    );
  if (match) return isTamil ? match.streetNameTa || match.streetNameEn : match.streetNameEn;
  const s = street.trim().toLowerCase();
  if (s === 'anna street' || s === 'அண்ணா தெரு') return isTamil ? 'அண்ணா தெரு' : 'Anna Street';
  return street;
}

function queueBadge(status: string, isTamil: boolean) {
  switch (status) {
    case QUEUE_STATUS.IMAGE_COMPRESSING:
      return { bg: '#DBEAFE', fg: '#1E40AF', iconBg: '#EFF6FF', iconFg: '#2563EB', label: isTamil ? 'படம் சுருக்கம்...' : 'Compressing...' };
    case QUEUE_STATUS.IN_QUEUE:
      return { bg: '#FEF3C7', fg: '#92400E', iconBg: '#FEF3C7', iconFg: '#D97706', label: isTamil ? 'வரிசையில்...' : 'In Queue' };
    case QUEUE_STATUS.PROCESSING:
      return { bg: '#F3E8FF', fg: '#6B21A8', iconBg: '#F3E8FF', iconFg: '#7C3AED', label: isTamil ? 'பதிவேற்றம்...' : 'Uploading...' };
    case QUEUE_STATUS.SUBMITTED:
      return { bg: '#DCFCE7', fg: '#166534', iconBg: '#DCFCE7', iconFg: '#16A34A', label: isTamil ? 'வெற்றி' : 'Submitted' };
    case QUEUE_STATUS.REJECTED_RETRY:
      return { bg: '#FEE2E2', fg: '#991B1B', iconBg: '#FEE2E2', iconFg: '#DC2626', label: isTamil ? 'மறுமுயற்சி' : 'Retry Queued' };
    default:
      return { bg: '#F1F5F9', fg: '#475569', iconBg: '#F1F5F9', iconFg: '#475569', label: status };
  }
}

export default function ReportsScreen() {
  const { user, palette, isTamil, works, portal, appIcon } = useApp();
  const insets = useSafeAreaInsets();
  const heroEnd = palette.isGradient && palette.gradientColors[1] ? palette.gradientColors[1] : palette.secondary;
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [ward, setWard] = useState('all');
  const [street, setStreet] = useState('all');
  const [fromDate, setFromDate] = useState(todayDdMmYyyy);
  const [toDate, setToDate] = useState(todayDdMmYyyy);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [detail, setDetail] = useState<InspectionWork | null>(null);
  const [queued, setQueued] = useState<QueuedWorkEntry[]>([]);
  const [page, setPage] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      const load = async () => {
        const q = [...(await prefs.getQueue())];
        const off = await prefs.getOfflineWorks();
        for (const w of off) {
          if (!q.some((e) => e.work.id === w.id) && !w.workId) {
            q.push({
              clientTaskId: `off-${w.id}`,
              work: w,
              localPhotoPath: w.imageUrl,
              status: 'IN_QUEUE',
              progress: 30,
              attemptCount: 0,
              createdAt: Date.now(),
            });
          }
        }
        if (live) setQueued(q);
      };
      void load();
      const t = setInterval(() => void load(), 2000);
      return () => {
        live = false;
        clearInterval(t);
      };
    }, [])
  );

  const userWorks = useMemo(() => filterUserWorks(works, user, 'reports'), [works, user]);
  const dated = useMemo(() => filterByDateRange(userWorks, fromDate, toDate), [userWorks, fromDate, toDate]);
  const tpId = resolveUserTpId(user, portal.townPanchayats || []);
  const wards = useMemo(() => {
    const uw = (user?.assignedWards || []).map(normalizeWard).filter(Boolean);
    if (uw.length) return uw;
    const db = [...new Set((portal.wardsAndStreets || []).filter((w) => !tpId || !w.tpId || w.tpId === tpId).map((w) => normalizeWard(w.wardNo)))];
    return db.length ? db : Array.from({ length: 15 }, (_, i) => String(i + 1));
  }, [user, portal, tpId]);

  const streets = useMemo(() => {
    if (ward === 'all') return [];
    const fromW = dated.filter((w) => normalizeWard(w.wardNumber) === normalizeWard(ward)).map((w) => localizedStreet(portal, w.streetName, w.wardNumber, isTamil));
    const fromS = (portal.wardsAndStreets || [])
      .filter((w) => normalizeWard(w.wardNo) === normalizeWard(ward))
      .map((w) => (isTamil ? w.streetNameTa || w.streetNameEn : w.streetNameEn));
    return [...new Set([...fromW, ...fromS].filter(Boolean))].sort();
  }, [ward, dated, portal, isTamil]);

  const filtered = useMemo(() => {
    return sortRecentFirst(
      dated.filter((w) => {
        if (ward !== 'all' && normalizeWard(w.wardNumber) !== normalizeWard(ward)) return false;
        if (street !== 'all' && localizedStreet(portal, w.streetName, w.wardNumber, isTamil) !== street) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return w.workId.toLowerCase().includes(q) || w.streetName.toLowerCase().includes(q) || w.subjectNameEn.toLowerCase().includes(q) || w.subjectNameTa.toLowerCase().includes(q);
        }
        return true;
      })
    );
  }, [dated, ward, street, search, portal, isTamil]);

  const queuedFiltered = useMemo(() => {
    return queued.filter((e) => {
      if (ward !== 'all' && normalizeWard(e.work.wardNumber) !== normalizeWard(ward)) return false;
      if (street !== 'all' && localizedStreet(portal, e.work.streetName, e.work.wardNumber, isTamil) !== street) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (e.work.workId || '').toLowerCase().includes(q) ||
          e.work.streetName.toLowerCase().includes(q) ||
          e.work.subjectNameEn.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [queued, ward, street, search, portal, isTamil]);

  useEffect(() => setPage(0), [search, ward, street, fromDate, toDate, tab]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const today = todayDdMmYyyy();
  const isToday = fromDate === today && toDate === today;
  const filtersOn = !!fromDate || !!toDate || !!search.trim() || ward !== 'all';

  const onPickDate = (_: unknown, d: Date) => {
    if (Platform.OS === 'android') setPicker(null);
    const s = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    if (picker === 'from') setFromDate(s);
    else setToDate(s);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F8' }}>
      <LinearGradient
        colors={['#0B1220', palette.primary, heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.heroTop}>
          <HeaderBrand />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.kicker}>{isTamil ? 'ஆய்வு பதிவுகள்' : 'INSPECTION RECORDS'}</Text>
            <Text style={styles.heroTitle}>{isTamil ? 'அறிக்கைகள்' : 'Reports'}</Text>
          </View>
          <HeaderBell />
        </View>
      </LinearGradient>

      <View style={styles.body}>
      <View style={styles.card}>
        <View style={styles.segTabs}>
          <Pressable onPress={() => setTab(0)} style={[styles.segTab, tab === 0 && { backgroundColor: palette.primary }]}>
            <Ionicons name="checkmark-circle-outline" size={14} color={tab === 0 ? '#fff' : '#64748B'} />
            <Text style={{ marginLeft: 4, fontSize: 11, fontWeight: '700', color: tab === 0 ? '#fff' : '#64748B' }}>
              {isTamil ? `சமர்ப்பிப்பு (${filtered.length})` : `Submitted (${filtered.length})`}
            </Text>
          </Pressable>
          <Pressable onPress={() => setTab(1)} style={[styles.segTab, tab === 1 && { backgroundColor: palette.primary }]}>
            <Ionicons name="time-outline" size={14} color={tab === 1 ? '#fff' : '#64748B'} />
            <Text style={{ marginLeft: 4, fontSize: 11, fontWeight: '700', color: tab === 1 ? '#fff' : '#64748B' }}>
              {isTamil ? `வரிசை (${queuedFiltered.length})` : `Queued (${queuedFiltered.length})`}
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isTamil ? 'பணி எண் அல்லது தெரு...' : 'Search work ID, street, subject...'}
            style={styles.search}
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLbl}>{isTamil ? 'தேதி' : 'Date'}</Text>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable
              style={[styles.pill, !fromDate && !toDate && { backgroundColor: palette.primary, borderColor: palette.primary }]}
              onPress={() => {
                setFromDate('');
                setToDate('');
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: !fromDate && !toDate ? '#fff' : '#334155' }}>{isTamil ? 'அனைத்தும்' : 'All'}</Text>
            </Pressable>
            <Pressable
              style={[styles.pill, isToday && { backgroundColor: palette.primary, borderColor: palette.primary }]}
              onPress={() => {
                setFromDate(today);
                setToDate(today);
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: isToday ? '#fff' : '#334155' }}>{isTamil ? 'இன்று' : 'Today'}</Text>
            </Pressable>
            <Pressable
              style={[styles.datePill, !!fromDate && !isToday && { borderColor: palette.primary }]}
              onPress={() => setPicker('from')}
            >
              <Ionicons name="calendar-outline" size={12} color={palette.primary} />
              <Text style={styles.datePillTxt} numberOfLines={1}>{fromDate || (isTamil ? 'முதல்' : 'From')}</Text>
            </Pressable>
            <Pressable
              style={[styles.datePill, !!toDate && !isToday && { borderColor: palette.primary }]}
              onPress={() => setPicker('to')}
            >
              <Ionicons name="calendar-outline" size={12} color={palette.primary} />
              <Text style={styles.datePillTxt} numberOfLines={1}>{toDate || (isTamil ? 'வரை' : 'To')}</Text>
            </Pressable>
            <Pressable
              style={[styles.pill, { backgroundColor: filtersOn ? '#FEE2E2' : '#F8FAFC', borderColor: filtersOn ? '#FECACA' : '#E8EEF4' }]}
              onPress={() => {
                setFromDate('');
                setToDate('');
                setSearch('');
                setWard('all');
                setStreet('all');
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: filtersOn ? '#B91C1C' : '#94A3B8' }}>{isTamil ? 'அழி' : 'Reset'}</Text>
            </Pressable>
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLbl}>{isTamil ? 'வார்டு' : 'Ward'}</Text>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable onPress={() => { setWard('all'); setStreet('all'); }} style={[styles.pill, ward === 'all' && { backgroundColor: palette.primary, borderColor: palette.primary }]}>
              <Text style={{ fontSize: 11, fontWeight: ward === 'all' ? '700' : '500', color: ward === 'all' ? '#fff' : '#334155' }}>{isTamil ? 'அனைத்தும்' : 'All'}</Text>
            </Pressable>
            {wards.map((w) => (
              <Pressable
                key={w}
                onPress={() => { setWard(w); setStreet('all'); }}
                style={[styles.pill, ward === w && { backgroundColor: palette.primary, borderColor: palette.primary }]}
              >
                <Text style={{ fontSize: 11, fontWeight: ward === w ? '700' : '500', color: ward === w ? '#fff' : '#334155' }}>{w}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        {ward !== 'all' && (
          <View style={styles.filterRow}>
            <Text style={styles.filterLbl}>{isTamil ? 'தெரு' : 'Street'}</Text>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Pressable onPress={() => setStreet('all')} style={[styles.pill, street === 'all' && { backgroundColor: palette.primary, borderColor: palette.primary }]}>
                <Text style={{ fontSize: 11, fontWeight: street === 'all' ? '700' : '500', color: street === 'all' ? '#fff' : '#334155' }}>
                  {isTamil ? 'அனைத்தும்' : 'All'}
                </Text>
              </Pressable>
              {streets.map((s) => (
                <Pressable key={s} onPress={() => setStreet(s)} style={[styles.pill, street === s && { backgroundColor: palette.primary, borderColor: palette.primary }]}>
                  <Text style={{ fontSize: 11, fontWeight: street === s ? '700' : '500', color: street === s ? '#fff' : '#334155' }}>{s}</Text>
                </Pressable>
              ))}
              {!streets.length && <Text style={{ fontSize: 11, color: '#94A3B8', paddingVertical: 4 }}>{isTamil ? 'தெருக்கள் இல்லை' : 'No streets'}</Text>}
            </ScrollView>
          </View>
        )}
      </View>
      {picker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={onPickDate}
          onDismiss={() => setPicker(null)}
        />
      )}

      {tab === 0 ? (
        !filtered.length ? (
          <View style={styles.empty}>
            <Ionicons name="document-text" size={52} color="#CBD5E1" />
            <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 10, textAlign: 'center' }}>
              {isTamil ? 'சமர்ப்பிக்கப்பட்ட ஆய்வு அறிக்கைகள் எதுவும் கிடைக்கவில்லை' : 'No submitted inspection reports found'}
            </Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {pageItems.map((w) => {
                const unsynced = !w.workId;
                return (
                  <Pressable key={w.id} style={styles.itemCard} onPress={() => setDetail(w)}>
                    <View style={[styles.iconBox, { backgroundColor: palette.primaryContainer }]}>
                      <Ionicons name="clipboard-outline" size={16} color={palette.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 13, color: unsynced ? '#B45309' : '#0F172A' }} numberOfLines={1}>
                        {unsynced ? (isTamil ? 'ஒத்திசைக்கப்படாத பணி' : 'Unsynced work') : shortWorkId(w.workId)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                        {isTamil ? w.subjectNameTa || w.subjectNameEn : w.subjectNameEn} · {isTamil ? 'வார்டு' : 'Ward'} {w.wardNumber} · {localizedStreet(portal, w.streetName, w.wardNumber, isTamil)}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: unsynced ? '#FFFBEB' : '#ECFDF5', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: unsynced ? '#B45309' : '#047857' }}>
                        {unsynced ? (isTamil ? 'நிலுவை' : 'Pending') : isTamil ? 'ஒத்திசைவு' : 'Synced'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <View style={styles.pager}>
                <Pressable
                  disabled={page <= 0}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  style={[styles.pageBtn, page <= 0 && { opacity: 0.35 }]}
                >
                  <Ionicons name="chevron-back" size={14} color={palette.primary} />
                </Pressable>
                <Text style={styles.pageTxt}>
                  {page + 1}/{totalPages}
                </Text>
                <Pressable
                  disabled={page >= totalPages - 1}
                  onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  style={[styles.pageBtn, page >= totalPages - 1 && { opacity: 0.35 }]}
                >
                  <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                </Pressable>
              </View>
            </ScrollView>
          </>
        )
      ) : !queuedFiltered.length ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done" size={54} color="#16A34A" />
          <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 14, marginTop: 10, textAlign: 'center' }}>
            {isTamil ? 'வரிசையில் எந்தப் பணிகளும் நிலுவையில் இல்லை' : 'No pending works in queue'}
          </Text>
          <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4, textAlign: 'center' }}>
            {isTamil ? 'அனைத்து பணிகளும் வெற்றிகரமாக பதிவேற்றப்பட்டுவிட்டன' : 'All entries have been successfully uploaded'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
          {queuedFiltered.map((e, i) => {
            const b = queueBadge(e.status, isTamil);
            const streetName = localizedStreet(portal, e.work.streetName, e.work.wardNumber, isTamil);
            const when = new Date(e.createdAt);
            const time = `${String(when.getDate()).padStart(2, '0')}-${String(when.getMonth() + 1).padStart(2, '0')}-${when.getFullYear()}`;
            return (
              <Pressable key={e.clientTaskId} style={styles.itemCard} onPress={() => setDetail(e.work)}>
                <View style={[styles.iconBox, { backgroundColor: b.iconBg }]}>
                  <Text style={{ fontWeight: '800', fontSize: 11, color: b.iconFg }}>#{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: i === 0 ? palette.primary : '#0F172A' }} numberOfLines={1}>
                    {i === 0 ? (isTamil ? 'அடுத்த பணி' : 'Next in queue') : `${isTamil ? 'வரிசை' : 'Queue'} ${i + 1}`}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                    {isTamil ? e.work.subjectNameTa || e.work.subjectNameEn : e.work.subjectNameEn} · {isTamil ? 'வார்டு' : 'Ward'} {e.work.wardNumber} · {streetName}
                  </Text>
                  {e.attemptCount > 0 && (
                    <Text style={{ fontSize: 10, color: '#B45309', marginTop: 2 }}>
                      {isTamil ? 'முயற்சி' : 'Attempt'} {e.attemptCount}/3
                    </Text>
                  )}
                </View>
                <View style={{ backgroundColor: b.bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: b.fg }}>{b.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {detail && (
        <WorkDetailModal
          work={detail}
          portal={portal}
          isTamil={isTamil}
          palette={palette}
          streetLabel={localizedStreet(portal, detail.streetName, detail.wardNumber, isTamil)}
          onClose={() => setDetail(null)}
        />
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  kicker: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  body: { flex: 1, marginTop: -14, paddingHorizontal: 16, paddingBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E8EEF4' },
  segTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3 },
  segTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E8EEF4', borderRadius: 12, paddingHorizontal: 10, marginTop: 8 },
  search: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, color: '#0F172A', fontSize: 13 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  filterLbl: { width: 48, fontSize: 11, fontWeight: '700', color: '#64748B' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  pill: { borderRadius: 16, borderWidth: 1, borderColor: '#E8EEF4', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5 },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEF4',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 108,
  },
  datePillTxt: { fontSize: 11, fontWeight: '600', color: '#334155' },
  list: { flex: 1, marginTop: 8, minHeight: 160 },
  listContent: { flexGrow: 1, gap: 10, paddingBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EEF4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pager: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: 8 },
  pageBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F7' },
  pageTxt: { fontSize: 11, fontWeight: '700', color: '#64748B', minWidth: 28, textAlign: 'center' },
});
