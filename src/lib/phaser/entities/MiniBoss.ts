/**
 * MiniBoss.ts
 *
 * MiniBoss — a Phaser Container representing stage-specific mini-boss enemies
 * that progressively weaken as the player completes checkpoints within a stage.
 *
 * Supported Types:
 * - Fog of Vagueness (Stage 1 - Ideation)
 * - Pathwarden Wraith (Stage 2 - Research)
 * - Advocate of Comfortable Lies (Stage 3 - Validation)
 * - Unfinished Golem (Stage 4 - Offer Design)
 * - Collapse Specter (Stage 5 - Build & Deliver)
 * - Harbourmaster of Hesitation (Stage 6 - Launch)
 * - Babel Merchant (Stage 7 - Iteration)
 * - Iron Bureaucrat (Stage 8 - Scale)
 */

import * as Phaser from "phaser";

// ─────────────────────────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All eight mini-boss types corresponding to venture stages (PRD-compliant)
 */
export type MiniBossType =
  | "Fog of Vagueness"
  | "Pathwarden Wraith"
  | "Advocate of Comfortable Lies"
  | "Unfinished Golem"
  | "Collapse Specter"
  | "Harbourmaster of Hesitation"
  | "Babel Merchant"
  | "Iron Bureaucrat";

/**
 * Configuration data required to construct a {@link MiniBoss}.
 */
export interface MiniBossConfig {
  /** Unique identifier for this mini-boss. */
  bossId: string;

  /** Boss type determines visual appearance. */
  bossType: MiniBossType;

  /** World-space X coordinate. */
  x: number;

  /** World-space Y coordinate. */
  y: number;

  /** Stage number (1-8) this boss guards. */
  stage: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniBoss
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Phaser Container that renders a stage-specific mini-boss on the world map.
 *
 * Features:
 * - Progressive weakening as checkpoints are completed
 * - Type-specific visual designs (fog cloud vs hooded wraith)
 * - Dramatic slay animation when stage is completed
 * - Procedural graphics (no sprite assets required)
 *
 * @example
 * const boss = new MiniBoss(this, {
 *   bossId: 'fog_of_vagueness',
 *   bossType: 'fog_of_vagueness',
 *   x: 800,
 *   y: 300,
 *   stage: 1
 * });
 * boss.weaken(2, 4); // 2 out of 4 checkpoints complete
 * boss.slay(); // Stage complete, destroy boss
 */
export class MiniBoss extends Phaser.GameObjects.Container {
  // ── Identity ──────────────────────────────────────────────────────────────

  readonly bossId: string;
  readonly bossType: MiniBossType;
  readonly stage: number;

  // ── Private state ─────────────────────────────────────────────────────────

  private bossGraphics: Phaser.GameObjects.Graphics;
  private cracksGraphics: Phaser.GameObjects.Graphics;
  private namePlate: Phaser.GameObjects.Text;
  private eyeLeft: Phaser.GameObjects.Arc | null = null;
  private eyeRight: Phaser.GameObjects.Arc | null = null;
  private currentWeakness: number = 0; // 0 = full strength, 1 = fully weakened

  // ── Constructor ───────────────────────────────────────────────────────────

