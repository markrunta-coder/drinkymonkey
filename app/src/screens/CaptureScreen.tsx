// Capture flow — all four entry paths on one screen, driven entirely by the
// config through the pure engine:
//   * live urge (E1): one tap opens the arc; entry chips; app backs off
//   * log -> drank / resisted / delayed: floor first, then invited moments
//   * delayed -> D1 inline (spawn rule); drank_anyway redirects into the
//     drank floor (+QTY); still_deciding keeps the arc open
// Persistence: write-through draft (survives app kill) + offline queue sync
// on EVERY answer; canonical (arc_id, node_id) upsert semantics server-side.
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../AppContext";
import {
  answeredComplete,
  effOutcome,
  floorMet,
  rawOutcome,
  requiredIds,
  stillDeciding,
} from "../engine/engine";
import {
  answerChip,
  blankSession,
  mergeAnswer,
  presetSession,
  setJournal,
  skipNodes,
  syncArc,
} from "../engine/session";
import type { Answers, SessionState } from "../engine/types";
import { arcRowFromSession, syncSession } from "../lib/arcSync";
import { fetchAnswers } from "../lib/db";
import { clearDraft, loadDraft, saveDraft } from "../lib/draft";
import { arcNeedsNudge, cancelNudge, scheduleNudgeIfNeeded } from "../lib/nudge";
import { flush } from "../lib/queue";
import type { RootStackParamList } from "../navigation";
import { FloorMeter, MomentBlock, NodeCard, TagRow } from "../ui/FlowRenderer";
import { colors } from "../ui/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Capture">;

const MOMENT_ORDER = ["before", "fight", "after", "metrics"] as const;

