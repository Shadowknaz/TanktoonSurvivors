import {  query, hasComponent, World, removeComponent, QueryResult } from "bitecs";
import {
  Position,
  Renderable,
  PlayerControlled,
  Weapon,
  Particle,
  Lifetime,
  Wreck,
  WarningMarker,
  Velocity,
  DamageFlash,
  TankTracks,
  Airdrop,
  AIBehavior,
  PlayerBuffs,
  GameState,
  FlamerTank,
  Burrowed,
  Projectile
} from "../components";
import { PixiRenderer } from "../../views/renderers/PixiRenderer";
import * as PIXI from "pixi.js";
import { RenderConfig } from "../../config/RenderConfig";
import { GameConfig } from "../../config/GameConfig";
import { SpriteBuilder } from "../../views/renderers/SpriteBuilder";
import { SpriteId, AIState } from "../../models/types";
import { EffectFactory } from "../factories/EffectFactory";
import { MathUtils } from "../../utils/MathUtils";
import { RandomUtils } from "../../utils/RandomUtils";
import { PoolManager, PooledContainer } from "../../services/PoolManager";
import { GameContext } from "../../models/GameContext";
import { DeviceUtils } from "../../utils/DeviceUtils";
import { EntityUtils } from "../../utils/EntityUtils";

export class RenderSystem {
  private spriteMap: Map<number, PooledContainer> = new Map();
  private frameCount: number = 0;
  private activeEids: Set<number> = new Set();

  private static readonly STATIC_SPRITES = new Set<number>([
    SpriteId.WALL, SpriteId.TREE, SpriteId.HOUSE, SpriteId.BROKEN_HOUSE,
    SpriteId.RAVINE, SpriteId.DIRT_PATCH, SpriteId.COMIC_EFFECT, SpriteId.LOOT_CRATE
  ]);

  update(world: World, renderer: PixiRenderer, context: GameContext, alpha: number) {
      if (!renderer.app || !renderer.app.stage) return;
      this.frameCount++;
  
      const gs = EntityUtils.getGameState(world);
      if (!gs) return;
      const gameTime = GameState.gameTime[gs];
      // Interpolated game time for smooth visual effects (fog, recoil, etc.)
      const visualTime = gameTime - GameConfig.FIXED_DELTA_TIME + (GameConfig.FIXED_DELTA_TIME * alpha);

      const isPaused = context.isLevelingUp || context.isGameOver || context.isMenu;
      this.updateCamera(world, renderer, context, visualTime, alpha, isPaused);
      this.updateTrackMarks(world);
  
      const entities = query(world, [Position, Renderable]);
      this.activeEids.clear();
      this.renderEntities(world, renderer, entities, context, visualTime, alpha, isPaused);
      
      this.cleanupSpriteMap(renderer, this.activeEids);
    }
  
