import {
  PublicSans_400Regular,
  PublicSans_400Regular_Italic,
  PublicSans_600SemiBold,
  PublicSans_600SemiBold_Italic,
  useFonts,
} from '@expo-google-fonts/public-sans';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
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
  colors: { ...DefaultTheme.colors, background: colors.neutralWhite, card: colors.neutralWhite, text: colors.labelPrimary, primary: colors.brandGreen },
};

function Gate() {
  const { ready } = useSession();
  // Public Sans dibundel identik untuk iOS & Android (handoff: FONT v2).
  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_600SemiBold,
    PublicSans_400Regular_Italic,
    PublicSans_600SemiBold_Italic,
  });

  useEffect(() => {
    if (ready && fontsLoaded) void SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  if (!ready || !fontsLoaded) return null;

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ConnectivityProvider>
        <SessionProvider>
          <PreferencesUiProvider>
            <OfflineDataProvider>
              <CatalogLocalProvider>
                <ToastProvider>
                  <Gate />
                </ToastProvider>
              </CatalogLocalProvider>
            </OfflineDataProvider>
          </PreferencesUiProvider>
        </SessionProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
  );
}
