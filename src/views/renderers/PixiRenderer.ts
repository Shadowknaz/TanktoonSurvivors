import * as PIXI from "pixi.js";
import { createNoise2D, createNoise4D } from "simplex-noise";
import { RenderConfig } from "../../config/RenderConfig";

export class PixiRenderer {
  public app: PIXI.Application | null = null;
  public gameContainer: PIXI.Container;
  public uiContainer: PIXI.Container;
  public bgTiling?: PIXI.TilingSprite;
  public fogTiling?: PIXI.TilingSprite;
  public boundsLine?: PIXI.Graphics;
  private resizeListener?: () => void;
  private isDestroyed: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.app = new PIXI.Application();
    this.gameContainer = new PIXI.Container();
    this.gameContainer.sortableChildren = true;
    this.uiContainer = new PIXI.Container();
  }

  private generateBackgroundTexture(): PIXI.Texture {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.createImageData(size, size);
    
    // Seamless 2D noise using 4D Torus approach
    const noise4D = createNoise4D();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Map [0, size] to [0, 1]
        const u = x / size;
        const v = y / size;

        // Radius of Torus
        const r = 2.0;

        // 4D Coordinates
        const x1 = Math.cos(u * 2 * Math.PI) * r;
        const x2 = Math.sin(u * 2 * Math.PI) * r;
        const x3 = Math.cos(v * 2 * Math.PI) * r;
        const x4 = Math.sin(v * 2 * Math.PI) * r;
        
        let val = noise4D(x1, x2, x3, x4);
        
        // add some detail
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
        
        // Normalize val a bit (-1.75 to 1.75 -> roughly 0 to 1)
        val = (val + 1.75) / 3.5;

        // Comic-style posterization
        val = Math.floor(val * 4) / 4;

        // Colors for dirt
        // Base: #e0d0b0 -> rgb(224, 208, 176)
        // Darker: #cba88 -> rgb(203, 170, 136)
        const i = (fillIndex: number) => (y * size + x) * 4 + fillIndex;
        if (val < 0.3) {
            imgData.data[i(0)] = 203; imgData.data[i(1)] = 170; imgData.data[i(2)] = 136;
        } else if (val < 0.6) {
            imgData.data[i(0)] = 214; imgData.data[i(1)] = 189; imgData.data[i(2)] = 156;
        } else {
            imgData.data[i(0)] = 224; imgData.data[i(1)] = 208; imgData.data[i(2)] = 176;
        }
        
        // Add subtle comic dot pattern
        // We can use 2D noise for dots here because dots themselves won't clash at edges as obviously,
        // but just to be safe let's skip dots at borders or use sine waves instead to avoid 2d noise boundary clash
        const dotNoise = (Math.sin(x * 0.5) * Math.cos(y * 0.5) > 0.5); 
        if ((x + y) % 6 === 0 && val > 0.4 && dotNoise) {
            imgData.data[i(0)] -= 30;
            imgData.data[i(1)] -= 30;
            imgData.data[i(2)] -= 30;
        }

        imgData.data[i(3)] = 255;
      }
    }
    
    ctx.putImageData(imgData, 0, 0);

    // Sketch some stylized "dirt cracks" on top to cement the comic feel
    // To make cracks seamless we'll wrap coordinates
    ctx.strokeStyle = "rgba(100, 80, 60, 0.4)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // We can just keep dirt cracks away from borders to avoid clipping
    for (let iter=0; iter<8; iter++) {
        ctx.beginPath();
        let cX = 30 + Math.random() * (size - 60);
        let cY = 30 + Math.random() * (size - 60);
        ctx.moveTo(cX, cY);
        for(let step=0; step<10; step++) {
            const angle = Math.random() * Math.PI * 2;
            cX += Math.cos(angle) * 10;
            cY += Math.sin(angle) * 10;
            // keep inside bounds
            cX = Math.max(10, Math.min(size - 10, cX));
            cY = Math.max(10, Math.min(size - 10, cY));
            ctx.lineTo(cX, cY);
        }
        ctx.stroke();
    }

    return PIXI.Texture.from(canvas);
  }

  private generateFogTexture(): PIXI.Texture {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.createImageData(size, size);
    
    const noise4D = createNoise4D();

    const getSeamlessNoise = (u: number, v: number) => {
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

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        
        let val = getSeamlessNoise(u, v);
        
        val = (val + 1.0) / 2.0; 
        val = Math.max(0, val - 0.45) * 2.0; // Threshold and amplify for sharper, less milky fog

        const i = (y * size + x) * 4;
        imgData.data[i] = 255;
        imgData.data[i + 1] = 255;
        imgData.data[i + 2] = 255;
        imgData.data[i + 3] = Math.floor(Math.min(1, val) * 60); 
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
    return PIXI.Texture.from(canvas);
  }

  async init(parent: HTMLElement) {
    if (!this.app) return;

    const isMobile = parent.clientWidth < 1024; // Simple mobile check for renderer
    const maxDPR = isMobile ? 1.5 : 2;
    
    this.initPromise = this.app.init({
      resizeTo: parent,
      backgroundColor: RenderConfig.COLOR_BACKGROUND,
      resolution: Math.min(maxDPR, window.devicePixelRatio || 1),
      autoDensity: true,
      antialias: false,
    });

    try {
      await this.initPromise;
    } catch (e) {
      console.warn("Pixi init error:", e);
    }

    if (this.isDestroyed) {
      this.doDestroy();
      return;
    }

    if (this.app?.canvas) {
      parent.appendChild(this.app.canvas);

      // Create textures for TilingSprite
      const bgTexture = this.generateBackgroundTexture();
      const fogTexture = this.generateFogTexture();

      this.bgTiling = new PIXI.TilingSprite({
        texture: bgTexture,
        width: parent.clientWidth,
        height: parent.clientHeight,
      });

      this.fogTiling = new PIXI.TilingSprite({
        texture: fogTexture,
        width: parent.clientWidth,
        height: parent.clientHeight,
      });



      this.app.stage.addChild(this.bgTiling); // layer 0
      this.app.stage.addChild(this.gameContainer); // layer 1
      this.app.stage.addChild(this.fogTiling); // layer 1.5
      this.app.stage.addChild(this.uiContainer);   // layer 2

      // Paper noise overlay
      const noiseTex = this.generatePaperTexture();
      const paperOverlay = new PIXI.TilingSprite({
        texture: noiseTex,
        width: parent.clientWidth,
        height: parent.clientHeight,
        alpha: 0.15,
        blendMode: 'multiply'
      });
      paperOverlay.zIndex = 100;
      this.app.stage.addChild(paperOverlay);

      this.resizeListener = () => {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        if (this.bgTiling) {
          this.bgTiling.width = width;
          this.bgTiling.height = height;
        }
        if (this.fogTiling) {
          this.fogTiling.width = width;
          this.fogTiling.height = height;
        }
        if (paperOverlay) {
          paperOverlay.width = width;
          paperOverlay.height = height;
        }
      };
      window.addEventListener('resize', this.resizeListener!);
    }
  }

  private generatePaperTexture(): PIXI.Texture {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.createImageData(size, size);

    for (let i = 0; i < size * size * 4; i += 4) {
      const val = Math.random() * 255;
      imgData.data[i] = val;
      imgData.data[i + 1] = val;
      imgData.data[i + 2] = val;
      imgData.data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return PIXI.Texture.from(canvas);
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.initPromise) {
      this.initPromise.finally(() => {
        this.doDestroy();
      });
    } else {
      this.doDestroy();
    }
  }

  private doDestroy() {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    if (this.app) {
      const hasCanvas = !!this.app.canvas;
      if (hasCanvas && this.app.canvas.parentNode) {
        this.app.canvas.parentNode.removeChild(this.app.canvas);
      }
      try {
        this.app.destroy(false, {
          children: true,
          texture: true,
        });
      } catch (e) {
        console.warn("Pixi destroy error:", e);
      }
      this.app = null;
    }
  }
}
