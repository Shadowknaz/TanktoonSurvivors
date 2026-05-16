import { RenderConfig } from "../config/RenderConfig";

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
      const scaleX = RenderConfig.SCREEN_WIDTH / rect.width;
      const scaleY = RenderConfig.SCREEN_HEIGHT / rect.height;
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
    if (event.touches.length > 0) {
      this.handlePointerPosition(event.touches[0].clientX, event.touches[0].clientY);
      this.state.isMouseDown = true;
      this.state.isShooting = true;
      event.preventDefault();
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length > 0) {
      this.handlePointerPosition(event.touches[0].clientX, event.touches[0].clientY);
      event.preventDefault();
    }
  }

  onTouchEnd(event: TouchEvent): void {
    this.state.isMouseDown = false;
    this.state.isShooting = false;
  }
}
