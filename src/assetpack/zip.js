// Minimal ZIP reader (no external libs). Supports "stored" (0) and "deflate" (8) entries via the browser's
// DecompressionStream('deflate-raw'). Reads the central directory, so data descriptors are handled.
// Not supported: ZIP64, encryption, multi-disk archives (a clear error is thrown).

const td = new TextDecoder('utf-8');
const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
function decodeName(bytes, utf8) {
  if (utf8) return td.decode(bytes);
  let ascii = true; for (const b of bytes) if (b > 127) { ascii = false; break; }
  if (ascii) return td.decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { /* fall through */ }
  return Array.from(bytes, (b) => (b < 128 ? String.fromCharCode(b) : CP437[b - 128])).join('');
}

async function inflateRaw(u8) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Dieser Browser kann keine ZIP-Dateien entpacken (DecompressionStream fehlt).');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * readZip(ArrayBuffer|Uint8Array) → [{ name, path, dir, size, compressed, method, bytes(): Promise<Uint8Array>, blob(type): Promise<Blob> }]
 * Directory entries, macOS resource forks (__MACOSX/, ._*) and empty files are skipped.
 */
export function readZip(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // end of central directory: scan backwards (comment up to 64 KiB)
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Keine gültige ZIP-Datei (Verzeichnis-Ende nicht gefunden).');
  const count = dv.getUint16(eocd + 10, true);
  let cd = dv.getUint32(eocd + 16, true);
  if (cd === 0xffffffff || count === 0xffff) throw new Error('ZIP64-Archive werden nicht unterstützt – bitte als normales ZIP packen.');
  const out = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(cd, true) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt.');
    const flags = dv.getUint16(cd + 8, true), method = dv.getUint16(cd + 10, true);
    const csize = dv.getUint32(cd + 20, true), usize = dv.getUint32(cd + 24, true);
    const nlen = dv.getUint16(cd + 28, true), xlen = dv.getUint16(cd + 30, true), clen = dv.getUint16(cd + 32, true);
    const local = dv.getUint32(cd + 42, true);
    const path = decodeName(u8.subarray(cd + 46, cd + 46 + nlen), flags & 0x800);
    cd += 46 + nlen + xlen + clen;
    const dir = path.endsWith('/');
    const base = path.split('/').pop();
    if (dir || path.startsWith('__MACOSX/') || base.startsWith('._') || !usize) continue;
    if (flags & 1) throw new Error(`Verschlüsselte ZIP-Einträge werden nicht unterstützt (${path}).`);
    if (dv.getUint32(local, true) !== 0x04034b50) throw new Error(`ZIP-Eintrag beschädigt (${path}).`);
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = u8.subarray(start, start + csize);
    let cache = null;
    const bytes = async () => {
      if (cache) return cache;
      if (method === 0) cache = raw.slice();
      else if (method === 8) cache = await inflateRaw(raw);
      else throw new Error(`ZIP-Methode ${method} nicht unterstützt (${path}).`);
      return cache;
    };
    out.push({ name: base, path, dir: false, size: usize, compressed: csize, method, bytes, blob: async (type) => new Blob([await bytes()], { type: type || mimeOf(base) }) });
  }
  return out;
}

export function mimeOf(name) {
  const ext = name.toLowerCase().split('.').pop();
  return { png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp', txt: 'text/plain', md: 'text/plain', json: 'application/json' }[ext] || 'application/octet-stream';
}
export const isImageName = (n) => /\.(png|gif|webp|bmp)$/i.test(n);
export const isLicenseName = (n) => /(licen[cs]e|read_?me|copying|terms|credits)/i.test(n) && /\.(txt|md)$|^[^.]+$/i.test(n);

/** Expand a list of File/Blob objects (ZIPs are unpacked) into [{ name, path, blob }] image entries + license texts. */
export async function expandFiles(files) {
  const images = [], texts = [];
  for (const f of files) {
    const name = f.name || 'datei.png';
    if (/\.zip$/i.test(name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
      const entries = readZip(await f.arrayBuffer());
      for (const e of entries) {
        if (isImageName(e.name)) images.push({ name: e.name, path: e.path, blob: await e.blob() });
        else if (isLicenseName(e.name)) texts.push({ name: e.path, text: td.decode(await e.bytes()) });
      }
    } else if (isImageName(name) || (f.type || '').startsWith('image/')) images.push({ name, path: f.webkitRelativePath || name, blob: f });
    else if (isLicenseName(name)) texts.push({ name, text: await f.text() });
  }
  return { images, texts };
}
