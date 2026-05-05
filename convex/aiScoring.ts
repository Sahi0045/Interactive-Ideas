import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four scoring dimensions (each 0–3).
 * Total score = sum of all four dimensions → range 0–12.
 *
 * Quality tiers (per PRD):
 *   Low      0–4
 *   Standard 5–8
 *   High     9–12
 */
export interface ScoringDimensions {
  completeness: number; // Does the submission fully address the task prompt?
  specificity: number; // Are claims specific, named, and concrete?
  evidence: number; // Is real-world evidence attached or referenced?
  originality: number; // Is the thinking genuinely the user's own?
}

export interface EvaluationResult extends ScoringDimensions {
  totalScore: number; // 0–12
  qualityTier: "low" | "standard" | "high";
  feedback: string; // One-sentence guidance for the user
  modelUsed: string;
  valuationScore: number; // Mapped ₹ valuation (see VALUATION_MAP)
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a quality tier to an integer valuation multiplier (arbitrary unit).
 * The UI can format this as ₹ or any currency later.
 */
const VALUATION_MAP: Record<"low" | "standard" | "high", number> = {
  low: 100_000, // ₹1 Lakh
  standard: 500_000, // ₹5 Lakh
  high: 2_000_000, // ₹20 Lakh
};

function getQualityTier(total: number): "low" | "standard" | "high" {
  if (total >= 9) return "high";
  if (total >= 5) return "standard";
  return "low";
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildScoringPrompt(
  content: string,
  checkpointOutcome: string,
): string {
  return `You are a rigorous academic evaluator assessing a startup founder's checkpoint submission.

CHECKPOINT OUTCOME BEING EVALUATED:
"${checkpointOutcome}"

SUBMISSION:
"${content}"

Score the submission on EXACTLY these four dimensions. Each dimension is scored 0, 1, 2, or 3.
Return ONLY a valid JSON object with no extra text.

SCORING RUBRIC:
- completeness: Does the submission fully address every part of the checkpoint outcome? (0=missing, 1=partial, 2=mostly, 3=complete)
- specificity: Are claims concrete and named (real people, places, numbers, companies)? (0=vague, 1=some specifics, 2=mostly specific, 3=fully specific)
- evidence: Is real-world evidence referenced (links, data, quotes, uploads)? (0=none, 1=anecdotal, 2=some evidence, 3=strong evidence)
- originality: Is the thinking genuinely the user's own vs. generic/copied? (0=generic, 1=some original thought, 2=mostly original, 3=clearly original)

Also write a single sentence of actionable feedback.

RESPOND WITH ONLY THIS JSON (no markdown, no extra text):
{
  "completeness": <0-3>,
  "specificity": <0-3>,
  "evidence": <0-3>,
  "originality": <0-3>,
  "feedback": "<one sentence of actionable feedback>"
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SCORER (fallback when API keys are absent)
// ─────────────────────────────────────────────────────────────────────────────

function mockScore(
  content: string,
): ScoringDimensions & { feedback: string; modelUsed: string } {
  const words = content.trim().split(/\s+/).length;

  // Deterministic scoring based on submission length and keyword presence
  const hasNumbers = /\d+/.test(content);
  const hasLinks = /https?:\/\//.test(content);
  const hasQuotes = /"[^"]+"/.test(content);
  const hasNames = /[A-Z][a-z]+ [A-Z][a-z]+/.test(content);

  const completeness = words > 100 ? 3 : words > 50 ? 2 : words > 20 ? 1 : 0;
  const specificity =
    (hasNumbers ? 1 : 0) + (hasNames ? 1 : 0) + (words > 80 ? 1 : 0);
  const evidence = (hasLinks ? 2 : 0) + (hasQuotes ? 1 : 0);
  const originality = words > 60 ? 2 : words > 30 ? 1 : 0;

  const total =
    completeness + specificity + Math.min(evidence, 3) + originality;
  const tier = getQualityTier(total);

  const feedbackMap = {
    low: "Add specific names, numbers, and at least one external link to strengthen your submission.",
    standard:
      "Good start — include more concrete evidence like quotes, data sources, or user feedback.",
    high: "Strong submission. Consider adding direct quotes from users or competitors to reach gold standard.",
  };

  return {
    completeness,
    specificity,
    evidence: Math.min(evidence, 3),
    originality,
    feedback: feedbackMap[tier],
    modelUsed: "mock",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FREE TIER SCORER — Replicate (open-weight models)
// ─────────────────────────────────────────────────────────────────────────────

async function scoreWithReplicate(
  content: string,
  checkpointOutcome: string,
  replicateApiKey: string,
): Promise<ScoringDimensions & { feedback: string; modelUsed: string }> {
  const prompt = buildScoringPrompt(content, checkpointOutcome);

  // Using Llama 3 8B Instruct via Replicate
  const response = await fetch(
    "https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt,
          max_tokens: 300,
          temperature: 0.1,
          system_prompt:
            "You are a strict JSON-only evaluator. Respond only with valid JSON.",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Replicate API error: ${response.status}`);
  }

