const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

async function processBranding() {
  const publicIconPath = path.join(__dirname, '..', 'public', 'app_icon.png');
  const publicLogoPath = path.join(__dirname, '..', 'public', 'app_logo.png');

  if (!fs.existsSync(publicIconPath) || !fs.existsSync(publicLogoPath)) {
    console.error('Source app_icon.png or app_logo.png not found in public folder!');
    process.exit(1);
  }

  const kotlinAppDir = path.join(__dirname, '..', 'kotlin_app');
  const resDir = path.join(kotlinAppDir, 'app', 'src', 'main', 'res');
  const drawableDir = path.join(resDir, 'drawable');
  const brandingDir = path.join(kotlinAppDir, 'app_branding_assets');

  // Mipmap configurations
  const mipmaps = [
    { dir: path.join(resDir, 'mipmap-mdpi'), size: 48 },
    { dir: path.join(resDir, 'mipmap-hdpi'), size: 72 },
    { dir: path.join(resDir, 'mipmap-xhdpi'), size: 96 },
    { dir: path.join(resDir, 'mipmap-xxhdpi'), size: 144 },
    { dir: path.join(resDir, 'mipmap-xxxhdpi'), size: 192 },
  ];

  // Ensure directories exist
  [drawableDir, brandingDir, ...mipmaps.map(m => m.dir)].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  console.log('Processing app_icon.png with Jimp...');
  const srcIcon = await Jimp.read(publicIconPath);
  const srcLogo = await Jimp.read(publicLogoPath);

  // 1. Process standard 512x512 logos & icons
  console.log('Generating 512x512 app_logo.png and app_icon.png in res/drawable & branding assets...');
  
  const drawIcon = srcIcon.clone().resize({ w: 512, h: 512 });
  await drawIcon.write(path.join(drawableDir, 'app_icon.png'));
  await drawIcon.write(path.join(brandingDir, 'app_icon.png'));

  const drawLogo = srcLogo.clone().resize({ w: 512, h: 512 });
  await drawLogo.write(path.join(drawableDir, 'app_logo.png'));
  await drawLogo.write(path.join(brandingDir, 'app_logo.png'));

  // 2. Generate padded launcher icons to prevent clipping and fit the size beautifully
  for (const m of mipmaps) {
    console.log(`Generating padded launcher icon for size ${m.size} in ${path.basename(m.dir)}...`);
    
    // We create a transparent canvas of m.size x m.size
    const canvas = new Jimp({ width: m.size, height: m.size, color: 0x00000000 });
    
    // Resize original icon with ~15% padding (so size is 75% of container)
    const iconSize = Math.round(m.size * 0.75);
    const resizedIcon = srcIcon.clone().resize({ w: iconSize, h: iconSize });
    
    // Center it on canvas
    const offset = Math.round((m.size - iconSize) / 2);
    canvas.composite(resizedIcon, offset, offset);
    
    await canvas.write(path.join(m.dir, 'ic_launcher.png'));
    await canvas.write(path.join(m.dir, 'ic_launcher_round.png'));
  }

  console.log('Branding processing completed successfully!');
}

processBranding().catch(err => {
  console.error('Error processing branding assets:', err);
  process.exit(1);
});
