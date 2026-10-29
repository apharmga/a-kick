/* 비밀번호 걸린 엑셀(.xlsx) 풀기 — 브라우저 안에서만 처리 (파일·비밀번호는 서버로 안 보냄)
 * 지원: Agile 암호화(엑셀 2010 이후, 은행 앱 내보내기 대부분) · Standard 암호화(엑셀 2007)
 * 필요: window.XLSX (SheetJS 전체 빌드: XLSX.CFB 포함) · WebCrypto */
const subtle = crypto.subtle;
const u8 = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));
const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; a.forEach((x) => { o.set(x, p); p += x.length; }); return o; };
const le32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const utf16 = (s) => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { b[i * 2] = s.charCodeAt(i) & 255; b[i * 2 + 1] = s.charCodeAt(i) >> 8; } return b; };
const fit = (b, n, padByte) => { if (b.length >= n) return b.slice(0, n); const o = new Uint8Array(n).fill(padByte); o.set(b); return o; };
const HASH = { SHA1: 'SHA-1', 'SHA-1': 'SHA-1', SHA256: 'SHA-256', 'SHA-256': 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512', 'SHA-512': 'SHA-512' };
const hash = async (alg, data) => u8(await subtle.digest(alg, data));

/** 패딩 없는 AES-CBC 복호화 (WebCrypto는 PKCS7 패딩을 요구하므로 가짜 패딩 블록을 덧붙여 처리) */
async function aesCbcRaw(keyBytes, iv, data) {
  const key = await subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['encrypt', 'decrypt']);
  const last = data.slice(data.length - 16);
  const pad = u8(await subtle.encrypt({ name: 'AES-CBC', iv: last }, key, new Uint8Array(0)));   // E(0x10…16 ⊕ 마지막 블록)
  return u8(await subtle.decrypt({ name: 'AES-CBC', iv }, key, cat(data, pad.slice(0, 16))));
}
/** AES-ECB 복호화 = IV 0 인 CBC 복호화 뒤 이전 암호문 블록을 다시 XOR */
async function aesEcbRaw(keyBytes, data) {
  const out = await aesCbcRaw(keyBytes, new Uint8Array(16), data);
  for (let i = 16; i < out.length; i++) out[i] ^= data[i - 16];
  return out;
}

function entry(cfb, name) {
  const i = cfb.FullPaths.findIndex((p) => p.replace(/\/$/, '').split('/').pop() === name);
  return i < 0 ? null : u8(cfb.FileIndex[i].content);
}
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** 이 파일이 비밀번호 걸린 엑셀인가 */
export function isEncrypted(buf) {
  const b = u8(buf);
  if (!(b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0)) return false;   // OLE 컨테이너
  try { const cfb = window.XLSX.CFB.read(b, { type: 'array' }); return !!entry(cfb, 'EncryptionInfo') && !!entry(cfb, 'EncryptedPackage'); } catch (e) { return false; }
}

/** 비밀번호로 풀어서 일반 xlsx 바이트를 돌려줌. 비밀번호가 틀리면 Error('WRONG_PASSWORD') */
export async function decryptXlsx(buf, password) {
  const cfb = window.XLSX.CFB.read(u8(buf), { type: 'array' });
  const info = entry(cfb, 'EncryptionInfo'), pkg = entry(cfb, 'EncryptedPackage');
  if (!info || !pkg) throw new Error('암호화된 엑셀이 아니에요');
  const dv = new DataView(info.buffer, info.byteOffset, info.byteLength), vMaj = dv.getUint16(0, true), vMin = dv.getUint16(2, true);
  const size = Number(new DataView(pkg.buffer, pkg.byteOffset, 8).getBigUint64(0, true)), body = pkg.slice(8);
  const pw = utf16(password);

  if (vMaj === 4 && vMin === 4) {   // ---- Agile ----
    const xml = new TextDecoder('utf-8').decode(info.slice(8));
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const kd = doc.getElementsByTagNameNS('*', 'keyData')[0], ek = doc.getElementsByTagNameNS('*', 'encryptedKey')[0];
    if (!kd || !ek) throw new Error('지원하지 않는 암호화 방식이에요');
    const A = (el, k) => el.getAttribute(k);
    const pHash = HASH[A(ek, 'hashAlgorithm')], spin = +A(ek, 'spinCount'), pSalt = b64(A(ek, 'saltValue')), keyBytes = +A(ek, 'keyBits') / 8, bs = +A(ek, 'blockSize');
    let h = await hash(pHash, cat(pSalt, pw));
    for (let i = 0; i < spin; i++) h = await hash(pHash, cat(le32(i), h));
    const derive = async (blockKey) => fit(await hash(pHash, cat(h, new Uint8Array(blockKey))), keyBytes, 0x36);
    // 비밀번호 확인 (검증값)
    const vIn = await aesCbcRaw(await derive([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]), fit(pSalt, bs, 0x36), b64(A(ek, 'encryptedVerifierHashInput')));
    const vHash = await aesCbcRaw(await derive([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]), fit(pSalt, bs, 0x36), b64(A(ek, 'encryptedVerifierHashValue')));
    const calc = await hash(pHash, vIn.slice(0, pSalt.length));
    if (!eq(calc, vHash.slice(0, calc.length))) throw new Error('WRONG_PASSWORD');
    const secret = (await aesCbcRaw(await derive([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]), fit(pSalt, bs, 0x36), b64(A(ek, 'encryptedKeyValue')))).slice(0, keyBytes);
    const dHash = HASH[A(kd, 'hashAlgorithm')], dSalt = b64(A(kd, 'saltValue')), dBs = +A(kd, 'blockSize');
    const parts = [];
    for (let i = 0, off = 0; off < body.length; i++, off += 4096) {
      const seg = body.slice(off, Math.min(off + 4096, body.length));
      const iv = fit(await hash(dHash, cat(dSalt, le32(i))), dBs, 0x36);
      parts.push(await aesCbcRaw(secret, iv, seg));
    }
    return cat(...parts).slice(0, size);
  }

  if ((vMaj === 3 || vMaj === 4) && vMin === 2) {   // ---- Standard (엑셀 2007, AES + SHA-1) ----
    const hSize = dv.getUint32(8, true), hdr = 12, keyBits = dv.getUint32(hdr + 16, true) || 128;
    let p = hdr + hSize; const sSize = dv.getUint32(p, true); p += 4;
    const salt = info.slice(p, p + sSize); p += sSize;
    const encVer = info.slice(p, p + 16); p += 16;
    const vhSize = dv.getUint32(p, true); p += 4;
    const encVerHash = info.slice(p, p + 32);
    let h = await hash('SHA-1', cat(salt, pw));
    for (let i = 0; i < 50000; i++) h = await hash('SHA-1', cat(le32(i), h));
    h = await hash('SHA-1', cat(h, le32(0)));
    const x = async (c) => { const b = new Uint8Array(64).fill(c); for (let i = 0; i < h.length; i++) b[i] ^= h[i]; return hash('SHA-1', b); };
    const key = cat(await x(0x36), await x(0x5c)).slice(0, keyBits / 8);
    const ver = await aesEcbRaw(key, encVer), verHash = await aesEcbRaw(key, encVerHash);
    if (!eq(await hash('SHA-1', ver), verHash.slice(0, vhSize))) throw new Error('WRONG_PASSWORD');
    const n = Math.floor(body.length / 16) * 16;
    return (await aesEcbRaw(key, body.slice(0, n))).slice(0, size);
  }
  throw new Error('지원하지 않는 암호화 방식이에요 (버전 ' + vMaj + '.' + vMin + ')');
}
