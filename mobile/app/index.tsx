import { Redirect } from 'expo-router';
import { useApp } from '../src/context/AppContext';

export default function Index() {
  const { user, ready } = useApp();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)" />;
}
