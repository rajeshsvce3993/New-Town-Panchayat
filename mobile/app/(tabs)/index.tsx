import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, isRemotePhotoUrl, resolveProfilePhotoUrl } from '../../src/api/client';
import { HeaderBell } from '../../src/components/AppHeader';
import { HeaderBrand } from '../../src/components/HeaderBrand';
import { useApp } from '../../src/context/AppContext';
import { prefs, profilePhotoFile } from '../../src/storage/preferences';
import { QUEUE_STATUS, effectivePhotoUrl, effectiveWards, queuedDisplayStatus, type QueuedWorkEntry } from '../../src/types/models';
import { formatTo12Hr, todayDdMmYyyy } from '../../src/utils/dates';
import { normalizeWard } from '../../src/utils/wards';
import { filterByDateRange, filterUserWorks, sortRecentFirst } from '../../src/utils/workFilters';

function withAlpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  return `#${h}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;
}


function queueStatusColor(status: string) {
  switch (status) {
    case QUEUE_STATUS.IMAGE_COMPRESSING:
      return '#F59E0B';
    case QUEUE_STATUS.IN_QUEUE:
      return '#6366F1';
    case QUEUE_STATUS.PROCESSING:
      return '#0EA5E9';
    case QUEUE_STATUS.SUBMITTED:
      return '#10B981';
    default:
      return '#EF4444';
  }
}


export default function DashboardScreen() {
  const { user, palette, isTamil, works, appIcon, loginLogo, setBrandingUrls } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fromDate, setFromDate] = useState(todayDdMmYyyy);
  const [toDate, setToDate] = useState(todayDdMmYyyy);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [queue, setQueue] = useState<QueuedWorkEntry[]>([]);
  const [photo, setPhoto] = useState<string | null>(effectivePhotoUrl(user));
  const [diagramTab, setDiagramTab] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [logoDlg, setLogoDlg] = useState(false);
  const [iconInput, setIconInput] = useState(appIcon);
  const [logoInput, setLogoInput] = useState(loginLogo);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const q = await prefs.getQueue();
        if (live) setQueue(q);
        try {
          const fetched = await api.getNotifications(user?.id || user?.username, user?.zone, user?.tpId);
          if (fetched) await prefs.setNotifications(fetched);
        } catch {
          /* */
        }
      })();
      const t = setInterval(async () => setQueue(await prefs.getQueue()), 1000);
      return () => {
        live = false;
        clearInterval(t);
      };
    }, [user])
  );

  useEffect(() => {
    (async () => {
      const remote = effectivePhotoUrl(user);
      if (isRemotePhotoUrl(remote)) {
        setPhoto(remote);
        return;
      }
      try {
        const FileSystem = await import('expo-file-system/legacy');
        const local = profilePhotoFile();
        const info = await FileSystem.getInfoAsync(local);
        if (info.exists) {
          setPhoto(local);
          return;
        }
      } catch {
        /* */
      }
      setPhoto(remote);
    })();
  }, [user]);

  const userWorks = useMemo(() => filterUserWorks(works, user, 'dashboard'), [works, user]);
  const filtered = useMemo(() => sortRecentFirst(filterByDateRange(userWorks, fromDate, toDate)), [userWorks, fromDate, toDate]);
  const totalCount = filtered.length;
  const syncedCount = filtered.filter((w) => w.workId).length;
  const unsyncedCount = filtered.filter((w) => !w.workId).length;

  const subjectStats = useMemo(() => {
    const map = new Map<string, { ta: string; n: number }>();
    filtered.forEach((w) => {
      const cur = map.get(w.subjectNameEn) || { ta: w.subjectNameTa, n: 0 };
      cur.n += 1;
      map.set(w.subjectNameEn, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [filtered]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, { ta: string; n: number }>();
    filtered.forEach((w) => {
      const cur = map.get(w.categoryNameEn) || { ta: w.categoryNameTa, n: 0 };
      cur.n += 1;
      map.set(w.categoryNameEn, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [filtered]);

  const wardStats = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((w) => {
      const k = normalizeWard(w.wardNumber);
      map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [filtered]);

  const streetStats = useMemo(() => {
    if (!selectedWard) return [] as [string, number][];
    const map = new Map<string, number>();
    filtered
      .filter((w) => normalizeWard(w.wardNumber) === normalizeWard(selectedWard))
      .forEach((w) => map.set(w.streetName, (map.get(w.streetName) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered, selectedWard]);

  const tpName = isTamil ? user?.townPanchayatTa || user?.townPanchayat || '—' : user?.townPanchayat || '—';
  const districtName = isTamil ? user?.districtTa || user?.district || '—' : user?.district || '—';
  const roleName = isTamil ? user?.roleNameTa || user?.role || '—' : user?.role || '—';
  const wardList = effectiveWards(user);
  const wardText = wardList.length ? wardList.join(', ') : isTamil ? 'அனைத்தும்' : 'All';
  const isAdmin = (user?.role || '').toLowerCase().includes('admin');
  const photoUri = resolveProfilePhotoUrl(photo);
  const heroEnd = palette.isGradient && palette.gradientColors[1] ? palette.gradientColors[1] : palette.secondary;

  const onPickDate = (_: unknown, d: Date) => {
    if (Platform.OS === 'android') setPicker(null);
    const s = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    if (picker === 'from') setFromDate(s);
    else setToDate(s);
  };

  const today = todayDdMmYyyy();
  const isToday = fromDate === today && toDate === today;
  const allDates = !fromDate && !toDate;

  const renderInsightTable = (
    rows: { key: string; label: string; n: number; onPress?: () => void; selected?: boolean; chevron?: boolean }[],
    empty: string,
  ) => {
    if (!rows.length) return <Text style={styles.emptyChart}>{empty}</Text>;
    const maxVal = Math.max(1, ...rows.map((r) => r.n));
    const sumVal = Math.max(1, rows.reduce((s, r) => s + r.n, 0));
    return (
      <>
        <View style={styles.insightHead}>
          <Text style={[styles.insightLabel, styles.insightHeadTxt]} numberOfLines={1}>
            {diagramTab === 0 ? (isTamil ? 'பொருள்' : 'Subject') : diagramTab === 1 ? (isTamil ? 'வகை' : 'Category') : selectedWard ? (isTamil ? 'தெரு' : 'Street') : (isTamil ? 'வார்டு' : 'Ward')}
          </Text>
          <View style={styles.insightBarWrap} />
          <Text style={[styles.insightCount, styles.insightHeadTxt]}>#</Text>
          <Text style={[styles.insightPct, styles.insightHeadTxt]}>%</Text>
          <View style={styles.insightAction} />
        </View>
        {rows.map((r) => {
          const pct = Math.round((r.n / sumVal) * 100);
          const inner = (
            <>
              <Text style={styles.insightLabel} numberOfLines={1}>{r.label}</Text>
              <View style={styles.insightBarWrap}>
                <View style={[styles.barTrack, { backgroundColor: withAlpha(palette.primary, 0.12) }]}>
                  <View style={[styles.barFill, { width: `${(r.n / maxVal) * 100}%`, backgroundColor: palette.primary }]} />
                </View>
              </View>
              <Text style={styles.insightCount}>{r.n}</Text>
              <Text style={styles.insightPct}>{pct}%</Text>
              <View style={styles.insightAction}>
                {r.chevron ? <Ionicons name="chevron-forward" size={12} color="#CBD5E1" /> : null}
              </View>
            </>
          );
          if (r.onPress) {
            return (
              <Pressable
                key={r.key}
                onPress={r.onPress}
                style={[styles.insightRow, r.selected && { backgroundColor: withAlpha(palette.primary, 0.06) }]}
              >
                {inner}
              </Pressable>
            );
          }
          return (
            <View key={r.key} style={styles.insightRow}>
              {inner}
            </View>
          );
        })}
      </>
    );
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
              <Text style={styles.kicker}>{isTamil ? 'கள ஆய்வு மேடை' : 'FIELD COMMAND'}</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {isTamil ? 'பேரூராட்சி மேலாண்மை' : 'Town Panchayat EMS'}
              </Text>
            </View>
            <HeaderBell />
            {isAdmin && (
              <Pressable
                onPress={() => {
                  setIconInput(appIcon);
                  setLogoInput(loginLogo);
                  setLogoDlg(true);
                }}
                style={styles.heroBtn}
              >
                <Ionicons name="color-wand" size={18} color="#fff" />
              </Pressable>
            )}
          </View>
        </LinearGradient>

      <View style={styles.pinned}>
        <View style={styles.identity}>
          <View style={styles.identityHead}>
            <View style={[styles.avatar, { borderColor: palette.primary }]}>
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={styles.avatarImg}
                  onError={() => {
                    if (isRemotePhotoUrl(photo)) setPhoto(profilePhotoFile());
                    else setPhoto(null);
                  }}
                />
              ) : (
                <LinearGradient colors={[palette.primary, palette.secondary]} style={styles.avatarImg}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{(user?.name || 'A').slice(0, 1).toUpperCase()}</Text>
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.officerName} numberOfLines={1}>{user?.name || 'Officer'}</Text>
              <Text style={styles.officerMeta} numberOfLines={1}>
                {roleName}
                {user?.mobile ? `  ·  ${user.mobile}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>{isTamil ? 'பேரூராட்சி' : 'TP'}</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{tpName}</Text>
            </View>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>{isTamil ? 'மாவட்டம்' : 'District'}</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{districtName}</Text>
            </View>
            <View style={[styles.detailCol, { borderRightWidth: 0 }]}>
              <Text style={styles.detailLabel}>{isTamil ? 'வார்டு' : 'Wards'}</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{wardText}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={styles.sheet}>
          <View style={styles.statsRow}>
            {[
              { n: totalCount, l: isTamil ? 'சமர்ப்பிப்பு' : 'Filed', c: palette.primary, ic: 'documents-outline' as const },
              { n: syncedCount, l: isTamil ? 'ஒத்திசைவு' : 'Synced', c: '#0F766E', ic: 'checkmark-done-outline' as const },
              { n: unsyncedCount, l: isTamil ? 'நிலுவை' : 'Pending', c: '#B45309', ic: 'time-outline' as const },
            ].map((k) => (
              <View key={k.l} style={[styles.statChip, { backgroundColor: withAlpha(k.c, 0.12), borderColor: withAlpha(k.c, 0.22) }]}>
                <View style={[styles.statDot, { backgroundColor: k.c }]}>
                  <Ionicons name={k.ic} size={12} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statN, { color: k.c }]}>{k.n}</Text>
                  <Text style={styles.statL} numberOfLines={1}>{k.l}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable onPress={() => router.push('/(tabs)/add-work')} style={styles.addWrap}>
            <LinearGradient colors={[palette.primary, heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addCta}>
              <View style={styles.addPlus}>
                <Ionicons name="add" size={22} color={palette.primary} />
              </View>
              <Text style={styles.addCtaText}>{isTamil ? 'புதிய பணி பதிவு' : 'New field inspection'}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>

          {queue.length > 0 && (
            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.liveDot} />
                  <Text style={styles.sectionTitle}>{isTamil ? 'நேரடி வரிசை' : 'Live sync queue'}</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: palette.primary }}>
                  {queue.length} {isTamil ? 'பணிகள்' : 'in flight'}
                </Text>
              </View>
              {queue.map((entry, i) => {
                const c = queueStatusColor(entry.status);
                return (
                  <View key={entry.clientTaskId} style={styles.qItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.qTitle}>
                        #{i + 1}  {entry.work.subjectNameEn} · W{entry.work.wardNumber}
                      </Text>
                      <View style={{ backgroundColor: withAlpha(c, 0.14), borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: c }}>{queuedDisplayStatus(entry, isTamil)}</Text>
                      </View>
                    </View>
                    {entry.status !== QUEUE_STATUS.SUBMITTED ? (
                      <View style={[styles.barTrack, { marginTop: 8, height: 5 }]}>
                        <View style={[styles.barFill, { height: 5, width: `${Math.min(100, Math.max(5, entry.progress || 5))}%`, backgroundColor: c }]} />
                      </View>
                    ) : (
                      !!entry.workId && (
                        <Text style={{ marginTop: 6, fontSize: 11, fontWeight: '600', color: '#059669' }}>
                          {isTamil ? 'Work ID' : 'Work ID'}: {entry.workId}
                        </Text>
                      )
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: withAlpha(palette.primary, 0.12) }]}>
                <Ionicons name="calendar-outline" size={15} color={palette.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isTamil ? 'கால வரம்பு' : 'Inspection window'}</Text>
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLbl}>{isTamil ? 'தேதி' : 'Date'}</Text>
              <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  style={[styles.pill, allDates && { backgroundColor: palette.primary, borderColor: palette.primary }]}
                  onPress={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: allDates ? '#fff' : '#334155' }}>{isTamil ? 'அனைத்தும்' : 'All'}</Text>
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
                  style={[styles.pill, { backgroundColor: allDates ? '#F8FAFC' : '#FEE2E2', borderColor: allDates ? '#E8EEF4' : '#FECACA' }]}
                  onPress={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: allDates ? '#94A3B8' : '#B91C1C' }}>{isTamil ? 'அழி' : 'Reset'}</Text>
                </Pressable>
              </ScrollView>
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
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: withAlpha(palette.primary, 0.12) }]}>
                <Ionicons name="analytics-outline" size={15} color={palette.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isTamil ? 'ஆய்வு பகுப்பாய்வு' : 'Field insights'}</Text>
              <View style={[styles.totalChip, { backgroundColor: withAlpha(palette.primary, 0.1) }]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: palette.primary }}>
                  {filtered.length} {isTamil ? 'ஆய்வு' : 'works'}
                </Text>
              </View>
            </View>
            <View style={styles.segTabs}>
              {(
                [
                  [0, isTamil ? 'பொருள்' : 'Subject'],
                  [1, isTamil ? 'வகை' : 'Category'],
                  [2, isTamil ? 'வார்டு' : 'Ward'],
                ] as const
              ).map(([idx, label]) => {
                const sel = diagramTab === idx;
                return (
                  <Pressable
                    key={label}
                    onPress={() => {
                      setDiagramTab(idx);
                      setSelectedKey(null);
                      if (idx !== 2) setSelectedWard(null);
                    }}
                    style={[styles.segTab, sel && { backgroundColor: palette.primary }]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: sel ? '#fff' : '#64748B' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ marginTop: 8 }}>
              {diagramTab === 0 &&
                renderInsightTable(
                  subjectStats.map(([en, v]) => ({
                    key: en,
                    label: isTamil ? v.ta || en : en,
                    n: v.n,
                    onPress: () => setSelectedKey(selectedKey === en ? null : en),
                    selected: selectedKey === en,
                  })),
                  isTamil ? 'தகவல்கள் எதுவும் இல்லை' : 'No records for this period',
                )}
              {diagramTab === 1 &&
                renderInsightTable(
                  categoryStats.map(([en, v]) => ({
                    key: en,
                    label: isTamil ? v.ta || en : en,
                    n: v.n,
                    onPress: () => setSelectedKey(selectedKey === en ? null : en),
                    selected: selectedKey === en,
                  })),
                  isTamil ? 'தகவல்கள் எதுவும் இல்லை' : 'No records for this period',
                )}
              {diagramTab === 2 &&
                (selectedWard ? (
                  <>
                    <View style={styles.wardHead}>
                      <Text style={styles.wardHeadTitle}>
                        {isTamil ? `வார்டு ${selectedWard}` : `Ward ${selectedWard}`}
                      </Text>
                      <Pressable onPress={() => setSelectedWard(null)} style={styles.backChip}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>{isTamil ? 'பின்' : 'Back'}</Text>
                      </Pressable>
                    </View>
                    {renderInsightTable(
                      streetStats.map(([street, n]) => ({ key: street, label: street, n })),
                      isTamil ? 'தெருக்கள் இல்லை' : 'No street data',
                    )}
                  </>
                ) : (
                  renderInsightTable(
                    wardStats.map(([ward, n]) => ({
                      key: ward,
                      label: isTamil ? `வார்டு ${ward}` : `Ward ${ward}`,
                      n,
                      onPress: () => setSelectedWard(ward),
                      chevron: true,
                    })),
                    isTamil ? 'தகவல்கள் இல்லை' : 'No ward data',
                  )
                ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: withAlpha(palette.primary, 0.12) }]}>
                <Ionicons name="list-outline" size={15} color={palette.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isTamil ? 'சமீபத்திய ஆய்வுகள்' : 'Latest inspections'}</Text>
              <Pressable onPress={() => router.push('/(tabs)/reports')} style={styles.viewAll}>
                <Text style={{ color: palette.primary, fontSize: 11, fontWeight: '700' }}>{isTamil ? 'அனைத்தும்' : 'View all'}</Text>
                <Ionicons name="chevron-forward" size={12} color={palette.primary} />
              </Pressable>
            </View>
            {!filtered.length ? (
              <View style={styles.emptyBox}>
                <Ionicons name="clipboard-outline" size={28} color="#CBD5E1" />
                <Text style={styles.emptyChart}>{isTamil ? 'இந்த காலத்தில் ஆய்வு இல்லை' : 'No inspections in this window'}</Text>
              </View>
            ) : (
              filtered.slice(0, 5).map((work) => {
                const done = /submitted|completed/i.test(work.status || '');
                const subj = isTamil ? work.subjectNameTa || work.subjectNameEn : work.subjectNameEn;
                const cat = isTamil ? work.categoryNameTa || work.categoryNameEn : work.categoryNameEn;
                return (
                  <Pressable key={work.workId || work.id} onPress={() => router.push('/(tabs)/reports')} style={styles.inspectItem}>
                    <View style={[styles.inspectIcon, { backgroundColor: withAlpha(palette.primary, 0.1) }]}>
                      <Ionicons name="clipboard-outline" size={15} color={palette.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={styles.inspectTitle}>{subj}</Text>
                      <Text numberOfLines={1} style={styles.inspectMeta}>
                        {cat} · {isTamil ? 'வார்டு' : 'Ward'} {work.wardNumber} · {formatTo12Hr(work.submittedAt)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: done ? '#ECFDF5' : '#FFFBEB' }]}>
                      <Text style={{ color: done ? '#047857' : '#B45309', fontSize: 9, fontWeight: '800' }}>{work.status || 'Submitted'}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={logoDlg} transparent animationType="fade" onRequestClose={() => setLogoDlg(false)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>{isTamil ? 'சின்னம் தனிப்பயனாக்கம்' : 'Brand assets'}</Text>
            <TextInput value={iconInput} onChangeText={setIconInput} placeholder={isTamil ? 'ஆப் ஐகான் URL' : 'App Icon URL'} style={styles.modalInput} />
            <TextInput value={logoInput} onChangeText={setLogoInput} placeholder={isTamil ? 'உள்நுழைவு லோகோ URL' : 'Login Logo URL'} style={styles.modalInput} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => setLogoDlg(false)} style={{ padding: 10 }}>
                <Text>{isTamil ? 'மூடு' : 'Close'}</Text>
              </Pressable>
              <Pressable
                style={[styles.todayBtn, { backgroundColor: palette.primary, height: 36, paddingHorizontal: 14 }]}
                onPress={() => {
                  void setBrandingUrls(iconInput, logoInput);
                  setLogoDlg(false);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{isTamil ? 'சேமி' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  kicker: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  heroBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  pinned: { marginTop: -14, paddingHorizontal: 16, zIndex: 2 },
  sheet: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  identity: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 10,
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  identityHead: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  officerName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  officerMeta: { fontSize: 11, color: '#64748B', marginTop: 1, fontWeight: '500' },
  detailGrid: { flexDirection: 'row', marginTop: 8, borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 8 },
  detailCol: { flex: 1, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: '#EEF2F7' },
  detailLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3, textTransform: 'uppercase' },
  detailValue: { fontSize: 11, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  addWrap: { borderRadius: 22, overflow: 'hidden', elevation: 4 },
  addCta: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  addPlus: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  addCtaText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EEF4',
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 8 },
  qItem: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginBottom: 8 },
  qTitle: { fontWeight: '700', fontSize: 12, color: '#1E293B', flex: 1, marginRight: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  statDot: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statN: { fontSize: 16, fontWeight: '800', lineHeight: 18 },
  statL: { fontSize: 9, fontWeight: '700', color: '#64748B', marginTop: 1 },
  todayBtn: { height: 40, borderRadius: 14, paddingHorizontal: 12, justifyContent: 'center' },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
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
  totalChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  segTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3 },
  segTab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  insightHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 2,
  },
  insightHeadTxt: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3, textTransform: 'uppercase' },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  insightLabel: { width: 92, fontSize: 12, fontWeight: '600', color: '#1E293B' },
  insightBarWrap: { flex: 1, minWidth: 48 },
  insightCount: { width: 28, fontSize: 12, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
  insightPct: { width: 36, fontSize: 11, fontWeight: '700', color: '#64748B', textAlign: 'right' },
  insightAction: { width: 14, alignItems: 'center' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  barFill: { height: 6, borderRadius: 3 },
  emptyChart: { textAlign: 'center', color: '#94A3B8', fontSize: 12, paddingVertical: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 16 },
  backChip: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  wardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  wardHeadTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  inspectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inspectIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inspectTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  inspectMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18 },
  modalInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 10, fontSize: 12, marginBottom: 8 },
});
