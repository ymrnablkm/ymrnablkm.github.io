// 本地联调存储：仅在本地 node scripts/dev-server.mjs 时使用，直接读写项目文件
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export function createLocalStore(env) {
  const root = env.LOCAL_ROOT || process.cwd();
  const branch = 'local';

  function abs(relative) {
    const target = path.resolve(root, relative);
    if (!target.startsWith(path.resolve(root))) {
      throw new Error('非法路径');
    }
    return target;
  }

  async function statSafe(absolute) {
    try {
      return await fs.stat(absolute);
    } catch {
      return null;
    }
  }

  async function getFile(relative) {
    const absolute = abs(relative);
    const info = await statSafe(absolute);
    if (!info || info.isDirectory()) return null;
    const buffer = await fs.readFile(absolute);
    return {
      text: buffer.toString('utf8'),
      sha: crypto.createHash('sha1').update(buffer).digest('hex'),
      size: info.size,
    };
  }

  async function getBase64(relative) {
    const absolute = abs(relative);
    const info = await statSafe(absolute);
    if (!info || info.isDirectory()) return null;
    const buffer = await fs.readFile(absolute);
    return {
      base64: buffer.toString('base64'),
      sha: crypto.createHash('sha1').update(buffer).digest('hex'),
      size: info.size,
    };
  }

  async function writeFile(relative, content, { base64 = false, sha } = {}) {
    const absolute = abs(relative);
    if (sha) {
      const current = await getFile(relative);
      if (current && current.sha !== sha) {
        throw new Error('文件已被其他操作修改，请刷新后重试（SHA 冲突）');
      }
    }
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    const buffer = base64 ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
    await fs.writeFile(absolute, buffer);
    return { sha: crypto.createHash('sha1').update(buffer).digest('hex'), commit: null };
  }

  async function putFile(relative, text, message, sha) {
    return writeFile(relative, text, { sha });
  }

  async function putBinary(relative, base64, message, sha) {
    return writeFile(relative, base64, { base64: true, sha });
  }

  async function deleteFile(relative, message, sha) {
    const absolute = abs(relative);
    if (sha) {
      const current = await getFile(relative);
      if (current && current.sha !== sha) {
        throw new Error('文件已被其他操作修改，请刷新后重试（SHA 冲突）');
      }
    }
    try {
      await fs.unlink(absolute);
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  }

  async function listDir(relative) {
    const absolute = abs(relative);
    const info = await statSafe(absolute);
    if (!info || !info.isDirectory()) return [];
    const names = await fs.readdir(absolute);
    const items = [];
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const childAbs = path.join(absolute, name);
      const childInfo = await fs.stat(childAbs);
      const childRel = `${relative}/${name}`.replace(/^\/+/, '');
      items.push({
        name,
        path: childRel,
        sha: null,
        size: childInfo.size,
        type: childInfo.isDirectory() ? 'dir' : 'file',
      });
    }
    return items;
  }

  async function listTree(prefix) {
    const results = [];
    async function walk(relative) {
      const items = await listDir(relative);
      for (const item of items) {
        if (item.type === 'dir') await walk(item.path);
        else results.push(item);
      }
    }
    await walk(prefix.replace(/\/$/, ''));
    return results;
  }

  async function commits(relative, limit = 20) {
    try {
      const { stdout } = await run('git', [
        'log',
        '--pretty=format:%H|%ad|%an|%s',
        '--date=iso',
        '-n',
        String(limit),
        '--',
        relative,
      ]);
      return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [sha, date, author, ...rest] = line.split('|');
          return { sha, date, author, message: rest.join('|') };
        });
    } catch {
      return [];
    }
  }

  async function fileAtRef(relative, ref) {
    const { stdout } = await run('git', ['show', `${ref}:${relative}`], { maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  }

  async function repoInfo() {
    return {
      fullName: '本地开发模式（不写入 GitHub）',
      private: true,
      defaultBranch: branch,
      pushedAt: new Date().toISOString(),
      htmlUrl: '',
    };
  }

  async function workflowRuns() {
    return { available: false, runs: [] };
  }

  async function recentCommits(limit = 10) {
    try {
      const { stdout } = await run('git', ['log', '-n', String(limit), '--pretty=format:%H|%ad|%an|%s', '--date=iso']);
      return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [sha, date, author, ...rest] = line.split('|');
          return { sha, date, author, message: rest.join('|') };
        });
    } catch {
      return [];
    }
  }

  // 本地环境没有原子提交，按顺序写入（仅开发调试使用）
  async function commitFiles(files, message) {
    for (const file of files) {
      const absolute = abs(file.path);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, Buffer.from(file.base64, 'base64'));
    }
    return { commit: null };
  }

  return {
    kind: 'local',
    repo: 'local',
    branch,
    getFile,
    getBase64,
    putFile,
    putBinary,
    deleteFile,
    listDir,
    listTree,
    commitFiles,
    commits,
    fileAtRef,
    repoInfo,
    workflowRuns,
    recentCommits,
  };
}
