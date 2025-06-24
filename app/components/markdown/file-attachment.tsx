"use client";

import React, { useState } from 'react';
import { Download, FileText, Image, FileIcon, Film, Music, Archive, Code } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { AuthenticatedAudio } from './authenticated-audio';
import { AuthenticatedVideo } from './authenticated-video';
import { AuthenticatedPdf } from './authenticated-pdf';

interface FileAttachmentProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  documentId?: string;
  token?: string;
}

// Get file extension from URL or filename
const getFileExtension = (urlOrFilename: string): string => {
  let filename: string;
  
  // If it looks like a URL, extract the filename
  if (urlOrFilename.includes('/')) {
    const path = urlOrFilename.split('?')[0]; // Remove query parameters
    const segments = path.split('/');
    filename = segments[segments.length - 1];
    
    // Try to decode if it's URL encoded
    try {
      filename = decodeURIComponent(filename);
    } catch {
      // If decoding fails, use the original
    }
  } else {
    // It's already a filename
    filename = urlOrFilename;
  }
  
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

// Get file name from URL
const getFileName = (url: string): string => {
  const path = url.split('?')[0];
  const segments = path.split('/');
  const filename = segments[segments.length - 1];
  // Decode URI component to handle special characters
  try {
    return decodeURIComponent(filename);
  } catch {
    // If decoding fails, return the original filename
    return filename;
  }
};

// Get appropriate icon for file type
const getFileIcon = (extension: string) => {
  const iconProps = { className: "h-4 w-4" };
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image {...iconProps} className="h-4 w-4 text-green-600" />;
  }
  
  // Documents
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
    return <FileText {...iconProps} className="h-4 w-4 text-red-600" />;
  }
  
  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml', 'md', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'swift'].includes(extension)) {
    return <Code {...iconProps} className="h-4 w-4 text-blue-600" />;
  }
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
    return <Archive {...iconProps} className="h-4 w-4 text-purple-600" />;
  }
  
  // Video
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
    return <Film {...iconProps} className="h-4 w-4 text-orange-600" />;
  }
  
  // Audio
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(extension)) {
    return <Music {...iconProps} className="h-4 w-4 text-pink-600" />;
  }
  
  // Default
  return <FileIcon {...iconProps} className="h-4 w-4 text-gray-600" />;
};


