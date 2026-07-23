import "server-only";
import { withTenantContext, type TenantContext } from "@/db/client";
import {
  ensureDraftSingleton,
  getDraftSingleton,
  getPublishedSingleton,
  listDrafts,
  listPublished,
  logPublish,
  logRevision,
  publishSingleton,
  updateDraftSingleton,
  wrapJsonFields,
  type ContentStatus,
  type LocalizedText,
} from "@/db/repo/cms-core";

// ── Branding ──────────────────────────────────────────────────────────

export type BrandSettingsRow = {
  id: string;
  status: ContentStatus;
  site_name: string;
  short_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  footer_logo_url: string | null;
  version: number;
  updated_at: string;
  published_at: string | null;
};

export const getPublishedBrand = () => getPublishedSingleton<BrandSettingsRow>("brand_settings");
export const ensureBrandDraft = (ctx: TenantContext) =>
  ensureDraftSingleton<BrandSettingsRow>(ctx, "brand_settings");
export const getBrandDraft = (ctx: TenantContext) =>
  getDraftSingleton<BrandSettingsRow>(ctx, "brand_settings");

export async function saveBrandDraft(
  ctx: TenantContext,
  patch: Partial<
    Pick<
      BrandSettingsRow,
      "site_name" | "short_name" | "logo_url" | "logo_dark_url" | "favicon_url" | "footer_logo_url"
    >
  >
) {
  await ensureBrandDraft(ctx);
  await updateDraftSingleton(ctx, "brand_settings", patch);
}

export const publishBrand = (ctx: TenantContext) =>
  publishSingleton(ctx, "brand_settings", "brand_settings");

// ── Theme ─────────────────────────────────────────────────────────────

export type ThemeSettingsRow = {
  id: string;
  status: ContentStatus;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_background: string;
  color_card: string;
  color_foreground: string;
  color_muted_foreground: string;
  color_success: string;
  color_warning: string;
  color_danger: string;
  radius: string;
  button_radius: string;
  card_shadow: string;
  font_family: string;
  heading_font: string;
  body_font: string;
  illustration_style: string;
  version: number;
  updated_at: string;
  published_at: string | null;
};

export const getPublishedTheme = () => getPublishedSingleton<ThemeSettingsRow>("theme_settings");
export const ensureThemeDraft = (ctx: TenantContext) =>
  ensureDraftSingleton<ThemeSettingsRow>(ctx, "theme_settings");
export const getThemeDraft = (ctx: TenantContext) =>
  getDraftSingleton<ThemeSettingsRow>(ctx, "theme_settings");

export async function saveThemeDraft(
  ctx: TenantContext,
  patch: Partial<
    Omit<ThemeSettingsRow, "id" | "status" | "version" | "updated_at" | "published_at">
  >
) {
  await ensureThemeDraft(ctx);
  await updateDraftSingleton(ctx, "theme_settings", patch);
}

export const publishTheme = (ctx: TenantContext) =>
  publishSingleton(ctx, "theme_settings", "theme_settings");

// ── Homepage banner carousel (list, admin-created — no fixed key) ──────
//
// The homepage banner used to be a singleton (at most one draft row,
// one published row, ever) — replaced by this list-based carousel so
// SUPER_ADMIN can run multiple rotating banners. There's no fixed enum
// to key drafts/published pairs by (the way `key` does for
// sections/modules/role-cards, since banners are freely created and
// deleted), so `group_id` is assigned once at creation and carried over
// to the published row — see the migration's header comment for the
// full rationale. The old singleton `homepage_banner` table/columns
// still exist in the database (no destructive migration was run) but
// nothing in the application reads or writes them anymore.

export type BannerCarouselContent = {
  title: string;
  subtitle: string;
  description: string;
  primaryButtonText: string;
  secondaryButtonText: string;
};
export type BannerCarouselRow = {
  id: string;
  group_id: string;
  status: ContentStatus;
  enabled: boolean;
  display_order: number;
  content: Record<"kk" | "ru" | "en", BannerCarouselContent>;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  background_video_url: string | null;
  overlay_strength: string;
  text_align: "left" | "center" | "right";
  content_position: "left" | "center" | "right";
  primary_button_link: string;
  secondary_button_link: string | null;
  start_at: string | null;
  end_at: string | null;
  version: number;
  updated_at: string;
  published_at: string | null;
};

