// Onboarding — the SAME generic renderer over config/onboarding.v1.json
// (a linear flow). On finish: AUDIT-C score + screen band computed by the
// engine (thresholds read from the CONFIG, never code), persisted to
// dc_profiles (incl. onboarding_version + device_uuid); the goal lands in
// dc_goals via the end-active-then-insert pattern.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { useApp } from "../AppContext";
import { floorMet, groupIds, nodeById, scoreInstruments } from "../engine/engine";
import { answerChip, blankSession, mergeAnswer, setJournal, skipNodes } from "../engine/session";
import type { SessionState } from "../engine/types";
import type { ProfileRow } from "../lib/db";
import { enqueue, flush } from "../lib/queue";
import type { RootStackParamList } from "../navigation";
import { FloorMeter, NodeCard, momentTitle } from "../ui/FlowRenderer";
import { colors } from "../ui/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export const ONBOARDED_FLAG = "dc_onboarded";

export default function OnboardingScreen({ navigation }: Props) {
  const { onboarding, userId, deviceUuid } = useApp();
  const [session, setSession] = useState<SessionState>(() => blankSession(onboarding));
  const [saving, setSaving] = useState(false);

  const cb = {
    onChip: (id: string, v: string) => setSession((s) => answerChip(onboarding, s, id, v)),
    onMerge: (id: string, patch: Record<string, unknown>) =>
      setSession((s) => mergeAnswer(onboarding, s, id, patch)),
    onSkip: (ids: string) => setSession((s) => skipNodes(onboarding, s, ids)),
    onJournal: (moment: string, text: string) => setSession((s) => setJournal(s, moment, text)),
    onMore: (_moment: string) => {}, // linear flows show every card — no cap
  };

  const met = floorMet(onboarding, session.arc.answers);

  const finish = async () => {
    if (!met || saving) return;
    setSaving(true);
    const answers = session.arc.answers;
    const auditC = scoreInstruments(onboarding, answers).find((i) => i.name === "audit_c");
    const goalType = answers.GOAL?.value ?? "understand_my_drinking";
    if (userId && auditC) {
      const profile: ProfileRow = {
        user_id: userId,
        age_band: answers.AGE?.value ?? "",
        gender: answers.GEN?.value ?? null,
        drinks_week_band: answers.DWK?.value ?? "",
        drinking_since: answers.SINCE?.value ?? null,
        audit_c_score: auditC.score,
        screen_band: auditC.band, // clean band; provisional-ness lives in the config
        device_uuid: deviceUuid,
        onboarding_version: onboarding.tree_version,
      };
      await enqueue(
        { kind: "profile_upsert", row: profile },
        { kind: "goal_set", user_id: userId, goal_type: goalType }
      );
      await flush();
    }
    await AsyncStorage.setItem(ONBOARDED_FLAG, "1").catch(() => {});
    setSaving(false);
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  };

  // Linear flows render the whole sequence (no 3-card cap), grouped under
  // moment eyebrows — parity with the reference harness.
  const seq = onboarding.branches.main?.sequence ?? [];
  const blocks: { moment: string; groups: string[][] }[] = [];
  for (const g of groupIds(onboarding, seq)) {
    const m = nodeById(onboarding, g.ids[0])?.moment ?? "profile";
    const last = blocks[blocks.length - 1];
    if (last && last.moment === m) last.groups.push(g.ids);
    else blocks.push({ moment: m, groups: [g.ids] });
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <Text style={st.voice}>A few questions to set the mirror up.</Text>
      <FloorMeter config={onboarding} session={session} />
      {blocks.map((b) => (
        <React.Fragment key={b.moment}>
          <Text style={st.eyebrow}>{momentTitle(b.moment, null)}</Text>
          {b.groups.map((ids) => (
            <NodeCard key={ids.join("+")} ids={ids} config={onboarding} session={session} cb={cb} />
          ))}
        </React.Fragment>
      ))}
      <Pressable
        style={[st.save, !met && st.saveDisabled]}
        disabled={!met || saving}
        onPress={finish}
      >
        <Text style={st.saveText}>{met ? "Finish" : "A few required answers to go"}</Text>
      </Pressable>
      <Text style={st.quiet}>
        No verdict — this just sets the mirror up. You can change any of it later. Screening
        thresholds are provisional pending clinical review.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 40 },
  voice: { fontSize: 20, fontWeight: "500", color: colors.text, marginTop: 16 },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.sub,
    marginTop: 22,
    marginBottom: 8,
  },
  save: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.sage,
    alignItems: "center",
    marginTop: 22,
  },
  saveDisabled: { backgroundColor: colors.disabled },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  quiet: { color: colors.sub, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
