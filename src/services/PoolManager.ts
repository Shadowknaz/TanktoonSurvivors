import { ObjectPool } from "./ObjectPool";
import * as PIXI from "pixi.js";
import Matter from "matter-js";
import { IPoolable } from "../models/interfaces/IPoolable";
import { PhysicsEngine } from "./PhysicsEngine";

/** A poolable PIXI Container that carries a sprite-type tag for cache invalidation. */
export type PooledContainer = PIXI.Container & IPoolable & { lastSpriteId: number | undefined };

export type PooledGraphics = PIXI.Graphics & IPoolable;

export type PooledText = PIXI.Text & IPoolable;

/** A poolable Matter.Body that owns an ECS entity id and a cumulative scale tracker. */
export type PooledBody = Matter.Body & IPoolable;

export class PoolManager {
    public static containerPool: ObjectPool<PooledContainer> = new ObjectPool<PooledContainer>(() => {
        const c = new PIXI.Container() as PooledContainer;
        c.lastSpriteId = undefined;
        c.reset = function() {
            // Return any Graphics children to the graphic pool before removing
            this.children.forEach(child => {
                if (child instanceof PIXI.Graphics) {
                    PoolManager.graphicsPool.release(child as PooledGraphics);
                } else if (child instanceof PIXI.Text) {
                    PoolManager.textPool.release(child as PooledText);
                } else {
                    child.destroy({ children: true });
                }
            });
            this.removeChildren();
            this.scale.set(1);
            this.alpha = 1;
            this.rotation = 0;
            this.visible = true;
            this.zIndex = 0;
            this.tint = 0xffffff;
            this.blendMode = 'normal';
            this.lastSpriteId = undefined;
        };
        // destroy is natively supported by PIXI.Container
        return c;
    }, 100);

    public static graphicsPool: ObjectPool<PooledGraphics> = new ObjectPool<PooledGraphics>(() => {
        const g = new PIXI.Graphics() as PooledGraphics;
        g.reset = function() {
            this.clear();
            this.alpha = 1;
            this.rotation = 0;
            this.scale.set(1);
            this.blendMode = 'normal';
            this.name = "";
        };
        return g;
    }, 100);

    public static textPool: ObjectPool<PooledText> = new ObjectPool<PooledText>(() => {
        const t = new PIXI.Text() as PooledText;
        t.reset = function() {
            this.text = "";
            this.alpha = 1;
            this.scale.set(1);
            this.rotation = 0;
            this.name = "";
        };
        return t;
    }, 10);

    // Matter bodies pool specifically for simple projectiles (radius 4)
    public static projectileBodyPool: ObjectPool<PooledBody>;

    public static initPhysicsPools(physicsEngine: PhysicsEngine) {
        if (this.projectileBodyPool) return; // already init
        this.projectileBodyPool = new ObjectPool<PooledBody>(() => {
            const body = Matter.Bodies.circle(0, 0, 4, {
                isSensor: true,
                frictionAir: 0,
                friction: 0,
                restitution: 0.5,
            }) as PooledBody;
            (body as any).isPooled = true;

            body.reset = function() {
                if (this.currentScale !== undefined && this.currentScale !== 1.0) {
                    const inv = 1.0 / this.currentScale;
                    Matter.Body.scale(this, inv, inv);
                }
                this.currentScale = 1.0;
                Matter.Body.setAngle(this, 0);
                Matter.Body.setVelocity(this, { x: 0, y: 0 });
                Matter.Body.setAngularVelocity(this, 0);
                this.eid = undefined;
            };

            body.destroy = function() {
                physicsEngine.removeBody(this);
            };

            return body;
        }, 50);
    }

    /**
     * Called before a world reset. Clears all pooled bodies and nulls the pool reference
     * so `initPhysicsPools` can re-create it with a fresh physicsEngine closure.
     */
    public static resetAllPools(physicsEngine: PhysicsEngine): void {
        if (this.projectileBodyPool) {
            this.projectileBodyPool.clear();
            // @ts-expect-error — intentionally nulled so initPhysicsPools re-creates it
            this.projectileBodyPool = null;
        }
        // Clear all remaining bodies from the physics world (env props, enemies, player)
        physicsEngine.destroy();
    }
}