const BANNER_CAROUSEL_JSON_FIELDS = ["content"];
const EMPTY_BANNER_CONTENT: Record<"kk" | "ru" | "en", BannerCarouselContent> = {
  kk: { title: "", subtitle: "", description: "", primaryButtonText: "", secondaryButtonText: "" },
  ru: { title: "", subtitle: "", description: "", primaryButtonText: "", secondaryButtonText: "" },
  en: { title: "", subtitle: "", description: "", primaryButtonText: "", secondaryButtonText: "" },
};

export const listPublishedBanners = () => listPublished<BannerCarouselRow>("homepage_banners");
export const listDraftBanners = (ctx: TenantContext) => listDrafts<BannerCarouselRow>(ctx, "homepage_banners");

/** Every banner that exists at all (draft and/or published), one row
 * per logical banner — the admin editor's "one card per banner" list. */
export async function listBannerGroupIds(ctx: TenantContext): Promise<string[]> {
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<{ group_id: string }[]>`
      select distinct group_id from homepage_banners order by group_id
    `;
    return rows.map((r) => r.group_id);
  });
}

export async function createBannerDraft(ctx: TenantContext): Promise<BannerCarouselRow> {
  return withTenantContext(ctx, async (sql) => {
    const [{ max }] = await sql<{ max: number | null }[]>`
      select max(display_order) as max from homepage_banners
    `;
    const [created] = await sql<BannerCarouselRow[]>`
      insert into homepage_banners (status, display_order, content, primary_button_link, created_by, updated_by)
      values ('draft', ${(max ?? -1) + 1}, ${sql.json(EMPTY_BANNER_CONTENT)}, '/login', ${ctx.userId}, ${ctx.userId})
      returning *
    `;
    return created;
  });
}

/** Creates the draft row for a banner group if it doesn't exist yet, cloning the published one. */
export async function ensureBannerCarouselDraft(ctx: TenantContext, groupId: string): Promise<BannerCarouselRow> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<BannerCarouselRow[]>`
      select * from homepage_banners where group_id = ${groupId} and status = 'draft' limit 1
    `;
    if (existing[0]) return existing[0];

    const published = await sql<Record<string, unknown>[]>`
      select * from homepage_banners where group_id = ${groupId} and status = 'published' limit 1
    `;
    if (!published[0]) throw new Error(`No banner found for group ${groupId}`);
    const { id: _id, status: _status, published_at: _pub, ...rest } = published[0];
    void _id;
    void _status;
    void _pub;
    const [created] = await sql<BannerCarouselRow[]>`
      insert into homepage_banners ${sql(wrapJsonFields(sql, { ...rest, status: "draft" }, BANNER_CAROUSEL_JSON_FIELDS))}
      returning *
    `;
    return created;
  });
}

export async function saveBannerCarouselDraft(
  ctx: TenantContext,
  groupId: string,
  patch: Partial<
    Omit<BannerCarouselRow, "id" | "group_id" | "status" | "version" | "updated_at" | "published_at" | "content"> & {
      content?: BannerCarouselRow["content"];
    }
  >
) {
  await ensureBannerCarouselDraft(ctx, groupId);
  await withTenantContext(ctx, (sql) =>
    sql`
      update homepage_banners
      set ${sql(
        wrapJsonFields(
          sql,
          { ...patch, updated_at: new Date().toISOString(), updated_by: ctx.userId },
          BANNER_CAROUSEL_JSON_FIELDS
        )
      )}, version = version + 1
      where group_id = ${groupId} and status = 'draft'
    `
  );
}

export async function publishBannerCarousel(ctx: TenantContext, groupId: string) {
  await withTenantContext(ctx, async (sql) => {
    const [draft] = await sql<Record<string, unknown>[]>`
      select * from homepage_banners where group_id = ${groupId} and status = 'draft' limit 1
    `;
    if (!draft) throw new Error(`No draft banner for group ${groupId}`);
    const {
      id: _id,
      status: _status,
      created_at,
      created_by,
      published_at: _pub,
      version,
      group_id: _gid,
      ...content
    } = draft;
    void _id;
    void _status;
    void _pub;
    void created_at;
    void created_by;
    void _gid;

    const [existing] = await sql<{ id: string }[]>`
      select id from homepage_banners where group_id = ${groupId} and status = 'published' limit 1
    `;
    if (existing) {
      await sql`
        update homepage_banners
        set ${sql(
          wrapJsonFields(
            sql,
            { ...content, updated_at: new Date().toISOString(), updated_by: ctx.userId, published_at: new Date().toISOString() },
            BANNER_CAROUSEL_JSON_FIELDS
          )
        )}
        where id = ${existing.id}
      `;
      await logRevision(sql, "homepage_banners", existing.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "homepage_banners", existing.id, ctx.userId, "banner");
    } else {
      const [created] = await sql<{ id: string }[]>`
        insert into homepage_banners ${sql(
          wrapJsonFields(
            sql,
            {
              ...content,
              group_id: groupId,
              status: "published",
              published_at: new Date().toISOString(),
              created_by: ctx.userId,
              updated_by: ctx.userId,
            },
            BANNER_CAROUSEL_JSON_FIELDS
          )
        )}
        returning id
      `;
      await logRevision(sql, "homepage_banners", created.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "homepage_banners", created.id, ctx.userId, "banner");
    }
  });
}

