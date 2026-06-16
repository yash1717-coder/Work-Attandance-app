import * as fs from 'fs';
import * as path from 'path';

function copyFolderRecursiveSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  // Gracefully skip on Vercel or typical CI environments
  if (process.env.VERCEL || process.env.CI) {
    console.log('Skipping Android asset synchronization (running in Vercel/CI environment).');
    process.exit(0);
  }

  try {
    const distDir = path.resolve('./dist');
    const androidAssetsDir = path.resolve('./android/app/src/main/assets/www');

    console.log(`Checking build output in ${distDir}`);
    if (!fs.existsSync(distDir)) {
      console.error('Error: dist folder does not exist. Run vite build first!');
      process.exit(1);
    }

    console.log(`Cleaning Android Assets: ${androidAssetsDir}`);
    if (fs.existsSync(androidAssetsDir)) {
      fs.rmSync(androidAssetsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(androidAssetsDir, { recursive: true });

    console.log(`Copying compiled React assets directly into standard Android APK assets folder...`);
    copyFolderRecursiveSync(distDir, androidAssetsDir);
    console.log(`Success! All assets bundled recursively into Android assets/www.`);
  } catch (error) {
    console.warn('Warning: Android asset synchronization skipped or failed:', error);
    // Do not crash the build
    process.exit(0);
  }
}

main();
