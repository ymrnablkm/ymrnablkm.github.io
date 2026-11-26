// 本地开发用的 D1 兼容层：基于 Node 内置 SQLite（node:sqlite），
// 让本地也能跑与线上一致的 D1 SQL（去重主键、原子自增、RETURNING）。
// 仅 dev-server 使用，线上仍然使用真正的 Cloudflare D1 绑定。

export async function createLocalD1(filename) {
  const { DatabaseSync } = await import('node:sqlite');
  const fs = await import('node:fs');
  const path = await import('node:path');

  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode = WAL');

  const make = (sql, args = []) => ({
    sql,
    bind: (...next) => make(sql, next),
    async run() {
      const info = sqlite.prepare(sql).run(...args);
      return { meta: { changes: Number(info.changes) || 0 } };
    },
    async first() {
      const row = sqlite.prepare(sql).get(...args);
      return row ? { ...row } : null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...args).map((row) => ({ ...row })) };
    },
  });

  return {
    prepare: (sql) => make(sql),
    async batch(statements) {
      const out = [];
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) out.push(await statement.run());
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return out;
    },
  };
}
