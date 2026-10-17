import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Dark Tech Background Gradient -->
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#0c1322" />
      <stop offset="60%" stop-color="#06080d" />
      <stop offset="100%" stop-color="#030407" />
    </radialGradient>

    <!-- Neon Cyan Glow Filter -->
    <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Neon Pink Glow Filter -->
    <filter id="pinkGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Border Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#a855f7" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#ff007f" stop-opacity="0.8" />
    </linearGradient>

    <!-- X Gradient -->
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7bf7ff" />
      <stop offset="100%" stop-color="#00c8e0" />
    </linearGradient>

    <!-- O Gradient -->
    <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff66b2" />
      <stop offset="100%" stop-color="#e6006e" />
    </linearGradient>
  </defs>

  <!-- Base Rounded Squircle Background -->
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="14" />

  <!-- Subtle Inner Grid / Tech Accent Lines -->
  <path d="M 120 70 L 120 442 M 392 70 L 392 442 M 70 140 L 442 140 M 70 372 L 442 372"
        stroke="#ffffff" stroke-opacity="0.04" stroke-width="2" stroke-dasharray="8 8" />

  <!-- Vanishing Dots Mechanic (3 Pips at Top: Solid, Pulsing, Vanishing/Ghost) -->
  <g transform="translate(256, 76)">
    <!-- 1st Active Pip -->
    <circle cx="-50" cy="0" r="8" fill="#00f0ff" filter="url(#cyanGlow)" />
    <!-- 2nd Active Pip -->
    <circle cx="0" cy="0" r="8" fill="#a855f7" />
    <!-- 3rd Vanishing / Ghost Pip -->
    <circle cx="50" cy="0" r="7" fill="none" stroke="#ff007f" stroke-width="2.5" stroke-dasharray="3 3" opacity="0.6" />
    <circle cx="50" cy="0" r="2.5" fill="#ff007f" opacity="0.4" />
  </g>

  <!-- Tactical X (Cyan) -->
  <g filter="url(#cyanGlow)">
    <line x1="105" y1="165" x2="235" y2="345" stroke="url(#cyanGrad)" stroke-width="46" stroke-linecap="round" />
    <line x1="235" y1="165" x2="105" y2="345" stroke="url(#cyanGrad)" stroke-width="46" stroke-linecap="round" />
  </g>

  <!-- Tactical O (Pink) -->
  <g filter="url(#pinkGlow)">
    <circle cx="340" cy="255" r="85" fill="none" stroke="url(#pinkGrad)" stroke-width="44" stroke-linecap="round" />
  </g>

  <!-- Vanishing Particle Dispersal on O (Visualizing Vanish Mechanic) -->
  <circle cx="438" cy="200" r="4.5" fill="#ff007f" opacity="0.75" />
  <circle cx="452" cy="180" r="3.5" fill="#ff007f" opacity="0.5" />
  <circle cx="462" cy="158" r="2.5" fill="#ff007f" opacity="0.3" />

  <!-- Bottom Accent Tag -->
  <text x="256" y="440" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="28" font-weight="900" letter-spacing="6" fill="#64748b" text-anchor="middle" opacity="0.75">
    VANISH
  </text>
