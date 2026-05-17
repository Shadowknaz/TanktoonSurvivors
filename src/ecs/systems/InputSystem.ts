import {  query, hasComponent, World } from "bitecs";
import { PlayerControlled, Position, Velocity, Weapon, Health, PlayerBuffs, PlayerStats } from "../components";
import { InputState } from "../../viewmodels/InputViewModel";
import { GameConfig } from "../../config/GameConfig";
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
      let buffName = "";
      let buffTimer = 0;
      let buffMax = 0;
      let buffColor = "";

      if (PlayerBuffs.speedTimer[eid] > 0) {
        PlayerBuffs.speedTimer[eid]--;
        buffName = "SPEED+";
        buffTimer = PlayerBuffs.speedTimer[eid];
        buffMax = EventConfig.LOOT_SPEED_DURATION;
        buffColor = "text-yellow-400 bg-yellow-500";
        if (RandomUtils.random() < 0.2) {
          EffectFactory.spawnComicEffect(world, px, py, 2);
        }
      } else if (PlayerBuffs.invulnTimer[eid] > 0) {
        PlayerBuffs.invulnTimer[eid]--;
        if (PlayerBuffs.invulnTimer[eid] > 60 || currentActiveBuff?.name === "INVULNERABLE") {
            buffName = "INVULNERABLE";
            buffTimer = PlayerBuffs.invulnTimer[eid];
            buffMax = EventConfig.LOOT_INVULN_DURATION;
            buffColor = "text-blue-400 bg-blue-500";
            if (RandomUtils.random() < 0.1) {
              EffectFactory.spawnParticleBubble(world, px + (RandomUtils.random() - 0.5) * 40, py + (RandomUtils.random() - 0.5) * 40);
            }
        }
      } else if (PlayerBuffs.adrenalineTimer[eid] > 0) {
        PlayerBuffs.adrenalineTimer[eid] -= dt;
        if (PlayerBuffs.adrenalineTimer[eid] < 0) PlayerBuffs.adrenalineTimer[eid] = 0;
        
        if (PlayerBuffs.adrenalineTimer[eid] > 0) {
            buffName = "ADRENALINE";
            buffTimer = Math.ceil(PlayerBuffs.adrenalineTimer[eid] * 60);
            buffMax = GameConfig.SYNERGY_ADRENALINE_MAX_TIMER_FRAMES;
            buffColor = "text-red-500 bg-red-600";
        }
      }

      const isBuffActive = buffName !== "";
      const shouldClearBuff = currentActiveBuff && !isBuffActive;
      const isNewBuff = !currentActiveBuff && isBuffActive;
      const isDifferentBuff = isBuffActive && currentActiveBuff && buffName !== currentActiveBuff.name;
      const isTimerUpdate = isBuffActive && buffTimer % 15 === 0;

      if (shouldClearBuff) {
           context.setActiveBuff(null);
      } else if (isNewBuff || isDifferentBuff || isTimerUpdate) {
           context.setActiveBuff({ name: buffName, timer: buffTimer, maxTimer: buffMax, color: buffColor });
      }

      const rw = GameConfig.VIRTUAL_WIDTH;
      const rh = GameConfig.VIRTUAL_HEIGHT;

      const worldMouseX = px + (inputState.mousePosition.x - rw / 2);
      const worldMouseY = py + (inputState.mousePosition.y - rh / 2);

      let moveY = (inputState.moveUp ? -1 : 0) + (inputState.moveDown ? 1 : 0);
      let moveX = (inputState.moveLeft ? -1 : 0) + (inputState.moveRight ? 1 : 0);

      let baseSpeed = PlayerStats.speed[eid];
      
      // Apply speed buff
      if (PlayerBuffs.speedTimer[eid] > 0) {
        baseSpeed += EventConfig.LOOT_SPEED_BONUS;
      }
      
      if (PlayerBuffs.adrenalineTimer[eid] > 0) {
        baseSpeed *= GameConfig.SYNERGY_ADRENALINE_SPEED_MULT;
      }
      
      // Send health state back to store for UI
      if (hasComponent(world, eid, Health)) {
        if (Health.current[eid] !== context.playerHealth || Health.max[eid] !== context.playerMaxHealth) {
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
