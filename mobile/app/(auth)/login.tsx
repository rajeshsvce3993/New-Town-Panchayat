import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { BrandImage } from '../../src/components/BrandImage';
import { useApp } from '../../src/context/AppContext';
import { prefs } from '../../src/storage/preferences';
import { BRAND_NAVY, palettes } from '../../src/theme/palettes';

function withAlpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  return `#${h}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

export default function LoginScreen() {
  const { palette, isTamil, setLanguage, setThemeId, performLogin, onLoginSuccess, saveServerUrl, serverUrl } =
    useApp();
  const insets = useSafeAreaInsets();
  const heroEnd = palette.isGradient && palette.gradientColors[1] ? palette.gradientColors[1] : palette.secondary;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taps, setTaps] = useState(0);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverInput, setServerInput] = useState(serverUrl);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);

  useEffect(() => {
    (async () => {
      setUsername((await prefs.getLastLoggedUsername()) || '');
      setPassword((await prefs.getSavedPassword()) || '');
    })();
  }, []);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError(isTamil ? 'பயனர் பெயர் மற்றும் கடவுச்சொல் தேவை' : 'Username and password are required');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await performLogin({ username: username.trim(), password });
    setLoading(false);
    if (res.success && res.user) {
      await prefs.setSavedUsername(username.trim());
      await prefs.setSavedPassword(password);
      if (res.userScope) {
        await prefs.setUserScope(res.userScope);
        await prefs.setScopeVersionInt(res.scopeVersion || 1);
      }
      await onLoginSuccess(res.user);
    } else {
      setError(res.message || (isTamil ? 'உள்நுழைவு தோல்வியுற்றது. விவரங்களை சரிபார்க்கவும்.' : 'Login failed. Please check your credentials.'));
    }
  };

  const themeIndex = Math.max(0, palettes.findIndex((p) => p.id === palette.id));
  const openServer = () => {
    const n = taps + 1;
    if (n >= 5) {
      setServerOpen(true);
      setTaps(0);
      setServerInput(serverUrl);
      setTestMsg(null);
      setTestOk(false);
    } else setTaps(n);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1220' }}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0B1220', BRAND_NAVY, palette.primary]} start={{ x: 0.1, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
            ]}
          >
            <View style={styles.panel}>
              <Pressable onPress={openServer} style={styles.brand}>
                <BrandImage kind="logo" style={styles.logo} />
              </Pressable>
              <Text style={styles.welcome}>{isTamil ? 'அலுவலர் கணக்கில் உள்நுழைக' : 'Sign in to your officer account'}</Text>

              <View style={[styles.field, !!error && !username.trim() && styles.fieldErr]}>
                <View style={[styles.fieldIcon, { backgroundColor: withAlpha(palette.primary, 0.12) }]}>
                  <Ionicons name="person-outline" size={16} color={palette.primary} />
                </View>
                <TextInput
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t);
                    void prefs.setSavedUsername(t.trim());
                    setError(null);
                  }}
                  placeholder={isTamil ? 'பயனர் பெயர்' : 'Username'}
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  keyboardType="default"
                  textContentType="username"
                />
              </View>

              <View style={[styles.field, !!error && !password && styles.fieldErr]}>
                <View style={[styles.fieldIcon, { backgroundColor: withAlpha(palette.primary, 0.12) }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={palette.primary} />
                </View>
                <TextInput
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    void prefs.setSavedPassword(t);
                    setError(null);
                  }}
                  placeholder={isTamil ? 'கடவுச்சொல்' : 'Password'}
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  keyboardType="default"
                  textContentType="password"
                  onSubmitEditing={() => void submit()}
                />
                <Pressable onPress={() => setShowPass((s) => !s)} hitSlop={8} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
                </Pressable>
              </View>

              {!!error && (
                <View style={styles.err}>
                  <Ionicons name="alert-circle" size={14} color="#B91C1C" />
                  <Text style={styles.errText}>{error}</Text>
                </View>
              )}

              <Pressable onPress={() => void submit()} disabled={loading} style={styles.loginWrap}>
                <LinearGradient colors={[palette.primary, heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginBtn}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.loginText}>{isTamil ? 'உள்நுழைக' : 'Sign in'}</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.prefs}>
                <View style={styles.seg}>
                  <Pressable onPress={() => void setLanguage(true)} style={[styles.segTab, isTamil && { backgroundColor: palette.primary }]}>
                    <Text style={[styles.segTxt, isTamil && { color: '#fff' }]}>தமிழ்</Text>
                  </Pressable>
                  <Pressable onPress={() => void setLanguage(false)} style={[styles.segTab, !isTamil && { backgroundColor: palette.primary }]}>
                    <Text style={[styles.segTxt, !isTamil && { color: '#fff' }]}>EN</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={styles.themeBtn}
                  onPress={() => void setThemeId(palettes[(themeIndex + 1) % palettes.length].id)}
                >
                  <View style={[styles.dot, { backgroundColor: palette.primary }]} />
                  <Text style={styles.themeName} numberOfLines={1}>
                    {isTamil ? palette.nameTa : palette.nameEn}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <Modal visible={serverOpen} transparent animationType="fade">
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{isTamil ? 'சேவையக அமைப்பு' : 'Server setup'}</Text>
            <Text style={styles.modalHint}>
              {isTamil ? 'சர்வர் IP முகவரி மற்றும் Port 5000 ஐ உள்ளிடவும்' : 'Enter the server address with port 5000'}
            </Text>
            <TextInput
              value={serverInput}
              onChangeText={(t) => {
                setServerInput(t);
                setTestMsg(null);
                setTestOk(false);
              }}
              style={styles.serverInput}
              autoCapitalize="none"
              placeholder="http://192.168.1.100:5000"
              placeholderTextColor="#94A3B8"
            />
            <Pressable
              style={styles.testBtn}
              disabled={testing || !serverInput.trim()}
              onPress={async () => {
                setTesting(true);
                const [ok, msg] = await api.testConnection(serverInput.trim());
                setTesting(false);
                setTestOk(ok);
                setTestMsg(msg);
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                {testing ? (isTamil ? 'சோதிக்கிறது...' : 'Testing...') : isTamil ? 'இணைப்பைச் சோதிக்க' : 'Test connection'}
              </Text>
            </Pressable>
            {!!testMsg && (
              <Text style={{ color: testOk ? '#15803D' : '#DC2626', marginTop: 8, fontSize: 12, fontWeight: '600' }}>{testMsg}</Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => setServerOpen(false)} style={styles.modalGhost}>
                <Text style={{ color: '#64748B', fontWeight: '700' }}>{isTamil ? 'மூடு' : 'Close'}</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, { backgroundColor: palette.primary }]}
                onPress={async () => {
                  if (serverInput.trim()) await saveServerUrl(serverInput);
                  setServerOpen(false);
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
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22 },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  brand: { alignItems: 'center', marginBottom: 8 },
  logo: { width: 128, height: 154 },
  welcome: {
    textAlign: 'center',
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 18,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EEF4',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 8,
    marginBottom: 10,
    minHeight: 48,
  },
  fieldErr: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  fieldIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: '#0F172A', fontSize: 14 },
  eyeBtn: { padding: 6 },
  err: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  errText: { color: '#B91C1C', fontSize: 12, fontWeight: '600', flex: 1 },
  loginWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  loginBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  loginText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  prefs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  seg: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3 },
  segTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  themeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8EEF4',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    flexShrink: 1,
  },
  themeName: { fontWeight: '700', fontSize: 11, color: '#0F172A', maxWidth: 110 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  modalBack: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  modalTitle: { fontWeight: '800', fontSize: 16, color: '#0F172A' },
  modalHint: { fontSize: 12, color: '#64748B', marginVertical: 8 },
  serverInput: {
    borderWidth: 1,
    borderColor: '#E8EEF4',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  testBtn: { backgroundColor: '#0F172A', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
  modalGhost: { paddingHorizontal: 12, paddingVertical: 8 },
  saveBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
});
