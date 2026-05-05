import sharp from 'sharp';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgSource = readFileSync(join(__dirname, 'icon-source.svg'), 'utf8');

// Maskable icons need full-bleed background (no rounded corners — the OS applies its own mask)
const svgMaskable = svgSource.replace(/rx="\d+"/, 'rx="0"');

// Background color matching the gradient start — used to flatten transparent corners
const BG_COLOR = { r: 0, g: 58, b: 140 }; // #003a8c

const sizes = [192, 512];

async function generateIcons() {
    console.log('Starting icon generation...');

    for (const size of sizes) {
        try {
            // Regular icons: flatten alpha so no transparent corners survive
            await sharp(Buffer.from(svgSource))
                .resize(size, size)
                .flatten({ background: BG_COLOR })
                .png()
                .toFile(join(__dirname, `../public/pwa-${size}x${size}.png`));
            console.log(`✓ Generated pwa-${size}x${size}.png`);

            await sharp(Buffer.from(svgMaskable))
                .resize(size, size)
                .flatten({ background: BG_COLOR })
                .png()
                .toFile(join(__dirname, `../public/pwa-maskable-${size}x${size}.png`));
            console.log(`✓ Generated pwa-maskable-${size}x${size}.png`);
        } catch (error) {
            console.error(`Error generating ${size}x${size} icons:`, error);
        }
    }

    // Apple Touch Icon — 180x180, full-bleed maskable variant + flattened
    // iOS uses apple-touch-icon for the home screen; it applies its own rounding mask,
    // so the source must be a fully opaque square (no transparency).
    // File is versioned (v2) to bust iOS's aggressive icon cache.
    try {
        await sharp(Buffer.from(svgMaskable))
            .resize(180, 180)
            .flatten({ background: BG_COLOR })
            .png()
            .toFile(join(__dirname, '../public/apple-touch-icon-v2.png'));
        console.log('✓ Generated apple-touch-icon-v2.png');
    } catch (error) {
        console.error('Error generating apple-touch-icon-v2.png:', error);
    }

    // Favicon 32x32 PNG
    try {
        await sharp(Buffer.from(svgSource))
            .resize(32, 32)
            .flatten({ background: BG_COLOR })
            .png()
            .toFile(join(__dirname, '../public/favicon-32x32.png'));
        console.log('✓ Generated favicon-32x32.png');
    } catch (error) {
        console.error('Error generating favicon-32x32.png:', error);
    }

    console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
