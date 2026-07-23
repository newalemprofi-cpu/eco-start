import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import type { GroupAgeCategory } from "@/lib/group-age-categories";

export type TeacherGroup = {
  id: string;
  name: string;
  ageBand: string;
  code: string;
  ageCategory: GroupAgeCategory;
  pedagogicalAssistantName: string | null;
  childCount: number;
} | null;

export async function getPrimaryGroup(ctx: TenantContext): Promise<TeacherGroup> {
  const rows = await withTenantContext(
    ctx,
    (sql) => sql<NonNullable<TeacherGroup>[]>`
      select g.id, g.name, g.age_band as "ageBand", g.code, g.age_category as "ageCategory",
             au.display_name as "pedagogicalAssistantName",
             (select count(*)::int from users c where c.group_id = g.id and c.role = 'CHILD') as "childCount"
      from teacher_groups tg
      join groups g on g.id = tg.group_id
      left join users au on au.id = g.pedagogical_assistant_id
      where tg.teacher_id = ${ctx.userId}
      order by g.created_at asc
      limit 1
    `
  );
  return rows[0] ?? null;
}

export type RosterChild = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  loginCode: string | null;
};

export async function getRoster(ctx: TenantContext, groupId: string): Promise<RosterChild[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<RosterChild[]>`
      select id, display_name as "displayName", avatar_url as "avatarUrl", xp, level, login_code as "loginCode"
      from users
      where role = 'CHILD' and group_id = ${groupId}
      order by display_name
    `
  );
}

export type GroupActivityItem = {
  childName: string;
  kind: "recognition" | "game" | "growth" | "research";
  label: string;
  occurredAt: string;
};

export async function getGroupActivity(ctx: TenantContext, groupId: string, limit = 12): Promise<GroupActivityItem[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<GroupActivityItem[]>`
      (select u.display_name as "childName", 'recognition' as kind,
              coalesce(r.ai_summary->>'label', 'Эко Зертхана') as label, r.created_at as "occurredAt"
       from recognitions r join users u on u.id = r.child_id where u.group_id = ${groupId})
      union all
      (select u.display_name as "childName", 'game' as kind, ('Ойын: ' || gs.score || ' ұпай') as label, gs.ended_at as "occurredAt"
       from game_sessions gs join users u on u.id = gs.child_id where u.group_id = ${groupId} and gs.ended_at is not null)
      union all
      (select u.display_name as "childName", 'growth' as kind, ('Жасыл бөбекжай: ' || coalesce(gl.height_cm::text, '?') || ' см') as label, gl.created_at as "occurredAt"
       from growth_logs gl
       join greenhouse_entries e on e.id = gl.entry_id
       join users u on u.id = e.child_id
       where u.group_id = ${groupId})
      union all
      (select u.display_name as "childName", 'research' as kind, ('Зерттеу: ' || coalesce(ro.measurement::text, '?')) as label, ro.created_at as "occurredAt"
       from research_observations ro join users u on u.id = ro.child_id where u.group_id = ${groupId})
      order by "occurredAt" desc
      limit ${limit}
    `
  );
}

export type AssignmentRow = {
  id: string;
  topic: string;
  dueAt: string | null;
  assignedAt: string;
};

export async function getAssignments(ctx: TenantContext, groupId: string): Promise<AssignmentRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<AssignmentRow[]>`
      select la.id, l.topic, la.due_at as "dueAt", la.assigned_at as "assignedAt"
      from lesson_assignments la
      join lessons l on l.id = la.lesson_id
      where la.group_id = ${groupId}
      order by la.assigned_at desc
    `
  );
}
