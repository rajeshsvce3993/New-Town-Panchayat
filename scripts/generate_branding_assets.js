const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// SVG template for Tamil Nadu Town Panchayat Emblem
const svgEmblem = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3A8A" />
      <stop offset="50%" stop-color="#0284C7" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D" />
      <stop offset="50%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.3" />
    </filter>
  </defs>

  <!-- Outer Rounded Container -->
  <rect width="512" height="512" rx="100" fill="url(#bgGrad)" />

  <!-- Outer Ring Circle -->
  <circle cx="256" cy="256" r="210" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="10 6" opacity="0.6"/>
  <circle cx="256" cy="256" r="190" fill="#FFFFFF" fill-opacity="0.95" filter="url(#shadow)"/>

  <!-- Inner Gold Ring -->
  <circle cx="256" cy="256" r="176" fill="none" stroke="url(#goldGrad)" stroke-width="5" />

  <!-- Temple Tower (Gopuram) Emblem -->
  <!-- Base Tier -->
  <polygon points="160,330 352,330 340,300 172,300" fill="#B45309" />
  <rect x="236" y="300" width="40" height="30" rx="8" fill="#1E293B" />

  <!-- Tier 2 -->
  <polygon points="176,295 336,295 326,265 186,265" fill="#D97706" />
  <rect x="242" y="270" width="28" height="20" rx="5" fill="#FFFFFF" />

  <!-- Tier 3 -->
  <polygon points="190,260 322,260 314,230 198,230" fill="#F59E0B" />
  <rect x="246" y="235" width="20" height="15" rx="4" fill="#FFFFFF" />

  <!-- Tier 4 -->
  <polygon points="202,225 310,225 302,195 210,195" fill="#D97706" />
  <rect x="248" y="200" width="16" height="15" rx="3" fill="#FFFFFF" />

  <!-- Tier 5 -->
  <polygon points="214,190 298,190 290,165 222,165" fill="#F59E0B" />
  <circle cx="256" cy="177" r="5" fill="#FFFFFF" />

  <!-- Kalasam / Top Finials (Kalasams) -->
  <path d="M 230,165 L 230,150 L 234,142 L 234,136 L 236,134 L 238,136 L 238,142 L 242,150 L 242,165 Z" fill="url(#goldGrad)"/>
  <path d="M 250,165 L 250,146 L 254,138 L 254,130 L 256,128 L 258,130 L 258,138 L 262,146 L 262,165 Z" fill="url(#goldGrad)"/>
  <path d="M 270,165 L 270,150 L 274,142 L 274,136 L 276,134 L 278,136 L 278,142 L 282,150 L 282,165 Z" fill="url(#goldGrad)"/>

  <!-- Lion Capital / Ashoka emblem element -->
  <circle cx="256" cy="115" r="10" fill="#F59E0B" />

  <!-- Text Top Header -->
  <path id="curveTop" d="M 110,256 A 146,146 0 0,1 402,256" fill="none" />
  <text font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="900" fill="#047857" letter-spacing="1.5">
    <textPath href="#curveTop" startOffset="50%" text-anchor="middle">
      TOWN PANCHAYAT EMS
    </textPath>
  </text>

  <!-- Text Bottom Subtitle -->
  <path id="curveBottom" d="M 110,256 A 146,146 0 0,0 402,256" fill="none" />
  <text font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="#1E3A8A" letter-spacing="1">
    <textPath href="#curveBottom" startOffset="50%" text-anchor="middle">
      GOVT OF TAMIL NADU
    </textPath>
  </text>

  <!-- Side stars -->
  <polygon points="120,256 124,250 131,250 126,254 128,261 122,257 116,261 118,254 113,250 120,250" fill="#F59E0B" />
  <polygon points="392,256 396,250 403,250 398,254 400,261 394,257 388,261 390,254 385,250 392,250" fill="#F59E0B" />
</svg>
`;

async function main() {
  const kotlinAppDir = path.join(__dirname, '..', 'kotlin_app');
  const resDir = path.join(kotlinAppDir, 'app', 'src', 'main', 'res');
  const drawableDir = path.join(resDir, 'drawable');
  const brandingDir = path.join(kotlinAppDir, 'app_branding_assets');

  // Mipmap directories
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

  const svgBuffer = Buffer.from(svgEmblem.trim());

  // 1. Generate app_logo.png (512x512) and app_icon.png (512x512) in drawable
  console.log('Generating 512x512 app_logo.png and app_icon.png in res/drawable...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(drawableDir, 'app_logo.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(drawableDir, 'app_icon.png'));

  // 2. Generate samples in app_branding_assets/
  console.log('Generating samples in app_branding_assets/...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(brandingDir, 'app_logo.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(brandingDir, 'app_icon.png'));

  // 3. Generate launcher icons in all mipmap folders
  for (const m of mipmaps) {
    console.log(`Generating ${m.size}x${m.size} icons in ${path.basename(m.dir)}...`);
    await sharp(svgBuffer)
      .resize(m.size, m.size)
      .png()
      .toFile(path.join(m.dir, 'ic_launcher.png'));

    // Round icon with circular crop
    const circleSvg = `<svg width="${m.size}" height="${m.size}"><circle cx="${m.size/2}" cy="${m.size/2}" r="${m.size/2}" fill="#ffffff"/></svg>`;
    const maskBuffer = Buffer.from(circleSvg);

    await sharp(svgBuffer)
      .resize(m.size, m.size)
      .composite([{ input: maskBuffer, blend: 'dest-in' }])
      .png()
      .toFile(path.join(m.dir, 'ic_launcher_round.png'));
  }

  // 4. Also copy to public/ folder for web preview
  const publicDir = path.join(__dirname, '..', 'public');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'app_logo.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'app_icon.png'));

  console.log('Branding assets generated successfully!');
}

main().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
