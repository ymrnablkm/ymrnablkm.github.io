#!/usr/bin/env python3
"""
把 GitHub Issue 解析为软件帖子并写回 data/software.json。

支持 Issue Body 中使用字段（任一可选）：
    标题: xxx
    分类: 软件 / 资源 / 游戏 / 其他
    版本: 2024.06
    大小: 860 MB
    简介: 一句话描述
    封面: https://...
    截图:
    https://... (每行一个)
    详情:
    ...多行详细介绍...
    下载:
    百度网盘: https://... 提取码: xxxx
    精选: true
    置顶: true
    标签: Windows, 工具

标题 = Issue.title

特殊标记：
    更新帖子ID: XXX — 更新指定 ID 的帖子
    删除帖子ID: XXX — 删除指定帖子
"""

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

CATEGORY_MAP = {
    '软件': '软件', '工具': '软件', 'software': '软件', 'sw': '软件',
    '资源': '资源', '素材': '资源', 'design': '资源', '图片': '资源',
    '游戏': '游戏', 'game': '游戏',
    '其他': '其他', '其它': '其他', 'other': '其他',
}
DEFAULT_CATEGORY = '软件'
CATEGORY_EMOJI = {'软件': '⊞', '资源': '◈', '游戏': '⬡', '其他': '◇'}

SOFTWARE_FILE = Path('data/software.json')


def _normalize_url(raw):
    """规范化 URL"""
    url = raw.strip()
    url = url.replace('\uff1a', ':').replace('：', ':')
    url = re.sub(r'[\s)）\]\}）"\']+$', '', url)
    # 补全不完整的网盘链接
    if re.match(r'^https?://pan\.baidu\.com/?$', url):
        url = url.rstrip('/') + '/s/请替换'
    elif re.match(r'^https?://pan\.quark\.cn/?$', url):
        url = url.rstrip('/') + '/s/请替换'
    elif re.match(r'^https?://www\.aliyundrive\.com/?$', url):
        url = url.rstrip('/') + '/s/请替换'
    return url


def extract_fields(text):
    """解析 Issue Body，返回 (fields, drives, images)"""
    fields = {}
    drives_raw = []
    images_raw = []

    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # 匹配单行 key: value
        single = re.match(
            r'^(标题|title|分类|category|版本|version|大小|size|简介|desc|封面|cover|精选|featured|置顶|pinned|标签|tags)\s*[：:]\s*(.*)$',
            line, re.I)
        if single:
            key = single.group(1).lower()
            value = single.group(2).strip()
            
            # 多行内容处理
            if key in ('详情', 'content', 'description'):
                full_lines = [value] if value else []
                j = i + 1
                while j < len(lines):
                    nxt = lines[j].strip()
                    # 遇到新的 key: 或 section: 就停止
                    if re.match(r'^[^\s：:]+\s*[：:]', nxt) or nxt.startswith('#'):
                        break
                    if not nxt.startswith('截图') and not nxt.startswith('下载') and not nxt.startswith('截图:'):
                        full_lines.append(lines[j])
                    j += 1
                fields['content'] = '\n'.join(full_lines).strip()
                i = j
                continue
            
            if key in ('截图', 'images', 'screenshots'):
                img_lines = [value] if value else []
                j = i + 1
                while j < len(lines):
                    nxt = lines[j].strip()
                    if re.match(r'^[^\s：:]+\s*[：:]', nxt) or nxt.startswith('#') or nxt.startswith('下载'):
                        break
                    if nxt.startswith('http'):
                        img_lines.append(nxt)
                    j += 1
                images_raw.extend(img_lines)
                i = j
                continue

            fields[key] = value
            i += 1
            continue

        # 裸链接
        url_match = re.search(r'https?://[^\s)，。；;）\]\}\'"]+', line)
        if url_match:
            link = url_match.group(0)
            # 图片
            if re.search(r'\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$', link, re.I):
                images_raw.append(link)
            # 网盘
            elif 'pan.baidu' in link:
                drives_raw.append(('百度网盘', line))
            elif 'pan.quark' in link:
                drives_raw.append(('夸克网盘', line))
            elif 'aliyundrive' in link or 'alipan' in link:
                drives_raw.append(('阿里云盘', line))
            elif '123pan' in link:
                drives_raw.append(('123云盘', line))
            elif 'lanzou' in link:
                drives_raw.append(('蓝奏云', line))
            elif 'cloud.189' in link:
                drives_raw.append(('天翼云盘', line))
            elif 'pan.xunlei' in link or 'xunlei' in link:
                drives_raw.append(('迅雷云盘', line))

        i += 1

    # 解析下载链接
    drives = []
    for name, raw in drives_raw:
        raw_url = re.search(r'https?://[^\s)）\]\}）"\']+', raw)
        url = _normalize_url(raw_url.group(0)) if raw_url else ''
        code_match = re.search(r'(提取码|码|密码)\s*[：:]?\s*([A-Za-z0-9]{1,15})', raw, re.I)
        code = code_match.group(2) if code_match else '—'
        if any(x in code for x in ['无', '没有', '不需要', '空']):
            code = '—'
        drives.append({'name': name, 'url': url, 'code': code})

    # 全局提取码兜底
    all_codes = re.findall(r'(提取码|码|密码)\s*[：:]?\s*([A-Za-z0-9]{2,15})', text, re.I)
    for d in drives:
        if d['code'] == '—' and all_codes:
            d['code'] = all_codes[0][1]

    images = list(set(images_raw))
    return fields, drives, images


