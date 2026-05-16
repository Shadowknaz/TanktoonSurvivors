import {  addEntity, addComponent , World } from "bitecs";
import { Position, Renderable, Lifetime, ComicEffect, Particle, Wreck, Velocity, FireZone, Explosive, ContactDamage } from "../components";
import { SpriteId, ComicTextType } from "../../models/types";
import { GameConfig } from "../../config/GameConfig";
import { MathUtils } from "../../utils/MathUtils";
import { RandomUtils } from "../../utils/RandomUtils";

export class EffectFactory {
  static spawnWreck(world: World, x: number, y: number, angle: number, originalSpriteId: SpriteId, lifetimeSec: number = 3.0): number {
    const eid = addEntity(world);

    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;
    Position.angle[eid] = angle;

    addComponent(world, eid, Renderable);
    Renderable.spriteId[eid] = originalSpriteId; // Use original sprite, but render system will draw it darkened
    Renderable.visible[eid] = 1;

    addComponent(world, eid, Lifetime);
    Lifetime.timer[eid] = lifetimeSec;

    addComponent(world, eid, Wreck);
    Wreck.originalSpriteId[eid] = originalSpriteId;
    Wreck.timer[eid] = lifetimeSec;
    Wreck.maxTimer[eid] = lifetimeSec;

    return eid;
  }

  static spawnParticle(
    world: World,
    x: number,
    y: number,
    angle: number,
    spriteId: SpriteId,
    lifetimeSec: number,
    startScale: number,
    endScale: number,
    startAlpha: number,
    endAlpha: number
  ): number {
    // Note: bitECS addEntity automatically uses an internal array pool of recycled integer IDs.
    // The PIXI Container representations are pooled securely via PoolManager in RenderSystem.
    const eid = addEntity(world);

    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;
    Position.angle[eid] = angle;

    addComponent(world, eid, Renderable);
    Renderable.spriteId[eid] = spriteId;
    Renderable.visible[eid] = 1;

    addComponent(world, eid, Lifetime);
    Lifetime.timer[eid] = lifetimeSec;

    addComponent(world, eid, Particle);
    Particle.initialLife[eid] = lifetimeSec;
    Particle.startScale[eid] = startScale;
    Particle.endScale[eid] = endScale;
    Particle.startAlpha[eid] = startAlpha;
    Particle.endAlpha[eid] = endAlpha;

    return eid;
  }

  static spawnComicEffect(
    world: World,
    x: number,
    y: number,
    textType?: ComicTextType
  ): number {
    const eid = this.spawnParticle(world, x, y, RandomUtils.random() * 0.5 - 0.25, SpriteId.COMIC_EFFECT, 0.5, 0.4, 0.8, 1.0, 1.0);
    addComponent(world, eid, ComicEffect);
    ComicEffect.textType[eid] = textType ?? Math.floor(RandomUtils.random() * 4);
    return eid;
  }

  static spawnTrackMark(world: World, x: number, y: number, angle: number): number {
    return this.spawnParticle(
      world,
      x,
      y,
      angle,
      SpriteId.TRACK_MARK,
      5.0, // track mark lives for 5 seconds
      1.0,
      1.0,
      GameConfig.TRACK_MARK_START_ALPHA,
      GameConfig.TRACK_MARK_END_ALPHA
    );
  }

  static spawnMuzzleFlash(world: World, x: number, y: number, angle: number): number {
    return this.spawnParticle(
      world, 
      x, 
      y, 
      angle, 
      SpriteId.MUZZLE_FLASH, 
      GameConfig.MUZZLE_FLASH_LIFETIME, 
      GameConfig.MUZZLE_FLASH_START_SCALE, 
      GameConfig.MUZZLE_FLASH_END_SCALE, 
      GameConfig.MUZZLE_FLASH_START_ALPHA, 
      GameConfig.MUZZLE_FLASH_END_ALPHA
    );
  }

  static spawnSmokeCloud(world: World, x: number, y: number): void {
    const numClouds = 3 + Math.floor(RandomUtils.random() * 3);
    for (let i = 0; i < numClouds; i++) {
        const offsetX = (RandomUtils.random() - 0.5) * 30;
        const offsetY = (RandomUtils.random() - 0.5) * 30;
        
        // Stagger lifetime strongly so they fade one by one
        const lifetime = (GameConfig.SMOKE_CLOUD_BASE_LIFETIME * 0.4) + (i * 1.5) + RandomUtils.random();
        
        const eid = this.spawnParticle(
          world, 
          x + offsetX, 
          y + offsetY, 
          RandomUtils.random() * Math.PI * 2, 
          SpriteId.SMOKE_CLOUD, 
          lifetime, 
          GameConfig.SMOKE_CLOUD_START_SCALE * (0.8 + RandomUtils.random() * 0.4), 
          GameConfig.SMOKE_CLOUD_END_SCALE * (0.8 + RandomUtils.random() * 0.4), 
          GameConfig.SMOKE_CLOUD_START_ALPHA, 
          0.0
        );

        // Add slow drift velocity
        addComponent(world, eid, Velocity);
        Velocity.x[eid] = (RandomUtils.random() - 0.5) * 10;
        Velocity.y[eid] = (RandomUtils.random() - 0.5) * 10;
    }
  }

  static spawnParticleBubble(world: World, x: number, y: number): number {
    const startScale = MathUtils.lerp(
      GameConfig.PARTICLE_CLOUD_START_SCALE_MIN,
      GameConfig.PARTICLE_CLOUD_START_SCALE_MAX,
      RandomUtils.random()
    );
    const lifetime = GameConfig.PARTICLE_CLOUD_BASE_LIFETIME * (0.8 + RandomUtils.random() * 0.4);
    return this.spawnParticle(
      world, 
      x, 
      y, 
      RandomUtils.random() * Math.PI * 2, 
      SpriteId.PARTICLE_BUBBLE, 
      lifetime, 
      startScale, 
      GameConfig.PARTICLE_CLOUD_END_SCALE, 
      startScale > 0.8 ? 0.7 : 0.5, 
      0.0
    );
  }

  static spawnFireZone(world: World, x: number, y: number): number {
    const eid = addEntity(world);
    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;
    
    addComponent(world, eid, Renderable);
    Renderable.spriteId[eid] = SpriteId.SMOKE_CLOUD;
    Renderable.visible[eid] = 1;
    
    addComponent(world, eid, FireZone);
    FireZone.tickRate[eid] = 0.5;
    FireZone.tickDamage[eid] = 10;
    FireZone.lastTick[eid] = 0;
    
    addComponent(world, eid, Lifetime);
    Lifetime.timer[eid] = 4.0;
    
    return eid;
  }

  static spawnExplosion(world: World, x: number, y: number, radius: number): number {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      Position.x[eid] = x;
      Position.y[eid] = y;
      
      addComponent(world, eid, Explosive);
      Explosive.radius[eid] = radius;
      
      addComponent(world, eid, ContactDamage);
      ContactDamage.value[eid] = 50; 
      
      addComponent(world, eid, Lifetime);
      Lifetime.timer[eid] = 0.1;
      
      return eid;
  }
}
