import * as Phaser from "phaser";
import { AssetLoader } from "../utils/asset-loader";
import { CheckpointNode, CheckpointStatus } from "../entities/Checkpoint";
import { Persona, PersonaGender } from "../entities/Persona";
import { BossSilhouette } from "../entities/Boss";
import { MiniBoss, type MiniBossType } from "../entities/MiniBoss";
import { audioManager, type CheckpointSFXId } from "../../audio/audioManager";
import { eventBridge, type CheckpointState } from "../utils/event-bridge";
import { VENTURE_STAGES } from "@convex/ventureConstants";
import {
  createCheckpointAnimation,
  getAnimationTypeForStage,
  type AnimationVariant,
  type BaseCheckpointAnimation,
} from "./animations";

/**
 * Biome configuration for the 8 venture stages
 * Following PRD specifications for visual themes
 */
interface BiomeConfig {
  id: number;
  name: string;
  theme: string;
  visualTheme:
    | "village"
    | "forest"
    | "arena"
    | "artisan"
    | "mine"
    | "harbour"
    | "crossroads"
    | "capital";
  colors: {
    sky: number;
    ground: number;
    accent1: number;
    accent2: number;
    path: number;
  };
}

const BIOME_CONFIGS: BiomeConfig[] = [
  {
    id: 1,
    name: "The Village",
    theme: "Ideation",
    visualTheme: "village",
    colors: {
      sky: 0x87ceeb,
      ground: 0x90ee90,
      accent1: 0x22c55e, // Emerald 500
      accent2: 0xf59e0b, // Amber 500
      path: 0xd2b48c,
    },
  },
  {
    id: 2,
    name: "The Forest",
    theme: "Research",
    visualTheme: "forest",
    colors: {
      sky: 0x065f46, // Teal 800
      ground: 0x064e3b, // Teal 900
      accent1: 0x14532d, // Green 900
      accent2: 0x4ade80, // Green 400
      path: 0x8b7355,
    },
  },
  {
    id: 3,
    name: "The Arena",
    theme: "Validation",
    visualTheme: "arena",
    colors: {
      sky: 0x450a0a, // Red 950
      ground: 0x7f1d1d, // Red 900
      accent1: 0x991b1b, // Red 800
      accent2: 0xf87171, // Red 400
      path: 0xdaa520,
    },
  },
  {
    id: 4,
    name: "The Artisan's Quarter",
    theme: "Offer Design",
    visualTheme: "artisan",
    colors: {
      sky: 0x312e81, // Indigo 900
      ground: 0x1e1b4b, // Indigo 950
      accent1: 0x4338ca, // Indigo 700
      accent2: 0x818cf8, // Indigo 400
      path: 0xc0c0c0,
    },
  },
  {
    id: 5,
    name: "The Mine",
    theme: "Build & Deliver",
    visualTheme: "mine",
    colors: {
      sky: 0x18181b, // Zinc 900
      ground: 0x09090b, // Zinc 950
      accent1: 0x27272a, // Zinc 800
      accent2: 0x71717a, // Zinc 500
      path: 0x808080,
    },
  },
  {
    id: 6,
    name: "The Harbour",
    theme: "Launch",
    visualTheme: "harbour",
    colors: {
      sky: 0x0c4a6e, // Cyan 900
      ground: 0x082f49, // Cyan 950
      accent1: 0x075985, // Cyan 800
      accent2: 0x38bdf8, // Cyan 400
      path: 0xc0c0c0,
    },
  },
  {
    id: 7,
    name: "The Crossroads Town",
    theme: "Iteration",
    visualTheme: "crossroads",
    colors: {
      sky: 0x4c1d95, // Violet 900
      ground: 0x2e1065, // Violet 950
      accent1: 0x5b21b6, // Violet 800
      accent2: 0xa78bfa, // Violet 400
      path: 0xbc8f8f,
    },
  },
  {
    id: 8,
    name: "The Capital",
    theme: "Scale",
    visualTheme: "capital",
    colors: {
      sky: 0x713f12, // Yellow 900 (Goldish)
      ground: 0x422006, // Yellow 950
      accent1: 0x854d0e, // Yellow 800
      accent2: 0xfacc15, // Yellow 400
      path: 0xf0e68c,
    },
  },
];

/**
 * WorldMapScene - PRD-compliant implementation
 *
 * Features:
 * - Snake-path overworld across 8 biome zones (left to right)
 * - Two-layer brightness system (accumulated base + stage layer)
 * - 36 checkpoint nodes across 8 stages
 * - Persona sprite floating above active checkpoint
 * - Super Boss + 8 mini-bosses
 */
export class WorldMapScene extends Phaser.Scene {
  // Core entities
  private checkpointNodes: Map<string, CheckpointNode>;
  private persona: Persona | null;
  private selectedCheckpointIndex = 0;
  private selectionGlow: Phaser.GameObjects.Arc | null = null;
  private bosses: Map<string, BossSilhouette>;
  private miniBosses: Map<number, MiniBoss>;
  /** Stages whose mini-boss has already played the retreat animation this session */
  private retreatedStages: Set<number> = new Set();
  /** Residual path markers for partially completed stages */
  private residualMarkers: Map<number, Phaser.GameObjects.Container> =
    new Map();

  // Scene layers
  private map!: Phaser.Tilemaps.Tilemap;
  private backgroundLayer!: Phaser.GameObjects.Container;
  private midgroundLayer!: Phaser.GameObjects.Container;
  private gameLayer!: Phaser.GameObjects.Container;
  private animationLayer!: Phaser.GameObjects.Container;

  // Animation state
  private currentAnimation: BaseCheckpointAnimation | null = null;

  // Brightness system (PRD two-layer formula)
  private brightnessFilter: Phaser.FX.ColorMatrix | null = null;
  private currentBrightness: number = 0;

  // Venture state
  private currentVentureId: string | null;
  private currentStage: number = 1;
  private currentCorruptionLevel: number = 0;
  private completedStages: number = 0;
  private stageTasksCompleted: number = 0;
  private stageTasksTotal: number = 0;

  // Event handlers
  private boundHandlers: {
    updateBrightness?: (event: { brightness: number }) => void;
    updateCheckpoints?: (event: { checkpoints: CheckpointState[] }) => void;
    setActiveVenture?: (event: {
      ventureId: string;
      personaGender: "male" | "female";
      assignedBosses?: string[];
      currentStage?: number;
      corruptionLevel?: number;
      superBoss?: {
        bossSlug: string;
        bossName: string;
        visualStatus: "silhouette" | "present" | "foreground";
      };
    }) => void;
    scrollToCheckpoint?: (event: { checkpointId: string }) => void;
    playCheckpointAnimation?: (event: {
      checkpointId: string;
      stage: number;
      variant: "standard" | "gold";
    }) => void;
  };

  // Map dimensions
  private readonly TOTAL_CHECKPOINTS = 36;
  private readonly BIOME_WIDTH = 1400;
  private readonly MAP_WIDTH = this.BIOME_WIDTH * 8;
  private readonly MAP_HEIGHT = 1200;
  private readonly MAP_PANEL_SCALE = 2;

  // Snake path configuration
  private readonly CHECKPOINT_SPACING = 220;
  private readonly SNAKE_AMPLITUDE = 180;
  private readonly PATH_Y_CENTER = this.MAP_HEIGHT / 2;

  // Biome containers
  private biomeContainers: Map<number, Phaser.GameObjects.Container> =
    new Map();

  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private resizeHandler?: (
    gameSize: Phaser.Structs.Size,
    baseSize: Phaser.Structs.Size,
    displaySize: Phaser.Structs.Size,
    resolution: number,
  ) => void;

  constructor() {
    super({ key: "WorldMap" });
    this.checkpointNodes = new Map();
    this.persona = null;
    this.bosses = new Map();
    this.miniBosses = new Map();
    this.currentVentureId = null;
    this.boundHandlers = {};
  }

  preload(): void {
    AssetLoader.preloadAssets(this);
    AssetLoader.createAllTextures(this);
  }

