import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  CHECKPOINT_DEFINITIONS,
  BOSS_DEFINITIONS,
  CORRUPTION_RULES,
  getBossEncounterStyle,
  getBossHpFromQuality,
  getBossSlug,
  getProjectOutcome,
  getStageOutcome,
  getBossVisualStatus,
  POINT_VALUES,
  VENTURE_STAGES,
} from "./ventureConstants";
import { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a URL for uploading files to Convex storage.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a new venture from an existing idea.
 * Initializes all checkpoints and tasks for all 8 stages.
 * Assigns exactly one random Super Boss from the pool.
 */
export const createVenture = mutation({
  args: {
    ideaId: v.id("ideas"),
    skills: v.optional(v.array(v.string())),
    industries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const clerkId = identity.subject;

    // Look up user by clerkId
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Verify the idea exists and belongs to this user
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.authorId !== user._id) {
      throw new Error("Only the idea author can create a venture");
    }

    // Check if a venture already exists for this idea
    const existing = await ctx.db
      .query("ventures")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .first();

    if (existing) return existing._id;

    const now = Date.now();

    // Create the venture
    const ventureId = await ctx.db.insert("ventures", {
      ideaId: args.ideaId,
      userId: user._id,
      currentStage: 1,
      currentCheckpoint: 1,
      corruptionLevel: 0,
      lastActivityAt: now,
      status: "active",
      assignedBosses: [],
      skills: args.skills,
      industries: args.industries,
      createdAt: now,
      updatedAt: now,
    });

    // Initialize all checkpoints and tasks for all 8 stages
    for (const cpDef of CHECKPOINT_DEFINITIONS) {
      const checkpointId = await ctx.db.insert("ventureCheckpoints", {
        ventureId,
        stage: cpDef.stage,
        checkpoint: cpDef.checkpoint,
        status: "not_started",
        t1Completed: false,
        t2Completed: false,
        t3Completed: false,
        goldBonusEarned: false,
        partialStartedAt: undefined,
        partialDecayAppliedAt: undefined,
      });

      // Create T1 task
      await ctx.db.insert("ventureTasks", {
        checkpointId,
        taskLevel: "t1",
        toolType: cpDef.t1.tool,
        status: "not_started",
      });

      // Create T2 task
      await ctx.db.insert("ventureTasks", {
        checkpointId,
        taskLevel: "t2",
        toolType: cpDef.t2.tool,
        status: "not_started",
      });

      // Create T3 task
      await ctx.db.insert("ventureTasks", {
        checkpointId,
        taskLevel: "t3",
        toolType: cpDef.t3.tool,
        status: "not_started",
      });
    }

    const bossIds = shuffle(BOSS_DEFINITIONS.map((b) => b.id)).slice(0, 1);
    const assignedBossId = bossIds[0];

    if (assignedBossId === undefined) {
      throw new Error("Failed to assign a super boss");
    }

    await ctx.db.insert("ventureBosses", {
      ventureId,
      bossId: assignedBossId,
      status: "active",
      corruptionLevel: 0,
      bossSpecificCounters: {},
      assignedAt: now,
    });

    // Update venture with assigned bosses
    await ctx.db.patch(ventureId, {
      assignedBosses: bossIds,
      updatedAt: now,
    });

    // Award points for creating a venture
    await awardPoints(
      ctx,
      user._id,
      POINT_VALUES.create_idea,
      "venture_created",
      ventureId,
    );

    return ventureId;
  },
});

/**
 * Backfill missing checkpoint/task rows for older ventures and re-sync the
 * current active stage/checkpoint from persisted completion state.
 */
