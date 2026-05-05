import * as Phaser from "phaser";
import { audioManager } from "../../audio/audioManager";

export type CheckpointStatus =
  | "locked"
  | "active"
  | "in_progress"
  | "partial"
  | "completed"
  | "gold";

export interface CheckpointConfig {
  id: string;
  stage: number;
  checkpoint: number;
  status: CheckpointStatus;
  x: number;
  y: number;
  t1: boolean;
  t2: boolean;
  t3: boolean;
  globalIndex: number;
}

export class CheckpointNode extends Phaser.GameObjects.Container {
  readonly checkpointId: string;
  readonly stage: number;
  readonly checkpoint: number;
  readonly globalIndex: number;

  private _status: CheckpointStatus;

  get status(): CheckpointStatus {
    return this._status;
  }

  private mainSprite: Phaser.GameObjects.Image;
  private glowRing: Phaser.GameObjects.Arc;
  private pulseRing: Phaser.GameObjects.Arc;
  private stageDot: Phaser.GameObjects.Arc;
  private labelPlate: Phaser.GameObjects.Rectangle;
  private stageLabel: Phaser.GameObjects.Text;
  private numberText: Phaser.GameObjects.Text;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private shimmerTween: Phaser.Tweens.Tween | null = null;

  private static readonly C = {
    barkDark: 0x342416,
    bark: 0x6c4b2a,
    barkLight: 0xa67b49,
    moss: 0x4b7a43,
    mossLight: 0x89b96b,
    river: 0x4c74c9,
    riverLight: 0x8ab2ff,
    amber: 0xd79220,
    amberLight: 0xf1cf76,
    parchment: 0xf5e8c8,
    parchmentDark: 0xd2bb8e,
    slate: 0x6b6254,
    ink: 0x251911,
    gold: 0xf2c55a,
    white: 0xffffff,
  };

