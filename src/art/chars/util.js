// Small canvas helpers for character sprites.
// hit flash: every pixel pulled towards warm white (keeps outline darker so the silhouette stays readable)
export function flashCanvas(c, k = 0.62) {
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const g = o.getContext('2d');
  g.drawImage(c, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    const kk = lum < 0.18 ? k * 0.55 : k;
    d[i] = Math.round(d[i] + (252 - d[i]) * kk); d[i + 1] = Math.round(d[i + 1] + (244 - d[i + 1]) * kk); d[i + 2] = Math.round(d[i + 2] + (236 - d[i + 2]) * kk);
  }
  g.putImageData(id, 0, 0);
  for (const k2 of ['ax', 'ay', 'ws']) if (c[k2] !== undefined) o[k2] = c[k2];
  return o;
}