export const ensureVentureStructure = mutation({
  args: {
    ventureId: v.id("ventures"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const venture = await ctx.db.get(args.ventureId);
    if (!venture) throw new Error("Venture not found");

    const user = await getUserByClerkId(ctx, identity.subject);
    if (venture.userId !== user._id) {
      throw new Error("Not your venture");
    }

    const existingCheckpoints = await ctx.db
      .query("ventureCheckpoints")
      .withIndex("by_venture", (q) => q.eq("ventureId", venture._id))
      .collect();

    const checkpointByKey = new Map(
      existingCheckpoints.map((checkpoint) => [
        `${checkpoint.stage}-${checkpoint.checkpoint}`,
        checkpoint,
      ]),
    );

    let insertedCheckpoints = 0;
    let insertedTasks = 0;

    for (const cpDef of CHECKPOINT_DEFINITIONS) {
      const key = `${cpDef.stage}-${cpDef.checkpoint}`;
      let checkpoint = checkpointByKey.get(key);

      if (!checkpoint) {
        const checkpointId = await ctx.db.insert("ventureCheckpoints", {
          ventureId: venture._id,
          stage: cpDef.stage,
          checkpoint: cpDef.checkpoint,
          status: "not_started",
          t1Completed: false,
          t2Completed: false,
          t3Completed: false,
          goldBonusEarned: false,
          partialStartedAt: undefined,
          partialDecayAppliedAt: undefined,
        });

        const insertedCheckpoint = await ctx.db.get(checkpointId);
        if (insertedCheckpoint) {
          checkpoint = insertedCheckpoint;
          checkpointByKey.set(key, insertedCheckpoint);
          insertedCheckpoints++;
        }
      }

      if (!checkpoint) continue;

      const existingTasks = await ctx.db
        .query("ventureTasks")
        .withIndex("by_checkpoint", (q) => q.eq("checkpointId", checkpoint._id))
        .collect();

      const existingTaskLevels = new Set(
        existingTasks.map((task) => task.taskLevel),
      );

      for (const taskLevel of ["t1", "t2", "t3"] as const) {
        if (existingTaskLevels.has(taskLevel)) continue;

        await ctx.db.insert("ventureTasks", {
          checkpointId: checkpoint._id,
          taskLevel,
          toolType: cpDef[taskLevel].tool,
          status: "not_started",
        });
        insertedTasks++;
      }
    }

    const refreshedCheckpoints = await ctx.db
      .query("ventureCheckpoints")
      .withIndex("by_venture", (q) => q.eq("ventureId", venture._id))
      .collect();

    const now = Date.now();
    const venturePatch: Partial<{
      corruptionLevel: number;
      lastActivityAt: number;
      updatedAt: number;
    }> = {};

    if (typeof venture.corruptionLevel !== "number") {
      venturePatch.corruptionLevel = 0;
    }
    if (typeof venture.lastActivityAt !== "number") {
      venturePatch.lastActivityAt = venture.updatedAt ?? now;
    }
    if (Object.keys(venturePatch).length > 0) {
      venturePatch.updatedAt = now;
      await ctx.db.patch(venture._id, venturePatch);
    }

    // Auto-heal checkpoints so the persisted status matches the 2-of-3 gate.
    for (const cp of refreshedCheckpoints) {
      const completedCount = [
        cp.t1Completed,
        cp.t2Completed,
        cp.t3Completed,
      ].filter(Boolean).length;

      if (completedCount >= 2 && cp.status !== "completed") {
        await ctx.db.patch(cp._id, {
          status: "completed",
          completedAt: cp.completedAt ?? now,
          partialStartedAt: undefined,
        });
        cp.status = "completed"; // mutate local copy for downstream logic
      } else if (completedCount === 1 && cp.status !== "in_progress") {
        await ctx.db.patch(cp._id, {
          status: "in_progress",
          partialStartedAt: cp.partialStartedAt ?? now,
        });
        cp.status = "in_progress";
      }
    }

    const orderedCheckpoints = refreshedCheckpoints.sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage;
      return a.checkpoint - b.checkpoint;
    });

    // Find the first checkpoint that still needs work.
    const nextCheckpoint =
      orderedCheckpoints.find(
        (checkpoint) => checkpoint.status !== "completed",
      ) ?? null;

    if (nextCheckpoint) {
      // ── ANTI-REGRESSION GUARD ─────────────────────────────────────────────
      // Only advance the venture pointer — never move it backward.
      // "backward" means nextCheckpoint is earlier than the current DB position.
      const currentIsAhead =
        nextCheckpoint.stage < venture.currentStage ||
        (nextCheckpoint.stage === venture.currentStage &&
          nextCheckpoint.checkpoint < venture.currentCheckpoint);

      if (!currentIsAhead) {
        // Safe to update — only moves forward or stays on the same CP.
        if (
          venture.currentStage !== nextCheckpoint.stage ||
          venture.currentCheckpoint !== nextCheckpoint.checkpoint
        ) {
          await ctx.db.patch(venture._id, {
            currentStage: nextCheckpoint.stage,
            currentCheckpoint: nextCheckpoint.checkpoint,
            updatedAt: now,
          });
        }
      }
      // If currentIsAhead: the DB pointer is already past this checkpoint.
      // Leave the venture pointer where it is — do NOT regress it.
    } else if (venture.status !== "completed") {
      await ctx.db.patch(venture._id, {
        status: "completed",
        updatedAt: now,
      });
    }

    return {
      success: true,
      insertedCheckpoints,
      insertedTasks,
    };
  },
});

/**
 * Start working on a checkpoint — transitions from not_started to in_progress.
 */
