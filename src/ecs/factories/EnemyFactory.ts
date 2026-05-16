import { addEntity, addComponent, World } from "bitecs";
import {
  Position,
  Velocity,
  Health,
  Renderable,
  MatterBody,
  AIBehavior,
  Weapon,
  Rammer,
  Kamikaze,
  Explosive,
  ContactDamage,
  TankTracks,
  Burrowed,
  FlamerTank
} from "../components";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { CollisionCategory } from "../../config/PhysicsConfig";
import { EnemyTemplate, EnemyType } from "../../config/EnemyConfig";
import { SpriteId } from "../../models/types";

export class EnemyFactory {
  static createEnemy(
    world: World,
    physicsEngine: PhysicsEngine,
    x: number,
    y: number,
    template: EnemyTemplate
  ): number {
    const eid = addEntity(world);

    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;
    Position.angle[eid] = 0;

    addComponent(world, eid, Velocity);
    Velocity.x[eid] = 0;
    Velocity.y[eid] = 0;

    addComponent(world, eid, Health);
    Health.max[eid] = template.health;
    Health.current[eid] = template.health;

    addComponent(world, eid, AIBehavior);
    AIBehavior.state[eid] = 1; // 1 = SEEK/PATROL based on FSM now
    AIBehavior.targetEntity[eid] = 0;
    AIBehavior.speedMult[eid] = template.speedModifier || 1.0;

    addComponent(world, eid, TankTracks);
    TankTracks.lastX[eid] = x;
    TankTracks.lastY[eid] = y;

    if (template.weapon) {
      addComponent(world, eid, Weapon);
      Weapon.lastFired[eid] = 0;
      Weapon.cooldown[eid] = template.weapon.cooldown;
      Weapon.isShooting[eid] = 0;
      Weapon.muzzleOffset[eid] = template.weapon.muzzleOffset;
      Weapon.damage[eid] = template.weapon.damage;
      Weapon.maxWindUpTimer[eid] = template.weapon.windUpTime || 0.4;
      Weapon.isArced[eid] = template.weapon.isArced ? 1 : 0;
    }

    if (template.rammer) {
      addComponent(world, eid, Rammer);
      Rammer.active[eid] = 1;
      addComponent(world, eid, ContactDamage);
      ContactDamage.value[eid] = template.rammer.damage;
    }

    if (template.kamikaze) {
      addComponent(world, eid, Kamikaze);
      Kamikaze.active[eid] = 1;
      addComponent(world, eid, ContactDamage);
      ContactDamage.value[eid] = template.kamikaze.damage;
      
      addComponent(world, eid, Explosive);
      Explosive.radius[eid] = template.kamikaze.radius;
    }

    if (template.isSapper) {
      addComponent(world, eid, Burrowed);
      Burrowed.z[eid] = 0;
      Burrowed.emergeTimer[eid] = 0;
    }
    
    if (template.isFlamer) {
      addComponent(world, eid, FlamerTank);
      FlamerTank.isSpraying[eid] = 0;
      FlamerTank.fuelLeft[eid] = 100;
      FlamerTank.lastSpray[eid] = 0;
    }

    const body = physicsEngine.createRectangleBody(x, y, template.width, template.height, {}, eid);
    physicsEngine.setCollisionFilter(
      body,
      CollisionCategory.ENEMY,
      CollisionCategory.WALL | CollisionCategory.PLAYER | CollisionCategory.ENEMY | CollisionCategory.PLAYER_PROJECTILE,
    );

    addComponent(world, eid, MatterBody);
    MatterBody.bodyId[eid] = body.id;

    addComponent(world, eid, Renderable);
    Renderable.spriteId[eid] = template.spriteId;
    Renderable.visible[eid] = 1;

    return eid;
  }
}