  create(): void {
    // Initialize audio
    audioManager.init();

    // Set up world bounds
    this.cameras.main.setBounds(0, 0, this.MAP_WIDTH, this.MAP_HEIGHT);
    this.physics.world.setBounds(0, 0, this.MAP_WIDTH, this.MAP_HEIGHT);

    // Create scene layers
    this.backgroundLayer = this.add.container(0, 0);
    this.midgroundLayer = this.add.container(0, 0);
    this.gameLayer = this.add.container(0, 0);
    this.animationLayer = this.add.container(0, 0);

    this.backgroundLayer.setDepth(0);
    this.midgroundLayer.setDepth(10);
    this.gameLayer.setDepth(20);
    this.animationLayer.setDepth(100);

    // Create brightness filter
    const camera = this.cameras.main;
    this.brightnessFilter = camera.postFX.addColorMatrix();
    AssetLoader.createPersonaAnimations(this);

    // Build world
    this.createBiomeZones();
    this.createTilemap();
    this.createSnakePath();
    this.createBiomeLandmarks();
    this.createSuperBoss();
    this.createMiniBosses();
    this.createAtmosphericEffects();

    this.setupGamepadListeners();

    // Initial selection
    this.updateGamepadSelection();

    // Set up event listeners
    this.setupEventListeners();

    // Apply initial brightness (0%)
    this.updateBrightnessFilter(100);

    // Camera setup with responsive zoom
    this.cameras.main.roundPixels = true;
    this.applyResponsiveCamera(true);
    this.resizeHandler = () => {
      this.applyResponsiveCamera(false);
    };
    this.scale.on("resize", this.resizeHandler);

    // Detect mobile/touch device
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const isMobile = this.scale.width < 768;

    // Enable camera drag with mobile optimization
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      audioManager.unlock();

      // Store initial camera position for drag
      this.registry.set("dragStartX", this.cameras.main.scrollX);
      this.registry.set("dragStartY", this.cameras.main.scrollY);
      this.registry.set("pointerStartX", pointer.x);
      this.registry.set("pointerStartY", pointer.y);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        const dragStartX =
          this.registry.get("dragStartX") || this.cameras.main.scrollX;
        const dragStartY =
          this.registry.get("dragStartY") || this.cameras.main.scrollY;
        const pointerStartX = this.registry.get("pointerStartX") || pointer.x;
        const pointerStartY = this.registry.get("pointerStartY") || pointer.y;

        // Smooth drag with momentum on mobile
        const dragSensitivity = isMobile ? 1.2 : 1.0;
        const deltaX =
          ((pointerStartX - pointer.x) / this.cameras.main.zoom) *
          dragSensitivity;
        const deltaY =
          ((pointerStartY - pointer.y) / this.cameras.main.zoom) *
          dragSensitivity;

        this.cameras.main.scrollX = dragStartX + deltaX;
        this.cameras.main.scrollY = dragStartY + deltaY;
      }
    });

    // Add pinch-to-zoom for mobile
    if (isTouchDevice) {
      let initialDistance = 0;
      let initialZoom = 1;

      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (this.input.pointer2.isDown) {
          const dx = this.input.pointer1.x - this.input.pointer2.x;
          const dy = this.input.pointer1.y - this.input.pointer2.y;
          initialDistance = Math.sqrt(dx * dx + dy * dy);
          initialZoom = this.cameras.main.zoom;
        }
      });

      this.input.on("pointermove", () => {
        if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
          const dx = this.input.pointer1.x - this.input.pointer2.x;
          const dy = this.input.pointer1.y - this.input.pointer2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (initialDistance > 0) {
            const scale = distance / initialDistance;
            const newZoom = Phaser.Math.Clamp(initialZoom * scale, 0.3, 1.5);
            this.cameras.main.setZoom(newZoom);
          }
        }
      });
    }

    // Signal React that Phaser is ready
    eventBridge.dispatchToReact({ type: "PHASER_READY" });

    // FPS monitoring
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        eventBridge.dispatchToReact({
          type: "FPS_UPDATE",
          fps: Math.round(this.game.loop.actualFps),
        });
      },
    });
  }

  private applyResponsiveCamera(initial: boolean): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const aspectRatio = width / height;
    const isPortrait = height > width;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isSmallMobile = width < 480;

    let zoom = 1;

    // Mobile portrait (phones)
    if (isSmallMobile && isPortrait) {
      zoom = 0.38;
    } else if (isMobile && isPortrait) {
      zoom = 0.48;
    }
    // Mobile landscape
    else if (isMobile && !isPortrait) {
      zoom = 0.58;
    }
    // Tablet portrait
    else if (isTablet && isPortrait) {
      zoom = 0.62;
    }
    // Tablet landscape
    else if (isTablet && !isPortrait) {
      zoom = 0.72;
    }
    // Desktop small
    else if (width < 1280) {
      zoom = 0.78;
    }
    // Desktop medium
    else if (width < 1600) {
      zoom = 0.88;
    }
    // Desktop large
    else if (width < 1920) {
      zoom = 0.95;
    }
    // Desktop XL
    else {
      zoom = 1.0;
    }

    // Additional adjustment for very short screens
    if (height < 600) {
      zoom *= 0.88;
    } else if (height < 500) {
      zoom *= 0.82;
    }

    // Adjust for extreme aspect ratios
    if (aspectRatio < 0.6) {
      // Very tall screens
      zoom *= 0.92;
    } else if (aspectRatio > 2.2) {
      // Very wide screens
      zoom *= 1.08;
    }

    this.cameras.main.setZoom(zoom);

    if (initial) {
      this.cameras.main.centerOn(this.BIOME_WIDTH / 2, this.MAP_HEIGHT / 2);
    }

    // Store zoom for UI scaling
    this.registry.set("cameraZoom", zoom);
    this.registry.set("isMobile", isMobile);
    this.registry.set("isTablet", isTablet);
  }

  /**
   * Creates all 8 biome visual zones left to right
   */
  /**
   * Creates the Tiled map and its layers, integrated into the background.
   */
  private createTilemap(): void {
    this.map = this.make.tilemap({ key: "beginning_fields" });

    const tilesetMapping = [
      { name: "Atlas_Buildings", key: "Buildings" },
      { name: "Buildings", key: "House_Hay_1" },
      { name: "Objects_Props", key: "Sign_1" },
      { name: "Objects_Rocks", key: "Rock_Brown_1" },
      { name: "Objects_Trees", key: "Tree_Emerald_1" },
      { name: "Atlas_Props", key: "Props" },
      { name: "Atlas_Rocks", key: "Rocks" },
      { name: "Tileset_Ground", key: "Tileset_Ground" },
      { name: "Tileset_RockSlope", key: "Tileset_RockSlope" },
      { name: "Tileset_RockSlope_Simple", key: "Tileset_RockSlope_Simple" },
      { name: "Tileset_Water", key: "Tileset_Water" },
      { name: "Road", key: "Tileset_Road" },
      { name: "Atlas_Trees_Bushes", key: "Trees_Bushes" },
      { name: "Animation_Flowers_Red", key: "Animation_Flowers_Red" },
      { name: "Animation_Flowers_White", key: "Animation_Flowers_White" },
      { name: "Campfire", key: "Animation_Campfire" },
      { name: "Tileset_Shadow", key: "Tileset_Shadow" },
      { name: "Objects_Shadows", key: "Shadow_Round_16x16_Flat_Black" },
    ];

    const phaserTilesets = tilesetMapping
      .map((tileset) => this.map.addTilesetImage(tileset.name, tileset.key))
      .filter(
        (tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null,
      );

    const scale = this.MAP_PANEL_SCALE;
    const layerNames = [
      "Ground",
      "Flowers",
      "Road",
      "RockSlopes",
      "RockSlopes_Auto",
      "Water",
      "Shadows",
    ];
    const panelWidth = this.map.widthInPixels * scale;
    const panelHeight = this.map.heightInPixels * scale;
    const panelOffsetX = (this.BIOME_WIDTH - panelWidth) / 2;
    const panelOffsetY = this.MAP_HEIGHT - panelHeight + 120;
    const objectLayer = this.map.getObjectLayer("Object Layer 1");

    for (let i = 0; i < BIOME_CONFIGS.length; i++) {
      const biome = BIOME_CONFIGS[i];
      const panelX = i * this.BIOME_WIDTH + panelOffsetX;
      if (biome.visualTheme === "forest") {
        this.createForestTilePanel(panelX, panelOffsetY, scale, biome, i);
        continue;
      }
      if (biome.visualTheme === "arena") {
        this.createArenaTilePanel(panelX, panelOffsetY, scale, biome, i);
        continue;
      }
      if (biome.visualTheme === "artisan") {
        this.createArtisanTilePanel(panelX, panelOffsetY, scale, biome, i);
        continue;
      }
      if (biome.visualTheme === "mine") {
        this.createMineTilePanel(panelX, panelOffsetY, scale, biome, i);
        continue;
      }
      if (biome.visualTheme === "harbour") {
        this.createHarbourTilePanel(panelX, panelOffsetY, scale, biome, i);
        continue;
      }
      if (biome.visualTheme === "crossroads") {
        this.createCrossroadsTilePanel(panelX, panelOffsetY, scale, biome, i);
        continue;
      }
      if (biome.visualTheme === "capital") {
        this.createCapitalTilePanel(panelX, panelOffsetY, scale, biome, i);
        continue;
      }

      layerNames.forEach((name) => {
        const layer = this.map.createLayer(name, phaserTilesets, panelX, 0);
        if (!layer) return;

        layer.setScale(scale);
        layer.setY(panelOffsetY);
        layer.setAlpha(name === "Shadows" ? 0.35 : 1);
        layer.setDepth(name === "Shadows" ? 4 : 3);

        if (name === "Water") {
          layer.setAlpha(0.9);
        }

        this.backgroundLayer.add(layer);
      });

      if (objectLayer) {
        this.renderMapObjects(objectLayer.objects, panelX, panelOffsetY, scale);
      }
    }
  }

  private createForestTilePanel(
    panelX: number,
    panelOffsetY: number,
    scale: number,
    biome: BiomeConfig,
    biomeIndex: number,
  ): void {
    const tileSize = 16 * scale;
    const cols = this.map.width;
    const rows = this.map.height;
    const style =
      biome.id === 2
        ? {
            baseTint: 0xc2ea7b,
            shadeTint: 0x7dbb49,
            canopyTint: 0x21532f,
            mistTint: 0xe9ffd8,
            waterTint: 0x83d7e5,
            pathTint: 0xb78b5a,
            hillTint: 0xffffff,
          }
        : biome.id === 5
          ? {
              baseTint: 0xa5c56d,
              shadeTint: 0x6c8748,
              canopyTint: 0x2f2a22,
              mistTint: 0xf4efd9,
              waterTint: 0x6fb7cb,
              pathTint: 0x9a7a53,
              hillTint: 0xf3efe0,
            }
          : {
              baseTint: 0xb8de7c,
              shadeTint: 0x6d9157,
              canopyTint: 0x39455a,
              mistTint: 0xf2f7fb,
              waterTint: 0x74aeca,
              pathTint: 0xaa7d60,
              hillTint: 0xf6f1e9,
            };
    const grassFrames = [0, 3, 12, 13, 14, 23, 24, 33, 34, 44, 55, 66];
    const grassAccentFrames = [7, 8, 18, 19, 41, 42, 63, 64, 75];
    const hillFrames = [0, 1, 2, 11, 12, 13, 22, 23, 24, 33, 34, 35, 88, 89];
    const waterFrames = [0, 1, 2, 3];
    const pathFrames = [0, 1, 4, 5, 10, 11, 12, 15];
    const fenceFrames = [0, 1, 2, 4, 5, 6, 8, 9, 10];
    const treeFrames = [0, 1, 2, 9];
    const shrubFrames = [27, 28, 29, 30, 31, 32];
    const flowerFrames = [3, 4, 5, 6, 7];
    const groundFrames = [21, 22, 23, 24, 33, 34, 35, 36, 37, 40, 41, 42];
    const plantFrames = [0, 1, 2, 3, 4, 5, 7, 8, 10, 11];
    const bridgeRow = 19 + (biomeIndex % 3);
    const upperPathRow = bridgeRow - 5;
    const lowerPathRow = bridgeRow + 6;
    const treeDepth = 8;
    const detailDepth = 9;

    const riverCenterAtRow = (row: number) =>
      20 +
      Math.sin((row + biomeIndex * 2) / 6.3) * 3.6 +
      Math.cos((row + biomeIndex * 5) / 11.5) * 1.2;

    const riverWidthAtRow = (row: number) =>
      1.15 +
      Math.max(0, 1.2 - Math.abs(row - 12) * 0.12) +
      Math.max(0, 0.95 - Math.abs(row - 29) * 0.16);

    const inEllipse = (
      x: number,
      y: number,
      centerX: number,
      centerY: number,
      radiusX: number,
      radiusY: number,
    ) =>
      ((x - centerX) * (x - centerX)) / (radiusX * radiusX) +
        ((y - centerY) * (y - centerY)) / (radiusY * radiusY) <
      1;

    const addFrameSprite = (
      texture: string,
      frame: number,
      x: number,
      y: number,
      depth: number,
      tint = 0xffffff,
      alpha = 1,
    ) => {
      const tile = this.add.sprite(
        panelX + x * tileSize + tileSize / 2,
        panelOffsetY + y * tileSize + tileSize / 2,
        texture,
        frame,
      );
      tile.setOrigin(0.5);
      tile.setScale(scale);
      tile.setTint(tint);
      tile.setAlpha(alpha);
      tile.setDepth(depth);
      this.backgroundLayer.add(tile);
    };

    const addForestProp = (
      texture: string,
      frame: number,
      x: number,
      y: number,
      propScale: number,
      depth = 8,
      alpha = 1,
    ) => {
      const shadow = this.add.image(
        x + 6,
        y + 10,
        "Shadow_Round_48x24_Flat_Black",
      );
      shadow.setOrigin(0.5, 0.5);
      shadow.setScale(propScale * 0.82);
      shadow.setAlpha(0.18);
      shadow.setDepth(depth - 1);
      this.midgroundLayer.add(shadow);

      const sprite = this.add.sprite(x, y, texture, frame);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(propScale);
      sprite.setAlpha(alpha);
      sprite.setDepth(depth);
      this.midgroundLayer.add(sprite);
    };

    const ground = this.add.graphics();
    ground.fillStyle(style.baseTint, 0.98);
    ground.fillRect(panelX, panelOffsetY, cols * tileSize, rows * tileSize);
    ground.setDepth(1);
    this.backgroundLayer.add(ground);

    for (let row = 0; row < rows; row += 1) {
      const riverCenter = riverCenterAtRow(row);
      const riverHalfWidth = riverWidthAtRow(row);
      const corridorCenter =
        row < bridgeRow
          ? 13 + Math.sin((row + biomeIndex) / 6) * 2.5
          : 27 + Math.cos((row + biomeIndex) / 5) * 2.3;

      for (let col = 0; col < cols; col += 1) {
        const distToMainRiver = Math.abs(col - riverCenter);
        const inWater = riverHalfWidth > 0 && distToMainRiver <= riverHalfWidth;
        const onBank = !inWater && distToMainRiver <= riverHalfWidth + 1.05;
        const onWetBank = !inWater && distToMainRiver <= riverHalfWidth + 1.7;
        const inUpperGlade = inEllipse(col, row, 10.5, 11.5, 6.2, 4.8);
        const inBridgeGlade = inEllipse(
          col,
          row,
          20,
          bridgeRow + 0.5,
          7.4,
          5.6,
        );
        const inLowerGlade = inEllipse(col, row, 29, 29, 7.1, 5.2);
        const inSideGlade = inEllipse(col, row, corridorCenter, row, 4.8, 2.6);
        const inGlade =
          inUpperGlade || inBridgeGlade || inLowerGlade || inSideGlade;
        const inForestMass =
          (col < 8 && row > 5 && row < rows - 4) ||
          (col > cols - 9 && row > 4 && row < rows - 5) ||
          inEllipse(col, row, 8, 14, 5.8, 7.2) ||
          inEllipse(col, row, 31, 22, 6.2, 7.8) ||
          inEllipse(col, row, 14, 27, 5.4, 6.5) ||
          inEllipse(col, row, 27, 10, 5.2, 6.1);
        const inDeepForest = inForestMass && !inGlade;
        const edgeBand = row < 3 || row > rows - 4 || col < 2 || col > cols - 3;

        if (inWater) {
          addFrameSprite(
            "sprout_water_sheet",
            waterFrames[(row + col + biome.id) % waterFrames.length],
            col,
            row,
            3,
            style.waterTint,
          );
          continue;
        }

        if (onBank) {
          addFrameSprite(
            "sprout_grass_sheet",
            grassFrames[(col * 5 + row * 3 + biome.id) % grassFrames.length],
            col,
            row,
            2,
            style.shadeTint,
            0.96,
          );
        } else if (
          inDeepForest ||
          edgeBand ||
          (col + row + biomeIndex) % 4 === 0
        ) {
          addFrameSprite(
            "sprout_grass_sheet",
            grassFrames[(col * 7 + row * 5 + biome.id) % grassFrames.length],
            col,
            row,
            2,
            inDeepForest ? style.shadeTint : 0xffffff,
            inDeepForest ? 0.96 : 0.9,
          );
        }

        if (
          !inGlade &&
          !onWetBank &&
          ((col + row * 2 + biomeIndex) % 9 === 0 || inDeepForest)
        ) {
          addFrameSprite(
            "sprout_grass_sheet",
            grassAccentFrames[
              (col + row + biome.id) % grassAccentFrames.length
            ],
            col,
            row,
            3,
            0xffffff,
            inDeepForest ? 0.72 : 0.84,
          );
        }
        if (
          (row <= 2 || row >= rows - 3) &&
          col > 1 &&
          col < cols - 2 &&
          (col + row + biomeIndex) % 2 === 0
        ) {
          addFrameSprite(
            "sprout_hills_sheet",
            hillFrames[(col + row + biome.id) % hillFrames.length],
            col,
            row,
            4,
            style.hillTint,
          );
        }
      }
    }

    const humidShade = this.add.graphics();
    humidShade.fillStyle(style.canopyTint, 0.06);
    humidShade.fillRect(panelX, panelOffsetY, cols * tileSize, rows * tileSize);
    humidShade.setDepth(1);
    this.backgroundLayer.add(humidShade);

    const canopy = this.add.graphics();
    canopy.fillStyle(style.canopyTint, 0.1);
    canopy.fillEllipse(panelX + 180, panelOffsetY + 122, 360, 108);
    canopy.fillEllipse(panelX + 700, panelOffsetY + 108, 580, 128);
    canopy.fillEllipse(panelX + 1184, panelOffsetY + 150, 330, 108);
    canopy.fillEllipse(panelX + 248, panelOffsetY + 1090, 410, 122);
    canopy.fillEllipse(panelX + 988, panelOffsetY + 1082, 470, 128);
    canopy.setDepth(2);
    this.backgroundLayer.add(canopy);

    const mist = this.add.graphics();
    mist.fillStyle(style.mistTint, 0.05);
    mist.fillEllipse(panelX + 312, panelOffsetY + 506, 250, 56);
    mist.fillEllipse(panelX + 1002, panelOffsetY + 820, 310, 62);
    mist.setDepth(6);
    this.backgroundLayer.add(mist);

    const bridgeCenter = Math.round(riverCenterAtRow(bridgeRow));
    for (let frame = 0; frame < 5; frame += 1) {
      addFrameSprite(
        "sprout_bridge_sheet",
        frame,
        bridgeCenter - 2 + frame,
        bridgeRow,
        6,
      );
    }

    [
      { row: upperPathRow, start: 6, end: bridgeCenter - 3 },
      { row: bridgeRow, start: bridgeCenter - 4, end: bridgeCenter + 4 },
      { row: lowerPathRow, start: bridgeCenter + 3, end: cols - 7 },
    ].forEach(({ row, start, end }, bandIndex) => {
      for (let col = start; col <= end; col += 1) {
        addFrameSprite(
          "sprout_paths_sheet",
          pathFrames[(col + bandIndex * 3 + biome.id) % pathFrames.length],
          col,
          row,
          5,
          style.pathTint,
          0.92,
        );
      }
    });

    [
      { row: upperPathRow - 1, x1: 7, x2: 12 },
      { row: lowerPathRow + 1, x1: cols - 13, x2: cols - 8 },
      { row: bridgeRow + 4, x1: bridgeCenter - 6, x2: bridgeCenter - 2 },
    ].forEach(({ row, x1, x2 }, index) => {
      for (let col = x1; col <= x2; col += 1) {
        addFrameSprite(
          "sprout_fences_sheet",
          fenceFrames[(col + index + biome.id) % fenceFrames.length],
          col,
          row,
          6,
        );
      }
    });

    // Top tree line - evenly spaced, avoiding checkpoints
    for (let i = 0; i < 10; i += 1) {
      const col = 4 + i * 3.6;
      if (col > 18 && col < 22) continue; // Skip checkpoint area
      addForestProp(
        "sprout_forest_decor_sheet",
        treeFrames[i % treeFrames.length],
        panelX + col * tileSize,
        panelOffsetY + 2.8 * tileSize,
        1.48 + (i % 2) * 0.06,
        treeDepth,
        0.96,
      );
    }

    // Bottom tree line - evenly spaced, avoiding checkpoints
    for (let i = 0; i < 10; i += 1) {
      const col = 4 + i * 3.6;
      if (col > 18 && col < 22) continue; // Skip checkpoint area
      addForestProp(
        "sprout_forest_decor_sheet",
        treeFrames[(i + 2) % treeFrames.length],
        panelX + col * tileSize,
        panelOffsetY + (rows - 2.8) * tileSize,
        1.52 + (i % 2) * 0.06,
        treeDepth,
        0.96,
      );
    }

    // Left side trees - vertical arrangement
    for (let i = 0; i < 5; i += 1) {
      const row = 8 + i * 5;
      if (row > bridgeRow - 3 && row < bridgeRow + 3) continue; // Skip bridge area
      addForestProp(
        "sprout_forest_decor_sheet",
        treeFrames[i % treeFrames.length],
        panelX + 2.5 * tileSize,
        panelOffsetY + row * tileSize,
        1.54 + (i % 2) * 0.08,
        treeDepth,
        0.95,
      );
    }

    // Right side trees - vertical arrangement
    for (let i = 0; i < 5; i += 1) {
      const row = 8 + i * 5;
      if (row > bridgeRow - 3 && row < bridgeRow + 3) continue; // Skip bridge area
      addForestProp(
        "sprout_forest_decor_sheet",
        treeFrames[(i + 1) % treeFrames.length],
        panelX + (cols - 2.5) * tileSize,
        panelOffsetY + row * tileSize,
        1.56 + (i % 2) * 0.08,
        treeDepth,
        0.95,
      );
    }

    // Feature trees in clearings - carefully placed
    [
      [8.5, 11.5, 1.72, treeFrames[0]],
      [11.5, 13.2, 1.68, treeFrames[1]],
      [30.5, 11.8, 1.74, treeFrames[2]],
      [33.2, 13.5, 1.7, treeFrames[3]],
      [9.2, 28.5, 1.66, treeFrames[1]],
      [12.5, 30.2, 1.72, treeFrames[0]],
      [29.8, 28.8, 1.68, treeFrames[2]],
      [32.5, 30.5, 1.7, treeFrames[3]],
    ].forEach(([x, y, spriteScale, frame], index) => {
      addForestProp(
        "sprout_forest_decor_sheet",
        frame as number,
        panelX + (x as number) * tileSize,
        panelOffsetY + (y as number) * tileSize,
        spriteScale as number,
        treeDepth - 1,
      );
    });

    // Shrubs and bushes - organized placement around clearings
    [
      [7.5, 10.2, 1.12, shrubFrames[0]],
      [13.5, 10.5, 1.1, shrubFrames[2]],
      [15.5, bridgeRow + 5, 1.08, shrubFrames[4]],
      [25.5, bridgeRow - 4, 1.1, shrubFrames[1]],
      [31.5, 27.5, 1.12, shrubFrames[5]],
      [28.5, 31.2, 1.08, shrubFrames[3]],
      [6.5, 29.5, 1.06, shrubFrames[2]],
      [34.5, 10.8, 1.1, shrubFrames[4]],
    ].forEach(([x, y, spriteScale, frame], index) => {
      addForestProp(
        "sprout_forest_decor_sheet",
        frame as number,
        panelX + (x as number) * tileSize,
        panelOffsetY + (y as number) * tileSize,
        spriteScale as number,
        detailDepth,
      );
    });

    // Rocks - strategic placement
    [
      [6.2, 15.5, 1.08, groundFrames[2]],
      [14.8, 9.2, 1.06, groundFrames[7]],
      [26.5, 32.5, 1.1, groundFrames[5]],
      [35.2, 16.8, 1.08, groundFrames[3]],
    ].forEach(([x, y, spriteScale, frame]) => {
      addForestProp(
        "sprout_forest_decor_sheet",
        frame as number,
        panelX + (x as number) * tileSize,
        panelOffsetY + (y as number) * tileSize,
        spriteScale as number,
        detailDepth,
      );
    });

    // Plants and flowers - organized in clearings, avoiding paths and river
    for (let row = 7; row < rows - 7; row += 2) {
      for (let col = 5; col < cols - 5; col += 3) {
        const distToRiver = Math.abs(col - riverCenterAtRow(row));

        // Define clear zones
        const inUpperClearing = inEllipse(col, row, 10.5, 11.5, 5.5, 4.2);
        const inBridgeClearing = inEllipse(
          col,
          row,
          20,
          bridgeRow + 0.5,
          6.5,
          5.0,
        );
        const inLowerClearing = inEllipse(col, row, 29, 29, 6.0, 4.5);
        const inClearing =
          inUpperClearing || inBridgeClearing || inLowerClearing;

        // Skip river, banks, and paths
        if (distToRiver < 3.5) continue;
        if (Math.abs(row - upperPathRow) < 2) continue;
        if (Math.abs(row - bridgeRow) < 2) continue;
        if (Math.abs(row - lowerPathRow) < 2) continue;

        // Only place in clearings
        if (!inClearing) continue;

        // Varied placement pattern
        if ((col + row + biome.id) % 3 !== 0) continue;

        // Add plants
        addFrameSprite(
          "sprout_plants_sheet",
          plantFrames[(col + row + biome.id) % plantFrames.length],
          col,
          row,
          6,
          0xffffff,
          0.94,
        );

        // Add flowers less frequently
        if ((col + row + biomeIndex) % 5 === 0) {
          addFrameSprite(
            "sprout_forest_decor_sheet",
            flowerFrames[(col + row) % flowerFrames.length],
            col + 0.3,
            row + 0.1,
            7,
            0xffffff,
            0.88,
          );
        }
      }
    }

    // Flower clusters in specific clearings - organized groups
    [
      // Upper clearing cluster
      [9.5, 11.2],
      [10.2, 11.8],
      [11.0, 11.5],
      [10.5, 12.5],
      // Bridge clearing cluster
      [19.5, bridgeRow + 2.5],
      [20.5, bridgeRow + 2.8],
      [21.2, bridgeRow + 2.2],
      // Lower clearing cluster
      [28.5, 28.8],
      [29.5, 29.2],
      [30.2, 28.5],
      [29.8, 30.0],
    ].forEach(([x, y], index) => {
      addFrameSprite(
        "sprout_forest_decor_sheet",
        flowerFrames[index % flowerFrames.length],
        x,
        y,
        7,
        0xffffff,
        0.9,
      );
    });
  }

  private createArenaTilePanel(
    panelX: number,
    panelOffsetY: number,
    scale: number,
    biome: BiomeConfig,
    biomeIndex: number,
  ): void {
    const tileSize = 16 * scale;
    const cols = this.map.width;
    const rows = this.map.height;

    const style = {
      baseTint: 0x991b1b, // Red dirt
      shadeTint: 0x7f1d1d, // Darker red dirt
      pathTint: 0x450a0a, // Very dark path
      hillTint: 0xb91c1c, // Lighter red
    };

    const grassFrames = [0, 3, 12, 13, 14, 23, 24, 33, 34, 44, 55, 66];
    const hillFrames = [0, 1, 2, 11, 12, 13, 22, 23, 24, 33, 34, 35, 88, 89];
    const pathFrames = [0, 1, 4, 5, 10, 11, 12, 15];
    const fenceFrames = [0, 1, 2, 4, 5, 6, 8, 9, 10];

    const addFrameSprite = (
      texture: string,
      frame: number,
      x: number,
      y: number,
      depth: number,
      tint = 0xffffff,
      alpha = 1,
    ) => {
      const tile = this.add.sprite(
        panelX + x * tileSize + tileSize / 2,
        panelOffsetY + y * tileSize + tileSize / 2,
        texture,
        frame,
      );
      tile.setOrigin(0.5);
      tile.setScale(scale);
      tile.setTint(tint);
      tile.setAlpha(alpha);
      tile.setDepth(depth);
      this.backgroundLayer.add(tile);
    };

    const addProp = (
      texture: string,
      x: number,
      y: number,
      depth: number,
      tint = 0xffffff,
      spriteScale = 1,
    ) => {
      if (this.textures.exists(texture)) {
        const sprite = this.add.sprite(
          panelX + x * tileSize,
          panelOffsetY + y * tileSize,
          texture,
        );
        sprite.setOrigin(0.5, 1);
        sprite.setScale(scale * spriteScale);
        sprite.setTint(tint);
        sprite.setDepth(depth);
        this.midgroundLayer.add(sprite);
      }
    };

    // Base Ground
    const ground = this.add.graphics();
    ground.fillStyle(style.baseTint, 0.95);
    ground.fillRect(panelX, panelOffsetY, cols * tileSize, rows * tileSize);
    ground.setDepth(1);
    this.backgroundLayer.add(ground);

    const arenaCenterX = 20;
    const arenaCenterY = 20;
    const arenaRadius = 8;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const distToCenter = Math.sqrt(
          Math.pow(col - arenaCenterX, 2) + Math.pow(row - arenaCenterY, 2),
        );

        // Ground tiles
        if (distToCenter > arenaRadius + 2) {
          addFrameSprite(
            "sprout_grass_sheet",
            grassFrames[(col * 7 + row * 5 + biome.id) % grassFrames.length],
            col,
            row,
            2,
            style.shadeTint,
            0.9,
          );
        } else if (distToCenter <= arenaRadius) {
          addFrameSprite(
            "sprout_grass_sheet",
            grassFrames[(col * 3 + row * 2 + biome.id) % grassFrames.length],
            col,
            row,
            2,
            style.pathTint,
            0.7,
          );
        }

        // Arena Boundaries (Hills/Rocks)
        if (Math.abs(distToCenter - arenaRadius - 1) < 1) {
          if ((col + row) % 2 === 0) {
            addFrameSprite(
              "sprout_hills_sheet",
              hillFrames[(col + row) % hillFrames.length],
              col,
              row,
              4,
              style.hillTint,
            );
          }
        }

        // Horizontal Path
        if (Math.abs(row - arenaCenterY) < 2 && distToCenter > arenaRadius) {
          addFrameSprite(
            "sprout_paths_sheet",
            pathFrames[(col + row) % pathFrames.length],
            col,
            row,
            3,
            style.pathTint,
            0.9,
          );
        }
      }
    }

    // Add props
    addProp(
      "Banner_Stick_1_Purple",
      arenaCenterX - 5,
      arenaCenterY - 5,
      8,
      0xffffff,
      1.5,
    );
    addProp(
      "Banner_Stick_1_Purple",
      arenaCenterX + 5,
      arenaCenterY - 5,
      8,
      0xffffff,
      1.5,
    );
    addProp("Fireplace_1", arenaCenterX, arenaCenterY, 7, 0xffffff, 1.5);
    addProp("Rock_Brown_4", arenaCenterX - 7, arenaCenterY + 4, 8, 0x7f1d1d, 1);
    addProp("Rock_Brown_6", arenaCenterX + 7, arenaCenterY + 4, 8, 0x7f1d1d, 1);
  }

  private createArtisanTilePanel(
    panelX: number,
    panelOffsetY: number,
    scale: number,
    biome: BiomeConfig,
    biomeIndex: number,
  ): void {
    const tileSize = 16 * scale;
    const cols = this.map.width;
    const rows = this.map.height;

    const style = {
      baseTint: 0x4338ca, // Indigo base
      shadeTint: 0x312e81, // Dark Indigo
      pathTint: 0x1e1b4b, // Deepest Indigo for paths
      hillTint: 0x6366f1, // Light Indigo
    };

    const grassFrames = [0, 3, 12, 13, 14, 23, 24, 33, 34, 44, 55, 66];
    const pathFrames = [0, 1, 4, 5, 10, 11, 12, 15];

    const addFrameSprite = (
      texture: string,
      frame: number,
      x: number,
      y: number,
      depth: number,
      tint = 0xffffff,
      alpha = 1,
    ) => {
      const tile = this.add.sprite(
        panelX + x * tileSize + tileSize / 2,
        panelOffsetY + y * tileSize + tileSize / 2,
        texture,
        frame,
      );
      tile.setOrigin(0.5);
      tile.setScale(scale);
      tile.setTint(tint);
      tile.setAlpha(alpha);
      tile.setDepth(depth);
      this.backgroundLayer.add(tile);
    };

    const addProp = (
      texture: string,
      x: number,
      y: number,
      depth: number,
      tint = 0xffffff,
      spriteScale = 1,
    ) => {
      if (this.textures.exists(texture)) {
        const sprite = this.add.sprite(
          panelX + x * tileSize,
          panelOffsetY + y * tileSize,
          texture,
        );
        sprite.setOrigin(0.5, 1);
        sprite.setScale(scale * spriteScale);
        sprite.setTint(tint);
        sprite.setDepth(depth);
        this.midgroundLayer.add(sprite);
      }
    };

    // Base Ground
    const ground = this.add.graphics();
    ground.fillStyle(style.baseTint, 0.95);
    ground.fillRect(panelX, panelOffsetY, cols * tileSize, rows * tileSize);
    ground.setDepth(1);
    this.backgroundLayer.add(ground);

    // City grid pattern
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isRoad =
          row % 10 === 0 || row % 10 === 1 || col % 10 === 0 || col % 10 === 1;

        if (isRoad) {
          addFrameSprite(
            "sprout_paths_sheet",
            pathFrames[(col + row) % pathFrames.length],
            col,
            row,
            3,
            style.pathTint,
            0.9,
          );
        } else {
          addFrameSprite(
            "sprout_grass_sheet",
            grassFrames[(col * 7 + row * 5 + biome.id) % grassFrames.length],
            col,
            row,
            2,
            style.shadeTint,
            0.8,
          );
        }
      }
    }

    // Add Artisan City Props
    addProp("House_Hay_1", 15, 15, 8, 0x818cf8, 1);
    addProp("House_Hay_2", 25, 15, 8, 0x818cf8, 1);
    addProp("House_Hay_3", 15, 25, 8, 0x818cf8, 1);
    addProp("House_Hay_4_Purple", 25, 25, 8, 0x818cf8, 1);

    addProp("Well_Hay_1", 20, 20, 8, 0xffffff, 1);
    addProp("Bench_1", 18, 22, 8, 0xffffff, 1);
    addProp("LampPost_3", 16, 18, 8, 0xffffff, 1);
    addProp("LampPost_3", 24, 18, 8, 0xffffff, 1);
    addProp("Crate_Medium_Closed", 13, 17, 8, 0xffffff, 1);
    addProp("Table_Medium_1", 22, 27, 8, 0xffffff, 1);
  }

  private createMineTilePanel(
    panelX: number,
    panelOffsetY: number,
    scale: number,
    biome: BiomeConfig,
    biomeIndex: number,
  ): void {
    const tileSize = 16 * scale;
    const cols = this.map.width;
    const rows = this.map.height;

    const style = {
      baseTint: 0x18181b,
      shadeTint: 0x09090b,
      pathTint: 0x27272a,
      hillTint: 0x3f3f46,
    };
    const ground = this.add.graphics();
    ground.fillStyle(style.baseTint, 0.98);
    ground.fillRect(panelX, panelOffsetY, cols * tileSize, rows * tileSize);
    ground.setDepth(1);
    this.backgroundLayer.add(ground);

    const rockFrames = [0, 1, 2, 11, 12, 13, 22, 23, 24];
    const pathFrames = [0, 1, 4, 5, 10, 11, 12, 15];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isPath = (row > 15 && row < 19) || (col > 15 && col < 19);
        const isWall = col < 4 || col > cols - 5 || row < 4 || row > rows - 5;

        if (isPath) {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_paths_sheet",
            pathFrames[(col + row) % pathFrames.length],
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.pathTint);
          tile.setDepth(3);
          this.backgroundLayer.add(tile);
        } else if (isWall) {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_hills_sheet",
            rockFrames[(col + row) % rockFrames.length],
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.hillTint);
          tile.setDepth(4);
          this.backgroundLayer.add(tile);
        } else {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_grass_sheet",
            0,
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.shadeTint);
          tile.setDepth(2);
          this.backgroundLayer.add(tile);
        }
      }
    }
  }

  private createHarbourTilePanel(
    panelX: number,
    panelOffsetY: number,
    scale: number,
    biome: BiomeConfig,
    biomeIndex: number,
  ): void {
    const tileSize = 16 * scale;
    const cols = this.map.width;
    const rows = this.map.height;

    const style = {
      baseTint: 0x0284c7,
      shadeTint: 0x0369a1,
      dockTint: 0x78350f,
      landTint: 0xfde047,
    };
    const ground = this.add.graphics();
    ground.fillStyle(style.baseTint, 0.98);
    ground.fillRect(panelX, panelOffsetY, cols * tileSize, rows * tileSize);
    ground.setDepth(1);
    this.backgroundLayer.add(ground);

    const waterFrames = [0, 1, 2, 3];
    const pathFrames = [0, 1, 4, 5];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isLand = row < 12;
        const isDock = col > 15 && col < 20 && row >= 12 && row < 25;

        if (isLand) {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_grass_sheet",
            0,
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.landTint);
          tile.setDepth(2);
          this.backgroundLayer.add(tile);
        } else if (isDock) {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_paths_sheet",
            pathFrames[(col + row) % pathFrames.length],
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.dockTint);
          tile.setDepth(4);
          this.backgroundLayer.add(tile);
        } else {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_water_sheet",
            waterFrames[(col + row) % waterFrames.length],
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setDepth(3);
          this.backgroundLayer.add(tile);
        }
      }
    }
  }

  private createCrossroadsTilePanel(
    panelX: number,
    panelOffsetY: number,
    scale: number,
    biome: BiomeConfig,
    biomeIndex: number,
  ): void {
    const tileSize = 16 * scale;
    const cols = this.map.width;
    const rows = this.map.height;

    const style = {
      baseTint: 0x047857,
      shadeTint: 0x065f46,
      pathTint: 0xd97706,
    };
    const ground = this.add.graphics();
    ground.fillStyle(style.baseTint, 0.98);
    ground.fillRect(panelX, panelOffsetY, cols * tileSize, rows * tileSize);
    ground.setDepth(1);
    this.backgroundLayer.add(ground);

    const pathFrames = [0, 1, 4, 5, 10, 11, 12, 15];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isPath =
          Math.abs(col - row) < 3 || Math.abs(col - (cols - row)) < 3;

        if (isPath) {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_paths_sheet",
            pathFrames[(col + row) % pathFrames.length],
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.pathTint);
          tile.setDepth(3);
          this.backgroundLayer.add(tile);
        } else {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_grass_sheet",
            0,
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.shadeTint);
          tile.setDepth(2);
          this.backgroundLayer.add(tile);
        }
      }
    }
  }

  private createCapitalTilePanel(
    panelX: number,
    panelOffsetY: number,
    scale: number,
    biome: BiomeConfig,
    biomeIndex: number,
  ): void {
    const tileSize = 16 * scale;
    const cols = this.map.width;
    const rows = this.map.height;

    const style = {
      baseTint: 0xfef08a,
      shadeTint: 0xfde047,
      pathTint: 0xffffff,
      wallTint: 0xeab308,
    };
    const ground = this.add.graphics();
    ground.fillStyle(style.baseTint, 0.98);
    ground.fillRect(panelX, panelOffsetY, cols * tileSize, rows * tileSize);
    ground.setDepth(1);
    this.backgroundLayer.add(ground);

    const pathFrames = [0, 1, 4, 5, 10, 11, 12, 15];
    const hillFrames = [0, 1, 2, 11, 12, 13, 22, 23, 24];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isPath = row > 16 && row < 22;
        const isWall = row === 12 || row === 26;

        if (isPath) {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_paths_sheet",
            pathFrames[(col + row) % pathFrames.length],
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.pathTint);
          tile.setDepth(3);
          this.backgroundLayer.add(tile);
        } else if (isWall) {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_hills_sheet",
            hillFrames[(col + row) % hillFrames.length],
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.wallTint);
          tile.setDepth(4);
          this.backgroundLayer.add(tile);
        } else {
          const tile = this.add.sprite(
            panelX + col * tileSize + tileSize / 2,
            panelOffsetY + row * tileSize + tileSize / 2,
            "sprout_grass_sheet",
            0,
          );
          tile.setOrigin(0.5);
          tile.setScale(scale);
          tile.setTint(style.shadeTint);
          tile.setDepth(2);
          this.backgroundLayer.add(tile);
        }
      }
    }
  }

  private renderMapObjects(
    objects: Phaser.Types.Tilemaps.TiledObject[],
    panelX: number,
    panelOffsetY: number,
    scale: number,
  ): void {
    objects.forEach((obj) => {
      if (!obj.visible || typeof obj.gid !== "number") return;

      const assetKey = this.resolveObjectAssetKey(obj.gid);
      if (!assetKey || !this.textures.exists(assetKey)) return;

      const textureSource = this.textures.get(assetKey).getSourceImage() as {
        width?: number;
        height?: number;
      };
      const textureWidth = textureSource.width ?? obj.width ?? 1;
      const textureHeight = textureSource.height ?? obj.height ?? 1;
      const objectX = obj.x ?? 0;
      const objectY = obj.y ?? 0;

      const image = this.add.image(
        panelX + objectX * scale,
        panelOffsetY + objectY * scale,
        assetKey,
      );
      image.setOrigin(0, 1);
      image.setScale(
        ((obj.width ?? textureWidth) / textureWidth) * scale,
        ((obj.height ?? textureHeight) / textureHeight) * scale,
      );
      image.setAlpha(assetKey.startsWith("Shadow_") ? 0.32 : 1);
      image.setDepth(assetKey.startsWith("Shadow_") ? 5 : 6 + objectY * 0.01);
      this.midgroundLayer.add(image);
    });
  }

  private resolveObjectAssetKey(gid: number): string | null {
    const collections = [
      {
        firstGid: 477,
        keys: [
          "House_Hay_1",
          "House_Hay_2",
          "House_Hay_3",
          "House_Hay_4_Purple",
          "CityWall_Gate_1",
          "Well_Hay_1",
        ],
      },
      {
        firstGid: 484,
        keys: [
          "Bench_1",
          "Bench_3",
          "BulletinBoard_1",
          "Chopped_Tree_1",
          "Crate_Large_Empty",
          "Crate_Medium_Closed",
          "LampPost_3",
          "Plant_2",
          "Sack_3",
          "Sign_1",
          "Sign_2",
          "Banner_Stick_1_Purple",
          "Crate_Water_1",
          "Fireplace_1",
          "HayStack_2",
          "Barrel_Small_Empty",
          "Basket_Empty",
          "Table_Medium_1",
        ],
      },
      {
        firstGid: 502,
        keys: [
          "Rock_Brown_1",
          "Rock_Brown_2",
          "Rock_Brown_4",
          "Rock_Brown_6",
          "Rock_Brown_9",
        ],
      },
      {
        firstGid: 507,
        keys: [
          "Bush_Emerald_1",
          "Bush_Emerald_2",
          "Bush_Emerald_3",
          "Bush_Emerald_4",
          "Bush_Emerald_5",
          "Bush_Emerald_6",
          "Bush_Emerald_7",
          "Tree_Emerald_1",
          "Tree_Emerald_2",
          "Tree_Emerald_3",
          "Tree_Emerald_4",
        ],
      },
    ];

    for (const collection of collections) {
      const index = gid - collection.firstGid;
      if (index >= 0 && index < collection.keys.length) {
        return collection.keys[index];
      }
    }

    return null;
  }

  private createBiomeZones(): void {
    BIOME_CONFIGS.forEach((biome, index) => {
      const container = this.add.container(index * this.BIOME_WIDTH, 0);
      this.biomeContainers.set(biome.id, container);
      this.backgroundLayer.add(container);

      // Draw biome background
      this.drawBiomeBackground(container, biome);

      // Add biome label
      this.addBiomeLabel(container, biome);
    });
  }

  /**
   * Draws premium background for a biome zone with gradients and depth
   */
  private drawBiomeBackground(
    container: Phaser.GameObjects.Container,
    biome: BiomeConfig,
  ): void {
    const sky = this.add.graphics();
    sky.fillStyle(biome.colors.sky, 0.78);
    sky.fillRect(0, 0, this.BIOME_WIDTH, this.MAP_HEIGHT);
    sky.fillStyle(biome.colors.ground, 0.24);
    sky.fillEllipse(
      this.BIOME_WIDTH / 2,
      this.MAP_HEIGHT * 0.84,
      this.BIOME_WIDTH * 1.1,
      this.MAP_HEIGHT * 0.7,
    );
    container.add(sky);

    const glow = this.add.graphics();
    glow.fillStyle(biome.colors.accent2, 0.1);
    glow.fillCircle(this.BIOME_WIDTH * 0.22, 170, 150);
    glow.fillCircle(this.BIOME_WIDTH * 0.78, 235, 120);
    container.add(glow);
  }

  private addBiomeDecorations(
    container: Phaser.GameObjects.Container,
    biome: BiomeConfig,
  ): void {
    const addShadowedImage = (
      key: string,
      x: number,
      y: number,
      scale: number,
      alpha = 1,
    ) => {
      const shadow = this.add.image(
        x + 6,
        y + 16,
        "Shadow_Round_48x24_Flat_Black",
      );
      shadow.setOrigin(0.5, 0.5);
      shadow.setScale(scale * 0.9);
      shadow.setAlpha(0.2);
      container.add(shadow);

      const image = this.add.image(x, y, key);
      image.setOrigin(0.5, 1);
      image.setScale(scale);
      image.setAlpha(alpha);
      container.add(image);
    };

    const treeKeys = [
      "Tree_Emerald_1",
      "Tree_Emerald_2",
      "Tree_Emerald_3",
      "Tree_Emerald_4",
    ];

    [
      [160, 760, 1.4],
      [320, 700, 1.08],
      [1080, 725, 1.28],
      [1230, 675, 1.04],
    ].forEach(([x, y, scale], index) => {
      addShadowedImage(
        treeKeys[(biome.id + index) % treeKeys.length],
        x,
        y,
        scale,
        biome.visualTheme === "forest" ? 1 : 0.88,
      );
    });

    [
      ["Bush_Emerald_1", 240, 875, 0.8],
      ["Bush_Emerald_3", 540, 850, 0.85],
      ["Bush_Emerald_5", 840, 872, 0.8],
      ["Bush_Emerald_7", 1120, 856, 0.9],
    ].forEach(([key, x, y, scale]) => {
      addShadowedImage(
        key as string,
        x as number,
        y as number,
        scale as number,
      );
    });

    if (biome.visualTheme === "village") {
      addShadowedImage("House_Hay_1", 500, 648, 1.45);
      addShadowedImage("House_Hay_3", 760, 620, 1.42);
      addShadowedImage("Well_Hay_1", 920, 680, 1.08);
      addShadowedImage("LampPost_3", 665, 708, 1.08);
      addShadowedImage("BulletinBoard_1", 610, 742, 1);
      addShadowedImage("HayStack_2", 855, 770, 1);
    } else {
      addShadowedImage("Rock_Brown_1", 515, 808, 1.08);
      addShadowedImage("Rock_Brown_4", 690, 770, 1.03);
      addShadowedImage("Rock_Brown_9", 875, 810, 1.04);
      addShadowedImage("Animation_Campfire", 755, 748, 0.9);
      addShadowedImage("Sign_2", 955, 742, 1);

      const mist = this.add.graphics();
      mist.fillStyle(0xffffff, 0.06);
      mist.fillEllipse(this.BIOME_WIDTH / 2, 830, 760, 180);
      mist.fillEllipse(this.BIOME_WIDTH / 2 + 180, 780, 480, 130);
      container.add(mist);
    }
  }
  private addBiomeLabel(
    container: Phaser.GameObjects.Container,
    biome: BiomeConfig,
  ): void {
    const label = this.add.text(this.BIOME_WIDTH / 2, 64, biome.name, {
      fontFamily: "Georgia, serif",
      fontSize: "26px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    });
    label.setOrigin(0.5);
    container.add(label);

    const themeLabel = this.add.text(
      this.BIOME_WIDTH / 2,
      98,
      `(${biome.theme})`,
      {
        fontFamily: "Georgia, serif",
        fontSize: "16px",
        fontStyle: "italic",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      },
    );
    themeLabel.setOrigin(0.5);
    container.add(themeLabel);
  }

  private createBiomeLandmarks(): void {
    this.createVillageLandmarks(1); // Stage 1: The Village ✅
    this.createForestLandmarks(2); // Stage 2: The Forest ✅
    this.createArenaLandmarks(3); // Stage 3: The Arena
    this.createArtisanLandmarks(4); // Stage 4: The Artisan's Quarter
    this.createMineLandmarks(5); // Stage 5: The Mine
    this.createHarbourLandmarks(6); // Stage 6: The Harbour
    this.createCrossroadsLandmarks(7); // Stage 7: The Crossroads Town
    this.createCapitalLandmarks(8); // Stage 8: The Capital
  }

  private getStageNodes(stageId: number): CheckpointNode[] {
    return Array.from(this.checkpointNodes.values())
      .filter((node) => node.stage === stageId)
      .sort((a, b) => a.globalIndex - b.globalIndex);
  }

  private addLandmarkSprite(
    key: string,
    x: number,
    y: number,
    scale: number,
    alpha = 1,
  ): void {
    const shadow = this.add.image(
      x + 8,
      y + 14,
      "Shadow_Round_48x24_Flat_Black",
    );
    shadow.setOrigin(0.5, 0.5);
    shadow.setScale(scale * 0.92);
    shadow.setAlpha(0.22);
    this.midgroundLayer.add(shadow);

    const sprite = this.add.image(x, y, key);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale);
    sprite.setAlpha(alpha);
    this.midgroundLayer.add(sprite);
  }

  private addForestLandmarkSprite(
    frame: number,
    x: number,
    y: number,
    scale: number,
    alpha = 1,
    depth = 15,
  ): void {
    const shadow = this.add.image(
      x + 6,
      y + 10,
      "Shadow_Round_48x24_Flat_Black",
    );
    shadow.setOrigin(0.5, 0.5);
    shadow.setScale(scale * 0.7);
    shadow.setAlpha(0.16);
    shadow.setDepth(depth - 1);
    this.midgroundLayer.add(shadow);

    const sprite = this.add.sprite(x, y, "sprout_forest_decor_sheet", frame);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale);
    sprite.setAlpha(alpha);
    sprite.setDepth(depth);
    this.midgroundLayer.add(sprite);
  }

  private createVillageLandmarks(stageId: number): void {
    const nodes = this.getStageNodes(stageId);
    if (nodes.length === 0) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const centerX = (first.x + last.x) / 2;
    const centerY = (first.y + last.y) / 2;

    this.addLandmarkSprite("House_Hay_1", centerX - 150, centerY + 150, 1.55);
    this.addLandmarkSprite("House_Hay_3", centerX + 110, centerY + 115, 1.45);
    this.addLandmarkSprite("Well_Hay_1", centerX + 250, centerY + 155, 1.05);
    this.addLandmarkSprite("BulletinBoard_1", centerX - 20, centerY + 185, 1);
    this.addLandmarkSprite("LampPost_3", centerX + 25, centerY + 165, 1.05);
    this.addLandmarkSprite("HayStack_2", centerX + 175, centerY + 205, 1);

    nodes.forEach((node, index) => {
      const bushKey = `Bush_Emerald_${(index % 4) * 2 + 1}`;
      this.addLandmarkSprite(bushKey, node.x - 70, node.y + 135, 0.82, 0.95);
      this.addLandmarkSprite(bushKey, node.x + 76, node.y + 128, 0.76, 0.9);
    });
  }

  private createForestLandmarks(stageId: number): void {
    const nodes = this.getStageNodes(stageId);
    if (nodes.length === 0) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const centerX = (first.x + last.x) / 2;
    const centerY = (first.y + last.y) / 2;

    this.addForestLandmarkSprite(2, first.x - 130, first.y + 128, 2.1, 0.96);
    this.addForestLandmarkSprite(0, centerX - 160, centerY + 144, 2.2, 0.94);
    this.addForestLandmarkSprite(9, centerX + 170, centerY + 138, 2.05, 0.94);
    this.addForestLandmarkSprite(21, centerX - 56, centerY + 204, 1.7);
    this.addForestLandmarkSprite(24, centerX + 82, centerY + 196, 1.75);
    this.addForestLandmarkSprite(28, centerX + 18, centerY + 176, 1.48);

    nodes.forEach((node, index) => {
      this.addForestLandmarkSprite(index % 3, node.x - 118, node.y + 130, 1.96);
      this.addForestLandmarkSprite(
        (index % 3) + 1,
        node.x + 118,
        node.y + 120,
        1.84,
        0.96,
      );
      this.addForestLandmarkSprite(
        27 + (index % 6),
        node.x + (index % 2 === 0 ? 52 : -48),
        node.y + 138,
        1.32,
        0.92,
      );
    });
  }

  private createArenaLandmarks(stageId: number): void {
    const nodes = this.getStageNodes(stageId);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const centerX = (first.x + last.x) / 2;
    const centerY = (first.y + last.y) / 2;

    // Arena banners and battle props
    this.addLandmarkSprite(
      "Banner_Stick_1_Purple",
      centerX - 180,
      centerY + 120,
      1.6,
    );
    this.addLandmarkSprite(
      "Banner_Stick_1_Purple",
      centerX + 160,
      centerY + 110,
      1.5,
    );
    this.addLandmarkSprite("Fireplace_1", centerX, centerY + 160, 1.2);
    this.addLandmarkSprite("Rock_Brown_4", centerX - 80, centerY + 200, 1.1);
    this.addLandmarkSprite("Rock_Brown_6", centerX + 90, centerY + 195, 1.0);
    this.addLandmarkSprite("Rock_Brown_9", centerX + 220, centerY + 170, 0.9);

    nodes.forEach((node, index) => {
      this.addLandmarkSprite("Rock_Brown_4", node.x - 60, node.y + 130, 0.85);
      this.addLandmarkSprite("Rock_Brown_6", node.x + 65, node.y + 125, 0.78);
    });
  }

  private createArtisanLandmarks(stageId: number): void {
    const nodes = this.getStageNodes(stageId);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const centerX = (first.x + last.x) / 2;
    const centerY = (first.y + last.y) / 2;

    // Artisan quarter buildings and workshop props
    this.addLandmarkSprite(
      "House_Hay_4_Purple",
      centerX - 160,
      centerY + 130,
      1.5,
    );
    this.addLandmarkSprite("House_Hay_2", centerX + 130, centerY + 115, 1.4);
    this.addLandmarkSprite("Well_Hay_1", centerX + 270, centerY + 155, 1.0);
    this.addLandmarkSprite("LampPost_3", centerX - 30, centerY + 165, 1.1);
    this.addLandmarkSprite("LampPost_3", centerX + 30, centerY + 165, 1.1);
    this.addLandmarkSprite(
      "Crate_Medium_Closed",
      centerX - 120,
      centerY + 200,
      1.0,
    );
    this.addLandmarkSprite("Bench_1", centerX + 60, centerY + 185, 1.0);

    nodes.forEach((node, index) => {
      const lampOffset = index % 2 === 0 ? -70 : 72;
      this.addLandmarkSprite(
        "LampPost_3",
        node.x + lampOffset,
        node.y + 130,
        0.9,
        0.9,
      );
    });
  }

  private createMineLandmarks(stageId: number): void {
    const nodes = this.getStageNodes(stageId);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const centerX = (first.x + last.x) / 2;
    const centerY = (first.y + last.y) / 2;

    // Mine entrance and mining props (rocks + campfire for lanterns)
    this.addLandmarkSprite("Rock_Brown_9", centerX - 170, centerY + 110, 1.7);
    this.addLandmarkSprite("Rock_Brown_6", centerX + 150, centerY + 105, 1.6);
    this.addLandmarkSprite("Rock_Brown_4", centerX - 60, centerY + 170, 1.3);
    this.addLandmarkSprite("Rock_Brown_1", centerX + 80, centerY + 175, 1.2);
    this.addLandmarkSprite("Fireplace_1", centerX, centerY + 155, 1.0);
    this.addLandmarkSprite("HayStack_2", centerX - 230, centerY + 155, 1.0);
    this.addLandmarkSprite(
      "Crate_Medium_Closed",
      centerX + 210,
      centerY + 160,
      1.0,
    );

    nodes.forEach((node) => {
      this.addLandmarkSprite("Rock_Brown_1", node.x - 55, node.y + 130, 0.9);
      this.addLandmarkSprite("Rock_Brown_4", node.x + 60, node.y + 125, 0.85);
    });
  }

  private createHarbourLandmarks(stageId: number): void {
    const nodes = this.getStageNodes(stageId);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const centerX = (first.x + last.x) / 2;
    const centerY = (first.y + last.y) / 2;

    // Harbour dock props — barrels, crates, signs
    this.addLandmarkSprite("HayStack_2", centerX - 180, centerY + 130, 1.2);
    this.addLandmarkSprite(
      "Crate_Medium_Closed",
      centerX - 100,
      centerY + 155,
      1.1,
    );
    this.addLandmarkSprite(
      "Crate_Medium_Closed",
      centerX - 80,
      centerY + 145,
      1.0,
    );
    this.addLandmarkSprite("Sign_2", centerX + 20, centerY + 165, 1.2);
    this.addLandmarkSprite("LampPost_3", centerX + 140, centerY + 155, 1.1);
    this.addLandmarkSprite("Rock_Brown_1", centerX + 240, centerY + 160, 1.0);
    this.addLandmarkSprite(
      "BulletinBoard_1",
      centerX - 240,
      centerY + 165,
      1.0,
    );

    nodes.forEach((node, index) => {
      this.addLandmarkSprite(
        "Crate_Medium_Closed",
        node.x - 55,
        node.y + 135,
        0.85,
      );
      if (index % 2 === 0) {
        this.addLandmarkSprite(
          "LampPost_3",
          node.x + 70,
          node.y + 128,
          0.9,
          0.9,
        );
      }
    });
  }

  private createCrossroadsLandmarks(stageId: number): void {
    const nodes = this.getStageNodes(stageId);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const centerX = (first.x + last.x) / 2;
    const centerY = (first.y + last.y) / 2;

    // Crossroads market props — signs, benches, bulletin boards
    this.addLandmarkSprite("Sign_2", centerX - 20, centerY + 155, 1.3);
    this.addLandmarkSprite("Sign_2", centerX + 50, centerY + 150, 1.2);
    this.addLandmarkSprite(
      "BulletinBoard_1",
      centerX - 160,
      centerY + 145,
      1.2,
    );
    this.addLandmarkSprite("Bench_1", centerX + 160, centerY + 158, 1.1);
    this.addLandmarkSprite("Bench_1", centerX + 200, centerY + 155, 1.1);
    this.addLandmarkSprite("Well_Hay_1", centerX - 240, centerY + 155, 1.0);
    this.addLandmarkSprite("LampPost_3", centerX - 100, centerY + 160, 1.1);
    this.addLandmarkSprite("LampPost_3", centerX + 100, centerY + 160, 1.1);

    nodes.forEach((node) => {
      this.addLandmarkSprite(
        "BulletinBoard_1",
        node.x - 68,
        node.y + 132,
        0.85,
        0.9,
      );
    });
  }

  private createCapitalLandmarks(stageId: number): void {
    const nodes = this.getStageNodes(stageId);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const centerX = (first.x + last.x) / 2;
    const centerY = (first.y + last.y) / 2;

    // Capital city grand architecture — gates, walls, grand buildings
    this.addLandmarkSprite("CityWall_Gate_1", centerX, centerY + 100, 1.8);
    this.addLandmarkSprite("House_Hay_1", centerX - 200, centerY + 125, 1.6);
    this.addLandmarkSprite("House_Hay_3", centerX + 180, centerY + 120, 1.55);
    this.addLandmarkSprite("LampPost_3", centerX - 80, centerY + 165, 1.3);
    this.addLandmarkSprite("LampPost_3", centerX + 80, centerY + 165, 1.3);
    this.addLandmarkSprite("LampPost_3", centerX - 250, centerY + 158, 1.1);
    this.addLandmarkSprite("LampPost_3", centerX + 250, centerY + 158, 1.1);
    this.addLandmarkSprite("Well_Hay_1", centerX - 330, centerY + 160, 1.0);
    this.addLandmarkSprite(
      "BulletinBoard_1",
      centerX + 310,
      centerY + 165,
      1.0,
    );

    nodes.forEach((node, index) => {
      this.addLandmarkSprite(
        "LampPost_3",
        node.x - 72,
        node.y + 128,
        1.0,
        0.95,
      );
      this.addLandmarkSprite(
        "LampPost_3",
        node.x + 76,
        node.y + 122,
        0.95,
        0.92,
      );
    });
  }

  /**
   * Creates atmospheric particles and ambient effects for premium feel
   */
  private createAtmosphericEffects(): void {
    // Floating dust motes across the map
    const dustParticles = this.add.particles(0, 0, "white", {
      x: { min: 0, max: this.MAP_WIDTH },
      y: { min: 0, max: this.MAP_HEIGHT * 0.7 },
      speedX: { min: -10, max: 10 },
      speedY: { min: -20, max: -5 },
      scale: { start: 0.1, end: 0 },
      alpha: { start: 0.3, end: 0 },
      lifespan: 4000,
      frequency: 200,
      blendMode: "ADD",
      tint: 0xffffff,
    });
    this.backgroundLayer.add(dustParticles);

    // Light rays from top (god rays effect)
    for (let i = 0; i < 8; i++) {
      const rayX = (i * this.MAP_WIDTH) / 8 + Math.random() * 200;
      const rayGraphics = this.add.graphics();
      rayGraphics.fillStyle(0xffffff, 0.08);
      rayGraphics.fillTriangle(
        rayX,
        0,
        rayX - 30,
        this.MAP_HEIGHT * 0.5,
        rayX + 30,
        this.MAP_HEIGHT * 0.5,
      );
      this.backgroundLayer.add(rayGraphics);

      // Animate light rays slowly
      this.tweens.add({
        targets: rayGraphics,
        alpha: { from: 0.08, to: 0.15 },
        duration: 3000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Ambient glow orbs floating in background
    for (let i = 0; i < 12; i++) {
      const orbX = Math.random() * this.MAP_WIDTH;
      const orbY = Math.random() * (this.MAP_HEIGHT * 0.6);
      const orb = this.add.circle(orbX, orbY, 3, 0x6366f1, 0.4);
      this.backgroundLayer.add(orb);

      // Float animation
      this.tweens.add({
        targets: orb,
        y: orbY + (Math.random() * 60 - 30),
        x: orbX + (Math.random() * 40 - 20),
        alpha: { from: 0.2, to: 0.6 },
        scale: { from: 0.8, to: 1.2 },
        duration: 3000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Math.random() * 2000,
      });
    }

    // Biome-specific particle systems
    BIOME_CONFIGS.forEach((biome, index) => {
      const biomeX = index * this.BIOME_WIDTH;

      let particleConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig | null =
        null;

      switch (biome.id) {
        case 2: // Forest - Falling leaves
          particleConfig = {
            x: { min: biomeX, max: biomeX + this.BIOME_WIDTH },
            y: -50,
            speedY: { min: 40, max: 80 },
            speedX: { min: -20, max: 20 },
            scale: { start: 0.15, end: 0.05 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 12000,
            frequency: 150,
            tint: [0x4ade80, 0x14532d, 0x22c55e],
            rotate: { min: 0, max: 360 },
          };
          break;
        case 5: // Mine - Floating sparks/embers
          particleConfig = {
            x: { min: biomeX, max: biomeX + this.BIOME_WIDTH },
            y: { min: 400, max: 1000 },
            speedY: { min: -20, max: -40 },
            speedX: { min: -10, max: 10 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 3000,
            frequency: 100,
            tint: [0xf59e0b, 0xef4444, 0xfab005],
            blendMode: "ADD",
          };
          break;
        case 8: // Scaling - Glowing petals/magic
          particleConfig = {
            x: { min: biomeX, max: biomeX + this.BIOME_WIDTH },
            y: { min: 200, max: 800 },
            speedY: { min: -10, max: 10 },
            speedX: { min: -10, max: 10 },
            scale: { start: 0.2, end: 0.1 },
            alpha: { start: 0.4, end: 0 },
            lifespan: 5000,
            frequency: 120,
            tint: [0xffffff, 0xfde68a, 0x6366f1],
            blendMode: "ADD",
          };
          break;
      }

      if (particleConfig) {
        const emitter = this.add.particles(0, 0, "white", particleConfig);
        this.midgroundLayer.add(emitter);
        this.particleEmitters.push(emitter);
      }
    });

    // Shimmering stars in the distance (top sky area)
    for (let i = 0; i < 30; i++) {
      const starX = Math.random() * this.MAP_WIDTH;
      const starY = Math.random() * (this.MAP_HEIGHT * 0.3);
      const star = this.add.circle(starX, starY, 1, 0xffffff, 0.8);
      this.backgroundLayer.add(star);

      // Twinkle effect
      this.tweens.add({
        targets: star,
        alpha: { from: 0.3, to: 1.0 },
        scale: { from: 0.5, to: 1.5 },
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: "Quad.easeInOut",
        delay: Math.random() * 3000,
      });
    }
  }

  /**
   * Creates animated water ripples around biome edges and islands
   */
  private createWaterRipples(): void {
    const rippleCount = 20;
    for (let i = 0; i < rippleCount; i++) {
      const x = Math.random() * this.MAP_WIDTH;
      const y = Math.random() * this.MAP_HEIGHT;

      const ripple = this.add.graphics();
      ripple.lineStyle(2, 0xffffff, 0.2);
      ripple.strokeCircle(0, 0, 10);
      ripple.x = x;
      ripple.y = y;

      this.backgroundLayer.add(ripple);

      this.tweens.add({
        targets: ripple,
        scale: { from: 0.5, to: 4.0 },
        alpha: { from: 0.3, to: 0 },
        duration: 2000 + Math.random() * 2000,
        repeat: -1,
        ease: "Cubic.easeOut",
        delay: Math.random() * 4000,
      });
    }
  }

  /**
   * Creates animated foam rings at the base of every island (checkpoint)
   */
  private createShorelineFoam(): void {
    // We'll get positions after path generation or hardcoded/procedural
    // For now, let's add them based on the snake path positions
    const positions = this.getSnakePathPositions();

    positions.forEach((pos, i) => {
      // Draw 2-3 rings per island
      for (let r = 0; r < 2; r++) {
        const ripple = this.add.graphics();
        ripple.lineStyle(2, 0xffffff, 0.4);
        ripple.strokeCircle(0, 0, 42); // Just outside the checkpoint radius
        ripple.x = pos.x;
        ripple.y = pos.y;

        this.backgroundLayer.add(ripple);

        this.tweens.add({
          targets: ripple,
          scale: { from: 1.0, to: 1.15 },
          alpha: { from: 0.4, to: 0.1 },
          duration: 3000 + Math.random() * 2000,
          repeat: -1,
          yoyo: true,
          ease: "Sine.easeInOut",
          delay: Math.random() * 2000,
        });
      }
    });
  }

  /**
   * Creates angled cinematic 'God Rays' that drift across the screen
   */
  private createVolumetricLighting(): void {
    const rayCount = 6;
    for (let i = 0; i < rayCount; i++) {
      const x = Math.random() * this.MAP_WIDTH;
      const ray = this.add.graphics();

      this.backgroundLayer.add(ray);

      const updateRay = () => {
        ray.clear();
        // Modern palette: Use biome-specific colors or a safe premium white-gold
        ray.fillStyle(0xffffff, 0.05);

        const width = 100 + Math.random() * 200;
        const height = 1500;
        const angle = 0.2; // slight tilt

        ray.beginPath();
        ray.moveTo(x, -200);
        ray.lineTo(x + width, -200);
        ray.lineTo(x + width - height * angle, height);
        ray.lineTo(x - height * angle, height);
        ray.closePath();
        ray.fillPath();
      };

      updateRay();

      this.tweens.add({
        targets: ray,
        alpha: { from: 0.02, to: 0.08 },
        x: "+=50",
        duration: 8000 + Math.random() * 4000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }
  private createClouds(): void {
    // Distant Parallax Mountains
    const mountainColors = [0x1e1b4b, 0x312e81, 0x4338ca]; // Indigo-950, 900, 700
    for (let layer = 0; layer < 3; layer++) {
      const g = this.add.graphics();
      g.fillStyle(mountainColors[layer], 0.4 - layer * 0.1);

      const speed = 0.02 * (layer + 1);
      const yBase = 200 + layer * 50;

      g.beginPath();
      g.moveTo(0, 1000);
      for (let x = 0; x <= this.MAP_WIDTH; x += 100) {
        const h = 150 - layer * 40 + Math.sin(x * 0.005 + layer) * 50;
        g.lineTo(x, yBase - h);
      }
      g.lineTo(this.MAP_WIDTH, 1000);
      g.closePath();
      g.fillPath();

      this.backgroundLayer.add(g);

      // Parallax scroll effect (slow drift)
      this.events.on("update", () => {
        g.x -= speed;
        if (g.x < -200) g.x = 0; // Simple loop
      });
    }

    const cloudCount = 12;
    for (let i = 0; i < cloudCount; i++) {
      const x = Math.random() * this.MAP_WIDTH;
      const y = 100 + Math.random() * 300;
      const cloud = this.add.container(x, y);

      const graphics = this.add.graphics();
      graphics.fillStyle(0xffffff, 0.15); // Very soft translucent white

      // Draw a "fluffy" cloud using multiple circles
      const parts = 5 + Math.floor(Math.random() * 5);
      for (let j = 0; j < parts; j++) {
        const ox = j * 40 - (parts * 20) / 2;
        const oy = Math.sin(j) * 10;
        const radius = 40 + Math.random() * 40;
        graphics.fillCircle(ox, oy, radius);
      }

      cloud.add(graphics);
      this.midgroundLayer.add(cloud);

      // Drifting animation
      const speed = 0.05 + Math.random() * 0.1;
      this.events.on("update", () => {
        cloud.x += speed;
        if (cloud.x > this.MAP_WIDTH + 200) {
          cloud.x = -200;
        }
      });

      // Subtle float up/down
      this.tweens.add({
        targets: cloud,
        y: y + 30,
        duration: 4000 + Math.random() * 3000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  /**
   * Creates the snake path with all 36 checkpoints
   * Path winds through all 8 biomes left to right
   */
  private createSnakePath(): void {
    const positions: { x: number; y: number }[] = [];

    let globalIndex = 0;

    // Calculate positions for all checkpoints
    VENTURE_STAGES.forEach((stage) => {
      for (let cp = 0; cp < stage.checkpoints; cp++) {
        const pos = this.calculateSnakePosition(
          globalIndex,
          this.TOTAL_CHECKPOINTS,
        );
        positions.push(pos);
        globalIndex++;
      }
    });

    // Create checkpoint nodes
    globalIndex = 0;
    VENTURE_STAGES.forEach((stage) => {
      for (let cp = 0; cp < stage.checkpoints; cp++) {
        const pos = positions[globalIndex];
        const checkpointId = `${stage.id}-${cp + 1}`;

        const node = new CheckpointNode(this, {
          id: checkpointId,
          stage: stage.id,
          checkpoint: cp + 1,
          status: "locked" as CheckpointStatus,
          x: pos.x,
          y: pos.y,
          t1: false,
          t2: false,
          t3: false,
          globalIndex: globalIndex + 1,
        });

        node.setInteractive();
        this.checkpointNodes.set(checkpointId, node);
        this.gameLayer.add(node);

        globalIndex++;
      }
    });
  }

  /**
   * Calculates snake-path position for a checkpoint
   * Snake winds up and down as it progresses left to right through biomes
   */
  private calculateSnakePosition(
    index: number,
    _total: number,
  ): { x: number; y: number } {
    let stageStartIndex = 0;

    for (const stage of VENTURE_STAGES) {
      const stageEndIndex = stageStartIndex + stage.checkpoints;
      if (index < stageEndIndex) {
        return this.calculateStageCheckpointPosition(
          stage.id,
          index - stageStartIndex,
          stage.checkpoints,
        );
      }
      stageStartIndex = stageEndIndex;
    }

    return this.calculateStageCheckpointPosition(1, 0, 1);
  }

  private calculateStageCheckpointPosition(
    stageId: number,
    checkpointIndex: number,
    checkpointTotal: number,
  ): { x: number; y: number } {
    const panelWidth = this.map.widthInPixels * this.MAP_PANEL_SCALE;
    const panelHeight = this.map.heightInPixels * this.MAP_PANEL_SCALE;
    const panelOffsetX = (this.BIOME_WIDTH - panelWidth) / 2;
    const panelOffsetY = this.MAP_HEIGHT - panelHeight + 120;
    const biomeOffsetX = (stageId - 1) * this.BIOME_WIDTH + panelOffsetX;

    const stageOneVillageAnchors = [
      { x: 154, y: 438 },
      { x: 292, y: 336 },
      { x: 486, y: 286 },
      { x: 620, y: 350 },
    ];
    if (stageId === 1) {
      const anchor =
        stageOneVillageAnchors[
          Math.min(checkpointIndex, stageOneVillageAnchors.length - 1)
        ];
      return {
        x: biomeOffsetX + anchor.x * this.MAP_PANEL_SCALE,
        y: panelOffsetY + anchor.y * this.MAP_PANEL_SCALE,
      };
    }

    const anchors = [
      { x: 126, y: 445 },
      { x: 285, y: 318 },
      { x: 470, y: 252 },
      { x: 650, y: 350 },
      { x: 780, y: 448 },
      { x: 980, y: 540 },
    ];

    const segmentTarget =
      checkpointTotal === 1
        ? 0
        : (checkpointIndex / (checkpointTotal - 1)) * (anchors.length - 1);
    const leftIndex = Math.floor(segmentTarget);
    const rightIndex = Math.min(leftIndex + 1, anchors.length - 1);
    const t = segmentTarget - leftIndex;
    const left = anchors[leftIndex];
    const right = anchors[rightIndex];

    const localX =
      Phaser.Math.Linear(left.x, right.x, t) * this.MAP_PANEL_SCALE;
    const localY =
      Phaser.Math.Linear(left.y, right.y, t) * this.MAP_PANEL_SCALE;

    return {
      x: biomeOffsetX + localX,
      y: panelOffsetY + localY,
    };
  }

  /**
   * Creates the Super Boss silhouette visible across entire map
   */
  private createSuperBoss(
    bossSlug: string = "the_gravemind",
    bossName: string = "The Gravemind",
    status: "silhouette" | "present" | "foreground" = "silhouette",
  ): void {
    const existingBoss = this.bosses.get("super_boss");
    if (existingBoss) {
      existingBoss.destroy();
      this.bosses.delete("super_boss");
    }

    const superBossX = this.MAP_WIDTH - 400;
    const superBossY = this.MAP_HEIGHT / 2;

    const superBoss = new BossSilhouette(this, {
      bossId: bossSlug,
      bossName,
      status,
      x: superBossX,
      y: superBossY,
    });

    this.bosses.set("super_boss", superBoss);
    this.gameLayer.add(superBoss);
  }

  /**
   * Creates 8 mini-bosses, one for each stage
   */
  private createMiniBosses(): void {
    const miniBossNames = [
      "Fog of Vagueness",
      "Pathwarden Wraith",
      "Advocate of Comfortable Lies",
      "Unfinished Golem",
      "Collapse Specter",
      "Harbourmaster of Hesitation",
      "Babel Merchant",
      "Iron Bureaucrat",
    ];

    VENTURE_STAGES.forEach((stage, index) => {
      // Place mini-boss at the end of each stage
      let globalIndex = 0;
      for (let s = 0; s < stage.id - 1; s++) {
        globalIndex += VENTURE_STAGES[s].checkpoints;
      }
      globalIndex += stage.checkpoints - 1;

      const pos = this.calculateSnakePosition(
        globalIndex,
        this.TOTAL_CHECKPOINTS,
      );
      const offsetX = 100;
      const offsetY = -120;

      const miniBoss = new MiniBoss(this, {
        bossId: `mini_boss_${stage.id}`,
        bossType: (miniBossNames[index] || "Fog of Vagueness") as MiniBossType,
        stage: stage.id,
        x: pos.x + offsetX,
        y: pos.y + offsetY,
      });

      this.miniBosses.set(stage.id, miniBoss);
      this.gameLayer.add(miniBoss);
    });
  }

  /**
   * Sets up event listeners for React communication
   */
  private setupEventListeners(): void {
    this.boundHandlers.updateBrightness =
      this.handleUpdateBrightness.bind(this);
    this.boundHandlers.updateCheckpoints =
      this.handleUpdateCheckpoints.bind(this);
    this.boundHandlers.setActiveVenture =
      this.handleSetActiveVenture.bind(this);
    this.boundHandlers.scrollToCheckpoint =
      this.handleScrollToCheckpoint.bind(this);
    this.boundHandlers.playCheckpointAnimation =
      this.handlePlayCheckpointAnimation.bind(this);

    eventBridge.onPhaser(
      "UPDATE_BRIGHTNESS",
      this.boundHandlers.updateBrightness,
    );
    eventBridge.onPhaser(
      "UPDATE_CHECKPOINTS",
      this.boundHandlers.updateCheckpoints,
    );
    eventBridge.onPhaser(
      "SET_ACTIVE_VENTURE",
      this.boundHandlers.setActiveVenture,
    );
    eventBridge.onPhaser(
      "SCROLL_TO_CHECKPOINT",
      this.boundHandlers.scrollToCheckpoint,
    );
    eventBridge.onPhaser(
      "PLAY_CHECKPOINT_ANIMATION",
      this.boundHandlers.playCheckpointAnimation,
    );

    // Handle checkpoint clicks (emitted by CheckpointNode)
    this.events.on(
      "checkpoint_clicked",
      (data: { id: string; stage: number; checkpoint: number }) => {
        console.log("[Phaser] Checkpoint clicked:", data);
        eventBridge.dispatchToReact({
          type: "CHECKPOINT_CLICKED",
          checkpointId: data.id,
          stage: data.stage,
          checkpoint: data.checkpoint,
        });
      },
    );
  }

  /**
   * Handles brightness updates using PRD two-layer formula
   * Accumulated base = completed stages × 8.57%, capped at 60%
   * Stage layer = (current stage tasks done / current stage tasks total) × 40%
   * World brightness = accumulated base + stage layer (0% to 100%)
   */
  private handleUpdateBrightness(event?: { brightness: number }): void {
    if (typeof event?.brightness === "number") {
      this.currentBrightness = Math.max(0, Math.min(100, event.brightness));
      this.updateBrightnessFilter(this.currentBrightness);
      return;
    }

    // Calculate accumulated base brightness from completed stages (7 stages max = 60%)
    const accumulatedBase = Math.min(this.completedStages * 8.57, 60);

    // Calculate stage layer brightness (current stage progress = 0-40%)
    const stageLayer =
      this.stageTasksTotal > 0
        ? (this.stageTasksCompleted / this.stageTasksTotal) * 40
        : 0;

    // Total world brightness
    const worldBrightness = accumulatedBase + stageLayer;

    // Clamp to 0-100%
    const finalBrightness = Math.max(0, Math.min(100, worldBrightness));

    this.currentBrightness = finalBrightness;
    this.updateBrightnessFilter(finalBrightness);

    console.log(
      `[WorldMapScene] Brightness: 100% (Forced) Original: ${finalBrightness.toFixed(2)}% (Base: ${accumulatedBase.toFixed(2)}% + Stage: ${stageLayer.toFixed(2)}%)`,
    );
  }

  /**
   * Updates the brightness filter based on percentage (0-100)
   */
  private updateBrightnessFilter(brightnessPercent: number): void {
    if (!this.brightnessFilter) return;

    // Convert percentage to brightness multiplier
    const brightness = brightnessPercent / 100;

    // Start from very dark (0.1) and scale up to full brightness (1.0)
    const minBrightness = 0.1;
    const brightnessValue = minBrightness + brightness * (1.0 - minBrightness);

    this.brightnessFilter.brightness(brightnessValue);
  }

  /**
   * Handles checkpoint state updates
   */
  private handleUpdateCheckpoints(event: {
    checkpoints: CheckpointState[];
  }): void {
    const checkpoints = event.checkpoints;

    // Update checkpoint nodes
    checkpoints.forEach((cp) => {
      const checkpointId = `${cp.stage}-${cp.checkpoint}`;
      const node = this.checkpointNodes.get(checkpointId);

      if (node) {
        node.updateStatus(cp.status);
      }
    });

    // Calculate stage progress for brightness
    const activeCheckpoint = checkpoints.find(
      (cp) => cp.status === "active" || cp.status === "in_progress",
    );
    if (activeCheckpoint) {
      this.currentStage = activeCheckpoint.stage;

      // Count completed stages (all stages before current)
      this.completedStages = this.currentStage - 1;

      // Count tasks in current stage
      const currentStageCheckpoints = checkpoints.filter(
        (cp) => cp.stage === this.currentStage,
      );

      this.stageTasksTotal = currentStageCheckpoints.length * 3; // 3 tasks per checkpoint
      this.stageTasksCompleted = 0;

      currentStageCheckpoints.forEach((cp) => {
        if (cp.t1) this.stageTasksCompleted++;
        if (cp.t2) this.stageTasksCompleted++;
        if (cp.t3) this.stageTasksCompleted++;
      });

      // Update brightness
      this.handleUpdateBrightness();
    }

    // Position persona on active checkpoint
    this.positionPersonaOnActiveCheckpoint();

    // Update mini-boss progress
    this.updateMiniBossProgress(checkpoints);
  }

  /**
   * Updates mini-boss weakness based on checkpoint completion
   */
  private updateMiniBossProgress(checkpoints: CheckpointState[]): void {
    const stageProgress = new Map<
      number,
      { completed: number; total: number }
    >();

    checkpoints.forEach((cp) => {
      const stage = cp.stage;
      if (!stageProgress.has(stage)) {
        stageProgress.set(stage, { completed: 0, total: 0 });
      }

      const progress = stageProgress.get(stage)!;
      progress.total++;

      // Count as completed if status is 'completed' or 'gold'
      if (cp.status === "completed" || cp.status === "gold") {
        progress.completed++;
      }
    });

    // Update all mini-bosses
    for (const [stage, miniBoss] of this.miniBosses.entries()) {
      const progress = stageProgress.get(stage);
      if (!progress) continue;

      const { completed, total } = progress;
      const stageCheckpoints = checkpoints
        .filter((cp) => cp.stage === stage)
        .sort((a, b) => a.checkpoint - b.checkpoint);
      const finalCheckpoint = stageCheckpoints[stageCheckpoints.length - 1];
      const finalCheckpointCompleted =
        finalCheckpoint?.status === "completed" ||
        finalCheckpoint?.status === "gold";
      const halfComplete = total > 0 && completed >= Math.ceil(total / 2);

      // Check if stage is fully complete
      const stageComplete = completed === total && total > 0;

      const playerMovedPast = stage < this.currentStage;

      if (stageComplete) {
        // Slay the boss when stage is complete
        if (miniBoss && miniBoss.active) {
          // Use gold slay if final checkpoint is gold
          if (finalCheckpoint?.goldBonusEarned) {
            miniBoss.slayGold();
            this.transformBiomeGold(stage);
          } else {
            miniBoss.slay();
            this.restoreBiome(stage);
          }
          this.retreatedStages.delete(stage); // slay supersedes retreat
          // Remove residual marker if it exists
          this.removeResidualMarker(stage);
        }
      } else if (
        playerMovedPast &&
        halfComplete &&
        !finalCheckpointCompleted &&
        !this.retreatedStages.has(stage)
      ) {
        if (miniBoss && miniBoss.active) {
          miniBoss.retreat();
          this.retreatedStages.add(stage);
          // Create residual marker at boss position
          this.createResidualMarker(stage, miniBoss.x, miniBoss.y);
          console.log(
            `[WorldMapScene] 🌑 Mini-boss Stage ${stage} retreated (partial progress: ${completed}/${total})`,
          );
        }
      } else if (!playerMovedPast && !stageComplete) {
        // Still on this stage — keep weakening based on progress
        if (miniBoss && miniBoss.active) {
          miniBoss.weaken(completed, total);
        }
      }
    }
  }

  /**
   * Handles active venture selection from React
   */
  private handleSetActiveVenture(event: {
    ventureId: string;
    personaGender: "male" | "female";
    assignedBosses?: string[];
    currentStage?: number;
    corruptionLevel?: number;
    superBoss?: {
      bossSlug: string;
      bossName: string;
      visualStatus: "silhouette" | "present" | "foreground";
    };
  }): void {
    try {
      this.currentVentureId = event.ventureId;
      this.currentCorruptionLevel = event.corruptionLevel ?? 0;
      this.retreatedStages.clear(); // Reset retreat state for fresh venture session

      // Create persona if doesn't exist
      if (!this.persona) {
        this.persona = new Persona(
          this,
          0,
          0,
          event.personaGender as PersonaGender,
        );
        this.gameLayer.add(this.persona);
      }

      // Update current stage if provided
      if (event.currentStage) {
        this.currentStage = event.currentStage;

        // Play ambience for the current stage
        audioManager.playAmbienceForStage(event.currentStage);
        console.log(
          `[WorldMapScene] Playing ambience for stage ${event.currentStage}`,
        );
      }

      const nextBossStatus = event.superBoss?.visualStatus ?? "silhouette";
      this.createSuperBoss(
        event.superBoss?.bossSlug ?? "the_gravemind",
        event.superBoss?.bossName ?? "The Gravemind",
        nextBossStatus,
      );

      if (this.currentCorruptionLevel >= 90) {
        this.bosses.get("super_boss")?.entrance();
      }

      // Position persona on active checkpoint
      this.positionPersonaOnActiveCheckpoint();

      // Auto-scroll to active checkpoint after a short delay
      this.time.delayedCall(500, () => {
        this.autoScrollToActive();
      });
    } catch (error) {
      console.warn("[WorldMapScene] Failed to set active venture:", error);
    }
  }

  private getPersonaMarkerPosition(node: CheckpointNode): {
    x: number;
    y: number;
  } {
    return {
      x: node.x - 54,
      y: node.y + 38,
    };
  }

  /**
   * Position persona beside the active checkpoint on a walkable map tile.
   */
  private positionPersonaOnActiveCheckpoint(): void {
    if (!this.persona) return;

    // Find active checkpoint
    for (const node of this.checkpointNodes.values()) {
      const status = node.status;
      if (status === "active" || status === "in_progress") {
        const pos = this.getPersonaMarkerPosition(node);
        this.persona.setPosition(pos.x, pos.y);
        this.persona.playIdle();
        return;
      }
    }

    // Default: position on first checkpoint if no active found
    const firstNode = Array.from(this.checkpointNodes.values())[0];
    if (firstNode) {
      const pos = this.getPersonaMarkerPosition(firstNode);
      this.persona.setPosition(pos.x, pos.y);
      this.persona.playIdle();
    }
  }

  /**
   * Handles camera scroll requests to specific checkpoints
   */
  private handleScrollToCheckpoint(event: { checkpointId: string }): void {
    try {
      this.scrollToCheckpoint(event.checkpointId, true);
    } catch (error) {
      console.warn("[WorldMapScene] Failed to scroll to checkpoint:", error);
    }
  }

  /**
   * Scroll camera to show a specific checkpoint
   */
  private scrollToCheckpoint(checkpointId: string, smooth = true): void {
    const node = this.checkpointNodes.get(checkpointId);
    if (!node) return;

    const targetX = node.x;
    const targetY = node.y;
    const personaTarget = this.getPersonaMarkerPosition(node);

    if (smooth) {
      // Camera pan animation
      this.cameras.main.pan(
        targetX,
        targetY,
        1000, // 1 second duration
        "Sine.easeInOut",
        false,
      );

      // Sync persona walk animation with camera scroll
      // Position persona 80px above checkpoint node (at character's feet)
      if (this.persona) {
        this.persona.moveToPosition(personaTarget.x, personaTarget.y, 1000);
      }
    } else {
      this.cameras.main.centerOn(targetX, targetY);

      // Instantly position persona without animation
      if (this.persona) {
        this.persona.setPosition(personaTarget.x, personaTarget.y);
      }
    }
  }

  /**
   * Auto-scroll to active checkpoint when venture loads
   */
  private autoScrollToActive(): void {
    // Find the first active or in_progress checkpoint
    for (const [id, node] of this.checkpointNodes.entries()) {
      if (node.status === "active" || node.status === "in_progress") {
        this.scrollToCheckpoint(id, true);
        break;
      }
    }
  }

  /**
   * Handles checkpoint animation requests from React
   */
  private handlePlayCheckpointAnimation(event: {
    checkpointId: string;
    stage: number;
    variant: "standard" | "gold";
  }): void {
    try {
      this.playCheckpointAnimation(
        event.checkpointId,
        event.stage,
        event.variant,
      );
    } catch (error) {
      console.warn(
        "[WorldMapScene] Failed to play checkpoint animation:",
        error,
      );
    }
  }

  /**
   * Play a checkpoint animation based on stage and variant
   */
  private playCheckpointAnimation(
    checkpointId: string,
    stage: number,
    variant: AnimationVariant = "standard",
  ): void {
    // Stop any currently playing animation
    this.stopCurrentAnimation();

    // Get checkpoint node position for animation placement
    const node = this.checkpointNodes.get(checkpointId);
    if (!node) {
      console.warn(
        `[WorldMapScene] Cannot play animation - checkpoint ${checkpointId} not found`,
      );
      return;
    }

    // Get world position of checkpoint
    const worldPos = node.getWorldPosition();

    // Determine animation type from stage
    const animationType = getAnimationTypeForStage(stage);

    // Play checkpoint SFX based on animation type and variant
    const sfxId = `${animationType}_${variant}`;
    audioManager.playCheckpointSFX(sfxId as CheckpointSFXId);
    console.log(`[WorldMapScene] Playing checkpoint SFX: ${sfxId}`);

    // Create animation instance
    this.currentAnimation = createCheckpointAnimation(this, animationType, {
      x: worldPos.x,
      y: worldPos.y,
      variant,
      onComplete: () => {
        this.stopCurrentAnimation();
        // Notify React that animation completed
        eventBridge.dispatchToReact({
          type: "CHECKPOINT_ANIMATION_COMPLETE",
          checkpointId,
          stage,
        });
      },
      onSkip: () => {
        // User can skip after 500ms by clicking or pressing ESC
      },
    });

    // Play the animation
    this.currentAnimation.play();
  }

  /**
   * Stop and cleanup the currently playing animation
   */
  private stopCurrentAnimation(): void {
    if (this.currentAnimation) {
      this.currentAnimation.destroy();
      this.currentAnimation = null;
    }
  }

  /**
   * Update loop - handles parallax scrolling
   */
  update(): void {
    // Intentionally left blank: all map layers stay in world space so the HUD
    // overlay, checkpoint interactions, and the tiled backdrop remain aligned.
  }

  /**
   * Cleanup when scene is shutdown
   */
  shutdown(): void {
    // Stop any playing animation
    this.stopCurrentAnimation();

    // Clean up mini-bosses
    this.miniBosses.forEach((boss) => boss.destroy());
    this.miniBosses.clear();

    // Clean up bosses
    this.bosses.forEach((boss) => boss.destroy());
    this.bosses.clear();

    // Clean up event listeners
    if (this.boundHandlers.updateBrightness) {
      eventBridge.off("UPDATE_BRIGHTNESS", this.boundHandlers.updateBrightness);
    }
    if (this.boundHandlers.updateCheckpoints) {
      eventBridge.off(
        "UPDATE_CHECKPOINTS",
        this.boundHandlers.updateCheckpoints,
      );
    }
    if (this.boundHandlers.setActiveVenture) {
      eventBridge.off(
        "SET_ACTIVE_VENTURE",
        this.boundHandlers.setActiveVenture,
      );
    }
    if (this.boundHandlers.scrollToCheckpoint) {
      eventBridge.off(
        "SCROLL_TO_CHECKPOINT",
        this.boundHandlers.scrollToCheckpoint,
      );
    }
    if (this.boundHandlers.playCheckpointAnimation) {
      eventBridge.off(
        "PLAY_CHECKPOINT_ANIMATION",
        this.boundHandlers.playCheckpointAnimation,
      );
    }
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
      this.resizeHandler = undefined;
    }

    this.boundHandlers = {};
  }

  /**
   * Listens for CustomEvents from the VirtualGamepad component
   */
  private setupGamepadListeners(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("phaser-input", (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string }>;
      const { type } = customEvent.detail;

      switch (type) {
        case "DIR_LEFT":
          this.changeSelection(-1);
          break;
        case "DIR_RIGHT":
          this.changeSelection(1);
          break;
        case "ACTION_A": // Select
          this.handleGamepadConfirm();
          break;
        case "ACTION_Y": // Interact
          this.showCheckpointInfo(this.selectedCheckpointIndex);
          break;
      }
    });

    // Create selection highlight
    this.selectionGlow = this.add.arc(0, 0, 65, 0, 360, false, 0xffffff, 0);
    this.selectionGlow.setStrokeStyle(4, 0x6366f1, 0.6);
    this.animationLayer.add(this.selectionGlow);

    this.tweens.add({
      targets: this.selectionGlow,
      alpha: { from: 0.2, to: 0.6 },
      scale: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }

  private changeSelection(delta: number): void {
    const newIndex = Phaser.Math.Clamp(
      this.selectedCheckpointIndex + delta,
      0,
      this.TOTAL_CHECKPOINTS - 1,
    );
    if (newIndex !== this.selectedCheckpointIndex) {
      this.selectedCheckpointIndex = newIndex;
      this.updateGamepadSelection();
      audioManager.playUI("hover");
    }
  }

  private updateGamepadSelection(): void {
    const cp = this.getCheckpointByIndex(this.selectedCheckpointIndex);
    if (cp && this.selectionGlow) {
      this.selectionGlow.setPosition(cp.x, cp.y);
      this.cameras.main.pan(cp.x, cp.y, 500, "Power2");
    }
  }

  private getCheckpointByIndex(index: number): CheckpointNode | null {
    for (const node of this.checkpointNodes.values()) {
      if (node.globalIndex === index + 1) {
        return node;
      }
    }
    return null;
  }

  private handleGamepadConfirm(): void {
    const node = this.getCheckpointByIndex(this.selectedCheckpointIndex);
    if (node && node.status !== "locked") {
      this.events.emit("checkpoint_clicked", {
        id: node.checkpointId,
        stage: node.stage,
        checkpoint: node.checkpoint,
      });
    }
  }

  private showCheckpointInfo(index: number): void {
    console.log("Showing info for checkpoint", index);
  }

  /**
   * Helper to get all checkpoint positions along the snake path
   */
  private getSnakePathPositions(): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    let globalIndex = 0;

    VENTURE_STAGES.forEach((stage) => {
      for (let cp = 0; cp < stage.checkpoints; cp++) {
        const pos = this.calculateSnakePosition(
          globalIndex,
          this.TOTAL_CHECKPOINTS,
        );
        positions.push(pos);
        globalIndex++;
      }
    });

    return positions;
  }

  /**
   * Transform biome with gold completion effects - color floods, particles, elevation
   */
  private transformBiomeGold(stage: number): void {
    const stageBiome = BIOME_CONFIGS[stage - 1];
    if (!stageBiome) return;

    // Get stage bounds
    const stageCheckpoints = Array.from(this.checkpointNodes.values()).filter(
      (node) => node.stage === stage,
    );
    if (stageCheckpoints.length === 0) return;

    const minX = Math.min(...stageCheckpoints.map((n) => n.x));
    const maxX = Math.max(...stageCheckpoints.map((n) => n.x));
    const centerX = (minX + maxX) / 2;
    const centerY = 400;

    // Gold particle burst
    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 * i) / 50;
      const distance = Phaser.Math.Between(100, 300);
      const particle = this.add.circle(
        centerX,
        centerY,
        Phaser.Math.Between(3, 8),
        0xfbbf24,
        1,
      );
      this.animationLayer.add(particle);

      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: 2000,
        ease: "Cubic.easeOut",
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    // Color flood effect - golden wave
    const colorFlood = this.add.rectangle(
      centerX,
      centerY,
      maxX - minX + 400,
      800,
      0xfbbf24,
      0,
    );
    this.animationLayer.add(colorFlood);

    this.tweens.add({
      targets: colorFlood,
      alpha: { from: 0, to: 0.4 },
      scaleX: { from: 0.5, to: 1.2 },
      scaleY: { from: 0.5, to: 1.2 },
      duration: 1200,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: colorFlood,
          alpha: 0,
          duration: 1300,
          ease: "Sine.easeIn",
          onComplete: () => {
            colorFlood.destroy();
          },
        });
      },
    });

    // Sparkle particles
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const x = Phaser.Math.Between(minX - 100, maxX + 100);
        const y = Phaser.Math.Between(200, 600);
        const sparkle = this.add.star(
          x,
          y,
          5,
          Phaser.Math.Between(4, 10),
          Phaser.Math.Between(8, 20),
          0xfacc15,
          1,
        );
        this.animationLayer.add(sparkle);

        this.tweens.add({
          targets: sparkle,
          alpha: 0,
          y: y - 100,
          angle: 360,
          duration: 1500,
          ease: "Cubic.easeOut",
          onComplete: () => {
            sparkle.destroy();
          },
        });
      }, i * 50);
    }

    console.log(
      `[WorldMapScene] 🌟 Gold biome transformation for stage ${stage}`,
    );
  }

  /**
   * Restore biome visually after standard stage completion
   */
  private restoreBiome(stage: number): void {
    const stageBiome = BIOME_CONFIGS[stage - 1];
    if (!stageBiome) return;

    // Get stage bounds
    const stageCheckpoints = Array.from(this.checkpointNodes.values()).filter(
      (node) => node.stage === stage,
    );
    if (stageCheckpoints.length === 0) return;

    const minX = Math.min(...stageCheckpoints.map((n) => n.x));
    const maxX = Math.max(...stageCheckpoints.map((n) => n.x));
    const centerX = (minX + maxX) / 2;
    const centerY = 400;

    // Restoration particle effect
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const distance = Phaser.Math.Between(80, 200);
      const particle = this.add.circle(
        centerX,
        centerY,
        Phaser.Math.Between(2, 5),
        stageBiome.colors.accent2,
        0.8,
      );
      this.animationLayer.add(particle);

      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        alpha: 0,
        duration: 1500,
        ease: "Cubic.easeOut",
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    // Gentle color wash
    const colorWash = this.add.rectangle(
      centerX,
      centerY,
      maxX - minX + 300,
      700,
      stageBiome.colors.accent1,
      0,
    );
    this.animationLayer.add(colorWash);

    this.tweens.add({
      targets: colorWash,
      alpha: { from: 0, to: 0.2 },
      duration: 1000,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: colorWash,
          alpha: 0,
          duration: 1000,
          ease: "Sine.easeIn",
          onComplete: () => {
            colorWash.destroy();
          },
        });
      },
    });

    console.log(`[WorldMapScene] ✨ Biome restored for stage ${stage}`);
  }

  /**
   * Create residual path marker when boss retreats
   */
  private createResidualMarker(
    stage: number,
    bossX: number,
    bossY: number,
  ): void {
    // Remove existing marker if present
    this.removeResidualMarker(stage);

    const container = this.add.container(bossX, bossY);
    this.midgroundLayer.add(container);

    // Faded silhouette
    const silhouette = this.add.circle(0, 0, 30, 0x6b7280, 0.3);
    container.add(silhouette);

    // Crack/scar in the ground
    const crack = this.add.graphics();
    crack.lineStyle(2, 0x52525b, 0.5);
    crack.beginPath();
    crack.moveTo(-20, 40);
    crack.lineTo(-10, 50);
    crack.moveTo(0, 40);
    crack.lineTo(0, 55);
    crack.moveTo(10, 40);
    crack.lineTo(15, 50);
    crack.strokePath();
    container.add(crack);

    // Lingering fog particles
    for (let i = 0; i < 3; i++) {
      const fogParticle = this.add.circle(
        Phaser.Math.Between(-15, 15),
        Phaser.Math.Between(-10, 10),
        Phaser.Math.Between(3, 6),
        0x9ca3af,
        0.2,
      );
      container.add(fogParticle);

      this.tweens.add({
        targets: fogParticle,
        alpha: { from: 0.2, to: 0.05 },
        y: fogParticle.y - 5,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Pulse effect
    this.tweens.add({
      targets: silhouette,
      alpha: { from: 0.3, to: 0.15 },
      scale: { from: 1, to: 1.1 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.residualMarkers.set(stage, container);

    console.log(
      `[WorldMapScene] 🌫️ Residual marker created for stage ${stage}`,
    );
  }

  /**
   * Remove residual marker when stage is completed
   */
  private removeResidualMarker(stage: number): void {
    const marker = this.residualMarkers.get(stage);
    if (marker) {
      this.tweens.add({
        targets: marker,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          marker.destroy();
        },
      });
      this.residualMarkers.delete(stage);
      console.log(
        `[WorldMapScene] 🌟 Residual marker removed for stage ${stage}`,
      );
    }
  }
}
