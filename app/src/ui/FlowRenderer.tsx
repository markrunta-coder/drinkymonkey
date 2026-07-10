// Generic config-driven renderer — React Native port of the reference
// harness (tools/preview.html). Renders ANY valid flow config with no
// per-question code: floor meter, spawn rules (then_node inline), 3-card cap
// with "+ more", skip semantics, card_group, allow_secondary,
// allow_free_text, requires_text/number/datetime, default_value, tag display.
// ALL logic decisions come from src/engine (pure); this file is presentation.
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  CARD_CAP,
  answeredComplete,
  answerHasValue,
  floorMet,
  groupIds,
  nodeById,
  requiredIds,
  selectedOption,
  stillDeciding,
  type CardGroup,
} from "../engine/engine";
import type { ConfigNode, FlowConfig, SessionState } from "../engine/types";
import { colors } from "./theme";

export interface RendererCallbacks {
  onChip: (nodeId: string, value: string) => void;
  onMerge: (nodeId: string, patch: Record<string, unknown>) => void;
  onSkip: (ids: string) => void;
  onJournal: (moment: string, text: string) => void;
  onMore: (moment: string) => void;
}

const MOMENT_TITLES: Record<string, (eff: string | null) => string> = {
  before: () => "Before — what was true",
  fight: () => "The fight",
  after: (eff) => (eff === "drank" ? "After — the verdict (now or tomorrow)" : "After"),
  metrics: () => "Details — if useful",
  profile: () => "About you",
  audit: () => "The standard three questions (AUDIT-C)",
  goal: () => "Your goal",
};

export function momentTitle(moment: string, eff: string | null): string {
  return MOMENT_TITLES[moment] ? MOMENT_TITLES[moment](eff) : moment;
}

// ------------------------------------------------------------------ floor

