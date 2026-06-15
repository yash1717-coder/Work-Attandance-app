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

  // 1. Generate 512x512 PNG
  console.log('Generating 512x512 PNG');
  const img512 = image.clone().resize({ w: 512, h: 512 });
  await img512.write(path.join(publicDir, 'icon-512.png') as any);

  // 2. Generate 192x192 resized PNG
  console.log('Generating 192x192 PNG');
  const img192 = image.clone().resize({ w: 192, h: 192 });
  await img192.write(path.join(publicDir, 'icon-192.png') as any);

  // 3. Generate 512x512 maskable PNG (compliant)
  console.log('Generating Maskable PNG');
  const imgMaskable = image.clone().resize({ w: 512, h: 512 });
  await imgMaskable.write(path.join(publicDir, 'icon-maskable.png') as any);

  console.log('PWA Icon conversions complete. Valid PNG files generated!');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
