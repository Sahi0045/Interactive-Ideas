"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { KanbanTool } from "@/components/tools/kanban-tool";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VentureErrorBoundary } from "@/components/venture/error-boundary";

function StandaloneKanban() {
  const params = useParams();
  const ventureId = params.id as Id<"ventures">;

  const saveToolData = useMutation(api.worldMap.saveToolData);
  const kanbanData = useQuery(
    api.worldMap.getToolData,
    ventureId ? { ventureId, toolType: "kanban" } : "skip"
  );

  const handleToolSubmit = async (data: unknown) => {
    if (!ventureId) return;
    await saveToolData({
      ventureId,
      toolType: "kanban",
      data,
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/venture/${ventureId}`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Project Kanban</h1>
            <p className="text-sm text-muted-foreground">Manage your venture tasks and workflow independently.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {kanbanData !== undefined ? (
          <KanbanTool 
            prompt="Standalone Project Management Kanban"
            initialContent={kanbanData}
            onSubmit={handleToolSubmit}
            isStandalone={true}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading Kanban board...
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  return (
    <VentureErrorBoundary
      title="Failed to load Kanban board"
      description="We couldn't load this project management tool."
    >
      <StandaloneKanban />
    </VentureErrorBoundary>
  );
}