</svg>`;

// Maskable version with safe zone (minimum 20% outer padding for circular/squircle OS cropping)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgGradM" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="#0c1322" />
      <stop offset="60%" stop-color="#06080d" />
      <stop offset="100%" stop-color="#020305" />
    </radialGradient>
    <filter id="cyanGlowM" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="pinkGlowM" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id="cyanGradM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7bf7ff" />
      <stop offset="100%" stop-color="#00c8e0" />
    </linearGradient>
    <linearGradient id="pinkGradM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff66b2" />
      <stop offset="100%" stop-color="#e6006e" />
    </linearGradient>
    <linearGradient id="borderGradM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#ff007f" stop-opacity="0.8" />
    </linearGradient>
  </defs>

  <!-- Full Bleed Background for Maskable Icon -->
  <rect width="512" height="512" fill="url(#bgGradM)" />

  <!-- Safe Zone Graphic Scaled ~72% to guarantee 100% visibility in any adaptive crop -->
  <g transform="translate(68, 68) scale(0.73)">
    <!-- Inner Border Card -->
    <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="#090e18" stroke="url(#borderGradM)" stroke-width="12" />

    <!-- 3 Pips Indicator -->
    <g transform="translate(256, 82)">
      <circle cx="-50" cy="0" r="9" fill="#00f0ff" filter="url(#cyanGlowM)" />
      <circle cx="0" cy="0" r="9" fill="#a855f7" />
      <circle cx="50" cy="0" r="8" fill="none" stroke="#ff007f" stroke-width="3" stroke-dasharray="3 3" opacity="0.6" />
    </g>

    <!-- Tactical X -->
    <g filter="url(#cyanGlowM)">
      <line x1="105" y1="165" x2="235" y2="345" stroke="url(#cyanGradM)" stroke-width="48" stroke-linecap="round" />
      <line x1="235" y1="165" x2="105" y2="345" stroke="url(#cyanGradM)" stroke-width="48" stroke-linecap="round" />
    </g>

    <!-- Tactical O -->
    <g filter="url(#pinkGlowM)">
      <circle cx="340" cy="255" r="85" fill="none" stroke="url(#pinkGradM)" stroke-width="46" stroke-linecap="round" />
    </g>

    <!-- Vanishing particles -->
    <circle cx="438" cy="200" r="5" fill="#ff007f" opacity="0.75" />
    <circle cx="452" cy="180" r="4" fill="#ff007f" opacity="0.5" />
    <circle cx="462" cy="158" r="3" fill="#ff007f" opacity="0.3" />

    <text x="256" y="440" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          font-size="28" font-weight="900" letter-spacing="6" fill="#94a3b8" text-anchor="middle">
      VANISH
    </text>
  </g>
</svg>`;

// Helper to create valid multi-image ICO binary file from PNG buffers
function createIco(pngBuffers) {
  // pngBuffers: array of { width, height, buffer }
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + entrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4);

  const entries = [];
  const imageBuffers = [];

  for (const { width, height, buffer } of pngBuffers) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // file offset

    entries.push(entry);
    imageBuffers.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...entries, ...imageBuffers]);
}

async function run() {
  const publicDir = path.resolve(process.cwd(), 'public');
  const appDir = path.resolve(process.cwd(), 'src', 'app');

  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  console.log('1. Writing SVG icon files...');
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), masterSvg);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), masterSvg);
  fs.writeFileSync(path.join(publicDir, 'safari-pinned-tab.svg'), masterSvg);

  const svgBuffer = Buffer.from(masterSvg);
  const maskableSvgBuffer = Buffer.from(maskableSvg);

  const standardSizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512];

  console.log('2. Generating standard PNG icon sizes...');
  const pngCache = {};
  for (const s of standardSizes) {
    const buf = await sharp(svgBuffer).resize(s, s).png().toBuffer();
    pngCache[s] = buf;
    fs.writeFileSync(path.join(publicDir, `icon-${s}x${s}.png`), buf);
  }

  // Common aliases
  fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), pngCache[16]);
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), pngCache[32]);
  fs.writeFileSync(path.join(publicDir, 'favicon-48x48.png'), pngCache[48]);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngCache[180]);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon-180x180.png'), pngCache[180]);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon-152x152.png'), pngCache[152]);

  console.log('3. Generating maskable icons...');
  const maskable192 = await sharp(maskableSvgBuffer).resize(192, 192).png().toBuffer();
  const maskable512 = await sharp(maskableSvgBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-maskable-192x192.png'), maskable192);
  fs.writeFileSync(path.join(publicDir, 'icon-maskable-512x512.png'), maskable512);

  console.log('4. Generating multi-resolution favicon.ico (16, 32, 48)...');
  const icoBuf = createIco([
    { width: 16, height: 16, buffer: pngCache[16] },
    { width: 32, height: 32, buffer: pngCache[32] },
    { width: 48, height: 48, buffer: pngCache[48] },
  ]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);
  // Also update src/app/favicon.ico so Next.js App Router defaults to it directly
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), icoBuf);

  console.log('All icons generated successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
