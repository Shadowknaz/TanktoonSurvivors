import { ObjectPool } from "./ObjectPool";
import * as PIXI from "pixi.js";
import Matter from "matter-js";
import { IPoolable } from "../models/interfaces/IPoolable";
import { PhysicsEngine } from "./PhysicsEngine";

export type PooledContainer = PIXI.Container & IPoolable;

export type PooledGraphics = PIXI.Graphics & IPoolable;

export class PoolManager {
    public static containerPool: ObjectPool<PooledContainer> = new ObjectPool<PooledContainer>(() => {
        const c = new PIXI.Container() as PooledContainer;
        c.reset = function() {
            // Return any Graphics children to the graphic pool before removing
            this.children.forEach(child => {
                if (child instanceof PIXI.Graphics) {
                    PoolManager.graphicsPool.release(child as PooledGraphics);
                } else if (child instanceof PIXI.Text) {
                    PoolManager.textPool.release(child as any);
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
            (this as any).lastSpriteId = undefined;
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
            this.name = null;
        };
        return g;
    }, 100);

    public static textPool: ObjectPool<PIXI.Text & IPoolable> = new ObjectPool<PIXI.Text & IPoolable>(() => {
        const t = new PIXI.Text() as PIXI.Text & IPoolable;
        t.reset = function() {
            this.text = "";
            this.alpha = 1;
            this.scale.set(1);
            this.rotation = 0;
        };
        return t;
    }, 10);

    // Matter bodies pool specifically for simple projectiles (radius 4)
    public static projectileBodyPool: ObjectPool<Matter.Body & IPoolable>;

    public static initPhysicsPools(physicsEngine: PhysicsEngine) {
        if (this.projectileBodyPool) return; // already init
        this.projectileBodyPool = new ObjectPool<Matter.Body & IPoolable>(() => {
            const body = Matter.Bodies.circle(0, 0, 4, {
                isSensor: true,
                frictionAir: 0,
                friction: 0,
                restitution: 0.5,
            }) as Matter.Body & IPoolable;
            
            body.reset = function() {
                if ((this as any).currentScale && (this as any).currentScale !== 1.0) {
                    const inv = 1.0 / (this as any).currentScale;
                    Matter.Body.scale(this, inv, inv);
                }
                (this as any).currentScale = 1.0;
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
}
