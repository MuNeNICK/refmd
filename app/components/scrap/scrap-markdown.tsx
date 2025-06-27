'use client';

import React, { useMemo } from 'react';
import { Markdown } from '@/components/markdown/markdown';
import { AuthenticatedImage } from '@/components/markdown/authenticated-image';
import { FileAttachment } from '@/components/markdown/file-attachment';
import { WikiLink } from '@/components/markdown/wiki-link';
import { getApiUrl } from '@/lib/config';
import type { Components } from 'react-markdown';

interface ScrapMarkdownProps {
  content: string;
  documentId?: string;
  onNavigate?: (documentId: string, type?: 'document' | 'scrap') => void;
}

export function ScrapMarkdown({ content, documentId, onNavigate }: ScrapMarkdownProps) {
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={alt || ""}
          className="max-w-full h-auto rounded-md shadow-md my-2"
          {...props}
        />
      );
    },
    a: ({ href, children, className, ...props }) => {
      // Check if this is a wiki link or mention link
      const extendedProps = props as Record<string, unknown>;
      const isWikiLink = href?.startsWith('#wiki:') || extendedProps['data-wiki-target'];
      const isMentionLink = href?.startsWith('#mention:') || extendedProps['data-mention-target'];
      
      if (isWikiLink || isMentionLink) {
        // Extract target from URL or data attribute
        let target = '';
        if (extendedProps['data-wiki-target']) {
          target = extendedProps['data-wiki-target'] as string;
        } else if (extendedProps['data-mention-target']) {
          target = extendedProps['data-mention-target'] as string;
        } else if (isWikiLink && href) {
          target = decodeURIComponent(href.replace('#wiki:', ''));
        } else if (isMentionLink && href) {
          target = decodeURIComponent(href.replace('#mention:', ''));
        }
        
        return (
          <WikiLink 
            href={href || '#'} 
            className={className}
            data-wiki-target={isWikiLink ? target : undefined}
            data-mention-target={isMentionLink ? target : undefined}
            onNavigate={onNavigate}
            {...props}
          >
            {children}
          </WikiLink>
        );
      }
      
      // For other links, use FileAttachment
      return (
        <FileAttachment href={href || '#'} documentId={documentId} {...props}>
          {children}
        </FileAttachment>
      );
    },
    p: ({ children, ...props }) => {
      // Check if the paragraph contains only an image or file attachment to avoid hydration errors
      const childArray = React.Children.toArray(children);
      const hasOnlyImageOrFile = childArray.length === 1 && 
        React.isValidElement(childArray[0]) && 
        (childArray[0].type === 'img' || 
         childArray[0].type === AuthenticatedImage ||
         childArray[0].type === FileAttachment ||
         (childArray[0].props && typeof childArray[0].props === 'object' && childArray[0].props !== null && 
          ('src' in childArray[0].props || 'href' in childArray[0].props)));
      
      if (hasOnlyImageOrFile) {
        return <div className="my-2" {...props}>{children}</div>;
      }
      
      return <p {...props}>{children}</p>;
    },
  }), [apiUrl, documentId, onNavigate]);

  return <Markdown content={content} components={customComponents} />;
}