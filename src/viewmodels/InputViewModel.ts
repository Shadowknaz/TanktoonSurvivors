import { GameConfig } from "../config/GameConfig";

export interface InputState {
  moveLeft: boolean;
  moveRight: boolean;
  moveUp: boolean;
  moveDown: boolean;
  mousePosition: { x: number; y: number };
  isMouseDown: boolean;
  isShooting: boolean;
  isDashing: boolean;
}

export class InputViewModel {
  private state: InputState = {
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    mousePosition: { x: 0, y: 0 },
    isMouseDown: false,
    isShooting: false,
    isDashing: false,
  };

  private boundOnKeyDown = this.onKeyDown.bind(this);
  private boundOnKeyUp = this.onKeyUp.bind(this);
  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnTouchStart = this.onTouchStart.bind(this);
  private boundOnTouchMove = this.onTouchMove.bind(this);
  private boundOnTouchEnd = this.onTouchEnd.bind(this);

  constructor() {
    window.addEventListener("keydown", this.boundOnKeyDown);
    window.addEventListener("keyup", this.boundOnKeyUp);
    window.addEventListener("mousemove", this.boundOnMouseMove);
    window.addEventListener("mousedown", this.boundOnMouseDown);
    window.addEventListener("mouseup", this.boundOnMouseUp);
    window.addEventListener("touchstart", this.boundOnTouchStart, { passive: false });
    window.addEventListener("touchmove", this.boundOnTouchMove, { passive: false });
    window.addEventListener("touchend", this.boundOnTouchEnd);
  }

  destroy() {
    window.removeEventListener("keydown", this.boundOnKeyDown);
    window.removeEventListener("keyup", this.boundOnKeyUp);
    window.removeEventListener("mousemove", this.boundOnMouseMove);
    window.removeEventListener("mousedown", this.boundOnMouseDown);
    window.removeEventListener("mouseup", this.boundOnMouseUp);
    window.removeEventListener("touchstart", this.boundOnTouchStart);
    window.removeEventListener("touchmove", this.boundOnTouchMove);
    window.removeEventListener("touchend", this.boundOnTouchEnd);
  }

  getState(): InputState {
    return this.state;
  }

  private handlePointerPosition(clientX: number, clientY: number): void {
    const container = document.getElementById("game-container");
    if (container) {
      const rect = container.getBoundingClientRect();
      const scaleX = GameConfig.VIRTUAL_WIDTH / rect.width;
      const scaleY = GameConfig.VIRTUAL_HEIGHT / rect.height;
      this.state.mousePosition = {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    } else {
      this.state.mousePosition = { x: clientX, y: clientY };
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.state.moveUp = true;
        break;
      case "KeyS":
      case "ArrowDown":
        this.state.moveDown = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.state.moveLeft = true;
        break;
      case "KeyD":
      case "ArrowRight":
        this.state.moveRight = true;
        break;
      case "Space":
      case "ShiftLeft":
        this.state.isDashing = true;
        break;
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.state.moveUp = false;
        break;
      case "KeyS":
      case "ArrowDown":
        this.state.moveDown = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.state.moveLeft = false;
        break;
      case "KeyD":
      case "ArrowRight":
        this.state.moveRight = false;
        break;
      case "Space":
      case "ShiftLeft":
        this.state.isDashing = false;
        break;
    }
  }

  onMouseMove(event: MouseEvent): void {
    this.handlePointerPosition(event.clientX, event.clientY);
  }

  onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      this.state.isMouseDown = true;
      this.state.isShooting = true;
    }
  }

  onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.state.isMouseDown = false;
      this.state.isShooting = false;
    }
  }

  onTouchStart(event: TouchEvent): void {
    // We use the first changed touch that isn't handled by UI (UI stops propagation)
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      this.handlePointerPosition(touch.clientX, touch.clientY);
      this.state.isMouseDown = true;
      this.state.isShooting = true;
      // Do not preventDefault here to allow UI elements to still function if needed, 
      // but usually stopPropagation on UI is enough.
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      this.handlePointerPosition(touch.clientX, touch.clientY);
    }
  }

  onTouchEnd(): void {
    this.state.isMouseDown = false;
    this.state.isShooting = false;
  }

  // --- Mobile Specific Methods ---

  setMobileMove(x: number, y: number): void {
    // x and y should be normalized vectors (-1 to 1)
    this.state.moveLeft = x < -0.2;
    this.state.moveRight = x > 0.2;
    this.state.moveUp = y < -0.2;
    this.state.moveDown = y > 0.2;
  }

  setMobileAction(action: "dash", active: boolean): void {
    if (action === "dash") {
      this.state.isDashing = active;
    }
  }

  setMobileAim(x: number, y: number): void {
     this.state.mousePosition = { x, y };
  }
}