/** Deletes both the draft and published rows for a banner — nothing
 * else in the CMS supports delete today (sections/modules/role-cards
 * are a fixed enum that always exists), but an admin-created banner
 * needs to be fully removable. */
export async function deleteBannerCarousel(ctx: TenantContext, groupId: string) {
  await withTenantContext(ctx, (sql) => sql`delete from homepage_banners where group_id = ${groupId}`);
}

export async function reorderBannerCarousel(ctx: TenantContext, orderedGroupIds: string[]) {
  await withTenantContext(ctx, async (sql) => {
    for (let i = 0; i < orderedGroupIds.length; i++) {
      await sql`
        update homepage_banners set display_order = ${i}
        where group_id = ${orderedGroupIds[i]} and status = 'draft'
      `;
    }
  });
}

// ── Homepage sections ─────────────────────────────────────────────────

export const SECTION_KEYS = [
  "hero",
  "intro",
  "modules",
  "eco_ai",
  "roles",
  "results",
  "cta",
  "footer",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export type SectionContent = { title: string; subtitle: string; description: string; buttonText: string };
export type SectionRow = {
  id: string;
  key: SectionKey;
  status: ContentStatus;
  enabled: boolean;
  display_order: number;
  content: Record<"kk" | "ru" | "en", SectionContent>;
  image_url: string | null;
  icon: string | null;
  button_link: string | null;
  background_style: "default" | "muted" | "primary" | "gradient";
  layout: "standard" | "reverse" | "centered" | "grid";
  version: number;
  updated_at: string;
  published_at: string | null;
};

export const listPublishedSections = () => listPublished<SectionRow>("homepage_sections");
export const listDraftSections = (ctx: TenantContext) => listDrafts<SectionRow>(ctx, "homepage_sections");

export async function getSectionDraft(ctx: TenantContext, key: SectionKey): Promise<SectionRow | null> {
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<SectionRow[]>`
      select * from homepage_sections where key = ${key} and status = 'draft' limit 1
    `;
    return rows[0] ?? null;
  });
}

/** Creates the draft row for a section key if it doesn't exist yet, cloning the published one. */
export async function ensureSectionDraft(ctx: TenantContext, key: SectionKey): Promise<SectionRow> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<SectionRow[]>`
      select * from homepage_sections where key = ${key} and status = 'draft' limit 1
    `;
    if (existing[0]) return existing[0];

    const published = await sql<Record<string, unknown>[]>`
      select * from homepage_sections where key = ${key} and status = 'published' limit 1
    `;
    if (published[0]) {
      const { id: _id, status: _status, published_at: _pub, ...rest } = published[0];
      void _id;
      void _status;
      void _pub;
      const [created] = await sql<SectionRow[]>`
        insert into homepage_sections ${sql(wrapJsonFields(sql, { ...rest, status: "draft" }, ["content"]))}
        returning *
      `;
      return created;
    }

    const [created] = await sql<SectionRow[]>`
      insert into homepage_sections (key, status, display_order)
      values (${key}, 'draft', ${SECTION_KEYS.indexOf(key)})
      returning *
    `;
    return created;
  });
}

export async function saveSectionDraft(
  ctx: TenantContext,
  key: SectionKey,
  patch: Partial<
    Omit<SectionRow, "id" | "key" | "status" | "version" | "updated_at" | "published_at" | "content"> & {
      content: SectionRow["content"];
    }
  >
) {
  await ensureSectionDraft(ctx, key);
  await withTenantContext(ctx, (sql) =>
    sql`
      update homepage_sections
      set ${sql(
        wrapJsonFields(
          sql,
          { ...patch, updated_at: new Date().toISOString(), updated_by: ctx.userId },
          ["content"]
        )
      )}, version = version + 1
      where key = ${key} and status = 'draft'
    `
  );
}

