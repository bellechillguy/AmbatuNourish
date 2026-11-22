import { Lora_500Medium } from '@expo-google-fonts/lora/500Medium';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_400Regular_Italic } from '@expo-google-fonts/public-sans/400Regular_Italic';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { PublicSans_700Bold } from '@expo-google-fonts/public-sans/700Bold';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '../shared/components/Overlay';
import { CatalogLocalProvider } from '../shared/state/CatalogLocalProvider';
import { ConnectivityProvider } from '../shared/state/ConnectivityProvider';
import { PreferencesUiProvider } from '../shared/state/PreferencesUiProvider';
import { SessionProvider, useSession } from '../shared/state/SessionProvider';
import { OfflineDataProvider } from '../shared/sync/OfflineDataProvider';
import { colors } from '../shared/theme';
import { RootNavigator } from './navigation/RootNavigator';

void SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.canvas, card: colors.neutralWhite, text: colors.labelPrimary, primary: colors.brandGreen },
};

function Gate() {
  const { ready } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    Lora_500Medium,
    PublicSans_400Regular,
    PublicSans_600SemiBold,
    PublicSans_400Regular_Italic,
    PublicSans_700Bold,
  });
  const canRender = ready && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (canRender) void SplashScreen.hideAsync();
  }, [canRender]);

  if (!canRender) return null;

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

function UserData() {
  const { user } = useSession();
  return (
    <OfflineDataProvider key={user?.id ?? 'visitor'}>
      <CatalogLocalProvider>
        <ToastProvider>
          <Gate />
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
            <UserData />
          </PreferencesUiProvider>
        </SessionProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
  );
}