  const prediction = (await response.json()) as {
    urls?: { get?: string };
    id?: string;
  };

  // Poll for completion (Replicate is async)
  const getUrl = prediction?.urls?.get;
  if (!getUrl) throw new Error("No polling URL from Replicate");

  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    const poll = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${replicateApiKey}` },
    });
    const result = (await poll.json()) as {
      status?: string;
      output?: string[];
    };

    if (result.status === "succeeded" && result.output) {
      const raw = Array.isArray(result.output)
        ? result.output.join("")
        : String(result.output);
      return parseAIResponse(raw, "llama-3-8b");
    }

    if (result.status === "failed") {
      throw new Error("Replicate prediction failed");
    }

    attempts++;
  }

  throw new Error("Replicate prediction timed out");
}

// ─────────────────────────────────────────────────────────────────────────────
// PRO TIER SCORER — OpenAI GPT-4o
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score with Anthropic Claude (Haiku) for Pro tier users.
 * Uses the Anthropic HTTP API directly via fetch.
 */
async function scoreWithClaude(
  content: string,
  checkpointOutcome: string,
  anthropicApiKey: string,
): Promise<ScoringDimensions & { feedback: string; modelUsed: string }> {
  const prompt = buildScoringPrompt(content, checkpointOutcome);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a strict JSON-only evaluator. Respond only with valid JSON, no markdown fences.\n\n${prompt}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ text?: string; type?: string }>;
  };

  const raw = data?.content?.[0]?.text ?? "";
  return parseAIResponse(raw, "claude-3-haiku-20240307");
}

/**
 * Score with OpenAI GPT-4o (fallback or Free tier).
 */
async function scoreWithOpenAI(
  content: string,
  checkpointOutcome: string,
  openAIApiKey: string,
): Promise<ScoringDimensions & { feedback: string; modelUsed: string }> {
  const prompt = buildScoringPrompt(content, checkpointOutcome);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON-only evaluator. Respond only with valid JSON, no markdown fences.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = data?.choices?.[0]?.message?.content ?? "";
  return parseAIResponse(raw, "gpt-4o");
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseAIResponse(
  raw: string,
  modelUsed: string,
): ScoringDimensions & { feedback: string; modelUsed: string } {
  // Strip markdown fences if present
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find the first JSON object in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `Could not parse JSON from AI response: ${raw.slice(0, 200)}`,
    );
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    completeness?: unknown;
    specificity?: unknown;
    evidence?: unknown;
    originality?: unknown;
    feedback?: unknown;
  };

  const clamp = (v: unknown): number =>
    Math.max(0, Math.min(3, Math.round(Number(v ?? 0))));

  return {
    completeness: clamp(parsed.completeness),
    specificity: clamp(parsed.specificity),
    evidence: clamp(parsed.evidence),
    originality: clamp(parsed.originality),
    feedback: String(parsed.feedback ?? "Continue refining your submission."),
    modelUsed,
  };
}

type WriteAssistMode = "outline" | "strengthen" | "sharpen";

interface WriteAssistResult {
  suggestion: string;
  bullets: string[];
  rewrite: string;
  modelUsed: string;
}

function buildWriteAssistPrompt(
  prompt: string,
  draft: string,
  mode: WriteAssistMode,
): string {
  return `You are helping a founder improve a checkpoint submission.

TASK PROMPT:
"${prompt}"

CURRENT DRAFT:
"${draft || "(empty draft)"}"

MODE:
${mode}

Respond ONLY with valid JSON:
{
  "suggestion": "<2-3 sentence coaching note>",
  "bullets": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
  "rewrite": "<a concrete improved passage in markdown>"
}

Rules:
- Keep the advice concrete and specific to the prompt.
- If mode is outline, produce a structured starting draft.
- If mode is strengthen, add specifics, evidence hooks, and sharper framing.
- If mode is sharpen, reduce fluff and tighten the writing.
- Do not include markdown fences or extra commentary outside JSON.`;
}

function parseWriteAssistResponse(
  raw: string,
  modelUsed: string,
): WriteAssistResult {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse JSON from AI response: ${raw.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    suggestion?: unknown;
    bullets?: unknown;
    rewrite?: unknown;
  };

  return {
    suggestion: String(
      parsed.suggestion ?? "Add concrete evidence, named actors, and a clearer next step.",
    ),
    bullets: Array.isArray(parsed.bullets)
      ? parsed.bullets
          .map((bullet) => String(bullet).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [],
    rewrite: String(parsed.rewrite ?? ""),
    modelUsed,
  };
}

function mockWriteAssist(
  prompt: string,
  draft: string,
  mode: WriteAssistMode,
): WriteAssistResult {
  const trimmedDraft = draft.trim();
  const firstSentence =
    trimmedDraft.split(/[.!?]\s/).find((sentence) => sentence.trim())?.trim() ??
    "State the problem in one sentence.";

  if (mode === "outline") {
    return {
      suggestion:
        "Start with the situation, name the user, then quantify the cost of the problem before proposing a direction.",
      bullets: [
        "Who has the problem, and in what context?",
        "What happens today, and what does it cost in time, money, or frustration?",
        "What specific evidence or example proves the problem is real?",
      ],
      rewrite: `## Working outline\n\n- User and context\n- Problem moment\n- Cost of the problem\n- Evidence or example\n- Proposed next step\n\n**Starter line:** ${firstSentence}`,
      modelUsed: "mock",
    };
  }

  if (mode === "sharpen") {
    return {
      suggestion:
        "Tighten the draft by removing generic claims and replacing them with named users, numbers, and a direct conclusion.",
      bullets: [
        "Cut filler phrases like 'very important' or 'really useful'.",
        "Replace broad claims with one number, quote, or concrete example.",
        "End with a clear decision or next step.",
      ],
      rewrite: trimmedDraft
        ? trimmedDraft
            .split(/\s+/)
            .slice(0, 120)
            .join(" ")
        : `The problem affects a specific user in a specific moment. The cost is visible and measurable. The next step is to validate it with real evidence tied to ${prompt}.`,
      modelUsed: "mock",
    };
  }

  return {
    suggestion:
      "Strengthen the submission by adding evidence hooks, sharper differentiation, and one explicit decision statement.",
    bullets: [
      "Name the target user and the moment the problem appears.",
      "Add one proof point: a quote, metric, link, or observed example.",
      "State what you will do next based on this checkpoint.",
    ],
    rewrite: trimmedDraft
      ? `${trimmedDraft}\n\n### Strengthen this\nAdd a concrete example, a measurable cost, and the decision this evidence supports.`
      : `The user is [specific role] in [specific context]. The problem appears when [moment]. It costs [time/money/frustration]. Evidence from [source] shows the problem is real, which supports the next decision: [decision].`,
    modelUsed: "mock",
  };
}

