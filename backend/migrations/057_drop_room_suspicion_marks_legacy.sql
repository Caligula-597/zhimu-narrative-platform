-- Legacy cleanup: environments that applied 047_content_platform_runtime.sql before renumber
-- may still have the deprecated room_suspicion_marks table (superseded by player_suspicions).
DROP TABLE IF EXISTS room_suspicion_marks;
