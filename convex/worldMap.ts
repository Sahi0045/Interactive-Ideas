import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  BOSS_DEFINITIONS,
  CORRUPTION_RULES,
  getBossEncounterStyle,
  getBossHpFromQuality,
  getBossSlug,
  getProjectOutcome,
  getStageOutcome,
  getBossVisualStatus,
  VENTURE_STAGES,
  POINT_VALUES,
  CHECKPOINT_DEFINITIONS,
  LEVEL_DEFINITIONS,
} from "./ventureConstants";
import { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-computed brightness values returned alongside world map data.
 * These drive the Phaser post-FX pipeline — no further math required client-side.
 */
export interface BrightnessResult {
  /** Contribution from fully-completed stages. Range: 0–60. */
  accumulatedBase: number;
  /** Contribution from task progress within the current stage. Range: 0–40. */
  stageLayer: number;
  /** Total world brightness percentage fed to Phaser. Range: 0–100. */
  worldBrightness: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIGHTNESS CALCULATION (inline — cannot cross the Convex / src boundary)
//
// Formula (two-layer):
//   accumulated base  = completedStages × (60 / 7)  — capped at 60%
//   stage layer       = (tasksDone / tasksTotal) × 40%
//   world brightness  = accumulated base + stage layer   (0–100%)
//
// Worked examples:
//   Stage 1 start          →  0      ×(60/7) +  0/12 ×40 =  0%
//   Entering Stage 2       →  1      ×(60/7) +  0    ×40 ≈  8.57%
//   Mid-Stage 5 (50% done) →  4      ×(60/7) + 0.5   ×40 ≈ 54.28%
//   All 8 stages complete  →  min(7×(60/7), 60) + 40     = 100%
// ─────────────────────────────────────────────────────────────────────────────

const PER_STAGE_CONTRIBUTION = 60 / 7; // ≈ 8.5714…% per completed stage
const MAX_ACCUMULATED = 60;
const MAX_STAGE_LAYER = 40;
type WorldMapDbCtx = MutationCtx["db"];
type WorldMapQueryDbCtx = QueryCtx["db"];

/**
 * Derive brightness inputs from raw ventureCheckpoints rows and the venture's
 * currentStage, then return the three-part BrightnessResult.
 *
 * A "completed stage" is one where every checkpoint for that stage has
 * status === "completed" (or "skipped") and the stage precedes currentStage.
 *
 * Tasks done in the current stage = Σ (t1Completed + t2Completed + t3Completed)
 * across all checkpoints that belong to currentStage.
 */
function computeBrightness(
  checkpoints: Array<{
    stage: number;
    checkpoint: number;
    status: string;
    t1Completed: boolean;
    t2Completed: boolean;
    t3Completed: boolean;
  }>,
  currentStage: number,
): BrightnessResult {
  // ── 1. Count fully-completed prior stages ──────────────────────────────────
  let completedStages = 0;

  for (const stageDef of VENTURE_STAGES) {
    if (stageDef.id >= currentStage) break; // only look at stages before current

    const stageCheckpoints = checkpoints.filter(
      (cp) => cp.stage === stageDef.id,
    );

    // A stage is "complete" when every one of its checkpoints is done.
    // We guard against the edge-case where rows don't exist yet (e.g. fresh venture).
    const allPresent = stageCheckpoints.length >= stageDef.checkpoints;
    const allCompleted = stageCheckpoints.every(
      (cp) => cp.status === "completed" || cp.status === "skipped",
    );

    if (allPresent && allCompleted) {
      completedStages++;
    }
  }

  // ── 2. Count tasks done/total in the current stage ────────────────────────
  const currentStageDef = VENTURE_STAGES.find((s) => s.id === currentStage);
  const totalTasksInCurrentStage = (currentStageDef?.checkpoints ?? 0) * 3; // 3 tasks per checkpoint

  const currentStageCheckpoints = checkpoints.filter(
    (cp) => cp.stage === currentStage,
  );
  let tasksDoneInCurrentStage = 0;
  for (const cp of currentStageCheckpoints) {
    if (cp.t1Completed) tasksDoneInCurrentStage++;
    if (cp.t2Completed) tasksDoneInCurrentStage++;
    if (cp.t3Completed) tasksDoneInCurrentStage++;
  }

  // ── 3. Apply formula ───────────────────────────────────────────────────────
  const accumulatedBase = Math.min(
    completedStages * PER_STAGE_CONTRIBUTION,
    MAX_ACCUMULATED,
  );

  const stageLayer =
    totalTasksInCurrentStage > 0
      ? (tasksDoneInCurrentStage / totalTasksInCurrentStage) * MAX_STAGE_LAYER
      : 0;

  const worldBrightness = Math.min(accumulatedBase + stageLayer, 100);

  return {
    accumulatedBase: Math.round(accumulatedBase * 100) / 100,
    stageLayer: Math.round(stageLayer * 100) / 100,
    worldBrightness: Math.round(worldBrightness * 100) / 100,
  };
}

function deriveLevelFromTitlePoints(titlePoints: number) {
  return LEVEL_DEFINITIONS.reduce((currentLevel, def) => {
    return titlePoints >= def.titlePoints ? def.level : currentLevel;
  }, 1);
}

async function awardPointsAndSyncLevel(
  ctx: { db: WorldMapDbCtx },
  args: {
    userId: Id<"users">;
    amount: number;
    type: string;
    description: string;
    relatedId: string;
    now: number;
  },
) {
  if (args.amount <= 0) return;

  let wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .first();

  if (!wallet) {
    const walletId = await ctx.db.insert("wallets", {
      userId: args.userId,
      balance: 0,
      updatedAt: args.now,
    });
    wallet = await ctx.db.get(walletId);
  }

  if (wallet) {
    await ctx.db.insert("transactions", {
      walletId: wallet._id,
      amount: args.amount,
      type: args.type,
      description: args.description,
      relatedId: args.relatedId,
      createdAt: args.now,
    });

    await ctx.db.patch(wallet._id, {
      balance: wallet.balance + args.amount,
      updatedAt: args.now,
    });
  }

  const userLevel = await ctx.db
    .query("userLevels")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .first();
  if (!userLevel) return;

  const titlePoints = userLevel.titlePoints + args.amount;
  const totalPoints = userLevel.totalPoints + args.amount;
  const targetLevel = deriveLevelFromTitlePoints(titlePoints);

  await ctx.db.patch(userLevel._id, {
    currentLevel: targetLevel,
    titlePoints,
    totalPoints,
    updatedAt: args.now,
  });

  if (targetLevel <= userLevel.currentLevel || !wallet) return;

  for (let level = userLevel.currentLevel + 1; level <= targetLevel; level++) {
    const levelDef = LEVEL_DEFINITIONS.find((def) => def.level === level);
    if (!levelDef) continue;

    await ctx.db.insert("transactions", {
      walletId: wallet._id,
      amount: level * 5,
      type: "level_up",
      description: `Reached level ${level}: ${levelDef.title}`,
      createdAt: args.now,
    });
  }
}

type WorldMapVentureDoc = {
  _id: Id<"ventures">;
  userId: Id<"users">;
  currentStage: number;
  currentCheckpoint: number;
  ideaId: Id<"ideas">;
  corruptionLevel?: number;
  lastActivityAt?: number;
};

type WorldMapCheckpointDoc = {
  _id: Id<"ventureCheckpoints">;
  ventureId: Id<"ventures">;
  stage: number;
  checkpoint: number;
  status: string;
  t1Completed: boolean;
  t2Completed: boolean;
  t3Completed: boolean;
  goldBonusEarned?: boolean;
  partialStartedAt?: number;
  partialDecayAppliedAt?: number;
  completedAt?: number;
};

function getCompletedTaskCount(checkpoint: WorldMapCheckpointDoc) {
  return [
    checkpoint.t1Completed,
    checkpoint.t2Completed,
    checkpoint.t3Completed,
  ].filter(Boolean).length;
}

async function getAverageQualityScore(
  ctx: { db: WorldMapDbCtx | WorldMapQueryDbCtx },
  ventureId: Id<"ventures">,
) {
  const scores = await ctx.db
    .query("qualityScores")
    .withIndex("by_venture", (q) => q.eq("ventureId", ventureId))
    .collect();

  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, score) => sum + score.totalScore, 0);
  return Number((total / scores.length).toFixed(2));
}

