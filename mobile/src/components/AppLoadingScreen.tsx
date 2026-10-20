import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_VERSION_NAME } from '../constants/config';
import { BRAND_NAVY } from '../theme/palettes';
import { BrandImage } from './BrandImage';

export function AppLoadingScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#3E6A96', BRAND_NAVY, '#07111F']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fill}
      >
        <View style={styles.center}>
          <View style={styles.card}>
            <BrandImage kind="logo" style={styles.logo} />
            <ActivityIndicator style={styles.spinner} size="small" color={BRAND_NAVY} />
          </View>
        </View>
        <Text style={[styles.version, { bottom: Math.max(insets.bottom, 16) + 16 }]}>v{APP_VERSION_NAME}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND_NAVY },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  center: { width: '100%', maxWidth: 380, alignItems: 'center' },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  logo: { width: 168, height: 202 },
  spinner: { marginTop: 18 },
  version: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
});
