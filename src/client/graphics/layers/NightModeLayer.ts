import { Cell } from "../../../core/game/Game";
import { GameView } from "../../../core/game/GameView";
import { UserSettings } from "../../../core/game/UserSettings";
import { TransformHandler } from "../TransformHandler";
import { Layer } from "./Layer";

export class NightModeLayer implements Layer {
  private canvas: HTMLCanvasElement;
  private mouseX: number = 0;
  private mouseY: number = 0;
  private active: boolean = false;
  private rect: DOMRect;

  constructor(
    private game: GameView,
    private transformHandler: TransformHandler,
    canvas: HTMLCanvasElement,
    private userSettings: UserSettings,
  ) {
    this.canvas = canvas;
  }

  private updateRect() {
    this.rect = this.canvas.getBoundingClientRect();
  }

  private blend(top: number[], bottom: number[], alpha: number): number[] {
    return [
      alpha * top[0] + (1 - alpha) * bottom[0],
      alpha * top[1] + (1 - alpha) * bottom[1],
      alpha * top[2] + (1 - alpha) * bottom[2],
    ];
  }

  private reverseBlend(
    blended: number[],
    bottom: number[],
    reversal: number,
  ): number[] {
    return [
      blended[0] + reversal * (bottom[0] - blended[0]),
      blended[1] + reversal * (bottom[1] - blended[1]),
      blended[2] + reversal * (bottom[2] - blended[2]),
    ];
  }

  private smoothDecay(x: number, X: number, p = 3, k = 2): number {
    if (x <= 0) return 1;
    if (x >= X) return 0;
    const ratio = x / X;
    return Math.pow(1 - Math.pow(ratio, p), k);
  }

  private rgbaToArray(rgba: string): number[] {
    // Match all numbers in the rgba() string
    const matches = rgba.match(/[\d.]+/g);
    if (!matches) return [];

    // Convert first 3 values (R, G, B) to numbers
    return matches.slice(0, 3).map(Number);
  }

  init() {
    this.updateRect();
    this.mouseX = this.rect.width / 2;
    this.mouseY = this.rect.height / 2;

    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("pointermove", this.handleMouseMove);
    this.canvas.addEventListener("mouseleave", this.handleMouseLeave);
    this.canvas.addEventListener("mouseenter", this.handleMouseEnter);
    window.addEventListener("resize", () => {
      this.updateRect();
      this.handleResize();
    });
  }

  private handleResize = () => {
    // keep a reasonable default if needed
    const rect = this.canvas.getBoundingClientRect();
    if (this.mouseX > rect.width) this.mouseX = rect.width / 2;
    if (this.mouseY > rect.height) this.mouseY = rect.height / 2;
  };

  private handleMouseMove = (e: MouseEvent | PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  };

  private handleMouseEnter = (e: MouseEvent) => {
    this.active = true;
  };

  private handleMouseLeave = (e: MouseEvent) => {
    this.active = false;
  };

  shouldTransform(): boolean {
    // We render this layer in screen-space (no world transform) so it can sit
    // on top of the world but underneath UI layers.
    return false;
  }

  tick() {}

  redraw() {}

  renderLayer(context: CanvasRenderingContext2D): void {
    if (!this.userSettings.nightMode()) return;

    const w = context.canvas.width;
    const h = context.canvas.height;

    const opacity = 0.85;

    // Create dark overlay
    context.fillStyle = "rgba(0, 0, 0, " + opacity + ")";
    context.fillRect(0, 0, w, h);

    if (!this.active) return;

    const worldCell = this.transformHandler.screenToWorldCoordinates(
      this.mouseX,
      this.mouseY,
    );
    const tileRadius = 50;
    //const steepness = -0.80;

    //const gradient = context.createRadialGradient(
    //    this.mouseX,
    //    this.mouseY,
    //    0,
    //    this.mouseX,
    //    this.mouseY,
    //    tileRadius
    //)
    // Center is bright, edges fade out
    //gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)'); // flashlight intensity
    //gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.globalCompositeOperation = "lighter"; // brighten

    for (let dx = -tileRadius; dx <= tileRadius; dx++) {
      for (let dy = -tileRadius; dy <= tileRadius; dy++) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > tileRadius) continue;

        const currentTileX = worldCell.x + dx;
        const currentTileY = worldCell.y + dy;

        const screenPos = this.transformHandler.worldToScreenCoordinates(
          new Cell(currentTileX, currentTileY),
        );

        //const brightness = Math.max(0, 1 - distance / tileRadius * opacity); // Max is the amount it darkened
        //const brightness = Math.max(0, Math.pow(1 + distance, steepness));
        const brightness = +this.smoothDecay(distance, tileRadius).toFixed(2);

        // fully transparent at edge
        context.filter = `saturate(${1 + brightness * 0.5})`;
        context.fillStyle = `rgba(255, 255, 255, ${(brightness * opacity) / 2})`; // tweak 0.6 for strength

        context.fillRect(
          screenPos.x,
          screenPos.y,
          this.transformHandler.scale,
          this.transformHandler.scale,
        );
      }
    }

    // Reset composite operation
    context.globalCompositeOperation = "source-over";
    context.filter = "none";
  }

  dispose() {
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("pointermove", this.handleMouseMove);
    this.canvas.removeEventListener("mouseleave", this.handleMouseLeave);
    this.canvas.removeEventListener("mouseenter", this.handleMouseEnter);
    window.removeEventListener("resize", this.handleResize);
  }
}
