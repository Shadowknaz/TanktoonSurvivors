import { createNoise4D } from 'simplex-noise';
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEXTURE_SIZE = 512;
const PAPER_SIZE = 256;

function generateBackgroundTexture() {
  const canvas = createCanvas(TEXTURE_SIZE, TEXTURE_SIZE);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  
  const noise4D = createNoise4D();

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;

      const r = 2.0;

      const x1 = Math.cos(u * 2 * Math.PI) * r;
      const x2 = Math.sin(u * 2 * Math.PI) * r;
      const x3 = Math.cos(v * 2 * Math.PI) * r;
      const x4 = Math.sin(v * 2 * Math.PI) * r;
      
      let val = noise4D(x1, x2, x3, x4);
      
      const r2 = 5.0;
      const d_x1 = Math.cos(u * 2 * Math.PI) * r2;
      const d_x2 = Math.sin(u * 2 * Math.PI) * r2;
      const d_x3 = Math.cos(v * 2 * Math.PI) * r2;
      const d_x4 = Math.sin(v * 2 * Math.PI) * r2;

      val += 0.5 * noise4D(d_x1, d_x2, d_x3, d_x4);

      const r3 = 10.0;
      const dd_x1 = Math.cos(u * 2 * Math.PI) * r3;
      const dd_x2 = Math.sin(u * 2 * Math.PI) * r3;
      const dd_x3 = Math.cos(v * 2 * Math.PI) * r3;
      const dd_x4 = Math.sin(v * 2 * Math.PI) * r3;

      val += 0.25 * noise4D(dd_x1, dd_x2, dd_x3, dd_x4);
      
      val = (val + 1.75) / 3.5;
      val = Math.floor(val * 4) / 4;

      const i = (y * TEXTURE_SIZE + x) * 4;
      if (val < 0.3) {
        imgData.data[i] = 203; imgData.data[i + 1] = 170; imgData.data[i + 2] = 136;
      } else if (val < 0.6) {
        imgData.data[i] = 214; imgData.data[i + 1] = 189; imgData.data[i + 2] = 156;
      } else {
        imgData.data[i] = 224; imgData.data[i + 1] = 208; imgData.data[i + 2] = 176;
      }
      
      const dotNoise = (Math.sin(x * 0.5) * Math.cos(y * 0.5) > 0.5);
      if ((x + y) % 6 === 0 && val > 0.4 && dotNoise) {
        imgData.data[i] -= 30;
        imgData.data[i + 1] -= 30;
        imgData.data[i + 2] -= 30;
      }

      imgData.data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(imgData, 0, 0);

  ctx.strokeStyle = "rgba(100, 80, 60, 0.4)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  
  for (let iter = 0; iter < 8; iter++) {
    ctx.beginPath();
    let cX = 30 + Math.random() * (TEXTURE_SIZE - 60);
    let cY = 30 + Math.random() * (TEXTURE_SIZE - 60);
    ctx.moveTo(cX, cY);
    for (let step = 0; step < 10; step++) {
      const angle = Math.random() * Math.PI * 2;
      cX += Math.cos(angle) * 10;
      cY += Math.sin(angle) * 10;
      cX = Math.max(10, Math.min(TEXTURE_SIZE - 10, cX));
      cY = Math.max(10, Math.min(TEXTURE_SIZE - 10, cY));
      ctx.lineTo(cX, cY);
    }
    ctx.stroke();
  }

  return canvas;
}

function generateFogTexture() {
  const canvas = createCanvas(TEXTURE_SIZE, TEXTURE_SIZE);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  
  const noise4D = createNoise4D();

  const getSeamlessNoise = (u, v) => {
    const r = 1.5;
    const x1 = Math.cos(u * 2 * Math.PI) * r;
    const x2 = Math.sin(u * 2 * Math.PI) * r;
    const x3 = Math.cos(v * 2 * Math.PI) * r;
    const x4 = Math.sin(v * 2 * Math.PI) * r;

    let val = noise4D(x1, x2, x3, x4);
    
    const r2 = 3.0;
    const d_x1 = Math.cos(u * 2 * Math.PI) * r2;
    const d_x2 = Math.sin(u * 2 * Math.PI) * r2;
    const d_x3 = Math.cos(v * 2 * Math.PI) * r2;
    const d_x4 = Math.sin(v * 2 * Math.PI) * r2;
    
    val += 0.5 * noise4D(d_x1, d_x2, d_x3, d_x4);
    return val / 1.5;
  };

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;
      
      let val = getSeamlessNoise(u, v);
      
      val = (val + 1.0) / 2.0;
      val = Math.max(0, val - 0.45) * 2.0;

      const i = (y * TEXTURE_SIZE + x) * 4;
      imgData.data[i] = 255;
      imgData.data[i + 1] = 255;
      imgData.data[i + 2] = 255;
      imgData.data[i + 3] = Math.floor(Math.min(1, val) * 60);
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function generatePaperTexture() {
  const canvas = createCanvas(PAPER_SIZE, PAPER_SIZE);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(PAPER_SIZE, PAPER_SIZE);

  for (let i = 0; i < PAPER_SIZE * PAPER_SIZE * 4; i += 4) {
    const val = Math.random() * 255;
    imgData.data[i] = val;
    imgData.data[i + 1] = val;
    imgData.data[i + 2] = val;
    imgData.data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function main() {
  console.log('Generating textures...');
  
  const bgCanvas = generateBackgroundTexture();
  const fogCanvas = generateFogTexture();
  const paperCanvas = generatePaperTexture();
  
  const outputPath = join(__dirname, '../public/textures');
  
  writeFileSync(join(outputPath, 'background.png'), bgCanvas.toBuffer('image/png'));
  writeFileSync(join(outputPath, 'fog.png'), fogCanvas.toBuffer('image/png'));
  writeFileSync(join(outputPath, 'paper.png'), paperCanvas.toBuffer('image/png'));
  
  console.log('Textures generated successfully!');
  console.log('- background.png');
  console.log('- fog.png');
  console.log('- paper.png');
}

main();
