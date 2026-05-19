import * as PIXI from "pixi.js";
import { SpriteId } from "../../models/types";
import { Wall, Tree, House, BrokenHouse, Ravine, MapDecal, ComicEffect, WarningMarker, LootDrop, Lifetime } from "../../ecs/components";
import {  hasComponent , World } from "bitecs";
import { RandomUtils } from "../../utils/RandomUtils";

import { PoolManager } from "../../services/PoolManager";
import { GameConfig } from "../../config/GameConfig";
import { en } from "../../localization/en";

class SketchUtils {
  static jitter(amount: number) {
    return (RandomUtils.random() - 0.5) * amount * 2;
  }

  static drawSketchRect(
    g: PIXI.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor: number,
    addHatching: boolean = false
  ) {
    const halfW = w / 2;
    const halfH = h / 2;

    g.rect(x - halfW, y - halfH, w, h);
    g.fill({ color: fillColor });

    if (addHatching) {
      g.beginPath();
      for (let ix = -halfW; ix < halfW; ix += 6) {
        let t = h;
        if (ix - t < -halfW) t = ix + halfW;
        if (t > 0) {
          g.moveTo(x + ix, y - halfH);
          g.lineTo(x + ix - t, y - halfH + t);
        }
      }
      g.stroke({ width: 2, color: 0x000000, alpha: 0.5 });
    }

    const jAmount = 0.5;
    g.beginPath();
    g.moveTo(x - halfW + this.jitter(jAmount), y - halfH + this.jitter(jAmount));
    g.lineTo(x + halfW + this.jitter(jAmount), y - halfH + this.jitter(jAmount));
    g.lineTo(x + halfW + this.jitter(jAmount), y + halfH + this.jitter(jAmount));
    g.lineTo(x - halfW + this.jitter(jAmount), y + halfH + this.jitter(jAmount));
    g.closePath();
    g.stroke({ width: 3, color: 0x000000, join: "round" });
  }

  static drawSketchCircle(g: PIXI.Graphics, x: number, y: number, r: number, fillColor: number, addHatching: boolean = false) {
    g.circle(x, y, r);
    g.fill({ color: fillColor });

    if (addHatching) {
        g.beginPath();
        for (let i = -r; i < r; i += 6) {
            const chord = Math.sqrt(r*r - i*i);
            g.moveTo(x + i, y - chord);
            g.lineTo(x + i, y + chord);
        }
        g.stroke({ width: 1.5, color: 0x000000, alpha: 0.4 });
    }

    g.beginPath();
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const jitterR = r + this.jitter(1.0);
      const px = x + Math.cos(theta) * jitterR;
      const py = y + Math.sin(theta) * jitterR;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke({ width: 3, color: 0x000000, join: "round" });
  }

  static drawComicBlock(
    g: PIXI.Graphics,
    x: number, y: number, w: number, h: number,
    baseColor: number, shadowColor: number, highlightColor: number
  ) {
    const halfW = w / 2;
    const halfH = h / 2;

    // Base fill
    g.rect(x - halfW, y - halfH, w, h);
    g.fill({ color: baseColor });

    // Inner Shadow (bottom and right edges)
    g.beginPath();
    g.moveTo(x - halfW, y + halfH);
    g.lineTo(x + halfW, y + halfH);
    g.lineTo(x + halfW, y - halfH);
    g.lineTo(x + halfW - w*0.3, y - halfH + h*0.3);
    g.lineTo(x - halfW + w*0.3, y + halfH - h*0.3);
    g.closePath();
    g.fill({ color: shadowColor });

    // Highlight (top left corner)
    g.beginPath();
    g.moveTo(x - halfW, y - halfH);
    g.lineTo(x + halfW, y - halfH);
    g.lineTo(x - halfW, y + halfH);
    g.closePath();
    g.fill({ color: highlightColor, alpha: 0.8 });

    // Sketchy Outline
    const jAmount = 0.5;
    g.beginPath();
    for(let i = 0; i < 2; i++) {
      g.moveTo(x - halfW + this.jitter(jAmount), y - halfH + this.jitter(jAmount));
      g.lineTo(x + halfW + this.jitter(jAmount), y - halfH + this.jitter(jAmount));
      g.lineTo(x + halfW + this.jitter(jAmount), y + halfH + this.jitter(jAmount));
      g.lineTo(x - halfW + this.jitter(jAmount), y + halfH + this.jitter(jAmount));
      g.closePath();
    }
    g.stroke({ width: 2.5, color: 0x000000, join: "round", cap: "round" });
  }

  static drawComicCylinder(
    g: PIXI.Graphics,
    x: number, y: number, r: number,
    baseColor: number, shadowColor: number, highlightColor: number
  ) {
    g.circle(x, y, r);
    g.fill({ color: baseColor });

    // Crescent shadow
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 4, 3 * Math.PI / 4);
    g.fill({ color: shadowColor });

    // Crescent highlight
    g.beginPath();
    g.arc(x, y, r * 0.8, 3 * Math.PI / 4, 7 * Math.PI / 4);
    g.stroke({ width: r * 0.2, color: highlightColor, cap: "round" });

    // Sketchy Outline
    g.beginPath();
    const segments = 16;
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const jitterR = r + this.jitter(0.8);
        const px = x + Math.cos(theta) * jitterR;
        const py = y + Math.sin(theta) * jitterR;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
    }
    g.stroke({ width: 2.5, color: 0x000000, join: "round" });
  }

  static drawSketchLine(g: PIXI.Graphics, x1: number, y1: number, x2: number, y2: number, jAmount: number = 1.0, color = 0x000000, width = 3) {
    g.beginPath();
    g.moveTo(x1 + this.jitter(jAmount), y1 + this.jitter(jAmount));
    g.lineTo(x2 + this.jitter(jAmount), y2 + this.jitter(jAmount));
    g.stroke({ width, color, join: "round" });
  }
}

