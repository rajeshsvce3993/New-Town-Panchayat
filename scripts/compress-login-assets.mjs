import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

const logo = await Jimp.read(path.join(publicDir, 'app_logo.png'));
await logo.resize({ w: 160, h: 160 });
await logo.write(path.join(publicDir, 'login-logo.png'));
console.log('login-logo.png', logo.bitmap.width, 'x', logo.bitmap.height);

const scene = await Jimp.read(path.join(publicDir, 'login-office-scene.jpg'));
if (scene.bitmap.width > 1100) {
  await scene.resize({ w: 1100 });
}
await scene.write(path.join(publicDir, 'login-office-scene.jpg'));
console.log('login-office-scene.jpg', scene.bitmap.width, 'x', scene.bitmap.height);
