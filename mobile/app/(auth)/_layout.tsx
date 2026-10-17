import { Redirect, Stack } from 'expo-router';
import { useApp } from '../../src/context/AppContext';

export default function AuthLayout() {
  const { user } = useApp();
  if (user) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
