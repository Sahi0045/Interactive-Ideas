import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Create a new contribution request
export const createContributionRequest = mutation({
  args: {
    ideaId: v.id("ideas"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get authenticated user from Clerk
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required: Please sign in to continue");
      }

      // Find user by Clerk ID
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();

      if (!user) {
        console.error("User lookup failed for Clerk ID:", identity.subject);
        throw new ConvexError("User profile not found: Please complete your profile setup");
      }

      // Check if idea exists and get author
      const idea = await ctx.db.get(args.ideaId);
      if (!idea) {
        console.error("Idea lookup failed for ID:", args.ideaId);
        throw new ConvexError("Idea not found or has been removed");
      }

      // Check if idea is deleted
      if (idea.isDeleted) {
        console.error("Attempt to create contribution request for deleted idea:", args.ideaId);
        throw new ConvexError("Cannot create contribution request for a deleted idea");
      }

      // Prevent author from requesting contribution to their own idea
      if (user._id === idea.authorId) {
        throw new ConvexError("You cannot request contribution to your own idea");
      }

      // Validate message
      if (!args.message?.trim()) {
        throw new ConvexError("Message is required");
      }

      if (args.message.length > 1200) {
        throw new ConvexError("Message must be 1200 characters or less");
      }

      const now = Date.now();

      // Check for existing request to prevent duplicates
      const existingRequest = await ctx.db
        .query("contributionRequests")
        .withIndex("by_idea_contributor", (q) =>
          q.eq("ideaId", args.ideaId).eq("contributorId", user._id)
        )
        .unique();

      if (existingRequest) {
        console.log("Duplicate request attempt by user:", user.username, "for idea:", args.ideaId);
        throw new ConvexError("You've already sent a contribution request for this idea");
      }

      // Check for existing invitation to prevent duplicates
      const existingInvitation = await ctx.db
        .query("invitations")
        .withIndex("by_invitee_status", (q) =>
          q.eq("inviteeId", user._id).eq("status", "pending")
        )
        .collect()
        .then(invitations =>
          invitations.find(inv => inv.ideaId === args.ideaId)
        );

      if (existingInvitation) {
        console.log("Duplicate invitation exists for user:", user.username, "on idea:", args.ideaId);
        throw new ConvexError("An invitation is already pending for you on this idea");
      }

      // Create the contribution request
      const requestId = await ctx.db.insert("contributionRequests", {
        ideaId: args.ideaId,
        contributorId: user._id,
        authorId: idea.authorId,
        message: args.message.trim(),
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });

      console.log("Created contribution request:", requestId, "by user:", user.username, "for idea:", args.ideaId);

      // Increment contributionRequestCount atomically
      await ctx.db.patch(idea._id, {
        contributionRequestCount: (idea.contributionRequestCount || 0) + 1,
        updatedAt: now,
      });

      // Create notification for idea author (if not the same user)
      if (idea.authorId !== user._id) {
        await ctx.db.insert("notifications", {
          recipientId: idea.authorId,
          senderId: user._id,
          type: "contribution_request_received",
          message: `${user.displayName} requested to contribute to your idea "${idea.title}"`,
          relatedId: requestId, // Note: relatedId should be the request ID, not idea ID for proper categorization
          isRead: false,
          createdAt: now,
        });
      }



      // Gamification: Award XP and Points for contribution request

      // 1. Award Sender (Contributor) - 1 Point
      await ctx.scheduler.runAfter(0, internal.gamification.internalAwardXP, {
        userId: user._id,
        amount: 1,
        action: "contribution_request_sent",
      });
      await ctx.scheduler.runAfter(0, internal.gamification.internalAwardPoints, {
        userId: user._id,
        amount: 1,
        type: "contribution_request_sent",
        description: "Sent contribution request"
      });

      // 2. Award Author - 3 Points (Public) or 1 Point (Private)
      const pointsForAuthor = idea.visibility === 'public' ? 3 : 1;

      await ctx.scheduler.runAfter(0, internal.gamification.internalAwardXP, {
        userId: idea.authorId,
        amount: pointsForAuthor,
        action: "contribution_request_received",
      });
      await ctx.scheduler.runAfter(0, internal.gamification.internalAwardPoints, {
        userId: idea.authorId,
        amount: pointsForAuthor,
        type: "contribution_request_received",
        description: `Received contribution request on ${idea.visibility} idea`
      });

      return { requestId, message: "Contribution request created successfully" };
    } catch (error) {
      console.error("Error in createContributionRequest:", error);
      throw error; // Re-throw to maintain original error messages
    }
  },
});