export function FloorMeter({ config, session }: { config: FlowConfig; session: SessionState }) {
  const answers = session.arc.answers;
  const req = requiredIds(config, answers);
  const done = req.filter((id) => answeredComplete(config, answers, id)).length;
  const met = floorMet(config, answers);
  const isLinear = config.flow === "linear";
  const preset = isLinear
    ? req.filter((id) => nodeById(config, id)?.default_value !== undefined).length
    : 0;
  const label = stillDeciding(answers)
    ? "still deciding — the arc stays open"
    : met
      ? isLinear
        ? `Ready · ${req.length - preset} taps${preset ? " (goal preselected)" : ""} ✓`
        : `Floor reached · ${req.length} taps ✓`
      : `${done}/${req.length} required — everything else is optional`;
  return (
    <View style={st.floorRow}>
      <View style={st.segs}>
        {req.map((id, i) => (
          <View key={id} style={[st.seg, i < done && st.segOn]} />
        ))}
      </View>
      <Text style={[st.floorLbl, met && st.floorLblMet]}>{label}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ chips

function ChipRow({
  node,
  session,
  cb,
}: {
  node: ConfigNode;
  session: SessionState;
  cb: RendererCallbacks;
}) {
  const a = session.arc.answers[node.id] ?? {};
  return (
    <View style={st.chips}>
      {(node.options ?? []).map((o) => {
        const isSel =
          node.input_type === "multi" ? (a.values ?? []).includes(o.value) : a.value === o.value;
        const isSec = a.secondary === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => cb.onChip(node.id, o.value)}
            style={[st.chip, isSel && st.chipSel, isSec && st.chipSec]}
            accessibilityRole="button"
          >
            <Text style={[st.chipText, (isSel || isSec) && st.chipTextSel]}>
              {o.label}
              {isSec ? " · also" : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Extras({
  node,
  session,
  cb,
}: {
  node: ConfigNode;
  session: SessionState;
  cb: RendererCallbacks;
}) {
  const a = session.arc.answers[node.id] ?? {};
  const opt = a.value !== undefined ? selectedOption(node, a) : undefined;
  return (
    <View>
      {opt?.requires_number ? (
        <View style={st.extraRow}>
          <Text style={st.hint}>exactly</Text>
          <TextInput
            style={st.numberInput}
            keyboardType="number-pad"
            value={a.number !== undefined ? String(a.number) : ""}
            onChangeText={(t) => cb.onMerge(node.id, { number: t === "" ? null : Number(t) })}
          />
          <Text style={st.hint}>drinks</Text>
        </View>
      ) : null}
      {opt?.requires_datetime ? (
        <TextInput
          style={st.textInput}
          placeholder="YYYY-MM-DDTHH:MM (date & time)"
          placeholderTextColor={colors.sub}
          value={a.datetime ?? ""}
          onChangeText={(t) => cb.onMerge(node.id, { datetime: t })}
        />
      ) : null}
      {opt?.requires_text || node.allow_free_text ? (
        <TextInput
          style={st.textInput}
          placeholder="in your own words…"
          placeholderTextColor={colors.sub}
          value={a.text ?? ""}
          onChangeText={(t) => cb.onMerge(node.id, { text: t })}
        />
      ) : null}
      {node.allow_secondary ? (
        <Text style={st.hint}>
          {a.value
            ? a.secondary
              ? "primary + secondary set — tap to change"
              : "tap another to add a secondary (optional)"
            : "pick the main one — you can add a second"}
        </Text>
      ) : null}
    </View>
  );
}

function NodeBody({
  node,
  session,
  cb,
}: {
  node: ConfigNode;
  session: SessionState;
  cb: RendererCallbacks;
}) {
  const a = session.arc.answers[node.id] ?? {};
  switch (node.input_type) {
    case "single":
    case "chips":
    case "multi":
      return (
        <View>
          <ChipRow node={node} session={session} cb={cb} />
          <Extras node={node} session={session} cb={cb} />
        </View>
      );
    case "number":
      return (
        <TextInput
          style={st.numberInput}
          keyboardType="number-pad"
          value={a.number !== undefined ? String(a.number) : ""}
          onChangeText={(t) => cb.onMerge(node.id, { number: t === "" ? null : Number(t) })}
        />
      );
    case "text":
      return (
        <TextInput
          style={[st.textInput, st.journal]}
          placeholder="Anything else, in your own words…"
          placeholderTextColor={colors.sub}
          multiline
          value={a.text ?? ""}
          onChangeText={(t) => cb.onMerge(node.id, { text: t })}
        />
      );
    default:
      // Forward-compatibility rule: hide nodes with unknown input types.
      return null;
  }
}

// ------------------------------------------------------------------- cards

/** One card = one node, or consecutive nodes sharing a card_group. Spawned nodes render inline after it. */
export function NodeCard({
  ids,
  config,
  session,
  cb,
}: {
  ids: string[];
  config: FlowConfig;
  session: SessionState;
  cb: RendererCallbacks;
}) {
  const nodes = ids.map((id) => nodeById(config, id)).filter((n): n is ConfigNode => !!n);
  if (!nodes.length) return null;
  const skippable = nodes.every((n) => !n.required);
  const skippedAll = nodes.every((n) => session.skipped[n.id]);
  const spawned = nodes.flatMap((n) =>
    (n.spawn_rules ?? [])
      .filter(
        (r) =>
          r.then_node &&
          (r.if_value === "*"
            ? !!session.arc.answers[n.id]
            : answerHasValue(session.arc.answers[n.id], r.if_value))
      )
      .map((r) => r.then_node!)
  );
  return (
    <View>
      <View style={[st.card, skippedAll && st.cardSkipped]}>
        {nodes.map((n) => (
          <View key={n.id}>
            <Text style={st.q}>{n.prompt}</Text>
            <NodeBody node={n} session={session} cb={cb} />
          </View>
        ))}
        {skippable ? (
          <Pressable onPress={() => cb.onSkip(ids.join(","))} accessibilityRole="button">
            <Text style={st.skip}>skip</Text>
          </Pressable>
        ) : null}
      </View>
      {spawned.map((id) => (
        <NodeCard key={id} ids={[id]} config={config} session={session} cb={cb} />
      ))}
    </View>
  );
}

// ----------------------------------------------------------------- moments

/** A moment's invited cards: max 3 shown, "+ N more" reveals the rest; free text per moment. */
export function MomentBlock({
  momentKey,
  ids,
  eff,
  config,
  session,
  cb,
}: {
  momentKey: string;
  ids: string[];
  eff: string | null;
  config: FlowConfig;
  session: SessionState;
  cb: RendererCallbacks;
}) {
  const groups: CardGroup[] = groupIds(config, ids);
  const shown = session.moreShown[momentKey] ? groups : groups.slice(0, CARD_CAP);
  const moreN = groups.length - CARD_CAP;
  const hasTextNode = ids.some((id) => nodeById(config, id)?.input_type === "text");
  return (
    <View style={st.moment}>
      <Text style={st.eyebrow}>{momentTitle(momentKey, eff)}</Text>
      {shown.map((g) => (
        <NodeCard key={g.ids.join("+")} ids={g.ids} config={config} session={session} cb={cb} />
      ))}
      {!session.moreShown[momentKey] && moreN > 0 ? (
        <Pressable style={st.more} onPress={() => cb.onMore(momentKey)} accessibilityRole="button">
          <Text style={st.moreText}>+ {moreN} more — only if you feel like it</Text>
        </Pressable>
      ) : null}
      {!hasTextNode ? (
        <TextInput
          style={[st.textInput, st.journal]}
          placeholder="Anything else, in your own words…"
          placeholderTextColor={colors.sub}
          multiline
          value={session.arc.journal[momentKey] ?? ""}
          onChangeText={(t) => cb.onJournal(momentKey, t)}
        />
      ) : null}
    </View>
  );
}

// -------------------------------------------------------------------- tags

export function TagRow({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <View style={st.tagRow}>
      {tags.map((t) => (
        <View key={t} style={st.tag}>
          <Text style={st.tagText}>● {t} — tagged, not judged</Text>
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ styles

const st = StyleSheet.create({
  floorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  segs: { flexDirection: "row", gap: 4 },
  seg: { width: 26, height: 5, borderRadius: 3, backgroundColor: colors.line },
  segOn: { backgroundColor: colors.sage },
  floorLbl: { fontSize: 11, color: colors.sub, flexShrink: 1 },
  floorLblMet: { color: colors.sage, fontWeight: "600" },

  moment: { marginTop: 22 },
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
    marginBottom: 10,
  },
  cardSkipped: { opacity: 0.45 },
  q: { fontSize: 15.5, fontWeight: "500", marginBottom: 10, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  chipSel: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  chipSec: { borderColor: colors.sage, borderStyle: "dashed" },
  chipText: { fontSize: 13, color: colors.text },
  chipTextSel: { color: "#2F4A3F", fontWeight: "500" },
  hint: { fontSize: 11, color: colors.sub, marginTop: 7 },
  skip: {
    color: colors.sub,
    fontSize: 12,
    marginTop: 9,
    textDecorationLine: "underline",
  },
  extraRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  numberInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: 84,
    color: colors.text,
    backgroundColor: colors.card,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 13,
    marginTop: 8,
    color: colors.text,
    backgroundColor: colors.card,
  },
  journal: { borderRadius: 12, minHeight: 54, textAlignVertical: "top" },
  more: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 12,
    padding: 9,
    marginBottom: 10,
    alignItems: "center",
  },
  moreText: { color: colors.sub, fontSize: 12.5 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 8 },
  tag: {
    backgroundColor: colors.amberSoft,
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  tagText: { color: colors.amberText, fontSize: 12, fontWeight: "500" },
});
