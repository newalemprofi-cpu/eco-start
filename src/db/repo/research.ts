import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import type { ResearchStatus } from "@/lib/validation/research";

// Access rules (RLS only scopes research to the school — 0002_rls.sql —
// so the group boundary is enforced here, in every query):
//   child   — projects of their own group, never drafts; observations
//             only on their group's *active* projects.
//   teacher — projects of groups linked to them in teacher_groups.

export type ResearchProjectSummary = {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  question: string;
  hypothesis: string;
  measurementUnit: string;
  tasks: string[];
  status: ResearchStatus;
  conclusion: string | null;
  teacherFeedback: string | null;
  startedAt: string;
  observationCount: number;
};

export class ResearchAccessError extends Error {
  constructor(message = "Зерттеу табылмады немесе оған рұқсат жоқ.") {
    super(message);
  }
}

type Tx = Parameters<Parameters<typeof withTenantContext>[1]>[0];

const SELECT_PROJECT = (sql: Tx) => sql`
  select p.id, p.group_id as "groupId", g.name as "groupName", p.title, p.question, p.hypothesis,
         p.measurement_unit as "measurementUnit", p.tasks, p.status, p.conclusion,
         p.teacher_feedback as "teacherFeedback", p.started_at as "startedAt",
         (select count(*)::int from research_observations o where o.project_id = p.id) as "observationCount"
  from research_projects p
  join groups g on g.id = p.group_id
`;

const CHILD_GROUP = (sql: Tx, userId: string) => sql`(select group_id from users where id = ${userId})`;

export async function listProjectsForChild(ctx: TenantContext): Promise<ResearchProjectSummary[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ResearchProjectSummary[]>`
      ${SELECT_PROJECT(sql)}
      where p.group_id = ${CHILD_GROUP(sql, ctx.userId)} and p.status <> 'draft'
      order by (p.status = 'active') desc, p.started_at desc
    `
  );
}

export async function getProjectForChild(
  ctx: TenantContext,
  projectId: string
): Promise<ResearchProjectSummary | null> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<ResearchProjectSummary[]>`
      ${SELECT_PROJECT(sql)}
      where p.id = ${projectId} and p.group_id = ${CHILD_GROUP(sql, ctx.userId)} and p.status <> 'draft'
    `
  );
  return rows[0] ?? null;
}

export async function listProjectsForTeacher(ctx: TenantContext): Promise<ResearchProjectSummary[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<ResearchProjectSummary[]>`
      ${SELECT_PROJECT(sql)}
      where p.group_id in (select group_id from teacher_groups where teacher_id = ${ctx.userId})
      order by p.started_at desc
    `
  );
}

export type ObservationPoint = {
  id: string;
  childId: string;
  childName: string;
  loggedAt: string;
  measurement: number | null;
  note: string | null;
};

/** Callers must have checked project access first (getProjectFor*). */
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
      order by o.logged_at asc, o.created_at asc
    `
  );
}

export async function addObservation(
  ctx: TenantContext,
  projectId: string,
  input: { measurement: number | null; note: string | null }
): Promise<void> {
  await withTenantContext(ctx, async (sql) => {
    const [project] = await sql<{ status: ResearchStatus }[]>`
      select p.status from research_projects p
      where p.id = ${projectId} and p.group_id = ${CHILD_GROUP(sql, ctx.userId)}
    `;
    if (!project || project.status === "draft") throw new ResearchAccessError();
    if (project.status !== "active") throw new ResearchAccessError("Бұл зерттеу аяқталған.");
    await sql`
      insert into research_observations (project_id, child_id, measurement, note)
      values (${projectId}, ${ctx.userId}, ${input.measurement}, ${input.note})
    `;
  });
}

async function assertTeacherGroup(sql: Tx, teacherId: string, groupId: string) {
  const [row] = await sql<{ ok: number }[]>`
    select 1 as ok from teacher_groups where teacher_id = ${teacherId} and group_id = ${groupId}
  `;
  if (!row) throw new ResearchAccessError("Бұл топ сізге бекітілмеген.");
}

async function assertTeacherProject(sql: Tx, teacherId: string, projectId: string) {
  const [row] = await sql<{ ok: number }[]>`
    select 1 as ok from research_projects p
    join teacher_groups tg on tg.group_id = p.group_id and tg.teacher_id = ${teacherId}
    where p.id = ${projectId}
  `;
  if (!row) throw new ResearchAccessError();
}

export async function getProjectForTeacher(
  ctx: TenantContext,
  projectId: string
): Promise<ResearchProjectSummary | null> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<ResearchProjectSummary[]>`
      ${SELECT_PROJECT(sql)}
      where p.id = ${projectId}
        and p.group_id in (select group_id from teacher_groups where teacher_id = ${ctx.userId})
    `
  );
  return rows[0] ?? null;
}

export type ProjectInput = {
  groupId: string;
  title: string;
  question: string;
  hypothesis: string;
  measurementUnit: string;
  tasks: string[];
};

export async function createProject(
  ctx: TenantContext,
  input: ProjectInput & { status: "draft" | "active" }
): Promise<{ id: string }> {
  return withTenantContext(ctx, async (sql) => {
    await assertTeacherGroup(sql, ctx.userId, input.groupId);
    const [row] = await sql<{ id: string }[]>`
      insert into research_projects (group_id, created_by, title, question, hypothesis, measurement_unit, tasks, status)
      values (${input.groupId}, ${ctx.userId}, ${input.title}, ${input.question}, ${input.hypothesis},
              ${input.measurementUnit}, ${input.tasks}::text[], ${input.status})
      returning id
    `;
    return row;
  });
}

export async function updateProject(ctx: TenantContext, projectId: string, input: ProjectInput): Promise<void> {
  await withTenantContext(ctx, async (sql) => {
    await assertTeacherProject(sql, ctx.userId, projectId);
    await assertTeacherGroup(sql, ctx.userId, input.groupId);
    await sql`
      update research_projects
      set group_id = ${input.groupId}, title = ${input.title}, question = ${input.question},
          hypothesis = ${input.hypothesis}, measurement_unit = ${input.measurementUnit},
          tasks = ${input.tasks}::text[], updated_at = now()
      where id = ${projectId}
    `;
  });
}

export async function setProjectStatus(
  ctx: TenantContext,
  projectId: string,
  status: ResearchStatus,
  conclusion?: string
): Promise<void> {
  await withTenantContext(ctx, async (sql) => {
    await assertTeacherProject(sql, ctx.userId, projectId);
    await sql`
      update research_projects
      set status = ${status},
          completed_at = case when ${status} = 'completed' then now() else null end,
          conclusion = coalesce(${conclusion ?? null}, conclusion),
          updated_at = now()
      where id = ${projectId}
    `;
  });
}

export async function setFeedback(
  ctx: TenantContext,
  projectId: string,
  feedback: string
): Promise<void> {
  await withTenantContext(ctx, async (sql) => {
    await assertTeacherProject(sql, ctx.userId, projectId);
    await sql`update research_projects set teacher_feedback = ${feedback}, updated_at = now() where id = ${projectId}`;
  });
}
