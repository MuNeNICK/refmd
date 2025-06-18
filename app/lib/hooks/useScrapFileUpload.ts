"use client";

import { useCallback, useRef } from "react";
import { getApiClient } from '@/lib/api';
import { toast } from "sonner";

interface UseScrapFileUploadProps {
  documentId?: string; // Optional document ID for scrap-associated files
  onInsertText: (text: string) => void;
  getCursorPosition: () => number;
}

export function useScrapFileUpload({ documentId, onInsertText, getCursorPosition }: UseScrapFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: File[]) => {
    try {
      const uploadedFiles = [];
      const api = getApiClient();
      
      // Upload files one by one since the API expects single file
      for (const file of files) {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File "${file.name}" exceeds 10MB`);
          continue;
        }

        // Upload file to server
        const result = await api.files.uploadFile({
          file,
          document_id: documentId || undefined,
        });

        uploadedFiles.push(result.data);
      }
      
      // Build markdown for all uploaded files
      const markdownParts: string[] = [];
      
      for (const uploadedFile of uploadedFiles) {
        // Use the URL from the response
        const fileUrl = uploadedFile?.url;
        const fileName = uploadedFile?.filename;
        const mimeType = uploadedFile?.mime_type;
        
        // Encode the filename part of the URL to handle spaces and special characters
        const encodedUrl = fileUrl?.startsWith('./attachments/') 
          ? `./attachments/${encodeURIComponent(fileUrl.substring(14))}`
          : fileUrl;
        
        if (mimeType?.startsWith("image/")) {
          markdownParts.push(`![${fileName}](${encodedUrl})`);
        } else if (mimeType === "text/plain" || fileName?.endsWith(".md")) {
          markdownParts.push(`[${fileName}](${encodedUrl})`);
        } else if (mimeType === "application/pdf") {
          markdownParts.push(`[📄 ${fileName}](${encodedUrl})`);
        } else {
          markdownParts.push(`[${fileName}](${encodedUrl})`);
        }
      }
      
      // Insert all markdown at once with proper spacing
      if (markdownParts.length > 0) {
        const cursorPos = getCursorPosition();
        const markdown = markdownParts.join('\n') + '\n';
        onInsertText(markdown);
      }
      
      if (uploadedFiles.length > 0) {
        toast.success(`Uploaded ${uploadedFiles.length} files`);
      }
      
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Failed to upload files');
      
      // Fallback to base64 for images if server upload fails
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            const imageMarkdown = `![${file.name}](${base64})\n`;
            onInsertText(imageMarkdown);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, [documentId, onInsertText, getCursorPosition]);

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files);
      e.target.value = ''; // Reset input
    }
  }, [handleFileUpload]);

  return {
    handleFileUpload,
    triggerFileUpload,
    fileInputRef,
    fileInputProps: {
      type: 'file' as const,
      multiple: true,
      accept: 'image/*,.pdf,.txt,.md',
      style: { display: 'none' },
      onChange: handleFileInputChange,
    },
  };
}