export async function publishSection(ctx: TenantContext, key: SectionKey) {
  await withTenantContext(ctx, async (sql) => {
    const [draft] = await sql<Record<string, unknown>[]>`
      select * from homepage_sections where key = ${key} and status = 'draft' limit 1
    `;
    if (!draft) throw new Error(`No draft section for ${key}`);
    const { id: _id, status: _status, created_at, created_by, published_at: _pub, version, ...content } = draft;
    void _id;
    void _status;
    void _pub;
    void created_at;
    void created_by;

    const [existing] = await sql<{ id: string }[]>`
      select id from homepage_sections where key = ${key} and status = 'published' limit 1
    `;
    if (existing) {
      await sql`
        update homepage_sections
        set ${sql(
          wrapJsonFields(
            sql,
            { ...content, updated_at: new Date().toISOString(), updated_by: ctx.userId, published_at: new Date().toISOString() },
            ["content"]
          )
        )}
        where id = ${existing.id}
      `;
      await logRevision(sql, "homepage_sections", existing.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "homepage_sections", existing.id, ctx.userId, key);
    } else {
      const [created] = await sql<{ id: string }[]>`
        insert into homepage_sections ${sql(
          wrapJsonFields(
            sql,
            { ...content, key, status: "published", published_at: new Date().toISOString(), created_by: ctx.userId, updated_by: ctx.userId },
            ["content"]
          )
        )}
        returning id
      `;
      await logRevision(sql, "homepage_sections", created.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "homepage_sections", created.id, ctx.userId, key);
    }
  });
}

export async function reorderSections(ctx: TenantContext, orderedKeys: SectionKey[]) {
  await withTenantContext(ctx, async (sql) => {
    for (let i = 0; i < orderedKeys.length; i++) {
      await sql`
        update homepage_sections set display_order = ${i}
        where key = ${orderedKeys[i]} and status = 'draft'
      `;
    }
  });
}

// ── Homepage modules ──────────────────────────────────────────────────

export const MODULE_KEYS = [
  "ecolab",
  "greenhouse",
  "game",
  "media",
  "research",
  "passport",
  "family",
  "analytics",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export type Role = "CHILD" | "PARENT" | "TEACHER" | "SCHOOL_ADMIN" | "SUPER_ADMIN";

export type ModuleContent = { title: string; description: string };
export type ModuleRow = {
  id: string;
  key: ModuleKey;
  status: ContentStatus;
  enabled: boolean;
  display_order: number;
  icon: string;
  color: string;
  image_url: string | null;
  content: Record<"kk" | "ru" | "en", ModuleContent>;
  route: string;
  allowed_roles: Role[];
  version: number;
  updated_at: string;
  published_at: string | null;
};

const MODULE_JSON_FIELDS = ["content", "allowed_roles"];

export const listPublishedModules = () => listPublished<ModuleRow>("homepage_modules");
export const listDraftModules = (ctx: TenantContext) => listDrafts<ModuleRow>(ctx, "homepage_modules");

/** Creates the draft row for a module key if it doesn't exist yet, cloning the published one. */
export async function ensureModuleDraft(ctx: TenantContext, key: ModuleKey): Promise<ModuleRow> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<ModuleRow[]>`
      select * from homepage_modules where key = ${key} and status = 'draft' limit 1
    `;
    if (existing[0]) return existing[0];

    const published = await sql<Record<string, unknown>[]>`
      select * from homepage_modules where key = ${key} and status = 'published' limit 1
    `;
    const base = published[0]
      ? (() => {
          const { id: _id, status: _s, published_at: _p, ...rest } = published[0];
          void _id;
          void _s;
          void _p;
          return rest;
        })()
      : { key, route: "/", allowed_roles: ["CHILD"], content: { kk: { title: "", description: "" }, ru: { title: "", description: "" }, en: { title: "", description: "" } } };
    const [created] = await sql<ModuleRow[]>`
      insert into homepage_modules ${sql(wrapJsonFields(sql, { ...base, key, status: "draft" }, MODULE_JSON_FIELDS))}
      returning *
    `;
    return created;
  });
}

