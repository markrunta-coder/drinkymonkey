// dc_arcs.occurred_at denormalization from T1 (spec decision 9) —
// deterministic conventions, documented in engine.ts.
import { occurredAtFromT1 } from "../engine";

const now = new Date("2026-07-10T18:30:00");

describe("occurredAtFromT1", () => {
  test("just_now / earlier_today -> now", () => {
    expect(occurredAtFromT1({ value: "just_now" }, now)!.toISOString()).toBe(now.toISOString());
    expect(occurredAtFromT1({ value: "earlier_today" }, now)!.toISOString()).toBe(
      now.toISOString()
    );
  });

  test("last_night -> yesterday 21:00 local", () => {
    const d = occurredAtFromT1({ value: "last_night" }, now)!;
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([9, 21, 0]);
  });

  test("yesterday -> yesterday 12:00 local", () => {
    const d = occurredAtFromT1({ value: "yesterday" }, now)!;
    expect([d.getDate(), d.getHours()]).toEqual([9, 12]);
  });

  test("custom -> the picked datetime; invalid/missing -> null", () => {
    expect(
      occurredAtFromT1({ value: "custom", datetime: "2026-07-09T22:30" }, now)!.getHours()
    ).toBe(22);
    expect(occurredAtFromT1({ value: "custom" }, now)).toBeNull();
    expect(occurredAtFromT1({ value: "custom", datetime: "garbage" }, now)).toBeNull();
    expect(occurredAtFromT1(undefined, now)).toBeNull();
  });
});
