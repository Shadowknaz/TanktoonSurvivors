import { World, hasComponent, query } from "bitecs";
import { StickyProjectile, Position } from "../components";
import { StickyProjectileService } from "../../services/StickyProjectileService";
import { EventBus } from "../../core/EventBus";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { GameContext } from "../../models/GameContext";

export class StickyProjectileSystem {
  constructor(
    private physicsEngine: PhysicsEngine,
    private context: GameContext,
    private eventBus: EventBus
  ) {}

  update(world: World): void {
    const stickyProjectiles = query(world, [StickyProjectile, Position]);

    for (const eid of stickyProjectiles) {
      // Update timer
      StickyProjectile.timer[eid] -= 1;

      // Check if target is still alive
      const targetEid = StickyProjectile.targetEid[eid];
      if (targetEid === 0 || !hasComponent(world, targetEid, Position)) {
        // Target is dead, detonate immediately
        StickyProjectileService.detonate(world, this.physicsEngine, eid, this.context, this.eventBus);
        continue;
      }

      // Update position to follow target
      StickyProjectileService.updatePosition(world, eid, this.physicsEngine);

      // Check if timer expired
      if (StickyProjectile.timer[eid] <= 0) {
        StickyProjectileService.detonate(world, this.physicsEngine, eid, this.context, this.eventBus);
      }
    }
  }

  destroy(): void {
    // No cleanup needed
  }
}
