-- Redesigns EcoGame for preschoolers (ages 4-6): 5 new interaction
-- templates that need no reading (nurture, drag_collect, puzzle_assemble,
-- sound_match, catch), on top of the 5 built for the first EcoGame pass.

alter table games drop constraint games_template_check;
alter table games
  add constraint games_template_check check (
    template in (
      'drag_sort', 'quiz_match', 'click_target', 'sequence_order', 'scenario_decision',
      'nurture', 'drag_collect', 'puzzle_assemble', 'sound_match', 'catch'
    )
  );