  /**
   * @param scene  The Phaser Scene this mini-boss belongs to.
   * @param config Full mini-boss configuration including position and type.
   */
  constructor(scene: Phaser.Scene, config: MiniBossConfig) {
    super(scene, config.x, config.y);

    this.bossId = config.bossId;
    this.bossType = config.bossType;
    this.stage = config.stage;

    // ── Boss graphics ───────────────────────────────────────────────────────
    this.bossGraphics = scene.add.graphics();

    // ── Cracks/damage overlay ───────────────────────────────────────────────
    this.cracksGraphics = scene.add.graphics();
    this.cracksGraphics.setAlpha(0);

    // Draw type-specific boss visuals
    switch (this.bossType) {
      case "Fog of Vagueness":
        this.drawFogOfVagueness();
        break;
      case "Pathwarden Wraith":
        this.drawPathwardenWraith();
        break;
      case "Unfinished Golem":
        this.drawUnfinishedGolem();
        break;
      case "Collapse Specter":
        this.drawCollapseSpecter();
        break;
      default:
        // Generic boss visual for other types
        this.drawGenericBoss();
        break;
    }

    // ── Nameplate ───────────────────────────────────────────────────────────
    const displayName = this.getBossName();
    this.namePlate = new Phaser.GameObjects.Text(scene, 0, 90, displayName, {
      fontSize: "12px",
      fontFamily: '"Courier New", Courier, monospace',
      color: "#DC2626",
      align: "center",
      stroke: "#0a0a14",
      strokeThickness: 3,
    });
    this.namePlate.setOrigin(0.5, 0);

    // ── Assemble container ──────────────────────────────────────────────────
    this.add([this.bossGraphics, this.cracksGraphics, this.namePlate]);
    if (this.eyeLeft) this.add([this.eyeLeft, this.eyeRight!]);

    // Register with scene
    scene.add.existing(this);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Progressively weaken the boss based on checkpoint completion.
   *
   * @param checkpointsComplete - Number of checkpoints completed in this stage
   * @param totalCheckpoints - Total checkpoints in this stage
   */
  weaken(checkpointsComplete: number, totalCheckpoints: number): void {
    if (totalCheckpoints === 0) return;

    const weakness = checkpointsComplete / totalCheckpoints;
    this.currentWeakness = Phaser.Math.Clamp(weakness, 0, 1);

    if (this.bossType === "Fog of Vagueness") {
      // Fog dissipates by reducing opacity
      const targetAlpha = 1.0 - this.currentWeakness * 0.7; // 100% -> 30%
      this.scene.tweens.add({
        targets: this.bossGraphics,
        alpha: targetAlpha,
        duration: 600,
        ease: "Sine.easeOut",
      });

      // Eyes fade too
      if (this.eyeLeft) {
        this.scene.tweens.add({
          targets: [this.eyeLeft, this.eyeRight],
          alpha: targetAlpha,
          duration: 600,
          ease: "Sine.easeOut",
        });
      }
    } else {
      // Wraith shows progressive cracks
      this.drawCracks(this.currentWeakness);
      this.scene.tweens.add({
        targets: this.cracksGraphics,
        alpha: this.currentWeakness,
        duration: 600,
        ease: "Sine.easeOut",
      });
    }
  }

  /**
   * Play the slay animation and destroy the boss.
   * Called when the player completes the stage.
   */
  slay(): void {
    // Safety check - ensure scene and tweens exist
    if (!this.scene || !this.scene.tweens) {
      console.warn("[MiniBoss] Cannot slay - scene or tweens not available");
      this.destroy();
      return;
    }

    // Stop any ongoing tweens
    this.scene.tweens.killTweensOf([
      this,
      this.bossGraphics,
      this.cracksGraphics,
      this.eyeLeft,
      this.eyeRight,
      this.namePlate,
    ]);

    if (this.bossType === "Fog of Vagueness") {
      // Fog dissipates outward with scale and fade
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 2000,
        ease: "Cubic.easeOut",
        onComplete: () => {
          this.destroy();
        },
      });
    } else {
      // Wraith shatters and fades
      this.scene.tweens.add({
        targets: this.bossGraphics,
        alpha: 0,
        y: this.bossGraphics.y + 20,
        duration: 1500,
        ease: "Cubic.easeIn",
      });

      this.scene.tweens.add({
        targets: this.cracksGraphics,
        alpha: 1,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 1000,
        ease: "Back.easeOut",
      });

      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 2000,
        ease: "Sine.easeOut",
        onComplete: () => {
          this.destroy();
        },
      });
    }
  }

  /**
   * Play the GOLD slay animation - more dramatic than standard slay.
   * Called when the player completes the stage with a gold checkpoint.
   */
  slayGold(): void {
    // Safety check
    if (!this.scene || !this.scene.tweens) {
      console.warn(
        "[MiniBoss] Cannot slay (gold) - scene or tweens not available",
      );
      this.destroy();
      return;
    }

    // Stop any ongoing tweens
    this.scene.tweens.killTweensOf([
      this,
      this.bossGraphics,
      this.cracksGraphics,
      this.eyeLeft,
      this.eyeRight,
      this.namePlate,
    ]);

    // Create gold particles
    const particles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 20; i++) {
      const particle = this.scene.add.circle(
        this.x,
        this.y,
        Phaser.Math.Between(2, 6),
        0xfbbf24,
        1,
      );
      particles.push(particle);

      const angle = (Math.PI * 2 * i) / 20;
      const distance = Phaser.Math.Between(50, 150);

      this.scene.tweens.add({
        targets: particle,
        x: this.x + Math.cos(angle) * distance,
        y: this.y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 1500,
        ease: "Cubic.easeOut",
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    if (this.bossType === "Fog of Vagueness") {
      // Gold fog - explodes outward with golden flash
      this.scene.tweens.add({
        targets: this.bossGraphics,
        alpha: 0,
        scaleX: 2.5,
        scaleY: 2.5,
        duration: 2500,
        ease: "Expo.easeOut",
      });

      // Pulsing gold glow
      this.scene.tweens.add({
        targets: this,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 1, to: 2 },
        scaleY: { from: 1, to: 2 },
        duration: 2500,
        ease: "Expo.easeOut",
        onComplete: () => {
          this.destroy();
        },
      });
    } else {
      // Gold wraith - shatters violently with rotation
      this.scene.tweens.add({
        targets: this.bossGraphics,
        alpha: 0,
        y: this.bossGraphics.y - 50,
        angle: 360,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 2000,
        ease: "Back.easeIn",
      });

      this.scene.tweens.add({
        targets: this.cracksGraphics,
        alpha: 1,
        scaleX: 2,
        scaleY: 2,
        duration: 1200,
        ease: "Expo.easeOut",
      });

      // Eyes fly off
      if (this.eyeLeft) {
        this.scene.tweens.add({
          targets: this.eyeLeft,
          x: this.eyeLeft.x - 60,
          y: this.eyeLeft.y - 40,
          alpha: 0,
          duration: 1500,
          ease: "Cubic.easeOut",
        });
      }

      if (this.eyeRight) {
        this.scene.tweens.add({
          targets: this.eyeRight,
          x: this.eyeRight.x + 60,
          y: this.eyeRight.y - 40,
          alpha: 0,
          duration: 1500,
          ease: "Cubic.easeOut",
        });
      }

      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 2500,
        ease: "Sine.easeOut",
        onComplete: () => {
          this.destroy();
        },
      });
    }
  }

  /**
   * Play the retreat animation.
   * Called when a player leaves the stage with partial progress —
   * boss backs off but remains visible as a looming threat.
   *
   * PRD §4.2: "retreat on partial stage complete."
   * Mini-bosses settle at 40% alpha after retreating (still lurking).
   */
  retreat(): void {
    if (!this.scene || !this.scene.tweens) return;

    this.scene.tweens.killTweensOf([
      this,
      this.bossGraphics,
      this.cracksGraphics,
      this.eyeLeft,
      this.eyeRight,
    ]);

    if (this.bossType === "Fog of Vagueness") {
      // Fog swirls inward — condenses then settles at 40% alpha
      this.scene.tweens.add({
        targets: this.bossGraphics,
        scaleX: { from: 1.0, to: 0.6 },
        scaleY: { from: 1.0, to: 0.6 },
        alpha: 0.15,
        duration: 600,
        ease: "Cubic.easeIn",
        onComplete: () => {
          if (!this.scene) return;
          this.scene.tweens.add({
            targets: this.bossGraphics,
            scaleX: 0.85,
            scaleY: 0.85,
            alpha: 0.4,
            duration: 800,
            ease: "Sine.easeOut",
          });
        },
      });
      if (this.eyeLeft) {
        this.scene.tweens.add({
          targets: [this.eyeLeft, this.eyeRight],
          alpha: 0.25,
          duration: 700,
          ease: "Sine.easeOut",
        });
      }
      this.scene.tweens.add({
        targets: this.namePlate,
        alpha: 0.3,
        duration: 500,
      });
    } else {
      // Wraith / Golem / Specter / Generic — slides into the ground, re-emerges dimly
      const retreatY = this.y + 120;

      this.scene.tweens.add({
        targets: this.bossGraphics,
        y: this.bossGraphics.y + 40,
        alpha: 0,
        duration: 900,
        ease: "Cubic.easeIn",
      });
      this.scene.tweens.add({
        targets: this.cracksGraphics,
        alpha: 0,
        duration: 400,
      });
      if (this.eyeLeft) {
        this.scene.tweens.add({
          targets: [this.eyeLeft, this.eyeRight],
          alpha: 0,
          duration: 400,
        });
      }
      this.scene.tweens.add({
        targets: this.namePlate,
        alpha: 0,
        duration: 400,
      });

      this.scene.tweens.add({
        targets: this,
        y: retreatY,
        alpha: 0,
        duration: 1200,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.setPosition(this.x, retreatY - 80);
          this.bossGraphics.setPosition(0, 0);
          this.bossGraphics.setAlpha(0.4);
          this.namePlate.setAlpha(0.3);
          this.setAlpha(0.4);
          if (this.scene) {
            this.scene.tweens.add({
              targets: this,
              y: this.y - 20,
              duration: 1200,
              ease: "Sine.easeOut",
            });
          }
        },
      });
    }
  }

  // ── Private: drawing methods ──────────────────────────────────────────────

  /**
   * Draw "Fog of Vagueness" — grey smoky cloud monster with amber glowing eyes
   * and a dark gaping mouth. Matches IMG_9275 reference.
   */
  private drawFogOfVagueness(): void {
    const g = this.bossGraphics;
    const cx = 0; // center X
    const cy = 0; // center Y

    // ── Outer wispy cloud (lightest grey, largest) ───────────────────────────
    g.fillStyle(0x9ca3af, 0.45);
    g.fillCircle(cx - 28, cy + 18, 28);
    g.fillCircle(cx + 28, cy + 18, 28);
    g.fillCircle(cx, cy + 30, 32);
    g.fillCircle(cx - 42, cy + 30, 20);
    g.fillCircle(cx + 42, cy + 30, 20);
    g.fillCircle(cx, cy + 50, 24);

    // ── Mid cloud layer (medium grey) ────────────────────────────────────────
    g.fillStyle(0x6b7280, 0.75);
    g.fillCircle(cx, cy + 5, 30);
    g.fillCircle(cx - 22, cy + 18, 26);
    g.fillCircle(cx + 22, cy + 18, 26);
    g.fillCircle(cx - 10, cy + 35, 22);
    g.fillCircle(cx + 10, cy + 35, 22);

    // ── Inner core (darkest grey for density) ────────────────────────────────
    g.fillStyle(0x4b5563, 0.9);
    g.fillCircle(cx, cy + 8, 20);
    g.fillCircle(cx - 14, cy + 20, 16);
    g.fillCircle(cx + 14, cy + 20, 16);
    g.fillCircle(cx, cy + 28, 18);

    // ── Dark gaping mouth ────────────────────────────────────────────────────
    g.fillStyle(0x111827, 0.95);
    g.fillEllipse(cx, cy + 26, 24, 14);
    // mouth detail — inner darkness
    g.fillStyle(0x000000, 1);
    g.fillEllipse(cx, cy + 28, 16, 8);

    // ── Pixel scatter base (crumbling pixel effect at bottom) ────────────────
    const pixSizes = [5, 4, 3, 4, 5, 3, 4];
    const pixOffsets = [-30, -20, -10, 0, 10, 20, 30];
    g.fillStyle(0x6b7280, 0.5);
    pixOffsets.forEach((px, i) => {
      g.fillRect(
        cx + px - pixSizes[i] / 2,
        cy + 56 + (i % 3) * 4,
        pixSizes[i],
        pixSizes[i],
      );
    });

    // ── Eyes (glowing amber — matches IMG_9275) ──────────────────────────────
    this.eyeLeft = new Phaser.GameObjects.Arc(
      this.scene,
      cx - 10,
      cy + 12,
      5,
      0,
      360,
      false,
      0xfbbf24,
    );
    this.eyeLeft.setStrokeStyle(2, 0xf59e0b, 1);

    this.eyeRight = new Phaser.GameObjects.Arc(
      this.scene,
      cx + 10,
      cy + 12,
      5,
      0,
      360,
      false,
      0xfbbf24,
    );
    this.eyeRight.setStrokeStyle(2, 0xf59e0b, 1);

    // Pulsing glow on eyes
    this.scene.tweens.add({
      targets: [this.eyeLeft, this.eyeRight],
      alpha: { from: 0.6, to: 1.0 },
      scaleX: { from: 0.9, to: 1.3 },
      scaleY: { from: 0.9, to: 1.3 },
      duration: 900,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    // Fog body slow pulse (expand/contract like breathing)
    this.scene.tweens.add({
      targets: this.bossGraphics,
      scaleX: { from: 1.0, to: 1.06 },
      scaleY: { from: 1.0, to: 1.06 },
      alpha: { from: 0.9, to: 1.0 },
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Draw "Pathwarden Wraith" — dark navy/purple hooded figure with crumbling
   * pixel base and floating animation. Matches IMG_9274 reference (3 frames).
   */
  private drawPathwardenWraith(): void {
    const g = this.bossGraphics;
    const cx = 0;
    const cy = 0;

    // ── Cloak body — dark navy-purple ────────────────────────────────────────
    g.fillStyle(0x1e1b4b, 0.95); // deep indigo (matches reference blue-black)
    // Main robe trapezoid
    g.beginPath();
    g.moveTo(cx - 18, cy + 10); // left shoulder
    g.lineTo(cx + 18, cy + 10); // right shoulder
    g.lineTo(cx + 28, cy + 65); // bottom right (wider hem)
    g.lineTo(cx - 28, cy + 65); // bottom left
    g.closePath();
    g.fillPath();

    // ── Hood — rounded triangle top ──────────────────────────────────────────
    g.fillStyle(0x1e1b4b, 1);
    g.fillCircle(cx, cy - 5, 20); // head behind hood
    g.fillStyle(0x0f0a24, 1);
    g.beginPath();
    g.moveTo(cx - 20, cy + 10);
    g.lineTo(cx + 20, cy + 10);
    g.lineTo(cx + 14, cy - 10);
    g.lineTo(cx, cy - 28); // hood peak
    g.lineTo(cx - 14, cy - 10);
    g.closePath();
    g.fillPath();

    // ── Face void (inside hood — black ellipse) ───────────────────────────────
    g.fillStyle(0x000000, 1);
    g.fillEllipse(cx, cy + 2, 18, 24);

    // ── Cloak shading layers ─────────────────────────────────────────────────
    g.fillStyle(0x312e81, 0.6); // lighter indigo highlight on left edge
    g.fillRect(cx - 18, cy + 10, 7, 55);
    g.fillStyle(0x000000, 0.25); // dark edge right
    g.fillRect(cx + 11, cy + 10, 7, 55);

    // ── Sleeve tips (hands barely visible) ──────────────────────────────────
    g.fillStyle(0x1e1b4b, 0.9);
    g.fillEllipse(cx - 22, cy + 40, 12, 8);
    g.fillEllipse(cx + 22, cy + 40, 12, 8);

    // ── Pixel dissolve base (crumbling effect — rows of pixels breaking apart)
    const pixRows = [
      { y: cy + 66, pixels: [-20, -12, -4, 4, 12, 20], size: 6 },
      { y: cy + 73, pixels: [-16, -6, 4, 14], size: 5 },
      { y: cy + 79, pixels: [-12, 0, 10], size: 4 },
      { y: cy + 84, pixels: [-6, 6], size: 3 },
    ];
    g.fillStyle(0x2d1b69, 0.8);
    pixRows.forEach((row) => {
      row.pixels.forEach((px) => {
        g.fillRect(px - row.size / 2, row.y, row.size, row.size);
      });
    });
    // scattered dissolve pixels below
    g.fillStyle(0x4c1d95, 0.5);
    [
      [-18, cy + 90],
      [-5, cy + 88],
      [8, cy + 92],
      [18, cy + 87],
    ].forEach(([px, py]) => {
      g.fillRect(px, py as number, 3, 3);
    });

    // ── Eyes — faint red glow in hood shadow ────────────────────────────────
    this.eyeLeft = new Phaser.GameObjects.Arc(
      this.scene,
      cx - 5,
      cy + 2,
      3,
      0,
      360,
      false,
      0xdc2626,
      0.7,
    );
    this.eyeRight = new Phaser.GameObjects.Arc(
      this.scene,
      cx + 5,
      cy + 2,
      3,
      0,
      360,
      false,
      0xdc2626,
      0.7,
    );

    // Eye pulse
    this.scene.tweens.add({
      targets: [this.eyeLeft, this.eyeRight],
      alpha: { from: 0.3, to: 0.9 },
      duration: 1400,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    // ── Floating animation (wraith hovers up & down) ─────────────────────────
    this.scene.tweens.add({
      targets: this,
      y: this.y - 14,
      duration: 2200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Draw progressive cracks on the wraith based on weakness level.
   *
   * @param weakness - 0 to 1, where 1 is fully cracked
   */
  private drawCracks(weakness: number): void {
    this.cracksGraphics.clear();

    if (weakness <= 0) return;

    const offsetX = -40;
    const offsetY = -60;

    this.cracksGraphics.lineStyle(2, 0xffffff, 0.7);

    // Crack 1 (appears at 25% weakness)
    if (weakness >= 0.25) {
      this.cracksGraphics.beginPath();
      this.cracksGraphics.moveTo(offsetX + 25, offsetY + 40);
      this.cracksGraphics.lineTo(offsetX + 20, offsetY + 60);
      this.cracksGraphics.lineTo(offsetX + 15, offsetY + 75);
      this.cracksGraphics.strokePath();
    }

    // Crack 2 (appears at 50% weakness)
    if (weakness >= 0.5) {
      this.cracksGraphics.beginPath();
      this.cracksGraphics.moveTo(offsetX + 55, offsetY + 40);
      this.cracksGraphics.lineTo(offsetX + 60, offsetY + 60);
      this.cracksGraphics.lineTo(offsetX + 65, offsetY + 75);
      this.cracksGraphics.strokePath();
    }

    // Crack 3 (appears at 75% weakness)
    if (weakness >= 0.75) {
      this.cracksGraphics.beginPath();
      this.cracksGraphics.moveTo(offsetX + 40, offsetY + 45);
      this.cracksGraphics.lineTo(offsetX + 40, offsetY + 70);
      this.cracksGraphics.lineTo(offsetX + 35, offsetY + 85);
      this.cracksGraphics.strokePath();

      this.cracksGraphics.beginPath();
      this.cracksGraphics.moveTo(offsetX + 40, offsetY + 70);
      this.cracksGraphics.lineTo(offsetX + 45, offsetY + 85);
      this.cracksGraphics.strokePath();
    }

    // Additional shatter lines at full weakness
    if (weakness >= 1.0) {
      this.cracksGraphics.lineStyle(1, 0xffffff, 0.5);
      this.cracksGraphics.beginPath();
      this.cracksGraphics.moveTo(offsetX + 30, offsetY + 50);
      this.cracksGraphics.lineTo(offsetX + 50, offsetY + 55);
      this.cracksGraphics.strokePath();

      this.cracksGraphics.beginPath();
      this.cracksGraphics.moveTo(offsetX + 25, offsetY + 70);
      this.cracksGraphics.lineTo(offsetX + 55, offsetY + 65);
      this.cracksGraphics.strokePath();
    }
  }

  /**
   * Draw "Unfinished Golem" - a blocky stone figure with glowing cracks.
   */
  private drawUnfinishedGolem(): void {
    const g = this.bossGraphics;
    const offsetX = -45;
    const offsetY = -70;

    g.fillStyle(0x52525b, 1); // Dark stone

    // Head (blocky)
    g.fillRect(offsetX + 30, offsetY + 0, 30, 25);

    // Torso (massive)
    g.fillRect(offsetX + 10, offsetY + 30, 70, 50);

    // Arms (asymmetrical)
    g.fillRect(offsetX + 0, offsetY + 35, 15, 60);
    g.fillRect(offsetX + 75, offsetY + 35, 15, 40);

    // Glowing core
    const core = new Phaser.GameObjects.Arc(
      this.scene,
      offsetX + 45,
      offsetY + 50,
      8,
      0,
      360,
      false,
      0xef4444,
      1,
    );
    this.add(core);
    this.scene.tweens.add({
      targets: core,
      scale: 1.5,
      alpha: 0.5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Draw "Collapse Specter" - a drifting phantom with trailing energy.
   */
  private drawCollapseSpecter(): void {
    const g = this.bossGraphics;
    const offsetX = -40;
    const offsetY = -60;

    g.fillStyle(0x312e81, 0.6); // Deep indigo translucent

    // Phantom head
    g.fillCircle(offsetX + 40, offsetY + 20, 18);

    // Tattered cloak
    g.beginPath();
    g.moveTo(offsetX + 40, offsetY + 0);
    g.lineTo(offsetX + 10, offsetY + 100);
    g.lineTo(offsetX + 70, offsetY + 100);
    g.closePath();
    g.fillPath();

    // Floating hands
    g.fillCircle(offsetX + 5, offsetY + 50, 10);
    g.fillCircle(offsetX + 75, offsetY + 50, 10);

    this.scene.tweens.add({
      targets: this,
      y: this.y + 10,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Draws an upgraded generic boss with high-fidelity details.
   */
  private drawGenericBoss(): void {
    const g = this.bossGraphics;
    const offsetX = -50;
    const offsetY = -60;

    // Silhouette
    g.fillStyle(0x18181b, 1.0); // Zinc 900
    g.fillRect(offsetX + 15, offsetY + 10, 70, 100);
    g.fillStyle(0x27272a, 1.0); // Zinc 800
    g.fillRect(offsetX + 25, offsetY + 0, 50, 20);

    // Internal Red Rune (Glow)
    g.fillStyle(0xdc2626, 0.4);
    g.fillRect(offsetX + 48, offsetY + 30, 4, 40);

    this.eyeLeft = new Phaser.GameObjects.Arc(
      this.scene,
      offsetX + 40,
      offsetY + 15,
      4,
      0,
      360,
      false,
      0xff0000,
      1,
    );
    this.eyeRight = new Phaser.GameObjects.Arc(
      this.scene,
      offsetX + 60,
      offsetY + 15,
      4,
      0,
      360,
      false,
      0xff0000,
      1,
    );
  }

  /**
   * Returns display name for this boss type
   */
  private getBossName(): string {
    // Boss type is already the display name (PRD-compliant naming)
    return this.bossType;
  }
}
