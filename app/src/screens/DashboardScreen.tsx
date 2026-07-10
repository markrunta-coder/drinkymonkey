// Dashboard stub — Phase 3 renders metrics from the dc_arcs_for_metrics view.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../ui/theme";

export default function DashboardScreen() {
  return (
    <View style={st.screen}>
      <Text style={st.voice}>Dashboard</Text>
      <Text style={st.quiet}>
        Coming in Phase 3: consumption metrics, the resisted-vs-drank record, delay success, and
        trend surfaces — all computed from your own entries (dc_arcs_for_metrics). Nothing here is
        AI; nothing leaves our stack.
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 40 },
  voice: { fontSize: 20, fontWeight: "500", color: colors.text, marginBottom: 10 },
  quiet: { color: colors.sub, fontSize: 13, lineHeight: 20 },
});