    private updateCamera(world: World, renderer: PixiRenderer, context: GameContext, gameTime: number, alpha: number, isPaused: boolean) {
      // Camera follow player
      const eid = EntityUtils.getFirstPlayer(world);
      if (eid) {
        let px = MathUtils.lerp(Position.prevX[eid], Position.x[eid], alpha);
        let py = MathUtils.lerp(Position.prevY[eid], Position.y[eid], alpha);

        if (Position.prevX[eid] === 0 && Position.prevY[eid] === 0) {
            px = Position.x[eid];
            py = Position.y[eid];
        }
  
        // Camera FOV zoom out based on timeScale and device
        const isMobile = DeviceUtils.isMobile();
        const baseZoom = isMobile ? RenderConfig.CAMERA_ZOOM_MOBILE : RenderConfig.CAMERA_ZOOM_DESKTOP;
        const targetZoom = (context.timeScale > 1.0 ? 0.75 : 1.0) * baseZoom;
        renderer.gameContainer.scale.x = MathUtils.lerp(renderer.gameContainer.scale.x || 1.0, targetZoom, 0.1);
        renderer.gameContainer.scale.y = renderer.gameContainer.scale.x;
  
        // Pivot/center camera
        const rw = renderer.app?.renderer.width || window.innerWidth;
        const rh = renderer.app?.renderer.height || window.innerHeight;
  
        // Adjust pivot for zoom center
        renderer.gameContainer.pivot.x = px;
        renderer.gameContainer.pivot.y = py;
        renderer.gameContainer.position.x = rw / 2;
        renderer.gameContainer.position.y = rh / 2;
        renderer.gameContainer.sortableChildren = true;
  
        // Update background with zoom support
        if (renderer.bgTiling) {
          renderer.bgTiling.tileScale.set(renderer.gameContainer.scale.x);
          renderer.bgTiling.tilePosition.x = (-px * renderer.gameContainer.scale.x) + rw / 2;
          renderer.bgTiling.tilePosition.y = (-py * renderer.gameContainer.scale.x) + rh / 2;
        }
        
        if (renderer.fogTiling) {
          // Fog moves independently - 1.05 parallax (moves slightly faster than background, appearing closer), plus time-based pan
          renderer.fogTiling.tileScale.set(renderer.gameContainer.scale.x);
          renderer.fogTiling.tilePosition.x = (-px * 1.05 * renderer.gameContainer.scale.x) + rw / 2 + gameTime * 20;
          renderer.fogTiling.tilePosition.y = (-py * 1.05 * renderer.gameContainer.scale.x) + rh / 2 + gameTime * 10;
        }
        
        let shake = isPaused ? 0 : context.cameraShake;
        if (shake > 0 && context.screenShakeEnabled) {
            const shakeX = (RandomUtils.random() - 0.5) * shake;
            const shakeY = (RandomUtils.random() - 0.5) * shake;
            renderer.gameContainer.position.x += shakeX;
            renderer.gameContainer.position.y += shakeY;
            if (renderer.bgTiling) {
                renderer.bgTiling.tilePosition.x += shakeX;
                renderer.bgTiling.tilePosition.y += shakeY;
            }
            if (renderer.fogTiling) {
                renderer.fogTiling.tilePosition.x += shakeX;
                renderer.fogTiling.tilePosition.y += shakeY;
            }
            
            context.setCameraShake(shake * 0.9 - 0.1); // Decay
        }
      }
    }
  
    private updateTrackMarks(world: World) {
      const trackedEntities = query(world, [Position, TankTracks]);
      for (let i = 0; i < trackedEntities.length; i++) {
          const eid = trackedEntities[i];
          const x = Position.x[eid];
          const y = Position.y[eid];
          const lastX = TankTracks.lastX[eid];
          const lastY = TankTracks.lastY[eid];
          const distSq = (x - lastX) * (x - lastX) + (y - lastY) * (y - lastY);
          // Spawn a track every 15 pixels
          if (distSq > 225) { 
              EffectFactory.spawnTrackMark(world, x, y, Position.angle[eid]);
              TankTracks.lastX[eid] = x;
              TankTracks.lastY[eid] = y;
          }
      }
    }
  
    private renderEntities(world: World, renderer: PixiRenderer, entities: QueryResult, context: GameContext, gameTime: number, alpha: number, isPaused: boolean): void {
      for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];
        this.activeEids.add(eid);
  
        let x = MathUtils.lerp(Position.prevX[eid], Position.x[eid], alpha);
        let y = MathUtils.lerp(Position.prevY[eid], Position.y[eid], alpha);
        let angle = MathUtils.lerpAngle(Position.prevAngle[eid], Position.angle[eid], alpha);
  
        // Handle first frame (avoid dash from 0,0)
        if (Position.prevX[eid] === 0 && Position.prevY[eid] === 0) {
            x = Position.x[eid];
            y = Position.y[eid];
            angle = Position.angle[eid];
        }
  
        let container = this.spriteMap.get(eid);
        const spriteId = Renderable.spriteId[eid];
  
        if (container && container.lastSpriteId !== spriteId) {
          if (!renderer.gameContainer.destroyed) {
            renderer.gameContainer.removeChild(container);
          }
          PoolManager.containerPool.release(container);
          container = undefined;
        }
  
