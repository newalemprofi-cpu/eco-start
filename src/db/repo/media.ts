import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";

export type MediaAssetRow = {
  id: string;
  type: string;
  title: string;
  fileUrl: string | null;
  scriptText: string | null;
  storyboard: { title: string; scenes: { scene: number; description: string; narration: string }[] } | null;
  status: string;
  createdAt: string;
};

export async function listMediaForChild(ctx: TenantContext): Promise<MediaAssetRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<MediaAssetRow[]>`
      select id, type, title, file_url as "fileUrl", script_text as "scriptText",
             storyboard, status, created_at as "createdAt"
      from media_assets
      where child_id = ${ctx.userId}
      order by created_at desc
    `
  );
}

export async function createMediaProject(
  ctx: TenantContext,
  input: {
    type: string;
    title: string;
    scriptText: string | null;
    storyboard: unknown | null;
    fileUrl: string | null;
    provider: string | null;
    isMock: boolean;
  }
): Promise<{ id: string }> {
  const [row] = await withTenantContext(
    ctx,
    (sql) => sql<{ id: string }[]>`
      insert into media_assets (school_id, child_id, created_by, type, title, script_text, storyboard, file_url, ai_provider, ai_is_mock)
      values (
        ${ctx.schoolId}, ${ctx.userId}, ${ctx.userId}, ${input.type}, ${input.title},
        ${input.scriptText}, ${input.storyboard ? JSON.stringify(input.storyboard) : null},
        ${input.fileUrl}, ${input.provider}, ${input.isMock}
      )
      returning id
    `
  );
  return row;
}