async function syncBossCorruptionMirror(
  ctx: { db: WorldMapDbCtx },
  ventureId: Id<"ventures">,
  corruptionLevel: number,
  status?: "active" | "retreated" | "slain",
) {
  const bosses = await ctx.db
    .query("ventureBosses")
    .withIndex("by_venture", (q) => q.eq("ventureId", ventureId))
    .collect();

  for (const boss of bosses) {
    await ctx.db.patch(boss._id, {
      corruptionLevel,
      ...(status ? { status, defeatedAt: Date.now() } : {}),
    });
  }
}

async function adjustVentureCorruption(
  ctx: { db: WorldMapDbCtx },
  ventureId: Id<"ventures">,
  delta: number,
  now: number,
  options?: {
    touchActivity?: boolean;
    maxCap?: number;
  },
) {
  const venture = await ctx.db.get(ventureId);
  if (!venture) return null;

  const maxCap = options?.maxCap ?? CORRUPTION_RULES.max;
  const nextLevel = Math.max(
    0,
    Math.min(maxCap, Math.round((venture.corruptionLevel ?? 0) + delta)),
  );

  await ctx.db.patch(venture._id, {
    corruptionLevel: nextLevel,
    lastActivityAt: options?.touchActivity
      ? now
      : venture.lastActivityAt ?? venture.updatedAt ?? now,
    updatedAt: now,
  });
  await syncBossCorruptionMirror(ctx, venture._id, nextLevel);

  return nextLevel;
}

async function applyContributionUpdateRelief(
  ctx: { db: WorldMapDbCtx },
  ventureId: Id<"ventures">,
  now: number,
) {
  await adjustVentureCorruption(
    ctx,
    ventureId,
    -CORRUPTION_RULES.contributionUpdateReduction,
    now,
    { touchActivity: true },
  );
}

async function applyCheckpointCorruptionDelta(
  ctx: { db: WorldMapDbCtx },
  ventureId: Id<"ventures">,
  previousCheckpoint: WorldMapCheckpointDoc,
  nextCheckpoint: WorldMapCheckpointDoc,
  now: number,
) {
  const previousCompleted = getCompletedTaskCount(previousCheckpoint) >= 2;
  const nextCompleted = getCompletedTaskCount(nextCheckpoint) >= 2;
  const previousGold =
    !!previousCheckpoint.goldBonusEarned ||
    getCompletedTaskCount(previousCheckpoint) === 3;
  const nextGold =
    !!nextCheckpoint.goldBonusEarned || getCompletedTaskCount(nextCheckpoint) === 3;

  let reduction = 0;
  if (!previousCompleted && nextGold) {
    reduction = CORRUPTION_RULES.goldCheckpointClearReduction;
  } else if (!previousCompleted && nextCompleted) {
    reduction = CORRUPTION_RULES.standardCheckpointClearReduction;
  } else if (!previousGold && nextGold) {
    reduction =
      CORRUPTION_RULES.goldCheckpointClearReduction -
      CORRUPTION_RULES.standardCheckpointClearReduction;
  }

  if (reduction > 0) {
    await adjustVentureCorruption(ctx, ventureId, -reduction, now, {
      touchActivity: true,
    });
  }
}

