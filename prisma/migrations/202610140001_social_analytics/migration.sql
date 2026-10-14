CREATE TABLE rossiter_analytics_items (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('account', 'video', 'creator', 'campaign')),
  identity text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  next_refresh_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  UNIQUE (kind, identity)
);
CREATE INDEX rossiter_analytics_due ON rossiter_analytics_items(next_refresh_at) WHERE kind IN ('account', 'video');
CREATE TABLE rossiter_analytics_snapshots (
  item_id text NOT NULL REFERENCES rossiter_analytics_items(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  metrics jsonb NOT NULL CHECK (jsonb_typeof(metrics) = 'object'),
  source text NOT NULL,
  PRIMARY KEY (item_id, captured_at)
);
CREATE TABLE rossiter_analytics_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  automatic boolean NOT NULL DEFAULT true,
  interval_hours integer NOT NULL DEFAULT 24 CHECK (interval_hours = 24),
  daily_limit integer NOT NULL DEFAULT 500 CHECK (daily_limit BETWEEN 1 AND 5000)
);
INSERT INTO rossiter_analytics_settings(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE rossiter_analytics_usage (
  day date PRIMARY KEY, requests integer NOT NULL DEFAULT 0
);

CREATE INDEX rossiter_analytics_snapshot_date ON rossiter_analytics_snapshots(captured_at);
-- Start with the same public social profiles already linked on the website.
INSERT INTO rossiter_analytics_items(id, kind, identity, payload) VALUES
('c56a2445-6a82-49ca-b36e-13862549871d', 'account', 'instagram:steverossiter_', '{"title":"Steve Rossiter · Instagram","platform":"instagram","handle":"steverossiter_","url":"https://www.instagram.com/steverossiter_/","tags":[],"notes":"","autoRefresh":true,"metrics":{},"lastFetched":null}'),
('67d1ac2e-c99e-4b70-bf05-81ccbf9cbac3', 'account', 'tiktok:gymotheechalamet', '{"title":"Steve Rossiter · TikTok","platform":"tiktok","handle":"gymotheechalamet","url":"https://www.tiktok.com/@gymotheechalamet","tags":[],"notes":"","autoRefresh":true,"metrics":{},"lastFetched":null}');
