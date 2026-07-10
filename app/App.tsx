// Drinkchart — app root. Bootstrap order:
//   1. anonymous session (signInAnonymously on first launch; persisted after)
//   2. device UUID (Keychain via expo-secure-store; survives reinstall)
//   3. configs (latest from dc_tree_versions/dc_onboarding_versions ->
//      AsyncStorage cache -> bundled fallback)
//   4. route: no profile row -> Onboarding, else Home
// Deterministic throughout; no AI calls anywhere.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AppProvider, type AppContextValue } from "./src/AppContext";
import { ensureSession, getDeviceUuid } from "./src/lib/auth";
import { loadConfigs } from "./src/lib/configStore";
import { fetchProfile } from "./src/lib/db";
import { flush } from "./src/lib/queue";
import type { RootStackParamList } from "./src/navigation";
import CaptureScreen from "./src/screens/CaptureScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import HomeScreen from "./src/screens/HomeScreen";
import OnboardingScreen, { ONBOARDED_FLAG } from "./src/screens/OnboardingScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { colors } from "./src/ui/theme";

// The morning nudge should present even with the app foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Boot {
  ctx: AppContextValue;
  onboarded: boolean;
}

export default function App() {
  const [boot, setBoot] = useState<Boot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await ensureSession();
      const deviceUuid = await getDeviceUuid();
      const { tree, onboarding } = await loadConfigs();
      const userId = session?.user.id ?? null;
      let onboarded = (await AsyncStorage.getItem(ONBOARDED_FLAG).catch(() => null)) === "1";
      if (userId) {
        try {
          const profile = await fetchProfile(userId);
          onboarded = !!profile; // the profile row is the routing truth
          if (profile) await AsyncStorage.setItem(ONBOARDED_FLAG, "1").catch(() => {});
        } catch {
          // offline: fall back to the local flag
        }
        void flush(); // drain anything queued from a previous offline session
      }
      if (!cancelled) {
        setBoot({ ctx: { tree, onboarding, userId, deviceUuid }, onboarded });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!boot) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.sage} size="large" />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <AppProvider value={boot.ctx}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={boot.onboarded ? "Home" : "Onboarding"}
          screenOptions={{
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ title: "drinkchart", headerBackVisible: false }}
          />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "drinkchart" }} />
          <Stack.Screen name="Capture" component={CaptureScreen} options={{ title: "" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </AppProvider>
  );
}

const st = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
});
