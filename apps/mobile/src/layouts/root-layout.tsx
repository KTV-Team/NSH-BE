import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold } from '@expo-google-fonts/noto-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { LoadingScreen } from '@/components/common/loading-screen';
import { ToastProvider } from '@/components/common/toast-provider';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { NotificationRuntimeProvider } from '@/notifications/notification-runtime';
import { styles } from './root-layout.styles';

void SplashScreen.preventAutoHideAsync();
function RootNavigator() {
  const { session, loading } = useAuth();
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  if (loading)
    return <LoadingScreen title="Đang khôi phục phiên đăng nhập…" />;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: styles.screenContent }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="create-notification" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="account" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="user-search" />
          <Stack.Screen name="notification-target" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
export default function RootLayout() {
  const [loaded, error] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
  });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationRuntimeProvider>
              <RootNavigator />
            </NotificationRuntimeProvider>
          </AuthProvider>
        </ToastProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