export async function saveModuleDraft(
  ctx: TenantContext,
  key: ModuleKey,
  patch: Partial<
    Omit<ModuleRow, "id" | "key" | "status" | "version" | "updated_at" | "published_at" | "content" | "allowed_roles"> & {
      content?: ModuleRow["content"];
      allowed_roles?: Role[];
    }
  >
) {
  await withTenantContext(ctx, async (sql) => {
    const existing = await sql<{ id: string }[]>`
      select id from homepage_modules where key = ${key} and status = 'draft' limit 1
    `;

    if (!existing[0]) {
      const published = await sql<Record<string, unknown>[]>`
        select * from homepage_modules where key = ${key} and status = 'published' limit 1
      `;
      const base = published[0]
        ? (() => {
            const { id: _id, status: _s, published_at: _p, ...rest } = published[0];
            void _id;
            void _s;
            void _p;
            return rest;
          })()
        : { key, route: patch.route ?? "/", allowed_roles: ["CHILD"] };
      await sql`
        insert into homepage_modules ${sql(
          wrapJsonFields(sql, { ...base, ...patch, key, status: "draft" }, MODULE_JSON_FIELDS)
        )}
      `;
    } else {
      await sql`
        update homepage_modules
        set ${sql(
          wrapJsonFields(
            sql,
            { ...patch, updated_at: new Date().toISOString(), updated_by: ctx.userId },
            MODULE_JSON_FIELDS
          )
        )}, version = version + 1
        where key = ${key} and status = 'draft'
      `;
    }
  });
}

export async function publishModule(ctx: TenantContext, key: ModuleKey) {
  await withTenantContext(ctx, async (sql) => {
    const [draft] = await sql<Record<string, unknown>[]>`
      select * from homepage_modules where key = ${key} and status = 'draft' limit 1
    `;
    if (!draft) throw new Error(`No draft module for ${key}`);
    const { id: _id, status: _status, created_at, created_by, published_at: _pub, version, ...content } = draft;
    void _id;
    void _status;
    void _pub;
    void created_at;
    void created_by;

    const [existing] = await sql<{ id: string }[]>`
      select id from homepage_modules where key = ${key} and status = 'published' limit 1
    `;
    if (existing) {
      await sql`
        update homepage_modules
        set ${sql(
          wrapJsonFields(
            sql,
            { ...content, updated_at: new Date().toISOString(), updated_by: ctx.userId, published_at: new Date().toISOString() },
            MODULE_JSON_FIELDS
          )
        )}
        where id = ${existing.id}
      `;
      await logRevision(sql, "homepage_modules", existing.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "homepage_modules", existing.id, ctx.userId, key);
    } else {
      const [created] = await sql<{ id: string }[]>`
        insert into homepage_modules ${sql(
          wrapJsonFields(
            sql,
            { ...content, key, status: "published", published_at: new Date().toISOString(), created_by: ctx.userId, updated_by: ctx.userId },
            MODULE_JSON_FIELDS
          )
        )}
        returning id
      `;
      await logRevision(sql, "homepage_modules", created.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "homepage_modules", created.id, ctx.userId, key);
    }
  });
}

export async function reorderModules(ctx: TenantContext, orderedKeys: ModuleKey[]) {
  await withTenantContext(ctx, async (sql) => {
    for (let i = 0; i < orderedKeys.length; i++) {
      await sql`
        update homepage_modules set display_order = ${i}
        where key = ${orderedKeys[i]} and status = 'draft'
      `;
    }
  });
}

// ── Homepage role cards ───────────────────────────────────────────────

export const ROLE_CARD_KEYS = ["CHILD", "TEACHER", "PARENT", "SCHOOL_ADMIN"] as const;

export type RoleCardContent = { title: string; description: string };
export type RoleCardRow = {
  id: string;
  key: (typeof ROLE_CARD_KEYS)[number];
  status: ContentStatus;
  enabled: boolean;
  display_order: number;
  icon: string;
  color: string;
  content: Record<"kk" | "ru" | "en", RoleCardContent>;
  route: string;
  version: number;
  updated_at: string;
  published_at: string | null;
};

const ROLE_CARD_JSON_FIELDS = ["content"];

export const listPublishedRoleCards = () => listPublished<RoleCardRow>("homepage_role_cards");
export const listDraftRoleCards = (ctx: TenantContext) => listDrafts<RoleCardRow>(ctx, "homepage_role_cards");

