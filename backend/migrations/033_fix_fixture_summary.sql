-- Normalize CI fixture world summary (remove legacy fog demo text).
UPDATE worlds
SET summary = '后端集成测试用最小剧本。',
    updated_at = now()
WHERE id = '11111111-2222-4333-8444-555555550001'
  AND summary IN (
    'updated-by-test',
    '海雾将旧日的来信送回港口。',
    '海雾将旧日的来信送回港口'
  );
