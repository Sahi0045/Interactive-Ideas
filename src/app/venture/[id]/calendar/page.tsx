"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { CalendarTool } from "@/components/tools/calendar-tool";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VentureErrorBoundary } from "@/components/venture/error-boundary";

function StandaloneCalendar() {
  const params = useParams();
  const ventureId = params.id as Id<"ventures">;

  const saveToolData = useMutation(api.worldMap.saveToolData);
  const calendarData = useQuery(
    api.worldMap.getToolData,
    ventureId ? { ventureId, toolType: "calendar" } : "skip"
  );

  const handleToolSubmit = async (data: unknown) => {
    if (!ventureId) return;
    await saveToolData({
      ventureId,
      toolType: "calendar",
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
            <h1 className="text-xl font-bold">Project Calendar</h1>
            <p className="text-sm text-muted-foreground">Manage your venture timeline independently.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {calendarData !== undefined ? (
          <CalendarTool 
            prompt="Standalone Project Timeline Calendar"
            initialContent={calendarData}
            onSubmit={handleToolSubmit}
            isStandalone={true}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading Calendar timeline...
          </div>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <VentureErrorBoundary
      title="Failed to load Calendar"
      description="We couldn't load this timeline tool."
    >
      <StandaloneCalendar />
    </VentureErrorBoundary>
  );
}