        if (!container) {
          container = PoolManager.containerPool.acquire();
          container.lastSpriteId = spriteId;
          
          switch (spriteId) {
            case SpriteId.DIRT_PATCH:
              container.zIndex = -20;
              break;
            case SpriteId.RAVINE:
              container.zIndex = -10;
              break;
            case SpriteId.WRECK:
              container.zIndex = -6;
              break;
            case SpriteId.PARTICLE_BUBBLE:
              container.zIndex = -5;
              break;
            case SpriteId.TRACK_MARK:
              container.zIndex = -15; // Above ravine and dirt patch, below objects
              container.blendMode = 'multiply';
              break;
            case SpriteId.LANDMINE:
            case SpriteId.LOOT_CRATE:
              container.zIndex = -2;
              break;
            case SpriteId.COMIC_EFFECT:
              container.zIndex = 30;
              break;
            case SpriteId.SMOKE_CLOUD:
              container.zIndex = 5;
              container.blendMode = 'normal';
              break;
            default:
              container.zIndex = 0;
              break;
          }
  
          SpriteBuilder.buildSprite(world, eid, spriteId, container);
  
          renderer.gameContainer.addChild(container);
          this.spriteMap.set(eid, container);
        } else {
          // Redraw "boiling" sprites periodically
          const isBoiling = !RenderSystem.STATIC_SPRITES.has(spriteId);
          // Handle warning marker scale uniquely
          if (spriteId === SpriteId.WARNING_MARKER && hasComponent(world, eid, WarningMarker)) {
              // The outer circle is static, we can shrink an inner circle by redrawing or we can just scale the whole thing.
              container.scale.set(1);
              SpriteBuilder.buildSprite(world, eid, spriteId, container);
          } else if (!isPaused && isBoiling && (this.frameCount + eid) % GameConfig.BOILING_LINES_INTERVAL_FRAMES === 0) {
              SpriteBuilder.buildSprite(world, eid, spriteId, container);
          }
        }
  
        const isParticle = hasComponent(world, eid, Particle);
        container.visible = Renderable.visible[eid] === 1 && (!isPaused || !isParticle);
  
        let shouldStepTransform = true;
        const isWreck = hasComponent(world, eid, Wreck);
        const isWarning = spriteId === SpriteId.WARNING_MARKER;
        const isAirdrop = hasComponent(world, eid, Airdrop);
  
        // Handle Particle-specific animations
        if (!isPaused && isParticle && hasComponent(world, eid, Lifetime)) {
           const lifeRatio = 1.0 - Math.max(0, Lifetime.timer[eid] / Particle.initialLife[eid]); 
           const scale = Particle.startScale[eid] + (Particle.endScale[eid] - Particle.startScale[eid]) * lifeRatio;
           container.scale.set(scale);
           container.alpha = Particle.startAlpha[eid] + (Particle.endAlpha[eid] - Particle.startAlpha[eid]) * lifeRatio;
        }
  
        // Only step transform for main physics entities (Player/Enemy tanks, projectiles)
        if (!isParticle && !isWarning && !isAirdrop && !isWreck) {
            const offset = RenderConfig.ENTITY_STEP_OFFSET ? (eid % RenderConfig.STEP_RATE) : 0;
            shouldStepTransform = (this.frameCount + offset) % RenderConfig.STEP_RATE === 0;
        }
  
        // Always apply interpolated transforms for smoothness
        container.x = x;
        container.y = y;
        container.rotation = angle;
        
        // Smear Frame logic
        let smearGraphics = container.getChildByName("smearGraphics") as PIXI.Graphics;
        if (hasComponent(world, eid, Velocity) && shouldStepTransform && !isParticle) {
            const vx = Velocity.x[eid];
            const vy = Velocity.y[eid];
            const speedSq = vx * vx + vy * vy;
            
            if (speedSq > RenderConfig.SMEAR_THRESHOLD * RenderConfig.SMEAR_THRESHOLD) {
                if (!smearGraphics) {
                    smearGraphics = PoolManager.graphicsPool.acquire();
                    smearGraphics.name = "smearGraphics";
                    container.addChildAt(smearGraphics, 0); // Put under sprite
                }
                smearGraphics.visible = true;
                smearGraphics.clear();
                
                // Draw motion lines pointing opposite to velocity vector relative to object rotation
                const vAngle = Math.atan2(vy, vx);
                const localAngle = vAngle - container.rotation;
                const speed = Math.sqrt(speedSq);
                const smearLen = speed * 0.15; // length factor
                
                smearGraphics.beginPath();
                for(let j=0; j<4; j++) {
                    const offsetY = (RandomUtils.random() - 0.5) * 30; // spread of lines
                    const startX = -Math.cos(localAngle) * (RandomUtils.random() * 10);
                    const startY = offsetY - Math.sin(localAngle) * (RandomUtils.random() * 10);
                    smearGraphics.moveTo(startX, startY);
                    smearGraphics.lineTo(startX - Math.cos(localAngle) * smearLen, startY - Math.sin(localAngle) * smearLen);
                }
                smearGraphics.stroke({ width: 2, color: 0x222222, alpha: 0.8 });
                
                // Optional: Stretch the main container if it's super fast (Kamikaze/Rammer)
                if (spriteId === SpriteId.ENEMY_KAMIKAZE || spriteId === SpriteId.ENEMY_RAMMER) {
                    // Actually container.scale is overridden below, so stretch the sprite instead
                    let sprite = container.getChildByName("sprite") as PIXI.Graphics;
                    if (sprite) {
                        sprite.scale.set(1 + speed * 0.001, Math.max(0.7, 1 - speed * 0.0005));
                        // Align sprite with velocity
                        sprite.rotation = localAngle;
                    }
                }
            } else {
                if (smearGraphics) {
                    smearGraphics.visible = false;
                }
                if (spriteId === SpriteId.ENEMY_KAMIKAZE || spriteId === SpriteId.ENEMY_RAMMER) {
                    let sprite = container.getChildByName("sprite") as PIXI.Graphics;
                    if (sprite) {
                        sprite.scale.set(1, 1);
                        sprite.rotation = 0;
                    }
                }
            }
        }
  
