-- Cron job audit log
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  run_type TEXT NOT NULL
    CHECK (run_type IN ('land_registry_import','lead_generation')),
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started','completed','failed','skipped')),

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  import_month TEXT,                   -- YYYY-MM

  -- Import metrics
  rows_downloaded INTEGER,
  rows_parsed INTEGER,
  rows_inserted INTEGER,
  rows_skipped INTEGER,

  -- Lead generation metrics
  users_processed INTEGER,
  leads_generated INTEGER,
  emails_sent INTEGER,
  users_at_max_radius INTEGER,

  error_message TEXT,
  error_stack TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pr_run_type_month ON pipeline_runs(run_type, import_month);

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to pipeline_runs"
  ON pipeline_runs FOR ALL
  USING (false);
