// Settings — account-upgrade path STUBBED ONLY (Brief 004): the options are
// listed and disabled. Anonymous-first is the posture; upgrade ships when a
// user wants sync or backup, not before.
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../AppContext";
import { colors } from "../ui/theme";

export default function SettingsScreen() {
  const { userId, deviceUuid } = useApp();
  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <Text style={st.eyebrow}>Account</Text>
      <Text style={st.quiet}>
        You&apos;re using Drinkchart anonymously. Your entries are yours and stay behind your
        anonymous identity. Add a sign-in later if you ever want backup or a second device.
      </Text>
      <View style={[st.row, st.rowDisabled]}>
        <Text style={st.rowText}>Sign in with Apple</Text>
        <Text style={st.soon}>coming soon</Text>
      </View>
      <View style={[st.row, st.rowDisabled]}>
        <Text style={st.rowText}>Email magic link</Text>
        <Text style={st.soon}>coming soon</Text>
      </View>

      <Text style={st.eyebrow}>Diagnostics</Text>
      <View style={st.row}>
        <Text style={st.mono}>user: {userId ?? "offline — not signed in yet"}</Text>
        <Text style={st.mono}>device: {deviceUuid}</Text>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18 },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.sub,
    marginTop: 22,
    marginBottom: 8,
  },
  quiet: { color: colors.sub, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  rowDisabled: { opacity: 0.5 },
  rowText: { fontSize: 14, color: colors.text, fontWeight: "500" },
  soon: { fontSize: 12, color: colors.sub },
  mono: { fontSize: 11, color: colors.sub, fontFamily: "monospace" },
});
