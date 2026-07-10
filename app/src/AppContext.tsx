// App-wide context: configs (fetched at session start, cached, bundled
// fallback), the authenticated (anonymous) user id, and the device UUID.
import React, { createContext, useContext } from "react";

import type { FlowConfig } from "./engine/types";

export interface AppContextValue {
  tree: FlowConfig;
  onboarding: FlowConfig;
  userId: string | null; // null = offline/unauthenticated; queue holds writes
  deviceUuid: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  value,
  children,
}: {
  value: AppContextValue;
  children: React.ReactNode;
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}