async function syncCheckpointProgressState(
  ctx: { db: WorldMapDbCtx },
  checkpoint: WorldMapCheckpointDoc,
  now: number,
) {
  const completedCount = getCompletedTaskCount(checkpoint);

  if (completedCount === 0) return;

  if (completedCount === 1) {
    await ctx.db.patch(checkpoint._id, {
      status: "in_progress",
      partialStartedAt: checkpoint.partialStartedAt ?? now,
    });
    return;
  }

  await ctx.db.patch(checkpoint._id, {
    status: "completed",
    completedAt: checkpoint.completedAt ?? now,
    partialStartedAt: undefined,
  });
}

async function advanceWorldMapPointerAfterCheckpoint(
  ctx: { db: WorldMapDbCtx },
  venture: WorldMapVentureDoc,
  checkpoint: WorldMapCheckpointDoc,
  now: number,
) {
  if (getCompletedTaskCount(checkpoint) < 2) return;

  const nextCheckpoint = await ctx.db
    .query("ventureCheckpoints")
    .withIndex("by_venture_stage", (q) =>
      q.eq("ventureId", venture._id).eq("stage", checkpoint.stage),
    )
    .filter((q) => q.gt(q.field("checkpoint"), checkpoint.checkpoint))
    .order("asc")
    .first();

  if (nextCheckpoint) {
    const wouldRegress =
      nextCheckpoint.stage < venture.currentStage ||
      (nextCheckpoint.stage === venture.currentStage &&
        nextCheckpoint.checkpoint < venture.currentCheckpoint);

    if (!wouldRegress) {
      await ctx.db.patch(venture._id, {
        currentCheckpoint: nextCheckpoint.checkpoint,
        updatedAt: now,
      });
    }
    return;
  }

  if (checkpoint.stage >= venture.currentStage) {
    await tryAdvanceWorldMapStage(ctx, venture, checkpoint.stage, now);
  }
}

async function buildSuperBossState(
  ctx: { db: WorldMapDbCtx | WorldMapQueryDbCtx },
  venture: {
    _id: Id<"ventures">;
    corruptionLevel?: number;
  },
) {
  const boss = await ctx.db
    .query("ventureBosses")
    .withIndex("by_venture", (q) => q.eq("ventureId", venture._id))
    .first();

  if (!boss) return null;

  const definition = BOSS_DEFINITIONS.find((entry) => entry.id === boss.bossId);
  const averageQualityScore = await getAverageQualityScore(ctx, venture._id);
  const hp = getBossHpFromQuality(averageQualityScore);
  const corruptionLevel = venture.corruptionLevel ?? boss.corruptionLevel ?? 0;

  return {
    ...boss,
    corruptionLevel,
    definition,
    bossName: definition?.name ?? `Boss ${boss.bossId}`,
    bossSlug: getBossSlug(boss.bossId),
    visualStatus: getBossVisualStatus(corruptionLevel),
    encounterStyle: getBossEncounterStyle(averageQualityScore),
    averageQualityScore,
    ...hp,
  };
}

function buildStageStates(
  checkpoints: Array<{
    stage: number;
    checkpoint: number;
    status: string;
    goldBonusEarned?: boolean;
  }>,
) {
  return VENTURE_STAGES.map((stage) => {
    const stageOutcome = getStageOutcome(stage.id, checkpoints);
    return {
      stage: stage.id,
      name: stage.name,
      ...stageOutcome,
      isComplete:
        stageOutcome.outcome === "stage_clear" ||
        stageOutcome.outcome === "gold_stage",
    };
  });
}

