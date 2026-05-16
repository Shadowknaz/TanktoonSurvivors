import { World, addEntity, addComponent } from "bitecs";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import {
  Position,
  Wall,
  Tree,
  House,
  Renderable,
  MatterBody,
  MapDecal,
  BrokenHouse,
  Ravine
} from "../components";
import { SpriteId } from "../../models/types";

export class EnvironmentFactory {
  static createProp(world: World, physicsEngine: PhysicsEngine, p: any) {
    const eid = addEntity(world);

    addComponent(world, eid, Position);
    Position.x[eid] = p.x;
    Position.y[eid] = p.y;
    Position.angle[eid] = p.rotation || 0;

    if (p.type === "wall") {
      addComponent(world, eid, Wall);
      Wall.width[eid] = p.width;
      Wall.height[eid] = p.height;
      const body = physicsEngine.createRectangleBody(p.x, p.y, p.width, p.height, { isStatic: true }, eid);
      addComponent(world, eid, MatterBody);
      MatterBody.bodyId[eid] = body.id;
      addComponent(world, eid, Renderable);
      Renderable.spriteId[eid] = SpriteId.WALL;
      Renderable.visible[eid] = 1;
    } else if (p.type === "house") {
      addComponent(world, eid, House);
      House.width[eid] = p.width;
      House.height[eid] = p.height;
      const body = physicsEngine.createRectangleBody(p.x, p.y, p.width, p.height, { isStatic: true }, eid);
      addComponent(world, eid, MatterBody);
      MatterBody.bodyId[eid] = body.id;
      addComponent(world, eid, Renderable);
      Renderable.spriteId[eid] = SpriteId.HOUSE;
      Renderable.visible[eid] = 1;
    } else if (p.type === "broken_house") {
      addComponent(world, eid, BrokenHouse);
      BrokenHouse.width[eid] = p.width;
      BrokenHouse.height[eid] = p.height;
      const body = physicsEngine.createRectangleBody(p.x, p.y, p.width, p.height, { isStatic: true }, eid);
      addComponent(world, eid, MatterBody);
      MatterBody.bodyId[eid] = body.id;
      addComponent(world, eid, Renderable);
      Renderable.spriteId[eid] = SpriteId.BROKEN_HOUSE;
      Renderable.visible[eid] = 1;
    } else if (p.type === "tree") {
      addComponent(world, eid, Tree);
      Tree.radius[eid] = p.width / 2;
      const body = physicsEngine.createCircleBody(p.x, p.y, p.width / 2, { isStatic: true }, eid);
      addComponent(world, eid, MatterBody);
      MatterBody.bodyId[eid] = body.id;
      addComponent(world, eid, Renderable);
      Renderable.spriteId[eid] = SpriteId.TREE;
      Renderable.visible[eid] = 1;
    } else if (p.type === "ravine") {
      addComponent(world, eid, Ravine);
      Ravine.width[eid] = p.width;
      Ravine.height[eid] = p.height;
      const body = physicsEngine.createRectangleBody(p.x, p.y, p.width, p.height, { isStatic: true }, eid);
      addComponent(world, eid, MatterBody);
      MatterBody.bodyId[eid] = body.id;
      addComponent(world, eid, Renderable);
      Renderable.spriteId[eid] = SpriteId.RAVINE;
      Renderable.visible[eid] = 1;
    } else if (p.type === "dirt_patch") {
      addComponent(world, eid, MapDecal);
      MapDecal.width[eid] = p.width;
      MapDecal.height[eid] = p.height;
      addComponent(world, eid, Renderable);
      Renderable.spriteId[eid] = SpriteId.DIRT_PATCH;
      Renderable.visible[eid] = 1;
    }
  }
}