export const startCheckpoint = mutation({
  args: {
    checkpointId: v.id("ventureCheckpoints"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const checkpoint = await ctx.db.get(args.checkpointId);
    if (!checkpoint) throw new Error("Checkpoint not found");

    // Verify ownership
    const venture = await ctx.db.get(checkpoint.ventureId);
    if (!venture) throw new Error("Venture not found");

    const user = await getUserByClerkId(ctx, identity.subject);
    if (venture.userId !== user._id) {
      throw new Error("Not your venture");
    }

    if (checkpoint.status === "not_started") {
      await ctx.db.patch(args.checkpointId, {
        status: "in_progress",
      });
      await ctx.db.patch(venture._id, {
        lastActivityAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Validate contribution requirements based on tool type.
 * Returns { valid: boolean, reason?: string }
 */
function validateContributionRequirement(
  toolType: string,
  content: unknown,
  storageId?: string,
): { valid: boolean; reason?: string } {
  // For write/text tool, require minimum 50 words
  if (toolType === "write") {
    if (!content || typeof content !== "object" || !("text" in content)) {
      return { valid: false, reason: "Text content is required" };
    }

    const contentObj = content as { text?: string; wordCount?: number };
    if (!contentObj.text) {
      return { valid: false, reason: "Text content is required" };
    }

    const wordCount =
      contentObj.wordCount ||
      (contentObj.text.trim() ? contentObj.text.trim().split(/\s+/).length : 0);

    if (wordCount < 50) {
      return {
        valid: false,
        reason: `Contribution too short. Please write at least 50 words. (Current: ${wordCount} words)`,
      };
    }

    return { valid: true };
  }

  // For upload tool, require file to exist (storageId or in content)
  if (toolType === "upload") {
    const contentObj =
      content && typeof content === "object" && "storageId" in content
        ? (content as { storageId?: string })
        : null;
    const uploadStorageId = storageId || contentObj?.storageId;
    if (!uploadStorageId) {
      return {
        valid: false,
        reason: "File upload is required. Please upload a file.",
      };
    }
    return { valid: true };
  }

  if (toolType === "survey") {
    const survey =
      content && typeof content === "object"
        ? (content as { questions?: unknown; responses?: unknown })
        : null;
    if (!survey || !Array.isArray(survey.questions) || survey.questions.length === 0) {
      return { valid: false, reason: "Survey must include at least one question." };
    }
    if (!Array.isArray(survey.responses) || survey.responses.length === 0) {
      return {
        valid: false,
        reason: "Survey must include at least one collected response.",
      };
    }
    return { valid: true };
  }

  if (toolType === "poll") {
    const poll =
      content && typeof content === "object"
        ? (content as {
            question?: unknown;
            options?: unknown;
            published?: unknown;
          })
        : null;
    if (!poll || typeof poll.question !== "string" || !poll.question.trim()) {
      return { valid: false, reason: "Poll question is required." };
    }
    if (!Array.isArray(poll.options) || poll.options.length < 2) {
      return { valid: false, reason: "Poll must have at least two options." };
    }
    if (poll.published !== true) {
      return { valid: false, reason: "Poll must be published before submission." };
    }
    return { valid: true };
  }

  // For other tools (table, map, survey, poll, link, oauth, self_report)
  // just ensure content exists
  if (!content) {
    return { valid: false, reason: "Contribution content is required" };
  }

  return { valid: true };
}

/**
 * Submit evidence for a task.
 * Creates the evidence record and links it to the task.
 */
export const submitEvidence = mutation({
  args: {
    taskId: v.id("ventureTasks"),
    content: v.any(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const checkpoint = await ctx.db.get(task.checkpointId);
    if (!checkpoint) throw new Error("Checkpoint not found");
    const checkpointBeforeUpdate = checkpoint as CheckpointProgressDoc;

    const venture = await ctx.db.get(checkpoint.ventureId);
    if (!venture) throw new Error("Venture not found");

    const user = await getUserByClerkId(ctx, identity.subject);
    if (venture.userId !== user._id) {
      throw new Error("Not your venture");
    }

    // Validate contribution requirements
    const validation = validateContributionRequirement(
      task.toolType,
      args.content,
      args.storageId,
    );

    if (!validation.valid) {
      throw new Error(validation.reason || "Invalid contribution");
    }

    const now = Date.now();

    // Create evidence record
    const evidenceId = await ctx.db.insert("ventureEvidence", {
      taskId: args.taskId,
      userId: user._id,
      toolType: task.toolType,
      content: args.content,
      storageId: args.storageId,
      createdAt: now,
    });

    // Update task
    await ctx.db.patch(args.taskId, {
      status: "completed",
      evidenceId,
      completedAt: now,
    });

    // Update checkpoint completion flags
    const flagField = `${task.taskLevel}Completed` as
      | "t1Completed"
      | "t2Completed"
      | "t3Completed";
    await ctx.db.patch(checkpoint._id, {
      [flagField]: true,
    });

    // Re-read checkpoint to check if all three are now complete
    const updatedCheckpoint = await ctx.db.get(checkpoint._id);
    if (
      updatedCheckpoint &&
      updatedCheckpoint.t1Completed &&
      updatedCheckpoint.t2Completed &&
      updatedCheckpoint.t3Completed &&
      !updatedCheckpoint.goldBonusEarned
    ) {
      await ctx.db.patch(checkpoint._id, {
        goldBonusEarned: true,
      });

      // Award gold bonus points
      await awardPoints(
        ctx,
        user._id,
        POINT_VALUES.gold_checkpoint_bonus,
        "gold_checkpoint",
        venture._id,
      );

      // Get venture details for social feed post
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

      await createNotification(
        ctx,
        user._id,
        user._id,
        "gold_checkpoint",
        `🏆 ${ventureName} - ${stageName}: ${checkpointName} - Gold Checkpoint! All 3 tasks completed. +${POINT_VALUES.gold_checkpoint_bonus} points`,
        venture._id,
      );

      // Broadcast gold checkpoint to community — create notifications for all
      // venture collaborators so it appears in their venture feed (PRD §12)
      const collaborators = await ctx.db
        .query("invitations")
        .withIndex("by_idea", (q) => q.eq("ideaId", venture.ideaId))
        .filter((q) => q.eq(q.field("status"), "accepted"))
        .collect();

      for (const collaborator of collaborators) {
        if (collaborator.inviteeId !== user._id) {
          await ctx.db.insert("notifications", {
            recipientId: collaborator.inviteeId,
            senderId: user._id,
            type: "gold_checkpoint",
            message: `🏆 ${ventureName} - ${stageName}: ${checkpointName} - Gold Checkpoint achieved by your collaborator!`,
            relatedId: venture._id,
            isRead: false,
            createdAt: now,
          });
        }
      }

      // Create community-wide social feed post for gold checkpoint achievement
      // This notification will appear in the community venture feed for all users
      await ctx.db.insert("notifications", {
        recipientId: user._id, // Self-notification acts as the feed post
        senderId: user._id,
        type: "gold_checkpoint",
        message: `🏆 ${user.displayName || user.username} earned a Gold Checkpoint on ${checkpointName} in ${ventureName}! (${stageName})`,
        relatedId: venture._id,
        isRead: false, // Keeps it visible in feeds
        createdAt: now,
      });
    }

    // Keep checkpoint + venture progression in sync when a full checkpoint is done.
    const refreshedCheckpoint = await ctx.db.get(checkpoint._id);
    if (refreshedCheckpoint) {
      await applyContributionUpdateRelief(ctx, venture._id, now);
      await applyCheckpointCorruptionDelta(
        ctx,
        venture._id,
        checkpointBeforeUpdate,
        refreshedCheckpoint as CheckpointProgressDoc,
        now,
      );
      await syncCheckpointCompletionAfterSubmission(
        ctx,
        venture as VentureProgressDoc,
        refreshedCheckpoint as CheckpointProgressDoc,
        now,
      );

      // Trigger feed post on regular checkpoint completion (2 tasks done)
      if (
        [checkpointBeforeUpdate.t1Completed, checkpointBeforeUpdate.t2Completed, checkpointBeforeUpdate.t3Completed].filter(Boolean).length < 2 &&
        [refreshedCheckpoint.t1Completed, refreshedCheckpoint.t2Completed, refreshedCheckpoint.t3Completed].filter(Boolean).length >= 2
      ) {
        const idea = await ctx.db.get(venture.ideaId);
        const stageName = VENTURE_STAGES[checkpoint.stage - 1]?.name || `Stage ${checkpoint.stage}`;
        const ventureName = idea?.title || "Your Venture";
        
        await ctx.db.insert("notifications", {
          recipientId: user._id,
          senderId: user._id,
          type: "checkpoint_complete",
          message: `🎯 ${user.displayName || user.username} completed a Checkpoint in ${ventureName}! (${stageName})`,
          relatedId: venture._id,
          isRead: false,
          createdAt: now,
        });

        const collaborators = await ctx.db
          .query("invitations")
          .withIndex("by_idea", (q) => q.eq("ideaId", venture.ideaId))
          .filter((q) => q.eq(q.field("status"), "accepted"))
          .collect();

        for (const collaborator of collaborators) {
          if (collaborator.inviteeId !== user._id) {
            await ctx.db.insert("notifications", {
              recipientId: collaborator.inviteeId,
              senderId: user._id,
              type: "checkpoint_complete",
              message: `🎯 Checkpoint completed in ${ventureName} by your collaborator!`,
              relatedId: venture._id,
              isRead: false,
              createdAt: now,
            });
          }
        }
      }
    }

    // Award task completion points
    const pointKey =
      `task_${task.taskLevel}_complete` as keyof typeof POINT_VALUES;
    await awardPoints(
      ctx,
      user._id,
      POINT_VALUES[pointKey],
      `${task.taskLevel}_task_complete`,
      venture._id,
    );

    // Share evidence to project feed (via notifications stream)
    const ideaForEvidence = await ctx.db.get(venture.ideaId);
    await ctx.db.insert("notifications", {
      recipientId: user._id,
      senderId: user._id,
      type: "evidence_shared",
      message: `📄 ${user.displayName || user.username} submitted new evidence (Tool: ${task.toolType}) for ${ideaForEvidence?.title || "Your Venture"}`,
      relatedId: venture._id,
      isRead: false,
      createdAt: now,
    });

    // ── Trigger AI quality scoring (async, non-blocking) ─────────────────────
    // Resolve checkpoint def for the outcome text the scorer needs
    const checkpointDef = CHECKPOINT_DEFINITIONS.find(
      (d) =>
        d.stage === checkpoint.stage && d.checkpoint === checkpoint.checkpoint,
    );
    const contentText =
      typeof args.content?.text === "string"
        ? args.content.text
        : JSON.stringify(args.content ?? "");
    if (contentText.trim().split(/\s+/).length >= 10) {
      await ctx.scheduler.runAfter(0, api.aiScoring.evaluateTaskSubmission, {
        taskId: args.taskId,
        checkpointId: task.checkpointId,
        ventureId: checkpoint.ventureId,
        stageNumber: checkpoint.stage,
        content: contentText,
        checkpointOutcome: checkpointDef?.outcome ?? "",
        userTier: "free",
      });
    }

    return evidenceId;
  },
});

/**
 * Advance to the next checkpoint within the current stage.
 * Requires at least 2 of 3 tasks completed.
 */
export const advanceCheckpoint = mutation({
  args: {
    checkpointId: v.id("ventureCheckpoints"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const checkpoint = await ctx.db.get(args.checkpointId);
    if (!checkpoint) throw new Error("Checkpoint not found");

    const venture = await ctx.db.get(checkpoint.ventureId);
    if (!venture) throw new Error("Venture not found");

    const user = await getUserByClerkId(ctx, identity.subject);
    if (venture.userId !== user._id) {
      throw new Error("Not your venture");
    }

    const completedCount = getCompletedTaskCount(
      checkpoint as CheckpointProgressDoc,
    );

    if (completedCount < 2) {
      throw new Error("At least 2 of 3 tasks must be completed to advance");
    }

    const now = Date.now();
    await syncCheckpointProgressState(
      ctx,
      checkpoint as CheckpointProgressDoc,
      now,
    );
    const refreshedCheckpoint = await ctx.db.get(args.checkpointId);
    if (refreshedCheckpoint) {
      await advanceVenturePointerAfterCheckpoint(
        ctx,
        venture as VentureProgressDoc,
        refreshedCheckpoint as CheckpointProgressDoc,
        now,
      );
    }
  },
});

/**
 * Attempt to advance to the next stage.
 * Requires all checkpoints in current stage to be completed.
 */
export const advanceStage = mutation({
  args: {
    ventureId: v.id("ventures"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const venture = await ctx.db.get(args.ventureId);
    if (!venture) throw new Error("Venture not found");

    const user = await getUserByClerkId(ctx, identity.subject);
    if (venture.userId !== user._id) {
      throw new Error("Not your venture");
    }

    await tryAdvanceStage(ctx, venture, venture.currentStage);
  },
});

/**
 * Get a venture with all its checkpoints, tasks, and evidence.
 * Optimized: batches task and evidence queries to avoid N+1.
 */
export const getVenture = query({
  args: {
    ventureId: v.id("ventures"),
  },
  handler: async (ctx, args) => {
    const venture = await ctx.db.get(args.ventureId);
    if (!venture) return null;
    const normalizedVenture = {
      ...venture,
      corruptionLevel: venture.corruptionLevel ?? 0,
      lastActivityAt: venture.lastActivityAt ?? venture.updatedAt,
    };

    const checkpoints = await ctx.db
      .query("ventureCheckpoints")
      .withIndex("by_venture", (q) => q.eq("ventureId", args.ventureId))
      .collect();

    const bosses = await ctx.db
      .query("ventureBosses")
      .withIndex("by_venture", (q) => q.eq("ventureId", args.ventureId))
      .collect();

    // Batch fetch all tasks using by_checkpoint index (avoids full table scan)
    const checkpointIds = checkpoints.map((cp) => cp._id);
    const tasksPerCheckpoint = await Promise.all(
      checkpointIds.map((id) =>
        ctx.db
          .query("ventureTasks")
          .withIndex("by_checkpoint", (q) => q.eq("checkpointId", id))
          .collect(),
      ),
    );
    const allTasks = tasksPerCheckpoint.flat();

    // Group tasks by checkpointId
    const tasksByCheckpoint = new Map();
    for (const task of allTasks) {
      if (task.checkpointId) {
        const existing = tasksByCheckpoint.get(task.checkpointId) || [];
        existing.push(task);
        tasksByCheckpoint.set(task.checkpointId, existing);
      }
    }

    // Batch fetch all evidence for tasks that have evidenceId
    const evidenceIds = new Set<string>();
    for (const task of allTasks) {
      if (task.evidenceId) {
        evidenceIds.add(task.evidenceId);
      }
    }

    const evidenceMap = new Map();
    for (const evidenceId of evidenceIds) {
      const evidence = await ctx.db.get(evidenceId as Id<"ventureEvidence">);
      if (evidence) {
        evidenceMap.set(evidenceId, evidence);
      }
    }

    // Enrich checkpoints with tasks
    const enrichedCheckpoints = checkpoints.map((cp) => {
      const tasks = tasksByCheckpoint.get(cp._id) || [];
      const enrichedTasks = tasks.map(
        (task: { evidenceId?: string; [key: string]: unknown }) => ({
          ...task,
          evidence: task.evidenceId
            ? evidenceMap.get(task.evidenceId) || null
            : null,
        }),
      );
      return { ...cp, tasks: enrichedTasks };
    });

    // Enrich bosses with definitions
    const enrichedBosses = bosses.map((boss) => {
      const def = BOSS_DEFINITIONS.find((b) => b.id === boss.bossId);
      return {
        ...boss,
        corruptionLevel: normalizedVenture.corruptionLevel,
        bossSlug: getBossSlug(boss.bossId),
        visualStatus: getBossVisualStatus(normalizedVenture.corruptionLevel),
        definition: def,
      };
    });
    const superBoss = await buildSuperBossState(ctx, normalizedVenture, bosses[0] ?? null);
    const stageStates = buildStageStates(checkpoints);
    const projectState = getProjectOutcome(stageStates, normalizedVenture.status);

    return {
      ...normalizedVenture,
      checkpoints: enrichedCheckpoints,
      bosses: enrichedBosses,
      superBoss,
      stageStates,
      projectState,
      slainBosses: buildSlainBosses(enrichedBosses),
    };
  },
});

/**
 * Lightweight venture summary for list views.
 * Does NOT fetch tasks or evidence — only venture + checkpoints + bosses.
 */
export const getVentureSummary = query({
  args: {
    ventureId: v.id("ventures"),
  },
  handler: async (ctx, args) => {
    const venture = await ctx.db.get(args.ventureId);
    if (!venture) return null;
    const normalizedVenture = {
      ...venture,
      corruptionLevel: venture.corruptionLevel ?? 0,
      lastActivityAt: venture.lastActivityAt ?? venture.updatedAt,
    };

    const checkpoints = await ctx.db
      .query("ventureCheckpoints")
      .withIndex("by_venture", (q) => q.eq("ventureId", args.ventureId))
      .collect();

    const bosses = await ctx.db
      .query("ventureBosses")
      .withIndex("by_venture", (q) => q.eq("ventureId", args.ventureId))
      .collect();

    const enrichedBosses = bosses.map((boss) => {
      const def = BOSS_DEFINITIONS.find((b) => b.id === boss.bossId);
      return {
        ...boss,
        corruptionLevel: normalizedVenture.corruptionLevel,
        bossSlug: getBossSlug(boss.bossId),
        visualStatus: getBossVisualStatus(normalizedVenture.corruptionLevel),
        definition: def,
      };
    });
    const superBoss = await buildSuperBossState(ctx, normalizedVenture, bosses[0] ?? null);
    const stageStates = buildStageStates(checkpoints);
    const projectState = getProjectOutcome(stageStates, normalizedVenture.status);

    // Calculate summary stats
    const completedCheckpoints = checkpoints.filter(
      (cp) => cp.status === "completed",
    ).length;
    const goldCheckpoints = checkpoints.filter(
      (cp) => cp.goldBonusEarned,
    ).length;

    return {
      ...normalizedVenture,
      completedCheckpoints,
      goldCheckpoints,
      totalCheckpoints: checkpoints.length,
      bosses: enrichedBosses,
      superBoss,
      stageStates,
      projectState,
      slainBosses: buildSlainBosses(enrichedBosses),
    };
  },
});

/**
 * Get venture summaries for all user ventures (for My Ventures page).
 * Lightweight — no tasks or evidence.
 */
export const getUserVentureSummaries = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await getUserByClerkId(ctx, identity.subject);

    const ventures = await ctx.db
      .query("ventures")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Batch fetch checkpoints using by_venture index (avoids full table scan)
    const checkpointsByVenture = new Map<
      string,
      Array<{
        ventureId: Id<"ventures">;
        stage: number;
        checkpoint: number;
        status: string;
        t1Completed: boolean;
        t2Completed: boolean;
        t3Completed: boolean;
        goldBonusEarned: boolean;
        _id: Id<"ventureCheckpoints">;
        completedAt?: number;
        _creationTime: number;
      }>
    >();
    await Promise.all(
      ventures.map(async (v) => {
        const cps = await ctx.db
          .query("ventureCheckpoints")
          .withIndex("by_venture", (q) => q.eq("ventureId", v._id))
          .collect();
        checkpointsByVenture.set(v._id as string, cps);
      }),
    );

    // Batch fetch bosses using by_venture index (avoids full table scan)
    const bossesByVenture = new Map<
      string,
      Array<{
        ventureId: Id<"ventures">;
        bossId: number;
        status: string;
        corruptionLevel: number;
        bossSpecificCounters: unknown;
        assignedAt: number;
        defeatedAt?: number;
        _id: Id<"ventureBosses">;
        _creationTime: number;
      }>
    >();
    await Promise.all(
      ventures.map(async (v) => {
        const bs = await ctx.db
          .query("ventureBosses")
          .withIndex("by_venture", (q) => q.eq("ventureId", v._id))
          .collect();
        bossesByVenture.set(v._id as string, bs);
      }),
    );

    return ventures.map((venture) => {
      const checkpoints = checkpointsByVenture.get(venture._id) || [];
      const bosses = bossesByVenture.get(venture._id) || [];

      const completedCheckpoints = checkpoints.filter(
        (cp) => cp.status === "completed",
      ).length;
      const goldCheckpoints = checkpoints.filter(
        (cp) => cp.goldBonusEarned,
      ).length;
      const stageStates = buildStageStates(checkpoints);
      const projectState = getProjectOutcome(stageStates, venture.status);

      const enrichedBosses = bosses.map((boss) => {
        const def = BOSS_DEFINITIONS.find((b) => b.id === boss.bossId);
        return { ...boss, definition: def };
      });

      return {
        ...venture,
        corruptionLevel: venture.corruptionLevel ?? 0,
        lastActivityAt: venture.lastActivityAt ?? venture.updatedAt,
        completedCheckpoints,
        goldCheckpoints,
        totalCheckpoints: checkpoints.length,
        bosses: enrichedBosses,
        stageStates,
        projectState,
      };
    });
  },
});

/**
 * Get all ventures for the current user.
 */
export const getUserVentures = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await getUserByClerkId(ctx, identity.subject);

    const ventures = await ctx.db
      .query("ventures")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return ventures.map((venture) => ({
      ...venture,
      corruptionLevel: venture.corruptionLevel ?? 0,
      lastActivityAt: venture.lastActivityAt ?? venture.updatedAt,
    }));
  },
});

/**
 * Get a specific checkpoint with its tasks and evidence.
 */
export const getCheckpoint = query({
  args: {
    checkpointId: v.id("ventureCheckpoints"),
  },
  handler: async (ctx, args) => {
    const checkpoint = await ctx.db.get(args.checkpointId);
    if (!checkpoint) return null;

    const tasks = await ctx.db
      .query("ventureTasks")
      .withIndex("by_checkpoint", (q) =>
        q.eq("checkpointId", args.checkpointId),
      )
      .collect();

    const enrichedTasks = await Promise.all(
      tasks.map(async (task) => {
        let evidence = null;
        if (task.evidenceId) {
          evidence = await ctx.db.get(task.evidenceId);
        }
        return { ...task, evidence };
      }),
    );

    // Get checkpoint definition
    const def = CHECKPOINT_DEFINITIONS.find(
      (d) =>
        d.stage === checkpoint.stage && d.checkpoint === checkpoint.checkpoint,
    );

    return {
      ...checkpoint,
      definition: def,
      tasks: enrichedTasks,
    };
  },
});

/**
 * Get venture progress summary.
 */
export const getVentureProgress = query({
  args: {
    ventureId: v.id("ventures"),
  },
  handler: async (ctx, args) => {
    const venture = await ctx.db.get(args.ventureId);
    if (!venture) return null;

    const checkpoints = await ctx.db
      .query("ventureCheckpoints")
      .withIndex("by_venture", (q) => q.eq("ventureId", args.ventureId))
      .collect();

    const totalCheckpoints = checkpoints.length;
    const completedCheckpoints = checkpoints.filter(
      (cp) => cp.status === "completed",
    ).length;
    const goldCheckpoints = checkpoints.filter(
      (cp) => cp.goldBonusEarned,
    ).length;

    const stageProgress = buildStageStates(checkpoints);

    const normalizedVenture = {
      ...venture,
      corruptionLevel: venture.corruptionLevel ?? 0,
      lastActivityAt: venture.lastActivityAt ?? venture.updatedAt,
    };
    const superBoss = await buildSuperBossState(ctx, normalizedVenture);
    const projectState = getProjectOutcome(stageProgress, normalizedVenture.status);

    return {
      venture: normalizedVenture,
      totalCheckpoints,
      completedCheckpoints,
      goldCheckpoints,
      completionPercentage:
        totalCheckpoints > 0
          ? Math.round((completedCheckpoints / totalCheckpoints) * 100)
          : 0,
      stageProgress,
      superBoss,
      projectState,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type MutationDbCtx = MutationCtx["db"];
type QueryDbCtx = QueryCtx["db"];

/**
 * Attempt to advance to the next stage.
 * Checks if all checkpoints in the current stage are completed.
 */
type VentureProgressDoc = {
  _id: Id<"ventures">;
  userId: Id<"users">;
  currentStage: number;
  currentCheckpoint: number;
  ideaId: Id<"ideas">;
  corruptionLevel?: number;
  lastActivityAt?: number;
};

type CheckpointProgressDoc = {
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

function getCompletedTaskCount(checkpoint: CheckpointProgressDoc) {
  return [
    checkpoint.t1Completed,
    checkpoint.t2Completed,
    checkpoint.t3Completed,
  ].filter(Boolean).length;
}

async function getAverageQualityScore(
  ctx: { db: MutationDbCtx | QueryDbCtx },
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
  ctx: { db: MutationDbCtx },
  ventureId: Id<"ventures">,
  corruptionLevel: number,
  status?: "active" | "retreated" | "slain",
) {
  const bosses = await ctx.db
    .query("ventureBosses")
    .withIndex("by_venture", (q) => q.eq("ventureId", ventureId))
    .collect();

  const now = Date.now();
  for (const boss of bosses) {
    const patch: {
      corruptionLevel: number;
      status?: "active" | "retreated" | "slain";
      defeatedAt?: number;
    } = {
      corruptionLevel,
    };

    if (status) {
      patch.status = status;
      patch.defeatedAt = status === "slain" || status === "retreated" ? now : undefined;
    }

    await ctx.db.patch(boss._id, patch);
  }
}

async function setVentureCorruptionLevel(
  ctx: { db: MutationDbCtx },
  ventureId: Id<"ventures">,
  targetLevel: number,
  now: number,
  options?: {
    touchActivity?: boolean;
    maxCap?: number;
  },
) {
  const venture = await ctx.db.get(ventureId);
  if (!venture) return null;

  const maxCap = options?.maxCap ?? CORRUPTION_RULES.max;
  const nextLevel = Math.max(0, Math.min(maxCap, Math.round(targetLevel)));

  await ctx.db.patch(venture._id, {
    corruptionLevel: nextLevel,
    lastActivityAt: options?.touchActivity
      ? now
      : venture.lastActivityAt ?? venture.updatedAt ?? now,
    updatedAt: now,
  });

  await syncBossCorruptionMirror(ctx, venture._id, nextLevel);

  return {
    ...venture,
    corruptionLevel: nextLevel,
    lastActivityAt: options?.touchActivity
      ? now
      : venture.lastActivityAt ?? venture.updatedAt ?? now,
    updatedAt: now,
  };
}

async function adjustVentureCorruption(
  ctx: { db: MutationDbCtx },
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

  return await setVentureCorruptionLevel(
    ctx,
    venture._id,
    (venture.corruptionLevel ?? 0) + delta,
    now,
    options,
  );
}

async function applyContributionUpdateRelief(
  ctx: { db: MutationDbCtx },
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
  ctx: { db: MutationDbCtx },
  ventureId: Id<"ventures">,
  previousCheckpoint: CheckpointProgressDoc,
  nextCheckpoint: CheckpointProgressDoc,
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

  if (reduction <= 0) return;

  await adjustVentureCorruption(ctx, ventureId, -reduction, now, {
    touchActivity: true,
  });
}

async function syncCheckpointProgressState(
  ctx: { db: MutationDbCtx },
  checkpoint: CheckpointProgressDoc,
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

async function advanceVenturePointerAfterCheckpoint(
  ctx: { db: MutationDbCtx },
  venture: VentureProgressDoc,
  checkpoint: CheckpointProgressDoc,
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
    await tryAdvanceStage(ctx, venture, checkpoint.stage, now);
  }
}

async function buildSuperBossState(
  ctx: { db: MutationDbCtx | QueryDbCtx },
  venture: {
    _id: Id<"ventures">;
    corruptionLevel?: number;
  },
  boss?: {
    _id: Id<"ventureBosses">;
    bossId: number;
    status: "active" | "retreated" | "slain";
    corruptionLevel: number;
    assignedAt: number;
    defeatedAt?: number;
    bossSpecificCounters: unknown;
  } | null,
) {
  const bossRow =
    boss ??
    (await ctx.db
      .query("ventureBosses")
      .withIndex("by_venture", (q) => q.eq("ventureId", venture._id))
      .first());

  if (!bossRow) return null;

  const definition = BOSS_DEFINITIONS.find((entry) => entry.id === bossRow.bossId);
  const averageQualityScore = await getAverageQualityScore(ctx, venture._id);
  const hp = getBossHpFromQuality(averageQualityScore);
  const corruptionLevel = venture.corruptionLevel ?? bossRow.corruptionLevel ?? 0;

  return {
    ...bossRow,
    corruptionLevel,
    bossName: definition?.name ?? `Boss ${bossRow.bossId}`,
    bossSlug: getBossSlug(bossRow.bossId),
    definition,
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

function buildSlainBosses(
  bosses: Array<{
    bossId: number;
    status: string;
  }>,
) {
  return bosses
    .filter((boss) => boss.status === "slain" || boss.status === "retreated")
    .map((boss) => {
      const definition = BOSS_DEFINITIONS.find((entry) => entry.id === boss.bossId);
      return {
        bossId: boss.bossId,
        name: definition?.name ?? `Boss ${boss.bossId}`,
        slayOutcome:
          boss.status === "slain"
            ? definition?.slayOutcome ??
              "The monument stands as proof of completion."
            : definition?.retreatOutcome ?? "A cracked monument remains behind.",
        status: boss.status,
      };
    });
}

async function tryAdvanceStage(
  ctx: { db: MutationDbCtx; scheduler?: MutationCtx["scheduler"] },
  venture: VentureProgressDoc,
  currentStage: number,
  now: number = Date.now(),
) {
  // Get all checkpoints for current stage
  const stageCheckpoints = await ctx.db
    .query("ventureCheckpoints")
    .withIndex("by_venture_stage", (q) =>
      q.eq("ventureId", venture._id).eq("stage", currentStage),
    )
    .collect();

  const allComplete = stageCheckpoints.every((cp) => cp.status === "completed");

  if (!allComplete) return;

  // Award stage completion bonus
  const user = await ctx.db.get(venture.userId);
  if (user) {
    await awardPoints(
      ctx,
      user._id,
      POINT_VALUES.stage_complete_bonus,
      `stage_${currentStage}_complete`,
      venture._id,
    );

    // Get venture details for social feed post
    const idea = await ctx.db.get(venture.ideaId);
    const stageName =
      VENTURE_STAGES[currentStage - 1]?.name || `Stage ${currentStage}`;
    const ventureName = idea?.title || "Your Venture";

    await createNotification(
      ctx,
      user._id,
      user._id,
      "venture_stage_complete",
      `🎉 ${ventureName} - Stage ${currentStage}: ${stageName} Complete! +${POINT_VALUES.stage_complete_bonus} points`,
      venture._id,
    );
  }

  if (currentStage < 8) {
    // Advance to next stage
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
  } else {
    // All 8 stages complete — venture is done
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

    // Award venture completion bonus
    if (user) {
      await awardPoints(
        ctx,
        user._id,
        POINT_VALUES.venture_complete_bonus,
        projectOutcome === "project_perfect"
          ? "venture_perfect"
          : "venture_complete",
        venture._id,
      );
      await createNotification(
        ctx,
        user._id,
        user._id,
        projectOutcome === "project_perfect"
          ? "venture_perfect"
          : "venture_complete",
        projectOutcome === "project_perfect"
          ? `Project Perfect! Every stage ended in gold. +${POINT_VALUES.venture_complete_bonus} points`
          : `Project Complete! Your venture has crossed every stage. +${POINT_VALUES.venture_complete_bonus} points`,
        venture._id,
      );

      if (projectOutcome === "project_perfect") {
        await ctx.scheduler?.runAfter(0, internal.badges.awardBadge, {
          userId: user._id,
          slug: "legendary-venture-completion",
        });
      }

      // Update user level tracking for full lifecycles
      const userLevel = await ctx.db
        .query("userLevels")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      if (userLevel) {
        await ctx.db.patch(userLevel._id, {
          fullLifecycles: (userLevel.fullLifecycles || 0) + 1,
          updatedAt: now,
        });
      }
    }
  }
}

async function syncCheckpointCompletionAfterSubmission(
  ctx: { db: MutationDbCtx },
  venture: VentureProgressDoc,
  checkpoint: CheckpointProgressDoc,
  now: number,
) {
  await syncCheckpointProgressState(ctx, checkpoint, now);
  const refreshedCheckpoint = await ctx.db.get(checkpoint._id);
  if (!refreshedCheckpoint) return;
  await advanceVenturePointerAfterCheckpoint(
    ctx,
    venture,
    refreshedCheckpoint as CheckpointProgressDoc,
    now,
  );
}

/**
 * Award points to a user.
 * Creates a transaction and updates the wallet.
 */
async function awardPoints(
  ctx: { db: MutationDbCtx },
  userId: Id<"users">,
  amount: number,
  type: string,
  relatedId: string,
) {
  if (amount <= 0) return;

  const now = Date.now();

  // Find or create wallet
  let wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!wallet) {
    const walletId = await ctx.db.insert("wallets", {
      userId,
      balance: 0,
      updatedAt: now,
    });
    wallet = await ctx.db.get(walletId);
  }

  if (!wallet) return;

  // Create transaction
  await ctx.db.insert("transactions", {
    walletId: wallet._id,
    amount,
    type,
    description: `Venture: ${type}`,
    relatedId,
    createdAt: now,
  });

  // Update wallet balance
  await ctx.db.patch(wallet._id, {
    balance: wallet.balance + amount,
    updatedAt: now,
  });

  // Update user level tracking
  const userLevel = await ctx.db
    .query("userLevels")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (userLevel) {
    await ctx.db.patch(userLevel._id, {
      totalPoints: (userLevel.totalPoints || 0) + amount,
      titlePoints: (userLevel.titlePoints || 0) + amount,
      updatedAt: now,
    });
  }
}

/**
 * Create a notification for a user.
 */
async function createNotification(
  ctx: { db: MutationDbCtx },
  recipientId: Id<"users">,
  senderId: Id<"users">,
  type: string,
  message: string,
  relatedId: string,
) {
  await ctx.db.insert("notifications", {
    recipientId,
    senderId,
    type,
    message,
    relatedId: relatedId as Id<"ideas">,
    isRead: false,
    createdAt: Date.now(),
  });
}

/**
 * Look up a user by their Clerk ID.
 */
async function getUserByClerkId(
  ctx: { db: QueryDbCtx | MutationDbCtx },
  clerkId: string,
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();

  if (!user) throw new Error("User not found");
  return user;
}

/**
 * Fisher-Yates shuffle — used for random boss assignment.
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
