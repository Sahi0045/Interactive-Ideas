"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video } from "lucide-react";
import { VentureErrorBoundary } from "@/components/venture/error-boundary";

function StandaloneVideoCall() {
  const params = useParams();
  const ventureId = params.id as Id<"ventures">;
  const venture = useQuery(api.ventures.getVenture, { ventureId });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const roomName = venture?.ideaId ? `InteractiveVenture_${venture.ideaId}` : null;

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
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Video className="w-5 h-5" />
              Live Video Call
            </h1>
            <p className="text-sm text-muted-foreground">Ad-hoc video session with project team. History is not stored.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full bg-black">
        {mounted && roomName ? (
          <iframe
            src={`https://meet.jit.si/${roomName}`}
            allow="camera; microphone; fullscreen; display-capture"
            className="w-full h-[calc(100vh-80px)] border-0"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Initializing secure video session...
          </div>
        )}
      </div>
    </div>
  );
}

export default function VideoCallPage() {
  return (
    <VentureErrorBoundary
      title="Failed to load Video Call"
      description="We couldn't load the live video session for this venture."
    >
      <StandaloneVideoCall />
    </VentureErrorBoundary>
  );
}
