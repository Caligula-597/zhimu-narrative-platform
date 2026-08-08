-- Structured, per-role mechanism answers. option_key remains the leading or
-- selected option for backwards-compatible indexing; the complete private
-- ranking/allocation is kept in this host/server-only JSON object.
ALTER TABLE room_mechanism_decision_submissions
  ADD COLUMN answer jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE room_mechanism_decision_submissions
  ADD CONSTRAINT room_mechanism_submission_answer_object
  CHECK (jsonb_typeof(answer) = 'object');

COMMENT ON COLUMN room_mechanism_decision_submissions.answer IS
  'Canonical internal single-choice, full-ranking or fixed-total allocation answer; never project authored keys to Player APIs.';
