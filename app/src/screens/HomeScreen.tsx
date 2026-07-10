// Home skeleton (Brief 004: structure over polish): last incident summary
// (raw answers/tags), the two entry buttons, the open-arc list (reopen), a
// resumable draft, and a dashboard stub.
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../AppContext";
import {
  fetchAnswers,
  fetchLastCompleteArc,
  fetchOpenArcs,
  type AnswerRow,
  type ArcRow,
} from "../lib/db";
import { loadDraft, type CaptureDraft } from "../lib/draft";
import { flush, pendingCount } from "../lib/queue";
import type { RootStackParamList } from "../navigation";
import { TagRow } from "../ui/FlowRenderer";
import { colors } from "../ui/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { userId } = useApp();
  const [openArcs, setOpenArcs] = useState<ArcRow[]>([]);
  const [lastArc, setLastArc] = useState<ArcRow | null>(null);
  const [lastAnswers, setLastAnswers] = useState<AnswerRow[]>([]);
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [pending, setPending] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await flush(); // opportunistic offline-queue sync on every return home
        const d = await loadDraft();
        if (!cancelled) setDraft(d);
        if (!cancelled) setPending(await pendingCount());
        if (!userId) return;
        try {
          const [open, last] = await Promise.all([
            fetchOpenArcs(userId),
            fetchLastCompleteArc(userId),
          ]);
          if (cancelled) return;
          setOpenArcs(open);
          setLastArc(last);
          setLastAnswers(last ? await fetchAnswers(last.id) : []);
        } catch {
          // offline: keep whatever we had
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <Text style={st.voice}>What&apos;s happening?</Text>
      <Text style={st.sub}>One tap is a complete entry. Everything else is optional, always.</Text>

      <Pressable
        style={[st.bigBtn, st.bigBtnPrimary]}
        onPress={() => navigation.navigate("Capture", { start: "live" })}
      >
        <Text style={[st.bigBtnText, st.bigBtnTextPrimary]}>Urge right now</Text>
        <Text style={st.bigBtnSmallPrimary}>logs the moment — we&apos;ll leave you alone after</Text>
      </Pressable>
      <Pressable style={st.bigBtn} onPress={() => navigation.navigate("Capture", { start: "log" })}>
        <Text style={st.bigBtnText}>Log something</Text>
        <Text style={st.bigBtnSmall}>a drink, a win, a maybe — from today or before</Text>
      </Pressable>

      {draft ? (
        <Pressable
          style={st.row}
          onPress={() => navigation.navigate("Capture", { resumeDraft: true })}
        >
          <Text style={st.rowText}>Resume the entry you were in the middle of →</Text>
        </Pressable>
      ) : null}

      {openArcs.length > 0 ? (
        <View style={st.section}>
          <Text style={st.eyebrow}>Open arcs — pick one back up</Text>
          {openArcs.map((a) => (
            <Pressable
              key={a.id}
              style={st.row}
              onPress={() => navigation.navigate("Capture", { reopenArcId: a.id })}
            >
              <Text style={st.rowText}>
                {a.outcome ?? "urge"} · {a.occurred_at ? a.occurred_at.slice(0, 16) : "recent"}
                {a.tags.length ? ` · ${a.tags.join(", ")}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {lastArc ? (
        <View style={st.section}>
          <Text style={st.eyebrow}>Last incident</Text>
          <View style={st.card}>
            <Text style={st.rowText}>
              {lastArc.outcome ?? "—"} ·{" "}
              {lastArc.occurred_at ? lastArc.occurred_at.slice(0, 16) : "—"}
            </Text>
            <TagRow tags={lastArc.tags} />
            {lastAnswers.map((a) => (
              <Text key={a.node_id} style={st.answerLine}>
                {a.node_id}: {JSON.stringify(a.value)}
              </Text>
            ))}
            <Pressable onPress={() => navigation.navigate("Capture", { reopenArcId: lastArc.id })}>
              <Text style={st.link}>reopen — answers upsert anytime</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={st.section}>
        <Pressable style={st.row} onPress={() => navigation.navigate("Dashboard")}>
          <Text style={st.rowText}>Dashboard (coming in Phase 3) →</Text>
        </Pressable>
        <Pressable style={st.row} onPress={() => navigation.navigate("Settings")}>
          <Text style={st.rowText}>Settings →</Text>
        </Pressable>
        {pending > 0 ? (
          <Text style={st.pending}>{pending} change(s) queued — will sync when online</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 40 },
  voice: { fontSize: 22, fontWeight: "500", color: colors.text, marginTop: 24, textAlign: "center" },
  sub: { color: colors.sub, fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 24 },
  bigBtn: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    marginBottom: 12,
    alignItems: "center",
  },
  bigBtnPrimary: { backgroundColor: colors.sage, borderColor: colors.sage },
  bigBtnText: { fontSize: 15, fontWeight: "600", color: colors.text },
  bigBtnTextPrimary: { color: "#fff" },
  bigBtnSmall: { fontSize: 12, color: colors.sub, marginTop: 3 },
  bigBtnSmallPrimary: { fontSize: 12, color: "#DCE8E1", marginTop: 3 },
  section: { marginTop: 22 },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.sub,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
  },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowText: { fontSize: 13, color: colors.text },
  answerLine: { fontSize: 12, color: colors.sub, marginTop: 4, fontFamily: "monospace" },
  link: { fontSize: 12, color: colors.sage, marginTop: 10, textDecorationLine: "underline" },
  pending: { fontSize: 11, color: colors.amberText, marginTop: 6 },
});
