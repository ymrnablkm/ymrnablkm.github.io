// GitHub 内容存储：服务端使用 Token 通过 GitHub Contents API 读写仓库
const API = 'https://api.github.com';

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(String(base64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function createGitHubStore(env) {
  const repo = env.GITHUB_REPO || 'ymrnablkm/ymrnablkm.github.io';
  const branch = env.GITHUB_BRANCH || 'main';
  const token = env.GITHUB_TOKEN;

  async function request(path, options = {}) {
    if (!token) {
      throw new Error('未配置 GITHUB_TOKEN，无法同步到 GitHub');
    }
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'aether-yard-cms',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {}),
      },
    });
    return response;
  }

  async function getFile(path) {
    const response = await request(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`读取 ${path} 失败（${response.status}）：${detail.slice(0, 150)}`);
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return { list: data };
    }
    return { text: fromBase64(data.content), sha: data.sha, size: data.size };
  }

  async function getBase64(path) {
    const response = await request(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`读取 ${path} 失败（${response.status}）：${detail.slice(0, 150)}`);
    }
    const data = await response.json();
    if (Array.isArray(data)) return null;
    return { base64: String(data.content || '').replace(/\s/g, ''), sha: data.sha, size: data.size };
  }

  async function putBase64(path, base64, message, sha) {
    const body = {
      message: message || `更新 ${path}`,
      content: base64,
      branch,
    };
    if (sha) body.sha = sha;
    const response = await request(`/repos/${repo}/contents/${encodeURI(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 409) {
        throw new Error('文件已被其他操作修改，请刷新后重试（SHA 冲突）');
      }
      throw new Error(`保存 ${path} 失败（${response.status}）：${detail.slice(0, 150)}`);
    }
    const data = await response.json();
    return { sha: data.content?.sha, commit: data.commit?.sha };
  }

  async function putFile(path, text, message, sha) {
    return putBase64(path, toBase64(text), message, sha);
  }

  async function putBinary(path, base64, message, sha) {
    return putBase64(path, base64.replace(/\s/g, ''), message, sha);
  }

  async function deleteFile(path, message, sha) {
    let fileSha = sha;
    if (!fileSha) {
      const current = await getFile(path);
      fileSha = current?.sha;
    }
    if (!fileSha) return { deleted: false };
    const response = await request(`/repos/${repo}/contents/${encodeURI(path)}`, {
      method: 'DELETE',
      body: JSON.stringify({ message: message || `删除 ${path}`, sha: fileSha, branch }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`删除 ${path} 失败（${response.status}）：${detail.slice(0, 150)}`);
    }
    return { deleted: true };
  }

  async function listDir(path) {
    const response = await request(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
    if (response.status === 404) return [];
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`读取目录 ${path} 失败（${response.status}）：${detail.slice(0, 150)}`);
    }
    const data = await response.json();
    return Array.isArray(data)
      ? data.map((item) => ({ name: item.name, path: item.path, sha: item.sha, size: item.size, type: item.type }))
      : [];
  }

  async function listTree(prefix) {
    const response = await request(`/repos/${repo}/git/trees/${branch}?recursive=1`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`读取文件树失败（${response.status}）：${detail.slice(0, 150)}`);
    }
    const data = await response.json();
    return (data.tree || [])
      .filter((item) => item.type === 'blob' && item.path.startsWith(prefix))
      .map((item) => ({ name: item.path.split('/').pop(), path: item.path, sha: item.sha, size: item.size, type: 'file' }));
  }

  async function commits(path, limit = 20) {
    const response = await request(
      `/repos/${repo}/commits?path=${encodeURIComponent(path)}&sha=${branch}&per_page=${limit}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data || []).map((item) => ({
      sha: item.sha,
      message: item.commit?.message || '',
      date: item.commit?.author?.date || '',
      author: item.commit?.author?.name || '',
    }));
  }

  async function fileAtRef(path, ref) {
    const response = await request(`/repos/${repo}/contents/${encodeURI(path)}?ref=${ref}`);
    if (!response.ok) throw new Error(`读取历史版本失败（${response.status}）`);
    const data = await response.json();
    return fromBase64(data.content);
  }

  async function repoInfo() {
    const response = await request(`/repos/${repo}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      fullName: data.full_name,
      private: data.private,
      defaultBranch: data.default_branch,
      pushedAt: data.pushed_at,
      htmlUrl: data.html_url,
    };
  }

  async function workflowRuns(limit = 5) {
    const response = await request(`/repos/${repo}/actions/runs?per_page=${limit}`);
    if (!response.ok) return { available: false, runs: [] };
    const data = await response.json();
    return {
      available: true,
      runs: (data.workflow_runs || []).map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        url: run.html_url,
        headSha: run.head_sha,
      })),
    };
  }

  async function recentCommits(limit = 10) {
    const response = await request(`/repos/${repo}/commits?sha=${branch}&per_page=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data || []).map((item) => ({
      sha: item.sha,
      message: (item.commit?.message || '').split('\n')[0],
      date: item.commit?.author?.date || '',
      author: item.commit?.author?.name || '',
    }));
  }

  return {
    kind: 'github',
    repo,
    branch,
    getFile,
    getBase64,
    putFile,
    putBinary,
    deleteFile,
    listDir,
    listTree,
    commits,
    fileAtRef,
    repoInfo,
    workflowRuns,
    recentCommits,
  };
}
