import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture } from "@/test/fixtures";
import {
  addObservation,
  createProject,
  getObservations,
  getProjectForChild,
  getProjectForTeacher,
  listProjectsForChild,
  listProjectsForTeacher,
  ResearchAccessError,
  setFeedback,
  setProjectStatus,
  updateProject,
} from "@/db/repo/research";
import { pool } from "@/db/client";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await f.owner.end();
  await pool.end();
});

const base = {
  title: "Int зерттеу",
  question: "Қай өсімдік тез өседі?",
  hypothesis: "Күн астындағысы",
  measurementUnit: "cm",
  tasks: ["Суар", "Өлше"],
};

describe("Эко Зерттеу end-to-end at the data layer (task 5)", () => {
  it("draft → edit → publish → observe → review → complete", async () => {
    const { id } = await createProject(f.teacherA, { ...base, groupId: f.groupA, status: "draft" });

    // Draft: teacher sees it, child does not.
    expect((await listProjectsForTeacher(f.teacherA)).map((p) => p.id)).toContain(id);
    expect(await getProjectForChild(f.childA, id)).toBeNull();
    await expect(addObservation(f.childA, id, { measurement: 1, note: null })).rejects.toBeInstanceOf(
      ResearchAccessError
    );

    // Edit keeps tasks and fields.
    await updateProject(f.teacherA, id, { ...base, title: "Int зерттеу (түзетілді)", tasks: ["Суар", "Өлше", "Сал"], groupId: f.groupA });
    const edited = await getProjectForTeacher(f.teacherA, id);
    expect(edited?.title).toBe("Int зерттеу (түзетілді)");
    expect(edited?.tasks).toEqual(["Суар", "Өлше", "Сал"]);

    // Publish → child sees it and can observe.
    await setProjectStatus(f.teacherA, id, "active");
    expect((await listProjectsForChild(f.childA)).map((p) => p.id)).toContain(id);
    await addObservation(f.childA, id, { measurement: 4.5, note: "Өсті" });
    await addObservation(f.childA2, id, { measurement: null, note: "Суардым" });

    // Teacher reviews results.
    const obs = await getObservations(f.teacherA, id);
    expect(obs).toHaveLength(2);
    expect((await getProjectForTeacher(f.teacherA, id))?.observationCount).toBe(2);
    await setFeedback(f.teacherA, id, "Жарайсыңдар!");

    // Complete → no more observations.
    await setProjectStatus(f.teacherA, id, "completed", "Күн астындағысы тезірек өсті.");
    const done = await getProjectForChild(f.childA, id);
    expect(done?.status).toBe("completed");
    expect(done?.conclusion).toBe("Күн астындағысы тезірек өсті.");
    expect(done?.teacherFeedback).toBe("Жарайсыңдар!");
    await expect(addObservation(f.childA, id, { measurement: 5, note: null })).rejects.toBeInstanceOf(ResearchAccessError);
  });

  it("another group's project is not readable or writable without permission", async () => {
    const { id } = await createProject(f.teacherA, { ...base, groupId: f.groupA, status: "active" });

    // Child of group B: cannot list, open or observe.
    expect((await listProjectsForChild(f.childB)).map((p) => p.id)).not.toContain(id);
    expect(await getProjectForChild(f.childB, id)).toBeNull();
    await expect(addObservation(f.childB, id, { measurement: 1, note: null })).rejects.toBeInstanceOf(
      ResearchAccessError
    );

    // Teacher B: cannot open, edit, change status or comment.
    expect(await getProjectForTeacher(f.teacherB, id)).toBeNull();
    await expect(setFeedback(f.teacherB, id, "x")).rejects.toBeInstanceOf(ResearchAccessError);
    await expect(setProjectStatus(f.teacherB, id, "completed")).rejects.toBeInstanceOf(ResearchAccessError);
    await expect(updateProject(f.teacherB, id, { ...base, groupId: f.groupB })).rejects.toBeInstanceOf(
      ResearchAccessError
    );
    // ...and cannot create a project in a group that isn't theirs.
    await expect(createProject(f.teacherB, { ...base, groupId: f.groupA, status: "active" })).rejects.toBeInstanceOf(
      ResearchAccessError
    );
  });
});
