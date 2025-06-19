'use client';

import React, { useMemo } from 'react';
import { Markdown } from '@/components/markdown/markdown';
import { AuthenticatedImage } from '@/components/markdown/authenticated-image';
import { FileAttachment } from '@/components/markdown/file-attachment';
import { getApiUrl } from '@/lib/config';
import type { Components } from 'react-markdown';

interface ScrapMarkdownProps {
  content: string;
  documentId?: string;
}

export function ScrapMarkdown({ content, documentId }: ScrapMarkdownProps) {
  const apiUrl = getApiUrl();

  const customComponents: Components = useMemo(() => ({
    img: ({ src, alt, width, height, ...props }) => {
      if (!src || typeof src !== 'string') return null;
      
      let imageSrc = src;
      
      // Handle relative attachment paths
      if (imageSrc.startsWith('./attachments/')) {
        const filename = imageSrc.substring(14); // Remove './attachments/'
        const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
        imageSrc = `${apiUrl}/files/documents/${encodedFilename}`;
        if (documentId) {
          imageSrc += `?document_id=${documentId}`;
        }
      } else if (imageSrc.startsWith('./')) {
        // Handle legacy relative paths
        const filename = imageSrc.substring(2);
        const encodedFilename = filename.includes('%') ? filename : encodeURIComponent(filename);
        imageSrc = `${apiUrl}/files/documents/${encodedFilename}`;
        if (documentId) {
          imageSrc += `?document_id=${documentId}`;
        }
      } else if (imageSrc.startsWith('/api/')) {
        // Convert relative API path to absolute URL
        imageSrc = imageSrc.replace('/api/', `${apiUrl}/`);
      }
      
      // Use authenticated image for internal files
      if (imageSrc.includes('/api/files/') || imageSrc.includes('/files/')) {
        return (
          <AuthenticatedImage
            src={imageSrc}
            alt={alt || ""}
            width={typeof width === 'number' ? width : undefined}
            height={typeof height === 'number' ? height : undefined}
            className="max-w-full h-auto rounded-md shadow-md my-2"
            style={{ width: 'auto', height: 'auto' }}
          />
        );
      }
      
      // Use regular img for external images or base64
      return (
        <img
          src={imageSrc}
          alt={alt || ""}
          className="max-w-full h-auto rounded-md shadow-md my-2"
          {...props}
        />
      );
    },
    a: ({ href, children, ...props }) => (
      <FileAttachment href={href || '#'} documentId={documentId} {...props}>
        {children}
      </FileAttachment>
    ),
    p: ({ children, ...props }) => {
      // Check if the paragraph contains only an image to avoid hydration errors
      const childArray = React.Children.toArray(children);
      const hasOnlyImage = childArray.length === 1 && 
        React.isValidElement(childArray[0]) && 
        (childArray[0].type === 'img' || 
         childArray[0].type === AuthenticatedImage ||
         (childArray[0].props && typeof childArray[0].props === 'object' && childArray[0].props !== null && 'src' in childArray[0].props));
      
      if (hasOnlyImage) {
        return <div className="my-2" {...props}>{children}</div>;
      }
      
      return <p {...props}>{children}</p>;
    },
  }), [apiUrl, documentId]);

  return <Markdown content={content} components={customComponents} />;
}