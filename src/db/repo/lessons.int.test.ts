import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "@/test/fixtures";
import {
  createLessonWithArtifacts,
  getLessonForChild,
  getLessonForTeacher,
  GroupNotOwnedError,
  listLessons,
  listLessonsForChild,
  publishLessonToGroup,
  setLessonArchived,
} from "@/db/repo/lessons";
import { getHomework } from "@/db/repo/family";
import { normalizeLessonForAge } from "@/lib/ai/lesson-normalize";
import { MockAiProvider } from "@/lib/ai/providers/mock";
import { pool } from "@/db/client";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await f.owner.end();
  await pool.end();
});

async function bundle(ageBand: "3-4" | "5-6") {
  const raw = await new MockAiProvider().generateLesson({ locale: "kk", topic: "Күз", ageBand });
  return normalizeLessonForAge(raw, ageBand);
}

describe("AI Studio publishing (task 2 root cause)", () => {
  it("a lesson published to the teacher's group is visible to that group's children only", async () => {
    const { id } = await createLessonWithArtifacts(f.teacherA, {
      topic: `Int publish ${Date.now()}`,
      locale: "kk",
      ageBand: "5-6",
      bundle: await bundle("5-6"),
      isMock: true,
      provider: "mock",
      status: "published",
      groupId: f.groupA,
      ageCategories: ["PRESCHOOL_5"],
    });

    const forChildA = await listLessonsForChild(f.childA);
    expect(forChildA.map((l) => l.id)).toContain(id);
    const detail = await getLessonForChild(f.childA, id);
    expect(detail?.content.plan.length).toBeGreaterThan(0);

    // Other group's child: not in the list, and a direct id is refused.
    expect((await listLessonsForChild(f.childB)).map((l) => l.id)).not.toContain(id);
    expect(await getLessonForChild(f.childB, id)).toBeNull();

    // Teacher sees status + which group + reach.
    const mine = (await listLessons(f.teacherA)).find((l) => l.id === id)!;
    expect(mine.status).toBe("published");
    expect(mine.groups.map((g) => g.groupId)).toEqual([f.groupA]);
    expect(mine.groups[0].childCount).toBeGreaterThan(0);
  });

  it("refuses to publish to a group the teacher isn't assigned to", async () => {
    await expect(
      createLessonWithArtifacts(f.teacherA, {
        topic: "Int foreign group",
        locale: "kk",
        ageBand: "3-4",
        bundle: await bundle("3-4"),
        isMock: true,
        provider: "mock",
        status: "published",
        groupId: f.groupB,
      })
    ).rejects.toBeInstanceOf(GroupNotOwnedError);
  });

  it("refuses a 'published' save with no group (the old silent failure)", async () => {
    await expect(
      createLessonWithArtifacts(f.teacherA, {
        topic: "Int no group",
        locale: "kk",
        ageBand: "5-6",
        bundle: await bundle("5-6"),
        isMock: true,
        provider: "mock",
        status: "published",
      })
    ).rejects.toBeInstanceOf(GroupNotOwnedError);
  });

  it("repairs a legacy published-but-unassigned lesson without recreating it", async () => {
    // Simulate a lesson saved by the old code path: published, no assignment.
    const [legacy] = await f.owner<{ id: string }[]>`
      insert into lessons (school_id, author_id, topic, status, age_band)
      values (${f.schoolId}, ${f.teacherA.userId}, 'Int legacy orphan', 'published', '5-6') returning id
    `;
    expect(await getLessonForChild(f.childA, legacy.id)).toBeNull();

    const first = await publishLessonToGroup(f.teacherA, legacy.id, f.groupA);
    expect(first.newlyAssigned).toBe(true);
    expect(await getLessonForChild(f.childA, legacy.id)).not.toBeNull();
    // Idempotent: a second publish to the same group adds nothing.
    expect((await publishLessonToGroup(f.teacherA, legacy.id, f.groupA)).newlyAssigned).toBe(false);
  });

  it("archive hides from children and parents; restore brings it back; nothing is deleted", async () => {
    const topic = `Int archive ${Date.now()}`;
    const { id } = await createLessonWithArtifacts(f.teacherA, {
      topic,
      locale: "kk",
      ageBand: "5-6",
      bundle: await bundle("5-6"),
      isMock: true,
      provider: "mock",
      status: "published",
      groupId: f.groupA,
    });
    expect(await setLessonArchived(f.teacherA, id, true)).toBe("archived");
    expect(await getLessonForChild(f.childA, id)).toBeNull();
    expect((await getHomework(f.childA, f.groupA)).map((h) => h.topic)).not.toContain(topic);

    expect(await setLessonArchived(f.teacherA, id, false)).toBe("published");
    expect(await getLessonForChild(f.childA, id)).not.toBeNull();
    const [{ count }] = await f.owner<{ count: number }[]>`
      select count(*)::int as count from lesson_artifacts where lesson_id = ${id}
    `;
    expect(count).toBe(3);
  });

  it("another teacher can neither open nor publish someone else's lesson", async () => {
    const [{ id }] = await f.owner<{ id: string }[]>`
      select id from lessons where author_id = ${f.teacherA.userId} limit 1
    `;
    expect(await getLessonForTeacher(f.teacherB, id)).toBeNull();
    await expect(publishLessonToGroup(f.teacherB, id, f.groupB)).rejects.toThrow();
  });

  it("reads lessons saved double-encoded by the old code (existing production rows)", async () => {
    const [legacy] = await f.owner<{ id: string }[]>`
      insert into lessons (school_id, author_id, topic, status, age_band)
      values (${f.schoolId}, ${f.teacherA.userId}, 'Int legacy encoded', 'draft', '5-6') returning id
    `;
    await f.owner`
      insert into lesson_artifacts (lesson_id, type, content)
      values (${legacy.id}, 'LESSON_PLAN', to_jsonb(${JSON.stringify({ objective: "O", plan: ["a", "b"] })}::text))
    `;
    const detail = await getLessonForTeacher(f.teacherA, legacy.id);
    expect(detail?.content.plan).toEqual(["a", "b"]);
  });

  it("new lessons store artifacts as jsonb objects, not double-encoded strings", async () => {
    const { id } = await createLessonWithArtifacts(f.teacherA, {
      topic: "Int encoding",
      locale: "kk",
      ageBand: "5-6",
      bundle: await bundle("5-6"),
      isMock: true,
      provider: "mock",
      status: "draft",
    });
    const types = await f.owner<{ t: string }[]>`
      select distinct jsonb_typeof(content) as t from lesson_artifacts where lesson_id = ${id}
    `;
    expect(types.map((r) => r.t)).toEqual(["object"]);
  });

  it("stores a 3-4 lesson with its age profile limits", async () => {
    const b = await bundle("3-4");
    const { id } = await createLessonWithArtifacts(f.teacherB, {
      topic: "Int 3-4",
      locale: "kk",
      ageBand: "3-4",
      bundle: b,
      isMock: true,
      provider: "mock",
      status: "published",
      groupId: f.groupB,
      ageCategories: ["MIDDLE_3"],
    });
    const detail = await getLessonForChild(f.childB, id);
    expect(detail?.ageBand).toBe("3-4");
    expect(detail?.content.plan.length).toBeLessThanOrEqual(3);
    expect(detail?.content.durationMinutes).toBe(10);
  });
});