async function tryAdvanceWorldMapStage(
  ctx: { db: WorldMapDbCtx; scheduler?: MutationCtx["scheduler"] },
  venture: WorldMapVentureDoc,
  currentStage: number,
  now: number,
) {
  const stageCheckpoints = await ctx.db
    .query("ventureCheckpoints")
    .withIndex("by_venture_stage", (q) =>
      q.eq("ventureId", venture._id).eq("stage", currentStage),
    )
    .collect();

  const allComplete = stageCheckpoints.every((cp) => cp.status === "completed");
  if (!allComplete) return;

  await awardPointsAndSyncLevel(ctx, {
    userId: venture.userId,
    amount: POINT_VALUES.stage_complete_bonus,
    type: `stage_${currentStage}_complete`,
    description: `Stage ${currentStage} completed`,
    relatedId: venture._id,
    now,
  });

  const idea = await ctx.db.get(venture.ideaId);
  const stageName =
    VENTURE_STAGES[currentStage - 1]?.name || `Stage ${currentStage}`;
  const ventureName = idea?.title || "Your Venture";

  await ctx.db.insert("notifications", {
    recipientId: venture.userId,
    senderId: venture.userId,
    type: "venture_stage_complete",
    message: `🎉 ${ventureName} - Stage ${currentStage}: ${stageName} Complete! +${POINT_VALUES.stage_complete_bonus} points`,
    relatedId: venture._id,
    isRead: false,
    createdAt: now,
  });

  if (currentStage < 8) {
    const nextStage = currentStage + 1;
    const firstCheckpointOfNextStage = await ctx.db
      .query("ventureCheckpoints")
      .withIndex("by_venture_stage", (q) =>
        q.eq("ventureId", venture._id).eq("stage", nextStage),
      )
      .order("asc")
      .first();

    if (firstCheckpointOfNextStage) {
      await ctx.db.patch(venture._id, {
        currentStage: nextStage,
        currentCheckpoint: firstCheckpointOfNextStage.checkpoint,
        lastActivityAt: now,
        updatedAt: now,
      });
    }

    return;
  }

  const allCheckpoints = await ctx.db
    .query("ventureCheckpoints")
    .withIndex("by_venture", (q) => q.eq("ventureId", venture._id))
    .collect();
  const stageStates = buildStageStates(allCheckpoints);
  const projectOutcome = getProjectOutcome(stageStates, "completed");

  await ctx.db.patch(venture._id, {
    status: "completed",
    corruptionLevel: 0,
    lastActivityAt: now,
    updatedAt: now,
  });
  await syncBossCorruptionMirror(ctx, venture._id, 0, "slain");
  await awardPointsAndSyncLevel(ctx, {
    userId: venture.userId,
    amount: POINT_VALUES.venture_complete_bonus,
    type:
      projectOutcome === "project_perfect"
        ? "venture_perfect"
        : "venture_complete",
    description:
      projectOutcome === "project_perfect"
        ? "Project perfect completion"
        : "Project completion",
    relatedId: venture._id,
    now,
  });

  await ctx.db.insert("notifications", {
    recipientId: venture.userId,
    senderId: venture.userId,
    type:
      projectOutcome === "project_perfect"
        ? "venture_perfect"
        : "venture_complete",
    message:
      projectOutcome === "project_perfect"
        ? `Project Perfect! Every stage ended in gold. +${POINT_VALUES.venture_complete_bonus} points`
        : `Project Complete! Your venture has crossed every stage. +${POINT_VALUES.venture_complete_bonus} points`,
    relatedId: venture._id,
    isRead: false,
    createdAt: now,
  });

  if (projectOutcome === "project_perfect") {
    await ctx.scheduler?.runAfter(0, internal.badges.awardBadge, {
      userId: venture.userId,
      slug: "legendary-venture-completion",
    });
  }
}

