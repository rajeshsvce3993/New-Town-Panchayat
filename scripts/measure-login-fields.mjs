import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const img = await Jimp.read(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'login-office.jpg')
);
const w = img.bitmap.width;
const h = img.bitmap.height;

function rgb(x, y) {
  const c = img.getPixelColor(Math.min(Math.max(x, 0), w - 1), Math.min(Math.max(y, 0), h - 1));
  return { r: (c >> 24) & 255, g: (c >> 16) & 255, b: (c >> 8) & 255 };
}

function isNavy(x, y) {
  const { r, g, b } = rgb(x, y);
  return r < 45 && g < 55 && b > 55 && b < 120;
}

const rows = [];
for (let y = Math.round(h * 0.45); y < Math.round(h * 0.75); y++) {
  let hits = 0;
  let minX = w;
  let maxX = 0;
  for (let x = Math.round(w * 0.58); x < Math.round(w * 0.96); x++) {
    if (isNavy(x, y)) {
      hits++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (hits > 80) rows.push({ y, hits, left: +(minX / w * 100).toFixed(2), right: +(maxX / w * 100).toFixed(2), top: +(y / h * 100).toFixed(2) });
}
console.log(rows.slice(0, 30));
if (rows.length) {
  console.log('navy span', rows[0].y, rows[rows.length - 1].y, +(rows[0].y / h * 100).toFixed(2), +(rows[rows.length - 1].y / h * 100).toFixed(2));
}
