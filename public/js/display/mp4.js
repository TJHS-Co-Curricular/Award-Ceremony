/*
 * 大屏 · MP4 封装（导出影片用，零依赖）：把 WebCodecs 编好的视频帧包成标准 .mp4 文件。
 * 只有一条视频轨（H.264 = avc1，或 VP9 = vp09），每帧一个 chunk；mdat 和 co64 都用 64 位，超过 4 GB 也没问题。
 * 提供：mp4Mux({ kind, width, height, fps, desc, samples: [{ data: Uint8Array, key }] }) → Blob
 */
'use strict';

function mp4Mux({ kind, width, height, fps, desc, samples }) {
  const enc = new TextEncoder();
  // 小工具：按大端序写数字
  const W = () => {
    const a = [];
    const w = {
      u8: v => (a.push(v & 255), w), u16: v => (a.push((v >>> 8) & 255, v & 255), w),
      u32: v => (a.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255), w),
      u64: v => w.u32(Math.floor(v / 4294967296)).u32(v >>> 0),
      str: s => (a.push(...enc.encode(s)), w), zero: n => { for (let i = 0; i < n; i++) a.push(0); return w; },
      bytes: b => { for (let i = 0; i < b.length; i++) a.push(b[i]); return w; },
      done: () => Uint8Array.from(a)
    };
    return w;
  };
  const box = (type, ...parts) => {
    const len = 8 + parts.reduce((n, p) => n + p.length, 0), out = new Uint8Array(len);
    new DataView(out.buffer).setUint32(0, len); out.set(enc.encode(type), 4);
    let o = 8; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };
  const full = (type, ver, flags, body) => box(type, W().u8(ver).u8(flags >> 16).u16(flags & 0xffff).done(), body);
  const MATRIX = w => w.u32(0x10000).u32(0).u32(0).u32(0).u32(0x10000).u32(0).u32(0).u32(0).u32(0x40000000);

  const scale = fps * 100, delta = 100, n = samples.length, dur = n * delta;
  const ftyp = box('ftyp', W().str('isom').u32(0x200).str('isom').str('iso2').str(kind === 'avc' ? 'avc1' : 'vp09').str('mp41').done());
  const dataLen = samples.reduce((s, x) => s + x.data.length, 0);
  const mdatHead = W().u32(1).str('mdat').u64(16 + dataLen).done();
  const offsets = []; let off = ftyp.length + 16;
  for (const s of samples) { offsets.push(off); off += s.data.length; }

  const mvhd = full('mvhd', 0, 0, MATRIX(W().u32(0).u32(0).u32(scale).u32(dur).u32(0x10000).u16(0x100).zero(10)).zero(24).u32(2).done());
  const tkhd = full('tkhd', 0, 3, MATRIX(W().u32(0).u32(0).u32(1).u32(0).u32(dur).zero(8).u16(0).u16(0).u16(0).u16(0)).u32(width * 65536).u32(height * 65536).done());
  const mdhd = full('mdhd', 0, 0, W().u32(0).u32(0).u32(scale).u32(dur).u16(0x55c4).u16(0).done());
  const hdlr = full('hdlr', 0, 0, W().u32(0).str('vide').zero(12).str('VideoHandler').u8(0).done());
  const vmhd = full('vmhd', 0, 1, W().zero(8).done());
  const dinf = box('dinf', full('dref', 0, 0, W().u32(1).bytes(full('url ', 0, 1, new Uint8Array(0))).done()));
  const name = W().u8(13).str('AwardCeremony'); name.zero(32 - 14);
  const cfg = kind === 'avc' ? box('avcC', new Uint8Array(desc))
    : full('vpcC', 1, 0, W().u8(0).u8(51).u8((8 << 4) | (1 << 1)).u8(1).u8(1).u8(1).u16(0).done());   // VP9 profile 0、8 位、4:2:0、BT.709
  const colr = box('colr', W().str('nclx').u16(1).u16(1).u16(1).u8(0).done());   // BT.709 limited range
  const entry = box(kind === 'avc' ? 'avc1' : 'vp09', W().zero(6).u16(1).zero(16).u16(width).u16(height).u32(0x480000).u32(0x480000).u32(0).u16(1)
    .bytes(name.done()).u16(0x18).u16(0xffff).done(), cfg, colr);
  const stsd = full('stsd', 0, 0, W().u32(1).bytes(entry).done());
  const stts = full('stts', 0, 0, W().u32(1).u32(n).u32(delta).done());
  const keys = W(); let nk = 0; samples.forEach((s, i) => { if (s.key) { keys.u32(i + 1); nk++; } });
  const stss = full('stss', 0, 0, W().u32(nk).bytes(keys.done()).done());
  const sz = W().u32(0).u32(n); for (const s of samples) sz.u32(s.data.length);
  const stsz = full('stsz', 0, 0, sz.done());
  const stsc = full('stsc', 0, 0, W().u32(1).u32(1).u32(1).u32(1).done());
  const co = W().u32(n); for (const o of offsets) co.u64(o);
  const co64 = full('co64', 0, 0, co.done());
  const stbl = box('stbl', stsd, stts, stss, stsz, stsc, co64);
  const moov = box('moov', mvhd, box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', vmhd, dinf, stbl))));
  return new Blob([ftyp, mdatHead, ...samples.map(s => s.data), moov], { type: 'video/mp4' });
}