        let visualScale = 1;
        if (hasComponent(world, eid, Projectile)) {
            const pScale = Projectile.scale[eid];
            if (pScale > 0) {
                visualScale = pScale;
            }
        }
        let sprite = container.getChildByName("sprite") as PIXI.Graphics;
          if (hasComponent(world, eid, Airdrop)) {
              const z = Airdrop.z[eid];
              if (sprite) {
                  sprite.position.y = -z;
              }
              
              // Generate or position shadow
              let shadow = container.getChildByName("airdrop_shadow") as PIXI.Graphics;
              if (!shadow) {
                  shadow = PoolManager.graphicsPool.acquire();
                  shadow.name = "airdrop_shadow";
                  shadow.ellipse(0, 0, 20, 10);
                  shadow.fill({ color: 0x000000, alpha: 0.3 });
                  container.addChildAt(shadow, 0); 
              }
              shadow.visible = true;
              shadow.scale.set(Math.max(0.2, 1 - (z / 800)));
          } else {
              if (sprite) {
                  sprite.position.y = 0;
              }
              let shadow = container.getChildByName("airdrop_shadow");
              if (shadow) {
                  shadow.visible = false;
              }
          }
  
          if (!isParticle) {
            container.scale.set(visualScale);
          }

          // Burrowed emerge animation (Sapper)
          if (hasComponent(world, eid, Burrowed)) {
            const z = Burrowed.z[eid];
            const progress = Math.max(0, Math.min(1, 1 - z / 600));
            container.scale.set(progress * visualScale);
          }
  
          if (hasComponent(world, eid, Weapon)) {
            const turret = container.getChildByName("turret");
            if (turret) {
              turret.rotation = Weapon.aimAngle[eid] - Position.angle[eid];
              
              // Weapon Recoil Animation
              const timeSinceFire = Math.max(0, gameTime - Weapon.lastFired[eid]);
              const recoilDuration = 0.2; // 200ms
              if (timeSinceFire < recoilDuration) {
                  // recoil goes backward (negative X) then forward
                  const progress = timeSinceFire / recoilDuration;
                  // peak recoil at 0.2 of the duration
                  let recoilOffset = 0;
                  const maxRecoil = 6;
                  if (progress < 0.2) {
                      recoilOffset = -(progress / 0.2) * maxRecoil; 
                  } else {
                      recoilOffset = -maxRecoil * (1 - (progress - 0.2)/0.8);
                  }
                  turret.position.x = Math.cos(turret.rotation) * recoilOffset;
                  turret.position.y = Math.sin(turret.rotation) * recoilOffset;
              } else {
                  turret.position.x = 0;
                  turret.position.y = 0;
              }
            }
          }

          // Flamer flame effect — update every frame based on isSpraying
          if (!isPaused && spriteId === SpriteId.ENEMY_FLAMER && hasComponent(world, eid, FlamerTank)) {
            this.updateFlamerFlame(eid, container);
          }

          if (!isPaused && hasComponent(world, eid, Wreck) && hasComponent(world, eid, Lifetime)) {
            const lifeRatio = Lifetime.timer[eid] / Wreck.maxTimer[eid];

            if (lifeRatio > 0.6) {
              container.alpha = 0.8;
              if (RandomUtils.random() < 0.2) {
                const offsetX = (RandomUtils.random() - 0.5) * GameConfig.PARTICLE_OFFSET_RADIUS;
                const offsetY = (RandomUtils.random() - 0.5) * GameConfig.PARTICLE_OFFSET_RADIUS;
                EffectFactory.spawnParticleBubble(world, container.x + offsetX, container.y + offsetY);
              }
            } else if (lifeRatio > 0.2) {
              container.alpha = 0.5;
            } else {
              container.alpha = 0.5 * (lifeRatio / 0.2);
              container.scale.set(lifeRatio / 0.2);
            }
          }
  
