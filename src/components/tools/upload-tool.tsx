"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Check, Upload as UploadIcon, FileText, X } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"

interface UploadToolProps {
  prompt: string
  taskId: string
  onSubmit: (content: { fileName: string; storageId: string; fileType: string; fileSize: number }) => void
  initialContent?: { fileName: string; storageId: string }
  isSubmitting?: boolean
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function UploadTool({ prompt, taskId, onSubmit, initialContent, isSubmitting }: UploadToolProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const generateUploadUrl = useMutation(api.ventures.generateUploadUrl)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (selectedFile.size > MAX_FILE_SIZE) {
      alert("File too large. Maximum size is 50MB.")
      return
    }

    setFile(selectedFile)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!file) return

    setUploading(true)
    try {
      const uploadUrl = await generateUploadUrl({})
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })

      if (!result.ok) {
        throw new Error("Upload failed")
      }

      const { storageId } = await result.json()

      onSubmit({
        fileName: file.name,
        storageId,
        fileType: file.type,
        fileSize: file.size,
      })
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload file. Please try again.")
    } finally {
      setUploading(false)
    }
  }, [file, generateUploadUrl, onSubmit])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="h-5 w-5" />
          Upload Evidence (File / Audio / Video)
        </CardTitle>
        <CardDescription>{prompt}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-upload">Choose a file</Label>
          <div className="flex items-center gap-2">
            <Input
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              className="flex-1"
            />
            {file && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFile(null)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{file.name}</span>
              <span>({formatFileSize(file.size)})</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Maximum file size: 50MB. Supported: PDF, DOCX, XLSX, PNG, JPG, MP4, MP3, WAV, WEBM
          </p>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!file || uploading || isSubmitting}
          className="w-full"
        >
          {uploading || isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploading ? "Uploading..." : "Submitting..."}
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Submit File
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
