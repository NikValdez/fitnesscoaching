-- Track the four public accounts selected for daily collection. Canonical
-- identities reuse existing records and preserve all metrics, notes and history.
INSERT INTO rossiter_analytics_items(id, kind, identity, payload) VALUES
('c56a2445-6a82-49ca-b36e-13862549871d', 'account', 'instagram:steverossiter_', '{"title":"Steve Rossiter · Instagram","platform":"instagram","handle":"steverossiter_","url":"https://www.instagram.com/steverossiter_/","tags":[],"notes":"","autoRefresh":true,"metrics":{},"lastFetched":null}'),
('67d1ac2e-c99e-4b70-bf05-81ccbf9cbac3', 'account', 'tiktok:gymotheechalamet', '{"title":"Steve Rossiter · TikTok","platform":"tiktok","handle":"gymotheechalamet","url":"https://www.tiktok.com/@gymotheechalamet","tags":[],"notes":"","autoRefresh":true,"metrics":{},"lastFetched":null}'),
('38921054-9a53-436a-873f-e06a011f2a42', 'account', 'youtube:steverossiter_', '{"title":"Steve Rossiter · YouTube","platform":"youtube","handle":"steverossiter_","url":"https://www.youtube.com/@steverossiter_","tags":[],"notes":"","autoRefresh":true,"metrics":{},"lastFetched":null}'),
('61a310fe-6229-4bf5-86ea-ef640c145024', 'account', 'facebook:61595143955478', '{"title":"Steve Rossiter · Facebook","platform":"facebook","handle":"61595143955478","url":"https://www.facebook.com/profile.php?id=61595143955478","tags":[],"notes":"","autoRefresh":true,"metrics":{},"lastFetched":null}')
ON CONFLICT(kind, identity) DO UPDATE SET
  payload = rossiter_analytics_items.payload || jsonb_build_object(
    'url', excluded.payload->'url', 'handle', excluded.payload->'handle',
    'autoRefresh', true, 'archived', false
  ),
  version = rossiter_analytics_items.version + 1,
  updated_at = now(),
  next_refresh_at = now();
