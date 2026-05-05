import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - stores user profiles and settings
  users: defineTable({
    clerkId: v.string(), // Clerk user ID
    username: v.string(), // Unique username
    displayName: v.string(), // Display name
    bio: v.optional(v.string()), // User bio
    avatar: v.optional(v.string()), // Avatar URL
    location: v.optional(v.string()), // User location
    website: v.optional(v.string()), // Website URL
    github: v.optional(v.string()), // GitHub URL
    linkedin: v.optional(v.string()), // LinkedIn URL
    twitter: v.optional(v.string()), // Twitter handle
    skills: v.optional(v.array(v.string())), // Array of user skills (handled via userSkills table)
    industry: v.optional(v.string()), // Primary industry (kept for backward compatibility)
    industries: v.optional(v.array(v.string())), // Multiple industries
    personaGender: v.optional(v.union(v.literal("male"), v.literal("female"))), // Character gender selection
    completedOnboarding: v.boolean(), // Onboarding status
    isActive: v.optional(v.boolean()), // Account status for user management
    role: v.optional(v.string()), // User role (user, moderator, admin)
    followersCount: v.optional(v.number()), // Number of followers
    followingCount: v.optional(v.number()), // Number of users followed
    xp: v.optional(v.number()), // Experience points
    level: v.optional(v.number()), // User level
    lastLoginAt: v.optional(v.number()), // Last login timestamp
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"])
    .index("by_completed_onboarding", ["completedOnboarding"])
    .index("by_role", ["role"])
    .index("by_is_active", ["isActive"])
    .index("by_created_at", ["createdAt"]),

  // User skills table for many-to-many relationship
  userSkills: defineTable({
    userId: v.id("users"), // Reference to users table
    skillName: v.string(), // Skill name
  })
    .index("by_user", ["userId"])
    .index("by_skill", ["skillName"]),

  // User industries table for many-to-many relationship
  userIndustries: defineTable({
    userId: v.id("users"), // Reference to users table
    industryName: v.string(), // Industry name
  })
    .index("by_user", ["userId"])
    .index("by_industry", ["industryName"]),

  // Session tracking for security
  userSessions: defineTable({
    userId: v.id("users"), // Reference to users table
    sessionId: v.string(), // Session identifier
    expiresAt: v.number(), // Expiration timestamp
  })
    .index("by_session", ["sessionId"])
    .index("by_user_expires", ["userId", "expiresAt"]),

  // Ideas table - stores user-created ideas
  ideas: defineTable({
    authorId: v.id("users"), // Reference to users table (author)
    title: v.string(), // Idea title (required)
    description: v.string(), // Idea description (required)
    category: v.string(), // Skills as comma-separated string
    industries: v.optional(v.string()), // Industries as comma-separated string
    visibility: v.string(), // 'public' or 'private'
    // File attachment URLs (stored in Convex storage)
    attachments: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          size: v.number(),
          url: v.string(),
          fileId: v.string(), // Convex storage ID
        }),
      ),
    ),
    sparkCount: v.number(), // Number of spark/like actions
    commentCount: v.number(), // Number of comments
    contributionRequestCount: v.optional(v.number()), // Number of contribution requests
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
    isDeleted: v.optional(v.boolean()), // Soft delete flag
    parentId: v.optional(v.id("ideas")), // Optional parent idea for hierarchical relationships
  })
    .index("by_author", ["authorId"])
    .index("by_visibility", ["visibility"])
    .index("by_category", ["category"])
    .index("by_industries", ["industries"])
    .index("by_created_at", ["createdAt"])
    .index("by_author_visibility", ["authorId", "visibility"])
    .index("by_category_created", ["category", "createdAt"])
    .index("by_industries_created", ["industries", "createdAt"])
    .index("by_is_deleted", ["isDeleted"])
    .index("by_parent", ["parentId"]),

  // Comments table - stores comments on ideas
  comments: defineTable({
    ideaId: v.id("ideas"), // Reference to ideas table
    authorId: v.id("users"), // Reference to users table (comment author)
    content: v.string(), // Comment content
    createdAt: v.number(), // Unix timestamp
    parentCommentId: v.optional(v.id("comments")), // Optional parent comment for nested replies
  })
    .index("by_idea", ["ideaId"])
    .index("by_author", ["authorId"])
    .index("by_idea_created", ["ideaId", "createdAt"])
    .index("by_parent", ["parentCommentId"]),

  // User idea sparks table - tracks which users have sparked which ideas
  userIdeaSparks: defineTable({
    userId: v.id("users"), // Reference to users table
    ideaId: v.id("ideas"), // Reference to ideas table
    createdAt: v.number(), // Unix timestamp when sparked
  })
    .index("by_user", ["userId"])
    .index("by_idea", ["ideaId"])
    .index("by_user_idea", ["userId", "ideaId"]),

  // Contribution requests table
  contributionRequests: defineTable({
    ideaId: v.id("ideas"),
    contributorId: v.id("users"),
    authorId: v.id("users"),
    message: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idea_status_created", ["ideaId", "status", "createdAt"])
    .index("by_idea_contributor", ["ideaId", "contributorId"])
    .index("by_contributor_status", ["contributorId", "status"])
    .index("by_author_created", ["authorId", "createdAt"]),

  // Todos table - tracks todo items for ideas
  todos: defineTable({
    ideaId: v.id("ideas"), // Reference to the idea
    authorId: v.id("users"), // User who created the todo
    assignedTo: v.optional(v.id("users")), // User assigned to the todo (reference to users table)
    title: v.string(), // Todo title/description
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done"),
    ), // Status of the todo
    order: v.optional(v.number()), // Order for sorting/display
    deadline: v.optional(v.number()), // Deadline as Unix timestamp
    completionTarget: v.optional(v.string()), // Target description for completion
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
  })
    .index("by_idea", ["ideaId"])
    .index("by_author", ["authorId"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_deadline", ["deadline"])
    .index("by_idea_status", ["ideaId", "status"])
    .index("by_created_at", ["createdAt"]),

  // Messages table - stores chat messages
  messages: defineTable({
    senderId: v.id("users"), // Reference to users table
    receiverId: v.optional(v.id("users")), // Reference to users table (optional for group chats)
    content: v.string(), // Message content
    createdAt: v.number(), // Unix timestamp
    read: v.boolean(), // Read status
    conversationId: v.id("conversations"), // Reference to conversations table
    messageType: v.optional(v.string()), // Message type (e.g., 'text', 'image')
  })
    .index("by_sender", ["senderId"])
    .index("by_receiver", ["receiverId"])
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created", ["conversationId", "createdAt"])
    .index("by_created_at", ["createdAt"]),

  // Conversations table - stores conversation metadata
  conversations: defineTable({
    participant1: v.optional(v.id("users")), // First participant user ID (optional for groups)
    participant2: v.optional(v.id("users")), // Second participant user ID (optional for groups)
    type: v.optional(v.string()), // 'direct' or 'group'
    ideaId: v.optional(v.id("ideas")), // Reference to idea for group chats
    creatorId: v.optional(v.union(v.string(), v.id("users"))), // Creator of group chat (stored as string ID or User ID)
    name: v.optional(v.string()), // Group chat name
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
    lastMessageId: v.optional(v.id("messages")), // Reference to latest message
    unreadCount: v.optional(v.number()), // Unread message count for current user
  })
    .index("by_participant1", ["participant1"])
    .index("by_participant2", ["participant2"])
    .index("by_created_at", ["createdAt"])
    .index("by_participants", ["participant1", "participant2"])
    .index("by_idea", ["ideaId"]),

  // Notifications table - tracks user notifications for ideas and system events
  notifications: defineTable({
    recipientId: v.id("users"), // User receiving the notification
    senderId: v.id("users"), // User who triggered the notification
    type: v.string(), // Notification type (new_idea, comment, spark, etc.)
    message: v.string(), // Notification message text
    relatedId: v.optional(
      v.union(
        v.id("ideas"),
        v.id("comments"),
        v.id("contributionRequests"),
        v.id("todos"),
        v.id("invitations"),
        v.id("badges"),
        v.id("ventures"),
        v.id("ventureCheckpoints"),
        v.id("ventureTasks"),
        v.id("ventureEvidence"),
      ),
    ), // ID of related item
    isRead: v.boolean(), // Read status
    createdAt: v.number(), // Unix timestamp
  })
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_read", ["recipientId", "isRead"])
    .index("by_recipient_created", ["recipientId", "createdAt"])
    .index("by_sender", ["senderId"])
    .index("by_related", ["relatedId"])
    .index("by_type", ["type"]),

  // Invitations table - tracks user invitations for idea contributions
  invitations: defineTable({
    ideaId: v.id("ideas"), // Reference to ideas table
    inviterId: v.id("users"), // User sending invitation
    inviteeId: v.id("users"), // User receiving invitation
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("cancelled"),
    ), // Invitation status
    message: v.optional(v.string()), // Optional invitation message
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
  })
    .index("by_idea", ["ideaId"])
    .index("by_inviter", ["inviterId"])
    .index("by_invitee", ["inviteeId"])
    .index("by_idea_status", ["ideaId", "status"])
    .index("by_invitee_status", ["inviteeId", "status"])
    .index("by_created_at", ["createdAt"]),

  // Conversation Members table - tracks membership in group chats
  conversationMembers: defineTable({
    conversationId: v.id("conversations"), // Reference to conversations
    userId: v.id("users"), // Reference to users
    role: v.optional(v.string()), // 'admin' or 'member'
    joinedAt: v.number(), // Unix timestamp
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  // --- Gamification Tables ---

  // User Wallets (Points/Coins)
  wallets: defineTable({
    userId: v.id("users"),
    balance: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_balance", ["balance"]),

  // Transactions History
  transactions: defineTable({
    walletId: v.id("wallets"),
    amount: v.number(),
    type: v.string(), // 'daily_login', 'create_idea', 'spark_idea', etc.
    description: v.string(),
    relatedId: v.optional(v.string()), // ID of related entity (idea, etc.)
    createdAt: v.number(),
  })
    .index("by_wallet", ["walletId"])
    .index("by_type", ["type"])
    .index("by_created_at", ["createdAt"]),

  // User Streaks
  userStreaks: defineTable({
    userId: v.id("users"),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastLoginDate: v.string(), // ISO date string "YYYY-MM-DD"
    lastStreakUpdate: v.number(),
    recoveryAvailable: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  // Badges Definitions
  badges: defineTable({
    slug: v.string(), // Unique identifier e.g. "first-idea"
    name: v.string(),
    description: v.string(),
    icon: v.string(), // Icon name
    category: v.string(), // 'creation', 'social', etc.
    criteria: v.any(), // Flexible criteria object
  }).index("by_slug", ["slug"]),

  // User Badges (Earned)
  userBadges: defineTable({
    userId: v.id("users"),
    badgeId: v.id("badges"),
    awardedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_badge", ["userId", "badgeId"]),

  // User Skill Progress (per Idea/Skill)
  userSkillProgress: defineTable({
    userId: v.id("users"),
    ideaId: v.id("ideas"),
    skill: v.string(),
    contributionsCount: v.number(),
    tasksCompletedCount: v.number(),
    meetingsHostedCount: v.number(),
    updatedAt: v.number(),
  }).index("by_user_idea_skill", ["userId", "ideaId", "skill"]),

  // User Skill Badges (Earned per Idea/Skill)
  userSkillBadges: defineTable({
    userId: v.id("users"),
    ideaId: v.id("ideas"),
    skill: v.string(),
    badgeLeveL: v.number(), // 1=Bronze, 2=Silver, 3=Gold, 4=Platinum
    awardedAt: v.number(),
  })
    .index("by_user_idea_skill", ["userId", "ideaId", "skill"])
    .index("by_user_skill", ["userId", "skill"]),

  // User Skill Levels (Aggregate)
  userSkillLevels: defineTable({
    userId: v.id("users"),
    skill: v.string(),
    level: v.number(),
    badgeCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_skill", ["userId", "skill"]),

  // Meetings Table
  meetings: defineTable({
    ideaId: v.id("ideas"),
    organizerId: v.optional(v.id("users")), // Made optional for legacy data
    title: v.string(),
    description: v.optional(v.string()),
    scheduledAt: v.optional(v.number()), // Made optional
    status: v.optional(v.string()), // Made optional
    attendees: v.array(v.id("users")),
    meetingLink: v.optional(v.string()),
    createdAt: v.number(),

    // Legacy fields found in existing data
    createdBy: v.optional(v.string()),
    date: v.optional(v.number()),
  })
    .index("by_organizer", ["organizerId"])
    .index("by_idea", ["ideaId"]),

  // Daily Leaderboard Winners
  dailyLeaderboardWinners: defineTable({
    date: v.string(), // YYYY-MM-DD
    userId: v.id("users"),
    rank: v.number(),
    points: v.number(),
    awardedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ─────────────────────────────────────────────────────────────────────────
  // VENTURE PROGRESSION SYSTEM
  // ─────────────────────────────────────────────────────────────────────────

  // Ventures — wraps an existing idea with 8-stage progression tracking
  ventures: defineTable({
    ideaId: v.id("ideas"),
    userId: v.id("users"),
    personaGender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    currentStage: v.number(), // 1-8
    currentCheckpoint: v.number(), // 1-N within current stage
    corruptionLevel: v.optional(v.number()), // Backward-compatible for legacy venture rows
    lastActivityAt: v.optional(v.number()), // Backward-compatible for legacy venture rows
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived"),
    ),
    assignedBosses: v.array(v.number()), // boss IDs 1-12
    skills: v.optional(v.array(v.string())), // Selected skill tags (max 5)
    industries: v.optional(v.array(v.string())), // Selected industry tags (max 4)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idea", ["ideaId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"]),

  // Venture checkpoints — tracks completion per checkpoint within a stage
  ventureCheckpoints: defineTable({
    ventureId: v.id("ventures"),
    stage: v.number(), // 1-8
    checkpoint: v.number(), // 1-N within stage
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("skipped"),
    ),
    t1Completed: v.boolean(),
    t2Completed: v.boolean(),
    t3Completed: v.boolean(),
    goldBonusEarned: v.boolean(),
    partialStartedAt: v.optional(v.number()),
    partialDecayAppliedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_venture", ["ventureId"])
    .index("by_venture_stage", ["ventureId", "stage"])
    .index("by_venture_status", ["ventureId", "status"]),

  // Venture tasks — individual T1/T2/T3 task tracking
  ventureTasks: defineTable({
    checkpointId: v.id("ventureCheckpoints"),
    taskLevel: v.union(v.literal("t1"), v.literal("t2"), v.literal("t3")),
    toolType: v.union(
      v.literal("write"),
      v.literal("table"),
      v.literal("map"),
      v.literal("survey"),
      v.literal("poll"),
      v.literal("link"),
      v.literal("upload"),
      // Legacy database value only. Do not add this back to TOOL_TYPES;
      // existing rows may still contain "oauth" and must validate until migrated.
      v.literal("oauth"),
      v.literal("self_report"),
      v.literal("journal"),
      v.literal("kanban"),
      v.literal("calendar"),
    ),
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed"),
    ),
    evidenceId: v.optional(v.id("ventureEvidence")),
    completedAt: v.optional(v.number()),
  })
    .index("by_checkpoint", ["checkpointId"])
    .index("by_checkpoint_level", ["checkpointId", "taskLevel"]),

  // Venture evidence — user-submitted proof of task completion
  ventureEvidence: defineTable({
    taskId: v.id("ventureTasks"),
    userId: v.id("users"),
    toolType: v.string(),
    content: v.any(), // Tool-specific evidence structure
    storageId: v.optional(v.id("_storage")), // For file uploads
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_user", ["userId"]),

  // Venture bosses — tracks boss encounters per venture
  ventureBosses: defineTable({
    ventureId: v.id("ventures"),
    bossId: v.number(), // 1-12
    status: v.union(
      v.literal("active"),
      v.literal("retreated"),
      v.literal("slain"),
    ),
    corruptionLevel: v.number(), // 0-100
    bossSpecificCounters: v.any(), // Boss-specific tracking data
    assignedAt: v.number(),
    defeatedAt: v.optional(v.number()),
  })
    .index("by_venture", ["ventureId"])
    .index("by_venture_status", ["ventureId", "status"]),

  // Venture tools — stores JSON blobs for generic world-map tools (Kanban, Calendar, etc.)
  ventureTools: defineTable({
    ventureId: v.id("ventures"),
    toolType: v.string(), // "kanban", "calendar", etc.
    data: v.any(), // Tool-specific JSON state
    updatedAt: v.number(),
  })
    .index("by_venture", ["ventureId"])
    .index("by_venture_tool", ["ventureId", "toolType"]),

  // ─────────────────────────────────────────────────────────────────────────
  // LEVEL PROGRESSION SYSTEM
  // ─────────────────────────────────────────────────────────────────────────

  // User level progression tracking
  userLevels: defineTable({
    userId: v.id("users"),
    currentLevel: v.number(), // 1-50
    titlePoints: v.number(), // Points toward next level
    totalPoints: v.number(), // All-time points earned
    goldCheckpoints: v.number(), // Total gold checkpoints earned
    fullLifecycles: v.number(), // Stage 1→8 completions
    helpfulFlareResponses: v.number(),
    flaresResolved: v.number(),
    menteesCount: v.number(),
    menteeCheckpointAdvances: v.number(),
    menteeLevelAchievements: v.number(),
    ideasLaunched: v.number(),
    ideasScaled: v.number(),
    collaboratorsRecruited: v.number(),
    collaboratorsJoined: v.number(),
    commentsCount: v.number(),
    upvotedCommentsCount: v.number(),
    ideasCreated: v.number(),
    ideasWithStage6: v.number(),
    ideasWithStage8: v.number(),
    activeIdeaTypes: v.array(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_level", ["currentLevel"])
    .index("by_total_points", ["totalPoints"]),

  // ─────────────────────────────────────────────────────────────────────────
  // FLARE SYSTEM (Help Requests)
  // ─────────────────────────────────────────────────────────────────────────

  // Flares — help requests fired by users
  flares: defineTable({
    userId: v.id("users"), // Who fired the flare
    ventureId: v.optional(v.id("ventures")),
    checkpointId: v.optional(v.id("ventureCheckpoints")),
    description: v.string(), // What they need help with
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_venture", ["ventureId"]),

  // Flare responses — community responses to flares
  flareResponses: defineTable({
    flareId: v.id("flares"),
    userId: v.id("users"), // Who responded
    content: v.string(),
    isHelpful: v.optional(v.boolean()), // Marked by flare sender
    createdAt: v.number(),
  })
    .index("by_flare", ["flareId"])
    .index("by_user", ["userId"])
    .index("by_flare_created", ["flareId", "createdAt"]),

  // ─────────────────────────────────────────────────────────────────────────
  // MENTORSHIP SYSTEM
  // ─────────────────────────────────────────────────────────────────────────

  // Mentorships — mentor-mentee relationships
  mentorships: defineTable({
    mentorId: v.id("users"),
    menteeId: v.id("users"),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("ended"),
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_mentor", ["mentorId"])
    .index("by_mentee", ["menteeId"])
    .index("by_mentor_status", ["mentorId", "status"])
    .index("by_mentee_status", ["menteeId", "status"]),

  // ─────────────────────────────────────────────────────────────────────────
  // BADGE SYSTEM (Extended — 62 badges)
  // ─────────────────────────────────────────────────────────────────────────

  // Venture badges — tracks which badges a user has earned (extends existing userBadges)
  ventureBadges: defineTable({
    userId: v.id("users"),
    badgeId: v.number(), // 1-62 (references BADGE_DEFINITIONS)
    awardedAt: v.number(),
    isHidden: v.boolean(), // Hidden until earned
    metadata: v.any(), // Context for award
  })
    .index("by_user", ["userId"])
    .index("by_user_badge", ["userId", "badgeId"])
    .index("by_badge", ["badgeId"]),

  // Badge evaluation tracking — avoids re-evaluating everything
  badgeEvaluations: defineTable({
    badgeId: v.number(), // 1-62
    userId: v.id("users"),
    condition: v.string(), // Condition being tracked
    lastChecked: v.number(),
    isAwarded: v.boolean(),
    awardedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_badge", ["userId", "badgeId"])
    .index("by_awarded", ["isAwarded"]),

  // ─────────────────────────────────────────────────────────────────────────
  // AI QUALITY SCORING  (Week 4 — Day 18)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Per-stage aggregate quality score for a venture.
   * Updated each time a task submission is evaluated by the AI scorer.
   */
  qualityScores: defineTable({
    ventureId: v.id("ventures"),
    stageNumber: v.number(), // 1–8
    completeness: v.number(), // 0–3
    specificity: v.number(), // 0–3
    evidence: v.number(), // 0–3
    originality: v.number(), // 0–3
    totalScore: v.number(), // 0–12
    qualityTier: v.string(), // "low" | "standard" | "high"
    valuationScore: v.number(), // mapped to user-visible ₹ valuation
    evaluatedAt: v.number(), // timestamp
  })
    .index("by_venture", ["ventureId"])
    .index("by_venture_stage", ["ventureId", "stageNumber"]),

  /**
   * Individual task-level AI evaluation record.
   * One row per task submission that has been scored.
   */
  aiEvaluations: defineTable({
    taskId: v.id("ventureTasks"),
    checkpointId: v.id("ventureCheckpoints"),
    content: v.string(), // submitted text content
    completeness: v.number(), // 0–3
    specificity: v.number(), // 0–3
    evidence: v.number(), // 0–3
    originality: v.number(), // 0–3
    totalScore: v.number(), // 0–12
    feedback: v.optional(v.string()), // AI-generated feedback text
    modelUsed: v.string(), // e.g. "gpt-4o" | "llama-3" | "mock"
    evaluatedAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_checkpoint", ["checkpointId"]),

  // ─────────────────────────────────────────────────────────────────────────
  // FEATURE FLAGS  (Week 4 — Day 20)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Feature flags for phased rollout.
   * All new V1 features are gated behind flags until 100% rollout.
   *
   * V1 flags:
   *   phaser_world_map | ai_quality_scoring | persona_system | audio_system
   */
  featureFlags: defineTable({
    flag: v.string(), // unique flag name
    enabled: v.boolean(), // global on/off
    rolloutPercentage: v.number(), // 0–100 (percentage of users)
    enabledForUsers: v.array(v.id("users")), // explicit user overrides
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_flag", ["flag"]),
});
