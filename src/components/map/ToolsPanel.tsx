"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Grid, 
  Calendar as CalendarIcon, 
  LayoutDashboard, 
  FileText, 
  Files, 
  ChevronLeft,
  Search,
  Scroll,
  Target,
  Lock,
  Map,
  MessageSquare,
  Video,
  Rss
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import { stageInfoAtom } from "@/lib/stores/hudStore";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useRouter } from "next/navigation";

// Mock data or import if available
const MILESTONE_DEFINITIONS: Record<string, { title: string; objectives: string[] }> = {
  "1_1": { title: "Problem Identified", objectives: ["Write a clear problem statement", "Map the problem space on canvas", "Find real-world examples"] },
  "1_2": { title: "Problem Owner Defined", objectives: ["Write a target customer profile", "Build a persona card", "Run a short survey"] },
  "1_3": { title: "Solution Concept Formed", objectives: ["Describe the solution in 2-3 sentences", "Sketch core experience on canvas", "Poll target audience"] },
  "1_4": { title: "Idea Worth Pursuing", objectives: ["Write an honest case for/against", "Build a comparison table", "Write a 3-year vision"] },
  "2_1": { title: "Market Landscape Mapped", objectives: ["Write a market summary", "Build a market overview table", "Link industry reports"] },
  "2_2": { title: "Competitors Analysed", objectives: ["List four competitors", "Build comparison table", "Map competitive landscape"] },
};

// Import tools
import { CalendarTool } from "@/components/tools/calendar-tool";
import { KanbanTool } from "@/components/tools/kanban-tool";
import { WriteTool } from "@/components/tools/write-tool";
import { MapTool } from "@/components/tools/map-tool";
import { JournalTool } from "@/components/tools/journal-tool";
import { SurveyTool } from "@/components/tools/survey-tool";
import { audioManager } from "@/lib/audio/audioManager";

type TabType = "tools" | "calendar" | "kanban" | "week-prd" | "all-prd" | "roadmap" | "write" | "map" | "journal" | "survey";

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  activeVentureId?: Id<"ventures">;
}