def main():
    title = (os.environ.get('ISSUE_TITLE') or '').strip()
    body = (os.environ.get('ISSUE_BODY') or '').strip()
    number = int(os.environ.get('ISSUE_NUMBER') or '0')
    state = os.environ.get('ISSUE_STATE') or 'open'
    event_action = os.environ.get('EVENT_ACTION') or 'opened'

    if not number or not title:
        print('Skip: empty issue')
        _set_output(False, '忽略：空 Issue')
        return

    fields, drives, images = extract_fields(body)

    # === 管理操作 ===
    override_id = None
    forced_delete = False

    update_match = re.search(r'(?:更新帖子ID|更新ID|edit_id)\s*[：:]\s*([\w-]+)', body, re.I)
    if update_match:
        override_id = update_match.group(1).strip()

    delete_match = re.search(r'(?:删除帖子ID|删除ID|delete_id)\s*[：:]\s*([\w-]+)', body, re.I)
    if delete_match:
        override_id = delete_match.group(1).strip()
        forced_delete = True

    # === 分类 ===
    cat_input = (fields.get('分类') or fields.get('category') or '').strip()
    category = DEFAULT_CATEGORY
    if cat_input:
        sorted_cats = sorted(CATEGORY_MAP.items(), key=lambda x: len(x[0]), reverse=True)
        for key, val in sorted_cats:
            if key.lower() in cat_input.lower():
                category = val
                break

    # === 其他字段 ===
    version = (fields.get('版本') or fields.get('version') or '').strip()
    size = (fields.get('大小') or fields.get('size') or '').strip()
    desc = (fields.get('简介') or fields.get('desc') or '').strip()
    cover = (fields.get('封面') or fields.get('cover') or '').strip()

    # 自动生成简介（如果没填）
    if not desc:
        for raw_line in body.split('\n'):
            s = raw_line.strip()
            if s and not s.startswith('#') and '：' not in s[:15] and ':' not in s[:15] and not s.startswith('http') and len(s) > 5:
                desc = s
                break
    desc = desc[:200]

    # 标签
    tags_input = (fields.get('标签') or fields.get('tags') or '').strip()
    tags = [t.strip() for t in tags_input.split(',') if t.strip()] if tags_input else []

    # 精选/置顶
    featured_input = (fields.get('精选') or fields.get('featured') or '').strip().lower()
    featured = any(x in featured_input for x in ['true', '1', 'yes', '是', '✓'])
    pinned_input = (fields.get('置顶') or fields.get('pinned') or '').strip().lower()
    pinned = any(x in pinned_input for x in ['true', '1', 'yes', '是', '✓'])

    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    post_id = override_id or ('sw-' + str(number))

    # === 加载数据 ===
    if SOFTWARE_FILE.exists():
        with open(SOFTWARE_FILE, 'r', encoding='utf-8') as fh:
            try:
                software = json.load(fh)
            except json.JSONDecodeError:
                software = []
    else:
        SOFTWARE_FILE.parent.mkdir(parents=True, exist_ok=True)
        software = []

    new_item = {
        'id': post_id,
        'title': title,
        'slug': re.sub(r'[^\w]+', '-', title.lower()),
        'category': category,
        'version': version,
        'size': size,
        'cover': cover,
        'images': images,
        'desc': desc,
        'content': fields.get('content') or body,
        'drives': drives,
        'tags': tags,
        'featured': featured,
        'pinned': pinned,
        'createdAt': today,
    }

    existing = next((s for s in software if s.get('id') == post_id), None)

    # === 执行操作 ===
    if forced_delete or state == 'closed':
        if existing:
            software = [s for s in software if s.get('id') != post_id]
            summary = f'删除帖子「{title}」（ID: {post_id}）'
            changed = True
        else:
            summary = '无变化（帖子不存在）'
            changed = False
    else:
        if existing:
            idx = software.index(existing)
            # 保留 createdAt
            new_item['createdAt'] = existing.get('createdAt', today)
            software[idx] = new_item
            summary = f'更新帖子「{title}」（ID: {post_id}，分类：{category}）'
            changed = True
        else:
            software.append(new_item)
            summary = f'新增帖子「{title}」（ID: {post_id}，分类：{category}）'
            changed = True

    if changed:
        SOFTWARE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SOFTWARE_FILE, 'w', encoding='utf-8') as fh:
            json.dump(software, fh, ensure_ascii=False, indent=2)
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
