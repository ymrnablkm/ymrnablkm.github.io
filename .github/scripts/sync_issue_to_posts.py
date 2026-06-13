#!/usr/bin/env python3
"""
把 GitHub Issue 解析为资源帖子并写回 data/posts.json。

支持 Issue Body 中使用字段（任一可选）：
    分类: 素材 / 软件 / 教程 / 其他
    大小: 860 MB
    图标: 🧰
    简介: 一句话描述
    详情:
    ...多行...
    百度网盘: https://...  提取码: xxxx
    夸克网盘: https://...
    阿里云盘: https://...
    置顶: true

标题 = Issue.title
分类还可以通过 labels 推断（label 名包含素材/软件/教程/其他等）
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

CATEGORY_MAP = {
    '素材': '素材', 'material': '素材', '设计': '素材', 'design': '素材',
    '软件': '软件', '便携': '软件', 'software': '软件', 'sw': '软件',
    '教程': '教程', '学习': '教程', 'tutorial': '教程', '课程': '教程',
    '其他': '其他', '其它': '其他', 'other': '其他',
}
DEFAULT_CATEGORY = '其他'
EMOJI_MAP = {'素材': '🎨', '软件': '🧰', '教程': '📚', '其他': '🗂️'}

POSTS_FILE = Path('data/posts.json')


def _normalize_url(raw):
    """规范化 URL：修复中文冒号、去掉末尾标点、确保有路径"""
    url = raw.strip()
    # 统一处理中文冒号为英文冒号
    url = url.replace('\uff1a', ':').replace('：', ':')
    # 去掉末尾的非 URL 字符（但保留 /s/xxx 部分）
    url = re.sub(r'[\s)）\]\}）"\']+$', '', url)
    # 如果 URL 只有域名没有路径，尝试补全
    if re.match(r'^https?://pan\.baidu\.com/?$', url):
        url = url.rstrip('/') + '/s/请替换为完整链接'
    elif re.match(r'^https?://pan\.quark\.cn/?$', url):
        url = url.rstrip('/') + '/s/请替换为完整链接'
    elif re.match(r'^https?://www\.aliyundrive\.com/?$', url):
        url = url.rstrip('/') + '/s/请替换为完整链接'
    return url


def extract_fields(text):
    fields = {}
    drives_raw = []

    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # 单行 key: value（支持中文冒号）
        single = re.match(
            r'^(标题|标题 title|分类|category|大小|size|图标|emoji|简介|desc|详情|fullDesc|description|置顶|pin|pinned|百度网盘|百度|baidu|夸克网盘|夸克|quark|阿里云盘|阿里|aliyun)\s*[：:]\s*(.*)$',
            line, re.I)
        if single:
            key = single.group(1).lower()
            value = single.group(2).strip()
            # 处理 详情: 的多行内容
            if key in ('详情', 'fulldesc', 'description'):
                full_lines = [value] if value else []
                j = i + 1
                while j < len(lines):
                    nxt = lines[j].strip()
                    if re.match(
                        r'^(分类|category|大小|size|图标|emoji|简介|desc|百度网盘|夸克网盘|阿里云盘|置顶|pin|pinned|百度|夸克|阿里)\s*[：:]',
                        nxt, re.I):
                        break
                    full_lines.append(lines[j])
                    j += 1
                fields['fulldesc'] = '\n'.join(full_lines).strip()
                i = j
                continue

            if key in ('百度网盘', '百度', 'baidu'):
                drives_raw.append(('百度网盘', value))
            elif key in ('夸克网盘', '夸克', 'quark'):
                drives_raw.append(('夸克网盘', value))
            elif key in ('阿里云盘', '阿里', 'aliyun'):
                drives_raw.append(('阿里云盘', value))
            else:
                fields[key] = value
            i += 1
            continue

        # body 中裸链接（没有显式 key），尝试匹配并提取
        url_match = re.search(r'https?://[^\s)，。；;）\]\}\'"]+', line)
        if url_match:
            link = url_match.group(0)
            # 尝试猜测网盘类型
            if 'pan.baidu' in link or ('baidu' in link and 'http' in link):
                drives_raw.append(('百度网盘', line))
            elif 'pan.quark' in link or ('quark' in link and 'http' in link):
                drives_raw.append(('夸克网盘', line))
            elif 'aliyundrive' in link or 'alipan' in link or ('aliyun' in link and 'http' in link):
                drives_raw.append(('阿里云盘', line))
        i += 1

    # 提取每个 drive 的 url 与 code
    drives = []
    for name, raw in drives_raw:
        raw_url = re.search(r'https?://[^\s)）\]\}）"\']+', raw)
        url = _normalize_url(raw_url.group(0)) if raw_url else ''
        code_match = re.search(r'(提取码|码)\s*[：:]?\s*([A-Za-z0-9]{1,15})', raw, re.I)
        code = code_match.group(2) if code_match else '—'
        if code and any(x in code for x in ['无', '没有', '不需要', '不需要码']):
            code = '—'
        drives.append({'name': name, 'url': url, 'code': code})

    # 为 body 中无 key 的情况，再整文本全局提取提取码（兜底）
    all_codes_in_body = re.findall(r'(提取码|码)\s*[：:]?\s*([A-Za-z0-9]{3,15})', text, re.I)
    if all_codes_in_body:
        for d in drives:
            if d['code'] == '—':
                d['code'] = all_codes_in_body[0][1]

    return fields, drives


def infer_category_from_labels(labels_raw):
    try:
        labels = json.loads(labels_raw) if isinstance(labels_raw, str) else labels_raw
    except Exception:
        labels = []
    for lb in labels:
        name = lb if isinstance(lb, str) else (lb.get('name') if isinstance(lb, dict) else '')
        for key, val in CATEGORY_MAP.items():
            if key.lower() in name.lower():
                return val
    return None


def main():
    title = (os.environ.get('ISSUE_TITLE') or '').strip()
    body = (os.environ.get('ISSUE_BODY') or '').strip()
    number = int(os.environ.get('ISSUE_NUMBER') or '0')
    state = os.environ.get('ISSUE_STATE') or 'open'
    labels_raw = os.environ.get('ISSUE_LABELS') or '[]'
    event_action = os.environ.get('EVENT_ACTION') or 'opened'

    if not number or not title:
        print('Skip: empty issue')
        _set_output(False, '忽略：空 Issue')
        return

    fields, drives = extract_fields(body)

    # 分类：优先 body 中字段，其次 labels
    cat_input = (fields.get('分类') or fields.get('category') or '').strip()
    category = None
    if cat_input:
        for key, val in CATEGORY_MAP.items():
            if key.lower() in cat_input.lower():
                category = val
                break
    if not category:
        category = infer_category_from_labels(labels_raw) or DEFAULT_CATEGORY

    emoji = (fields.get('图标') or fields.get('emoji') or '').strip() or EMOJI_MAP.get(category, '📦')
    size = (fields.get('大小') or fields.get('size') or '').strip()

    desc = (fields.get('简介') or fields.get('desc') or '').strip()
    if not desc:
        for raw_line in body.split('\n'):
            s = raw_line.strip()
            if s and not s.startswith('#') and '：' not in s[:15] and ':' not in s[:15] and not s.startswith('http'):
                desc = s
                break
    desc = desc[:200]

    full_desc = fields.get('fulldesc') or ''
    if not full_desc:
        full_desc = body.strip()

    pinned_input = (fields.get('置顶') or fields.get('pin') or fields.get('pinned') or '').strip().lower()
    pinned = any(x in pinned_input for x in ['true', '1', 'yes', '是', '✓'])

    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    post_id = 1000 + number

    # 加载现有 JSON
    if POSTS_FILE.exists():
        with open(POSTS_FILE, 'r', encoding='utf-8') as fh:
            try:
                posts = json.load(fh)
            except json.JSONDecodeError:
                posts = []
    else:
        POSTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        posts = []

    new_post = {
        'id': post_id,
        'title': title,
        'category': category,
        'emoji': emoji,
        'desc': desc,
        'fullDesc': full_desc,
        'size': size,
        'date': today,
        'drives': drives,
        'pinned': pinned,
    }

    existing = next((p for p in posts if p.get('id') == post_id), None)

    if state == 'closed':
        if existing:
            posts = [p for p in posts if p.get('id') != post_id]
            summary = f'删除帖子「{title}」'
            changed = True
        else:
            summary = '无变化（帖子不存在）'
            changed = False
    else:
        if existing:
            idx = posts.index(existing)
            posts[idx] = new_post
            summary = f'更新帖子「{title}」（分类：{category}）'
            changed = True
        else:
            posts.append(new_post)
            summary = f'新增帖子「{title}」（分类：{category}）'
            changed = True

    if changed:
        POSTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(POSTS_FILE, 'w', encoding='utf-8') as fh:
            json.dump(posts, fh, ensure_ascii=False, indent=2)
            fh.write('\n')

    _set_output(changed, summary)
    print(f'[sync] {summary} (changed={changed})')


def _set_output(changed, summary):
    out_path = os.environ.get('GITHUB_OUTPUT')
    if out_path:
        with open(out_path, 'a') as f:
            f.write(f'changed={"true" if changed else "false"}\n')
            f.write(f'summary={summary}\n')


if __name__ == '__main__':
    main()
