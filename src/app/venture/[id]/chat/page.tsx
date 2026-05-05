"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
import ChatThread from "@/components/chat/ChatThread";
import { VentureErrorBoundary } from "@/components/venture/error-boundary";

function StandaloneChat() {
  const params = useParams();
  const ventureId = params.id as Id<"ventures">;

  const venture = useQuery(api.ventures.getVenture, { ventureId });
  const channels = useQuery(api.communities.getChannels, 
    venture?.ideaId ? { ideaId: venture.ideaId } : "skip"
  );

  const activeConversationId = channels?.[0]?._id;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4 flex items-center gap-4">
        <Link href={`/venture/${ventureId}`}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Group Chat
          </h1>
          <p className="text-sm text-muted-foreground">Real-time team communication</p>
        </div>
      </div>
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full h-[calc(100vh-80px)]">
        <div className="border rounded-xl h-full bg-card overflow-hidden">
          {venture?.ideaId ? (
            <ChatThread 
              ideaId={venture.ideaId}
              conversationId={activeConversationId || null}
              onClose={() => {}} // No-op in standalone mode
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {venture === undefined ? "Loading chat..." : "Initializing group chat..."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <VentureErrorBoundary
      title="Failed to load Group Chat"
      description="We couldn't load the real-time chat for this venture."
    >
      <StandaloneChat />
    </VentureErrorBoundary>
  );
}
