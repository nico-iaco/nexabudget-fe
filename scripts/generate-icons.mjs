import sharp from 'sharp';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a professional icon buffer with gradient and effects
async function createIconBuffer(size, isMaskable = false) {
    const colorStart = '#1890ff';
    const colorEnd = '#0050b3';

    // Maskable icons must fill the entire square (rx=0)
    const rx = isMaskable ? 0 : size * 0.2;

    // Maskable icons need more padding (safe area is center 80%)
    const fontSize = isMaskable ? size * 0.45 : size * 0.6;

    const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colorStart};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colorEnd};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="${size * 0.02}"/>
          <feOffset dx="${size * 0.01}" dy="${size * 0.02}" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge> 
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/> 
          </feMerge>
        </filter>
      </defs>

      <rect width="${size}" height="${size}" rx="${rx}" fill="url(#grad)"/>
      
      <!-- Subtle accent circle -->
      <circle cx="${size * 0.85}" cy="${size * 0.15}" r="${size * 0.25}" fill="white" fill-opacity="0.1"/>

      <text x="50%" y="50%" text-anchor="middle" dy=".35em" 
            fill="white" 
            font-size="${fontSize}" 
            font-family="Arial, sans-serif" 
            font-weight="bold"
            filter="url(#shadow)">N</text>
    </svg>
    `;

    return Buffer.from(svg);
}

const sizes = [192, 512];

async function generateIcons() {
    console.log('Starting icon generation...');

    for (const size of sizes) {
        try {
            // Regular icons
            const iconBuffer = await createIconBuffer(size, false);
            await sharp(iconBuffer)
                .png()
                .toFile(join(__dirname, `../public/pwa-${size}x${size}.png`));

            console.log(`✓ Generated pwa-${size}x${size}.png`);

            // Maskable icons (optimized for safe area)
            const maskableBuffer = await createIconBuffer(size, true);
            await sharp(maskableBuffer)
                .png()
                .toFile(join(__dirname, `../public/pwa-maskable-${size}x${size}.png`));

            console.log(`✓ Generated pwa-maskable-${size}x${size}.png`);
        } catch (error) {
            console.error(`Error generating ${size}x${size} icons:`, error);
        }
    }

    console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
