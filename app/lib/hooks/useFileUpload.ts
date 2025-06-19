"use client";

import { useCallback, useRef } from "react";
import { getApiClient } from '@/lib/api';
import { toast } from "sonner";

interface UseFileUploadProps {
  documentId?: string; // Optional for scrap posts
  onInsertText: (text: string) => void;
  insertMode?: 'batch' | 'individual'; // Batch for scraps, individual for documents
}

export function useFileUpload({ 
  documentId, 
  onInsertText, 
  insertMode = 'individual'
}: UseFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: File[]) => {
    try {
      const uploadedFiles = [];
      const api = getApiClient();
      
      // Upload files one by one since the API expects single file
      for (const file of files) {
        // Upload file to server
        const result = await api.files.uploadFile({
          file,
          document_id: documentId || undefined,
        });

        uploadedFiles.push(result.data);
      }
      
      if (insertMode === 'batch') {
        // Build markdown for all uploaded files and insert as batch (for scraps)
        const markdownParts: string[] = [];
        
        for (const uploadedFile of uploadedFiles) {
          const fileUrl = uploadedFile?.url;
          const fileName = uploadedFile?.filename;
          const mimeType = uploadedFile?.mime_type;
          
          // Encode the filename part of the URL to handle spaces and special characters
          const encodedUrl = fileUrl?.startsWith('./attachments/') 
            ? `./attachments/${encodeURIComponent(fileUrl.substring(14))}`
            : fileUrl;
          
          if (mimeType?.startsWith("image/")) {
            markdownParts.push(`![${fileName}](${encodedUrl})`);
          } else {
            markdownParts.push(`[${fileName}](${encodedUrl})`);
          }
        }
        
        // Insert all markdown at once with proper spacing
        if (markdownParts.length > 0) {
          const markdown = markdownParts.join('\n') + '\n';
          onInsertText(markdown);
        }
      } else {
        // Insert markdown for uploaded files individually (for documents)
        for (const uploadedFile of uploadedFiles) {
          const fileUrl = uploadedFile?.url;
          const fileName = uploadedFile?.filename;
          const mimeType = uploadedFile?.mime_type;
          
          // Encode the filename part of the URL to handle spaces and special characters
          const encodedUrl = fileUrl?.startsWith('./attachments/') 
            ? `./attachments/${encodeURIComponent(fileUrl.substring(14))}`
            : fileUrl;
          
          if (mimeType?.startsWith("image/")) {
            const imageMarkdown = `![${fileName}](${encodedUrl})\n`;
            onInsertText(imageMarkdown);
          } else {
            const linkMarkdown = `[${fileName}](${encodedUrl})\n`;
            onInsertText(linkMarkdown);
          }
        }
      }
      
      if (uploadedFiles.length > 0) {
        toast.success(`Uploaded ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}`);
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
  }, [documentId, onInsertText, insertMode]);

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
      accept: '*/*',
      style: { display: 'none' },
      onChange: handleFileInputChange,
    },
  };
}