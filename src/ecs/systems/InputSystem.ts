import {  query, hasComponent, addComponent , World } from "bitecs";
import { PlayerControlled, Position, Velocity, Weapon, Health, PlayerBuffs } from "../components";
import { InputState } from "../../viewmodels/InputViewModel";
import { GameConfig } from "../../config/GameConfig";
import { RenderConfig } from "../../config/RenderConfig";
import { MathUtils } from "../../utils/MathUtils";
import { EffectFactory } from "../factories/EffectFactory";
import { EventConfig } from "../../config/EventConfig";
import { GameContext } from "../../models/GameContext";
import { RandomUtils } from "../../utils/RandomUtils";

export class InputSystem {
  update(world: World, inputState: InputState, dt: number, context: GameContext) {
    const players = query(world, [PlayerControlled, Position, Velocity]);

    for (let i = 0; i < players.length; i++) {
      const eid = players[i];
      const px = Position.x[eid];
      const py = Position.y[eid];

      // Tick down buffs and sync to store
      const currentActiveBuff = context.activeBuff;
      let newBuff = null;

      if (PlayerBuffs.speedTimer[eid] > 0) {
        PlayerBuffs.speedTimer[eid]--;
        newBuff = { name: "SPEED+", timer: PlayerBuffs.speedTimer[eid], maxTimer: EventConfig.LOOT_SPEED_DURATION, color: "text-yellow-400 bg-yellow-500" };
        if (RandomUtils.random() < 0.2) {
          EffectFactory.spawnComicEffect(world, px, py, 2); // BAM effect occasionally for speed
        }
      } else if (PlayerBuffs.invulnTimer[eid] > 0) {
        PlayerBuffs.invulnTimer[eid]--;
        // Only show UI buff for long loot drops, not damage i-frames (which are usually < 60 frames)
        if (PlayerBuffs.invulnTimer[eid] > 60 || context.activeBuff?.name === "INVULNERABLE") {
            newBuff = { name: "INVULNERABLE", timer: PlayerBuffs.invulnTimer[eid], maxTimer: EventConfig.LOOT_INVULN_DURATION, color: "text-blue-400 bg-blue-500" };
            if (RandomUtils.random() < 0.1) {
              EffectFactory.spawnParticleBubble(world, px + (RandomUtils.random() - 0.5) * 40, py + (RandomUtils.random() - 0.5) * 40); // Bubbles for invuln
            }
        }
      }

      if ((currentActiveBuff && !newBuff) || (!currentActiveBuff && newBuff) || (newBuff && currentActiveBuff && newBuff.name !== currentActiveBuff.name) || (newBuff && newBuff.timer % 15 === 0)) {
           context.setActiveBuff(newBuff);
      }

      const rw = GameConfig.VIRTUAL_WIDTH;
      const rh = GameConfig.VIRTUAL_HEIGHT;

      const worldMouseX = px + (inputState.mousePosition.x - rw / 2);
      const worldMouseY = py + (inputState.mousePosition.y - rh / 2);

      let moveY = (inputState.moveUp ? -1 : 0) + (inputState.moveDown ? 1 : 0);
      let moveX = (inputState.moveLeft ? -1 : 0) + (inputState.moveRight ? 1 : 0);

      let baseSpeed = context.playerStats.speed;
      
      // Apply speed buff
      if (PlayerBuffs.speedTimer[eid] > 0) {
        baseSpeed += EventConfig.LOOT_SPEED_BONUS;
      }
      
      // Update max health from store, and update store with current health if we healed
      if (hasComponent(world, eid, Health)) {
        if (Health.max[eid] !== context.playerMaxHealth) {
            Health.max[eid] = context.playerMaxHealth;
        }
        if (Health.current[eid] < context.playerHealth) {
            // If the store healed the player (e.g. level up)
            Health.current[eid] = context.playerHealth;
        }
        // Send state back to store for UI (e.g. when taking damage)
        if (Health.current[eid] > 0 && Health.current[eid] < context.playerHealth) {
            context.setPlayerHealth(Health.current[eid], Health.max[eid]);
        }
      }
      
      const isMoving = moveX !== 0 || moveY !== 0;

      if (isMoving) {
        PlayerControlled.moveDuration[eid] = (PlayerControlled.moveDuration[eid] || 0) + dt;
      } else {
        PlayerControlled.moveDuration[eid] = 0;
      }

      // Max speed multiplier after acceleration time
      const accTime = GameConfig.PLAYER_ACCELERATION_TIME_SEC;
      const maxMult = GameConfig.PLAYER_MAX_SPEED_MULTIPLIER;
      const speedMultiplier = 1.0 + Math.min(1.0, PlayerControlled.moveDuration[eid] / accTime) * (maxMult - 1.0);
      const currentSpeed = baseSpeed * speedMultiplier;

      // Normalize diagonal movement
      if (isMoving) {
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= length;
        moveY /= length;
      }

      // Handle Boost
      if (PlayerControlled.boostCooldown[eid] > 0) {
        PlayerControlled.boostCooldown[eid] -= dt;
      }
      
      if (inputState.isDashing && PlayerControlled.boostCooldown[eid] <= 0 && isMoving) {
        PlayerControlled.boostCooldown[eid] = GameConfig.PLAYER_BOOST_COOLDOWN_SEC;
        
        // Apply impulse by bumping internal Velocity vector
        Velocity.x[eid] += moveX * GameConfig.PLAYER_BOOST_FORCE;
        Velocity.y[eid] += moveY * GameConfig.PLAYER_BOOST_FORCE;
        
        // Narcotic effect: timeScale explodes, camera shake, visual effects
        context.setTimeScale(1.8, 1.5);
        context.addCameraShake(15);
        
        // Spawn smoke
        for (let j = 0; j < 15; j++) {
            EffectFactory.spawnParticleBubble(world, px + (RandomUtils.random() - 0.5) * 50, py + (RandomUtils.random() - 0.5) * 50);
        }
      }

      const targetVx = moveX * currentSpeed;
      const targetVy = moveY * currentSpeed;

      const accelerationFactor = isMoving ? GameConfig.PLAYER_ACCEL_FACTOR : GameConfig.PLAYER_DECEL_FACTOR;
      Velocity.x[eid] = MathUtils.lerp(Velocity.x[eid] || 0, targetVx, Math.min(1, accelerationFactor * dt));
      Velocity.y[eid] = MathUtils.lerp(Velocity.y[eid] || 0, targetVy, Math.min(1, accelerationFactor * dt));

      const currentMag = Math.hypot(Velocity.x[eid], Velocity.y[eid]);
      const roundedSpeed = Math.round(currentMag * 10);
      const lastSpeed = context.currentSpeed;
      if (Math.abs(lastSpeed - roundedSpeed) > 0.5) {
         context.setCurrentSpeed(roundedSpeed);
      }

      // Firing weapon aim directly towards cursor (no lerp)
      const targetAimAngle = Math.atan2(worldMouseY - py, worldMouseX - px);
      Weapon.aimAngle[eid] = targetAimAngle;

      // Chassis rotation follows movement smoothly
      if (currentMag > 0.1) {
        const targetChassisAngle = Math.atan2(Velocity.y[eid], Velocity.x[eid]);
        Position.angle[eid] = Position.angle[eid] ?? targetChassisAngle;
        Position.angle[eid] = MathUtils.lerpAngle(
          Position.angle[eid], 
          targetChassisAngle, 
          Math.min(1, GameConfig.PLAYER_CHASSIS_ROTATION_SPEED * dt)
        );

        if (RandomUtils.random() < GameConfig.PARTICLE_SPAWN_CHANCE_MOVING) {
          const offsetX = (RandomUtils.random() - 0.5) * GameConfig.PARTICLE_OFFSET_RADIUS;
          const offsetY = (RandomUtils.random() - 0.5) * GameConfig.PARTICLE_OFFSET_RADIUS;
          EffectFactory.spawnParticleBubble(world, px + offsetX, py + offsetY);
        }
      }

      // Firing weapon coordinates
      Weapon.targetX[eid] = worldMouseX;
      Weapon.targetY[eid] = worldMouseY;

      if (inputState.isShooting) {
        Weapon.isShooting[eid] = 1;
      } else {
        Weapon.isShooting[eid] = 0;
      }
    }
  }
}