async function syncCheckpointCompletion(
  ctx: { db: WorldMapDbCtx },
  venture: WorldMapVentureDoc,
  checkpoint: WorldMapCheckpointDoc,
  now: number,
) {
  await syncCheckpointProgressState(ctx, checkpoint, now);
  const refreshedCheckpoint = await ctx.db.get(checkpoint._id);
  if (!refreshedCheckpoint) return;
  await advanceWorldMapPointerAfterCheckpoint(
    ctx,
    venture,
    refreshedCheckpoint as WorldMapCheckpointDoc,
    now,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch everything the Phaser WorldMap scene needs for a single venture:
 *  - The venture document (stage, checkpoint, status, bosses)
 *  - All ventureCheckpoint rows (one per checkpoint across all 8 stages)
 *  - Pre-computed brightness breakdown (accumulatedBase / stageLayer / worldBrightness)
 *
 * The caller does NOT need to re-implement the brightness formula — simply
 * forward `brightness.worldBrightness` straight to the `EventBridge`.
 *
 * Returns `null` if the venture does not exist.
 */
export const getWorldMapData = query({
  args: {
    ventureId: v.id("ventures"),
  },
  handler: async (ctx, args) => {
    // ── Venture ───────────────────────────────────────────────────────────────
    const venture = await ctx.db.get(args.ventureId);
    if (!venture) return null;
    const normalizedVenture = {
      ...venture,
      corruptionLevel: venture.corruptionLevel ?? 0,
      lastActivityAt: venture.lastActivityAt ?? venture.updatedAt,
    };

    // ── Idea title (venture name shown in HUD) ────────────────────────────────
    const idea = await ctx.db.get(venture.ideaId);
    const ideaTitle = idea?.title ?? "Unnamed Venture";

    // ── Checkpoints ───────────────────────────────────────────────────────────
    const checkpoints = await ctx.db
      .query("ventureCheckpoints")
      .withIndex("by_venture", (q) => q.eq("ventureId", args.ventureId))
      .collect();

    // ── Tasks (per-checkpoint using index) ─────────────────────────────
    // Fetched via the by_checkpoint index to avoid a full ventureTasks scan.
    const tasksPerCheckpoint = await Promise.all(
      checkpoints.map((cp) =>
        ctx.db
          .query("ventureTasks")
          .withIndex("by_checkpoint", (q) => q.eq("checkpointId", cp._id))
          .collect(),
      ),
    );
    const allTasks = tasksPerCheckpoint.flat();
    const tasksByCheckpoint = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      const key = task.checkpointId as string;
      const existing = tasksByCheckpoint.get(key) ?? [];
      existing.push(task);
      tasksByCheckpoint.set(key, existing);
    }

    // Attach task rows to each checkpoint, enriched with real prompt text
    // from CHECKPOINT_DEFINITIONS so the map panel shows the actual task prompt.
    const checkpointsWithTasks = checkpoints.map((cp) => {
      const cpDef = CHECKPOINT_DEFINITIONS.find(
        (d) => d.stage === cp.stage && d.checkpoint === cp.checkpoint,
      );

      const tasks = (tasksByCheckpoint.get(cp._id as string) ?? [])
        .sort((a, b) => {
          const order: Record<string, number> = { t1: 0, t2: 1, t3: 2 };
          return (order[a.taskLevel] ?? 0) - (order[b.taskLevel] ?? 0);
        })
        .map((task) => {
          // Pull the real prompt from the constant definitions
          const promptKey = task.taskLevel as "t1" | "t2" | "t3";
          const prompt = cpDef?.[promptKey]?.prompt ?? "";
          return { ...task, prompt };
        });

      return {
        ...cp,
        // Expose checkpoint outcome so the panel can display it
        outcome: cpDef?.outcome ?? "",
        checkpointName: cpDef?.name ?? `Checkpoint ${cp.checkpoint}`,
        tasks,
      };
    });

    // ── Brightness ────────────────────────────────────────────────────────────
    const brightness = computeBrightness(checkpoints, venture.currentStage);
    const superBoss = await buildSuperBossState(ctx, normalizedVenture);
    const stageStates = buildStageStates(checkpoints);
    const projectState = getProjectOutcome(stageStates, normalizedVenture.status);

    return {
      venture: normalizedVenture,
      ideaTitle,
      checkpoints: checkpointsWithTasks,
      brightness,
      superBoss,
      stageStates,
      projectState,
    };
  },
});

/**
 * Return all ventures that belong to the currently authenticated user.
 *
 * Auth flow:
 *   1. Resolve Clerk identity from the request.
 *   2. Look up the internal user doc via the `by_clerk_id` index.
 *   3. Query the `ventures` table via the `by_user` index.
 *
 * Returns an empty array for unauthenticated requests or users who have
 * not yet completed onboarding (i.e. no matching user row).
 */
// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight task-completion mutation used by the world-map panel.
 *
 * Marks one task (t1 / t2 / t3) on a checkpoint as done, creates a minimal
 * self-report evidence record, updates the checkpoint flags, and awards the
 * appropriate points.  Does NOT gate on evidence content — the world-map UX
 * treats task toggling as a quick acknowledgement rather than a full submission.
 *
 * Idempotent: calling it a second time for an already-completed task is a no-op.
 */
export const markTaskComplete = mutation({
  args: {
    checkpointId: v.id("ventureCheckpoints"),
    taskLevel: v.union(v.literal("t1"), v.literal("t2"), v.literal("t3")),
  },
  handler: async (ctx, args) => {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const checkpoint = await ctx.db.get(args.checkpointId);
    if (!checkpoint) throw new Error("Checkpoint not found");
    const checkpointBeforeUpdate = checkpoint as WorldMapCheckpointDoc;

    // ── Idempotency guard ─────────────────────────────────────────────────────
    const flagField =
      args.taskLevel === "t1"
        ? "t1Completed"
        : args.taskLevel === "t2"
          ? "t2Completed"
          : "t3Completed";

    if (checkpoint[flagField]) return { alreadyDone: true };

    // ── Ownership ─────────────────────────────────────────────────────────────
    const venture = await ctx.db.get(checkpoint.ventureId);
    if (!venture) throw new Error("Venture not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");
    if (venture.userId !== user._id) throw new Error("Not your venture");

    // ── Find the task row ────────────────────────────────────────────────────
    const task = await ctx.db
      .query("ventureTasks")
      .filter((q) =>
        q.and(
          q.eq(q.field("checkpointId"), args.checkpointId),
          q.eq(q.field("taskLevel"), args.taskLevel),
        ),
      )
      .first();

    if (!task)
      throw new Error(`Task ${args.taskLevel} not found for checkpoint`);

    const now = Date.now();

    // ── Create minimal evidence (self-report) ─────────────────────────────────
    const evidenceId = await ctx.db.insert("ventureEvidence", {
      taskId: task._id,
      userId: user._id,
      toolType: "self_report",
      content: { note: "Marked complete from world map", completedAt: now },
      createdAt: now,
    });

    // ── Mark task done ────────────────────────────────────────────────────────
    await ctx.db.patch(task._id, {
      status: "completed",
      evidenceId,
      completedAt: now,
    });

    // ── Update checkpoint flag (and check for gold) ───────────────────────────
    const updatedFlags = {
      t1Completed: checkpoint.t1Completed,
      t2Completed: checkpoint.t2Completed,
      t3Completed: checkpoint.t3Completed,
      [flagField]: true,
    };

    const allThreeDone =
      updatedFlags.t1Completed &&
      updatedFlags.t2Completed &&
      updatedFlags.t3Completed;

    const cpPatch: Record<string, unknown> = {
      [flagField]: true,
    };

    if (allThreeDone && !checkpoint.goldBonusEarned) {
      cpPatch.goldBonusEarned = true;
      await awardPointsAndSyncLevel(ctx, {
        userId: user._id,
        amount: POINT_VALUES.gold_checkpoint_bonus,
        type: "gold_checkpoint",
        description: "Gold checkpoint bonus — all 3 tasks complete",
        relatedId: checkpoint._id,
        now,
      });

      // Create social feed notification for gold checkpoint
      const idea = await ctx.db.get(venture.ideaId);
      const stageName =
        VENTURE_STAGES[checkpoint.stage - 1]?.name ||
        `Stage ${checkpoint.stage}`;
      const checkpointDef = CHECKPOINT_DEFINITIONS.find(
        (cp) =>
          cp.stage === checkpoint.stage &&
          cp.checkpoint === checkpoint.checkpoint,
      );
      const checkpointName =
        checkpointDef?.name || `Checkpoint ${checkpoint.checkpoint}`;
      const ventureName = idea?.title || "Your Venture";

      await ctx.db.insert("notifications", {
        recipientId: user._id,
        senderId: user._id,
        type: "gold_checkpoint",
        message: `🏆 ${ventureName} - ${stageName}: ${checkpointName} - Gold Checkpoint! All 3 tasks completed. +${POINT_VALUES.gold_checkpoint_bonus} points`,
        relatedId: venture._id,
        isRead: false,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.checkpointId, cpPatch);
    const patchedCheckpoint = await ctx.db.get(args.checkpointId);
    if (patchedCheckpoint) {
      await applyContributionUpdateRelief(ctx, venture._id, now);
      await applyCheckpointCorruptionDelta(
        ctx,
        venture._id,
        checkpointBeforeUpdate,
        patchedCheckpoint as WorldMapCheckpointDoc,
        now,
      );
      await syncCheckpointCompletion(
        ctx,
        venture as WorldMapVentureDoc,
        patchedCheckpoint as WorldMapCheckpointDoc,
        now,
      );
    }

    // ── Award task points ─────────────────────────────────────────────────────
    const pointKey =
      `task_${args.taskLevel}_complete` as keyof typeof POINT_VALUES;
    const pts = POINT_VALUES[pointKey] as number | undefined;

    if (pts) {
      await awardPointsAndSyncLevel(ctx, {
        userId: user._id,
        amount: pts,
        type: `${args.taskLevel}_task_complete`,
        description: `Task ${args.taskLevel.toUpperCase()} completed`,
        relatedId: venture._id,
        now,
      });
    }

    // ── Trigger AI quality scoring (async, non-blocking) ──────────────────────
    const checkpointDef = CHECKPOINT_DEFINITIONS.find(
      (d) =>
        d.stage === checkpoint.stage && d.checkpoint === checkpoint.checkpoint,
    );
    await ctx.scheduler.runAfter(0, api.aiScoring.evaluateTaskSubmission, {
      taskId: task._id,
      checkpointId: args.checkpointId,
      ventureId: checkpoint.ventureId,
      stageNumber: checkpoint.stage,
      content: `Self-report: World-map task ${args.taskLevel.toUpperCase()} marked complete. Stage ${checkpoint.stage}, Checkpoint ${checkpoint.checkpoint}.`,
      checkpointOutcome: checkpointDef?.outcome ?? "",
      userTier: "free",
    });

    return {
      success: true,
      goldEarned: allThreeDone && !checkpoint.goldBonusEarned,
    };
  },
});

export const getVenturesByUser = query({
  args: {},
  handler: async (ctx) => {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const clerkId = identity.subject;

    // ── User lookup ───────────────────────────────────────────────────────────
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) return [];

    // ── Ventures ──────────────────────────────────────────────────────────────
    const ventures = await ctx.db
      .query("ventures")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return ventures
      .map((venture) => ({
        ...venture,
        corruptionLevel: venture.corruptionLevel ?? 0,
        lastActivityAt: venture.lastActivityAt ?? venture.updatedAt,
      }))
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1;
        }
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      });
  },
});

