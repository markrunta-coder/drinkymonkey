// Supabase client — the ONLY network boundary of the app.
// Architecture ruling (docs/Drinkchart_Tech_Stack.md): client -> Supabase
// direct, under RLS. No API tier, no service-role key anywhere in the app.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

// Config comes from .env via Expo's EXPO_PUBLIC_* inlining (preferred; see
// .env.example). The fallbacks are the publishable values for the shared
// momentum_engine project — safe to commit (everything is behind RLS), but
// env wins so a key rotation never requires a code change.
const FALLBACK_URL = "https://uofnnmixmjqhoumbbcfe.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_5wCY7E7R7cnqFaeOv9MWMg_Hywh0NuJ";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? FALLBACK_URL;
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage, // session survives app kill; anonymous identity is precious
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no web OAuth redirects in this app
  },
});
