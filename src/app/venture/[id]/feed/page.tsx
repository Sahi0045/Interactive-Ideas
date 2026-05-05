"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rss, Upload } from "lucide-react";
import { VentureErrorBoundary } from "@/components/venture/error-boundary";
import { Textarea } from "@/components/ui/textarea";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

function StandaloneFeed() {
  const params = useParams();
  const ventureId = params.id as Id<"ventures">;
  const venture = useQuery(api.ventures.getVenture, { ventureId });
  const addComment = useMutation(api.ideas.addComment);
  const generateUploadUrl = useMutation(api.ventures.generateUploadUrl);
  const { toast } = useToast();

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSubmitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venture?.ideaId) return;
    
    // Require either 50 words of text OR a file upload
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    if (wordCount < 50 && !selectedFile) {
      toast({
        title: "Contribution too small",
        description: "Please write at least 50 words or attach a file (Audio, Video, Image, PDF, etc).",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let finalContent = content;

      if (selectedFile) {
        // Handle file upload
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });
        const { storageId } = await result.json();
        
        // In a real app we'd get the actual download URL, here we'll just format a message
        finalContent += `\n\n[Attached File: ${selectedFile.name} (Type: ${selectedFile.type})]`;
      }

      await addComment({
        ideaId: venture.ideaId,
        content: finalContent || `Uploaded a file: ${selectedFile?.name}`,
      });

      setContent("");
      setSelectedFile(null);
      toast({
        title: "Contribution shared!",
        description: "Your post has been added to the project feed.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to post",
        description: "There was an error saving your contribution.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
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
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Rss className="w-5 h-5" />
              Project Feed & Contributions
            </h1>
            <p className="text-sm text-muted-foreground">Share updates, audio, video, or files with the team.</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>New Contribution</CardTitle>
              <CardDescription>Format: Text (50+ words), Audio, Video, Image, File</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitContribution} className="space-y-4">
                <Textarea 
                  placeholder="What's your update? (Min 50 words if no file)" 
                  className="min-h-[150px] resize-none"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
                
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept="audio/*,video/*,image/*,.pdf,.doc,.docx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="file-upload">
                    <Button type="button" variant="outline" className="w-full gap-2" asChild>
                      <span>
                        <Upload className="w-4 h-4" />
                        {selectedFile ? selectedFile.name : "Attach Audio / Video / File"}
                      </span>
                    </Button>
                  </label>
                  
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? "Posting..." : "Post to Feed"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card className="h-full min-h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle>Project Feed</CardTitle>
              <CardDescription>Recent contributions and discussions</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
              {venture?.ideaId ? (
                <div className="p-4 flex-1 overflow-y-auto">
                  <CommentsSection ideaId={venture.ideaId} commentCount={0} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Loading feed...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <VentureErrorBoundary
      title="Failed to load Feed"
      description="We couldn't load the project feed for this venture."
    >
      <StandaloneFeed />
    </VentureErrorBoundary>
  );
}
