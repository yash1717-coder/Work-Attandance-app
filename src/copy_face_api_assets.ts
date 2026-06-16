import * as fs from 'fs';
import * as path from 'path';

function copyFileSync(src: string, dest: string) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function main() {
  const publicDir = path.resolve('./public');
  const packageDir = path.resolve('./node_modules/@vladmandic/face-api');

  const libSrc = path.join(packageDir, 'dist/face-api.js');
  const libDest = path.join(publicDir, 'face-api.js');

  console.log(`Copying library: ${libSrc} -> ${libDest}`);
  copyFileSync(libSrc, libDest);

  const modelSrcDir = path.join(packageDir, 'model');
  const modelDestDir = path.join(publicDir, 'models');

  const modelFiles = [
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model.bin',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model.bin',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model.bin'
  ];

  for (const file of modelFiles) {
    const srcFile = path.join(modelSrcDir, file);
    const destFile = path.join(modelDestDir, file);
    if (fs.existsSync(srcFile)) {
      console.log(`Copying model: ${srcFile} -> ${destFile}`);
      copyFileSync(srcFile, destFile);
    } else {
      console.warn(`Model file not found: ${srcFile}`);
    }
  }

  console.log('Local face-api web & model assets copied successfully!');
}

main();
