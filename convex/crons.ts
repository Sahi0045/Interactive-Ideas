import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { CORRUPTION_RULES } from "./ventureConstants";

const crons = cronJobs();

// Schedule: Daily Idea Generation at 9:00 AM UTC
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = internal as any;

// Schedule: Daily Idea Generation at 9:00 AM UTC
crons.daily(
  "Generate Daily Idea",
  { hourUTC: 9, minuteUTC: 0 },
  api.agent_actions.generateDailyIdea,
);

// Schedule: Hourly Engagement (Comment/Spark)
crons.interval(
  "Agent Engagement",
  { minutes: 60 },
  api.agent_actions.generateEngagement,
);

// Schedule: Daily Leaderboard Reset (00:00 IST -> 18:30 UTC previous day)
crons.daily(
  "Finalize Daily Leaderboard",
  { hourUTC: 18, minuteUTC: 30 },
  api.leaderboard.finalizeDailyLeaderboard,
);

// Schedule: Daily venture corruption update
crons.daily(
  "Daily Venture Corruption",
  { hourUTC: 3, minuteUTC: 0 },
  api.crons.dailyBossCorruption,
);

// Schedule: Weekly Badge Evaluation
crons.weekly(
  "Weekly Badge Evaluation",
  { dayOfWeek: "monday", hourUTC: 4, minuteUTC: 0 },
  api.crons.weeklyBadgeEvaluation,
);

// Schedule: Daily Streak Update
crons.daily(
  "Daily Streak Update",
  { hourUTC: 0, minuteUTC: 0 },
  api.crons.dailyStreakUpdate,
);

export default crons;

// ─────────────────────────────────────────────────────────────────────────────
// CRON JOB FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cron job: Increase venture corruption for inactivity and long-lived
 * 1-of-3 checkpoints. Runs daily.
 */
export const dailyBossCorruption = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const partialDecayWindowMs =
      CORRUPTION_RULES.partialCheckpointDecayDays * oneDayMs;

    const ventures = await ctx.db
      .query("ventures")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const venture of ventures) {
      let nextCorruption = venture.corruptionLevel ?? 0;

      if (now - (venture.lastActivityAt ?? venture.updatedAt) > oneDayMs) {
        nextCorruption = Math.min(
          CORRUPTION_RULES.inactivityCap,
          nextCorruption + CORRUPTION_RULES.dailyInactivityIncrease,
        );
      }

      const checkpoints = await ctx.db
        .query("ventureCheckpoints")
        .withIndex("by_venture", (q) => q.eq("ventureId", venture._id))
        .collect();

      for (const checkpoint of checkpoints) {
        const completedCount = [
          checkpoint.t1Completed,
          checkpoint.t2Completed,
          checkpoint.t3Completed,
        ].filter(Boolean).length;

        const eligibleForDecay =
          completedCount === 1 &&
          checkpoint.partialStartedAt !== undefined &&
          checkpoint.partialDecayAppliedAt === undefined &&
          now - checkpoint.partialStartedAt >= partialDecayWindowMs;

        if (!eligibleForDecay) continue;

        nextCorruption = Math.min(
          CORRUPTION_RULES.max,
          nextCorruption + CORRUPTION_RULES.partialCheckpointIncrease,
        );
        await ctx.db.patch(checkpoint._id, {
          partialDecayAppliedAt: now,
        });
      }

      if (nextCorruption !== (venture.corruptionLevel ?? 0)) {
        await ctx.db.patch(venture._id, {
          corruptionLevel: nextCorruption,
          updatedAt: now,
        });

        const bosses = await ctx.db
          .query("ventureBosses")
          .withIndex("by_venture", (q) => q.eq("ventureId", venture._id))
          .collect();

        for (const boss of bosses) {
          await ctx.db.patch(boss._id, {
            corruptionLevel: nextCorruption,
          });
        }
      }
    }
  },
});

/**
 * Cron job: Evaluate badges for all users.
 * Runs weekly. Checks badge conditions and awards earned badges.
 */
export const weeklyBadgeEvaluation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
      const userLevel = await ctx.db
        .query("userLevels")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      if (!userLevel) continue;

      const existingBadges = await ctx.db
        .query("ventureBadges")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId));
      const now = Date.now();

      // Evaluate each badge condition
      const badgeConditions = [
        { id: 1, shouldAward: true }, // First Light
        { id: 6, shouldAward: userLevel.ideasCreated >= 1 },
        { id: 9, shouldAward: userLevel.totalPoints > 0 },
        { id: 10, shouldAward: userLevel.goldCheckpoints >= 1 },
        { id: 15, shouldAward: userLevel.fullLifecycles >= 1 },
        { id: 23, shouldAward: userLevel.fullLifecycles >= 2 },
        { id: 25, shouldAward: userLevel.goldCheckpoints >= 25 },
        { id: 26, shouldAward: userLevel.goldCheckpoints >= 100 },
        { id: 27, shouldAward: userLevel.commentsCount >= 10 },
        { id: 30, shouldAward: userLevel.upvotedCommentsCount >= 50 },
        { id: 31, shouldAward: userLevel.collaboratorsJoined >= 1 },
        { id: 32, shouldAward: userLevel.collaboratorsRecruited >= 5 },
        { id: 55, shouldAward: userLevel.currentLevel >= 50 },
        { id: 56, shouldAward: userLevel.fullLifecycles >= 5 },
        { id: 57, shouldAward: userLevel.fullLifecycles >= 3 },
      ];

      for (const { id, shouldAward } of badgeConditions) {
        if (shouldAward && !existingBadgeIds.has(id)) {
          await ctx.db.insert("ventureBadges", {
            userId: user._id,
            badgeId: id,
            awardedAt: now,
            isHidden: false,
            metadata: { awardedBy: "cron" },
          });

          await ctx.db.insert("badgeEvaluations", {
            badgeId: id,
            userId: user._id,
            condition: `cron_evaluated_${id}`,
            lastChecked: now,
            isAwarded: true,
            awardedAt: now,
          });
        }
      }
    }
  },
});

/**
 * Cron job: Update user streaks daily.
 */
export const dailyStreakUpdate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const streaks = await ctx.db.query("userStreaks").collect();
    const today = new Date().toISOString().split("T")[0];

    for (const streak of streaks) {
      const lastDate = streak.lastLoginDate;
      if (lastDate === today) continue;

      const lastDateObj = new Date(lastDate);
      const todayObj = new Date(today);
      const diffDays = Math.floor(
        (todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        // Consecutive day — increment streak
        await ctx.db.patch(streak._id, {
          currentStreak: streak.currentStreak + 1,
          longestStreak: Math.max(
            streak.longestStreak,
            streak.currentStreak + 1,
          ),
          lastLoginDate: today,
          lastStreakUpdate: Date.now(),
        });
      } else if (diffDays > 1) {
        // Streak broken
        await ctx.db.patch(streak._id, {
          currentStreak: 0,
          lastLoginDate: today,
          lastStreakUpdate: Date.now(),
          recoveryAvailable: streak.currentStreak >= 7,
        });
      }
    }
  },
});
