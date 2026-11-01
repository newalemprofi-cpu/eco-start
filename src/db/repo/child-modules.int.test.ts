import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "@/test/fixtures";
import { getRecognitionForChild, saveRecognition } from "@/db/repo/ecolab";
import { addGrowthLog, createEntry, getEntry, getGrowthLogs, listEntries } from "@/db/repo/greenhouse";
import {
  getChildActivityTable,
  getChildDetail,
  getGroupAnalytics,
  getTeacherChildGroup,
  ACTIVITY_WINDOW_DAYS,
} from "@/db/repo/analytics";
import { getChildAgeCategory } from "@/db/repo/child";
import { getPublicPlatformStats } from "@/db/repo/public-stats";
import { pool } from "@/db/client";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await f.owner.end();
  await pool.end();
});

const recognition = {
  kind: "PLANT" as const,
  imageUrl: "/uploads/test.jpg",
  confidence: 0.8,
  label: "Түймедақ",
  funFact: "Түймедақ күнге қарай бұрылады.",
  isPotentiallyToxic: false,
  provider: "mock",
  isMock: true,
};

describe("Эко Зертхана detail card (task 9)", () => {
  it("opens the full card with history of the same object, for the owner only", async () => {
    const first = await saveRecognition(f.childA, recognition);
    const second = await saveRecognition(f.childA, recognition);

    const detail = await getRecognitionForChild(f.childA, second.id);
    expect(detail?.entry.label).toBe("Түймедақ");
    expect(detail?.entry.funFact).toContain("күнге");
    expect(detail?.history.map((h) => h.id)).toContain(first.id);
    expect(detail?.timesStudied).toBeGreaterThanOrEqual(2);

    // Another child — even in the same group — gets nothing.
    expect(await getRecognitionForChild(f.childA2, second.id)).toBeNull();
    expect(await getRecognitionForChild(f.childB, second.id)).toBeNull();
  });

  it("new saves store ai_summary as a jsonb object (not a double-encoded string)", async () => {
    const { id } = await saveRecognition(f.childA, recognition);
    const [row] = await f.owner<{ t: string }[]>`select jsonb_typeof(ai_summary) as t from recognitions where id = ${id}`;
    expect(row.t).toBe("object");
  });

  it("still reads legacy rows saved double-encoded by the old code", async () => {
    const [legacy] = await f.owner<{ id: string }[]>`
      insert into recognitions (child_id, kind, image_url, confidence, ai_provider, ai_is_mock, ai_summary)
      values (${f.childA.userId}, 'LEAF', '/uploads/old.jpg', 0.6, 'mock', true,
              to_jsonb(${JSON.stringify({ label: "Ескі жапырақ", funFact: "Ескі дерек" })}::text))
      returning id
    `;
    const detail = await getRecognitionForChild(f.childA, legacy.id);
    expect(detail?.entry.label).toBe("Ескі жапырақ");
    expect(detail?.entry.funFact).toBe("Ескі дерек");
    const table = await getChildDetail(f.teacherA, f.groupA, f.childA.userId);
    expect(table?.recognitions.map((r) => r.label)).toContain("Ескі жапырақ");
  });
});

describe("Жасыл бөбекжай vegetables + picture logs (tasks 7, 8)", () => {
  it("stores a catalog vegetable and a leaf-count/stage log, keeping old fields working", async () => {
    const { id } = await createEntry(f.childB, { nickname: "Қызанақ", waterSchedule: "every_day", plantKey: "tomato" });
    await addGrowthLog(f.childB, id, { heightCm: null, leafCount: 3, stage: "sprout", note: null });
    await addGrowthLog(f.childB, id, { heightCm: 4.5, leafCount: null, stage: null, note: "ескі өріс" });

    const entry = await getEntry(f.childB, id);
    expect(entry?.plantKey).toBe("tomato");
    expect(entry?.latestStage).toBe("sprout");
    const logs = await getGrowthLogs(f.childB, id);
    expect(logs.map((l) => l.leafCount)).toEqual([3, null]);
    expect(logs[1].heightCm).toBe(4.5);

    // Legacy entries (no plant key) still list.
    const legacy = await createEntry(f.childB, { nickname: "Ескі гүл", waterSchedule: "every_week" });
    const list = await listEntries(f.childB);
    expect(list.find((e) => e.id === legacy.id)?.plantKey).toBeNull();

    // Another child cannot log on it.
    await expect(addGrowthLog(f.childA, id, { heightCm: 1, leafCount: null, stage: null, note: null })).rejects.toThrow();
  });

  it("knows the child's age category for age-adapted UI", async () => {
    expect(await getChildAgeCategory(f.childB)).toBe("MIDDLE_3");
    expect(await getChildAgeCategory(f.childA)).toBe("PRESCHOOL_5");
  });
});

describe("Эко Талдау drill-down (task 6)", () => {
  it("counts activity from every module and exposes per-child details", async () => {
    const analytics = await getGroupAnalytics(f.teacherA, f.groupA);
    expect(analytics.totalChildren).toBeGreaterThan(0);
    expect(analytics.activityByDay).toHaveLength(ACTIVITY_WINDOW_DAYS);
    // childA just saved recognitions above → active.
    expect(analytics.activeChildren).toBeGreaterThanOrEqual(1);

    const table = await getChildActivityTable(f.teacherA, f.groupA);
    const a = table.find((c) => c.id === f.childA.userId)!;
    expect(a.isActive).toBe(true);
    expect(a.recognitions).toBeGreaterThanOrEqual(2);
    expect(a.daily).toHaveLength(ACTIVITY_WINDOW_DAYS);
    expect(a.daily.at(-1)).toBeGreaterThan(0);

    const detail = await getChildDetail(f.teacherA, f.groupA, f.childA.userId);
    expect(detail?.recognitions.length).toBeGreaterThan(0);
  });

  it("never resolves a child outside the teacher's own groups", async () => {
    expect(await getTeacherChildGroup(f.teacherA, f.childA.userId)).toBe(f.groupA);
    expect(await getTeacherChildGroup(f.teacherA, f.childB.userId)).toBeNull();
    expect(await getTeacherChildGroup(f.teacherB, f.childA.userId)).toBeNull();
    expect(await getChildDetail(f.teacherA, f.groupA, f.childB.userId)).toBeNull();
  });
});

describe("public homepage stats (task 3)", () => {
  it("returns aggregate counts only and excludes demo accounts", async () => {
    const before = await getPublicPlatformStats();
    expect(before).not.toBeNull();

    const [real] = await f.owner<{ id: string }[]>`
      insert into users (school_id, role, login_code, pin_hash, display_name, group_id, is_demo)
      values (${f.schoolId}, 'CHILD', ${`int-real-${Date.now()}`}, 'x', 'Нақты бала', ${f.groupB}, false)
      returning id
    `;
    const after = await getPublicPlatformStats();
    expect(after!.children).toBe(before!.children + 1);
    expect(after!.kindergartens).toBeGreaterThanOrEqual(1);

    // Only numbers — no names, ids or rows anywhere in the payload.
    const text = JSON.stringify(after);
    expect(text).not.toContain("Нақты бала");
    expect(text).not.toContain(real.id);
  });

  it("the anonymous app role cannot read the underlying tables directly", async () => {
    const rows = await pool`select count(*)::int as n from users`;
    expect(rows[0].n).toBe(0);
  });
});
