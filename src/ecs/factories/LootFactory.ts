import { World, addEntity, addComponent } from "bitecs";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { CollisionCategory } from "../../config/PhysicsConfig";
import { EventConfig } from "../../config/EventConfig";
import { Position, LootDrop, Renderable, ContactDamage, MatterBody } from "../components";
import { SpriteId } from "../../models/types";
import { EventBus } from "../../core/EventBus";
import { LootDropEvent } from "../../models/events";

export class LootFactory {
  static createLootDrop(
    world: World,
    physicsEngine: PhysicsEngine,
    eventBus: EventBus,
    x: number,
    y: number,
    type: number
  ): number {
    eventBus.publish(new LootDropEvent(x, y));
    const eid = addEntity(world);
    
    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;

    addComponent(world, eid, LootDrop);
    LootDrop.type[eid] = type;
    
    addComponent(world, eid, Renderable);
    Renderable.spriteId[eid] = SpriteId.LOOT_CRATE;
    Renderable.visible[eid] = 1;

    addComponent(world, eid, ContactDamage);
    ContactDamage.value[eid] = 0;

    const body = physicsEngine.createCircleBody(x, y, EventConfig.LOOT_RADIUS, { 
        isSensor: true,
        label: "LootCrate" 
    }, eid);
    physicsEngine.setCollisionFilter(body, CollisionCategory.SENSOR, CollisionCategory.PLAYER);
    addComponent(world, eid, MatterBody);
    MatterBody.bodyId[eid] = body.id;

    return eid;
  }
}