          // Damage Flash & Gold Rush Tint
          let targetTint: number = GameConfig.DEFAULT_TINT;
          let baseAlpha: number = GameConfig.DEFAULT_SPRITE_ALPHA;
          
          if (hasComponent(world, eid, Wreck)) {
              targetTint = GameConfig.WRECK_TINT;
          } else if (hasComponent(world, eid, AIBehavior) && context.goldRushTimeLeft > 0) {
              targetTint = GameConfig.GOLD_RUSH_TINT;
          }
  
          if (hasComponent(world, eid, PlayerControlled) && hasComponent(world, eid, PlayerBuffs)) {
              if (PlayerBuffs.invulnTimer[eid] > 0) {
                  targetTint = GameConfig.INVULNERABILITY_TINT;
                  baseAlpha = (this.frameCount % GameConfig.INVULNERABILITY_BLINK_CYCLE_FRAMES < GameConfig.INVULNERABILITY_BLINK_HALF_CYCLE_FRAMES)
                      ? GameConfig.INVULNERABILITY_ALPHA_MIN
                      : GameConfig.INVULNERABILITY_ALPHA_MAX;
              }
          }
  
          if (hasComponent(world, eid, DamageFlash)) {
              if (DamageFlash.timer[eid] > 0) {
                  targetTint = GameConfig.DAMAGE_FLASH_TINT;
                  DamageFlash.timer[eid]--;
              } else {
                  removeComponent(world, eid, DamageFlash);
              }
          }
  
          // Telegraphing line
          this.renderTelegraphLine(world, eid, container);
  
          // Avoid overriding Wreck alpha with 1.0
          if (!hasComponent(world, eid, Wreck) && !hasComponent(world, eid, Particle)) {
              container.alpha = baseAlpha;
          }
  