export function FileAttachment({ href, children, className, documentId, token }: FileAttachmentProps) {
  const [showPreview, setShowPreview] = useState(false);
  
  // Convert relative paths to API paths for file links
  let processedHref = href;
  const apiBaseUrl = getApiUrl();
  
  if (href.startsWith('./attachments/')) {
    // Handle new relative path format: ./attachments/{filename}
    const filename = href.substring(14); // Remove './attachments/'
    // Only encode if not already encoded (doesn't contain %)
    const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
    // Use the documents endpoint with filename
    processedHref = `${apiBaseUrl}/files/documents/${encodedFilename}`;
    if (documentId) {
      processedHref += `?document_id=${documentId}`;
    }
  } else if (href.startsWith('./')) {
    // Handle legacy relative paths
    const filename = href.substring(2);
    // Only encode if not already encoded (doesn't contain %)
    const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
    processedHref = `${apiBaseUrl}/files/documents/${encodedFilename}`;
    if (documentId) {
      processedHref += `?document_id=${documentId}`;
    }
  } else if (href.startsWith('/api/')) {
    // Convert relative API path to absolute URL
    processedHref = href.replace('/api/', `${apiBaseUrl}/`);
  }
  
  // For display purposes, get filename from original href if it's a relative path
  let displayFileName: string;
  if (href.startsWith('./attachments/')) {
    // Extract filename from ./attachments/{filename} format
    const rawFileName = href.substring(14); // Remove './attachments/'
    try {
      displayFileName = decodeURIComponent(rawFileName);
    } catch {
      displayFileName = rawFileName;
    }
  } else if (href.startsWith('./')) {
    const rawFileName = href.substring(2); // Remove './' prefix
    // Try to decode the filename if it's URL encoded
    try {
      displayFileName = decodeURIComponent(rawFileName);
    } catch {
      displayFileName = rawFileName;
    }
  } else {
    displayFileName = getFileName(processedHref);
  }
  
  // Get extension from the display filename (not the encoded URL)
  const extension = getFileExtension(displayFileName);
  const fileIcon = getFileIcon(extension);

  // Check if this is an internal file link
  // Check both absolute URLs and relative paths
  const isFileLink = processedHref.includes('/files/') || href.startsWith('./attachments/');

  // If it's not a file link, render as regular link
  if (!isFileLink) {
    return (
      <a 
        href={processedHref} 
        className={cn("text-primary hover:underline", className)} 
        target="_blank" 
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  
  // Check if this is a previewable media file
  const isAudio = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(extension);
  const isVideo = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension);
  const isPdf = extension === 'pdf';
  const isPreviewable = isAudio || isVideo || isPdf;

  return (
    <div className={cn("w-full", className)}>
      <span className={cn(
        "flex items-center gap-2 px-4 py-3 border rounded-md bg-card hover:bg-accent/50 transition-colors group file-attachment w-full",
        isPreviewable && "cursor-pointer"
      )}
      onClick={() => {
        if (isPreviewable) {
          setShowPreview(!showPreview);
        }
      }}
      >
        <span className="flex-shrink-0">
          {fileIcon}
        </span>
        
        <span className="text-sm font-medium text-foreground flex-1" title={displayFileName}>
          {displayFileName}
        </span>
        
        {extension && (
          <Badge variant="secondary" className="text-xs">
            {extension.toUpperCase()}
          </Badge>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              // Get auth token
              const { getTokens } = await import('@/lib/api');
              const { accessToken } = getTokens();
              
              // If there's a share token, append it to the URL
              let fetchUrl = processedHref;
              if (token) {
                const separator = processedHref.includes('?') ? '&' : '?';
                fetchUrl = `${processedHref}${separator}token=${token}`;
              }
              
              // Fetch file with authentication
              const response = await fetch(fetchUrl, {
                headers: accessToken ? {
                  'Authorization': `Bearer ${accessToken}`
                } : {}
              });
              
              if (!response.ok) {
                throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
              }
              
              // Get the blob and create download link
              const blob = await response.blob();
              
              // For some file types, we need to force the correct MIME type
              let finalBlob = blob;
              if (blob.size > 0) {
                // Check if we need to override the MIME type based on file extension
                const ext = displayFileName.split('.').pop()?.toLowerCase();
                let mimeType = blob.type;
                
                // Override MIME type for known problematic types
                if (ext === 'xlsx' && (!mimeType || mimeType === 'application/octet-stream')) {
                  mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                } else if (ext === 'pdf' && (!mimeType || mimeType === 'application/octet-stream')) {
                  mimeType = 'application/pdf';
                } else if (ext === 'docx' && (!mimeType || mimeType === 'application/octet-stream')) {
                  mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                }
                
                // Create a new blob with the correct MIME type if needed
                if (mimeType !== blob.type) {
                  finalBlob = new Blob([blob], { type: mimeType });
                }
              }
              
              const url = window.URL.createObjectURL(finalBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = displayFileName;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (error) {
              console.error('Download failed:', error);
              // Show user-friendly error message
              alert(`Failed to download ${displayFileName}. Please check the console for details.`);
            }
          }}
          title="Download file"
          className="h-8 w-8 ml-auto opacity-60 hover:opacity-100"
        >
          <Download className="h-3 w-3" />
        </Button>
      </span>
      
      {/* Preview section for audio/video/pdf files */}
      {showPreview && isPreviewable && (
        <div className="mt-3 p-4 border rounded-md bg-background">
          {isAudio && (
            <AuthenticatedAudio
              src={href}
              documentId={documentId}
              token={token}
              className="w-full"
            />
          )}
          {isVideo && (
            <AuthenticatedVideo
              src={href}
              documentId={documentId}
              token={token}
              className="w-full"
            />
          )}
          {isPdf && (
            <AuthenticatedPdf
              src={href}
              documentId={documentId}
              token={token}
              className="w-full"
            />
          )}
        </div>
      )}
    </div>
  );
}