/** Creates the draft row for a role-card key if it doesn't exist yet, cloning the published one. */
export async function ensureRoleCardDraft(
  ctx: TenantContext,
  key: (typeof ROLE_CARD_KEYS)[number]
): Promise<RoleCardRow> {
  return withTenantContext(ctx, async (sql) => {
    const existing = await sql<RoleCardRow[]>`
      select * from homepage_role_cards where key = ${key} and status = 'draft' limit 1
    `;
    if (existing[0]) return existing[0];

    const published = await sql<Record<string, unknown>[]>`
      select * from homepage_role_cards where key = ${key} and status = 'published' limit 1
    `;
    const base = published[0]
      ? (() => {
          const { id: _id, status: _s, published_at: _p, ...rest } = published[0];
          void _id;
          void _s;
          void _p;
          return rest;
        })()
      : { key, route: "/login", content: { kk: { title: "", description: "" }, ru: { title: "", description: "" }, en: { title: "", description: "" } } };
    const [created] = await sql<RoleCardRow[]>`
      insert into homepage_role_cards ${sql(wrapJsonFields(sql, { ...base, key, status: "draft" }, ROLE_CARD_JSON_FIELDS))}
      returning *
    `;
    return created;
  });
}

export async function saveRoleCardDraft(
  ctx: TenantContext,
  key: (typeof ROLE_CARD_KEYS)[number],
  patch: Partial<
    Omit<RoleCardRow, "id" | "key" | "status" | "version" | "updated_at" | "published_at" | "content"> & {
      content?: RoleCardRow["content"];
    }
  >
) {
  await withTenantContext(ctx, async (sql) => {
    const existing = await sql<{ id: string }[]>`
      select id from homepage_role_cards where key = ${key} and status = 'draft' limit 1
    `;

    if (!existing[0]) {
      const published = await sql<Record<string, unknown>[]>`
        select * from homepage_role_cards where key = ${key} and status = 'published' limit 1
      `;
      const base = published[0]
        ? (() => {
            const { id: _id, status: _s, published_at: _p, ...rest } = published[0];
            void _id;
            void _s;
            void _p;
            return rest;
          })()
        : { key, route: patch.route ?? "/login" };
      await sql`
        insert into homepage_role_cards ${sql(
          wrapJsonFields(sql, { ...base, ...patch, key, status: "draft" }, ROLE_CARD_JSON_FIELDS)
        )}
      `;
    } else {
      await sql`
        update homepage_role_cards
        set ${sql(
          wrapJsonFields(
            sql,
            { ...patch, updated_at: new Date().toISOString(), updated_by: ctx.userId },
            ROLE_CARD_JSON_FIELDS
          )
        )}, version = version + 1
        where key = ${key} and status = 'draft'
      `;
    }
  });
}

export async function publishRoleCard(ctx: TenantContext, key: (typeof ROLE_CARD_KEYS)[number]) {
  await withTenantContext(ctx, async (sql) => {
    const [draft] = await sql<Record<string, unknown>[]>`
      select * from homepage_role_cards where key = ${key} and status = 'draft' limit 1
    `;
    if (!draft) throw new Error(`No draft role card for ${key}`);
    const { id: _id, status: _status, created_at, created_by, published_at: _pub, version, ...content } = draft;
    void _id;
    void _status;
    void _pub;
    void created_at;
    void created_by;

    const [existing] = await sql<{ id: string }[]>`
      select id from homepage_role_cards where key = ${key} and status = 'published' limit 1
    `;
    if (existing) {
      await sql`
        update homepage_role_cards
        set ${sql(
          wrapJsonFields(
            sql,
            { ...content, updated_at: new Date().toISOString(), updated_by: ctx.userId, published_at: new Date().toISOString() },
            ROLE_CARD_JSON_FIELDS
          )
        )}
        where id = ${existing.id}
      `;
      await logRevision(sql, "homepage_role_cards", existing.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "homepage_role_cards", existing.id, ctx.userId, key);
    } else {
      const [created] = await sql<{ id: string }[]>`
        insert into homepage_role_cards ${sql(
          wrapJsonFields(
            sql,
            { ...content, key, status: "published", published_at: new Date().toISOString(), created_by: ctx.userId, updated_by: ctx.userId },
            ROLE_CARD_JSON_FIELDS
          )
        )}
        returning id
      `;
      await logRevision(sql, "homepage_role_cards", created.id, draft, Number(version ?? 1), ctx.userId);
      await logPublish(sql, "homepage_role_cards", created.id, ctx.userId, key);
    }
  });
}

