import * as PIXI from "pixi.js";
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

  private async loadTexture(path: string): Promise<PIXI.Texture> {
    const retryCount = RenderConfig.TEXTURE_LOAD_RETRY_COUNT;
    const retryDelay = RenderConfig.TEXTURE_LOAD_RETRY_DELAY_MS;
    
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const texture = await PIXI.Assets.load(path);
        if (texture) return texture;
        
        if (attempt < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.warn(`Texture load failed (attempt ${attempt + 1}/${retryCount}):`, path, error);
        
        if (attempt < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to load texture after ${retryCount} attempts: ${path}`);
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

      // Load pre-generated textures
      const bgTexture = await this.loadTexture('/textures/background.png');
      const fogTexture = await this.loadTexture('/textures/fog.png');

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
      const noiseTex = await this.loadTexture('/textures/paper.png');
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
      this.resizeListener = undefined;
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