async function generateWriteAssistWithOpenAI(
  prompt: string,
  draft: string,
  mode: WriteAssistMode,
  openAIApiKey: string,
): Promise<WriteAssistResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: buildWriteAssistPrompt(prompt, draft, mode),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  return parseWriteAssistResponse(raw, "gpt-4o-mini");
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL MUTATION — save evaluation result to DB
// ─────────────────────────────────────────────────────────────────────────────

export const saveEvaluationResult = internalMutation({
  args: {
    taskId: v.id("ventureTasks"),
    checkpointId: v.id("ventureCheckpoints"),
    ventureId: v.id("ventures"),
    stageNumber: v.number(),
    content: v.string(),
    completeness: v.number(),
    specificity: v.number(),
    evidence: v.number(),
    originality: v.number(),
    totalScore: v.number(),
    qualityTier: v.string(),
    valuationScore: v.number(),
    feedback: v.optional(v.string()),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Save per-task AI evaluation
    await ctx.db.insert("aiEvaluations", {
      taskId: args.taskId,
      checkpointId: args.checkpointId,
      content: args.content,
      completeness: args.completeness,
      specificity: args.specificity,
      evidence: args.evidence,
      originality: args.originality,
      totalScore: args.totalScore,
      feedback: args.feedback,
      modelUsed: args.modelUsed,
      evaluatedAt: now,
    });

    // Upsert aggregate quality score for the stage
    const existing = await ctx.db
      .query("qualityScores")
      .withIndex("by_venture_stage", (q) =>
        q.eq("ventureId", args.ventureId).eq("stageNumber", args.stageNumber),
      )
      .first();

    if (existing) {
      // Average new score with existing (rolling update)
      const avgScore = (existing.totalScore + args.totalScore) / 2;
      const newTier = getQualityTier(Math.round(avgScore));
      await ctx.db.patch(existing._id, {
        completeness: (existing.completeness + args.completeness) / 2,
        specificity: (existing.specificity + args.specificity) / 2,
        evidence: (existing.evidence + args.evidence) / 2,
        originality: (existing.originality + args.originality) / 2,
        totalScore: avgScore,
        qualityTier: newTier,
        valuationScore: VALUATION_MAP[newTier],
        evaluatedAt: now,
      });
    } else {
      await ctx.db.insert("qualityScores", {
        ventureId: args.ventureId,
        stageNumber: args.stageNumber,
        completeness: args.completeness,
        specificity: args.specificity,
        evidence: args.evidence,
        originality: args.originality,
        totalScore: args.totalScore,
        qualityTier: args.qualityTier,
        valuationScore: args.valuationScore,
        evaluatedAt: now,
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
export const generateWriteAssist = action({
  args: {
    prompt: v.string(),
    draft: v.optional(v.string()),
    mode: v.union(
      v.literal("outline"),
      v.literal("strengthen"),
      v.literal("sharpen"),
    ),
  },
  handler: async (_ctx, args) => {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    try {
      if (OPENAI_API_KEY) {
        return await generateWriteAssistWithOpenAI(
          args.prompt,
          args.draft ?? "",
          args.mode,
          OPENAI_API_KEY,
        );
      }
    } catch (error) {
      console.error("generateWriteAssist failed, falling back to mock", error);
    }

    return mockWriteAssist(args.prompt, args.draft ?? "", args.mode);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
export const evaluateTaskSubmission = action({
  args: {
    taskId: v.id("ventureTasks"),
    checkpointId: v.id("ventureCheckpoints"),
    ventureId: v.id("ventures"),
    stageNumber: v.number(),
    content: v.string(),
    checkpointOutcome: v.string(),
    userTier: v.union(v.literal("free"), v.literal("pro")),
  },
  handler: async (ctx, args) => {
    const { content, checkpointOutcome, userTier } = args;

    // ── Get API keys from env ────────────────────────────────────────────────
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    let scored;

    try {
      // Pro tier: Use Claude Haiku (Anthropic) for cost-efficiency and quality
      if (userTier === "pro" && ANTHROPIC_API_KEY) {
        scored = await scoreWithClaude(
          content,
          checkpointOutcome,
          ANTHROPIC_API_KEY,
        );
      }
      // Fallback to OpenAI if Anthropic key is unavailable
      else if (userTier === "pro" && OPENAI_API_KEY) {
        scored = await scoreWithOpenAI(
          content,
          checkpointOutcome,
          OPENAI_API_KEY,
        );
      }
      // Free tier: Use Replicate (Llama 3)
      else if (REPLICATE_API_KEY) {
        scored = await scoreWithReplicate(
          content,
          checkpointOutcome,
          REPLICATE_API_KEY,
        );
      }
      // Final fallback: mock scoring
      else {
        scored = mockScore(content);
      }
    } catch (e) {
      console.error("AI Scoring failed, falling back to mock:", e);
      scored = mockScore(content);
    }

    // ── Build result ──────────────────────────────────────────────────────────
    const totalScore =
      scored.completeness +
      scored.specificity +
      scored.evidence +
      scored.originality;
    const qualityTier = getQualityTier(totalScore);
    const valuationScore = VALUATION_MAP[qualityTier];

    const result: EvaluationResult = {
      completeness: scored.completeness,
      specificity: scored.specificity,
      evidence: scored.evidence,
      originality: scored.originality,
      totalScore,
      qualityTier,
      feedback: scored.feedback,
      modelUsed: scored.modelUsed,
      valuationScore,
    };

    // ── Persist to database ───────────────────────────────────────────────────
    await ctx.runMutation(internal.aiScoring.saveEvaluationResult, {
      taskId: args.taskId,
      checkpointId: args.checkpointId,
      ventureId: args.ventureId,
      stageNumber: args.stageNumber,
      content,
      completeness: scored.completeness,
      specificity: scored.specificity,
      evidence: scored.evidence,
      originality: scored.originality,
      totalScore,
      qualityTier,
      valuationScore,
      feedback: scored.feedback,
      modelUsed: scored.modelUsed,
    });

    return result;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES — read scoring data back into the UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the aggregate quality score for a stage within a venture.
 * Used by the HUD's QualityScore component.
 */
export const getStageQualityScore = query({
  args: {
    ventureId: v.id("ventures"),
    stageNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("qualityScores")
      .withIndex("by_venture_stage", (q) =>
        q.eq("ventureId", args.ventureId).eq("stageNumber", args.stageNumber),
      )
      .first();
  },
});

/**
 * Get all quality scores for a venture across all stages.
 * Used on the venture detail page to show overall quality.
 */
export const getVentureQualityScores = query({
  args: {
    ventureId: v.id("ventures"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("qualityScores")
      .withIndex("by_venture", (q) => q.eq("ventureId", args.ventureId))
      .collect();
  },
});

/**
 * Get the AI evaluation for a specific task.
 * Used in the checkpoint detail panel to show per-task feedback.
 */
export const getTaskEvaluation = query({
  args: {
    taskId: v.id("ventureTasks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiEvaluations")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .first();
  },
});

/**
 * Get AI evaluation status for every task in a checkpoint.
 * Used by the world-map checkpoint panel to show pending vs scored tasks.
 */
export const getCheckpointEvaluationSummary = query({
  args: {
    checkpointId: v.id("ventureCheckpoints"),
  },
  handler: async (ctx, args) => {
    const deriveQualityTier = (score: number) => {
      if (score >= 9) return "High";
      if (score >= 5) return "Standard";
      return "Low";
    };

    const tasks = await ctx.db
      .query("ventureTasks")
      .withIndex("by_checkpoint", (q) =>
        q.eq("checkpointId", args.checkpointId),
      )
      .collect();

    const evaluations = await Promise.all(
      tasks.map(async (task) => {
        const evaluation = await ctx.db
          .query("aiEvaluations")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .first();

        return {
          taskId: task._id,
          taskLevel: task.taskLevel,
          taskStatus: task.status,
          evaluation: evaluation
            ? {
                qualityTier: deriveQualityTier(evaluation.totalScore),
                totalScore: evaluation.totalScore,
                feedback: evaluation.feedback,
              }
            : null,
          isPending: task.status === "completed" && evaluation === null,
        };
      }),
    );

    return evaluations;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE FLAGS — read/write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed the V1 feature flags into the database.
 * Run once during deployment — idempotent.
 */
export const seedFeatureFlags = mutation({
  args: {},
  handler: async (ctx) => {
    const V1_FLAGS = [
      {
        flag: "phaser_world_map",
        enabled: true,
        rolloutPercentage: 100,
        description: "Phaser 3 world map rendering",
      },
      {
        flag: "ai_quality_scoring",
        enabled: true,
        rolloutPercentage: 100,
        description: "AI-powered task evaluation",
      },
      {
        flag: "persona_system",
        enabled: true,
        rolloutPercentage: 100,
        description: "Character sprites on world map",
      },
      {
        flag: "audio_system",
        enabled: true,
        rolloutPercentage: 100,
        description: "Howler.js ambient + SFX audio",
      },
      // Post-V1 (disabled)
      {
        flag: "academic_template",
        enabled: false,
        rolloutPercentage: 0,
        description: "Academic project template",
      },
      {
        flag: "lab_template",
        enabled: false,
        rolloutPercentage: 0,
        description: "Lab/experimental template",
      },
      {
        flag: "creative_template",
        enabled: false,
        rolloutPercentage: 0,
        description: "Creative project template",
      },
      {
        flag: "ai_tag_suggestion",
        enabled: false,
        rolloutPercentage: 0,
        description: "AI-generated skill/industry tags",
      },
      {
        flag: "ai_matching",
        enabled: false,
        rolloutPercentage: 0,
        description: "Collaborator matching algorithm",
      },
      {
        flag: "corruption_mechanic",
        enabled: false,
        rolloutPercentage: 0,
        description: "World corruption on inactivity",
      },
    ] as const;

    const now = Date.now();

    for (const f of V1_FLAGS) {
      const existing = await ctx.db
        .query("featureFlags")
        .withIndex("by_flag", (q) => q.eq("flag", f.flag))
        .first();

      if (!existing) {
        await ctx.db.insert("featureFlags", {
          flag: f.flag,
          enabled: f.enabled,
          rolloutPercentage: f.rolloutPercentage,
          enabledForUsers: [],
          description: f.description,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { seeded: V1_FLAGS.length };
  },
});

/**
 * Check if a feature flag is enabled for a given user.
 * Checks global enabled + rollout percentage + per-user overrides.
 */
export const isFeatureEnabled = query({
  args: {
    flag: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const flagDoc = await ctx.db
      .query("featureFlags")
      .withIndex("by_flag", (q) => q.eq("flag", args.flag))
      .first();

    if (!flagDoc) return false;
    if (!flagDoc.enabled) return false;

    // Per-user override takes precedence
    if (args.userId && flagDoc.enabledForUsers.includes(args.userId)) {
      return true;
    }

    // Percentage rollout — use a deterministic check based on userId hash
    if (flagDoc.rolloutPercentage >= 100) return true;
    if (flagDoc.rolloutPercentage <= 0) return false;

    if (args.userId) {
      // Simple deterministic hash: sum char codes mod 100
      const hash =
        [...args.userId].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 100;
      return hash < flagDoc.rolloutPercentage;
    }

    return false;
  },
});

/**
 * Get all feature flags (admin view).
 */
export const getAllFeatureFlags = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("featureFlags").collect();
  },
});