export const getToolData = query({
  args: {
    ventureId: v.id("ventures"),
    toolType: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const toolDoc = await ctx.db
      .query("ventureTools")
      .withIndex("by_venture_tool", (q) =>
        q.eq("ventureId", args.ventureId).eq("toolType", args.toolType),
      )
      .first();

    return toolDoc?.data ?? null;
  },
});

export const saveToolData = mutation({
  args: {
    ventureId: v.id("ventures"),
    toolType: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const venture = await ctx.db.get(args.ventureId);
    if (!venture) throw new Error("Venture not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || venture.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("ventureTools")
      .withIndex("by_venture_tool", (q) =>
        q.eq("ventureId", args.ventureId).eq("toolType", args.toolType),
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { data: args.data, updatedAt: now });
    } else {
      await ctx.db.insert("ventureTools", {
        ventureId: args.ventureId,
        toolType: args.toolType,
        data: args.data,
        updatedAt: now,
      });
    }

    await ctx.db.patch(venture._id, {
      lastActivityAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const savePersonaGender = mutation({
  args: {
    ventureId: v.id("ventures"),
    gender: v.union(v.literal("male"), v.literal("female")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const venture = await ctx.db.get(args.ventureId);
    if (!venture) throw new Error("Venture not found");
    await ctx.db.patch(args.ventureId, {
      personaGender: args.gender,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOOL-SPECIFIC CONTENT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates submission content based on tool type.
 *
 * - Text tools (write, journal): Enforce 50-word minimum
 * - Structured tools (table, map, kanban, calendar): Validate data structure exists
 * - Upload tool: Verify file IDs exist
 * - Survey/poll: Verify questions/options exist
 * - Self-report: Verify required fields are filled
 *
 * @throws Error with tool-specific validation message
 */
function normalizeToolContent(content: unknown): unknown {
  if (typeof content !== "string") return content;

  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function validateToolContent(toolType: string, content: unknown): void {
  const parsed = normalizeToolContent(content);

  switch (toolType) {
    case "write":
    case "journal": {
      // Extract text from structured content or use raw string
      const text =
        typeof parsed === "object" && parsed !== null && "text" in parsed
          ? String((parsed as { text: unknown }).text)
          : typeof parsed === "string"
            ? parsed
            : String(content ?? "");

      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < 50) {
        throw new Error(
          `Content must be at least 50 words. Current: ${wordCount} words.`,
        );
      }
      break;
    }

    case "table": {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Table data must be a valid object.");
      }
      const data = parsed as { headers?: unknown; rows?: unknown };

      if (!Array.isArray(data.headers) || data.headers.length === 0) {
        throw new Error("Table must have at least one column header.");
      }
      if (!Array.isArray(data.rows) || data.rows.length === 0) {
        throw new Error("Table must have at least one row of data.");
      }
      break;
    }

    case "map": {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Map data must be a valid object.");
      }
      const data = parsed as { elements?: unknown };

      if (!Array.isArray(data.elements) || data.elements.length === 0) {
        throw new Error(
          "Mind map must have at least one element (node or connection).",
        );
      }
      break;
    }

    case "kanban": {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Kanban data must be a valid object.");
      }
      const data = parsed as { cards?: unknown; columns?: unknown };

      if (!Array.isArray(data.cards) || data.cards.length === 0) {
        throw new Error("Kanban board must have at least one card.");
      }
      if (!Array.isArray(data.columns) || data.columns.length === 0) {
        throw new Error("Kanban board must have at least one column.");
      }
      break;
    }

    case "calendar": {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Calendar data must be a valid object.");
      }
      const data = parsed as { events?: unknown };

      if (!Array.isArray(data.events) || data.events.length === 0) {
        throw new Error("Calendar must have at least one event.");
      }
      break;
    }

    case "survey": {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Survey data must be a valid object.");
      }
      const data = parsed as { questions?: unknown; responses?: unknown };

      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error("Survey must have at least one question.");
      }
      if (!Array.isArray(data.responses) || data.responses.length === 0) {
        throw new Error("Survey must include at least one collected response.");
      }
      break;
    }

    case "poll": {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Poll data must be a valid object.");
      }
      const data = parsed as {
        question?: unknown;
        options?: unknown;
        published?: unknown;
      };

      if (typeof data.question !== "string" || !data.question.trim()) {
        throw new Error("Poll must have a question.");
      }
      if (!Array.isArray(data.options) || data.options.length < 2) {
        throw new Error("Poll must have at least two options.");
      }
      if (data.published !== true) {
        throw new Error("Poll must be published before submission.");
      }
      break;
    }

    case "link":
    case "oauth": {
      // "oauth" is a legacy database value from an older tool registry.
      // Treat legacy OAuth evidence as a link-style submission so old rows remain usable
      // while new tasks continue to be generated only from PRD-approved TOOL_TYPES.
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Link data must be a valid object.");
      }
      const data = parsed as { url?: unknown };

      if (typeof data.url !== "string" || !data.url.trim()) {
        throw new Error("Link must have a URL.");
      }
      // Basic URL validation
      try {
        new URL(data.url);
      } catch {
        throw new Error("Link must be a valid URL.");
      }
      break;
    }

    case "upload": {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Upload data must be a valid object.");
      }
      const data = parsed as { storageId?: unknown; fileName?: unknown };

      if (typeof data.storageId !== "string" || !data.storageId.trim()) {
        throw new Error("Upload must have a valid file storage ID.");
      }
      if (typeof data.fileName !== "string" || !data.fileName.trim()) {
        throw new Error("Upload must have a file name.");
      }
      break;
    }

    case "self_report": {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Self-report data must be a valid object.");
      }
      const data = parsed as { values?: unknown; confirmed?: unknown };

      if (typeof data.values !== "object" || data.values === null) {
        throw new Error("Self-report must have values.");
      }
      const values = data.values as Record<string, unknown>;
      const hasAnyValue = Object.keys(values).length > 0;
      if (!hasAnyValue) {
        throw new Error("Self-report must have at least one field filled.");
      }
      if (data.confirmed !== true) {
        throw new Error("Self-report must be confirmed before submission.");
      }
      break;
    }

    default:
      // Unknown tool type - apply basic validation
      if (
        (typeof content === "string" && !content.trim()) ||
        content === null ||
        content === undefined
      ) {
        throw new Error("Content cannot be empty.");
      }
  }
}

/**
 * Submit actual content for a task (replaces simple checkbox toggle).
 *
 * This mutation:
 * 1. Validates content (minimum 50 words)
 * 2. Creates evidence record with actual content
 * 3. Marks task as complete
 * 4. Updates checkpoint flags
 * 5. Awards points
 * 6. Checks for gold checkpoint completion
 */
export const submitTaskContent = mutation({
  args: {
    checkpointId: v.id("ventureCheckpoints"),
    taskLevel: v.union(v.literal("t1"), v.literal("t2"), v.literal("t3")),
    content: v.any(),
  },
  handler: async (ctx, args) => {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    // ── Get checkpoint ────────────────────────────────────────────────────────
    const checkpoint = await ctx.db.get(args.checkpointId);
    if (!checkpoint) throw new Error("Checkpoint not found");
    const checkpointBeforeUpdate = checkpoint as WorldMapCheckpointDoc;

    // ── Verify ownership ──────────────────────────────────────────────────────
    const venture = await ctx.db.get(checkpoint.ventureId);
    if (!venture) throw new Error("Venture not found");
    if (venture.userId !== user._id) throw new Error("Not your venture");

    // ── Check if already completed ────────────────────────────────────────────
    const flagField =
      args.taskLevel === "t1"
        ? "t1Completed"
        : args.taskLevel === "t2"
          ? "t2Completed"
          : "t3Completed";

    if (checkpoint[flagField]) {
      throw new Error("Task already completed");
    }

    // ── Find task row ─────────────────────────────────────────────────────────
    const task = await ctx.db
      .query("ventureTasks")
      .filter((q) =>
        q.and(
          q.eq(q.field("checkpointId"), args.checkpointId),
          q.eq(q.field("taskLevel"), args.taskLevel),
        ),
      )
      .first();

    if (!task) throw new Error(`Task ${args.taskLevel} not found`);

    // ── Validate content based on tool type ───────────────────────────────────
    validateToolContent(task.toolType, args.content);

    const now = Date.now();

    // ── Parse and store tool-specific content ────────────────────────────────────
    const parsedContent = normalizeToolContent(args.content);

    // For text tools, ensure word count is preserved; for others, store the parsed structure
    const evidenceContent =
      task.toolType === "write" || task.toolType === "journal"
        ? {
            ...(typeof parsedContent === "object" && parsedContent !== null
              ? parsedContent
              : { text: String(args.content ?? "") }),
            submittedAt: now,
          }
        : {
            ...(typeof parsedContent === "object" && parsedContent !== null
              ? parsedContent
              : {}),
            submittedAt: now,
          };

    const evidenceId = await ctx.db.insert("ventureEvidence", {
      taskId: task._id,
      userId: user._id,
      toolType: task.toolType,
      content: evidenceContent,
      createdAt: now,
    });

    // ── Mark task complete ────────────────────────────────────────────────────
    await ctx.db.patch(task._id, {
      status: "completed",
      evidenceId,
      completedAt: now,
    });

    // ── Update checkpoint flags ───────────────────────────────────────────────
    const updatedFlags = {
      t1Completed: checkpoint.t1Completed,
      t2Completed: checkpoint.t2Completed,
      t3Completed: checkpoint.t3Completed,
      [flagField]: true,
    };

    const allThreeDone =
      updatedFlags.t1Completed &&
      updatedFlags.t2Completed &&
      updatedFlags.t3Completed;

    const cpPatch: Record<string, unknown> = {
      [flagField]: true,
    };

    // ── Check for gold checkpoint ─────────────────────────────────────────────
    if (allThreeDone && !checkpoint.goldBonusEarned) {
      cpPatch.goldBonusEarned = true;

      // Award gold bonus
      await awardPointsAndSyncLevel(ctx, {
        userId: user._id,
        amount: POINT_VALUES.gold_checkpoint_bonus,
        type: "gold_checkpoint",
        description: "Gold checkpoint bonus — all 3 tasks complete",
        relatedId: venture._id,
        now,
      });

      // Create notification
      const idea = await ctx.db.get(venture.ideaId);
      const stageName =
        VENTURE_STAGES[checkpoint.stage - 1]?.name ||
        `Stage ${checkpoint.stage}`;
      const checkpointDef = CHECKPOINT_DEFINITIONS.find(
        (cp) =>
          cp.stage === checkpoint.stage &&
          cp.checkpoint === checkpoint.checkpoint,
      );
      const checkpointName =
        checkpointDef?.name || `Checkpoint ${checkpoint.checkpoint}`;
      const ventureName = idea?.title || "Your Venture";

      await ctx.db.insert("notifications", {
        recipientId: user._id,
        senderId: user._id,
        type: "gold_checkpoint",
        message: `🏆 ${ventureName} - ${stageName}: ${checkpointName} - Gold Checkpoint! All 3 tasks completed. +${POINT_VALUES.gold_checkpoint_bonus} points`,
        relatedId: venture._id,
        isRead: false,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.checkpointId, cpPatch);
    const patchedCheckpoint = await ctx.db.get(args.checkpointId);
    if (patchedCheckpoint) {
      await applyContributionUpdateRelief(ctx, venture._id, now);
      await applyCheckpointCorruptionDelta(
        ctx,
        venture._id,
        checkpointBeforeUpdate,
        patchedCheckpoint as WorldMapCheckpointDoc,
        now,
      );
      await syncCheckpointCompletion(
        ctx,
        venture as WorldMapVentureDoc,
        patchedCheckpoint as WorldMapCheckpointDoc,
        now,
      );
    }

    // ── Award task points ─────────────────────────────────────────────────────
    const pointKey =
      `task_${args.taskLevel}_complete` as keyof typeof POINT_VALUES;
    const pts = POINT_VALUES[pointKey] as number | undefined;

    if (pts) {
      await awardPointsAndSyncLevel(ctx, {
        userId: user._id,
        amount: pts,
        type: `${args.taskLevel}_task_complete`,
        description: `Task ${args.taskLevel.toUpperCase()} completed`,
        relatedId: venture._id,
        now,
      });
    }

    // ── Trigger AI quality scoring (async, non-blocking) ──────────────────────
    const checkpointDefForScore = CHECKPOINT_DEFINITIONS.find(
      (d) =>
        d.stage === checkpoint.stage && d.checkpoint === checkpoint.checkpoint,
    );
    const contentForScore =
      typeof args.content === "string"
        ? args.content
        : JSON.stringify(args.content ?? "");
    if (contentForScore.trim().split(/\s+/).length >= 10) {
      await ctx.scheduler.runAfter(0, api.aiScoring.evaluateTaskSubmission, {
        taskId: task._id,
        checkpointId: args.checkpointId,
        ventureId: checkpoint.ventureId,
        stageNumber: checkpoint.stage,
        content: contentForScore,
        checkpointOutcome: checkpointDefForScore?.outcome ?? "",
        userTier: "free",
      });
    }

    return {
      success: true,
      goldEarned: allThreeDone && !checkpoint.goldBonusEarned,
      pointsAwarded: pts || 0,
    };
  },
});