export function ToolsPanel({ isOpen, onClose, activeTab, onTabChange, activeVentureId }: ToolsPanelProps) {
  const [stageInfo] = useAtom(stageInfoAtom);
  const [searchQuery, setSearchQuery] = useState("");

  const saveToolData = useMutation(api.worldMap.saveToolData);

  const kanbanData = useQuery(
    api.worldMap.getToolData,
    activeVentureId ? { ventureId: activeVentureId, toolType: "kanban" } : "skip"
  );

  const calendarData = useQuery(
    api.worldMap.getToolData,
    activeVentureId ? { ventureId: activeVentureId, toolType: "calendar" } : "skip"
  );

  const writeData = useQuery(
    api.worldMap.getToolData,
    activeVentureId ? { ventureId: activeVentureId, toolType: "write" } : "skip"
  );

  const mapData = useQuery(
    api.worldMap.getToolData,
    activeVentureId ? { ventureId: activeVentureId, toolType: "map" } : "skip"
  );

  const journalData = useQuery(
    api.worldMap.getToolData,
    activeVentureId ? { ventureId: activeVentureId, toolType: "journal" } : "skip"
  );

  const surveyData = useQuery(
    api.worldMap.getToolData,
    activeVentureId ? { ventureId: activeVentureId, toolType: "survey" } : "skip"
  );

  const handleToolSubmit = async (toolType: string, data: unknown) => {
    if (!activeVentureId) return;
    await saveToolData({
      ventureId: activeVentureId,
      toolType,
      data,
    });
  };

  const tabs = [
    { id: "tools", label: "All Tools", icon: Grid },
    { id: "calendar", label: "Calendar", icon: CalendarIcon },
    { id: "kanban", label: "Kanban", icon: LayoutDashboard },
    { id: "week-prd", label: "Week PRD", icon: FileText },
    { id: "all-prd", label: "All PRD", icon: Files },
    { id: "roadmap", label: "Roadmap", icon: Map },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="tools-panel"
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="absolute left-0 top-0 bottom-0 z-[60] flex flex-col font-sans"
          style={{
            width: "420px",
            background: "linear-gradient(180deg, rgba(11, 15, 25, 0.9), rgba(7, 10, 18, 0.98))",
            backdropFilter: "blur(20px)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "10px 0 50px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Grid className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider">Venture Tools</h2>
                <p className="text-[10px] text-indigo-300/60 font-bold uppercase tracking-widest">Workspace v1.0</p>
              </div>
            </div>
            <button
              onClick={() => {
                audioManager.playUI("click");
                onClose();
              }}
              onMouseEnter={() => audioManager.playUI("hover")}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-all duration-200 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 p-2 bg-black/20 border-b border-white/5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  audioManager.playUI("click");
                  onTabChange(tab.id);
                }}
                onMouseEnter={() => audioManager.playUI("hover")}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-300",
                  activeTab === tab.id 
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                )}
              >
                <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "animate-pulse" : "")} />
                <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search Bar (Only for Tools) */}
          {activeTab === "tools" && (
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  placeholder="Search tools..." 
                  className="pl-10 bg-white/5 border-white/10 rounded-xl text-xs h-10 focus:border-indigo-500/50 focus:ring-0 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {activeTab === "tools" && <AllToolsGrid searchQuery={searchQuery} onToolSelect={onTabChange} activeVentureId={activeVentureId} />}
                
                {activeTab === "calendar" && (
                  <div className="space-y-4">
                    <CalendarTool 
                      prompt="Plan your venture milestones and team syncs."
                      initialContent={calendarData}
                      onSubmit={(data) => handleToolSubmit("calendar", data)}
                    />
                  </div>
                )}
                {activeTab === "kanban" && (
                  <div className="space-y-4">
                    <KanbanTool 
                      prompt="Manage your venture tasks and workflow."
                      initialContent={kanbanData}
                      onSubmit={(data) => handleToolSubmit("kanban", data)}
                    />
                  </div>
                )}
                {activeTab === "write" && (
                  <div className="space-y-4">
                    <WriteTool 
                      prompt="Craft documentation and notes."
                      initialContent={writeData?.text}
                      onSubmit={(data) => handleToolSubmit("write", data)}
                      layout="compact"
                    />
                  </div>
                )}
                {activeTab === "map" && (
                  <div className="space-y-4">
                    <MapTool 
                      prompt="Visualize and connect your ideas."
                      initialContent={mapData}
                      onSubmit={(data) => handleToolSubmit("map", data)}
                    />
                  </div>
                )}
                {activeTab === "journal" && (
                  <div className="space-y-4">
                    <JournalTool 
                      prompt="Log your daily progress and thoughts."
                      initialContent={journalData}
                      onSubmit={(data) => handleToolSubmit("journal", data)}
                    />
                  </div>
                )}
                {activeTab === "survey" && (
                  <div className="space-y-4">
                    <SurveyTool 
                      prompt="Create surveys to gather user feedback."
                      initialContent={surveyData}
                      onSubmit={(data) => handleToolSubmit("survey", data)}
                    />
                  </div>
                )}

                {activeTab === "week-prd" && (
                  <PRDViewer 
                    title={`Stage ${stageInfo.stage} PRD: ${stageInfo.stageName}`} 
                    stage={stageInfo.stage}
                  />
                )}
                {activeTab === "all-prd" && <PRDList currentStage={stageInfo.stage} />}
                {activeTab === "roadmap" && <RoadmapPanel />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-black/40">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
              <span>System Status</span>
              <div className="flex items-center gap-2 text-emerald-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Operational</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AllToolsGrid({ searchQuery, onToolSelect, activeVentureId }: { searchQuery: string; onToolSelect: (id: TabType) => void; activeVentureId?: Id<"ventures"> }) {
  const router = useRouter();
  const tools = [
    { id: "feed", name: "Contributions", desc: "Project Feed", icon: Rss, color: "#6366f1", isExternal: true, path: "feed" },
    { id: "chat", name: "Group Chat", desc: "Real-time sync", icon: MessageSquare, color: "#3b82f6", isExternal: true, path: "chat" },
    { id: "video", name: "Video Call", desc: "Live session", icon: Video, color: "#f43f5e", isExternal: true, path: "video-call" },
    { id: "write", name: "Write Tool", desc: "Craft venture documentation", icon: FileText, color: "#818cf8" },
    { id: "calendar", name: "Calendar", desc: "Schedule milestones", icon: CalendarIcon, color: "#fbbf24" },
    { id: "kanban", name: "Kanban", desc: "Manage task workflow", icon: LayoutDashboard, color: "#34d399" },
    { id: "map", name: "Canvas", desc: "Visualize and brainstorm", icon: Grid, color: "#f472b6" },
    { id: "journal", name: "Journal", desc: "Private progress log", icon: Scroll, color: "#a78bfa" },
    { id: "survey", name: "Survey", desc: "Gather user feedback", icon: Search, color: "#2dd4bf" },
  ];

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      {filteredTools.map((tool) => (
        <motion.button
          key={tool.id}
          onClick={() => {
            if (tool.isExternal && activeVentureId) {
              window.open(`/venture/${activeVentureId}/${tool.path}`, "_blank");
            } else {
              onToolSelect(tool.id as TabType);
            }
          }}
          whileHover={{ y: -4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center transition-transform group-hover:rotate-12" style={{ backgroundColor: `${tool.color}15`, border: `1px solid ${tool.color}30` }}>
            <tool.icon className="w-5 h-5" style={{ color: tool.color }} />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">{tool.name}</h3>
          <p className="text-[10px] text-slate-500 leading-relaxed">{tool.desc}</p>
        </motion.button>
      ))}
    </div>
  );
}

function PRDViewer({ title, stage }: { title: string, stage: number }) {
  const milestones = Object.entries(MILESTONE_DEFINITIONS)
    .filter(([key]) => key.startsWith(`${stage}_`))
    .map(([key, value]) => ({ id: key, ...value }));

  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <h3 className="text-lg font-black text-white uppercase tracking-wider">{title}</h3>
          <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase">Active Stage</span>
        </div>
        <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-medium">
          {milestones.length > 0 ? milestones.map((m) => (
            <section key={m.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                <h4 className="text-white font-bold uppercase text-[11px] tracking-widest">{m.title}</h4>
              </div>
              <ul className="space-y-2">
                {m.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-3 text-[12px] text-slate-400">
                    <div className="w-1 h-1 rounded-full bg-indigo-500 mt-2 shrink-0" />
                    {obj}
                  </li>
                ))}
              </ul>
            </section>
          )) : (
            <div className="text-center py-10">
              <Scroll className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">No milestones found for this stage</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PRDList({ currentStage }: { currentStage: number }) {
  const stages = [
    { id: 1, name: "Ideation", icon: "💡" },
    { id: 2, name: "Research", icon: "🔍" },
    { id: 3, name: "Validation", icon: "⚔️" },
    { id: 4, name: "Design", icon: "🎨" },
    { id: 5, name: "Development", icon: "⚒️" },
    { id: 6, name: "Launch", icon: "🚀" },
    { id: 7, name: "Iteration", icon: "🔄" },
    { id: 8, name: "Scale", icon: "👑" },
  ];

  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <button
          key={stage.id}
          disabled={stage.id > currentStage}
          className={cn(
            "w-full p-4 rounded-xl border transition-all text-left flex items-center justify-between group",
            stage.id <= currentStage 
              ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10" 
              : "bg-white/[0.01] border-white/[0.02] opacity-40 grayscale"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
              <span className="text-lg">{stage.icon}</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Stage {stage.id}: {stage.name}</h4>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">
                {stage.id < currentStage ? "Completed" : stage.id === currentStage ? "Current Focus" : "Locked"}
              </p>
            </div>
          </div>
          {stage.id <= currentStage && (
            <span className="text-[10px] font-black text-indigo-400 uppercase">View Details</span>
          )}
          {stage.id > currentStage && (
            <Lock className="w-3 h-3 text-slate-600" />
          )}
        </button>
      ))}
    </div>
  );
}

function RoadmapPanel() {
  const phases = [
    {
      name: "Phase 1",
      timeline: "Now",
      status: "Live MVP",
      items: [
        "Stages 1-2 fully themed and playable",
        "All 11 venture tools active",
        "AI scoring, XP, badges, and submissions live",
      ],
    },
    {
      name: "Phase 2",
      timeline: "Month 2",
      status: "Next",
      items: [
        "Stages 3-4 biome rollout",
        "Reusable checkpoint ceremony upgrades",
        "Priority audio and final persona art",
      ],
    },
    {
      name: "Phase 3",
      timeline: "Month 3",
      status: "Planned",
      items: [
        "Stages 5-6 biome rollout",
        "Expanded checkpoint animation coverage",
        "Boss encounter polish",
      ],
    },
    {
      name: "Phase 4",
      timeline: "Month 4",
      status: "Planned",
      items: [
        "Stages 7-8 biome rollout",
        "Full endgame content pass",
        "Complete audio pack and final polish",
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Phased Rollout
            </p>
            <h3 className="mt-1 text-lg font-black text-white">
              Venture Quest World Roadmap
            </h3>
          </div>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300">
            Phase 1
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          The shipped map is a deliberate Phase 1 release. Core progression is fully live across all stages; world theming and cinematic polish are expanding in phases.
        </p>
      </div>

      <div className="space-y-3">
        {phases.map((phase) => (
          <div
            key={phase.name}
            className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-white">
                  {phase.name}
                </h4>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  {phase.timeline}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-300">
                {phase.status}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {phase.items.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
