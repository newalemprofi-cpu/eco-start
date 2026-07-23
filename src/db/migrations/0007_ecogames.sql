-- Expands the single waste-sorting game into a 15-game EcoGame catalog.
-- `games` was already global reference content (no RLS, see 0002_rls.sql)
-- with a `config jsonb` column for game-specific data — this migration
-- only adds the catalog/display metadata every game now needs; the
-- existing `waste_sorting` row keeps working unchanged (its own columns
-- just get real values instead of relying on hardcoded UI copy).

alter table games
  add column if not exists icon text not null default 'Gamepad2',
  add column if not exists color text not null default 'var(--module-game)',
  add column if not exists difficulty text not null default 'easy',
  add column if not exists age_min int not null default 4,
  add column if not exists age_max int not null default 7,
  add column if not exists xp_reward int not null default 30,
  add column if not exists badge_key text,
  add column if not exists template text not null default 'quiz_match',
  add column if not exists display_order int not null default 0;

alter table games
  add constraint games_difficulty_check check (difficulty in ('easy', 'medium', 'hard'));

alter table games
  add constraint games_template_check check (
    template in ('drag_sort', 'quiz_match', 'click_target', 'sequence_order', 'scenario_decision')
  );

create index if not exists idx_games_display_order on games(display_order);
