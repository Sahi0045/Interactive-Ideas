import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { BADGE_DEFINITIONS } from "./ventureConstants";

const INITIAL_BADGES = [
  {
    slug: "first-idea",
    name: "First Spark",
    description: "Created your first idea",
    icon: "Lightbulb",
    category: "creation",
    criteria: { type: "idea_count", threshold: 1 },
  },
  {
    slug: "idea-machine",
    name: "Idea Machine",
    description: "Created 5 ideas",
    icon: "Zap",
    category: "creation",
    criteria: { type: "idea_count", threshold: 5 },
  },
  {
    slug: "trendsetter",
    name: "Trendsetter",
    description: "Received 10 sparks on a single idea",
    icon: "Flame",
    category: "social",
    criteria: { type: "spark_count_single", threshold: 10 },
  },
  {
    slug: "collaborator",
    name: "Collaborator",
    description: "Accepted a contribution request",
    icon: "Users",
    category: "collaboration",
    criteria: { type: "contribution_accepted", threshold: 1 },
  },
  {
    slug: "chatterbox",
    name: "Chatterbox",
    description: "Left 5 comments on ideas",
    icon: "MessageSquare",
    category: "social",
    criteria: { type: "comment_count", threshold: 5 },
  },
  {
    slug: "legendary-venture-completion",
    name: "Legendary Completion",
    description: "Completed a venture with every stage ending in gold",
    icon: "Crown",
    category: "aspirational",
    criteria: { type: "manual_award", threshold: 1 },
  },
];

// Seed initial badges (idempotent)
export const seedBadges = mutation({
  args: {},
  handler: async (ctx) => {
    for (const badge of INITIAL_BADGES) {
      const existing = await ctx.db
        .query("badges")
        .withIndex("by_slug", (q) => q.eq("slug", badge.slug))
        .first();

      if (!existing) {
        await ctx.db.insert("badges", badge);
      } else {
        // Optional: Update definition if needed
        // await ctx.db.patch(existing._id, badge);
      }
    }
  },
});

export const getBadges = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("badges").collect();
  },
});

export const getUserBadges = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const userBadges = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Fetch details for each badge
    const badgeDetails = await Promise.all(
      userBadges.map(async (ub) => {
        const badge = await ctx.db.get(ub.badgeId);
        return badge ? { ...badge, awardedAt: ub.awardedAt } : null;
      }),
    );

    return badgeDetails.filter((b) => b !== null);
  },
});

/**
 * Get all badges for the currently authenticated user, sorted by award time
 * descending. Used by the map page to detect newly awarded badges and trigger
 * the BadgeAwardSequence overlay via a client-side subscription.
 *
 * Returns an empty array when unauthenticated.
 */
export const getMyBadges = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const userBadges = await ctx.db
      .query("userBadges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Sort newest first so the client can detect additions at index 0
    userBadges.sort((a, b) => b.awardedAt - a.awardedAt);

    const enriched = await Promise.all(
      userBadges.map(async (ub) => {
        const badge = await ctx.db.get(ub.badgeId);
        if (!badge) return null;
        return {
          _id: ub._id,
          badgeId: ub.badgeId,
          awardedAt: ub.awardedAt,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          // Map category → rarity for the BadgeAwardSequence component
          rarity: categoryToRarity(badge.category),
        };
      }),
    );

    return enriched.filter((b): b is NonNullable<typeof b> => b !== null);
  },
});

/**
 * Map the internal badge category string to a rarity tier understood by
 * BadgeAwardSequence.
 */
function categoryToRarity(
  category: string,
): "common" | "uncommon" | "rare" | "epic" | "legendary" {
  switch (category.toLowerCase()) {
    case "legendary":
    case "aspirational":
      return "legendary";
    case "epic":
      return "epic";
    case "rare":
    case "milestones":
      return "rare";
    case "uncommon":
    case "community":
    case "consistency":
      return "uncommon";
    default:
      return "common";
  }
}

// Internal: Award a badge if not already owned
export const awardBadge = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    let badge = await ctx.db
      .query("badges")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!badge) {
      const fallback = INITIAL_BADGES.find((entry) => entry.slug === args.slug);
      if (!fallback) return;
      const badgeId = await ctx.db.insert("badges", fallback);
      badge = await ctx.db.get(badgeId);
      if (!badge) return;
    }

    const existing = await ctx.db
      .query("userBadges")
      .withIndex("by_user_badge", (q) =>
        q.eq("userId", args.userId).eq("badgeId", badge._id),
      )
      .first();

    if (!existing) {
      await ctx.db.insert("userBadges", {
        userId: args.userId,
        badgeId: badge._id,
        awardedAt: Date.now(),
      });
      // TODO: Here we could trigger a notification
    }
  },
});

