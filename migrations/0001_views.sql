-- 阅读数统计（Cloudflare D1）
-- 在 Cloudflare 控制台 → D1 → 选中数据库 → Console 中执行，
-- 或本地执行：npx wrangler d1 execute ymrnablkm-views --remote --file=./migrations/0001_views.sql

CREATE TABLE IF NOT EXISTS view_counts (
  slug TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS view_seen (
  slug TEXT NOT NULL,
  visitor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (slug, visitor)
);

CREATE INDEX IF NOT EXISTS idx_view_seen_slug ON view_seen (slug);
