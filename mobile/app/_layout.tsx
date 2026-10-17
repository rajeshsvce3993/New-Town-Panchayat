import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UpdateDialog } from '../src/components/UpdateDialog';
import { AppProvider, useApp } from '../src/context/AppContext';

function Shell() {
  const { ready, palette } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator color="#F59E0B" />
      </View>
    );
  }
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />
      <UpdateDialog />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
