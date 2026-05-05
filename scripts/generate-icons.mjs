import sharp from 'sharp';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgSource = readFileSync(join(__dirname, 'icon-source.svg'), 'utf8');

// Maskable icons need full-bleed background (no rounded corners — the OS applies its own mask)
const svgMaskable = svgSource.replace(/rx="\d+"/, 'rx="0"');

const sizes = [192, 512];

async function generateIcons() {
    console.log('Starting icon generation...');

    for (const size of sizes) {
        try {
            await sharp(Buffer.from(svgSource))
                .resize(size, size)
                .png()
                .toFile(join(__dirname, `../public/pwa-${size}x${size}.png`));
            console.log(`✓ Generated pwa-${size}x${size}.png`);

            await sharp(Buffer.from(svgMaskable))
                .resize(size, size)
                .png()
                .toFile(join(__dirname, `../public/pwa-maskable-${size}x${size}.png`));
            console.log(`✓ Generated pwa-maskable-${size}x${size}.png`);
        } catch (error) {
            console.error(`Error generating ${size}x${size} icons:`, error);
        }
    }

    // Apple Touch Icon — 180x180 for iOS home screen
    try {
        await sharp(Buffer.from(svgSource))
            .resize(180, 180)
            .png()
            .toFile(join(__dirname, '../public/apple-touch-icon.png'));
        console.log('✓ Generated apple-touch-icon.png');
    } catch (error) {
        console.error('Error generating apple-touch-icon.png:', error);
    }

    // Favicon 32x32 PNG (replaces the old oversized favicon.ico)
    try {
        await sharp(Buffer.from(svgSource))
            .resize(32, 32)
            .png()
            .toFile(join(__dirname, '../public/favicon-32x32.png'));
        console.log('✓ Generated favicon-32x32.png');
    } catch (error) {
        console.error('Error generating favicon-32x32.png:', error);
    }

    console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
