"use client";

import React, { memo, useEffect, useRef, useCallback, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X, Settings, Video } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { ChannelSettingsDialog } from "./ChannelSettingsDialog";


interface ChatThreadProps {
  conversationId: Id<"conversations"> | null;
  onBack: () => void;
  onClose: () => void;
  receiverId?: Id<"users"> | null;
  ideaId?: Id<"ideas"> | null;
}

const ChatThread: React.FC<ChatThreadProps> = memo(({ conversationId, onBack, onClose, receiverId, ideaId }) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { isAuthenticated } = useConvexAuth();

  // Resolve conversation ID for direct chats if not provided
  const directConversationId = useQuery(api.chat.getDirectConversationId, isAuthenticated && receiverId && !conversationId ? { receiverId } : "skip");

  const activeConversationId = conversationId || directConversationId;

  const messages = useQuery(api.chat.getConversationMessages, isAuthenticated && activeConversationId ? { conversationId: activeConversationId } : "skip");
  const sendMessage = useMutation(api.chat.sendMessage);
  const users = useQuery(api.chat.getAllUsers, isAuthenticated ? {} : "skip");
  const currentUserDoc = useQuery(api.chat.getUserByClerkId, isAuthenticated ? {} : "skip");

  // Add loading and error states
  const [sendError, setSendError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Auto scroll to bottom on new messages
    if (scrollAreaRef.current) {
      const element = scrollAreaRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  const currentUserId = currentUserDoc?._id as Id<"users">;

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !currentUserId) return;

    setSendError(null);

    try {
      if (ideaId) {
        // Group chat
        await sendMessage({
          content,
          conversationId: conversationId || undefined,
          ideaId: ideaId,
        });
      } else if (receiverId) {
        // Direct chat
        await sendMessage({
          receiverId,
          content,
          conversationId: activeConversationId || undefined,
        });
      } else {
        // Try to infer context from existing messages if no explicit context
        let recId = receiverId;
        if (!recId && messages && messages.length > 0) {
          const firstMessage = messages[0];
          recId = firstMessage.senderId === currentUserId
            ? firstMessage.receiverId
            : firstMessage.senderId;
        }

        if (recId) {
          await sendMessage({
            receiverId: recId,
            content,
            conversationId: activeConversationId || undefined,
          });
        } else {
          setSendError("Cannot determine chat context");
          return;
        }
      }
      // Message sent successfully
    } catch (error) {
      console.error("Failed to send message:", error);
      setSendError("Failed to send message. Please try again.");
    } finally {
    }
  }, [sendMessage, messages, currentUserId, receiverId, conversationId, activeConversationId, ideaId]);

  return (
    <div className="flex flex-col h-full bg-background max-w-full">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 -ml-2 hover:bg-muted/50">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold text-sm text-foreground">Conversation</h3>
        </div>
        <div className="flex items-center gap-1">
          {ideaId && activeConversationId && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => window.open(`https://meet.jit.si/InteractiveVenture_${ideaId}`, '_blank')} 
                className="h-8 w-8 hover:bg-muted/50"
                title="Start Video Call"
              >
                <Video className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="h-8 w-8 hover:bg-muted/50">
                <Settings className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mr-2 hover:bg-muted/50">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 p-4 max-w-full overflow-y-auto" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-full overflow-x-auto pb-2">
          {messages === undefined ? (
            receiverId && !conversationId && directConversationId === undefined ? (
              <div className="text-center text-muted-foreground mt-8 text-sm">
                Loading conversation...
              </div>
            ) : receiverId && !conversationId && directConversationId === null ? (
              <div className="text-center text-muted-foreground mt-8 text-sm">
                No messages yet. Start the conversation!
              </div>
            ) : (
              <div className="text-center text-muted-foreground mt-8 text-sm">
                Loading messages...
              </div>
            )
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground mt-8 text-sm">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => {
              const senderUser = users?.find(u => u.id === message.senderId);
              return (
                <MessageBubble
                  key={message._id}
                  message={{
                    id: message._id,
                    text: message.content,
                    sender: {
                      id: message.senderId,
                      name: senderUser?.displayName || "Unknown",
                      avatar: senderUser?.avatar || null,
                    },
                    timestamp: new Date(message.createdAt),
                    isCurrentUser: message.senderId === currentUserId,
                  }}
                />
              );
            })
          )}
        </div>
      </div>
      {sendError && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs border-t">
          {sendError}
        </div>
      )}
      <div className="p-3 border-t bg-card/50 backdrop-blur-sm">
        <ChatInput
          onSend={handleSendMessage}
          typingUsers={[]}
        />
      </div>

      {showSettings && activeConversationId && ideaId && (
        <ChannelSettingsDialog
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          conversationId={activeConversationId}
          ideaId={ideaId}
          onChannelDeleted={onBack}
        />
      )}
    </div>
  );
});

ChatThread.displayName = "ChatThread";

export default ChatThread;