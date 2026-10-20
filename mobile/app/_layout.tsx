import { Stack } from 'expo-router';
import './notifications';
import './(auth)/login';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppLoadingScreen } from '../src/components/AppLoadingScreen';
import { UpdateDialog } from '../src/components/UpdateDialog';
import { AppProvider, useApp } from '../src/context/AppContext';

function Shell() {
  const { ready, palette } = useApp();
  if (!ready) {
    return <AppLoadingScreen />;
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
