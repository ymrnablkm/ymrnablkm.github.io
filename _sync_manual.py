#!/usr/bin/env python3
import json, re
from pathlib import Path
from datetime import datetime, timezone

body = """分类: 软件
大小: 666MB
图标: 🧰

简介: 测试使用

详情:
测试使用
·测试使用
·测试实用
·测试长度

百度网盘: https：//pan.baidu  提取码: 6666

置顶: false"""

title = "【软件】测试实用"
number = 1

def extract_fields(text):
    fields = {}
    drives_raw = []
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        single = re.match(
            r'^(标题|标题 title|分类|category|大小|size|图标|emoji|简介|desc|详情|fullDesc|description|置顶|pin|pinned|百度网盘|百度|baidu|夸克网盘|夸克|quark|阿里云盘|阿里|aliyun)\s*[：:]\s*(.*)$',
            line, re.I)
        if single:
            key = single.group(1).lower()
            value = single.group(2).strip()
            if key in ('详情', 'fulldesc', 'description'):
                full_lines = [value] if value else []
                j = i + 1
                while j < len(lines):
                    nxt = lines[j].strip()
                    if re.match(r'^(分类|category|大小|size|图标|emoji|简介|desc|百度网盘|夸克网盘|阿里云盘|置顶|pin|pinned|百度|夸克|阿里)\s*[：:]', nxt, re.I):
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
        if re.search(r'https?[：:]?//', line) or 'pan.baidu' in line or 'pan.quark' in line or 'aliyundrive' in line:
            link_match = re.search(r'(https?[：:]?//[^\s)]+)', line)
            if link_match:
                normalized = link_match.group(0).replace('：', ':')
                if 'pan.baidu' in normalized or 'baidu' in normalized:
                    drives_raw.append(('百度网盘', line))
                elif 'pan.quark' in normalized or 'quark' in normalized:
                    drives_raw.append(('夸克网盘', line))
                elif 'aliyundrive' in normalized or 'alipan' in normalized:
                    drives_raw.append(('阿里云盘', line))
        i += 1

    drives = []
    for name, raw in drives_raw:
        url_match = re.search(r'(https?[：:]?//[^\s)]+)', raw)
        url = url_match.group(0).replace('：', ':') if url_match else ''
        code_match = re.search(r'(提取码|码)\s*[：:]?\s*([A-Za-z0-9]{1,15})', raw, re.I)
        code = code_match.group(2) if code_match else '—'
        if code and any(x in code for x in ['无', '无提取码']):
            code = '—'
        drives.append({'name': name, 'url': url, 'code': code})
    return fields, drives


fields, drives = extract_fields(body)
cat_input = (fields.get('分类') or fields.get('category') or '').strip()
category = '其他'
for key, val in [('素材','素材'),('material','素材'),('软件','软件'),('教程','教程'),('其他','其他')]:
    if key in cat_input:
        category = val
        break
if category == '其他':
    for kw, cat in [('素材','素材'),('软件','软件'),('教程','教程')]:
        if kw in title:
            category = cat
            break

emoji = (fields.get('图标') or fields.get('emoji') or '').strip() or '🧰'
size = (fields.get('大小') or fields.get('size') or '').strip()
desc = (fields.get('简介') or fields.get('desc') or '').strip()
desc = desc[:200] or '—'
fulldesc = fields.get('fulldesc') or body.strip()
pinned_input = (fields.get('置顶') or fields.get('pin') or fields.get('pinned') or '').strip().lower()
pinned = any(x in pinned_input for x in ['true', 'yes', '是', '✓'])
today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
post_id = 1000 + number

print(f"解析结果:")
print(f"  title={title}")
print(f"  category={category}")
print(f"  emoji={emoji}")
print(f"  size={size}")
print(f"  desc={desc}")
print(f"  fulldesc 开头: {fulldesc[:60]}...")
print(f"  drives={drives}")
print(f"  pinned={pinned}")

posts_file = Path('data/posts.json')
with open(posts_file, 'r', encoding='utf-8') as f:
    posts = json.load(f)
posts = [p for p in posts if p.get('id') != post_id]
posts.append({
    'id': post_id, 'title': title, 'category': category, 'emoji': emoji,
    'desc': desc, 'fullDesc': fulldesc, 'size': size, 'date': today,
    'drives': drives, 'pinned': pinned
})
with open(posts_file, 'w', encoding='utf-8') as f:
    json.dump(posts, f, ensure_ascii=False, indent=2)
    f.write('\n')
print(f"\n✅ 已写入 data/posts.json，当前共 {len(posts)} 篇帖子")
