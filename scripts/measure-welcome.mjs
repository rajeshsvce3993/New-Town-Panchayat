import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const img = await Jimp.read(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'login-office.jpg')
);
const w = img.bitmap.width;
const h = img.bitmap.height;

function rgb(x, y) {
  const c = img.getPixelColor(Math.min(x, w - 1), Math.min(y, h - 1));
  return { r: (c >> 24) & 255, g: (c >> 16) & 255, b: (c >> 8) & 255 };
}

function isInk(x, y) {
  const { r, g, b } = rgb(x, y);
  const avg = (r + g + b) / 3;
  return avg < 180 && Math.max(r, g, b) - Math.min(r, g, b) < 80;
}

const rows = [];
for (let y = Math.round(h * 0.45); y < Math.round(h * 0.80); y++) {
  let hits = 0;
  for (let x = Math.round(w * 0.60); x < Math.round(w * 0.94); x++) {
    if (isInk(x, y)) hits++;
  }
  if (hits > 6) rows.push({ y, hits, pct: +(y / h * 100).toFixed(2) });
}
console.log(rows);
