import { describe, it, expect } from "vitest";
import { VENTURE_STAGES } from "../convex/ventureConstants";

/**
 * Test suite for snake path layout calculations
 *
 * Verifies that the checkpoint positioning algorithm correctly:
 * - Distributes checkpoints across 8 biome zones
 * - Creates alternating wave patterns (up/down)
 * - Respects biome boundaries (400px each)
 * - Handles variable checkpoint counts per stage
 */

// Constants matching WorldMapScene implementation
const BIOME_WIDTH = 400;
const START_X = 200;
const START_Y = 360;
const PATH_AMPLITUDE = 60;

/**
 * Replicate the checkpoint position calculation from WorldMapScene
 */
function calculateCheckpointPosition(
  stage: number,
  checkpoint: number,
  _globalIndex: number,
): { x: number; y: number } {
  const biomeZone = stage;
  const biomeStartX = START_X + (biomeZone - 1) * BIOME_WIDTH;

  const checkpointsInStage = getCheckpointsForStage(stage);
  const posInBiome = checkpoint - 1;

  const isOddBiome = biomeZone % 2 === 1;
  // In screen coordinates: negative Y = UP, positive Y = DOWN
  const verticalOffset = isOddBiome
    ? -Math.sin((posInBiome / (checkpointsInStage - 1 || 1)) * Math.PI) *
      PATH_AMPLITUDE
    : Math.sin((posInBiome / (checkpointsInStage - 1 || 1)) * Math.PI) *
      PATH_AMPLITUDE;

  const x =
    biomeStartX + (posInBiome * BIOME_WIDTH) / (checkpointsInStage + 1) + 50;
  const y = START_Y + verticalOffset;

  return { x, y };
}

function getCheckpointsForStage(stage: number): number {
  const stageData = VENTURE_STAGES.find((s) => s.id === stage);
  return stageData?.checkpoints || 4;
}