export class SpriteBuilder {
  static drawEnemyGrenadier(container: PIXI.Container) {
    const TANK_W = 54;
    const TANK_H = 34; // Wide, low body
    const TRACK_W = 60;
    const TRACK_H = 12;
    const BASE_COLOR = 0x5a554a;
    const SHADOW_COLOR = 0x3a352a;
    const HIGHLIGHT_COLOR = 0x7a756a;
    const TRACK_COLOR = 0x222222;
    const TRACK_SHADOW = 0x111111;
    
    let chassis = container.getChildByName("chassis") as PIXI.Graphics;
    if (!chassis) {
        chassis = PoolManager.graphicsPool.acquire();
        chassis.name = "chassis";
        container.addChild(chassis);
    }
    chassis.clear();
    
    // Tracks
    SketchUtils.drawComicBlock(chassis, 0, -20, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);
    SketchUtils.drawComicBlock(chassis, 0, 20, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);

    // Low, wide hull
    SketchUtils.drawComicBlock(chassis, 0, 0, TANK_W, TANK_H, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    
    let turret = container.getChildByName("turret") as PIXI.Graphics;
    if (!turret) {
        turret = PoolManager.graphicsPool.acquire();
        turret.name = "turret";
        container.addChild(turret);
    }
    turret.clear();
    
    // Huge mortar tower (tower block, not just a thin bar)
    SketchUtils.drawComicCylinder(turret, 0, 0, 18, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    SketchUtils.drawComicBlock(turret, 0, 0, 20, 20, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    // Evil red eye
    SketchUtils.drawSketchCircle(turret, 10, 0, 5, 0xff0000);
  }

  static drawEnemyFlamer(container: PIXI.Container) {
    const TANK_W = 46;
    const TANK_H = 40;
    const TRACK_W = 54;
    const TRACK_H = 12;
    const BASE_COLOR = 0x6a2a2a;
    const SHADOW_COLOR = 0x4a1a1a;
    const HIGHLIGHT_COLOR = 0x8a4a4a;
    const TRACK_COLOR = 0x222222;
    const TRACK_SHADOW = 0x111111;
    
    let chassis = container.getChildByName("chassis") as PIXI.Graphics;
    if (!chassis) {
        chassis = PoolManager.graphicsPool.acquire();
        chassis.name = "chassis";
        container.addChild(chassis);
    }
    chassis.clear();

    // Tracks
    SketchUtils.drawComicBlock(chassis, 0, -22, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);
    SketchUtils.drawComicBlock(chassis, 0, 22, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);
    
    // Wide body
    SketchUtils.drawComicBlock(chassis, 0, 0, TANK_W, TANK_H, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    
    // Two barrels on back
    SketchUtils.drawComicCylinder(chassis, -15, -12, 8, 0x333333, 0x111111, 0x555555);
    SketchUtils.drawComicCylinder(chassis, -15, 12, 8, 0x333333, 0x111111, 0x555555);
    // Connect barrels with pipes
    SketchUtils.drawSketchLine(chassis, -15, -12, -15, 12, 0.5, 0x222222, 4);

    let flamethrower = container.getChildByName("turret") as PIXI.Graphics;
    if (!flamethrower) {
        flamethrower = PoolManager.graphicsPool.acquire();
        flamethrower.name = "turret";
        container.addChild(flamethrower);
    }
    flamethrower.clear();

    // Turret base
    SketchUtils.drawComicCylinder(flamethrower, 0, 0, 14, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    
    // Huge flamethrower nozzle
    SketchUtils.drawComicBlock(flamethrower, 20, 0, 30, 10, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    // Igniter / Pilot light at the end
    SketchUtils.drawComicCylinder(flamethrower, 35, 0, 4, 0xffaa00, 0xcc6600, 0xffff00);

    // Evil red eye
    SketchUtils.drawSketchCircle(flamethrower, 6, 0, 4, 0xff0000);
  }

  static drawEnemySapper(container: PIXI.Container) {
    const TANK_W = 30; // Narrow body
    const TANK_H = 34;
    const TRACK_W = 36;
    const TRACK_H = 10;
    const BASE_COLOR = 0x4a4a4a;
    const SHADOW_COLOR = 0x2a2a2a;
    const HIGHLIGHT_COLOR = 0x6a6a6a;
    const TRACK_COLOR = 0x222222;
    const TRACK_SHADOW = 0x111111;
    
    let chassis = container.getChildByName("chassis") as PIXI.Graphics;
    if (!chassis) {
        chassis = PoolManager.graphicsPool.acquire();
        chassis.name = "chassis";
        container.addChild(chassis);
    }
    chassis.clear();

    // Tracks
    SketchUtils.drawComicBlock(chassis, 0, -18, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);
    SketchUtils.drawComicBlock(chassis, 0, 18, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);
    
    // Narrow hull
    SketchUtils.drawComicBlock(chassis, 0, 0, TANK_W, TANK_H, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    
    let turret = container.getChildByName("turret") as PIXI.Graphics;
    if (!turret) {
        turret = PoolManager.graphicsPool.acquire();
        turret.name = "turret";
        container.addChild(turret);
    }
    turret.clear();

    // Turret base
    SketchUtils.drawComicCylinder(turret, 0, 0, 12, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    // Drill Base
    SketchUtils.drawComicBlock(turret, 14, 0, 10, 16, 0x666666, 0x444444, 0x888888);
    
    // Drill
    turret.beginPath();
    turret.moveTo(19, -8);
    turret.lineTo(34, 0);
    turret.lineTo(19, 8);
    turret.closePath();
    turret.fill({ color: 0xaaaaaa });
    
    // Drill spiral lines
    turret.beginPath();
    turret.moveTo(22, -6);
    turret.lineTo(24, 4);
    turret.moveTo(26, -4);
    turret.lineTo(28, 2);
    turret.stroke({ width: 1.5, color: 0x444444 });

    turret.stroke({ width: 2.5, color: 0x000000, join: "round" });

    // Evil red eye
    SketchUtils.drawSketchCircle(turret, 5, 0, 3.5, 0xff0000);
  }

  static buildSprite(
    world: World,
    eid: number,
    spriteId: number,
    container: PIXI.Container
  ) {
    if (spriteId === SpriteId.PLAYER_TANK) {
      SpriteBuilder.drawPlayerTank(container);
    } else if (spriteId === SpriteId.ENEMY_SHOOTER) {
      SpriteBuilder.drawEnemyShooter(container);
    } else if (spriteId === SpriteId.ENEMY_TANK) {
      SpriteBuilder.drawEnemyTank(container);
    } else if (spriteId === SpriteId.ENEMY_SNIPER) {
      SpriteBuilder.drawEnemySniper(container);
    } else if (spriteId === SpriteId.ENEMY_GRENADIER) {
        SpriteBuilder.drawEnemyGrenadier(container);
    } else if (spriteId === SpriteId.ENEMY_FLAMER) {
        SpriteBuilder.drawEnemyFlamer(container);
    } else if (spriteId === SpriteId.ENEMY_SAPPER) {
        SpriteBuilder.drawEnemySapper(container);
    } else if (spriteId === SpriteId.BOSS_TITAN) {
        SpriteBuilder.drawBossTitan(container);
    } else if (spriteId === SpriteId.COMIC_EFFECT && hasComponent(world, eid, ComicEffect)) {
      if (container.children.length === 0) {
        SpriteBuilder.drawComicEffect(container, ComicEffect.textType[eid]);
      }
    } else {

      let sprite = container.getChildByName("sprite") as PIXI.Graphics;
      if (!sprite) {
        sprite = PoolManager.graphicsPool.acquire();
        sprite.name = "sprite";
        container.addChild(sprite);
      }
      sprite.clear();

      if (spriteId === SpriteId.ENEMY_RAMMER) {
        SpriteBuilder.drawEnemyRammer(sprite);
      } else if (spriteId === SpriteId.ENEMY_KAMIKAZE) {
        SpriteBuilder.drawEnemyKamikaze(sprite);
      } else if (spriteId === SpriteId.PROJECTILE) {
        SpriteBuilder.drawProjectile(sprite);
      } else if (spriteId === SpriteId.WALL && hasComponent(world, eid, Wall)) {
        SpriteBuilder.drawWall(sprite, Wall.width[eid], Wall.height[eid]);
      } else if (spriteId === SpriteId.TREE && hasComponent(world, eid, Tree)) {
        SpriteBuilder.drawTree(sprite, Tree.radius[eid]);
      } else if (spriteId === SpriteId.HOUSE && hasComponent(world, eid, House)) {
        SpriteBuilder.drawHouse(sprite, House.width[eid], House.height[eid]);
      } else if (spriteId === SpriteId.BROKEN_HOUSE && hasComponent(world, eid, BrokenHouse)) {
        SpriteBuilder.drawBrokenHouse(sprite, BrokenHouse.width[eid], BrokenHouse.height[eid]);
      } else if (spriteId === SpriteId.RAVINE && hasComponent(world, eid, Ravine)) {
        SpriteBuilder.drawRavine(sprite, Ravine.width[eid], Ravine.height[eid]);
      } else if (spriteId === SpriteId.DIRT_PATCH && hasComponent(world, eid, MapDecal)) {
        SpriteBuilder.drawDirtPatch(sprite, MapDecal.width[eid], MapDecal.height[eid]);
      } else if (spriteId === SpriteId.PARTICLE_BUBBLE) {
        SpriteBuilder.drawParticleBubble(sprite);
      } else if (spriteId === SpriteId.WARNING_MARKER && hasComponent(world, eid, WarningMarker)) {
        SpriteBuilder.drawWarningMarker(sprite, WarningMarker.maxRadius[eid], WarningMarker.timer[eid], WarningMarker.maxTimer[eid], WarningMarker.type[eid]);
      } else if (spriteId === SpriteId.LOOT_CRATE && hasComponent(world, eid, LootDrop)) {
        SpriteBuilder.drawLootCrate(sprite, LootDrop.type[eid]);
      } else if (spriteId === SpriteId.MUZZLE_FLASH) {
        SpriteBuilder.drawMuzzleFlash(sprite);
      } else if (spriteId === SpriteId.TRACK_MARK) {
        SpriteBuilder.drawTrackMark(sprite);
      } else if (spriteId === SpriteId.SMOKE_CLOUD) {
        SpriteBuilder.drawSmokeCloud(sprite, eid);
      } else if (spriteId === SpriteId.LANDMINE) {
        let isBlinking = false;
        if (hasComponent(world, eid, Lifetime)) {
           // Blink rapidly in the last 2 seconds
           if (Lifetime.timer[eid] < 2.0) {
               isBlinking = Math.floor(Lifetime.timer[eid] * 10) % 2 === 0;
           }
        }
        SpriteBuilder.drawLandmine(sprite, isBlinking);
      } else if (spriteId === SpriteId.WRECK) {
        SpriteBuilder.drawWreck(sprite);
      }
    }
  }

  static drawWreck(sprite: PIXI.Graphics) {
    // Burned-out tracks
    SketchUtils.drawSketchRect(sprite,  0, -20, 52, 10, 0x111111);
    SketchUtils.drawSketchRect(sprite,  0,  20, 52, 10, 0x111111);

    // Charred hull
    SketchUtils.drawComicBlock(sprite, 0, 0, 44, 34, 0x222222, 0x111111, 0x3a3a3a);

    // Burn craters
    sprite.circle(-8, -5, 9);
    sprite.circle(10,  6, 12);
    sprite.fill({ color: 0x111111 });

    // Diagonal scorch hatching
    sprite.beginPath();
    for (let i = -22; i < 22; i += 6) {
      sprite.moveTo(i,     -15);
      sprite.lineTo(i + 10, 15);
    }
    sprite.stroke({ width: 1.5, color: 0x000000, alpha: 0.45 });

    // Ruined turret stub
    SketchUtils.drawComicCylinder(sprite, -2, 0, 8, 0x1a1a1a, 0x111111, 0x2a2a2a);
  }

  static drawSmokeCloud(sprite: PIXI.Graphics, eid: number) {
    const radius = 15;
    sprite.clear();
    
    const numPuffs = 4 + (eid % 3);
    const puffs = [];
    
    puffs.push({ x: 0, y: 0, r: radius });
    
    for (let i = 0; i < numPuffs; i++) {
        const randAngle = Math.sin(eid * 13.37 + i * 1.5) * Math.PI * 2; 
        const randDist = radius * (0.4 + 0.6 * Math.abs(Math.cos(eid * 7.1 + i)));
        const puffRadius = radius * (0.5 + 0.5 * Math.abs(Math.sin(eid * 3.3 + i * 2.1))); 
        
        puffs.push({ 
           x: Math.cos(randAngle) * randDist, 
           y: Math.sin(randAngle) * randDist, 
           r: puffRadius 
        });
    }
    
    for (let p of puffs) {
        sprite.circle(p.x, p.y, p.r);
    }
    sprite.fill({ color: 0x444444 });

    sprite.beginPath();
    for (let c = 0; c < 2; c++) {
      for (let p of puffs) {
          sprite.circle(p.x + SketchUtils.jitter(0.8), p.y + SketchUtils.jitter(0.8), p.r);
      }
    }
    sprite.stroke({ width: 2, color: 0x111111, join: 'round', cap: 'round', alpha: 0.8 });
  }

  static drawLandmine(sprite: PIXI.Graphics, isBlinking: boolean) {
    sprite.clear();
    const R = 14;

    // Base pad
    SketchUtils.drawComicBlock(sprite, 0, 0, R * 2, R * 2, 0x445544, 0x223322, 0x667766);
    
    // Middle bump
    sprite.circle(0, 0, R * 0.6);
    sprite.fill({ color: 0x667766 });
    sprite.stroke({ color: 0x223322, width: 2 });

    // Blink indicator
    sprite.circle(0, 0, R * 0.25);
    sprite.fill({ color: isBlinking ? 0xff0000 : 0x550000 });
  }

  static drawTrackMark(sprite: PIXI.Graphics) {
    sprite.clear();
    // Two parallel tracks, matching roughly the tank track width
    SketchUtils.drawSketchRect(sprite, -20, 0, 10, 16, 0x000000);
    SketchUtils.drawSketchRect(sprite, 20, 0, 10, 16, 0x000000);
  }

  static drawMuzzleFlash(sprite: PIXI.Graphics) {
    const length = GameConfig.MUZZLE_FLASH_LENGTH;
    const width = GameConfig.MUZZLE_FLASH_WIDTH;
    const halfWidth = width / 2;
    const innerLength = length * 0.7;
    const innerWidth = width * 0.5;

    // Outer flash (comic style with thick stroke)
    sprite.beginPath();
    sprite.moveTo(0, -halfWidth); // Base top
    sprite.lineTo(length * 0.3, -halfWidth * 1.5); // Flare out
    sprite.lineTo(length, 0); // Tip
    sprite.lineTo(length * 0.3, halfWidth * 1.5); // Flare out bottom
    sprite.lineTo(0, halfWidth); // Base bottom
    sprite.closePath();
    sprite.fill({ color: 0xffaa00, alpha: 1.0 }); // Orange inner flash
    sprite.stroke({ color: 0x000000, width: 3, alignment: 0 }); // Black comic outline

    // Inner bright core
    sprite.beginPath();
    sprite.moveTo(0, -innerWidth / 2);
    sprite.lineTo(innerLength * 0.4, -innerWidth);
    sprite.lineTo(innerLength, 0);
    sprite.lineTo(innerLength * 0.4, innerWidth);
    sprite.lineTo(0, innerWidth / 2);
    sprite.closePath();
    sprite.fill({ color: 0xffffff, alpha: 1.0 }); // White core
  }

  static drawWarningMarker(sprite: PIXI.Graphics, radius: number, timer: number, maxTimer: number, type: number) {
    const progress = Math.max(0, Math.min(1, timer / maxTimer));
    
    // Draw ground shadow
    sprite.beginPath();
    sprite.ellipse(0, 0, radius * 0.4 * progress, radius * 0.2 * progress);
    sprite.fill({ color: 0x000000, alpha: 0.4 * progress });

    const fallHeight = 600 * (1 - progress);
    const yOffset = -fallHeight;

    if (type === 2) {
        // Loot Drop: Parachute + Crate
        sprite.beginPath();
        sprite.arc(0, yOffset - 30, 25, Math.PI, 0);
        sprite.lineTo(25, yOffset - 30);
        sprite.lineTo(-25, yOffset - 30);
        sprite.fill({ color: 0xeeeeaa });
        sprite.stroke({ width: 2, color: 0x000000 });
        
        // Parachute strings
        sprite.beginPath();
        sprite.moveTo(-20, yOffset - 30);
        sprite.lineTo(-10, yOffset - 10);
        sprite.moveTo(0, yOffset - 30);
        sprite.lineTo(0, yOffset - 10);
        sprite.moveTo(20, yOffset - 30);
        sprite.lineTo(10, yOffset - 10);
        sprite.stroke({ width: 1, color: 0x000000 });

        // Crate
        SketchUtils.drawComicBlock(sprite, 0, yOffset, 30, 30, 0xffddaa, 0xccaabb, 0xffffff);
        sprite.beginPath();
        sprite.moveTo(-15, yOffset - 15);
        sprite.lineTo(15, yOffset + 15);
        sprite.moveTo(15, yOffset - 15);
        sprite.lineTo(-15, yOffset + 15);
        sprite.stroke({ width: 2, color: 0x886655 });
    } else {
        // Bomb
        sprite.beginPath();
        sprite.ellipse(0, yOffset, 10, 20);
        sprite.fill({ color: 0x333333 });
        sprite.stroke({ width: 2, color: 0x000000 });

        // Tail fins
        sprite.beginPath();
        sprite.moveTo(-4, yOffset - 15);
        sprite.lineTo(-12, yOffset - 25);
        sprite.lineTo(-4, yOffset - 20);
        sprite.lineTo(4, yOffset - 20);
        sprite.lineTo(12, yOffset - 25);
        sprite.lineTo(4, yOffset - 15);
        sprite.fill({ color: 0x333333 });
        sprite.stroke({ width: 2, color: 0x000000 });

        const innerRadius = radius * (1 - progress);
        sprite.beginPath();
        sprite.circle(0, 0, radius);
        sprite.stroke({ width: 2, color: 0xff4422, alpha: 0.5 });
        
        if (innerRadius > 0) {
            sprite.beginPath();
            sprite.circle(0, 0, innerRadius);
            sprite.fill({ color: 0xff4422, alpha: 0.3 });
            sprite.stroke({ width: 2, color: 0xff0000, alpha: 0.8 });
        }
    }
  }

  static drawLootCrate(sprite: PIXI.Graphics, type: number) {
    SketchUtils.drawComicBlock(sprite, 0, 0, 40, 40, 0xffddaa, 0xccaabb, 0xffffff);
    sprite.beginPath();
    sprite.moveTo(-20, -20);
    sprite.lineTo(20, 20);
    sprite.moveTo(20, -20);
    sprite.lineTo(-20, 20);
    sprite.stroke({ width: 2, color: 0x886655 });

    sprite.beginPath();
    sprite.circle(0, 0, 10);
    sprite.fill({ color: type === 0 ? 0x00aaff : type === 1 ? 0xffaa00 : 0x22c55e });
    sprite.stroke({ width: 2, color: 0x000000 });
  }

  static drawPlayerTank(container: PIXI.Container) {
    const TANK_W = 48;
    const TANK_H = 38;
    const TRACK_W = 54;
    const TRACK_H = 12;
    const BASE_COLOR = 0xf2f2f2;
    const SHADOW_COLOR = 0xc0c0c0;
    const HIGHLIGHT_COLOR = 0xffffff;
    const TRACK_COLOR = 0x666666;
    const TRACK_SHADOW = 0x333333;

    let chassis = container.getChildByName("chassis") as PIXI.Graphics;
    if (!chassis) {
      chassis = PoolManager.graphicsPool.acquire();
      chassis.name = "chassis";
      container.addChild(chassis);
    }
    chassis.clear();

    // Tracks
    SketchUtils.drawComicBlock(chassis, 0, -20, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x888888);
    SketchUtils.drawComicBlock(chassis, 0, 20, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x888888);

    // Hull
    SketchUtils.drawComicBlock(chassis, 0, 0, TANK_W, TANK_H, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    let turret = container.getChildByName("turret") as PIXI.Graphics;
    if (!turret) {
      turret = PoolManager.graphicsPool.acquire();
      turret.name = "turret";
      container.addChild(turret);
    }
    turret.clear();

    // Muzzle Brake
    SketchUtils.drawComicBlock(turret, 38, 0, 10, 12, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    // Gun Barrel
    SketchUtils.drawComicBlock(turret, 20, 0, 30, 8, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    // Turret Base
    SketchUtils.drawComicCylinder(turret, 0, 0, 16, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    
    // Hatch
    SketchUtils.drawComicCylinder(turret, -4, 0, 6, 0xffffff, 0xcccccc, 0xffffff);
  }

  static drawEnemyShooter(container: PIXI.Container) {
    const TANK_W = 42;
    const TANK_H = 34;
    const TRACK_W = 48;
    const TRACK_H = 10;
    const BASE_COLOR = 0x555555;
    const SHADOW_COLOR = 0x222222;
    const HIGHLIGHT_COLOR = 0x777777;
    const TRACK_COLOR = 0x333333;
    const TRACK_SHADOW = 0x111111;

    let chassis = container.getChildByName("chassis") as PIXI.Graphics;
    if (!chassis) {
      chassis = PoolManager.graphicsPool.acquire();
      chassis.name = "chassis";
      container.addChild(chassis);
    }
    chassis.clear();

    SketchUtils.drawComicBlock(chassis, 0, -18, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);
    SketchUtils.drawComicBlock(chassis, 0, 18, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);

    SketchUtils.drawComicBlock(chassis, 0, 0, TANK_W, TANK_H, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    let turret = container.getChildByName("turret") as PIXI.Graphics;
    if (!turret) {
      turret = PoolManager.graphicsPool.acquire();
      turret.name = "turret";
      container.addChild(turret);
    }
    turret.clear();

    SketchUtils.drawComicBlock(turret, 18, 0, 24, 6, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    SketchUtils.drawComicCylinder(turret, 0, 0, 14, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    // Evil red eye
    SketchUtils.drawSketchCircle(turret, 6, 0, 4, 0xff0000);
  }

  static drawEnemyTank(container: PIXI.Container) {
    const TANK_W = 54;
    const TANK_H = 46;
    const TRACK_W = 60;
    const TRACK_H = 14;
    const BASE_COLOR = 0x4a4a5a;
    const SHADOW_COLOR = 0x2a2a3a;
    const HIGHLIGHT_COLOR = 0x6a6a7a;
    const TRACK_COLOR = 0x222222;
    const TRACK_SHADOW = 0x0a0a0a;

    let chassis = container.getChildByName("chassis") as PIXI.Graphics;
    if (!chassis) {
        chassis = PoolManager.graphicsPool.acquire();
        chassis.name = "chassis";
        container.addChild(chassis);
    }
    chassis.clear();

    SketchUtils.drawComicBlock(chassis, 0, -22, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x333333);
    SketchUtils.drawComicBlock(chassis, 0, 22, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x333333);
    SketchUtils.drawComicBlock(chassis, 0, 0, TANK_W, TANK_H, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    let turret = container.getChildByName("turret") as PIXI.Graphics;
    if (!turret) {
        turret = PoolManager.graphicsPool.acquire();
        turret.name = "turret";
        container.addChild(turret);
    }
    turret.clear();

    SketchUtils.drawComicBlock(turret, 26, 0, 36, 12, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR); // Big gun
    SketchUtils.drawComicCylinder(turret, 0, 0, 20, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR); // Large turret
    SketchUtils.drawSketchCircle(turret, 8, 0, 5, 0xff0000); // Big red eye
  }

  static drawEnemySniper(container: PIXI.Container) {
    const TANK_W = 32;
    const TANK_H = 24;
    const TRACK_W = 38;
    const TRACK_H = 8;
    const BASE_COLOR = 0x2a5a3a;
    const SHADOW_COLOR = 0x1a3a2a;
    const HIGHLIGHT_COLOR = 0x4a7a5a;
    const TRACK_COLOR = 0x222222;
    const TRACK_SHADOW = 0x111111;

    let chassis = container.getChildByName("chassis") as PIXI.Graphics;
    if (!chassis) {
        chassis = PoolManager.graphicsPool.acquire();
        chassis.name = "chassis";
        container.addChild(chassis);
    }
    chassis.clear();

    SketchUtils.drawComicBlock(chassis, 0, -14, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);
    SketchUtils.drawComicBlock(chassis, 0, 14, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x444444);
    SketchUtils.drawComicBlock(chassis, 0, 0, TANK_W, TANK_H, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    let turret = container.getChildByName("turret") as PIXI.Graphics;
    if (!turret) {
        turret = PoolManager.graphicsPool.acquire();
        turret.name = "turret";
        container.addChild(turret);
    }
    turret.clear();

    SketchUtils.drawComicBlock(turret, 20, 0, 32, 4, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR); // Long thin gun
    SketchUtils.drawComicCylinder(turret, 0, 0, 10, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR); // Small turret
    SketchUtils.drawSketchCircle(turret, 4, 0, 3, 0xff0000); // Small red eye
  }

  static drawEnemyRammer(sprite: PIXI.Graphics) {
    const RADIUS = 20;
    const BODY_COLOR = 0xff8888;
    const SHADOW_COLOR = 0xcc4444;
    const HIGHLIGHT_COLOR = 0xffcccc;

    SketchUtils.drawComicCylinder(sprite, 0, 0, RADIUS, BODY_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    // Spikes around
    sprite.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      sprite.moveTo(cosA * RADIUS, sinA * RADIUS);
      sprite.lineTo(cosA * (RADIUS + 10) + SketchUtils.jitter(2), sinA * (RADIUS + 10) + SketchUtils.jitter(2));
    }
    sprite.stroke({ width: 3, color: 0x000000, join: "round", cap: "round" });
    
    // Angry face details
    SketchUtils.drawSketchLine(sprite, -8, -8, 2, -3, 1.0, 0x000000, 4);
    SketchUtils.drawSketchLine(sprite, -8, 8, 2, 3, 1.0, 0x000000, 4);
    
    // Eye dots
    sprite.circle(0, -6, 2.5);
    sprite.circle(0, 6, 2.5);
    sprite.fill({ color: 0xff0000 });
  }

  static drawEnemyKamikaze(sprite: PIXI.Graphics) {
    const BODY_COLOR = 0xff5500;
    const SHADOW_COLOR = 0xaa2200;

    // Fast-looking larger triangle
    sprite.beginPath();
    sprite.moveTo(22, 0);
    sprite.lineTo(-14, -18);
    sprite.lineTo(-14, 18);
    sprite.fill({ color: BODY_COLOR });
    
    // Inner Shadow (bottom half)
    sprite.beginPath();
    sprite.moveTo(22, 0);
    sprite.lineTo(-14, 0);
    sprite.lineTo(-14, 18);
    sprite.fill({ color: SHADOW_COLOR });

    // Wobbly outline
    sprite.beginPath();
    for(let i=0; i<2; i++) {
        sprite.moveTo(22 + SketchUtils.jitter(1), SketchUtils.jitter(1));
        sprite.lineTo(-14 + SketchUtils.jitter(1), -18 + SketchUtils.jitter(1));
        sprite.lineTo(-14 + SketchUtils.jitter(1), 18 + SketchUtils.jitter(1));
        sprite.closePath();
    }
    sprite.stroke({ width: 3, color: 0x000000, join: "round" });

    // Warning symbol
    SketchUtils.drawComicCylinder(sprite, -4, 0, 7, 0xffff00, 0xaaaa00, 0xffffff);

    // Sketchy sparks trailing behind
    sprite.beginPath();
    sprite.moveTo(-18, -8);
    for (let i = 0; i < 3; i++) {
        sprite.lineTo(-18 - RandomUtils.random() * 14, -8 + SketchUtils.jitter(4));
    }
    sprite.moveTo(-18, 8);
    for (let i = 0; i < 3; i++) {
        sprite.lineTo(-18 - RandomUtils.random() * 14, 8 + SketchUtils.jitter(4));
    }
    sprite.stroke({ width: 2, color: 0xffaa00, cap: "round" });
  }

  static drawProjectile(sprite: PIXI.Graphics) {
    SketchUtils.drawComicCylinder(sprite, 0, 0, 6, 0xffff00, 0xff8800, 0xffffff);
    SketchUtils.drawSketchLine(sprite, -6, 0, -20, 0, 1.5, 0x000000, 3);
    SketchUtils.drawSketchLine(sprite, -6, -4, -16, -3, 1.5, 0x000000, 2);
    SketchUtils.drawSketchLine(sprite, -6, 4, -16, 3, 1.5, 0x000000, 2);
  }

  static drawWall(sprite: PIXI.Graphics, w: number, h: number) {
    SketchUtils.drawComicBlock(sprite, 0, 0, w, h, 0xe0e0e0, 0x999999, 0xffffff);
    
    // Draw some brick lines
    sprite.beginPath();
    for (let iy = -h / 2 + 10; iy < h / 2; iy += 10) {
        sprite.moveTo(-w / 2 + 2, iy + SketchUtils.jitter(1));
        sprite.lineTo(w / 2 - 2, iy + SketchUtils.jitter(1));
    }
    for (let ix = -w / 2 + 15; ix < w / 2; ix += 15) {
        sprite.moveTo(ix + SketchUtils.jitter(1), -h / 2 + 2);
        sprite.lineTo(ix + SketchUtils.jitter(1), h / 2 - 2);
    }
    sprite.stroke({ width: 2, color: 0x000000, alpha: 0.3 });
  }

  static drawTree(sprite: PIXI.Graphics, r: number) {
    // Tree canopy
    SketchUtils.drawComicCylinder(sprite, 0, 0, r, 0x44aa44, 0x226622, 0x88ff88);
    
    // Cross-hatching for texture
    sprite.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      let len = RandomUtils.random() * r * 0.8;
      sprite.moveTo(SketchUtils.jitter(2), SketchUtils.jitter(2));
      sprite.lineTo(Math.cos(a) * len + SketchUtils.jitter(2), Math.sin(a) * len + SketchUtils.jitter(2));
    }
    sprite.stroke({ width: 2, color: 0x114411, alpha: 0.5 });
  }

  static drawHouse(sprite: PIXI.Graphics, w: number, h: number) {
    SketchUtils.drawComicBlock(sprite, 0, 0, w, h, 0xffeebb, 0xccbbaa, 0xffffff);
    
    // Roof lines (X pattern)
    SketchUtils.drawSketchLine(sprite, -w / 2, -h / 2, w / 2, h / 2, 1.0, 0x000000, 3);
    SketchUtils.drawSketchLine(sprite, w / 2, -h / 2, -w / 2, h / 2, 1.0, 0x000000, 3);
    
    // Roof outline
    SketchUtils.drawSketchRect(sprite, 0, 0, w, h, 0, false); 
  }

  static drawBrokenHouse(sprite: PIXI.Graphics, w: number, h: number) {
    SketchUtils.drawComicBlock(sprite, 0, 0, w, h, 0xddccaa, 0xaabb99, 0xffddaa);
    
    // Draw some broken lines (as if the roof was blown off)
    sprite.beginPath();
    const rw = w / 2;
    const rh = h / 2;
    sprite.moveTo(-rw + 20, -rh + 20);
    sprite.lineTo(-rw + RandomUtils.random() * 20 + 10, -rh + RandomUtils.random() * 20 + 10);
    sprite.stroke({ width: 2, color: 0x000000 });

    // A large burn mark
    SketchUtils.drawSketchCircle(sprite, -rw / 4, 0, w / 4, 0x333333);
    
    // Debris
    for(let i=0; i<4; i++) {
        sprite.rect(-rw + RandomUtils.random() * w, -rh + RandomUtils.random() * h, 10, 10);
        sprite.fill({ color: 0x888888 });
        sprite.stroke({ width: 1, color: 0x000000 });
    }
  }

  static drawRavine(sprite: PIXI.Graphics, w: number, h: number) {
    const hw = w / 2;
    const hh = h / 2;
    sprite.beginPath();
    // Jagged edges
    sprite.moveTo(-hw, -hh);
    for(let x = -hw; x <= hw; x += 30) {
      sprite.lineTo(x + SketchUtils.jitter(10), -hh + RandomUtils.random() * 20);
    }
    for(let y = -hh; y <= hh; y += 30) {
      sprite.lineTo(hw - RandomUtils.random() * 20, y + SketchUtils.jitter(10));
    }
    for(let x = hw; x >= -hw; x -= 30) {
      sprite.lineTo(x + SketchUtils.jitter(10), hh - RandomUtils.random() * 20);
    }
    for(let y = hh; y >= -hh; y -= 30) {
      sprite.lineTo(-hw + RandomUtils.random() * 20, y + SketchUtils.jitter(10));
    }
    sprite.closePath();
    sprite.fill({ color: 0x221100 });
    sprite.stroke({ width: 4, color: 0x000000, join: "round" });

    // Inner contour lines
    sprite.beginPath();
    sprite.rect(-hw*0.7, -hh*0.7, hw*1.4, hh*1.4);
    sprite.stroke({ width: 2, color: 0x000000, alpha: 0.5 });
  }

  static drawDirtPatch(sprite: PIXI.Graphics, w: number, h: number) {
    const hw = w / 2;
    const hh = h / 2;
    sprite.beginPath();
    const segments = 12;
    for(let i=0; i<=segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = Math.min(hw, hh) * 0.8 + RandomUtils.random() * Math.min(hw, hh) * 0.4;
        const cx = Math.cos(theta) * r;
        const cy = Math.sin(theta) * r;
        if (i===0) sprite.moveTo(cx, cy);
        else sprite.lineTo(cx, cy);
    }
    sprite.closePath();
    sprite.fill({ color: 0xefeadd });
    sprite.stroke({ width: 2, color: 0xc1aba6, alpha: 0.6 });

    // Sketchy lines inside
    sprite.beginPath();
    for(let i=0; i<10; i++) {
        const x = (RandomUtils.random() - 0.5) * w * 0.8;
        const y = (RandomUtils.random() - 0.5) * h * 0.8;
        sprite.moveTo(x, y);
        sprite.lineTo(x + 10 + RandomUtils.random()*20, y - 5 + RandomUtils.random()*10);
    }
    sprite.stroke({ width: 1.5, color: 0xa08f8a, alpha: 0.5 });
  }

  static drawComicEffect(container: PIXI.Container, textTypeIdx: number) {
    const texts = [
      en.bang, en.pow, en.bam, en.crash, en.boom, // 0-4
      en.killingSpree, en.rampage, en.unstoppable, en.godlike, // 5-8
      en.goldRushLong, // 9
      en.whoosh, // 10
      en.waveStart, // 11
      en.tierUp, // 12
      en.evasion // 13
    ];
    
    const safeIdx = Math.min(Math.max(0, textTypeIdx), texts.length - 1);
    const isStreak = safeIdx >= 5 && safeIdx <= 8;
    const isGoldRush = safeIdx === 9;
    const isWhoosh = safeIdx === 10;
    const isWaveStart = safeIdx === 11;
    const isTierUp = safeIdx === 12;
    const isEvasion = safeIdx === 13;
    const isMajor = isStreak || isGoldRush || isWaveStart || isTierUp;

    const baseColors = [0xff0000, 0xff9900, 0xffff00, 0x00ffff, 0xff5500];
    const streakColors = [0xff2266, 0xff00ff, 0x6600ff, 0xffd700]; // distinctive colors for streaks
    
    let color = baseColors[safeIdx % baseColors.length];
    if (isGoldRush) color = 0xffd700;
    else if (isWhoosh) color = 0x88ccff; // light blue for whoosh
    else if (isEvasion) color = 0x00ff88; // green for evasion
    else if (isWaveStart) color = 0xff33aa; // hot pink for wave start
    else if (isTierUp) color = 0xff9900; // bright orange for tier up
    else if (isStreak) color = streakColors[safeIdx - 5];

    const star = PoolManager.graphicsPool.acquire();
    
    const rOuter = isMajor ? 80 : 40;
    const rInner = isMajor ? 40 : 20;

    star.moveTo(0, -rOuter);
    for (let i = 0; i < 10; i++) {
      let angle1 = (i / 10) * Math.PI * 2 - Math.PI / 2;
      let angle2 = ((i + 0.5) / 10) * Math.PI * 2 - Math.PI / 2;
      star.lineTo(Math.cos(angle1) * rOuter, Math.sin(angle1) * rOuter);
      star.lineTo(Math.cos(angle2) * rInner, Math.sin(angle2) * rInner);
    }
    star.lineTo(0, -rOuter);
    star.fill({ color: color });
    star.stroke({ width: isMajor ? 8 : 5, color: 0x000000, join: "miter" });

    const text = PoolManager.textPool.acquire();
    text.text = texts[safeIdx];
    text.style = new PIXI.TextStyle({
        fontFamily: "Impact, sans-serif",
        fontSize: isMajor ? 48 : 32,
        fill: 0xffffff,
        align: "center",
        stroke: { color: 0x000000, width: isMajor ? 8 : 6 },
        dropShadow: { alpha: 1, blur: 0, color: 0x000000, distance: 4 },
    });
    
    text.anchor.set(0.5);

    container.addChild(star);
    container.addChild(text);
    container.scale.set(0.1);
  }

  static drawParticleBubble(sprite: PIXI.Graphics) {
    const radius = 12;
    sprite.clear();
    
    // Fixed layout for puffs so it only "boils" via jitter instead of changing topology
    const numPuffs = 5;
    const puffs = [];
    
    // Center puff
    puffs.push({ x: 0, y: 0, r: radius });
    
    for (let i = 0; i < numPuffs; i++) {
        const angle = (i / numPuffs) * Math.PI * 2;
        const dist = radius * 0.6;
        const puffRadius = radius * (0.6 + (i % 3) * 0.2); 
        puffs.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: puffRadius });
    }
    
    for (let p of puffs) {
        sprite.circle(p.x, p.y, p.r);
    }
    sprite.fill({ color: 0xffffff });

    // Outline all
    sprite.beginPath();
    for (let c = 0; c < 2; c++) {
      for (let p of puffs) {
          sprite.circle(p.x + SketchUtils.jitter(0.8), p.y + SketchUtils.jitter(0.8), p.r);
      }
    }
  }

  static drawBossTitan(container: PIXI.Container) {
    const TANK_W = 90;
    const TANK_H = 75;
    const TRACK_W = 100;
    const TRACK_H = 20;
    const BASE_COLOR = 0x4a4f54; // Dark steel military grey
    const SHADOW_COLOR = 0x222629; // Deep shadows
    const HIGHLIGHT_COLOR = 0x86c232; // Nuclear radioactive green highlighting!
    const TRACK_COLOR = 0x202020; // Heavy iron tracks
    const TRACK_SHADOW = 0x0f0f0f;

    let chassis = container.getChildByName("chassis") as PIXI.Graphics;
    if (!chassis) {
      chassis = PoolManager.graphicsPool.acquire();
      chassis.name = "chassis";
      container.addChild(chassis);
    }
    chassis.clear();

    // 4 Tracks (Heavy dual tracks on each side!)
    // Left upper track
    SketchUtils.drawComicBlock(chassis, -10, -42, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x404040);
    // Left lower track (Dual track system)
    SketchUtils.drawComicBlock(chassis, 10, -42, TRACK_W - 10, TRACK_H - 2, TRACK_COLOR, TRACK_SHADOW, 0x404040);
    // Right upper track
    SketchUtils.drawComicBlock(chassis, -10, 42, TRACK_W, TRACK_H, TRACK_COLOR, TRACK_SHADOW, 0x404040);
    // Right lower track (Dual track system)
    SketchUtils.drawComicBlock(chassis, 10, 42, TRACK_W - 10, TRACK_H - 2, TRACK_COLOR, TRACK_SHADOW, 0x404040);

    // Giant armored Hull
    SketchUtils.drawComicBlock(chassis, 0, 0, TANK_W, TANK_H, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    // Front ram plow (Heavy spikes or armored wedges)
    chassis.beginPath();
    chassis.moveTo(TANK_W / 2, -TANK_H / 2 + 10);
    chassis.lineTo(TANK_W / 2 + 20, 0);
    chassis.lineTo(TANK_W / 2, TANK_H / 2 - 10);
    chassis.closePath();
    chassis.fill({ color: 0x3b3b3b });
    chassis.stroke({ width: 3.5, color: 0x000000 });

    // Exhaust pipes on the rear
    SketchUtils.drawComicBlock(chassis, -TANK_W / 2 - 10, -20, 15, 8, 0x1a1a1a, 0x0f0f0f, 0x333333);
    SketchUtils.drawComicBlock(chassis, -TANK_W / 2 - 10, 20, 15, 8, 0x1a1a1a, 0x0f0f0f, 0x333333);

    let turret = container.getChildByName("turret") as PIXI.Graphics;
    if (!turret) {
      turret = PoolManager.graphicsPool.acquire();
      turret.name = "turret";
      container.addChild(turret);
    }
    turret.clear();

    // Dual Massive Artillery Barrels (placed on the rotating turret)
    // Left Barrel
    SketchUtils.drawComicBlock(turret, 45, -12, 60, 12, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    SketchUtils.drawComicBlock(turret, 75, -12, 12, 16, 0x3a3a3a, 0x1a1a1a, 0x5a5a5a); // Heavy muzzle break
    
    // Right Barrel
    SketchUtils.drawComicBlock(turret, 45, 12, 60, 12, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);
    SketchUtils.drawComicBlock(turret, 75, 12, 12, 16, 0x3a3a3a, 0x1a1a1a, 0x5a5a5a); // Heavy muzzle break

    // Giant Turret Base
    SketchUtils.drawComicCylinder(turret, 0, 0, 32, BASE_COLOR, SHADOW_COLOR, HIGHLIGHT_COLOR);

    // Radioactive glowing core or radar dish in center of turret
    SketchUtils.drawComicCylinder(turret, -5, 0, 12, 0x86c232, 0x61892f, 0xffffff);
    
    // Glowing red power vents/eye
    SketchUtils.drawSketchCircle(turret, 14, -8, 5, 0xff0000);
    SketchUtils.drawSketchCircle(turret, 14, 8, 5, 0xff0000);
  }
}
