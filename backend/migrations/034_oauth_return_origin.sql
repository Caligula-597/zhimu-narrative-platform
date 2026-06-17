-- Optional post-OAuth redirect origin (play.getzhimu.com vs app.getzhimu.com)
ALTER TABLE oauth_states
  ADD COLUMN IF NOT EXISTS return_origin text;
