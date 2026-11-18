import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { buildApkg, buildCollection, crc32, schedFor } from "./apkg";
import type { StoredCard } from "./types";

const wasm = createRequire(import.meta.url).resolve("sql.js/dist/sql-wasm.wasm");
const DAY = 86400000;
const now = new Date(2026, 10, 19, 12).getTime();
const card = (p: Partial<StoredCard>): StoredCard => ({ dueAt: new Date(now + 5 * DAY).toISOString(), stability: 8.5, difficulty: 5.2, state: 2, reps: 4, lapses: 1, lastReviewAt: new Date(now - 3 * DAY).toISOString(), ...p });

export const SAMPLE = [
  { key: "100", front: "reluctant", back: "not wanting to do something — \"She was reluctant to leave.\"", tags: ["fluent365", "oxford"], card: card({}) },
  { key: "c:çay", front: "çay & <tea>", back: "tea", tags: ["fluent365"] },
  { key: "101", front: "abandon", back: "to leave", tags: ["fluent365"], card: card({ state: 1, dueAt: new Date(now + 10 * 60000).toISOString(), stability: 0.4, reps: 1, lapses: 0 }) },
];

describe(".apkg export", () => {
  it("maps the schedule: review by day, same-day learning by time, new by position", () => {
    const crt = new Date(2026, 10, 19).getTime();
    expect(schedFor(undefined, crt, 3, now)).toMatchObject({ type: 0, queue: 0, due: 3 });
    expect(schedFor(card({}), crt, 0, now)).toMatchObject({ type: 2, queue: 2, due: 5, ivl: 8, reps: 4, lapses: 1, data: '{"s":8.5,"d":5.2}' });
    expect(schedFor(SAMPLE[2].card, crt, 0, now)).toMatchObject({ type: 1, queue: 1, due: Math.floor((now + 10 * 60000) / 1000) });
  });

  it("builds a SQLite collection with notes, cards and the last review", async () => {
    const bytes = await buildCollection(SAMPLE, now, wasm);
    const { default: initSqlJs } = await import("sql.js");
    const SQL = await initSqlJs({ locateFile: () => wasm });
    const db = new SQL.Database(bytes);
    expect(db.exec("select count(*) from notes")[0].values[0][0]).toBe(3);
    expect(db.exec("select guid from notes order by id")[0].values.map((r) => r[0])).toEqual(["fluent365-100", "fluent365-c:çay", "fluent365-101"]);
    expect(db.exec("select flds from notes where guid='fluent365-c:çay'")[0].values[0][0]).toBe("çay &amp; &lt;tea&gt;\x1ftea");
    expect(db.exec("select count(*) from revlog")[0].values[0][0]).toBe(2);
    db.close();
  });

  it("zips with correct CRCs", async () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
    const apkg = await buildApkg(SAMPLE, now, wasm);
    expect(String.fromCharCode(...apkg.slice(0, 2))).toBe("PK");
    if (process.env.APKG_OUT) writeFileSync(process.env.APKG_OUT, apkg);
  });
});
