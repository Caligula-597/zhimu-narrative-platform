-- 织幕积分：余额 + 流水（Beta 首月 UI 默认隐藏，后端先记账与发放）

CREATE TABLE IF NOT EXISTS user_credit_balances (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_granted integer NOT NULL DEFAULT 0 CHECK (lifetime_granted >= 0),
  lifetime_spent integer NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
  last_monthly_grant_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_type text,
  ref_id text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_ledger_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS credit_ledger_user_created_idx
  ON credit_ledger (user_id, created_at DESC);

ALTER TABLE user_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
