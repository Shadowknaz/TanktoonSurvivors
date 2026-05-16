# Development Nuances & Scaling Considerations

This document outlines key considerations for maintaining and scaling the TANK GAME project. The AI should consult this during future development.

## 1. Performance Criticality
- **DOM vs. Game Canvas**: The most significant potential bottleneck. React/DOM should *never* be used for game entity rendering. UI components (React/Tailwind) are for static elements (HUD, Menus). All dynamic game elements *must* use `PixiRenderer`.
- **Component Updates**: Avoid heavy re-renders in `UIOverlay`. Use fine-grained Zustand selectors to ensure components only re-render when necessary (e.g., player health changes).

## 2. ECS Architectures (bitECS)
- **Data-Oriented Design (DOD)**: Maintain the DOD philosophy. A component should ideally be a data container. Avoid putting complex logic or large methods inside component classes if it breaks bitECS's data-driven model.
- **System Separation**: Keep systems modular. A system should only be responsible for one game loop function (e.g., `InputSystem`, `RenderSystem`).

## 3. Scalability
- **Localization**: All text strings must be moved to `src/localization/`. Avoid hardcoded strings in components, systems, or config files.
- **Object Pooling**: As the game grows (more enemies/projectiles), strictly adhere to `ObjectPool` patterns to prevent GC pressure.
- **Procedural Generation**: Map generation algorithms (BSP) can become expensive if the map grows significantly. Pre-compute or optimize generation paths if adding new biomes or larger procedural structures.

## 4. Nuances for AI Assistant
- **Verification**: *Always* `view_file` before `edit_file`. Do not assume template structure.
- **State Management**: When adding state, consider if it belongs in `GameStore` (UI visible/game wide) or directly in the ECS World (gameplay specific). UI should *never* directly manipulate ECS entities.
- **DRY Principle**: Avoid duplicating rendering logic in `SpriteBuilder`. Centralize component styles or building logic where appropriate.
