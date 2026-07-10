// RLS proof for the dc_ tables (Brief 004 deliverable 2: "RLS enabled and
// tested"). Creates two client sessions with the ANON key only (never
// service-role) and proves:
//   * user A can insert/select own dc_arcs / dc_answers / dc_profiles / dc_goals
//   * user B cannot see or modify A's rows
//   * both can read dc_tree_versions but cannot insert into it
//
// Identity: tries ANONYMOUS sign-in first (the app's auth posture). If the
// project has anonymous sign-ins disabled (dashboard setup step — see
// app/README.md), falls back to the two pre-provisioned email test users so
// the RLS semantics are still proven end-to-end. Override via env:
//   SUPABASE_URL, SUPABASE_ANON_KEY,
//   RLS_EMAIL_A / RLS_PASS_A / RLS_EMAIL_B / RLS_PASS_B
//
// Usage: cd app && npm run rls-check
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "https://uofnnmixmjqhoumbbcfe.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "sb_publishable_5wCY7E7R7cnqFaeOv9MWMg_Hywh0NuJ";

// Throwaway test identities on the dev project — no user data behind them.
const FALLBACK_USERS = {
  A: { email: "dc.rls.test.a@gmail.com", password: "rls-test-Passw0rd!" },
  B: { email: "dc.rls.test.b@gmail.com", password: "rls-test-Passw0rd!" },
};

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "ok " : "FAIL"} ${label}${cond || !detail ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
};

