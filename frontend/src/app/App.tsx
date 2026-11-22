import { Lora_500Medium } from '@expo-google-fonts/lora/500Medium';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_400Regular_Italic } from '@expo-google-fonts/public-sans/400Regular_Italic';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { PublicSans_700Bold } from '@expo-google-fonts/public-sans/700Bold';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '../shared/components/Overlay';
import { CatalogLocalProvider } from '../shared/state/CatalogLocalProvider';
import { ConnectivityProvider } from '../shared/state/ConnectivityProvider';
import { PreferencesUiProvider } from '../shared/state/PreferencesUiProvider';
import { SessionProvider, useSession } from '../shared/state/SessionProvider';
import { OfflineDataProvider } from '../shared/sync/OfflineDataProvider';
import { colors } from '../shared/theme';
import { LaunchSplash } from './LaunchSplash';
import { RootNavigator } from './navigation/RootNavigator';

void SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.canvas, card: colors.neutralWhite, text: colors.labelPrimary, primary: colors.brandGreen },
};

function AppContent() {
  const { ready } = useSession();
  const [launched, setLaunched] = useState(false);
  const finishLaunch = useCallback(() => setLaunched(true), []);
  const [fontsLoaded, fontError] = useFonts({
    Lora_500Medium,
    PublicSans_400Regular,
    PublicSans_600SemiBold,
    PublicSans_400Regular_Italic,
    PublicSans_700Bold,
  });
  const canRender = ready && (fontsLoaded || !!fontError);

  return (
    <View style={styles.root}>
      {canRender ? (
        <View
          style={styles.content}
          pointerEvents={launched ? 'auto' : 'none'}
          accessibilityElementsHidden={!launched}
          importantForAccessibility={launched ? 'auto' : 'no-hide-descendants'}
        >
          <UserData />
        </View>
      ) : null}
      {!launched ? <LaunchSplash ready={canRender} onFinish={finishLaunch} /> : null}
    </View>
  );
}

function UserData() {
  const { user } = useSession();
  return (
    <OfflineDataProvider key={user?.id ?? 'visitor'}>
      <CatalogLocalProvider>
        <ToastProvider>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </ToastProvider>
      </CatalogLocalProvider>
    </OfflineDataProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ConnectivityProvider>
        <SessionProvider>
          <PreferencesUiProvider>
            <AppContent />
          </PreferencesUiProvider>
        </SessionProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutralWhite },
  content: { flex: 1 },
});