          // Optimally store the target tint in the component and apply once to the root container.
          // Pixi 8 automatically cascades container.tint down to all children in the render pipeline,
          // completely avoiding expensive recursive JS traversals over the scene graph.
          Renderable.tint[eid] = targetTint;
          if (container.tint !== targetTint) {
              container.tint = targetTint;
          }
      }
    }
  
    private renderTelegraphLine(world: World, eid: number, container: PIXI.Container) {
    let telegraphLine = container.getChildByName("telegraphLine") as PIXI.Graphics;
    if (hasComponent(world, eid, AIBehavior)) {
        if (AIBehavior.state[eid] === AIState.WINDUP && hasComponent(world, eid, Weapon)) {
            if (!telegraphLine) {
                telegraphLine = PoolManager.graphicsPool.acquire();
                telegraphLine.name = "telegraphLine";
                container.addChildAt(telegraphLine, 0); // below everything
            }
            telegraphLine.visible = true;
            telegraphLine.clear();
            
            const aimAngle = Weapon.aimAngle[eid] - Position.angle[eid];
            const maxWindUp = Weapon.maxWindUpTimer[eid] || 0.4;
            const progress = Math.max(0, maxWindUp - Weapon.windUpTimer[eid]) / maxWindUp; // 0 to 1
            
            // Shorter, cardboardy comic block design that expands as it charges
            const maxLen = 60 + 140 * progress; // Significantly shorter length
            
            // Comic blink frame
            const isBlinkFrame = (this.frameCount % 8 < 4);
            
            // Segmented chunky dashed line
            const dashLen = 20;
            const gapLen = 10;
            let currentLen = 35; // start slightly away from the barrel
            
            while (currentLen < maxLen) {
                const nextLen = Math.min(maxLen, currentLen + dashLen);
                
                // Cardboard/comic thicker lines with subtle skewing
                const thickness = 5 + (currentLen / 200) * 8; 
                
                const x1 = Math.cos(aimAngle) * currentLen;
                const y1 = Math.sin(aimAngle) * currentLen;
                const x2 = Math.cos(aimAngle) * nextLen;
                const y2 = Math.sin(aimAngle) * nextLen;
                
                const pAngle = aimAngle + Math.PI / 2;
                const dx = Math.cos(pAngle) * thickness;
                const dy = Math.sin(pAngle) * thickness;
                
                // Skew amount for a hand-drawn comic feel
                const skew = 3;
                const sx = Math.cos(aimAngle) * skew;
                const sy = Math.sin(aimAngle) * skew;
                
                telegraphLine.beginPath();
                telegraphLine.moveTo(x1 + dx - sx, y1 + dy - sy);
                telegraphLine.lineTo(x2 + dx + sx, y2 + dy + sy);
                telegraphLine.lineTo(x2 - dx + sx, y2 - dy + sy);
                telegraphLine.lineTo(x1 - dx - sx, y1 - dy - sy);
                telegraphLine.closePath();
                
                telegraphLine.fill({ color: isBlinkFrame ? 0xff3333 : 0xff8888, alpha: 0.9 });
                telegraphLine.stroke({ width: 4, color: 0x111111, alpha: 1.0 }); // Solid black outline
                
                currentLen += dashLen + gapLen;
            }
            
            // Draw a targeting crosshair at the tip
            const endX = Math.cos(aimAngle) * maxLen;
            const endY = Math.sin(aimAngle) * maxLen;
            
            // Comic-style crosshair base, slightly jagged hexagon
            telegraphLine.beginPath();
            for (let i = 0; i < 6; i++) {
                const r = 14 + (i % 2 === 0 ? 3 : -2); // jagged radius
                const a = aimAngle + (i * Math.PI) / 3;
                if (i === 0) telegraphLine.moveTo(endX + Math.cos(a) * r, endY + Math.sin(a) * r);
                else telegraphLine.lineTo(endX + Math.cos(a) * r, endY + Math.sin(a) * r);
            }
            telegraphLine.closePath();
            telegraphLine.fill({ color: 0xffffff, alpha: 0.9 });
            telegraphLine.stroke({ width: 4, color: 0x111111, alpha: 1.0 });
            
            // Crosshair outer ticks
            telegraphLine.beginPath();
            telegraphLine.moveTo(endX - 18, endY);
            telegraphLine.lineTo(endX + 18, endY);
            telegraphLine.moveTo(endX, endY - 18);
            telegraphLine.lineTo(endX, endY + 18);
            telegraphLine.stroke({ width: 4, color: 0x111111, alpha: 1.0 });
            
            // Inner red target dot
            telegraphLine.circle(endX, endY, 5);
            telegraphLine.stroke({ width: 3, color: 0x111111, alpha: 1.0 });
            telegraphLine.fill({ color: 0xff1111, alpha: 1.0 });
        } else {
            if (telegraphLine) {
                telegraphLine.visible = false;
            }
        }
    } else {
        if (telegraphLine) {
            telegraphLine.visible = false;
        }
    }
  }
  
  private updateFlamerFlame(eid: number, container: PIXI.Container) {
    let flame = container.getChildByName("flameEffect") as PIXI.Graphics;
    if (!flame) {
      flame = PoolManager.graphicsPool.acquire();
      flame.name = "flameEffect";
      container.addChild(flame);
    }
    flame.clear();

    if (FlamerTank.isSpraying[eid] !== 1) return;

    const turret = container.getChildByName("turret");
    const tAngle = turret ? turret.rotation : 0;

    // Nozzle tip is at x=35 in turret local space
    const nozzleX = Math.cos(tAngle) * 35;
    const nozzleY = Math.sin(tAngle) * 35;
    const perpX = -Math.sin(tAngle);
    const perpY =  Math.cos(tAngle);

    // 4 flame puffs extending from the nozzle — inlined to avoid GC allocations
    for (let i = 0; i < 4; i++) {
      const dist   = 12 + i * 14;
      const spread = (((eid * 7 + i * 13 + this.frameCount * 3) % 20) - 10);
      const fx = nozzleX + Math.cos(tAngle) * dist + perpX * spread;
      const fy = nozzleY + Math.sin(tAngle) * dist + perpY * spread;
      const r  = 10 - i * 1.5;
      const color = i < 2 ? 0xffff00 : (i === 2 ? 0xff8800 : 0xff4400);
      flame.circle(fx, fy, r);
      flame.fill({ color, alpha: 0.9 });
    }
    flame.stroke({ width: 2, color: 0x000000, alpha: 0.4 });
  }

    private cleanupSpriteMap(renderer: PixiRenderer, activeEids: Set<number>) {
      for (const [eid, container] of this.spriteMap.entries()) {
        if (!activeEids.has(eid)) {
          if (!renderer.gameContainer.destroyed) {
            renderer.gameContainer.removeChild(container);
          }
          PoolManager.containerPool.release(container);
          this.spriteMap.delete(eid);
        }
      }
    }
}
