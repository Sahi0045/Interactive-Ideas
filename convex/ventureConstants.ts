// Venture system constants — stages, checkpoints, tasks, bosses, levels, badges
// These are immutable definitions that drive the entire progression system.

// ─────────────────────────────────────────────────────────────────────────────
// TOOL TYPES
// ─────────────────────────────────────────────────────────────────────────────
export const TOOL_TYPES = [
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
] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

export const TOOL_INFO: Record<ToolType, { name: string; icon: string }> = {
  write: { name: "Text Editor", icon: "✍️" },
  table: { name: "Data Table", icon: "📊" },
  map: { name: "Mind Map", icon: "🗺️" },
  survey: { name: "Survey Builder", icon: "📋" },
  poll: { name: "Quick Poll", icon: "📊" },
  link: { name: "Link Collector", icon: "🔗" },
  upload: { name: "File Upload", icon: "📎" },
  self_report: { name: "Self Report", icon: "📝" },
  journal: { name: "Journal", icon: "📓" },
  kanban: { name: "Kanban Board", icon: "📌" },
  calendar: { name: "Calendar", icon: "📅" },
};

// ─────────────────────────────────────────────────────────────────────────────
// VENTURE STAGES
// ─────────────────────────────────────────────────────────────────────────────
export const VENTURE_STAGES = [
  { id: 1, name: "Ideation", checkpoints: 4 },
  { id: 2, name: "Research", checkpoints: 5 },
  { id: 3, name: "Validation", checkpoints: 4 },
  { id: 4, name: "Offer Design", checkpoints: 5 },
  { id: 5, name: "Build & Deliver", checkpoints: 6 },
  { id: 6, name: "Launch", checkpoints: 3 },
  { id: 7, name: "Iteration", checkpoints: 4 },
  { id: 8, name: "Scale", checkpoints: 5 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// CHECKPOINT DEFINITIONS
// Each checkpoint has a stage, number within stage, and 3 tasks (t1/t2/t3)
// ─────────────────────────────────────────────────────────────────────────────
interface CheckpointDef {
  stage: number;
  checkpoint: number;
  name: string;
  outcome: string;
  t1: { prompt: string; tool: ToolType };
  t2: { prompt: string; tool: ToolType };
  t3: { prompt: string; tool: ToolType };
}

export const CHECKPOINT_DEFINITIONS: CheckpointDef[] = [
  // Stage 1: Ideation
  {
    stage: 1,
    checkpoint: 1,
    name: "Problem identified",
    outcome: "A specific, real pain point is clearly articulated",
    t1: {
      prompt:
        "Describe the problem you're solving. Cover who experiences it, when it occurs, and what it costs them in time, money, or frustration.",
      tool: "write",
    },
    t2: {
      prompt:
        "Map out the problem space — who is affected, what triggers the problem, and what currently happens as a result.",
      tool: "map",
    },
    t3: {
      prompt:
        "Find three real-world examples of this problem from forums, reviews, news, or your own observation. Add each as a link with a note.",
      tool: "link",
    },
  },
  {
    stage: 1,
    checkpoint: 2,
    name: "Problem owner defined",
    outcome: "A specific person who experiences the problem is documented",
    t1: {
      prompt:
        "Write a profile of your target user — their context, goals, and the moment this problem hits hardest.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a persona card — name, role, key frustrations, current workarounds, and what a good solution would feel like.",
      tool: "table",
    },
    t3: {
      prompt:
        "Create a short survey and share it with at least three real people who fit your target profile. Document what they told you.",
      tool: "survey",
    },
  },
  {
    stage: 1,
    checkpoint: 3,
    name: "Solution concept formed",
    outcome:
      "A proposed approach to the problem for the defined audience exists",
    t1: {
      prompt:
        "Describe your solution in two or three sentences. Focus on what it does for the user, not how it works technically.",
      tool: "write",
    },
    t2: {
      prompt:
        "Sketch how your solution works — show the core flow from the user's perspective.",
      tool: "map",
    },
    t3: {
      prompt:
        "Create a poll asking your target audience which of two or three solution directions appeals most. Share it and document the result.",
      tool: "poll",
    },
  },
  {
    stage: 1,
    checkpoint: 4,
    name: "Idea worth pursuing",
    outcome: "An honest first-pass judgment on viability is documented",
    t1: {
      prompt:
        "Write an honest case for and against pursuing this idea. List three reasons it's worth doing and two reasons it might not be.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a comparison table of at least two existing alternatives — what they do, who they serve, where they fall short.",
      tool: "table",
    },
    t3: {
      prompt:
        "Write a one-page vision for this idea three years from now if it succeeds. Connect it to the problem and person you've defined.",
      tool: "write",
    },
  },
  // Stage 2: Research
  {
    stage: 2,
    checkpoint: 1,
    name: "Market landscape mapped",
    outcome: "The size, shape and dynamics of the market are understood",
    t1: {
      prompt:
        "Write a summary of the market — rough size, main players, and whether it is growing or contracting.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a market overview table — market size estimate, growth rate, key drivers, and your source for each figure.",
      tool: "table",
    },
    t3: {
      prompt:
        "Find and link at least two credible industry reports that support your market understanding. Add a note on what each confirms or challenges.",
      tool: "link",
    },
  },
  {
    stage: 2,
    checkpoint: 2,
    name: "Competitors analysed",
    outcome:
      "Existing solutions and their strengths and weaknesses are documented",
    t1: {
      prompt:
        "List at least four direct or indirect competitors — products, services, or approaches people currently use.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a competitor comparison table — what each offers, who they target, what they charge, where they fall short.",
      tool: "table",
    },
    t3: {
      prompt:
        "Map the competitive landscape — position each competitor by two dimensions that matter most to your user, and mark where your idea would sit.",
      tool: "map",
    },
  },
  {
    stage: 2,
    checkpoint: 3,
    name: "Target user understood deeply",
    outcome: "A rich portrait of the user built from research not assumption",
    t1: {
      prompt:
        "Write a day-in-the-life description of your target user — focusing on moments where your problem and solution become relevant.",
      tool: "write",
    },
    t2: {
      prompt:
        "Design and run a short survey for your target audience. Ask about behaviour, frustrations, and what they've tried. Document key themes from at least five responses.",
      tool: "survey",
    },
    t3: {
      prompt:
        "Conduct at least three conversations with real target users. Upload a summary from each, including the most surprising thing each person told you.",
      tool: "upload",
    },
  },
  {
    stage: 2,
    checkpoint: 4,
    name: "Trends & timing assessed",
    outcome: "External forces shaping the opportunity right now are understood",
    t1: {
      prompt:
        "Identify at least two trends — technological, social, regulatory, or economic — that make this problem more acute or your solution more possible now.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a trends table — each trend, its relevance, whether it helps or hurts, and a source link.",
      tool: "table",
    },
    t3: {
      prompt:
        "Find and link a comparable idea that succeeded or failed partly because of timing. Write a specific lesson from that case for your own idea.",
      tool: "link",
    },
  },
  {
    stage: 2,
    checkpoint: 5,
    name: "Research synthesised",
    outcome:
      "All findings pulled into a single coherent picture that will inform validation",
    t1: {
      prompt:
        "Write a one-page research summary — market, competition, user, and timing in a single connected narrative.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a SWOT table for your idea based specifically on what your research revealed.",
      tool: "table",
    },
    t3: {
      prompt:
        "Map your research findings — show how market context, competitor gaps, user needs, and timing connect to create your opportunity.",
      tool: "map",
    },
  },
  // Stage 3: Validation
  {
    stage: 3,
    checkpoint: 1,
    name: "Assumptions documented",
    outcome:
      "The key beliefs the idea rests on are written down and ranked by risk",
    t1: {
      prompt:
        "List at least eight assumptions your idea currently relies on — about the user, the market, the solution, or the business model.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a risk ranking table — for each assumption, rate how likely it is to be wrong and how catastrophic it would be. Sort by combined risk.",
      tool: "table",
    },
    t3: {
      prompt:
        "Map your top three riskiest assumptions — show what depends on each one and what would collapse if it were wrong.",
      tool: "map",
    },
  },
  {
    stage: 3,
    checkpoint: 2,
    name: "Validation method chosen",
    outcome: "A concrete plan for testing the highest-risk assumptions exists",
    t1: {
      prompt:
        "Describe the method you'll use to test your most critical assumption — what you will do, who you will involve, and what you will measure.",
      tool: "write",
    },
    t2: {
      prompt:
        "Define what success and failure look like for your validation test — assumption, method, success threshold, failure threshold.",
      tool: "table",
    },
    t3: {
      prompt:
        "Build a simple landing page or one-pager that you could put in front of potential users to gauge real interest before building anything.",
      tool: "link",
    },
  },
  {
    stage: 3,
    checkpoint: 3,
    name: "Validation run",
    outcome: "The test has been executed and raw results exist",
    t1: {
      prompt:
        "Document the raw results of your validation test — numbers, quotes, and observations exactly as they occurred.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a results table — each person or data point, what they said or did, and whether it supported or contradicted your assumption.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload evidence from your validation — interview recordings, survey exports, sign-up screenshots, or any artefact that proves the test happened.",
      tool: "upload",
    },
  },
  {
    stage: 3,
    checkpoint: 4,
    name: "Pivot or proceed decision made",
    outcome: "A clear, evidence-based direction is documented",
    t1: {
      prompt:
        "Write a clear decision statement — proceed, pivot, or stop — and explain in two or three sentences what specific evidence led you there.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a before-and-after table showing your original assumptions and what validation proved, disproved, or left uncertain.",
      tool: "table",
    },
    t3: {
      prompt:
        "Write an updated description of your idea that reflects everything validation taught you — and map what changed in your understanding.",
      tool: "map",
    },
  },
  // Stage 4: Design
  {
    stage: 4,
    checkpoint: 1,
    name: "User journey mapped",
    outcome: "The end-to-end user experience through the product is documented",
    t1: {
      prompt:
        "Describe the core user journey in five to eight steps — from first discovering your solution to getting the core value from it.",
      tool: "write",
    },
    t2: {
      prompt:
        "Map the full user journey — show each step, the user's emotional state, and key decision moments where they might drop off.",
      tool: "map",
    },
    t3: {
      prompt:
        "Identify the two or three most critical moments in the journey — for each, describe what must happen and what would go wrong if it doesn't.",
      tool: "write",
    },
  },
  {
    stage: 4,
    checkpoint: 2,
    name: "Visual identity established",
    outcome: "The look, feel, tone and brand language of the product exists",
    t1: {
      prompt:
        "Write a brand brief — three words describing how it should feel, a colour direction, and the tone of voice.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a mood board — visual references, colour swatches, and typography examples representing the aesthetic direction.",
      tool: "map",
    },
    t3: {
      prompt:
        "Link your logo or wordmark file — created in Figma or any design tool — and confirm it exists in a usable format.",
      tool: "link",
    },
  },
  {
    stage: 4,
    checkpoint: 3,
    name: "Prototype built",
    outcome:
      "A tangible, interactive or visual representation of the product exists",
    t1: {
      prompt:
        "Describe what your prototype shows — which screens or components it covers and what a user can do with it.",
      tool: "write",
    },
    t2: {
      prompt:
        "Link your prototype from Figma or another design tool — interactive enough that someone could click through the core journey.",
      tool: "link",
    },
    t3: {
      prompt:
        "Upload a screen recording of yourself walking through the prototype — narrating what each screen does and why you made the design decisions.",
      tool: "upload",
    },
  },
  {
    stage: 4,
    checkpoint: 4,
    name: "Prototype tested with users",
    outcome:
      "The prototype has been put in front of real users and feedback is collected",
    t1: {
      prompt:
        "Document what happened when at least three target users interacted with your prototype — what each person did, where they got confused, what they said.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a feedback table — for each user, record the task, whether they succeeded, where they struggled, and any direct quote worth keeping.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload a recording or photo set from at least one prototype test session — showing the user interacting with the prototype in real time.",
      tool: "upload",
    },
  },
  {
    stage: 4,
    checkpoint: 5,
    name: "Design finalised",
    outcome: "Feedback incorporated and final design ready for development",
    t1: {
      prompt:
        "List every piece of feedback from prototype testing and mark each as incorporated, rejected, or deferred — with a brief reason.",
      tool: "table",
    },
    t2: {
      prompt:
        "Link the final design file from Figma or your design tool — the version that a developer could build from.",
      tool: "link",
    },
    t3: {
      prompt:
        "Write a design handoff note — key decisions made, edge cases accounted for, and anything a developer needs to know that isn't visible in the file.",
      tool: "write",
    },
  },
  // Stage 5: Development
  {
    stage: 5,
    checkpoint: 1,
    name: "Technical architecture decided",
    outcome:
      "Tools, stack and infrastructure choices are documented and agreed",
    t1: {
      prompt:
        "Write a short technical brief — front end, back end, database, and key third-party services, with one sentence explaining why you chose each.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build an architecture table — each component, technology chosen, reason for the choice, and the biggest risk associated with it.",
      tool: "table",
    },
    t3: {
      prompt:
        "Map your system architecture — show how the main components connect, where data flows, and which parts are most dependent on each other.",
      tool: "map",
    },
  },
  {
    stage: 5,
    checkpoint: 2,
    name: "Development environment set up",
    outcome:
      "All tools, repositories and workflows are in place and the team can build",
    t1: {
      prompt:
        "Confirm your repository is set up and at least one test commit has been pushed — describe your branching and review workflow in a short note.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a team access table — every team member, their role, and confirming they have access to every tool and environment they need.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload a screenshot showing the repository, the first successful build, or the development environment running.",
      tool: "upload",
    },
  },
  {
    stage: 5,
    checkpoint: 3,
    name: "Core features built",
    outcome:
      "The minimum set of features needed for launch exists and functions",
    t1: {
      prompt:
        "List each feature in your minimum viable product and confirm it is built and functional.",
      tool: "table",
    },
    t2: {
      prompt:
        "Upload a screen recording walking through the working core user journey — from sign-up to the primary value moment — without it breaking.",
      tool: "upload",
    },
    t3: {
      prompt:
        "Link a live staging environment where the core features can be accessed and tested by someone outside your team.",
      tool: "link",
    },
  },
  {
    stage: 5,
    checkpoint: 4,
    name: "Internal testing complete",
    outcome:
      "The product has been tested by the team and known issues documented",
    t1: {
      prompt:
        "Build a bug log table — each issue found during internal testing, its severity, which feature it affects, and whether it has been resolved.",
      tool: "table",
    },
    t2: {
      prompt:
        "Upload a screen recording of the core journey being tested on at least two different devices or screen sizes.",
      tool: "upload",
    },
    t3: {
      prompt:
        "Write a test summary — what you tested, what passed, what failed, and what you decided to fix before launch versus defer.",
      tool: "write",
    },
  },
  {
    stage: 5,
    checkpoint: 5,
    name: "External beta complete",
    outcome:
      "Real users outside the team have tested the product and feedback is collected",
    t1: {
      prompt:
        "Document what your beta users did and reported — at least five participants with a note on where each came from and what they experienced.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a beta feedback table — each participant, issues encountered, direct quotes, and severity rating.",
      tool: "table",
    },
    t3: {
      prompt:
        "Create a short survey for your beta users and share the compiled results — showing the distribution of responses to your key questions.",
      tool: "survey",
    },
  },
  {
    stage: 5,
    checkpoint: 6,
    name: "Launch-ready",
    outcome:
      "All pre-launch checklist items resolved and product is ready to ship",
    t1: {
      prompt:
        "Build a pre-launch checklist table — critical bugs, core journey, analytics, legal pages — with a pass or fail status for each item.",
      tool: "table",
    },
    t2: {
      prompt:
        "Upload a recording of one person from outside your team attempting to sign up and use the product from scratch — note every issue they encountered.",
      tool: "upload",
    },
    t3: {
      prompt:
        "Confirm in writing that every item on your checklist is passing and the product is ready to be made public — including the date of this confirmation.",
      tool: "write",
    },
  },
  // Stage 6: Launch
  {
    stage: 6,
    checkpoint: 1,
    name: "Launch assets prepared",
    outcome: "Everything needed to go public is created and ready",
    t1: {
      prompt:
        "Write the core launch copy — a headline, a two-sentence description, and a call to action — for the primary channel you're launching through.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a launch asset checklist table — every piece of content needed and confirming each is complete.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload your launch press kit — product description, key facts, screenshots, and a founder quote — ready to send to anyone who asks.",
      tool: "upload",
    },
  },
  {
    stage: 6,
    checkpoint: 2,
    name: "Product live and announced",
    outcome: "The product is publicly accessible and the launch has been made",
    t1: {
      prompt:
        "Confirm the product is live and link to it directly from this checkpoint.",
      tool: "link",
    },
    t2: {
      prompt:
        "Document your launch announcement — link the post, email, or community thread where you announced it — and note the initial response in the first 48 hours.",
      tool: "link",
    },
    t3: {
      prompt:
        "Build a launch channel table — every channel you launched through, reach of each, and sign-ups or engagements each produced in the first week.",
      tool: "table",
    },
  },
  {
    stage: 6,
    checkpoint: 3,
    name: "First users acquired",
    outcome:
      "Real people outside the team are using the product and initial data exists",
    t1: {
      prompt:
        "Document your first ten users — where each came from, when they joined, and whether they completed the core journey.",
      tool: "table",
    },
    t2: {
      prompt:
        "Build a channel attribution table — which launch channel drove the most sign-ups and which drove the highest-quality engagement.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload a screenshot of your analytics dashboard showing real user activity — page views, sign-ups, or core actions completed — from your first week.",
      tool: "upload",
    },
  },
  // Stage 7: Iteration
  {
    stage: 7,
    checkpoint: 1,
    name: "Feedback collected",
    outcome: "Structured input from real users exists across multiple channels",
    t1: {
      prompt:
        "Write a summary of the feedback you've collected since launch — covering the main themes across all channels.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a feedback log table — each piece of feedback, its source, whether it is a bug report, feature request, or general observation, and its frequency.",
      tool: "table",
    },
    t3: {
      prompt:
        "Create a structured feedback survey and document the compiled results — showing how users rate their experience and what they most want to change.",
      tool: "survey",
    },
  },
  {
    stage: 7,
    checkpoint: 2,
    name: "Priorities set",
    outcome:
      "A clear, evidence-based decision on what to address first is documented",
    t1: {
      prompt:
        "Group your feedback into themes and write a prioritised list of improvements — ranked by frequency and impact.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a priority matrix table — each improvement, its frequency, estimated impact, estimated effort, and your priority ranking.",
      tool: "table",
    },
    t3: {
      prompt:
        "Write an iteration brief — what you're going to work on, why you chose it over other options, and what specific metric you expect to move.",
      tool: "write",
    },
  },
  {
    stage: 7,
    checkpoint: 3,
    name: "Improvements shipped",
    outcome: "The prioritised changes have been built and released",
    t1: {
      prompt:
        "Confirm the changes are live and link to the updated product or the changelog from this checkpoint.",
      tool: "link",
    },
    t2: {
      prompt:
        "Build a changes table — each improvement shipped, what feedback drove it, and what specifically changed in the product.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload a screen recording showing the improvement in action — demonstrating what the experience looked like before and after the change.",
      tool: "upload",
    },
  },
  {
    stage: 7,
    checkpoint: 4,
    name: "Impact measured",
    outcome:
      "The effect of changes on user behaviour and metrics is documented",
    t1: {
      prompt:
        "Write a before-and-after comparison for your key metric — what it was before the changes, what it is now, and what you think caused the difference.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a metrics table — each metric tracked, its value before the changes, its value after, and whether the change moved in the direction you expected.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload a screenshot of your analytics showing the metric movement — before and after the ship date clearly visible.",
      tool: "upload",
    },
  },
  // Stage 8: Scale
  {
    stage: 8,
    checkpoint: 1,
    name: "Growth channels identified",
    outcome:
      "Channels through which new users can be acquired reliably are tested and ranked",
    t1: {
      prompt:
        "Describe at least four channels through which you could acquire new users and what the effort and cost of each involves.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a channel testing table — each channel tested, input (time or money spent), output (users or leads acquired), and cost per user.",
      tool: "table",
    },
    t3: {
      prompt:
        "Map your growth model — showing current acquisition rate per channel and what each would produce if you doubled investment in it.",
      tool: "map",
    },
  },
  {
    stage: 8,
    checkpoint: 2,
    name: "Revenue model validated",
    outcome: "The way the product makes money has been tested with real users",
    t1: {
      prompt:
        "Describe your revenue model and identify the single biggest assumption it relies on that you haven't yet tested.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a revenue evidence table — documenting each instance of a real user paying or committing to pay, what motivated them, and what plan or price point they chose.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload evidence of real payment — a screenshot of a transaction, a signed agreement, or a survey result showing willingness to pay at a specific price.",
      tool: "upload",
    },
  },
  {
    stage: 8,
    checkpoint: 3,
    name: "Operations scaled",
    outcome:
      "The team, infrastructure and processes can support significantly more volume",
    t1: {
      prompt:
        "Identify the three biggest bottlenecks in your current operations — the things that would break first if your user base doubled tomorrow.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a scaling readiness table — each bottleneck, what you've done to address it, and your current capacity versus what you'd need at 10x current volume.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload a stress test result — a screenshot or report showing your system handling significantly higher load than your current baseline.",
      tool: "upload",
    },
  },
  {
    stage: 8,
    checkpoint: 4,
    name: "Partnerships or distribution secured",
    outcome:
      "At least one external relationship that accelerates growth is in place",
    t1: {
      prompt:
        "Identify at least three potential partners whose audience or reach would meaningfully accelerate your growth — and explain why each is a good fit.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a partnership pipeline table — each potential partner, status of the conversation, what you've proposed, and the expected impact if they agree.",
      tool: "table",
    },
    t3: {
      prompt:
        "Upload a signed agreement, a confirmation email, or a formal record of at least one partnership or distribution deal that is now active.",
      tool: "upload",
    },
  },
  {
    stage: 8,
    checkpoint: 5,
    name: "Sustainability assessed",
    outcome: "The long-term health of the venture is honestly evaluated",
    t1: {
      prompt:
        "Write an honest assessment of your current financial position — runway, monthly burn, and how long you can operate before needing more revenue or investment.",
      tool: "write",
    },
    t2: {
      prompt:
        "Build a 12-month plan table — growth targets, key hires or resources needed, major risks, and the milestones that would tell you you're on track.",
      tool: "table",
    },
    t3: {
      prompt:
        "Map the three biggest threats to your venture's survival — what would trigger each one, what the impact would be, and what your response plan is.",
      tool: "map",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// BOSS DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
export interface BossDef {
  id: number;
  name: string;
  type: string;
  corruption: string;
  represents: string;
  defeatMethod: string;
  retreatOutcome: string;
  slayOutcome: string;
}

export const BOSS_DEFINITIONS: BossDef[] = [
  {
    id: 1,
    name: "The Unraveller",
    type: "Ancient Void Serpent",
    corruption:
      "Pulls threads from the fabric of reality — walls crack, roads dissolve, plans collapse into incoherence",
    represents:
      "Doubt and loss of direction — the fear that the idea has no shape",
    defeatMethod:
      "Weave the final stage's outcome into a coherent whole, sealing the threads it pulled loose",
    retreatOutcome: "Idea staggers forward half-formed",
    slayOutcome:
      "The world knits back together, every stage outcome visibly connected",
  },
  {
    id: 2,
    name: "The Pale Architect",
    type: "Undead Perfectionist Titan",
    corruption:
      "Freezes progress in amber — everything looks almost right but nothing can move forward",
    represents: "Paralysis and perfectionism — the enemy of done",
    defeatMethod:
      "Ship something imperfect. The act of completing despite flaws destroys its power",
    retreatOutcome: "One stage remains frozen",
    slayOutcome: "The amber cracks and the world breathes again",
  },
  {
    id: 3,
    name: "The Hollow King",
    type: "Spectral Sovereign",
    corruption:
      "Drains meaning from actions — tasks complete but feel empty, the world greyscales",
    represents: "Loss of purpose — doing the work without knowing why",
    defeatMethod:
      "Reconnect to the original impulse. The final stage forces a statement of intent that restores colour",
    retreatOutcome: "World remains muted",
    slayOutcome: "Colour floods back stage by stage in reverse order",
  },
  {
    id: 4,
    name: "The Thornwarden",
    type: "Ancient Forest Colossus",
    corruption:
      "Overgrows paths with thorns — every checkpoint requires twice the effort to reach",
    represents:
      "Bureaucracy and friction — the systems that slow good ideas down",
    defeatMethod:
      "Cut through with decisive action. Each gold checkpoint clears a path the Thornwarden can't regrow",
    retreatOutcome: "One path remains thorned",
    slayOutcome: "The forest opens and a clear road appears between all stages",
  },
  {
    id: 5,
    name: "The Mirror Witch",
    type: "Illusionist Sorceress",
    corruption:
      "Replaces real progress with reflections — users see what they want to see rather than what is true",
    represents:
      "Confirmation bias and self-deception — building for yourself rather than for others",
    defeatMethod:
      "Each validation or feedback task breaks a mirror. Enough mirrors broken dispels the illusion entirely",
    retreatOutcome: "One illusion remains",
    slayOutcome:
      "The world sharpens into clear focus, all assumptions resolved",
  },
  {
    id: 6,
    name: "The Ashen Drake",
    type: "Fire Dragon of Entropy",
    corruption:
      "Burns completed work to ash if left untouched — idle stages decay visually",
    represents: "Abandonment and inertia — the slow death of the unfinished",
    defeatMethod:
      "Consistent forward motion. The Drake cannot burn what is actively being built",
    retreatOutcome: "Ash marks remain on one stage",
    slayOutcome: "The ash transforms into gold dust on every completed stage",
  },
  {
    id: 7,
    name: "The Tide Caller",
    type: "Oceanic Leviathan",
    corruption:
      "Floods the landscape with noise — too many directions, too many voices, priorities submerged",
    represents:
      "Distraction and scope creep — the idea that tries to be everything",
    defeatMethod:
      "Each prioritisation or synthesis task drains the flood. Focus restores the landscape",
    retreatOutcome: "Watermarks remain",
    slayOutcome:
      "The tide recedes completely revealing solid ground beneath every stage",
  },
  {
    id: 8,
    name: "The Gravemind",
    type: "Necromantic Hive Intelligence",
    corruption:
      "Raises the corpses of abandoned ideas to block progress — past failures crowd the path",
    represents: "Fear of failure and the weight of previous attempts",
    defeatMethod:
      "Each completed checkpoint buries a corpse permanently. A full run clears the graveyard entirely",
    retreatOutcome: "One corpse remains at the gate",
    slayOutcome: "The graveyard transforms into a garden of monuments",
  },
  {
    id: 9,
    name: "The Rusted Oracle",
    type: "Corrupted Mechanical Prophet",
    corruption:
      "Speaks only outdated truths — research feels stale, validation seems pointless, everything feels already done",
    represents:
      "Imposter syndrome and the belief that nothing new can be created",
    defeatMethod:
      "Each original insight or finding silences one of its voices. A full run breaks the Oracle entirely",
    retreatOutcome: "One voice continues to whisper",
    slayOutcome:
      "The Oracle shatters and its gears become the monument's clockwork",
  },
  {
    id: 10,
    name: "The Wraith Council",
    type: "Parliament of Failed Founders",
    corruption:
      "Seven spectral figures who argue endlessly — every decision is contested, every direction disputed",
    represents:
      "Decision paralysis and committee thinking — the idea killed by consensus",
    defeatMethod:
      "Each decisive checkpoint completion dismisses one councillor. A full run dissolves the council",
    retreatOutcome: "Two councillors remain",
    slayOutcome: "The chamber empties and becomes the idea's own council hall",
  },
  {
    id: 11,
    name: "The Stonecaller",
    type: "Mountain Elemental Warlord",
    corruption:
      "Petrifies momentum — stages feel impossibly heavy, each checkpoint like moving a boulder",
    represents:
      "Overwhelm and the sense that the task is too large to complete",
    defeatMethod:
      "Each small completion proves the mountain movable. Momentum is the counter-spell",
    retreatOutcome: "One stage remains stone",
    slayOutcome: "The mountain becomes the foundation the monument stands on",
  },
  {
    id: 12,
    name: "The Veilwalker",
    type: "Interdimensional Shadow Predator",
    corruption:
      "Makes the idea invisible to others — no feedback comes, no community engages, work feels unseen",
    represents: "Isolation and the fear of irrelevance — building in a vacuum",
    defeatMethod:
      "Each collaboration or community task tears the veil. A full run makes the idea fully visible in the world",
    retreatOutcome: "A thin veil remains",
    slayOutcome:
      "The veil becomes a banner visible across the shared world map",
  },
];

export const CORRUPTION_RULES = {
  dailyInactivityIncrease: 5,
  partialCheckpointIncrease: 10,
  partialCheckpointDecayDays: 5,
  standardCheckpointClearReduction: 12,
  goldCheckpointClearReduction: 25,
  contributionUpdateReduction: 5,
  inactivityCap: 80,
  max: 100,
  thresholds: [25, 50, 75, 90] as const,
} as const;

export const BOSS_BASE_HP = 100;

export type StageOutcome =
  | "not_started"
  | "in_progress"
  | "partial_stage"
  | "stage_clear"
  | "gold_stage";

export type ProjectOutcome =
  | "in_progress"
  | "partial_project"
  | "project_complete"
  | "project_perfect";

type StageCheckpointState = {
  stage: number;
  checkpoint: number;
  status: string;
  goldBonusEarned?: boolean;
};

export function getStageOutcome(
  stageId: number,
  checkpoints: StageCheckpointState[],
): {
  outcome: StageOutcome;
  total: number;
  completed: number;
  gold: number;
  finalCheckpointCompleted: boolean;
  finalCheckpointGold: boolean;
  monsterState: "active" | "retreated" | "slain";
} {
  const stageCheckpoints = checkpoints.filter((checkpoint) => checkpoint.stage === stageId);

  if (stageCheckpoints.length === 0) {
    return {
      outcome: "not_started",
      total: 0,
      completed: 0,
      gold: 0,
      finalCheckpointCompleted: false,
      finalCheckpointGold: false,
      monsterState: "active",
    };
  }

  const total = stageCheckpoints.length;
  const completed = stageCheckpoints.filter(
    (checkpoint) => checkpoint.status === "completed",
  ).length;
  const gold = stageCheckpoints.filter((checkpoint) => checkpoint.goldBonusEarned).length;
  const finalCheckpoint = [...stageCheckpoints].sort(
    (left, right) => right.checkpoint - left.checkpoint,
  )[0];
  const finalCheckpointCompleted = finalCheckpoint?.status === "completed";
  const finalCheckpointGold = !!finalCheckpoint?.goldBonusEarned;
  const halfThreshold = Math.ceil(total / 2);

  let outcome: StageOutcome = "not_started";
  if (finalCheckpointCompleted && finalCheckpointGold) {
    outcome = "gold_stage";
  } else if (finalCheckpointCompleted) {
    outcome = "stage_clear";
  } else if (completed >= halfThreshold) {
    outcome = "partial_stage";
  } else if (completed > 0) {
    outcome = "in_progress";
  }

  const monsterState =
    outcome === "gold_stage" || outcome === "stage_clear"
      ? "slain"
      : outcome === "partial_stage"
        ? "retreated"
        : "active";

  return {
    outcome,
    total,
    completed,
    gold,
    finalCheckpointCompleted,
    finalCheckpointGold,
    monsterState,
  };
}

export function getProjectOutcome(
  stageOutcomes: Array<{ outcome: StageOutcome }>,
  ventureStatus?: string,
): ProjectOutcome {
  if (ventureStatus !== "completed") {
    return "in_progress";
  }

  const resolvedStages = stageOutcomes.filter(
    (stage) =>
      stage.outcome === "partial_stage" ||
      stage.outcome === "stage_clear" ||
      stage.outcome === "gold_stage",
  );

  const allStagesCleared =
    stageOutcomes.length > 0 &&
    stageOutcomes.every(
      (stage) =>
        stage.outcome === "stage_clear" || stage.outcome === "gold_stage",
    );
  const allStagesGold =
    stageOutcomes.length > 0 &&
    stageOutcomes.every((stage) => stage.outcome === "gold_stage");
  const hasPartialStage = stageOutcomes.some(
    (stage) => stage.outcome === "partial_stage",
  );

  if (allStagesGold) {
    return "project_perfect";
  }

  if (allStagesCleared) {
    return "project_complete";
  }

  if (hasPartialStage || resolvedStages.length > 0) {
    return "partial_project";
  }

  return "in_progress";
}

const BOSS_SLUG_BY_ID: Record<number, string> = {
  1: "the_unraveller",
  2: "the_pale_architect",
  3: "the_hollow_king",
  4: "the_thornwarden",
  5: "the_mirror_witch",
  6: "the_ashen_drake",
  7: "the_tide_caller",
  8: "the_gravemind",
  9: "the_rusted_oracle",
  10: "the_wraith_council",
  11: "the_stonecaller",
  12: "the_veilwalker",
};

export function getBossSlug(bossId: number): string {
  return BOSS_SLUG_BY_ID[bossId] ?? "super_boss";
}

export type CorruptionPhase =
  | "calm"
  | "creeping"
  | "desaturated"
  | "urgent"
  | "critical";

export function getCorruptionPhase(corruptionLevel: number): CorruptionPhase {
  if (corruptionLevel >= 90) return "critical";
  if (corruptionLevel >= 75) return "urgent";
  if (corruptionLevel >= 50) return "desaturated";
  if (corruptionLevel >= 25) return "creeping";
  return "calm";
}

export function getBossVisualStatus(corruptionLevel: number) {
  if (corruptionLevel >= 90) return "foreground" as const;
  if (corruptionLevel >= 25) return "present" as const;
  return "silhouette" as const;
}

export function getBossHpFromQuality(averageQualityScore: number) {
  const normalized = Math.max(0, Math.min(12, averageQualityScore));
  const hpReduction = Math.round((normalized / 12) * 40);
  return {
    baseHp: BOSS_BASE_HP,
    currentHp: Math.max(35, BOSS_BASE_HP - hpReduction),
    qualityModifier: hpReduction,
  };
}

export function getBossEncounterStyle(averageQualityScore: number) {
  if (averageQualityScore >= 9) return "swift_shatter" as const;
  if (averageQualityScore >= 5) return "steady_withering" as const;
  return "long_retreat" as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL DEFINITIONS (50 levels)
// ─────────────────────────────────────────────────────────────────────────────
export interface LevelDef {
  level: number;
  title: string;
  phase: "tutorial" | "early" | "mid" | "senior" | "mentor";
  titlePoints: number;
  requirements: string[];
  unlockedTools?: ToolType[];
}

export const LEVEL_DEFINITIONS: LevelDef[] = [
  {
    level: 1,
    title: "Newcomer",
    phase: "tutorial",
    titlePoints: 0,
    requirements: [
      "Create your account",
      "Upload a profile photo",
      "Add at least 2 skills and 1 industry interest",
    ],
  },
  {
    level: 2,
    title: "Explorer",
    phase: "tutorial",
    titlePoints: 0,
    requirements: [
      "Browse the idea feed",
      "Like at least 3 ideas",
      "Leave your first comment on any idea",
    ],
  },
  {
    level: 3,
    title: "Thinker",
    phase: "tutorial",
    titlePoints: 0,
    requirements: [
      "Create your first idea",
      "Fill in the idea title, description and type",
      "Complete the first checkpoint on your idea",
    ],
    unlockedTools: ["write"],
  },
  {
    level: 4,
    title: "Connector",
    phase: "tutorial",
    titlePoints: 50,
    requirements: [
      "Send your first collaboration invite",
      "Follow 3 other users",
      "Earn 50 points",
    ],
  },
  {
    level: 5,
    title: "Contributor",
    phase: "tutorial",
    titlePoints: 150,
    requirements: [
      "Leave a detailed comment on 2 ideas (min. 30 words each)",
      "Receive at least 1 upvote on any comment",
      "Complete 2 checkpoints on your first idea",
      "Earn 150 points",
      "Resolve at least 1 flare you fired",
    ],
    unlockedTools: ["survey", "table"],
  },
  {
    level: 6,
    title: "Initiator",
    phase: "tutorial",
    titlePoints: 300,
    requirements: [
      "Complete your first idea's first full stage",
      "Earn 300 points total",
      "Have at least 1 collaborator join any idea",
    ],
  },
  {
    level: 7,
    title: "Spark",
    phase: "early",
    titlePoints: 500,
    requirements: ["550 points", "Posted at least 2 ideas"],
    unlockedTools: ["map", "link"],
  },
  {
    level: 8,
    title: "Kindler",
    phase: "early",
    titlePoints: 800,
    requirements: ["900 points", "Completed Stage 2 on any idea"],
  },
  {
    level: 9,
    title: "Surveyor",
    phase: "early",
    titlePoints: 1200,
    requirements: [
      "1,350 points",
      "Left 10 total comments across any ideas",
      "Respond helpfully to at least 1 flare from another user",
    ],
    unlockedTools: ["poll", "upload"],
  },
  {
    level: 10,
    title: "Pathfinder",
    phase: "early",
    titlePoints: 1700,
    requirements: [
      "1,900 points",
      "Completed Stage 3 on any idea",
      "Recruited at least 1 collaborator",
    ],
  },
  {
    level: 11,
    title: "Builder",
    phase: "early",
    titlePoints: 2300,
    requirements: ["2,600 points", "Completed Stage 4 on any idea"],
  },
  {
    level: 12,
    title: "Artisan",
    phase: "early",
    titlePoints: 3000,
    requirements: ["3,400 points", "Earned at least 1 gold checkpoint"],
    unlockedTools: ["journal", "self_report"],
  },
  {
    level: 13,
    title: "Cultivator",
    phase: "early",
    titlePoints: 3800,
    requirements: ["4,400 points", "Active on at least 2 different idea types"],
  },
  {
    level: 14,
    title: "Shaper",
    phase: "early",
    titlePoints: 4400,
    requirements: ["5,500 points", "Completed Stage 5 on any idea"],
  },
  {
    level: 15,
    title: "Strategist",
    phase: "early",
    titlePoints: 5000,
    requirements: [
      "6,800 points",
      "At least 1 idea reached Stage 6 (Launch)",
      "Earned 3 gold checkpoints",
    ],
    unlockedTools: ["kanban", "calendar"],
  },
  {
    level: 16,
    title: "Pioneer",
    phase: "mid",
    titlePoints: 6000,
    requirements: ["8,500 points", "Successfully launched 1 idea"],
  },
  {
    level: 17,
    title: "Catalyst",
    phase: "mid",
    titlePoints: 7200,
    requirements: ["10,500 points", "Any idea received 15+ upvotes"],
  },
  {
    level: 18,
    title: "Luminary",
    phase: "mid",
    titlePoints: 8600,
    requirements: [
      "13,000 points",
      "Given 25 upvoted comments or reviews",
      "Respond helpfully to at least 5 flares",
    ],
  },
  {
    level: 19,
    title: "Vanguard",
    phase: "mid",
    titlePoints: 10200,
    requirements: ["16,000 points", "Completed Stage 7 on any launched idea"],
  },
  {
    level: 20,
    title: "Architect",
    phase: "mid",
    titlePoints: 12000,
    requirements: [
      "19,500 points",
      "Had 5 collaborators across all ideas",
      "Earned 8 gold checkpoints",
    ],
  },
  {
    level: 21,
    title: "Trailblazer",
    phase: "mid",
    titlePoints: 14000,
    requirements: [
      "23,500 points",
      "Posted ideas across 3 different idea types",
    ],
  },
  {
    level: 22,
    title: "Visionary",
    phase: "mid",
    titlePoints: 16200,
    requirements: ["28,000 points", "Any idea reached Stage 8 (Scale)"],
  },
  {
    level: 23,
    title: "Navigator",
    phase: "mid",
    titlePoints: 18600,
    requirements: [
      "33,000 points",
      "Collaborated on someone else's idea through 3 full stages",
    ],
  },
  {
    level: 24,
    title: "Forger",
    phase: "mid",
    titlePoints: 21200,
    requirements: ["38,500 points", "Earned 15 gold checkpoints"],
  },
  {
    level: 25,
    title: "Innovator",
    phase: "mid",
    titlePoints: 24000,
    requirements: ["44,500 points", "Have 2 ideas at Launch stage or beyond"],
  },
  {
    level: 26,
    title: "Magnate",
    phase: "mid",
    titlePoints: 27000,
    requirements: [
      "51,000 points",
      "Recruited 10 collaborators across all ideas",
    ],
  },
  {
    level: 27,
    title: "Curator",
    phase: "mid",
    titlePoints: 30200,
    requirements: [
      "58,000 points",
      "Reviews you gave helped 5 ideas advance a checkpoint",
      "Have at least 3 of your own flares resolved by the community",
    ],
  },
  {
    level: 28,
    title: "Orchestrator",
    phase: "mid",
    titlePoints: 33600,
    requirements: [
      "65,500 points",
      "Completed a full idea lifecycle (Stage 1 → Stage 8)",
      "Earned 20 gold checkpoints",
    ],
  },
  {
    level: 29,
    title: "Sage",
    phase: "senior",
    titlePoints: 37200,
    requirements: ["73,500 points", "Active across all 4 idea types"],
  },
  {
    level: 30,
    title: "Maven",
    phase: "senior",
    titlePoints: 41000,
    requirements: ["82,000 points", "Have 3 ideas at Launch or beyond"],
  },
  {
    level: 31,
    title: "Pillar",
    phase: "senior",
    titlePoints: 45000,
    requirements: ["91,000 points", "Collaborated on 5 other users' ideas"],
  },
  {
    level: 32,
    title: "Champion",
    phase: "senior",
    titlePoints: 49200,
    requirements: ["100,500 points", "Any idea earned 50+ total upvotes"],
  },
  {
    level: 33,
    title: "Exemplar",
    phase: "senior",
    titlePoints: 53600,
    requirements: ["110,500 points", "Earned 30 gold checkpoints"],
  },
  {
    level: 34,
    title: "Harbinger",
    phase: "senior",
    titlePoints: 58200,
    requirements: [
      "121,000 points",
      "Recruited 20 collaborators across all ideas",
    ],
  },
  {
    level: 35,
    title: "Virtuoso",
    phase: "senior",
    titlePoints: 63000,
    requirements: ["132,000 points", "2 ideas reached Scale stage"],
  },
  {
    level: 36,
    title: "Elder",
    phase: "senior",
    titlePoints: 68000,
    requirements: [
      "143,500 points",
      "Given 75 upvoted reviews or comments",
      "Respond helpfully to at least 20 flares total",
    ],
  },
  {
    level: 37,
    title: "Sovereign",
    phase: "senior",
    titlePoints: 73200,
    requirements: ["155,500 points", "Completed 2 full idea lifecycles"],
  },
  {
    level: 38,
    title: "Luminary",
    phase: "senior",
    titlePoints: 78600,
    requirements: [
      "168,000 points",
      "Earned 40 gold checkpoints",
      "At least 1 idea has 5+ collaborators",
    ],
  },
  {
    level: 39,
    title: "Legend",
    phase: "senior",
    titlePoints: 84200,
    requirements: [
      "181,000 points",
      "3 full idea lifecycles completed",
      "Reviews helped 15 ideas advance",
      "Active on platform for at least 6 months",
    ],
  },
  {
    level: 40,
    title: "Mentor",
    phase: "mentor",
    titlePoints: 90000,
    requirements: [
      "195,000 points",
      "Mentor track unlocked",
      "Accept your first mentee",
      "Complete mentor onboarding",
    ],
  },
  {
    level: 41,
    title: "Guide",
    phase: "mentor",
    titlePoints: 96000,
    requirements: [
      "210,000 points",
      "Actively mentoring at least 2 users",
      "Mentees advanced 5 checkpoints combined",
    ],
  },
  {
    level: 42,
    title: "Steward",
    phase: "mentor",
    titlePoints: 102200,
    requirements: [
      "226,000 points",
      "Curated 10 ideas",
      "Mentees advanced 15 checkpoints combined",
    ],
  },
  {
    level: 43,
    title: "Luminary",
    phase: "mentor",
    titlePoints: 108600,
    requirements: [
      "243,000 points",
      "1 mentee reached Level 15+",
      "Earned 50 gold checkpoints",
    ],
  },
  {
    level: 44,
    title: "Pillar",
    phase: "mentor",
    titlePoints: 115200,
    requirements: [
      "261,000 points",
      "Mentoring 5+ users simultaneously",
      "3 ideas you collaborated on fully launched",
    ],
  },
  {
    level: 45,
    title: "Oracle",
    phase: "mentor",
    titlePoints: 122000,
    requirements: [
      "280,000 points",
      "2 mentees reached Level 20+",
      "Completed 4 full idea lifecycles",
    ],
  },
  {
    level: 46,
    title: "Paragon",
    phase: "mentor",
    titlePoints: 129000,
    requirements: [
      "300,000 points",
      "Earned 60 gold checkpoints",
      "Mentees collectively earned 1,000 points",
    ],
  },
  {
    level: 47,
    title: "Titan",
    phase: "mentor",
    titlePoints: 136200,
    requirements: [
      "321,000 points",
      "5 ideas you contributed to reached Scale",
      "Mentored 10+ users over your career",
    ],
  },
  {
    level: 48,
    title: "Legend",
    phase: "mentor",
    titlePoints: 143600,
    requirements: [
      "343,000 points",
      "3 mentees reached Level 25+",
      "Earned 75 gold checkpoints",
    ],
  },
  {
    level: 49,
    title: "Icon",
    phase: "mentor",
    titlePoints: 151200,
    requirements: [
      "366,000 points",
      "Completed 5 full idea lifecycles",
      "Mentees collectively launched 3 ideas",
    ],
  },
  {
    level: 50,
    title: "Visionary",
    phase: "mentor",
    titlePoints: 159000,
    requirements: [
      "390,000 points",
      "Earned 100 gold checkpoints",
      "At least 5 mentees reached Level 30+",
      "3 ideas you created reached Scale",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// BADGE DEFINITIONS (62 badges)
// ─────────────────────────────────────────────────────────────────────────────
export interface BadgeDef {
  id: number;
  name: string;
  category:
    | "onboarding"
    | "idea_milestones"
    | "community"
    | "consistency"
    | "hidden"
    | "aspirational";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "hidden";
  shape: string;
  primaryColor: string;
  secondaryColor: string;
  iconDescription: string;
  tagline: string;
  requirement: string;
}

export const BADGE_DEFINITIONS: BadgeDef[] = [
  // Onboarding (8)
  {
    id: 1,
    name: "First Light",
    category: "onboarding",
    rarity: "common",
    shape: "circle",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0369A1",
    iconDescription: "A single candle flame on a dark background",
    tagline: "Every great fire begins with a single flame.",
    requirement: "Create your account",
  },
  {
    id: 2,
    name: "The Face Behind the Name",
    category: "onboarding",
    rarity: "common",
    shape: "shield",
    primaryColor: "#ECFDF5",
    secondaryColor: "#059669",
    iconDescription: "A simple portrait silhouette inside a shield outline",
    tagline: "A name means little. A face means everything.",
    requirement: "Upload a profile photo",
  },
  {
    id: 3,
    name: "Marked by Trade",
    category: "onboarding",
    rarity: "common",
    shape: "scroll",
    primaryColor: "#EEEDFE",
    secondaryColor: "#7F77DD",
    iconDescription: "A scroll with two tool icons and a map pin",
    tagline: "Every adventurer is known by their craft.",
    requirement: "Add at least 2 skills and 1 industry to your profile",
  },
  {
    id: 4,
    name: "The Wanderer",
    category: "onboarding",
    rarity: "common",
    shape: "hexagon",
    primaryColor: "#FFF7ED",
    secondaryColor: "#B45309",
    iconDescription: "A boot print on a winding road",
    tagline: "You have walked the road. Now you know where it leads.",
    requirement: "Browse the idea feed and like at least 3 ideas",
  },
  {
    id: 5,
    name: "First Word",
    category: "onboarding",
    rarity: "common",
    shape: "circle",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0369A1",
    iconDescription: "A speech bubble containing a single glowing rune",
    tagline: "The first word spoken changes the silence forever.",
    requirement: "Leave your first comment on any idea",
  },
  {
    id: 6,
    name: "The Seedling",
    category: "onboarding",
    rarity: "uncommon",
    shape: "diamond",
    primaryColor: "#ECFDF5",
    secondaryColor: "#059669",
    iconDescription: "A small green shoot emerging from dark soil",
    tagline: "From the smallest seed, the oldest oak.",
    requirement: "Create your first idea",
  },
  {
    id: 7,
    name: "The Outstretched Hand",
    category: "onboarding",
    rarity: "uncommon",
    shape: "shield",
    primaryColor: "#EEEDFE",
    secondaryColor: "#7F77DD",
    iconDescription:
      "Two hands reaching toward each other, fingertips almost touching",
    tagline: "No quest was ever completed alone.",
    requirement: "Send your first collaboration invite",
  },
  {
    id: 8,
    name: "Gate Crossed",
    category: "onboarding",
    rarity: "uncommon",
    shape: "arch",
    primaryColor: "#FEF3C7",
    secondaryColor: "#92400E",
    iconDescription: "An open stone gate with light pouring through",
    tagline: "The tutorial is behind you. The world is ahead.",
    requirement: "Complete all tutorial levels (Level 1–6)",
  },
  // Idea Milestones (18)
  {
    id: 9,
    name: "The First Checkpoint",
    category: "idea_milestones",
    rarity: "common",
    shape: "star",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0369A1",
    iconDescription:
      "A single five-pointed star with a checkmark at its centre",
    tagline: "One gate crossed. Many await.",
    requirement: "Complete your first checkpoint on any idea",
  },
  {
    id: 10,
    name: "Gilded",
    category: "idea_milestones",
    rarity: "uncommon",
    shape: "star",
    primaryColor: "#FDE68A",
    secondaryColor: "#92400E",
    iconDescription: "A five-pointed star in gold with a crown at its centre",
    tagline: "You did not stop at enough. You reached for all.",
    requirement:
      "Complete your first gold checkpoint (all 3 tasks at a single checkpoint)",
  },
  {
    id: 11,
    name: "Stage Clear",
    category: "idea_milestones",
    rarity: "common",
    shape: "ribbon",
    primaryColor: "#ECFDF5",
    secondaryColor: "#059669",
    iconDescription:
      "A vertical ribbon with a stage number at the centre and a tick at the base",
    tagline:
      "The first stage falls. The road ahead grows longer and more worthy.",
    requirement: "Complete your first full stage on any idea",
  },
  {
    id: 12,
    name: "The Long Road",
    category: "idea_milestones",
    rarity: "uncommon",
    shape: "scroll",
    primaryColor: "#EEEDFE",
    secondaryColor: "#7F77DD",
    iconDescription:
      "A long winding road visible through a round cartographer's lens",
    tagline: "You have come further than most will ever go.",
    requirement: "Reach Stage 4 on any idea",
  },
  {
    id: 13,
    name: "The Heartland",
    category: "idea_milestones",
    rarity: "rare",
    shape: "shield",
    primaryColor: "#FCE7F3",
    secondaryColor: "#9D174D",
    iconDescription:
      "A shield with a heart at its centre, split diagonally between two colours",
    tagline: "You reached the core of what you set out to build.",
    requirement: "Complete Stage 5 (the longest/hardest stage) on any idea",
  },
  {
    id: 14,
    name: "The Launcher",
    category: "idea_milestones",
    rarity: "rare",
    shape: "rocket",
    primaryColor: "#FEF3C7",
    secondaryColor: "#92400E",
    iconDescription: "A ship leaving a harbour at dawn, sails catching wind",
    tagline: "What was imagined is now real. What was planned now sails.",
    requirement: "Complete the Launch stage on any Venture idea",
  },
  {
    id: 15,
    name: "The Full Circle",
    category: "idea_milestones",
    rarity: "epic",
    shape: "ring",
    primaryColor: "#FCE7F3",
    secondaryColor: "#9D174D",
    iconDescription:
      "A complete ring made of stage symbols, each section a different colour",
    tagline: "You began and you finished. Most only begin.",
    requirement:
      "Complete a full idea lifecycle — all stages from first to last",
  },
  {
    id: 16,
    name: "The Gilded Path",
    category: "idea_milestones",
    rarity: "epic",
    shape: "crown",
    primaryColor: "#FDE68A",
    secondaryColor: "#92400E",
    iconDescription:
      "A crown made of checkpoint markers, alternating standard and gold",
    tagline: "Not merely finished. Finished with excellence at every gate.",
    requirement:
      "Complete a full idea lifecycle with gold checkpoints at every stage's final checkpoint",
  },
  {
    id: 17,
    name: "The Archaeologist",
    category: "idea_milestones",
    rarity: "uncommon",
    shape: "shovel",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0C4A6E",
    iconDescription:
      "A trowel crossing a magnifying glass over a layer of strata",
    tagline:
      "You dug until you found the answer. Others stopped at the surface.",
    requirement: "Complete a full Academic idea lifecycle",
  },
  {
    id: 18,
    name: "The Artificer",
    category: "idea_milestones",
    rarity: "uncommon",
    shape: "cog",
    primaryColor: "#ECFDF5",
    secondaryColor: "#064E3B",
    iconDescription:
      "A cog with a small flask at its centre — craft meets science",
    tagline: "You built a thing that answered a question. Few manage both.",
    requirement: "Complete a full Experimental idea lifecycle",
  },
  {
    id: 19,
    name: "The Author",
    category: "idea_milestones",
    rarity: "uncommon",
    shape: "quill",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0369A1",
    iconDescription: "A quill pen writing the final word on a scroll",
    tagline: "The last word has been written. The work is complete.",
    requirement: "Complete a full Creative idea lifecycle",
  },
  {
    id: 20,
    name: "The Founder",
    category: "idea_milestones",
    rarity: "uncommon",
    shape: "flag",
    primaryColor: "#EEEDFE",
    secondaryColor: "#3C3489",
    iconDescription: "A flag planted on a hill, banner catching wind",
    tagline:
      "You built it. You launched it. You made something exist that did not before.",
    requirement: "Complete a full Venture idea lifecycle",
  },
  {
    id: 21,
    name: "The Polymath",
    category: "idea_milestones",
    rarity: "rare",
    shape: "four_quadrant_shield",
    primaryColor: "#F8F7FF",
    secondaryColor: "#2D2B55",
    iconDescription:
      "A shield divided into four quadrants, each with a different template symbol",
    tagline: "No single domain could contain you.",
    requirement: "Complete at least one idea in each of the four templates",
  },
  {
    id: 22,
    name: "The Cartographer",
    category: "idea_milestones",
    rarity: "rare",
    shape: "map",
    primaryColor: "#FEF3C7",
    secondaryColor: "#B45309",
    iconDescription: "A partially unrolled map with four marked locations",
    tagline:
      "You have drawn the edges of your world and found them wider than you thought.",
    requirement: "Post at least one idea in each of the four templates",
  },
  {
    id: 23,
    name: "Twice-Born",
    category: "idea_milestones",
    rarity: "uncommon",
    shape: "phoenix",
    primaryColor: "#FEF3C7",
    secondaryColor: "#78350F",
    iconDescription: "A small phoenix rising from stylised flames",
    tagline: "One completion proves you can. Two proves you will.",
    requirement: "Complete 2 full idea lifecycles (any template)",
  },
  {
    id: 24,
    name: "The Ten",
    category: "idea_milestones",
    rarity: "epic",
    shape: "roman_numeral_x",
    primaryColor: "#FDE68A",
    secondaryColor: "#92400E",
    iconDescription: "A bold Roman numeral X with a subtle crown above",
    tagline: "Ten ideas carried. Ten worlds begun.",
    requirement: "Post 10 ideas across any combination of templates",
  },
  {
    id: 25,
    name: "The Gold Standard",
    category: "idea_milestones",
    rarity: "epic",
    shape: "gold_bar",
    primaryColor: "#FDE68A",
    secondaryColor: "#92400E",
    iconDescription: "A stylised gold ingot with a star stamped on its face",
    tagline: "Excellence was not occasional. It was the standard.",
    requirement: "Earn 25 gold checkpoints across any ideas",
  },
  {
    id: 26,
    name: "Century",
    category: "idea_milestones",
    rarity: "legendary",
    shape: "shield_with_c",
    primaryColor: "#FDE68A",
    secondaryColor: "#92400E",
    iconDescription:
      "A large Roman numeral C on a gilded shield with ornate borders",
    tagline: "One hundred gates of gold. The record speaks for itself.",
    requirement: "Earn 100 gold checkpoints across any ideas",
  },
  // Community (12)
  {
    id: 27,
    name: "The Listener",
    category: "community",
    rarity: "common",
    shape: "ear",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0369A1",
    iconDescription: "A stylised ear with a small sound wave emanating from it",
    tagline: "Before you can help, you must hear.",
    requirement: "Leave 10 comments across any ideas",
  },
  {
    id: 28,
    name: "The Advocate",
    category: "community",
    rarity: "common",
    shape: "raised_hand",
    primaryColor: "#ECFDF5",
    secondaryColor: "#059669",
    iconDescription:
      "An open upward-facing hand with a small star above the palm",
    tagline: "You saw something worth backing and you backed it.",
    requirement: "Upvote 25 ideas",
  },
  {
    id: 29,
    name: "The Critic",
    category: "community",
    rarity: "uncommon",
    shape: "magnifying_glass",
    primaryColor: "#EEEDFE",
    secondaryColor: "#3C3489",
    iconDescription: "A magnifying glass over a scroll — closer examination",
    tagline:
      "Honest eyes are the most valuable gift you can give a fellow maker.",
    requirement:
      "Give 10 reviews or detailed comments that receive at least one upvote",
  },
  {
    id: 30,
    name: "The Trusted Voice",
    category: "community",
    rarity: "rare",
    shape: "seal",
    primaryColor: "#EEEDFE",
    secondaryColor: "#3C3489",
    iconDescription:
      "A wax seal with a quill at its centre — the mark of the trusted correspondent",
    tagline: "Your words carry weight. Others wait to hear them.",
    requirement: "Give 50 upvoted reviews or comments",
  },
  {
    id: 31,
    name: "The Ally",
    category: "community",
    rarity: "uncommon",
    shape: "linked_rings",
    primaryColor: "#ECFDF5",
    secondaryColor: "#059669",
    iconDescription:
      "Two interlocked rings, one larger, one smaller — alliance",
    tagline: "You joined someone else's cause and made it stronger.",
    requirement: "Join another user's idea as a collaborator",
  },
  {
    id: 32,
    name: "The Assembler",
    category: "community",
    rarity: "rare",
    shape: "table_and_chairs",
    primaryColor: "#EEEDFE",
    secondaryColor: "#7F77DD",
    iconDescription:
      "A round table with four chairs, one clearly the head of table",
    tagline: "You did not wait for a party. You built one.",
    requirement: "Recruit 5 collaborators across all your ideas",
  },
  {
    id: 33,
    name: "The Catalyst",
    category: "community",
    rarity: "rare",
    shape: "spark",
    primaryColor: "#FEF3C7",
    secondaryColor: "#92400E",
    iconDescription:
      "A small lightning bolt striking a gear, setting it in motion",
    tagline: "Your review moved something that was standing still.",
    requirement: "Have 5 reviews you gave marked as helpful by an idea owner",
  },
  {
    id: 34,
    name: "The Followed",
    category: "community",
    rarity: "common",
    shape: "footprints",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0C4A6E",
    iconDescription:
      "A trail of footprints, the last pair slightly larger than those following",
    tagline: "Others have decided your path is worth watching.",
    requirement: "Gain 10 followers",
  },
  {
    id: 35,
    name: "The Celebrated",
    category: "community",
    rarity: "uncommon",
    shape: "laurel_wreath",
    primaryColor: "#FDE68A",
    secondaryColor: "#92400E",
    iconDescription: "A laurel wreath surrounding a small upward arrow",
    tagline: "The community has spoken. Your idea deserved to rise.",
    requirement: "Have an idea receive 25 upvotes",
  },
  {
    id: 36,
    name: "The Beloved",
    category: "community",
    rarity: "rare",
    shape: "heart_and_crown",
    primaryColor: "#FCE7F3",
    secondaryColor: "#9D174D",
    iconDescription: "A crown sitting above a heart — beloved by the community",
    tagline: "Fifty voices, one direction. They all pointed at your work.",
    requirement: "Have an idea receive 50 upvotes",
  },
  {
    id: 37,
    name: "The Draw",
    category: "community",
    rarity: "epic",
    shape: "magnet",
    primaryColor: "#EEEDFE",
    secondaryColor: "#3C3489",
    iconDescription: "A horseshoe magnet with sparks at its poles",
    tagline: "Your idea pulled people in before it was even half-built.",
    requirement: "Have an idea receive 10 collaboration requests",
  },
  {
    id: 38,
    name: "The Connector",
    category: "community",
    rarity: "uncommon",
    shape: "bridge",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0369A1",
    iconDescription: "A simple arch bridge connecting two landmasses",
    tagline: "You brought two ideas together and both were better for it.",
    requirement: "Collaborate on ideas created by 3 different users",
  },
  // Consistency (8)
  {
    id: 39,
    name: "The Regular",
    category: "consistency",
    rarity: "common",
    shape: "calendar",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0369A1",
    iconDescription: "A simple calendar page with 7 days marked",
    tagline: "You came back. That matters more than most people know.",
    requirement:
      "Visit the platform and take at least one action on 7 consecutive days",
  },
  {
    id: 40,
    name: "The Devoted",
    category: "consistency",
    rarity: "uncommon",
    shape: "flame",
    primaryColor: "#FEF3C7",
    secondaryColor: "#92400E",
    iconDescription:
      "A steady flame — not dramatic, not wavering, just burning",
    tagline: "A flame that does not gutter. A builder who does not stop.",
    requirement: "Maintain a 30-day activity streak",
  },
  {
    id: 41,
    name: "The Unbroken",
    category: "consistency",
    rarity: "rare",
    shape: "chain",
    primaryColor: "#EEEDFE",
    secondaryColor: "#3C3489",
    iconDescription: "An unbroken chain of links in a circle — no weak point",
    tagline: "Ninety days. Not a single day unaccounted for.",
    requirement: "Maintain a 90-day activity streak",
  },
  {
    id: 42,
    name: "The Seasonal",
    category: "consistency",
    rarity: "uncommon",
    shape: "four_leaf_circle",
    primaryColor: "#ECFDF5",
    secondaryColor: "#064E3B",
    iconDescription: "A circle divided into four seasonal quadrants",
    tagline: "You were here in every season. The platform grew with you.",
    requirement:
      "Be active on the platform in all four calendar quarters of a single year",
  },
  {
    id: 43,
    name: "The Weekly Champion",
    category: "consistency",
    rarity: "common",
    shape: "trophy",
    primaryColor: "#FDE68A",
    secondaryColor: "#92400E",
    iconDescription: "A small trophy with a number 1 on its base",
    tagline: "This week, no one worked harder. The league agrees.",
    requirement: "Finish in the top 5 of your league in any single week",
  },
  {
    id: 44,
    name: "The Promoted",
    category: "consistency",
    rarity: "uncommon",
    shape: "arrow_through_tiers",
    primaryColor: "#EEEDFE",
    secondaryColor: "#7F77DD",
    iconDescription:
      "An upward arrow passing through three horizontal bands of increasing colour intensity",
    tagline: "You earned your way up. The league moved with you.",
    requirement: "Earn a league promotion",
  },
  {
    id: 45,
    name: "The Diamond",
    category: "consistency",
    rarity: "rare",
    shape: "diamond_gem",
    primaryColor: "#E0F2FE",
    secondaryColor: "#0369A1",
    iconDescription: "A cut diamond gem with light refracting from its facets",
    tagline: "The highest league. The sharpest competition. You belong here.",
    requirement: "Reach Diamond league",
  },
  {
    id: 46,
    name: "The Immovable",
    category: "consistency",
    rarity: "epic",
    shape: "anchor",
    primaryColor: "#2D2B55",
    secondaryColor: "#FFFFFF",
    iconDescription:
      "A ship's anchor with a small crown above — steadfast and senior",
    tagline: "Others rose and fell. You held.",
    requirement: "Remain in Diamond league for 4 consecutive weeks",
  },
  // Hidden (8)
  {
    id: 47,
    name: "The Midnight Oil",
    category: "hidden",
    rarity: "hidden",
    shape: "lantern",
    primaryColor: "#1A1A2E",
    secondaryColor: "#E94560",
    iconDescription: "A single lantern burning in complete darkness",
    tagline: "Some fires burn when no one is watching.",
    requirement:
      "Complete a checkpoint between midnight and 5am local time (any 3 occasions)",
  },
  {
    id: 48,
    name: "The Patient One",
    category: "hidden",
    rarity: "hidden",
    shape: "hourglass",
    primaryColor: "#1A1A2E",
    secondaryColor: "#E94560",
    iconDescription:
      "An hourglass where the sand is almost entirely in the bottom half",
    tagline: "You did not rush. The work knew it.",
    requirement:
      "Spend more than 30 days on a single stage before completing it",
  },
  {
    id: 49,
    name: "The Perfectionist",
    category: "hidden",
    rarity: "hidden",
    shape: "three_gold_stars",
    primaryColor: "#1A1A2E",
    secondaryColor: "#E94560",
    iconDescription:
      "Three gold stars arranged in a triangle, each perfectly identical",
    tagline: "You could have stopped. You didn't. Three times in a row.",
    requirement:
      "Complete 3 consecutive gold checkpoints with no standard completions in between",
  },
  {
    id: 50,
    name: "The Contrarian",
    category: "hidden",
    rarity: "hidden",
    shape: "inverted_triangle",
    primaryColor: "#1A1A2E",
    secondaryColor: "#E94560",
    iconDescription: "A triangle pointing downward — the unusual direction",
    tagline: "You chose the harder path before you chose the easier one.",
    requirement:
      "Complete Task 3 (stretch) before completing Task 1 or 2 on any checkpoint",
  },
  {
    id: 51,
    name: "The Renaissance",
    category: "hidden",
    rarity: "hidden",
    shape: "four_interlocked_circles",
    primaryColor: "#1A1A2E",
    secondaryColor: "#E94560",
    iconDescription: "Four overlapping circles in the four template colours",
    tagline:
      "The old word for someone who could not be contained by one discipline.",
    requirement: "Have an active idea in all four templates simultaneously",
  },
  {
    id: 52,
    name: "The Ghost",
    category: "hidden",
    rarity: "hidden",
    shape: "faint_silhouette",
    primaryColor: "#1A1A2E",
    secondaryColor: "#E94560",
    iconDescription:
      "A very faint translucent figure — present but barely visible",
    tagline: "You were here more than anyone knew.",
    requirement:
      "Complete 50 upvotes given without receiving a single upvote on your own content",
  },
  {
    id: 53,
    name: "Full Moon",
    category: "hidden",
    rarity: "hidden",
    shape: "moon",
    primaryColor: "#1A1A2E",
    secondaryColor: "#E94560",
    iconDescription: "A perfect full moon in a dark sky",
    tagline: "You were here when the platform was new enough to remember.",
    requirement:
      "Complete at least one action in every calendar month of the platform's first year",
  },
  {
    id: 54,
    name: "The Comeback",
    category: "hidden",
    rarity: "hidden",
    shape: "broken_chain",
    primaryColor: "#1A1A2E",
    secondaryColor: "#E94560",
    iconDescription:
      "A chain with a visible break and a bright new link connecting the two halves",
    tagline: "The streak broke. You came back anyway. That is harder.",
    requirement:
      "Return to an idea that has been inactive for 60+ days and complete a checkpoint",
  },
  // Aspirational (8)
  {
    id: 55,
    name: "The Visionary",
    category: "aspirational",
    rarity: "legendary",
    shape: "eye_with_star",
    primaryColor: "#0F172A",
    secondaryColor: "#F59E0B",
    iconDescription:
      "An open eye with a golden star as its pupil, radiating light",
    tagline: "Level 50. The apex. The one who saw it all the way through.",
    requirement: "Reach Level 50 (Visionary)",
  },
  {
    id: 56,
    name: "The Lorekeeper",
    category: "aspirational",
    rarity: "legendary",
    shape: "ancient_tome",
    primaryColor: "#0F172A",
    secondaryColor: "#F59E0B",
    iconDescription:
      "A thick ancient book with a glowing lock and ornate cover",
    tagline: "Five complete journeys. Five worlds brought into being.",
    requirement: "Complete 5 full idea lifecycles across any templates",
  },
  {
    id: 57,
    name: "The Realm Builder",
    category: "aspirational",
    rarity: "legendary",
    shape: "walled_city",
    primaryColor: "#0F172A",
    secondaryColor: "#F59E0B",
    iconDescription:
      "A miniature walled city viewed from above, complete with towers and gates",
    tagline: "You did not just complete ideas. You built a world.",
    requirement: "Complete 3 full Venture idea lifecycles",
  },
  {
    id: 58,
    name: "The Elder Scholar",
    category: "aspirational",
    rarity: "legendary",
    shape: "open_book_with_light",
    primaryColor: "#0F172A",
    secondaryColor: "#F59E0B",
    iconDescription: "An open book emitting light from its pages",
    tagline: "The library knew you before you finished reading it.",
    requirement: "Complete 3 full Academic idea lifecycles",
  },
  {
    id: 59,
    name: "The Grand Artificer",
    category: "aspirational",
    rarity: "legendary",
    shape: "clockwork_engine",
    primaryColor: "#0F172A",
    secondaryColor: "#F59E0B",
    iconDescription:
      "A complex clockwork mechanism — gears within gears, all turning in harmony",
    tagline: "Three experiments completed. Three truths added to the record.",
    requirement: "Complete 3 full Experimental idea lifecycles",
  },
  {
    id: 60,
    name: "The Master",
    category: "aspirational",
    rarity: "legendary",
    shape: "quill_and_sword",
    primaryColor: "#0F172A",
    secondaryColor: "#F59E0B",
    iconDescription:
      "A quill and a sword crossed at their centres — craft and courage",
    tagline: "Three complete creative works. Not attempts. Works.",
    requirement: "Complete 3 full Creative idea lifecycles",
  },
  {
    id: 61,
    name: "The Thousand",
    category: "aspirational",
    rarity: "legendary",
    shape: "1000_in_roman",
    primaryColor: "#0F172A",
    secondaryColor: "#F59E0B",
    iconDescription:
      "The Roman numeral M (1000) engraved on dark stone with gold inlay",
    tagline: "One thousand voices helped. One thousand ideas moved forward.",
    requirement: "Give 1,000 upvoted reviews or comments across the platform",
  },
  {
    id: 62,
    name: "The Architect of Ages",
    category: "aspirational",
    rarity: "legendary",
    shape: "monument_silhouette",
    primaryColor: "#0F172A",
    secondaryColor: "#F59E0B",
    iconDescription:
      "The silhouette of a grand monument — the kind that outlasts its builder",
    tagline:
      "You have left something in the world that will outlast the making of it.",
    requirement: "Have 10 monuments placed on the shared world map",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// POINT VALUES
// ─────────────────────────────────────────────────────────────────────────────
export const POINT_VALUES = {
  // Venture task completion
  task_t1_complete: 20,
  task_t2_complete: 20,
  task_t3_complete: 35,
  gold_checkpoint_bonus: 25,
  stage_complete_bonus: 50,
  venture_complete_bonus: 200,

  // Boss defeat
  boss_retreat: 25,
  boss_slay: 100,

  // Existing (from gamification.ts)
  create_idea: 50,
  spark_idea: 1,
  comment_idea: 1,
  daily_login: 10,

  // Flare system
  fire_flare: 0,
  respond_to_flare: 2,
  flare_marked_helpful: 5,
  flare_resolved: 10,

  // Mentor system
  accept_mentee: 20,
  mentee_checkpoint_advance: 3,
  mentee_level_up: 50,
} as const;
