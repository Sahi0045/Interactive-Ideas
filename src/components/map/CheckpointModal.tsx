/**
 * Checkpoint Detail Modal
 * 
 * Opens when user clicks on a checkpoint/room in the map.
 * Shows tasks, progress, and allows starting/completing tasks.
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Lock, CheckCircle, Circle, Star } from "lucide-react";
import { TaskSubmissionModal } from "./TaskSubmissionModal";
import type { Id } from "@convex/_generated/dataModel";

interface CheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkpoint: {
    id: string;
    stage: number;
    checkpoint: number;
    status: "locked" | "active" | "in_progress" | "completed" | "gold";
    t1: boolean;
    t2: boolean;
    t3: boolean;
  } | null;
}

const STAGE_NAMES = [
  "Ideation",
  "Research",
  "Validation",
  "Offer Design",
  "Build & Deliver",
  "Launch",
  "Iteration",
  "Scale",
];

const TASK_DESCRIPTIONS = {
  t1: {
    title: "Foundation Task",
    description: "Complete the basic requirements for this checkpoint",
    points: 20
  },
  t2: {
    title: "Advanced Task",
    description: "Take it to the next level with additional work",
    points: 20
  },
  t3: {
    title: "Excellence Task",
    description: "Go above and beyond for maximum impact",
    points: 35
  },
};

export function CheckpointModal({ isOpen, onClose, checkpoint }: CheckpointModalProps) {
  const [selectedTask, setSelectedTask] = useState<{
    id: Id<"ventureTasks">;
    checkpointId: Id<"ventureCheckpoints">;
    taskLevel: "t1" | "t2" | "t3";
    title: string;
    description: string;
    toolType: string;
    points: number;
  } | null>(null);

  if (!checkpoint) return null;

  const stageName = STAGE_NAMES[checkpoint.stage - 1] || "Unknown";
  const isLocked = checkpoint.status === "locked";
  const isCompleted = checkpoint.status === "completed" || checkpoint.status === "gold";
  const isGold = checkpoint.status === "gold";

  const completedTasks = [checkpoint.t1, checkpoint.t2, checkpoint.t3].filter(Boolean).length;
  const totalPoints =
    (checkpoint.t1 ? 20 : 0) +
    (checkpoint.t2 ? 20 : 0) +
    (checkpoint.t3 ? 35 : 0);

  const handleTaskClick = (taskLevel: "t1" | "t2" | "t3") => {
    const taskData = TASK_DESCRIPTIONS[taskLevel];
    setSelectedTask({
      id: `${checkpoint.id}_${taskLevel}` as Id<"ventureTasks">, // Temporary - will be replaced with real task ID
      checkpointId: checkpoint.id as Id<"ventureCheckpoints">,
      taskLevel,
      title: taskData.title,
      description: taskData.description,
      toolType: "write", // Default tool - will be enhanced later
      points: taskData.points,
    });
  };

  const handleSubmissionSuccess = () => {
    setSelectedTask(null);
    // Refresh checkpoint data
    window.location.reload(); // Simple refresh for now - can be optimized with proper state management
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-50"
          >
            <div className="bg-[#111827] border-2 border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className={`relative p-6 ${
                isGold ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20' :
                isCompleted ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/20' :
                isLocked ? 'bg-gradient-to-r from-gray-600/20 to-gray-700/20' :
                'bg-gradient-to-r from-[#6366F1]/20 to-[#8B5CF6]/20'
              }`}>
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-black/20 hover:bg-black/40 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                <div className="flex items-center gap-4">
                  {/* Status Icon */}
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                    isGold ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                    isCompleted ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
                    isLocked ? 'bg-gradient-to-br from-gray-500 to-gray-600' :
                    'bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]'
                  }`}>
                    {isGold ? <Star className="w-8 h-8 text-white" /> :
                     isCompleted ? <CheckCircle className="w-8 h-8 text-white" /> :
                     isLocked ? <Lock className="w-8 h-8 text-white" /> :
                     <Circle className="w-8 h-8 text-white" />}
                  </div>

                  {/* Title */}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Stage {checkpoint.stage} - Checkpoint {checkpoint.checkpoint}
                    </h2>
                    <p className="text-gray-300">
                      {stageName} Phase
                    </p>
                  </div>

                  {/* Points Badge */}
                  {!isLocked && (
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">{totalPoints}</div>
                      <div className="text-sm text-gray-300">Points</div>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {!isLocked && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
                      <span>Progress</span>
                      <span>{completedTasks}/3 Tasks</span>
                    </div>
                    <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(completedTasks / 3) * 100}%` }}
                        className={`h-full ${
                          isGold ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                          'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                {isLocked ? (
                  <div className="text-center py-12">
                    <Lock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Checkpoint Locked
                    </h3>
                    <p className="text-gray-400">
                      Complete previous checkpoints to unlock this one
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Task 1 */}
                    <TaskCard
                      completed={checkpoint.t1}
                      onTaskClick={() => handleTaskClick("t1")}
                      {...TASK_DESCRIPTIONS.t1}
                    />

                    {/* Task 2 */}
                    <TaskCard
                      completed={checkpoint.t2}
                      onTaskClick={() => handleTaskClick("t2")}
                      {...TASK_DESCRIPTIONS.t2}
                    />

                    {/* Task 3 */}
                    <TaskCard
                      completed={checkpoint.t3}
                      onTaskClick={() => handleTaskClick("t3")}
                      {...TASK_DESCRIPTIONS.t3}
                    />

                    {/* Gold Badge */}
                    {isGold && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="mt-6 p-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-2 border-yellow-500/30 rounded-xl text-center"
                      >
                        <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                        <p className="text-yellow-500 font-semibold">
                          🎉 Gold Checkpoint! All tasks completed!
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 bg-black/20 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    className="text-gray-400 hover:text-white"
                  >
                    Close
                  </Button>
                  
                  {!isLocked && !isCompleted && (
                    <Button
                      className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5558E3] hover:to-[#7C3AED]"
                      onClick={() => {
                        // TODO: Navigate to task completion page
                        console.log("Start working on checkpoint:", checkpoint.id);
                      }}
                    >
                      Start Working
                    </Button>
                  )}

                  {isCompleted && (
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">Completed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Task Submission Modal */}
          <TaskSubmissionModal
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            task={selectedTask}
            onSuccess={handleSubmissionSuccess}
          />
        </>
      )}
    </AnimatePresence>
  );
}

function TaskCard({ 
  title, 
  description, 
  points, 
  completed,
  onTaskClick 
}: { 
  title: string;
  description: string;
  points: number;
  completed: boolean;
  onTaskClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={completed ? undefined : onTaskClick}
      className={`p-4 rounded-xl border-2 transition-all ${
        completed
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-white/5 border-white/10 hover:border-white/20 cursor-pointer'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
          completed
            ? 'bg-green-500 border-green-500'
            : 'border-gray-500'
        }`}>
          {completed && <CheckCircle className="w-4 h-4 text-white" />}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`font-semibold ${completed ? 'text-green-400' : 'text-white'}`}>
              {title}
            </h4>
            <span className={`text-sm font-bold ${completed ? 'text-green-400' : 'text-[#6366F1]'}`}>
              +{points} pts
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {description}
          </p>
          {!completed && (
            <button className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors">
              Click to work on this task →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
