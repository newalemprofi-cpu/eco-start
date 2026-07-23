import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type ResearchProjectSummary = {
  id: string;
  title: string;
  question: string;
  hypothesis: string;
  measurementUnit: string;
  status: "active" | "completed";
  conclusion: string | null;
  teacherFeedback: string | null;
};

export async function listProjectsForChild(ctx: TenantContext): Promise<ResearchProjectSummary[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ResearchProjectSummary[]>`
      select p.id, p.title, p.question, p.hypothesis, p.measurement_unit as "measurementUnit",
             p.status, p.conclusion, p.teacher_feedback as "teacherFeedback"
      from research_projects p
      where p.group_id = (select group_id from users where id = ${ctx.userId})
      order by p.started_at desc
    `
  );
}

export async function listProjectsForGroup(
  ctx: TenantContext,
  groupId: string
): Promise<ResearchProjectSummary[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ResearchProjectSummary[]>`
      select p.id, p.title, p.question, p.hypothesis, p.measurement_unit as "measurementUnit",
             p.status, p.conclusion, p.teacher_feedback as "teacherFeedback"
      from research_projects p
      where p.group_id = ${groupId}
      order by p.started_at desc
    `
  );
}

export async function getProject(
  ctx: TenantContext,
  projectId: string
): Promise<ResearchProjectSummary | null> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<ResearchProjectSummary[]>`
      select p.id, p.title, p.question, p.hypothesis, p.measurement_unit as "measurementUnit",
             p.status, p.conclusion, p.teacher_feedback as "teacherFeedback"
      from research_projects p
      where p.id = ${projectId}
    `
  );
  return rows[0] ?? null;
}

export type ObservationPoint = {
  id: string;
  childId: string;
  childName: string;
  loggedAt: string;
  measurement: number | null;
  note: string | null;
};

export async function getObservations(
  ctx: TenantContext,
  projectId: string
): Promise<ObservationPoint[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ObservationPoint[]>`
      select o.id, o.child_id as "childId", u.display_name as "childName",
             o.logged_at as "loggedAt", o.measurement, o.note
      from research_observations o
      join users u on u.id = o.child_id
      where o.project_id = ${projectId}
      order by o.logged_at asc
    `
  );
}

export async function addObservation(
  ctx: TenantContext,
  projectId: string,
  input: { measurement: number | null; note: string | null }
): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`
      insert into research_observations (project_id, child_id, measurement, note)
      values (${projectId}, ${ctx.userId}, ${input.measurement}, ${input.note})
    `
  );
}

export async function createProject(
  ctx: TenantContext,
  input: { groupId: string; title: string; question: string; hypothesis: string; measurementUnit: string }
): Promise<{ id: string }> {
  const [row] = await withTenantContext(
    ctx,
    (sql) => sql<{ id: string }[]>`
      insert into research_projects (group_id, created_by, title, question, hypothesis, measurement_unit)
      values (${input.groupId}, ${ctx.userId}, ${input.title}, ${input.question}, ${input.hypothesis}, ${input.measurementUnit})
      returning id
    `
  );
  return row;
}

export async function setFeedback(
  ctx: TenantContext,
  projectId: string,
  feedback: string
): Promise<void> {
  await withTenantContext(
    ctx,
    (sql) => sql`update research_projects set teacher_feedback = ${feedback} where id = ${projectId}`
  );
}