export default function CaptureScreen({ route, navigation }: Props) {
  const { tree, userId } = useApp();
  const [arcId, setArcId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const prevAnswersRef = useRef<Answers>({});

  // ---------------------------------------------------------------- mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = route.params;
      if ("resumeDraft" in params) {
        const draft = await loadDraft();
        if (!cancelled && draft) {
          prevAnswersRef.current = draft.session.arc.answers;
          setArcId(draft.arcId);
          setSession(draft.session);
          return;
        }
        if (!cancelled) navigation.goBack();
        return;
      }
      if ("reopenArcId" in params) {
        // Reopening = the same arc, answers upsert anytime (spec: arcs reopenable).
        try {
          const rows = await fetchAnswers(params.reopenArcId);
          if (cancelled) return;
          const answers: Answers = {};
          for (const r of rows) answers[r.node_id] = r.value;
          let s = blankSession(tree);
          s = {
            ...s,
            mode: "log",
            liveOpen: true,
            arc: {
              ...s.arc,
              entry: answers.E1 ? "urge_now" : "retrospective",
              answers,
            },
          };
          s = syncArc(tree, s);
          prevAnswersRef.current = answers;
          setArcId(params.reopenArcId);
          setSession(s);
        } catch {
          if (!cancelled) navigation.goBack(); // offline and not cached — nothing to render
        }
        return;
      }
      // fresh arc — live urge or retrospective log
      const id = Crypto.randomUUID();
      const s =
        params.start === "live"
          ? presetSession(tree, "live", new Date().toISOString())
          : (() => {
              let base = blankSession(tree);
              base = { ...base, mode: "log", arc: { ...base.arc, entry: "retrospective" } };
              return syncArc(tree, base);
            })();
      if (cancelled) return;
      prevAnswersRef.current = {};
      setArcId(id);
      setSession(s);
      if (userId) {
        // live urge persists immediately — one tap IS a complete entry
        void syncSession(id, userId, {}, s).then(() => {
          prevAnswersRef.current = s.arc.answers;
        });
        if (params.start === "live") {
          void scheduleNudgeIfNeeded(tree, arcRowFromSession(id, userId, s), s.arc.answers);
        }
      }
      void saveDraft({ arcId: id, session: s, updatedAt: new Date().toISOString() });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------- mutation
  const apply = useCallback(
    (next: SessionState) => {
      setSession(next);
      if (!arcId) return;
      // write-through: draft survives app kill; queue syncs when network allows
      void saveDraft({ arcId, session: next, updatedAt: new Date().toISOString() });
      if (userId) {
        const prev = prevAnswersRef.current;
        prevAnswersRef.current = next.arc.answers;
        void syncSession(arcId, userId, prev, next);
      }
    },
    [arcId, userId]
  );

  const cb = {
    onChip: (id: string, v: string) => session && apply(answerChip(tree, session, id, v)),
    onMerge: (id: string, patch: Record<string, unknown>) =>
      session && apply(mergeAnswer(tree, session, id, patch)),
    onSkip: (ids: string) => session && apply(skipNodes(tree, session, ids)),
    onJournal: (moment: string, text: string) =>
      session && apply(setJournal(session, moment, text)),
    onMore: (moment: string) =>
      session && setSession({ ...session, moreShown: { ...session.moreShown, [moment]: true } }),
  };

  // ----------------------------------------------------------------- exit
  const finish = useCallback(async () => {
    if (!session || !arcId) return;
    if (userId) {
      const arcRow = arcRowFromSession(arcId, userId, session);
      if (arcNeedsNudge(tree, arcRow, session.arc.answers)) {
        // open arc, or drank arc missing its after moment: schedule the single
        // morning nudge (scheduleNudgeIfNeeded honors nudged_at — one EVER)
        await scheduleNudgeIfNeeded(tree, arcRow, session.arc.answers);
      } else {
        // resolved: stop a pending delivery; nudged_at stays set forever
        await cancelNudge(arcId);
      }
      await flush();
    }
    await clearDraft();
    navigation.popToTop();
  }, [session, arcId, userId, tree, navigation]);

  if (!session) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.sage} />
      </View>
    );
  }

  const answers = session.arc.answers;
  const met = floorMet(tree, answers);
  const deciding = stillDeciding(answers);

  // ---------------------------------------------------------- live capture
  if (session.mode === "live" && !session.liveOpen) {
    const chips = tree.branches.live?.entry_chips ?? [];
    return (
      <ScrollView style={st.screen} contentContainerStyle={st.content}>
        <Text style={st.eyebrow}>Logged · {session.arc.urge_at ?? ""}</Text>
        <Text style={st.quiet}>
          Got it. That&apos;s enough — this counts. Add a detail if you want, or just close the
          app.
        </Text>
        <MomentBlock
          momentKey="before"
          ids={chips}
          eff={null}
          config={tree}
          session={session}
          cb={cb}
        />
        <Text style={st.quiet}>
          The arc stays open. Whenever you&apos;re ready — tonight, tomorrow morning — pick it back
          up and say how it ended.
        </Text>
        <Pressable
          style={st.bigBtn}
          onPress={() => setSession({ ...session, liveOpen: true, mode: "log" })}
        >
          <Text style={st.bigBtnText}>Pick it back up →</Text>
        </Pressable>
        <Pressable style={[st.bigBtn, st.bigBtnPrimary]} onPress={finish}>
          <Text style={[st.bigBtnText, st.bigBtnTextPrimary]}>Done — close for now</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --------------------------------------------------- still deciding view
  if (deciding) {
    const before = tree.branches.delayed?.cards?.before ?? [];
    return (
      <ScrollView style={st.screen} contentContainerStyle={st.content}>
        <FloorMeter config={tree} session={session} />
        <NodeCard ids={["O1"]} config={tree} session={session} cb={cb} />
        <Text style={st.voice}>Okay — still deciding.</Text>
        <Text style={st.quiet}>
          The arc stays open. No pressure either way; come back when it&apos;s settled.
        </Text>
        <MomentBlock
          momentKey="before"
          ids={before}
          eff={null}
          config={tree}
          session={session}
          cb={cb}
        />
        <TagRow tags={session.arc.tags} />
        <Pressable style={[st.bigBtn, st.bigBtnPrimary]} onPress={finish}>
          <Text style={[st.bigBtnText, st.bigBtnTextPrimary]}>Keep it open — done for now</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // -------------------------------- retrospective: floor first, then depth
  const floorCards: string[] = [];
  for (const id of requiredIds(tree, answers)) {
    // O1's spawn rule renders D1 inline, so skip D1 here to avoid doubling.
    if (id === "D1" && rawOutcome(answers) === "delayed") {
      if (!answeredComplete(tree, answers, "O1")) break;
      continue;
    }
    floorCards.push(id);
    if (!answeredComplete(tree, answers, id)) break;
  }
  const eff = effOutcome(answers);
  const cards = eff && met ? (tree.branches[eff]?.cards ?? {}) : {};

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <FloorMeter config={tree} session={session} />
      <View style={{ marginTop: 12 }}>
        {floorCards.map((id) => (
          <NodeCard key={id} ids={[id]} config={tree} session={session} cb={cb} />
        ))}
      </View>
      {MOMENT_ORDER.map((m) =>
        cards[m]?.length ? (
          <MomentBlock
            key={m}
            momentKey={m}
            ids={cards[m]!}
            eff={eff}
            config={tree}
            session={session}
            cb={cb}
          />
        ) : null
      )}
      <TagRow tags={session.arc.tags} />
      <Pressable
        style={[st.bigBtn, st.bigBtnPrimary, !met && st.bigBtnDisabled]}
        disabled={!met}
        onPress={finish}
      >
        <Text style={[st.bigBtnText, st.bigBtnTextPrimary]}>
          {met ? "Save incident" : "Save unlocks at the floor"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.sub,
    marginTop: 8,
  },
  quiet: { color: colors.sub, fontSize: 13, lineHeight: 19, marginVertical: 12 },
  voice: { fontSize: 18, fontWeight: "500", color: colors.text, marginTop: 18, textAlign: "center" },
  bigBtn: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    marginTop: 12,
    alignItems: "center",
  },
  bigBtnPrimary: { backgroundColor: colors.sage, borderColor: colors.sage },
  bigBtnDisabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  bigBtnText: { fontSize: 15, fontWeight: "600", color: colors.text },
  bigBtnTextPrimary: { color: "#fff" },
});
