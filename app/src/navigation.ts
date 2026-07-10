// Navigation decision (documented in app/README.md): @react-navigation
// native-stack, hand-rolled from the blank template — expo-router's
// file-based routing buys little for four screens and keeps the renderer
// decoupled from the filesystem.
export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Capture: { start: "live" | "log" } | { reopenArcId: string } | { resumeDraft: true };
  Settings: undefined;
  Dashboard: undefined;
};
