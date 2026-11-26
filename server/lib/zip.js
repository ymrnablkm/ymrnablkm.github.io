// 极简 ZIP 读写（仅 STORE 存储方式，足够备份/恢复使用）
// 写出：标准 ZIP 结构；读取：只接受 method 0（本项目导出的备份包）

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const d = date || new Date();
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const day = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, day };
}

function u16(value) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concat(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function createZip(files) {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(new Date());
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);

    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(day),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    localChunks.push(local);

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(day),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralChunks.push(central);
    offset += local.length;
  }

  const centralDir = concat(centralChunks);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...localChunks, centralDir, eocd]);
}

function readU16(view, offset) {
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

// 解析 ZIP：只支持 STORE（method 0），带完整性检查
export function parseZip(buffer, options = {}) {
  const maxBytes = options.maxBytes || 30 * 1024 * 1024;
  const maxEntries = options.maxEntries || 1000;
  const bytes = new Uint8Array(buffer);
  if (bytes.length > maxBytes) throw new Error('备份文件过大');
  const view = new DataView(bytes.buffer);

  // 从尾部查找 EOCD
  let eocd = -1;
  const start = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= start; i--) {
    if (readU32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('不是有效的 ZIP 文件');

  const count = readU16(view, eocd + 10);
  const centralOffset = readU32(view, eocd + 16);
  if (count > maxEntries) throw new Error('备份包文件数量过多');

  const decoder = new TextDecoder();
  const entries = [];
  let cursor = centralOffset;

  for (let i = 0; i < count; i++) {
    if (readU32(view, cursor) !== 0x02014b50) throw new Error('ZIP 目录结构损坏');
    const method = readU16(view, cursor + 10);
    const compressedSize = readU32(view, cursor + 20);
    const size = readU32(view, cursor + 24);
    const nameLength = readU16(view, cursor + 28);
    const extraLength = readU16(view, cursor + 30);
    const commentLength = readU16(view, cursor + 32);
    const localOffset = readU32(view, cursor + 42);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (method !== 0) throw new Error(`不支持压缩格式（${name}），请重新导出备份后再恢复`);
    if (readU32(view, localOffset) !== 0x04034b50) throw new Error('ZIP 文件头损坏');

    const localNameLength = readU16(view, localOffset + 26);
    const localExtraLength = readU16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > bytes.length) throw new Error('ZIP 数据不完整');
    if (compressedSize !== size) throw new Error('ZIP 数据长度不一致');

    entries.push({ name, data: bytes.slice(dataStart, dataStart + compressedSize) });
  }

  return entries;
}
