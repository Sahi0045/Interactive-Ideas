import { atom } from "jotai";
import type { Id } from "@convex/_generated/dataModel";

export interface VentureData {
  id: string;
  name: string;
  currentStage: number;
  currentCheckpoint: number;
  totalCheckpoints: number;
}

export interface UserProgress {
  level: number;
  phase: number;
  xp: number;
  xpToNextLevel: number;
  streak: number;
  qualityScore: number;
  valuationScore: number;
}

export interface CorruptionState {
  level: number;
  phase: "calm" | "creeping" | "desaturated" | "urgent" | "critical";
  bossName: string;
  bossHp: number;
  bossBaseHp: number;
}

export interface HUDVisibility {
  hudVisible: boolean;
  hudExpanded: boolean;
}

export interface QuestTask {
  label: string;
  description: string;
  tool: string;
  done: boolean;
}

export interface CurrentQuest {
  checkpointName: string;
  tasks: QuestTask[];
  stage: number;
  checkpoint: number;
}

export const hudVisibleAtom = atom<boolean>(true);
export const hudExpandedAtom = atom<boolean>(true);
export const activeVentureAtom = atom<VentureData | null>(null);
export const userProgressAtom = atom<UserProgress>({
  level: 1,
  phase: 1,
  xp: 0,
  xpToNextLevel: 100,
  streak: 0,
  qualityScore: 0,
  valuationScore: 0,
});

export const audioSettingsAtom = atom({
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  muted: false,
});

export const corruptionStateAtom = atom<CorruptionState>({
  level: 0,
  phase: "calm",
  bossName: "Unknown Boss",
  bossHp: 100,
  bossBaseHp: 100,
});

export const stageInfoAtom = atom({
  stageName: "Ideation",
  stageIcon: "💡",
  biomeName: "The Forest",
  stage: 1,
  currentCheckpoint: 1,
  totalCheckpointsInStage: 4,
});

export const checkpointProgressAtom = atom({
  completed: 0,
  total: 36,
  goldCount: 0,
});

// Task system atoms
export interface SubmittingTask {
  id: string;
  checkpointId: Id<"ventureCheckpoints">;
  taskLevel: "t1" | "t2" | "t3";
  title: string;
  description: string;
  toolType: string;
  points: number;
}

export const currentQuestAtom = atom<CurrentQuest | null>(null);
export const submittingTaskAtom = atom<SubmittingTask | null>(null);
export const activeTaskAtom = atom<SubmittingTask | null>(null);

// Gold counter atom
export const goldCountAtom = atom<number>(0);
