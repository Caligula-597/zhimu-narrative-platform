-- Enable RLS on public tables added after 045_enable_public_rls.sql

DO $$
DECLARE
  target_table text;
  rls_tables text[] := ARRAY[
    'credit_ledger',
    'player_suspicions',
    'player_task_progress',
    'player_tasks',
    'room_private_actions',
    'room_role_states',
    'room_vote_ballots',
    'room_vote_options',
    'room_votes',
    'segment_remedies',
    'testimonies',
    'user_credit_balances',
    'user_llm_connections',
    'user_llm_preferences',
    'world_core_tricks',
    'world_foreshadow_beats',
    'world_quality_reports',
    'world_role_archives',
    'world_role_relationships',
    'world_segment_refs',
    'world_segments',
    'world_tags',
    'world_timeline_events',
    'world_truth_claims'
  ];
BEGIN
  FOREACH target_table IN ARRAY rls_tables LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    END IF;
  END LOOP;
END $$;
