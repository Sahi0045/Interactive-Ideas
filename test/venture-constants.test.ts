import { describe, it, expect } from "vitest";
import {
  CHECKPOINT_DEFINITIONS,
  BOSS_DEFINITIONS,
  LEVEL_DEFINITIONS,
  BADGE_DEFINITIONS,
  POINT_VALUES,
  VENTURE_STAGES,
  TOOL_TYPES,
} from "../convex/ventureConstants";

describe("Venture Constants", () => {
  describe("VENTURE_STAGES", () => {
    it("should have exactly 8 stages", () => {
      expect(VENTURE_STAGES).toHaveLength(8);
    });

    it("should have sequential stage IDs from 1 to 8", () => {
      VENTURE_STAGES.forEach((stage, index) => {
        expect(stage.id).toBe(index + 1);
      });
    });

    it("should have checkpoint counts for each stage", () => {
      VENTURE_STAGES.forEach((stage) => {
        expect(stage.checkpoints).toBeGreaterThan(0);
      });
    });

    it("should have 36 total checkpoints", () => {
      const total = VENTURE_STAGES.reduce((sum, s) => sum + s.checkpoints, 0);
      expect(total).toBe(36);
    });
  });

  describe("CHECKPOINT_DEFINITIONS", () => {
    it("should have 36 checkpoint definitions", () => {
      expect(CHECKPOINT_DEFINITIONS).toHaveLength(36);
    });

    it("should have valid stage and checkpoint numbers", () => {
      CHECKPOINT_DEFINITIONS.forEach((cp) => {
        expect(cp.stage).toBeGreaterThanOrEqual(1);
        expect(cp.stage).toBeLessThanOrEqual(8);
        expect(cp.checkpoint).toBeGreaterThan(0);
      });
    });

    it("should have non-empty names and outcomes", () => {
      CHECKPOINT_DEFINITIONS.forEach((cp) => {
        expect(cp.name.length).toBeGreaterThan(0);
        expect(cp.outcome.length).toBeGreaterThan(0);
      });
    });

    it("should have valid tool types for all tasks", () => {
      const validTools = new Set(TOOL_TYPES);
      CHECKPOINT_DEFINITIONS.forEach((cp) => {
        expect(validTools).toContain(cp.t1.tool);
        expect(validTools).toContain(cp.t2.tool);
        expect(validTools).toContain(cp.t3.tool);
      });
    });

    it("should have non-empty prompts for all tasks", () => {
      CHECKPOINT_DEFINITIONS.forEach((cp) => {
        expect(cp.t1.prompt.length).toBeGreaterThan(0);
        expect(cp.t2.prompt.length).toBeGreaterThan(0);
        expect(cp.t3.prompt.length).toBeGreaterThan(0);
      });
    });

    it("should have correct checkpoint distribution per stage", () => {
      const stageCounts = new Map<number, number>();
      CHECKPOINT_DEFINITIONS.forEach((cp) => {
        stageCounts.set(cp.stage, (stageCounts.get(cp.stage) || 0) + 1);
      });

      VENTURE_STAGES.forEach((stage) => {
        expect(stageCounts.get(stage.id)).toBe(stage.checkpoints);
      });
    });
  });

  describe("BOSS_DEFINITIONS", () => {
    it("should have 12 bosses", () => {
      expect(BOSS_DEFINITIONS).toHaveLength(12);
    });

    it("should have unique sequential IDs", () => {
      BOSS_DEFINITIONS.forEach((boss, index) => {
        expect(boss.id).toBe(index + 1);
      });
    });

    it("should have unique names", () => {
      const names = BOSS_DEFINITIONS.map((b) => b.name);
      const uniqueNames = new Set(names);
      expect(names).toHaveLength(uniqueNames.size);
    });

    it("should have non-empty fields", () => {
      BOSS_DEFINITIONS.forEach((boss) => {
        expect(boss.name.length).toBeGreaterThan(0);
        expect(boss.type.length).toBeGreaterThan(0);
        expect(boss.corruption.length).toBeGreaterThan(0);
        expect(boss.represents.length).toBeGreaterThan(0);
        expect(boss.defeatMethod.length).toBeGreaterThan(0);
        expect(boss.retreatOutcome.length).toBeGreaterThan(0);
        expect(boss.slayOutcome.length).toBeGreaterThan(0);
      });
    });
  });

  describe("LEVEL_DEFINITIONS", () => {
    it("should have 50 levels", () => {
      expect(LEVEL_DEFINITIONS).toHaveLength(50);
    });

    it("should have sequential levels from 1 to 50", () => {
      LEVEL_DEFINITIONS.forEach((level, index) => {
        expect(level.level).toBe(index + 1);
      });
    });

    it("should have valid phase values", () => {
      const validPhases = new Set([
        "tutorial",
        "early",
        "mid",
        "senior",
        "mentor",
      ]);
      LEVEL_DEFINITIONS.forEach((level) => {
        expect(validPhases).toContain(level.phase);
      });
    });

    it("should have non-decreasing titlePoints", () => {
      let prevPoints = 0;
      LEVEL_DEFINITIONS.forEach((level) => {
        expect(level.titlePoints).toBeGreaterThanOrEqual(prevPoints);
        prevPoints = level.titlePoints;
      });
    });

    it("should have requirements for each level", () => {
      LEVEL_DEFINITIONS.forEach((level) => {
        expect(level.requirements.length).toBeGreaterThan(0);
      });
    });

    it("should have correct phase transitions", () => {
      expect(LEVEL_DEFINITIONS[0].phase).toBe("tutorial");
      expect(LEVEL_DEFINITIONS[6].phase).toBe("early");
      expect(LEVEL_DEFINITIONS[14].phase).toBe("early");
      expect(LEVEL_DEFINITIONS[15].phase).toBe("mid");
      expect(LEVEL_DEFINITIONS[27].phase).toBe("mid");
      expect(LEVEL_DEFINITIONS[28].phase).toBe("senior");
      expect(LEVEL_DEFINITIONS[38].phase).toBe("senior");
      expect(LEVEL_DEFINITIONS[39].phase).toBe("mentor");
      expect(LEVEL_DEFINITIONS[49].phase).toBe("mentor");
    });
  });

  describe("BADGE_DEFINITIONS", () => {
    it("should have 62 badges", () => {
      expect(BADGE_DEFINITIONS).toHaveLength(62);
    });

    it("should have unique sequential IDs", () => {
      BADGE_DEFINITIONS.forEach((badge, index) => {
        expect(badge.id).toBe(index + 1);
      });
    });

    it("should have unique names", () => {
      const names = BADGE_DEFINITIONS.map((b) => b.name);
      const uniqueNames = new Set(names);
      expect(names).toHaveLength(uniqueNames.size);
    });

    it("should have valid categories", () => {
      const validCategories = new Set([
        "onboarding",
        "idea_milestones",
        "community",
        "consistency",
        "hidden",
        "aspirational",
      ]);
      BADGE_DEFINITIONS.forEach((badge) => {
        expect(validCategories).toContain(badge.category);
      });
    });

    it("should have valid rarity values", () => {
      const validRarities = new Set([
        "common",
        "uncommon",
        "rare",
        "epic",
        "legendary",
        "hidden",
      ]);
      BADGE_DEFINITIONS.forEach((badge) => {
        expect(validRarities).toContain(badge.rarity);
      });
    });

    it("should have valid hex colors", () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      BADGE_DEFINITIONS.forEach((badge) => {
        expect(hexRegex.test(badge.primaryColor)).toBe(true);
        expect(hexRegex.test(badge.secondaryColor)).toBe(true);
      });
    });

    it("should have non-empty fields", () => {
      BADGE_DEFINITIONS.forEach((badge) => {
        expect(badge.name.length).toBeGreaterThan(0);
        expect(badge.shape.length).toBeGreaterThan(0);
        expect(badge.iconDescription.length).toBeGreaterThan(0);
        expect(badge.tagline.length).toBeGreaterThan(0);
        expect(badge.requirement.length).toBeGreaterThan(0);
      });
    });

    it("should have correct category distribution", () => {
      const categoryCounts = BADGE_DEFINITIONS.reduce(
        (acc, badge) => {
          acc[badge.category] = (acc[badge.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(categoryCounts.onboarding).toBe(8);
      expect(categoryCounts.idea_milestones).toBe(18);
      expect(categoryCounts.community).toBe(12);
      expect(categoryCounts.consistency).toBe(8);
      expect(categoryCounts.hidden).toBe(8);
      expect(categoryCounts.aspirational).toBe(8);
    });
  });

  describe("POINT_VALUES", () => {
    it("should have positive point values", () => {
      Object.values(POINT_VALUES).forEach((value) => {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });

    it("should have venture task points", () => {
      expect(POINT_VALUES.task_t1_complete).toBe(20);
      expect(POINT_VALUES.task_t2_complete).toBe(20);
      expect(POINT_VALUES.task_t3_complete).toBe(35);
    });

    it("should have gold checkpoint bonus", () => {
      expect(POINT_VALUES.gold_checkpoint_bonus).toBe(25);
    });

    it("should have stage and venture completion bonuses", () => {
      expect(POINT_VALUES.stage_complete_bonus).toBe(50);
      expect(POINT_VALUES.venture_complete_bonus).toBe(200);
    });

    it("should have boss defeat points", () => {
      expect(POINT_VALUES.boss_retreat).toBe(25);
      expect(POINT_VALUES.boss_slay).toBe(100);
    });
  });

  describe("TOOL_TYPES", () => {
    it("should have 11 tool types", () => {
      expect(TOOL_TYPES).toHaveLength(11);
    });

    it("should include all expected tools", () => {
      const expected = [
        "write",
        "table",
        "map",
        "survey",
        "poll",
        "link",
        "upload",
        "self_report",
        "journal",
        "kanban",
        "calendar",
      ];
      expected.forEach((tool) => {
        expect(TOOL_TYPES).toContain(tool);
      });
    });
  });
});