export async function reorderRoleCards(ctx: TenantContext, orderedKeys: (typeof ROLE_CARD_KEYS)[number][]) {
  await withTenantContext(ctx, async (sql) => {
    for (let i = 0; i < orderedKeys.length; i++) {
      await sql`
        update homepage_role_cards set display_order = ${i}
        where key = ${orderedKeys[i]} and status = 'draft'
      `;
    }
  });
}

// ── Publish everything (top-level "Publish" action) ───────────────────

export async function publishAllDrafts(ctx: TenantContext) {
  const [brandDraft, themeDraft, sections, modules, roleCards, bannerCarouselDrafts] = await Promise.all([
    getBrandDraft(ctx),
    getThemeDraft(ctx),
    listDraftSections(ctx),
    listDraftModules(ctx),
    listDraftRoleCards(ctx),
    listDraftBanners(ctx),
  ]);

  if (brandDraft) await publishBrand(ctx);
  if (themeDraft) await publishTheme(ctx);
  for (const s of sections) await publishSection(ctx, s.key);
  for (const m of modules) await publishModule(ctx, m.key);
  for (const r of roleCards) await publishRoleCard(ctx, r.key);
  for (const b of bannerCarouselDrafts) await publishBannerCarousel(ctx, b.group_id);

  await withTenantContext(ctx, (sql) => logPublish(sql, "homepage", null, ctx.userId, "Publish all"));
}

// ── Media library ──────────────────────────────────────────────────────

export type SiteMediaRow = {
  id: string;
  kind: string;
  url: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  alt: LocalizedText;
  created_at: string;
};

export async function listMedia(ctx: TenantContext): Promise<SiteMediaRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<SiteMediaRow[]>`select * from site_media order by created_at desc`
  );
}

export async function createMedia(
  ctx: TenantContext,
  input: {
    kind: string;
    url: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    alt: LocalizedText;
  }
): Promise<SiteMediaRow> {
  const [row] = await withTenantContext(
    ctx,
    (sql) => sql<SiteMediaRow[]>`
      insert into site_media (kind, url, file_name, content_type, size_bytes, alt, uploaded_by)
      values (${input.kind}, ${input.url}, ${input.fileName}, ${input.contentType}, ${input.sizeBytes}, ${sql.json(input.alt)}, ${ctx.userId})
      returning *
    `
  );
  return row;
}

/** A URL is "in use" if any CMS content table currently references it. */
async function isMediaUrlInUse(ctx: TenantContext, url: string): Promise<boolean> {
  return withTenantContext(ctx, async (sql) => {
    const rows = await sql<{ found: boolean }[]>`
      select exists(
        select 1 from brand_settings where logo_url = ${url} or logo_dark_url = ${url} or favicon_url = ${url} or footer_logo_url = ${url}
        union all
        select 1 from homepage_banner where desktop_image_url = ${url} or mobile_image_url = ${url} or background_image_url = ${url}
        union all
        select 1 from homepage_banners where desktop_image_url = ${url} or mobile_image_url = ${url}
        union all
        select 1 from homepage_sections where image_url = ${url}
        union all
        select 1 from homepage_modules where image_url = ${url}
      ) as found
    `;
    return rows[0]?.found ?? false;
  });
}

export async function deleteMedia(ctx: TenantContext, id: string): Promise<{ ok: boolean; reason?: string }> {
  return withTenantContext(ctx, async (sql) => {
    const [media] = await sql<{ url: string }[]>`select url from site_media where id = ${id}`;
    if (!media) return { ok: false, reason: "not_found" };
    if (await isMediaUrlInUse(ctx, media.url)) return { ok: false, reason: "in_use" };
    await sql`delete from site_media where id = ${id}`;
    return { ok: true };
  });
}

// ── Publish history ─────────────────────────────────────────────────────

export type PublishHistoryRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  note: string | null;
  published_by_name: string | null;
  published_at: string;
};

export async function listPublishHistory(ctx: TenantContext, limit = 50): Promise<PublishHistoryRow[]> {
  return withTenantContext(
    ctx,
    (sql) => sql<PublishHistoryRow[]>`
      select ph.id, ph.entity_type, ph.entity_id, ph.note, u.display_name as published_by_name, ph.published_at
      from publish_history ph
      left join users u on u.id = ph.published_by
      order by ph.published_at desc
      limit ${limit}
    `
  );
}