// Get contribution requests for an idea (for the author)
export const getRequestsByIdea = query({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required: Please sign in to access requests");
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();

      if (!user) {
        console.log("User profile not found for Clerk ID:", identity.subject, "- returning empty array");
        return []; // Return empty array for users without profile
      }

      // Check if idea exists and is not deleted
      const idea = await ctx.db.get(args.ideaId);
      if (!idea) {
        console.log("Idea lookup failed for ID:", args.ideaId, "by user:", user.username);
        throw new ConvexError("Idea not found or has been removed");
      }

      if (idea.isDeleted) {
        console.log("Attempt to view requests for deleted idea:", args.ideaId, "by user:", user.username);
        return []; // Return empty array for deleted ideas
      }

      // Check if user is the author - return empty for unauthorized
      if (idea.authorId !== user._id) {
        return [];
      }


      const requests = await ctx.db
        .query("contributionRequests")
        .withIndex("by_idea_status_created", (q) => q.eq("ideaId", args.ideaId))
        .order("desc")
        .take(50);


      // Get contributor and author information for each request with error handling
      const requestsWithUsers = await Promise.all(
        requests.map(async (request) => {
          try {
            const contributor = await ctx.db.get(request.contributorId);
            const author = await ctx.db.get(request.authorId);
            return {
              ...request,
              contributor: contributor ? {
                name: contributor.displayName,
                username: contributor.username,
              } : null, // Contributor might have been deleted
              author: author ? {
                name: author.displayName,
                username: author.username,
              } : null, // Author might have been deleted
            };
          } catch (error) {
            console.error("Error fetching user data for request:", request._id, error);
            return {
              ...request,
              contributor: null,
              author: null,
            };
          }
        })
      );

      return requestsWithUsers;
    } catch (error) {
      console.error("Error in getRequestsByIdea:", error);
      throw error;
    }
  },
});

// Get contribution requests made by current user (for contributor)
export const getMyRequests = query({
  handler: async (ctx) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      console.log("[DEBUG getMyRequests] Identity check:", {
        hasIdentity: !!identity,
        subject: identity?.subject,
        timestamp: new Date().toISOString()
      });
      if (!identity) {
        console.log("[DEBUG getMyRequests] No identity found, returning empty array");
        return []; // Return empty array for unauthenticated users
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();

      if (!user) {
        console.log("User profile not found for Clerk ID:", identity.subject, "- returning empty array");
        return []; // Return empty array for users without profile
      }

      const requests = await ctx.db
        .query("contributionRequests")
        .withIndex("by_contributor_status", (q) =>
          q.eq("contributorId", user._id)
        )
        .order("desc")
        .take(50);

      // Get idea and author info with error handling
      const requestsWithInfo = await Promise.all(
        requests.map(async (request) => {
          try {
            const idea = await ctx.db.get(request.ideaId);
            const author = await ctx.db.get(request.authorId);

            // Only return idea info if it's not deleted or user is the author/requestor
            let ideaInfo = null;
            if (idea) {
              if (!idea.isDeleted || (user && user._id === idea.authorId)) {
                ideaInfo = {
                  title: idea.title,
                  _id: idea._id,
                  isDeleted: idea.isDeleted,
                };
              }
            }

            return {
              ...request,
              idea: ideaInfo,
              author: author ? {
                displayName: author.displayName,
                username: author.username,
              } : null,
            };
          } catch (error) {
            console.error("Error fetching data for request:", request._id, error);
            return {
              ...request,
              idea: null,
              author: null,
            };
          }
        })
      );

      return requestsWithInfo;
    } catch (error) {
      console.error("Error in getMyRequests:", error);
      throw error;
    }
  },
});

// Get incoming contribution requests for current user (for author)
export const getIncomingRequests = query({
  handler: async (ctx) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required: Please sign in to access your requests");
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();

      if (!user) {
        console.log("User profile not found for Clerk ID:", identity.subject, "- returning empty array");
        return []; // Return empty array for users without profile
      }

      const requests = await ctx.db
        .query("contributionRequests")
        .withIndex("by_author_created", (q) =>
          q.eq("authorId", user._id)
        )
        .order("desc")
        .take(50);

      // Get idea, contributor and author info with error handling
      const requestsWithInfo = await Promise.all(
        requests.map(async (request) => {
          try {
            const idea = await ctx.db.get(request.ideaId);
            const contributor = await ctx.db.get(request.contributorId);

            // Only return idea info if it's not deleted or user is the author
            let ideaInfo = null;
            if (idea) {
              if (!idea.isDeleted || (user && user._id === idea.authorId)) {
                ideaInfo = {
                  title: idea.title,
                  description: idea.description,
                  _id: idea._id,
                  isDeleted: idea.isDeleted,
                  isAuthor: true,
                };
              }
            }

            return {
              ...request,
              idea: ideaInfo,
              contributor: contributor ? {
                avatar: contributor.avatar,
                displayName: contributor.displayName,
                username: contributor.username,
              } : null,
            };
          } catch (error) {
            console.error("Error fetching data for request:", request._id, error);
            return {
              ...request,
              idea: null,
              contributor: null,
            };
          }
        })
      );

      return requestsWithInfo;
    } catch (error) {
      console.error("Error in getIncomingRequests:", error);
      throw error;
    }
  },
});

