import Matter from "matter-js";
import { PhysicsConfig } from "../config/PhysicsConfig";

declare module "matter-js" {
  interface Body {
    eid?: number;
    /** Tracks the cumulative scale applied via Matter.Body.scale() so the pool can invert it on reset. */
    currentScale?: number;
  }
}

export class PhysicsEngine {
  public engine: Matter.Engine;
  public world: Matter.World;
  private bodiesMap: Map<number, Matter.Body> = new Map();
  private collisionEvents: Matter.IEventCollision<Matter.Engine>[] = [];
  private isDestroyed = false;

  constructor() {
    this.engine = Matter.Engine.create({
      gravity: {
        x: PhysicsConfig.GRAVITY.x,
        y: PhysicsConfig.GRAVITY.y,
        scale: 0.001,
      },
    });
    this.world = this.engine.world;

    Matter.Events.on(this.engine, "collisionStart", (e) => {
      this.collisionEvents.push(e);
    });
  }

  getCollisionEvents() {
    const events = this.collisionEvents;
    this.collisionEvents = [];
    return events;
  }

  createRectangleBody(x: number, y: number, width: number, height: number, options: Matter.IBodyDefinition, eid: number): Matter.Body {
    if (this.isDestroyed) throw new Error('PhysicsEngine is destroyed');
    const { chamfer, ...restOptions } = options || {};
    const body = Matter.Bodies.rectangle(x, y, width, height, {
      density: PhysicsConfig.DENSITY,
      friction: PhysicsConfig.FRICTION,
      frictionAir: 0.1, // Added for top-down games to stop gliding forever
      restitution: PhysicsConfig.RESTITUTION,
      ...(chamfer != null ? { chamfer } : {}),
      ...restOptions,
    });
    this.bodiesMap.set(body.id, body);
    body.eid = eid;
    Matter.World.add(this.world, body);
    return body;
  }

  createCircleBody(x: number, y: number, radius: number, options: Matter.IBodyDefinition, eid: number): Matter.Body {
    if (this.isDestroyed) throw new Error('PhysicsEngine is destroyed');
    const { chamfer, ...restOptions } = options || {};
    const body = Matter.Bodies.circle(x, y, radius, {
      density: PhysicsConfig.DENSITY,
      friction: PhysicsConfig.FRICTION,
      frictionAir: 0.1, // Added for top-down games
      restitution: PhysicsConfig.RESTITUTION,
      ...(chamfer != null ? { chamfer } : {}),
      ...restOptions,
    });
    this.bodiesMap.set(body.id, body);
    body.eid = eid;
    Matter.World.add(this.world, body);
    return body;
  }

  getBodyById(id: number): Matter.Body | undefined {
    return this.bodiesMap.get(id);
  }

  setCollisionFilter(body: Matter.Body, category: number, mask: number): void {
    body.collisionFilter = {
      category,
      mask,
      group: body.collisionFilter.group,
    };
  }

  removeBody(body: Matter.Body): void {
    if (this.isDestroyed) return;
    Matter.World.remove(this.world, body);
    this.bodiesMap.delete(body.id);
  }

  addExistingBody(body: Matter.Body): void {
    Matter.World.add(this.world, body);
    this.bodiesMap.set(body.id, body);
  }

  step(dt: number): void {
    Matter.Engine.update(this.engine, dt * 1000);
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
    this.bodiesMap.clear();
  }

  isPositionFree(x: number, y: number, checkRadius: number = 20): boolean {
    const bodies = Matter.Composite.allBodies(this.world);
    const bounds = {
      min: { x: x - checkRadius, y: y - checkRadius },
      max: { x: x + checkRadius, y: y + checkRadius }
    };
    
    const possibleOverlaps = Matter.Query.region(bodies, bounds);
    return possibleOverlaps.length === 0;
  }
}
