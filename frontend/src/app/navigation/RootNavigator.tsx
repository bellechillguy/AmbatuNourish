import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useSession } from '../../shared/state/SessionProvider';
import { colors } from '../../shared/theme';
import {
  ForgotPasswordScreen,
  LoginScreen,
  RegisterScreen,
  RegisterSuccessScreen,
  ResetLinkSentScreen,
  WelcomeScreen,
} from '../../features/identity/screens';
import { HomeScreen } from '../../features/home/HomeScreen';
import {
  CameraDeniedScreen,
  CameraPermissionScreen,
  LookupScreen,
  ProductNotFoundScreen,
  ScannerScreen,
} from '../../features/scanner/screens';
import { ProductSearchScreen } from '../../features/food-catalog/ProductSearchScreen';
import { SearchResultsScreen } from '../../features/food-catalog/SearchResultsScreen';
import { ProductDetailScreen } from '../../features/food-catalog/ProductDetailScreen';
import { ManualProductFormScreen, ManualProductReviewScreen } from '../../features/food-catalog/ManualProductScreens';
import { AssessmentResultScreen } from '../../features/nutritional-assessment/AssessmentResultScreen';
import { CompareScreen } from '../../features/nutritional-assessment/CompareScreen';
import {
  NutritionPlanScreen,
  PreferenceEditScreen,
  PreferencesScreen,
  SourceConflictScreen,
} from '../../features/nutritional-assessment/PreferenceScreens';
import { PlanHomeScreen } from '../../features/meal-planning/PlanHomeScreen';
import { FavoriteDetailScreen, FavoriteEditScreen } from '../../features/meal-planning/FavoriteScreens';
import { PlanDetailScreen } from '../../features/meal-planning/PlanDetailScreen';
import {
  LocationPermissionScreen,
  ManualLocationScreen,
  RestaurantResultsScreen,
} from '../../features/restaurant/screens';
import { LogFormScreen, LogSourceScreen } from '../../features/consumption-history/LogScreens';
import { SummaryHomeScreen } from '../../features/consumption-history/SummaryHomeScreen';
import {
  AboutScreen,
  AccessibilitySettingsScreen,
  EditProfileScreen,
  ProfileScreen,
} from '../../features/profile/screens';
import { SyncStatusScreen } from '../../features/sync/SyncStatusScreen';
import { TabBar } from './TabBar';
import type {
  HomeStackParamList,
  PlanStackParamList,
  ProductStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  SummaryStackParamList,
  TabParamList,
} from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ProductStack = createNativeStackNavigator<ProductStackParamList>();
const PlanStack = createNativeStackNavigator<PlanStackParamList>();
const SummaryStack = createNativeStackNavigator<SummaryStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const stackOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.neutralWhite },
  animation: 'slide_from_right' as const,
};

function HomeTab() {
  return (
    <HomeStack.Navigator screenOptions={stackOptions}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
    </HomeStack.Navigator>
  );
}

function ProductTab() {
  return (
    <ProductStack.Navigator screenOptions={stackOptions}>
      <ProductStack.Screen name="ProductSearch" component={ProductSearchScreen} />
      <ProductStack.Screen name="SearchResults" component={SearchResultsScreen} />
      <ProductStack.Screen name="Compare" component={CompareScreen} />
    </ProductStack.Navigator>
  );
}

function PlanTab() {
  return (
    <PlanStack.Navigator screenOptions={stackOptions}>
      <PlanStack.Screen name="PlanHome" component={PlanHomeScreen} />
    </PlanStack.Navigator>
  );
}

function SummaryTab() {
  return (
    <SummaryStack.Navigator screenOptions={stackOptions}>
      <SummaryStack.Screen name="SummaryHome" component={SummaryHomeScreen} />
    </SummaryStack.Navigator>
  );
}

function ProfileTab() {
  return (
    <ProfileStack.Navigator screenOptions={stackOptions}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="Preferences" component={PreferencesScreen} />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="HomeTab" component={HomeTab} />
      <Tabs.Screen name="ProductTab" component={ProductTab} />
      <Tabs.Screen name="PlanTab" component={PlanTab} />
      <Tabs.Screen name="SummaryTab" component={SummaryTab} />
      <Tabs.Screen name="ProfileTab" component={ProfileTab} />
    </Tabs.Navigator>
  );
}

const modal = { presentation: 'fullScreenModal' as const, animation: 'slide_from_bottom' as const };

export function RootNavigator() {
  const { session, justRegistered } = useSession();

  return (
    <Root.Navigator screenOptions={stackOptions}>
      {!session ? (
        <Root.Group>
          <Root.Screen name="Welcome" component={WelcomeScreen} />
          <Root.Screen name="Register" component={RegisterScreen} />
          <Root.Screen name="Login" component={LoginScreen} />
          <Root.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Root.Screen name="ResetLinkSent" component={ResetLinkSentScreen} />
        </Root.Group>
      ) : (
        <>
          <Root.Group>
            {justRegistered ? <Root.Screen name="RegisterSuccess" component={RegisterSuccessScreen} /> : null}
            <Root.Screen name="Main" component={MainTabs} />
            <Root.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Root.Screen name="AssessmentResult" component={AssessmentResultScreen} />
            <Root.Screen name="NutritionPlan" component={NutritionPlanScreen} />
            <Root.Screen name="SourceConflict" component={SourceConflictScreen} />
            <Root.Screen name="FavoriteDetail" component={FavoriteDetailScreen} />
            <Root.Screen name="PlanDetail" component={PlanDetailScreen} />
            <Root.Screen name="ManualLocation" component={ManualLocationScreen} />
            <Root.Screen name="RestaurantResults" component={RestaurantResultsScreen} />
            <Root.Screen name="AccessibilitySettings" component={AccessibilitySettingsScreen} />
            <Root.Screen name="About" component={AboutScreen} />
            <Root.Screen name="SyncStatus" component={SyncStatusScreen} />
            <Root.Screen name="Lookup" component={LookupScreen} />
            <Root.Screen name="ProductNotFound" component={ProductNotFoundScreen} />
            <Root.Screen name="ManualProductReview" component={ManualProductReviewScreen} />
          </Root.Group>
          <Root.Group screenOptions={modal}>
            <Root.Screen name="CameraPermission" component={CameraPermissionScreen} />
            <Root.Screen name="Scanner" component={ScannerScreen} options={{ contentStyle: { backgroundColor: colors.neutralBlack } }} />
            <Root.Screen name="CameraDenied" component={CameraDeniedScreen} />
            <Root.Screen name="ManualProductForm" component={ManualProductFormScreen} />
            <Root.Screen name="PreferenceEdit" component={PreferenceEditScreen} />
            <Root.Screen name="FavoriteEdit" component={FavoriteEditScreen} />
            <Root.Screen name="LocationPermission" component={LocationPermissionScreen} />
            <Root.Screen name="LogSource" component={LogSourceScreen} />
            <Root.Screen name="LogForm" component={LogFormScreen} />
            <Root.Screen name="EditProfile" component={EditProfileScreen} />
          </Root.Group>
        </>
      )}
    </Root.Navigator>
  );
}
