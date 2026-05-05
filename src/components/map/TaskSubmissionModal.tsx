/**
 * Task Submission Modal
 *
 * Opens when user clicks a task to work on it.
 * Routes to the correct tool component based on task.toolType.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { audioManager } from "@/lib/audio/audioManager";

// Tool components
import { WriteTool } from "@/components/tools/write-tool";
import { TableTool } from "@/components/tools/table-tool";
import { MapTool } from "@/components/tools/map-tool";
import { SurveyTool } from "@/components/tools/survey-tool";
import { PollTool } from "@/components/tools/poll-tool";
import { LinkTool } from "@/components/tools/link-tool";
import { UploadTool } from "@/components/tools/upload-tool";
import { SelfReportTool } from "@/components/tools/self-report-tool";
import { JournalTool } from "@/components/tools/journal-tool";
import { KanbanTool } from "@/components/tools/kanban-tool";
import { CalendarTool } from "@/components/tools/calendar-tool";

interface TaskSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: string;
    checkpointId: Id<"ventureCheckpoints">;
    taskLevel: "t1" | "t2" | "t3";
    title: string;
    description: string;
    toolType: string;
    points: number;
  } | null;
  onSuccess: (result: {
    taskId: string;
    checkpointId: Id<"ventureCheckpoints">;
    taskLevel: "t1" | "t2" | "t3";
  }) => void;
}

/** Returns a human-readable minimum requirement label per PRD §8 */
function getMinRequirementLabel(toolType: string): string {
  switch (toolType) {
    case "write":
      return "Minimum 50 words";
    case "table":
      return "At least 2 rows + headers";
    case "map":
      return "At least 1 element placed";
    case "survey":
      return "Survey created & at least 1 response";
    case "poll":
      return "Poll created & published";
    case "link":
      return "At least 1 URL with annotation";
    case "upload":
      return "At least 1 file attached";
    case "self_report":
      return "Form completed & confirmed";
    case "journal":
      return "At least 1 entry written";
    case "kanban":
      return "Board with at least 2 columns & 1 card";
    case "calendar":
      return "At least 1 event or milestone placed";
    default:
      return "Complete the form";
  }
}

export function TaskSubmissionModal({
  isOpen,
  onClose,
  task,
  onSuccess,
}: TaskSubmissionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const submitTask = useMutation(api.worldMap.submitTaskContent);

  const draftKey = useMemo(
    () =>
      task ? `venture-task-draft:${task.checkpointId}:${task.taskLevel}` : "",
    [task],
  );

  useEffect(() => {
    const syncOnlineStatus = () => setIsOnline(window.navigator.onLine);
    syncOnlineStatus();
    window.addEventListener("online", syncOnlineStatus);
    window.addEventListener("offline", syncOnlineStatus);
    return () => {
      window.removeEventListener("online", syncOnlineStatus);
      window.removeEventListener("offline", syncOnlineStatus);
    };
  }, []);

  // Reset error/message when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, task]);

  if (!task) return null;

  const handleToolSubmit = async (content: unknown) => {
    if (!isOnline) {
      audioManager.playUI("error");
      setError(
        "You are offline. Your draft is saved locally until you reconnect.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitTask({
        checkpointId: task.checkpointId,
        taskLevel: task.taskLevel,
        content,
      });

      audioManager.playUI("confirm");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
      }
      onSuccess({
        taskId: task.id,
        checkpointId: task.checkpointId,
        taskLevel: task.taskLevel,
      });
    } catch (err) {
      audioManager.playUI("error");
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Renders the appropriate tool component for this task type */
  const renderTool = () => {
    switch (task.toolType) {
      case "write":
        return (
          <WriteTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
            initialContent={
              typeof window !== "undefined"
                ? (window.localStorage.getItem(draftKey) ?? undefined)
                : undefined
            }
          />
        );

      case "table":
        return (
          <TableTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      case "map":
        return (
          <MapTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      case "survey":
        return (
          <SurveyTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      case "poll":
        return (
          <PollTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      case "link":
        return (
          <LinkTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      case "upload":
        // UploadTool requires taskId to generate a scoped Convex upload URL
        return (
          <UploadTool
            prompt={task.description}
            taskId={task.id}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      case "self_report":
        // SelfReportTool requires explicit field definitions.
        // These generic fields cover most self-report tasks; extend per PRD §8.
        return (
          <SelfReportTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
            fields={[
              {
                key: "what_happened",
                label: "What happened / what did you do?",
                type: "textarea",
              },
              { key: "outcome", label: "Outcome or result", type: "textarea" },
              {
                key: "learning",
                label: "Key learning or next step",
                type: "textarea",
              },
            ]}
          />
        );

      case "journal":
        return (
          <JournalTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      case "kanban":
        return (
          <KanbanTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      case "calendar":
        return (
          <CalendarTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
          />
        );

      default:
        // Fallback: generic write tool for unknown tool types
        return (
          <WriteTool
            prompt={task.description}
            isSubmitting={isSubmitting}
            onSubmit={handleToolSubmit}
            initialContent={
              typeof window !== "undefined"
                ? (window.localStorage.getItem(draftKey) ?? undefined)
                : undefined
            }
          />
        );
    }
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
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Modal - Full responsive */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[101] overflow-y-auto sm:grid sm:place-items-center sm:p-6"
          >
            <div className="bg-[#111827] border-0 sm:border-2 border-white/10 rounded-none sm:rounded-2xl shadow-2xl flex min-h-full flex-col sm:min-h-0 sm:w-[min(96vw,1120px)] sm:max-h-[calc(100vh-3rem)] sm:overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:px-5 sm:py-4 border-b border-white/10 bg-gradient-to-r from-[#6366F1]/20 to-[#8B5CF6]/20 flex-shrink-0 safe-top">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-1 truncate sm:whitespace-normal">
                      {task.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-400 line-clamp-2">
                      {task.description}
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                        Tool: {task.toolType.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-400">
                        {getMinRequirementLabel(task.toolType)}
                      </span>
                      <span className="text-xs text-[#6366F1] font-bold">
                        +{task.points} points
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      audioManager.playUI("click");
                      onClose();
                    }}
                    className="p-2 sm:p-2 rounded-lg bg-black/20 hover:bg-black/40 active:bg-black/60 transition-colors flex-shrink-0 touch-manipulation"
                    aria-label="Close modal"
                  >
                    <X className="w-6 h-6 sm:w-5 sm:h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-visible p-4 sm:p-5 safe-bottom">
                {!isOnline && (
                  <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                    Offline mode detected. Your draft will stay on this device
                    until you reconnect.
                  </div>
                )}

                {/* Tool Component */}
                {renderTool()}

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