// Internal: Check badge conditions based on triggers
export const checkBadges = internalMutation({
  args: {
    userId: v.id("users"),
    trigger: v.string(), // 'create_idea', 'spark', 'comment', 'accept_contribution'
  },
  handler: async (ctx, args) => {
    const { userId, trigger } = args;

    if (trigger === "create_idea") {
      const ideas = await ctx.db
        .query("ideas")
        .withIndex("by_author", (q) => q.eq("authorId", userId))
        .collect();

      const count = ideas.length;
      if (count >= 1) await checkAndAward(ctx, userId, "first-idea");
      if (count >= 5) await checkAndAward(ctx, userId, "idea-machine");
    }

    if (trigger === "comment") {
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_author", (q) => q.eq("authorId", userId))
        .collect();

      if (comments.length >= 5) await checkAndAward(ctx, userId, "chatterbox");
    }

    if (trigger === "accept_contribution") {
      // Check if user has accepted at least one contribution as author
      // Fallback using existing index
      const contributions = await ctx.db
        .query("contributionRequests")
        .withIndex("by_author_created", (q) => q.eq("authorId", userId))
        .collect();

      const acceptedCount = contributions.filter(
        (c) => c.status === "accepted",
      ).length;

      if (acceptedCount >= 1) {
        await checkAndAward(ctx, userId, "collaborator");
      }
    }

    if (trigger === "spark") {
      // Check if any of the user's ideas have 10+ sparks
      // Optimally we'd check the specific idea, but broad check works for MVP
      const ideas = await ctx.db
        .query("ideas")
        .withIndex("by_author", (q) => q.eq("authorId", userId))
        .collect();

      const hasTrendsetter = ideas.some((idea) => idea.sparkCount >= 10);

      if (hasTrendsetter) {
        await checkAndAward(ctx, userId, "trendsetter");
      }
    }
  },
});

// Helper for awarding
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAndAward(ctx: any, userId: Id<"users">, slug: string) {
  const badge = await ctx.db
    .query("badges")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();

  if (!badge) return;

  const existing = await ctx.db
    .query("userBadges")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_user_badge", (q: any) =>
      q.eq("userId", userId).eq("badgeId", badge._id),
    )
    .first();

  if (!existing) {
    await ctx.db.insert("userBadges", {
      userId: userId,
      badgeId: badge._id,
      awardedAt: Date.now(),
    });

    // Trigger notification
    await ctx.db.insert("notifications", {
      recipientId: userId,
      senderId: userId, // System notification, self-sent or we could have a system user
      type: "badge_awarded",
      message: `You earned the "${badge.name}" badge!`,
      relatedId: badge._id,
      isRead: false,
      createdAt: Date.now(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VENTURE BADGES (62-badge system)
// ─────────────────────────────────────────────────────────────────────────────

export const awardVentureBadge = mutation({
  args: {
    userId: v.id("users"),
    badgeId: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const badgeDef = BADGE_DEFINITIONS.find((b) => b.id === args.badgeId);
    if (!badgeDef) throw new Error(`Badge ${args.badgeId} not found`);

    const existing = await ctx.db
      .query("ventureBadges")
      .withIndex("by_user_badge", (q) =>
        q.eq("userId", args.userId).eq("badgeId", args.badgeId),
      )
      .first();

    if (existing) return existing._id;

    const now = Date.now();

    const badgeRecordId = await ctx.db.insert("ventureBadges", {
      userId: args.userId,
      badgeId: args.badgeId,
      awardedAt: now,
      isHidden: badgeDef.rarity === "hidden",
      metadata: args.metadata ?? {},
    });

    await ctx.db.insert("badgeEvaluations", {
      badgeId: args.badgeId,
      userId: args.userId,
      condition: badgeDef.requirement,
      lastChecked: now,
      isAwarded: true,
      awardedAt: now,
    });

    return badgeRecordId;
  },
});

export const getVentureBadges = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const badges = await ctx.db
      .query("ventureBadges")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return badges.map((badge) => {
      const def = BADGE_DEFINITIONS.find((b) => b.id === badge.badgeId);
      return { ...badge, definition: def };
    });
  },
});

export const getAllVentureBadges = query({
  args: {},
  handler: async () => BADGE_DEFINITIONS,
});

export const getVentureBadgeProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const earnedBadges = await ctx.db
      .query("ventureBadges")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const earnedIds = new Set(earnedBadges.map((b) => b.badgeId));

    return BADGE_DEFINITIONS.map((def) => ({
      ...def,
      earned: earnedIds.has(def.id),
      awardedAt: earnedBadges.find((b) => b.badgeId === def.id)?.awardedAt,
    }));
  },
});
