ALTER TABLE history ADD COLUMN language TEXT NOT NULL DEFAULT '';
ALTER TABLE history ADD COLUMN provider TEXT NOT NULL DEFAULT '';
ALTER TABLE history ADD COLUMN model TEXT NOT NULL DEFAULT '';
CREATE INDEX history_context ON history(user_id,language,provider,model,created_at);
