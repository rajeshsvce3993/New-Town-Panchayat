import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const img = await Jimp.read(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'login-office.jpg')
);
const w = img.bitmap.width;
const h = img.bitmap.height;
console.log('size', w, 'x', h, 'ratio', (w / h).toFixed(4));

function rgb(x, y) {
  const c = img.getPixelColor(Math.min(x, w - 1), Math.min(y, h - 1));
  return { r: (c >> 24) & 255, g: (c >> 16) & 255, b: (c >> 8) & 255 };
}

function isCard(x, y) {
  const { r, g, b } = rgb(x, y);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 248 && g > 248 && b > 248 && max - min < 8;
}

let minX = w;
let maxX = 0;
let minY = h;
let maxY = 0;
let count = 0;
for (let y = 0; y < h; y += 1) {
  for (let x = Math.floor(w * 0.55); x < w; x += 1) {
    if (isCard(x, y)) {
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const box = {
  minX,
  minY,
  maxX,
  maxY,
  count,
  left: +(minX / w * 100).toFixed(2),
  top: +(minY / h * 100).toFixed(2),
  width: +((maxX - minX) / w * 100).toFixed(2),
  height: +((maxY - minY) / h * 100).toFixed(2),
};
console.log(box);

for (const [name, x, y] of [
  ['mid-card', Math.round((minX + maxX) / 2), Math.round((minY + maxY) / 2)],
  ['title-area', Math.round(minX + (maxX - minX) * 0.5), Math.round(minY + (maxY - minY) * 0.22)],
  ['field-area', Math.round(minX + (maxX - minX) * 0.5), Math.round(minY + (maxY - minY) * 0.48)],
]) {
  console.log(name, x, y, rgb(x, y));
}
