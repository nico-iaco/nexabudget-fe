import sharp from 'sharp';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a simple PNG buffer with a colored background
async function createIconBuffer(size, color = '#1890ff') {
    // Create a base colored square
    const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${color}"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="${size * 0.6}" font-family="Arial, sans-serif" font-weight="bold">N</text>
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
            const iconBuffer = await createIconBuffer(size);
            await sharp(iconBuffer)
                .png()
                .toFile(join(__dirname, `../public/pwa-${size}x${size}.png`));

            console.log(`✓ Generated pwa-${size}x${size}.png`);

            // Maskable icons (with padding for safe area)
            const maskableBuffer = await createIconBuffer(size);
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