  constructor(scene: Phaser.Scene, config: CheckpointConfig) {
    super(scene, config.x, config.y);

    this.checkpointId = config.id;
    this.stage = config.stage;
    this.checkpoint = config.checkpoint;
    this.globalIndex = config.globalIndex;
    this._status = config.status;

    const C = CheckpointNode.C;

    const shadow = new Phaser.GameObjects.Ellipse(
      scene,
      0,
      31,
      60,
      18,
      0x000000,
      0.22,
    );

    const outerFrame = scene.add.graphics();
    outerFrame.fillStyle(C.barkDark, 1);
    outerFrame.fillCircle(0, 0, 39);
    outerFrame.lineStyle(4, C.barkLight, 0.95);
    outerFrame.strokeCircle(0, 0, 36);
    outerFrame.lineStyle(2, C.parchmentDark, 0.7);
    outerFrame.strokeCircle(0, 0, 31);

    const innerRing = scene.add.graphics();
    innerRing.fillGradientStyle(
      C.parchmentDark,
      C.parchmentDark,
      C.barkLight,
      C.barkLight,
      1,
    );
    innerRing.fillCircle(0, 0, 28);
    innerRing.lineStyle(2, C.parchment, 0.5);
    innerRing.strokeCircle(0, 0, 26);

    this.glowRing = new Phaser.GameObjects.Arc(
      scene,
      0,
      0,
      44,
      0,
      360,
      false,
      C.moss,
      0,
    );
    this.glowRing.setStrokeStyle(3, C.mossLight, 0.35);

    this.pulseRing = new Phaser.GameObjects.Arc(
      scene,
      0,
      0,
      33,
      0,
      360,
      false,
      C.mossLight,
      0.18,
    );
    this.pulseRing.setStrokeStyle(2, C.parchment, 0.55);
    this.pulseRing.setVisible(false);

    const stageDotColor =
      config.stage === 1 ? C.amber : config.stage === 2 ? C.moss : C.river;
    this.stageDot = new Phaser.GameObjects.Arc(
      scene,
      0,
      -38,
      4,
      0,
      360,
      false,
      stageDotColor,
      1,
    );
    this.stageDot.setStrokeStyle(2, C.parchment, 0.65);

    this.mainSprite = new Phaser.GameObjects.Image(
      scene,
      0,
      0,
      `cp_${config.status}`,
    );
    this.mainSprite.setOrigin(0.5, 0.5);
    this.mainSprite.setScale(0.72);

    this.numberText = new Phaser.GameObjects.Text(scene, 0, 2, `${config.checkpoint}`, {
      fontSize: "18px",
      fontFamily: '"VT323", "Courier New", monospace',
      color: "#fff7e6",
      align: "center",
      fontStyle: "bold",
      stroke: "#2a1c11",
      strokeThickness: 3,
    });
    this.numberText.setOrigin(0.5, 0.5);

    this.labelPlate = new Phaser.GameObjects.Rectangle(
      scene,
      0,
      39,
      42,
      12,
      C.barkDark,
      0.92,
    );
    this.labelPlate.setStrokeStyle(2, C.parchmentDark, 0.8);

    this.stageLabel = new Phaser.GameObjects.Text(
      scene,
      0,
      39,
      `LV ${config.checkpoint}`,
      {
        fontSize: "8px",
        fontFamily: '"VT323", "Courier New", monospace',
        color: "#f5e7c6",
        align: "center",
      },
    );
    this.stageLabel.setOrigin(0.5, 0.5);

    this.add([
      shadow,
      this.glowRing,
      outerFrame,
      innerRing,
      this.pulseRing,
      this.mainSprite,
      this.stageDot,
      this.labelPlate,
      this.stageLabel,
      this.numberText,
    ]);

    scene.tweens.add({
      targets: this,
      y: config.y - 2,
      duration: 2200 + Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 1800,
    });

    this.setSize(84, 84);
    this.setInteractive();

    this.on("pointerover", () => {
      if (this._status !== "locked") {
        audioManager.playUI("hover");
        this.scene.tweens.add({
          targets: this,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 140,
          ease: "Quad.easeOut",
        });
        this.glowRing.setStrokeStyle(4, C.amberLight, 0.65);
      }
    });

    this.on("pointerout", () => {
      this.scene.tweens.add({
        targets: this,
        scaleX: 1,
        scaleY: 1,
        duration: 140,
        ease: "Quad.easeOut",
      });
      if (this._status === "active") {
        this.glowRing.setStrokeStyle(4, C.mossLight, 0.55);
      } else {
        this.glowRing.setStrokeStyle(0);
      }
    });

    this.on("pointerdown", () => {
      if (this._status !== "locked") {
        audioManager.playUI("click");
        this.scene.tweens.add({
          targets: this,
          scaleX: 0.96,
          scaleY: 0.96,
          duration: 90,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      }
    });

    scene.add.existing(this);
    this.applyStatusVisuals();
  }

  updateStatus(status: CheckpointStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.applyStatusVisuals();
  }

  updateProgressDots(
    _t1: boolean,
    _t2: boolean,
    _t3: boolean,
    _isGold = false,
  ): void {}

  getWorldPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  override setInteractive(): this {
    super.setInteractive(
      new Phaser.Geom.Circle(0, 0, 32),
      Phaser.Geom.Circle.Contains,
    );

    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.scene.events.emit("checkpoint_clicked", {
        id: this.checkpointId,
        stage: this.stage,
        checkpoint: this.checkpoint,
      });
    });

    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.numberText.setStyle({ color: "#fff3d6" });
      if (typeof document !== "undefined") document.body.style.cursor = "pointer";
    });

    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.numberText.setStyle({
        color: this._status === "gold" ? "#3b2412" : "#fff7e6",
      });
      if (typeof document !== "undefined") document.body.style.cursor = "default";
    });

    return this;
  }

  private startPulse(): void {
    this.pulseTween?.stop();
    this.pulseRing.setVisible(true);
    this.pulseRing.setAlpha(0.42);
    this.pulseRing.setScale(1);

    this.pulseTween = this.scene.tweens.add({
      targets: this.pulseRing,
      alpha: { from: 0.12, to: 0.42 },
      scaleX: { from: 0.96, to: 1.14 },
      scaleY: { from: 0.96, to: 1.14 },
      duration: 850,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      repeat: -1,
    });
  }

  private startGoldShimmer(): void {
    this.shimmerTween?.stop();
    const start = Phaser.Display.Color.IntegerToColor(CheckpointNode.C.amber);
    const end = Phaser.Display.Color.IntegerToColor(CheckpointNode.C.amberLight);
    const counter = { t: 0 };

    this.shimmerTween = this.scene.tweens.add({
      targets: counter,
      t: 1,
      duration: 1400,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        const r = Math.round(Phaser.Math.Linear(start.red, end.red, counter.t));
        const g = Math.round(Phaser.Math.Linear(start.green, end.green, counter.t));
        const b = Math.round(Phaser.Math.Linear(start.blue, end.blue, counter.t));
        this.mainSprite.setTint(Phaser.Display.Color.GetColor(r, g, b));
      },
    });
  }

  private stopAnimations(): void {
    this.pulseTween?.stop();
    this.pulseTween = null;
    this.shimmerTween?.stop();
    this.shimmerTween = null;
    this.pulseRing.setVisible(false);
    this.mainSprite.setScale(0.72);
    this.mainSprite.setAlpha(1);
    this.mainSprite.clearTint();
  }

  private applyStatusVisuals(): void {
    this.stopAnimations();
    this.mainSprite.setTexture(
      `cp_${this._status === "partial" ? "in_progress" : this._status}`,
    );

    const C = CheckpointNode.C;

    switch (this._status) {
      case "locked":
        this.mainSprite.setAlpha(0.42);
        this.mainSprite.setTint(C.slate);
        this.numberText.setStyle({ color: "#82756a" });
        this.stageLabel.setStyle({ color: "#ae9779" });
        this.labelPlate.setFillStyle(C.barkDark, 0.78);
        this.stageDot.setAlpha(0.28);
        this.glowRing.setAlpha(0);
        break;

      case "active":
        this.mainSprite.setTint(C.moss, C.moss, C.river, C.river);
        this.numberText.setStyle({ color: "#fff8ed" });
        this.stageLabel.setStyle({ color: "#fff0cc" });
        this.labelPlate.setFillStyle(C.bark, 0.95);
        this.stageDot.setFillStyle(C.amber, 1);
        this.stageDot.setAlpha(1);
        this.glowRing.setFillStyle(C.mossLight, 0.14);
        this.glowRing.setStrokeStyle(4, C.mossLight, 0.55);
        this.glowRing.setAlpha(1);
        this.startPulse();
        break;

      case "in_progress":
        this.mainSprite.setTint(C.barkLight, C.amber, C.amber, C.barkLight);
        this.numberText.setStyle({ color: "#fff5db" });
        this.stageLabel.setStyle({ color: "#ffe39a" });
        this.labelPlate.setFillStyle(C.bark, 0.95);
        this.stageDot.setFillStyle(C.amberLight, 1);
        this.stageDot.setAlpha(1);
        this.glowRing.setFillStyle(C.amber, 0.12);
        this.glowRing.setStrokeStyle(4, C.amberLight, 0.45);
        this.glowRing.setAlpha(1);
        break;

      case "partial":
        this.mainSprite.setTint(C.amber, C.amberLight, C.river, C.riverLight);
        this.numberText.setStyle({ color: "#fff6e4" });
        this.stageLabel.setStyle({ color: "#ffe0a1" });
        this.labelPlate.setFillStyle(C.bark, 0.95);
        this.stageDot.setFillStyle(C.gold, 1);
        this.stageDot.setAlpha(1);
        this.glowRing.setFillStyle(C.amber, 0.18);
        this.glowRing.setStrokeStyle(4, C.amberLight, 0.52);
        this.glowRing.setAlpha(1);
        break;

      case "completed":
        this.mainSprite.setTint(C.river, C.riverLight, C.moss, C.mossLight);
        this.numberText.setStyle({ color: "#f5efe1" });
        this.stageLabel.setStyle({ color: "#efe1c2" });
        this.labelPlate.setFillStyle(C.barkDark, 0.95);
        this.stageDot.setFillStyle(C.mossLight, 1);
        this.stageDot.setAlpha(1);
        this.glowRing.setAlpha(0);
        break;

      case "gold":
        this.mainSprite.setTint(C.amber, C.amberLight, C.gold, C.parchment);
        this.numberText.setStyle({ color: "#3b2412" });
        this.stageLabel.setStyle({ color: "#ffe09e" });
        this.labelPlate.setFillStyle(C.bark, 0.98);
        this.stageDot.setFillStyle(C.gold, 1);
        this.stageDot.setAlpha(1);
        this.glowRing.setFillStyle(C.amber, 0.25);
        this.glowRing.setStrokeStyle(4, C.amberLight, 0.55);
        this.glowRing.setAlpha(1);
        this.startGoldShimmer();
        break;
    }
  }
}
