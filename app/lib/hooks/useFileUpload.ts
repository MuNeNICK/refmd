"use client";

import { useCallback, useRef } from "react";
import { getApiClient } from '@/lib/api';

interface UseFileUploadProps {
  documentId: string;
  onInsertText: (text: string) => void;
}

export function useFileUpload({ documentId, onInsertText }: UseFileUploadProps) {
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
          document_id: documentId,
        });

        uploadedFiles.push(result.data);
      }
      
      // Insert markdown for uploaded files with relative paths
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
          const imageMarkdown = `![${fileName}](${encodedUrl})\n`;
          onInsertText(imageMarkdown);
        } else if (mimeType === "text/plain" || fileName?.endsWith(".md")) {
          // For text files, we could optionally read and embed content
          const linkMarkdown = `[${fileName}](${encodedUrl})\n`;
          onInsertText(linkMarkdown);
        } else if (mimeType === "application/pdf") {
          const linkMarkdown = `[📄 ${fileName}](${encodedUrl})\n`;
          onInsertText(linkMarkdown);
        } else {
          const linkMarkdown = `[${fileName}](${encodedUrl})\n`;
          onInsertText(linkMarkdown);
        }
      }
      
    } catch (error) {
      console.error('File upload error:', error);
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
  }, [documentId, onInsertText]);

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