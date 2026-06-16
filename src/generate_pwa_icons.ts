import { Jimp } from 'jimp';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const sourceImage = path.resolve('./src/assets/images/icon_512_1781509231272.jpg');
  const publicDir = path.resolve('./public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('Reading source image:', sourceImage);
  const image = await Jimp.read(sourceImage);

  // Generate 512x512 standard PNG
  console.log('Generating 512x512 PNG');
  const img512 = image.clone().resize({ w: 512, h: 512 });
  await img512.write(path.join(publicDir, 'icon-512.png') as any);

  // Generate 192x192 standard PNG
  console.log('Generating 192x192 PNG');
  const img192 = image.clone().resize({ w: 192, h: 192 });
  await img192.write(path.join(publicDir, 'icon-192.png') as any);

  // Generate 512x512 maskable PNG (10% to 15% safe padding with white background to seamlessly blend the design)
  console.log('Generating 512x512 Maskable PNG');
  const size512 = 512;
  const padding512 = Math.round(size512 * 0.15); // ~77px padding
  const innerSize512 = size512 - padding512 * 2; // ~358px content
  
  // Base background is a solid white image with Jimp
  // To make a solid color white image in Jimp v1, we can create a blank one or fill it.
  // In Jimp we can resize the original to 512x512 and composite a scaled version, 
  // or since the image background is already white, a simple centered scale fits perfectly!
  const maskableImg512 = image.clone().resize({ w: innerSize512, h: innerSize512 });
  
  // Create solid white background image of size 512x512
  // We can create a new blank Jimp image or write a simple pixel filler on a cloned copy.
  const bg512 = image.clone().resize({ w: 512, h: 512 });
  // Fill background with white:
  for (let x = 0; x < 512; x++) {
    for (let y = 0; y < 512; y++) {
      bg512.setPixelColor(0xFFFFFFFF, x, y);
    }
  }
  
  // Composite the padded inner image centered onto the solid white background
  bg512.composite(maskableImg512, padding512, padding512);
  await bg512.write(path.join(publicDir, 'maskable-512.png') as any);

  // Generate 192x192 maskable PNG
  console.log('Generating 192x192 Maskable PNG');
  const size192 = 192;
  const padding192 = Math.round(size192 * 0.15); // ~29px padding
  const innerSize192 = size192 - padding192 * 2; // ~134px content
  
  const maskableImg192 = image.clone().resize({ w: innerSize192, h: innerSize192 });
  const bg192 = image.clone().resize({ w: 192, h: 192 });
  for (let x = 0; x < 192; x++) {
    for (let y = 0; y < 192; y++) {
      bg192.setPixelColor(0xFFFFFFFF, x, y);
    }
  }
  bg192.composite(maskableImg192, padding192, padding192);
  await bg192.write(path.join(publicDir, 'maskable-192.png') as any);

  console.log('All PWA standard icons generated successfully from the new logo!');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