function newClient() {
  return createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(which) {
  const client = newClient();
  const anon = await client.auth.signInAnonymously();
  if (!anon.error) {
    console.log(`     user ${which}: anonymous session ${anon.data.user.id}`);
    return { client, userId: anon.data.user.id, mode: "anonymous" };
  }
  const creds = {
    A: {
      email: process.env.RLS_EMAIL_A ?? FALLBACK_USERS.A.email,
      password: process.env.RLS_PASS_A ?? FALLBACK_USERS.A.password,
    },
    B: {
      email: process.env.RLS_EMAIL_B ?? FALLBACK_USERS.B.email,
      password: process.env.RLS_PASS_B ?? FALLBACK_USERS.B.password,
    },
  }[which];
  const pw = await client.auth.signInWithPassword(creds);
  if (pw.error) {
    throw new Error(
      `no session for user ${which}: anonymous sign-in ${anon.error.message}; ` +
        `password sign-in ${pw.error.message}`
    );
  }
  console.log(
    `     user ${which}: anonymous disabled (${anon.error.message}); email session ${pw.data.user.id}`
  );
  return { client: client, userId: pw.data.user.id, mode: "email" };
}

const arcId = crypto.randomUUID();

async function cleanup(a, b) {
  // Owner-delete own test rows (also exercises RLS delete on own rows).
  await a.client.from("dc_arcs").delete().eq("user_id", a.userId);
  await a.client.from("dc_goals").delete().eq("user_id", a.userId);
  await a.client.from("dc_profiles").delete().eq("user_id", a.userId);
  await b.client.from("dc_arcs").delete().eq("user_id", b.userId);
}

async function main() {
  const a = await signIn("A");
  const b = await signIn("B");
  check("distinct users", a.userId !== b.userId);

  try {
    // ---------------- A owns and can write its rows ----------------
    const arcIns = await a.client.from("dc_arcs").insert({
      id: arcId,
      user_id: a.userId,
      tree_version: 1,
      outcome: "drank",
      status: "complete",
      tags: ["broke_own_rule"],
    });
    check("A inserts own dc_arcs row", !arcIns.error, arcIns.error?.message);

    const ansUp = await a.client
      .from("dc_answers")
      .upsert(
        { arc_id: arcId, node_id: "O1", tree_version: 1, value: { value: "drank" } },
        { onConflict: "arc_id,node_id" }
      );
    check("A upserts dc_answers (canonical onConflict)", !ansUp.error, ansUp.error?.message);

    const ansUp2 = await a.client
      .from("dc_answers")
      .upsert(
        { arc_id: arcId, node_id: "O1", tree_version: 1, value: { value: "resisted" } },
        { onConflict: "arc_id,node_id" }
      );
    check(
      "A re-upserts the same (arc,node) — reopen semantics",
      !ansUp2.error,
      ansUp2.error?.message
    );

    const profUp = await a.client.from("dc_profiles").upsert({
      user_id: a.userId,
      age_band: "25_39",
      gender: null,
      drinks_week_band: "8_14",
      audit_c_score: 5,
      screen_band: "elevated",
      device_uuid: "rls-check-device",
      onboarding_version: 1,
    });
    check("A upserts own dc_profiles row", !profUp.error, profUp.error?.message);

    await a.client.from("dc_goals").delete().eq("user_id", a.userId); // idempotent reruns
    const goalIns = await a.client
      .from("dc_goals")
      .insert({ user_id: a.userId, goal_type: "understand_my_drinking" });
    check("A inserts own dc_goals row", !goalIns.error, goalIns.error?.message);

    const own = await a.client.from("dc_arcs").select("id").eq("id", arcId);
    check("A selects own arc back", !own.error && own.data?.length === 1, own.error?.message);

    // ---------------- B cannot see or touch A's rows ----------------
    const bSel = await b.client.from("dc_arcs").select("id").eq("id", arcId);
    check("B cannot see A's arc (0 rows)", !bSel.error && bSel.data?.length === 0);

    const bAns = await b.client.from("dc_answers").select("*").eq("arc_id", arcId);
    check("B cannot see A's answers (0 rows)", !bAns.error && bAns.data?.length === 0);

    const bProf = await b.client.from("dc_profiles").select("*").eq("user_id", a.userId);
    check("B cannot see A's profile (0 rows)", !bProf.error && bProf.data?.length === 0);

    const bGoal = await b.client.from("dc_goals").select("*").eq("user_id", a.userId);
    check("B cannot see A's goals (0 rows)", !bGoal.error && bGoal.data?.length === 0);

    const bUpd = await b.client.from("dc_arcs").update({ status: "open" }).eq("id", arcId).select();
    check("B's update of A's arc touches 0 rows", !bUpd.error && bUpd.data?.length === 0);

    const bDel = await b.client.from("dc_arcs").delete().eq("id", arcId).select();
    check("B's delete of A's arc touches 0 rows", !bDel.error && bDel.data?.length === 0);

    const spoof = await b.client.from("dc_arcs").insert({
      id: crypto.randomUUID(),
      user_id: a.userId, // forged owner
      tree_version: 1,
    });
    check("B cannot insert an arc owned by A (RLS with check)", !!spoof.error);

    const bAnsIns = await b.client
      .from("dc_answers")
      .insert({ arc_id: arcId, node_id: "T1", tree_version: 1, value: { value: "just_now" } });
    check("B cannot insert an answer onto A's arc", !!bAnsIns.error);

    const stillMine = await a.client.from("dc_arcs").select("status").eq("id", arcId).single();
    check(
      "A's arc unchanged after B's attempts",
      !stillMine.error && stillMine.data?.status === "complete",
      stillMine.error?.message
    );

    // ---------------- config tables: read yes, write no ----------------
    const aCfg = await a.client.from("dc_tree_versions").select("version");
    check(
      "A reads dc_tree_versions",
      !aCfg.error && (aCfg.data?.length ?? 0) >= 1,
      aCfg.error?.message
    );
    const bCfg = await b.client.from("dc_onboarding_versions").select("version");
    check(
      "B reads dc_onboarding_versions",
      !bCfg.error && (bCfg.data?.length ?? 0) >= 1,
      bCfg.error?.message
    );

    const cfgIns = await a.client
      .from("dc_tree_versions")
      .insert({ version: 999, config: { hacked: true } });
    check("A cannot insert into dc_tree_versions (publish is service-role only)", !!cfgIns.error);
  } finally {
    await cleanup(a, b);
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : "\nall RLS checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(`rls-check could not run: ${e.message}`);
  process.exit(2);
});