// Update request status (accept/reject) by author only
export const updateRequestStatus = mutation({
  args: {
    requestId: v.id("contributionRequests"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required: Please sign in to continue");
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();

      if (!user) {
        console.error("User lookup failed for Clerk ID:", identity.subject);
        throw new ConvexError("User profile not found: Please complete your profile setup");
      }

      const request = await ctx.db.get(args.requestId);
      if (!request) {
        console.error("Request lookup failed for ID:", args.requestId);
        throw new ConvexError("Request not found or has been removed");
      }

      // Only author can update status
      if (request.authorId !== user._id) {
        console.error("Authorization failed: User", user.username, "attempted to update request owned by", request.authorId);
        throw new ConvexError("Not authorized to update this request");
      }

      // Validate status transition - only allow updates if status is 'pending'
      if (request.status !== "pending") {
        console.log("Invalid status transition attempt:", {
          requestId: args.requestId,
          currentStatus: request.status,
          attemptedStatus: args.status
        });
        throw new ConvexError(`Cannot ${args.status} a request that is already ${request.status}`);
      }

      console.log("Updating request status:", args.requestId, "from pending to", args.status, "by user:", user.username);

      // Update status with concurrent update protection
      await ctx.db.patch(args.requestId, {
        status: args.status,
        updatedAt: Date.now(),
      });

      // Verify the update was successful
      const updatedRequest = await ctx.db.get(args.requestId);
      if (updatedRequest?.status !== args.status) {
        console.error("Concurrent update conflict detected for request:", args.requestId);
        throw new ConvexError("Request status update failed due to concurrent modification");
      }

      console.log("Successfully updated request:", args.requestId, "to status:", args.status);

      // Create notification for the contributor about the status update
      await ctx.db.insert("notifications", {
        recipientId: request.contributorId,
        senderId: user._id,
        type: args.status === "accepted" ? "contribution_request_accepted" : "contribution_request_rejected",
        message: args.status === "accepted"
          ? `${user.displayName} accepted your contribution request`
          : `${user.displayName} declined your contribution request`,
        relatedId: request.ideaId,
        isRead: false,
        createdAt: Date.now(),
      });

      // Gamification: Award XP/Points for status update
      const idea = await ctx.db.get(request.ideaId);
      if (idea) {
        const isPublic = idea.visibility === 'public';

        if (args.status === 'accepted') {
          // Accepted: Author +4 (Public) / +2 (Private)
          const authorPoints = isPublic ? 4 : 2;
          await ctx.scheduler.runAfter(0, internal.gamification.internalAwardXP, { userId: user._id, amount: authorPoints, action: "request_accepted_author" });
          await ctx.scheduler.runAfter(0, internal.gamification.internalAwardPoints, { userId: user._id, amount: authorPoints, type: "request_accepted", description: "Accepted contribution request" });

          // Accepted: Contributor +10 (Public) / +5 (Private)
          const contributorPoints = isPublic ? 10 : 5;
          await ctx.scheduler.runAfter(0, internal.gamification.internalAwardXP, { userId: request.contributorId, amount: contributorPoints, action: "request_accepted_contributor" });
          await ctx.scheduler.runAfter(0, internal.gamification.internalAwardPoints, { userId: request.contributorId, amount: contributorPoints, type: "contribution_accepted", description: "Contribution request accepted" });

          // Gamification: Badges Check (Collaborator)
          await ctx.scheduler.runAfter(0, internal.badges.checkBadges, {
            userId: user._id,
            trigger: "accept_contribution",
          });

          // Gamification V2: Skill Badge Progress
          // Parse skills from idea.category (comma-separated)
          if (idea.category) {
            const skills = idea.category.split(',').map(s => s.trim()).filter(s => s);
            for (const skill of skills) {
              await ctx.scheduler.runAfter(0, internal.skillBadges.incrementSkillProgress, {
                userId: request.contributorId,
                ideaId: idea._id,
                skill: skill,
                type: "contribution",
              });
            }
          }

        } else if (args.status === 'rejected') {
          // Rejected: Author +1 (Public) / +0 (Private)
          const authorPoints = isPublic ? 1 : 0;
          if (authorPoints > 0) {
            await ctx.scheduler.runAfter(0, internal.gamification.internalAwardXP, { userId: user._id, amount: authorPoints, action: "request_rejected_author" });
            await ctx.scheduler.runAfter(0, internal.gamification.internalAwardPoints, { userId: user._id, amount: authorPoints, type: "request_rejected", description: "Rejected contribution request" });
          }
        }
      }

      return { message: "Request status updated successfully" };
    } catch (error) {
      console.error("Error in updateRequestStatus:", error);
      throw error; // Re-throw to maintain original error messages
    }
  },
});

// Get all accepted contributors for an idea (publicly accessible for authenticated users)
export const getAcceptedContributors = query({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const requests = await ctx.db
      .query("contributionRequests")
      .withIndex("by_idea_status_created", (q) =>
        q.eq("ideaId", args.ideaId).eq("status", "accepted")
      )
      .collect();

    return requests;
  },
});