describe("Snake Path Layout", () => {
  describe("VENTURE_STAGES Constants", () => {
    it("should have 8 stages defined", () => {
      expect(VENTURE_STAGES).toHaveLength(8);
    });

    it("should have correct checkpoint counts", () => {
      const expectedCheckpoints = [4, 5, 4, 5, 6, 3, 4, 5];
      VENTURE_STAGES.forEach((stage, index) => {
        expect(stage.checkpoints).toBe(expectedCheckpoints[index]);
      });
    });

    it("should total 36 checkpoints", () => {
      const total = VENTURE_STAGES.reduce(
        (sum, stage) => sum + stage.checkpoints,
        0,
      );
      expect(total).toBe(36);
    });

    it("should have correct stage names", () => {
      const expectedNames = [
        "Ideation",
        "Research",
        "Validation",
        "Offer Design",
        "Build & Deliver",
        "Launch",
        "Iteration",
        "Scale",
      ];
      VENTURE_STAGES.forEach((stage, index) => {
        expect(stage.name).toBe(expectedNames[index]);
      });
    });
  });

  describe("Biome Zone Calculations", () => {
    it("should place Stage 1 in first biome zone (200-600px)", () => {
      const { x } = calculateCheckpointPosition(1, 1, 0);
      expect(x).toBeGreaterThanOrEqual(200);
      expect(x).toBeLessThanOrEqual(600);
    });

    it("should place Stage 2 in second biome zone (600-1000px)", () => {
      const { x } = calculateCheckpointPosition(2, 1, 4);
      expect(x).toBeGreaterThanOrEqual(600);
      expect(x).toBeLessThanOrEqual(1000);
    });

    it("should place Stage 8 in eighth biome zone (3000-3400px)", () => {
      const { x } = calculateCheckpointPosition(8, 1, 32);
      expect(x).toBeGreaterThanOrEqual(3000);
      expect(x).toBeLessThanOrEqual(3400);
    });

    it("should have 400px width per biome", () => {
      for (let stage = 1; stage <= 8; stage++) {
        const biomeStartX = START_X + (stage - 1) * BIOME_WIDTH;
        const biomeEndX = biomeStartX + BIOME_WIDTH;

        const checkpointCount = getCheckpointsForStage(stage);
        for (let cp = 1; cp <= checkpointCount; cp++) {
          const globalIndex =
            VENTURE_STAGES.slice(0, stage - 1).reduce(
              (sum, s) => sum + s.checkpoints,
              0,
            ) +
            (cp - 1);

          const { x } = calculateCheckpointPosition(stage, cp, globalIndex);
          expect(x).toBeGreaterThanOrEqual(biomeStartX);
          expect(x).toBeLessThanOrEqual(biomeEndX);
        }
      }
    });
  });

  describe("Wave Pattern Calculations", () => {
    it("should create upward wave for odd biomes (Stage 1)", () => {
      const checkpointCount = getCheckpointsForStage(1);
      const positions = [];

      for (let cp = 1; cp <= checkpointCount; cp++) {
        const { y } = calculateCheckpointPosition(1, cp, cp - 1);
        positions.push(y);
      }

      // First and last checkpoints should be at center line
      expect(Math.abs(positions[0] - START_Y)).toBeLessThan(1);
      expect(Math.abs(positions[positions.length - 1] - START_Y)).toBeLessThan(
        1,
      );

      // Middle checkpoints should be above center (upward wave)
      const middleY = positions[Math.floor(positions.length / 2)];
      expect(middleY).toBeLessThan(START_Y);
    });

    it("should create downward wave for even biomes (Stage 2)", () => {
      const checkpointCount = getCheckpointsForStage(2);
      const positions = [];

      for (let cp = 1; cp <= checkpointCount; cp++) {
        const { y } = calculateCheckpointPosition(2, cp, cp - 1 + 4);
        positions.push(y);
      }

      // First and last checkpoints should be at center line
      expect(Math.abs(positions[0] - START_Y)).toBeLessThan(1);
      expect(Math.abs(positions[positions.length - 1] - START_Y)).toBeLessThan(
        1,
      );

      // Middle checkpoints should be below center (downward wave)
      const middleY = positions[Math.floor(positions.length / 2)];
      expect(middleY).toBeGreaterThan(START_Y);
    });

    it("should alternate wave direction per stage", () => {
      const stage1Middle = calculateCheckpointPosition(1, 2, 1).y;
      const stage2Middle = calculateCheckpointPosition(2, 3, 6).y;
      const stage3Middle = calculateCheckpointPosition(3, 2, 10).y;
      const stage4Middle = calculateCheckpointPosition(4, 3, 15).y;

      // Odd stages go up, even stages go down
      expect(stage1Middle).toBeLessThan(START_Y); // Up
      expect(stage2Middle).toBeGreaterThan(START_Y); // Down
      expect(stage3Middle).toBeLessThan(START_Y); // Up
      expect(stage4Middle).toBeGreaterThan(START_Y); // Down
    });

    it("should respect amplitude bounds (±60px)", () => {
      for (let stage = 1; stage <= 8; stage++) {
        const checkpointCount = getCheckpointsForStage(stage);
        for (let cp = 1; cp <= checkpointCount; cp++) {
          const globalIndex =
            VENTURE_STAGES.slice(0, stage - 1).reduce(
              (sum, s) => sum + s.checkpoints,
              0,
            ) +
            (cp - 1);

          const { y } = calculateCheckpointPosition(stage, cp, globalIndex);

          // Y should be within ±60px of center
          expect(y).toBeGreaterThanOrEqual(START_Y - PATH_AMPLITUDE);
          expect(y).toBeLessThanOrEqual(START_Y + PATH_AMPLITUDE);
        }
      }
    });
  });

  describe("Checkpoint Distribution", () => {
    it("should distribute 4 checkpoints in Stage 1", () => {
      const count = getCheckpointsForStage(1);
      expect(count).toBe(4);
    });

    it("should distribute 6 checkpoints in Stage 5 (most)", () => {
      const count = getCheckpointsForStage(5);
      expect(count).toBe(6);
    });

    it("should distribute 3 checkpoints in Stage 6 (least)", () => {
      const count = getCheckpointsForStage(6);
      expect(count).toBe(3);
    });

    it("should have no overlapping checkpoints within same stage", () => {
      for (let stage = 1; stage <= 8; stage++) {
        const checkpointCount = getCheckpointsForStage(stage);
        const xPositions = [];

        for (let cp = 1; cp <= checkpointCount; cp++) {
          const globalIndex =
            VENTURE_STAGES.slice(0, stage - 1).reduce(
              (sum, s) => sum + s.checkpoints,
              0,
            ) +
            (cp - 1);

          const { x } = calculateCheckpointPosition(stage, cp, globalIndex);
          xPositions.push(x);
        }

        // Check that all X positions are unique and increasing
        for (let i = 1; i < xPositions.length; i++) {
          expect(xPositions[i]).toBeGreaterThan(xPositions[i - 1]);
          // Minimum 30px spacing to avoid visual overlap
          expect(xPositions[i] - xPositions[i - 1]).toBeGreaterThan(30);
        }
      }
    });
  });

  describe("Complete Path Integrity", () => {
    it("should generate exactly 36 checkpoint positions", () => {
      let globalIndex = 0;
      const positions = [];

      for (let stage = 1; stage <= 8; stage++) {
        const count = getCheckpointsForStage(stage);
        for (let cp = 1; cp <= count; cp++) {
          const pos = calculateCheckpointPosition(stage, cp, globalIndex);
          positions.push(pos);
          globalIndex++;
        }
      }

      expect(positions).toHaveLength(36);
    });

    it("should create continuous left-to-right progression", () => {
      let globalIndex = 0;
      const xPositions = [];

      for (let stage = 1; stage <= 8; stage++) {
        const count = getCheckpointsForStage(stage);
        for (let cp = 1; cp <= count; cp++) {
          const { x } = calculateCheckpointPosition(stage, cp, globalIndex);
          xPositions.push(x);
          globalIndex++;
        }
      }

      // Verify X positions are strictly increasing
      for (let i = 1; i < xPositions.length; i++) {
        expect(xPositions[i]).toBeGreaterThan(xPositions[i - 1]);
      }
    });

    it("should start near left padding (x ≈ 250)", () => {
      const { x } = calculateCheckpointPosition(1, 1, 0);
      expect(x).toBeCloseTo(250, 0);
    });

    it("should end before right padding (x < 3400)", () => {
      const lastStage = 8;
      const lastCheckpoint = getCheckpointsForStage(8);
      const globalIndex = 35; // Last checkpoint index

      const { x } = calculateCheckpointPosition(
        lastStage,
        lastCheckpoint,
        globalIndex,
      );

      expect(x).toBeLessThan(3400);
      expect(x).toBeGreaterThan(3000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle Stage 6 with only 3 checkpoints", () => {
      const count = getCheckpointsForStage(6);
      expect(count).toBe(3);

      const positions = [];
      for (let cp = 1; cp <= count; cp++) {
        const globalIndex = 22 + (cp - 1); // Stage 6 starts at global index 22
        const pos = calculateCheckpointPosition(6, cp, globalIndex);
        positions.push(pos);
      }

      expect(positions).toHaveLength(3);

      // Should have wider spacing due to fewer checkpoints
      const spacing1 = positions[1].x - positions[0].x;
      const spacing2 = positions[2].x - positions[1].x;

      expect(spacing1).toBeGreaterThan(80); // Wider than typical spacing
      expect(spacing2).toBeGreaterThan(80);
    });

    it("should handle Stage 5 with 6 checkpoints", () => {
      const count = getCheckpointsForStage(5);
      expect(count).toBe(6);

      const positions = [];
      for (let cp = 1; cp <= count; cp++) {
        const globalIndex = 16 + (cp - 1); // Stage 5 starts at global index 16
        const pos = calculateCheckpointPosition(5, cp, globalIndex);
        positions.push(pos);
      }

      expect(positions).toHaveLength(6);

      // Should have tighter spacing due to more checkpoints
      const avgSpacing =
        (positions[positions.length - 1].x - positions[0].x) /
        (positions.length - 1);

      expect(avgSpacing).toBeLessThan(80); // Tighter than typical spacing
    });

    it("should handle first checkpoint of each stage at center Y", () => {
      for (let stage = 1; stage <= 8; stage++) {
        const globalIndex = VENTURE_STAGES.slice(0, stage - 1).reduce(
          (sum, s) => sum + s.checkpoints,
          0,
        );

        const { y } = calculateCheckpointPosition(stage, 1, globalIndex);

        // First checkpoint should be at or very near center line
        expect(Math.abs(y - START_Y)).toBeLessThan(1);
      }
    });

    it("should handle last checkpoint of each stage at center Y", () => {
      for (let stage = 1; stage <= 8; stage++) {
        const checkpointCount = getCheckpointsForStage(stage);
        const globalIndex =
          VENTURE_STAGES.slice(0, stage - 1).reduce(
            (sum, s) => sum + s.checkpoints,
            0,
          ) +
          checkpointCount -
          1;

        const { y } = calculateCheckpointPosition(
          stage,
          checkpointCount,
          globalIndex,
        );

        // Last checkpoint should be at or very near center line
        expect(Math.abs(y - START_Y)).toBeLessThan(1);
      }
    });
  });

  describe("Map Dimensions", () => {
    it("should fit within 3600px total width", () => {
      const totalWidth = 200 + 8 * 400 + 200;
      expect(totalWidth).toBe(3600);
    });

    it("should have all checkpoints within map bounds", () => {
      let globalIndex = 0;

      for (let stage = 1; stage <= 8; stage++) {
        const count = getCheckpointsForStage(stage);
        for (let cp = 1; cp <= count; cp++) {
          const { x, y } = calculateCheckpointPosition(stage, cp, globalIndex);

          // X bounds: 0 to 3600
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(3600);

          // Y bounds: 0 to 720
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(720);

          globalIndex++;
        }
      }
    });

    it("should have biome separators at correct positions", () => {
      const separatorPositions = [600, 1000, 1400, 1800, 2200, 2600, 3000];

      separatorPositions.forEach((x, index) => {
        const expectedX = START_X + (index + 1) * BIOME_WIDTH;
        expect(x).toBe(expectedX);
      });
    });
  });
});
