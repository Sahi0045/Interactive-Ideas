"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { HeroHeader } from "@/components/header";
import FooterSection from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SkillsMultiSelect } from "@/components/SkillsMultiSelect";
import { IndustriesMultiSelect } from "@/components/IndustriesMultiSelect";
import { useProfileCompletion } from "@/lib/hooks/use-profile-completion";
import { useToast } from "@/components/ui/use-toast";
import CardUpload from "@/components/card-upload";

export default function CreateIdeaPage() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Profile completion check
  const { isComplete: isProfileComplete, isLoading: isProfileLoading } = useProfileCompletion();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    skills: [] as string[],
    industries: [] as string[],
    visibility: 'public' as 'public' | 'private'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");

  // Character counts
  const titleCount = formData.title.length;
  const descriptionCount = formData.description.length;


  // Initialize Convex mutation
  const createIdea = useMutation(api.ideas.createIdea);
  const createVenture = useMutation(api.ventures.createVenture);
  const generateUploadUrl = useMutation(api.ideas.generateUploadUrl);
  const attachFileToIdea = useMutation(api.ideas.attachFileToIdea);

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem("ideaforge-composer-publish") || window.localStorage.getItem("ideaforge-composer-draft");
      if (!rawDraft) return;

      const parsed = JSON.parse(rawDraft);
      setFormData((prev) => ({
        ...prev,
        title: parsed.title || prev.title,
        description: parsed.description || prev.description,
        skills: Array.isArray(parsed.tags) && prev.skills.length === 0 ? parsed.tags.slice(0, 5) : prev.skills,
      }));

      window.sessionStorage.removeItem("ideaforge-composer-publish");
    } catch {
      // Ignore invalid local draft payloads.
    }
  }, []);
  // Validation function
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Idea title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 1200) {
      newErrors.description = 'Description must be 1200 characters or less';
    }

    if (formData.skills.length === 0) {
      newErrors.skills = 'Please select at least one skill';
    }

    if (formData.industries.length === 0) {
      newErrors.industries = 'Please select at least one industry';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form handlers
  const handleInputChange = (field: keyof typeof formData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setErrors({});
    setIsSubmitting(true);

    try {
      const fileCount = selectedFiles.length;
      if (fileCount > 1) {
        setErrors({ attachments: "Maximum 1 file allowed" });
        setIsSubmitting(false);
        return;
      }
      if (fileCount === 1) {
        const f = selectedFiles[0];
        const type = (f.type || "").toLowerCase();
        const allowed = [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "video/mp4",
        ];
        if (!allowed.includes(type)) {
          setErrors({ attachments: "Unsupported file type" });
          setIsSubmitting(false);
          return;
        }
        if (f.size > 50 * 1024 * 1024) {
          setErrors({ attachments: "Total size limit exceeded (50MB)" });
          setIsSubmitting(false);
          return;
        }
        if (type === "video/mp4" && f.size > 25 * 1024 * 1024) {
          setErrors({ attachments: "MP4 files must be 25MB or less" });
          setIsSubmitting(false);
          return;
        }
      }

      const res = await createIdea({
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.skills.join(', '),
        industries: formData.industries.join(', '),
        visibility: formData.visibility,
      });
      const createdIdeaId = res.ideaId;

      // Automatically create the venture for this idea
      await createVenture({
        ideaId: createdIdeaId,
        skills: formData.skills,
        industries: formData.industries,
      });

      if (selectedFiles.length === 1) {
        setUploadError("");
        const file = selectedFiles[0];
        const withRetry = async <T,>(fn: () => Promise<T>, retries = 2, delayMs = 600): Promise<T> => {
          try {
            return await fn();
          } catch (err) {
            if (retries <= 0) throw err;
            await new Promise((r) => setTimeout(r, delayMs));
            return withRetry(fn, retries - 1, delayMs * 1.5);
          }
        };

        try {
          const { uploadUrl } = await withRetry(() => generateUploadUrl({}));
          const uploadResp = await withRetry(() => fetch(uploadUrl, { method: "POST", body: file }));
          if (!uploadResp.ok) {
            throw new Error("Network upload failed");
          }
          const json = await uploadResp.json().catch(() => ({ storageId: undefined }));
          const storageId = json?.storageId as string | undefined;
          if (!storageId) {
            throw new Error("Upload did not return storageId");
          }

          await withRetry(() => attachFileToIdea({
            ideaId: createdIdeaId,
            storageId,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadedAt: Date.now(),
          }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          setUploadError(msg);
        }
      }

      // Success - redirect to suggestions page with skills and industries
      const params = new URLSearchParams();
      if (formData.skills.length > 0) {
        params.set('skills', formData.skills.join(','));
      }
      if (formData.industries.length > 0) {
        params.set('industries', formData.industries.join(','));
      }

      router.push(`/create-idea/suggestions?${params.toString()}`);
    } catch (error) {
      console.error('Failed to create idea:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create idea. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if not authenticated
  React.useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/');
    }
  }, [isLoaded, userId, router]);

  // Show toast if profile is incomplete
  React.useEffect(() => {
    if (isLoaded && userId && !isProfileLoading && !isProfileComplete) {
      toast({
        title: "Complete Your Profile",
        description: "You need a complete profile to create ideas. Missing: display name, avatar, bio (50+ chars), industry, and at least 3 skills.",
        action: <Button size="sm" onClick={() => router.push('/profile-setup')}>Complete Profile</Button>,
        duration: 8000,
      });
      router.push('/profile-setup');
    }
  }, [isLoaded, userId, isProfileComplete, isProfileLoading, toast, router]);

  if (!isLoaded || !userId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <HeroHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </main>
        <FooterSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <HeroHeader />

      <main className="flex-1 container mx-auto px-4 py-6 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Main Card */}
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-2xl text-center">Create New Idea</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Idea Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-sm font-medium">
                    Idea Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter a compelling title"
                    className={`h-9 ${errors.title ? 'border-destructive' : ''}`}
                  />
                  <div className="flex justify-between items-center text-xs">
                    {errors.title ? (
                      <span className="text-destructive">{errors.title}</span>
                    ) : (
                      <span className="text-muted-foreground"></span>
                    )}
                    <span className="text-muted-foreground">{titleCount}/100</span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your idea in detail..."
                    rows={4}
                    className={`resize-none ${errors.description ? 'border-destructive' : ''}`}
                  />
                  <div className="flex justify-between items-center text-xs">
                    {errors.description ? (
                      <span className="text-destructive">{errors.description}</span>
                    ) : (
                      <span className="text-muted-foreground"></span>
                    )}
                    <span className="text-muted-foreground">{descriptionCount}/1200</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Attachment</Label>
                  <CardUpload
                    maxFiles={1}
                    maxSize={50 * 1024 * 1024}
                    accept={"application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/jpg,image/png,image/gif,video/mp4,.pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.gif,.mp4"}
                    multiple={false}
                    onChange={(files) => setSelectedFiles(files)}
                  />
                  {errors.attachments && (
                    <p className="text-xs text-destructive">{errors.attachments}</p>
                  )}
                  {uploadError && (
                    <div className="flex items-center space-x-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                      <AlertCircle className="w-3 h-3 text-destructive" />
                      <p className="text-xs text-destructive">{uploadError}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">Supported: PDF, DOCX, PPTX, XLSX, JPG, PNG, GIF, MP4 (≤25MB)</p>
                </div>

                {/* Skills & Industries Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Skills */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Skills <span className="text-destructive">*</span>
                    </Label>
                    <SkillsMultiSelect
                      selectedSkills={formData.skills}
                      onChange={(skills) => handleInputChange('skills', skills)}
                    />
                    {errors.skills ? (
                      <p className="text-xs text-destructive mt-1">{errors.skills}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Select relevant skills
                      </p>
                    )}
                  </div>

                  {/* Industries */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Industries <span className="text-destructive">*</span>
                    </Label>
                    <IndustriesMultiSelect
                      selectedIndustries={formData.industries}
                      onChange={(industries) => handleInputChange('industries', industries)}
                    />
                    {errors.industries ? (
                      <p className="text-xs text-destructive mt-1">{errors.industries}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Select target industries
                      </p>
                    )}
                  </div>
                </div>

                {/* Visibility & Submit Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pt-2">
                  {/* Visibility */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Visibility <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer border rounded-lg p-2 hover:bg-accent/50 transition-colors flex-1">
                        <input
                          type="radio"
                          name="visibility"
                          value="public"
                          checked={formData.visibility === 'public'}
                          onChange={(e) => handleInputChange('visibility', e.target.value as 'public' | 'private')}
                          className="w-3.5 h-3.5 text-primary border-border focus:ring-ring focus:ring-1"
                        />
                        <div>
                          <div className="font-medium text-xs">Public</div>
                          <div className="text-[10px] text-muted-foreground">Visible to all</div>
                        </div>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer border rounded-lg p-2 hover:bg-accent/50 transition-colors flex-1">
                        <input
                          type="radio"
                          name="visibility"
                          value="private"
                          checked={formData.visibility === 'private'}
                          onChange={(e) => handleInputChange('visibility', e.target.value as 'public' | 'private')}
                          className="w-3.5 h-3.5 text-primary border-border focus:ring-ring focus:ring-1"
                        />
                        <div>
                          <div className="font-medium text-xs">Private</div>
                          <div className="text-[10px] text-muted-foreground">Connections only</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div>
                    {errors.submit && (
                      <div className="flex items-center space-x-2 p-2 mb-2 bg-destructive/10 border border-destructive/20 rounded-md">
                        <AlertCircle className="w-3 h-3 text-destructive" />
                        <p className="text-xs text-destructive">{errors.submit}</p>
                      </div>
                    )}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-10"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Create Idea
                        </>
                      )}
                    </Button>
                  </div>
                </div>

              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}


