import { createNoise4D } from 'simplex-noise';
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEXTURE_SIZE = 512;
const PAPER_SIZE = 512;

// Maps 2D tile coords onto a 4D torus for seamless tiling
function seamless(noise4D, x, y, size, scale) {
  const u = x / size;
  const v = y / size;
  const r = scale;
  return noise4D(
    Math.cos(u * Math.PI * 2) * r,
    Math.sin(u * Math.PI * 2) * r,
    Math.cos(v * Math.PI * 2) * r,
    Math.sin(v * Math.PI * 2) * r,
  );
}

function generateBackgroundTexture() {
  const S = TEXTURE_SIZE;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  const nZone  = createNoise4D(); // крупные цветовые зоны
  const nZone2 = createNoise4D(); // вторичная модуляция зон
  const nShade = createNoise4D(); // cell-shading поверхности
  const nGrain = createNoise4D(); // мелкое зерно

  // Комикс-палитра: земля/трава, без розового и серого
  // Формат: [ [shadow], [midtone], [highlight] ]
  const PALETTE = [
    [[68, 110, 30],  [108, 162, 52],  [156, 208, 84]],  // яркая трава
    [[94, 128, 36],  [140, 178, 64],  [188, 216, 104]], // светлая трава
    [[118,  96, 30], [172, 144, 58],  [216, 190,  96]], // сухая охра
    [[80, 118, 28],  [120, 164, 52],  [168, 204,  88]], // тёмная трава
  ];

  const imgData = ctx.createImageData(S, S);
  const data = imgData.data;
  const zones = new Uint8Array(S * S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Плавные крупные зоны (два октава)
      const zn = seamless(nZone, x, y, S, 1.8) * 0.65
               + seamless(nZone2, x, y, S, 3.6) * 0.35;
      const zone = Math.abs(Math.floor((zn + 1) * 2)) % PALETTE.length;
      zones[y * S + x] = zone;

      // Comic cell-shading: 3 уровня освещённости
      const sn = (seamless(nShade, x, y, S, 6.5) + 1) / 2;
      let shade;
      if      (sn < 0.30) shade = 0; // тень
      else if (sn < 0.74) shade = 1; // полутон
      else                shade = 2; // блик

      const [r, g, b] = PALETTE[zone][shade];

      // Мелкое зерно
      const grain = seamless(nGrain, x, y, S, 24.0) * 7;

      const i = (y * S + x) * 4;
      data[i]   = Math.max(0, Math.min(255, r + grain));
      data[i+1] = Math.max(0, Math.min(255, g + grain));
      data[i+2] = Math.max(0, Math.min(255, b + grain));
      data[i+3] = 255;
    }
  }

  // Пост-проход: затемнение границ зон (мягкий комикс-аутлайн)
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const z = zones[y * S + x];
      const isEdge =
        zones[(y-1)*S+x] !== z || zones[(y+1)*S+x] !== z ||
        zones[y*S+(x-1)] !== z || zones[y*S+(x+1)] !== z;
      if (isEdge) {
        const i = (y * S + x) * 4;
        data[i]   = Math.max(0, data[i]   - 40);
        data[i+1] = Math.max(0, data[i+1] - 40);
        data[i+2] = Math.max(0, data[i+2] - 40);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Размытие: сглаживает границы и делает слияние
  ctx.filter = 'blur(2px)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  // Возвращаем мелкое зерно после размытия
  const final = ctx.getImageData(0, 0, S, S);
  const fd = final.data;
  for (let i = 0; i < fd.length; i += 4) {
    const g = (Math.random() - 0.5) * 5;
    fd[i]   = Math.max(0, Math.min(255, fd[i]   + g));
    fd[i+1] = Math.max(0, Math.min(255, fd[i+1] + g));
    fd[i+2] = Math.max(0, Math.min(255, fd[i+2] + g));
  }
  ctx.putImageData(final, 0, 0);

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
  const S = PAPER_SIZE;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  const nFiber = createNoise4D(); // крупные волокна
  const nFine  = createNoise4D(); // мелкая фактура
  const nGrain = createNoise4D(); // зерно

  const imgData = ctx.createImageData(S, S);
  const data = imgData.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Слои волокон
      const f1 = (seamless(nFiber, x, y, S, 6.0)  + 1) / 2;
      const f2 = (seamless(nFine,  x, y, S, 18.0) + 1) / 2;
      const f3 = (seamless(nGrain, x, y, S, 40.0) + 1) / 2;

      const v = f1 * 0.35 + f2 * 0.45 + f3 * 0.20;

      // Тёплый кремово-бежевый лист бумаги
      const base = 228;
      const range = 30;
      const val = Math.max(0, Math.min(255, base + (v - 0.5) * range * 2));

      const i = (y * S + x) * 4;
      data[i]   = val;
      data[i+1] = Math.max(0, Math.min(255, val -  4)); // чуть тёплее
      data[i+2] = Math.max(0, Math.min(255, val - 14)); // убираем синий
      data[i+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Тонкие волокна бумаги (горизонтальные)
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = '#7A6040';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const len = 25 + Math.random() * 70;
    const angle = (Math.random() - 0.5) * 0.25; // почти горизонтально
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

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
