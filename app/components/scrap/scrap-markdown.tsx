'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import rehypeRaw from 'rehype-raw';
import { AuthenticatedImage } from '@/components/markdown/authenticated-image';
import { FileAttachment } from '@/components/markdown/file-attachment';
import { WikiLink } from '@/components/markdown/wiki-link';
import { CodeBlock } from '@/components/markdown/code-block';
import { getApiUrl } from '@/lib/config';
import remarkHashtag from '@/lib/remark-hashtag';
import { remarkWikiLink, remarkEmbedLink, remarkMentionLink } from '@/lib/remark-wiki-link';
import type { Components } from 'react-markdown';

interface ScrapMarkdownProps {
  content: string;
  documentId?: string;
  onNavigate?: (documentId: string, type?: 'document' | 'scrap') => void;
  onTagClick?: (tag: string) => void;
}

export function ScrapMarkdown({ content, documentId, onNavigate, onTagClick }: ScrapMarkdownProps) {
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
    // Code block rendering
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      
      if (isInline) {
        return (
          <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
            {children}
          </code>
        );
      }
      
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children }) {
      const childrenArray = React.Children.toArray(children);
      // Check if we have a code element
      // Note: When custom components are provided, child.type will be the component function,
      // not the string 'code'. We need to check the props for className pattern.
      const codeElement = childrenArray.find(
        child => React.isValidElement(child) && 
                (child.type === 'code' || 
                 (child.props as Record<string, unknown>)?.mdxType === 'code' ||
                 typeof (child.props as { className?: unknown })?.className === 'string')
      );
      
      if (codeElement && React.isValidElement(codeElement)) {
        const className = (codeElement.props as { className?: string }).className || '';
        const match = /language-(\w+)/.exec(className);
        const language = match?.[1];
        const codeContent = String((codeElement.props as { children?: React.ReactNode }).children).replace(/\n$/, '');
        
        return (
          <CodeBlock language={language} className="not-prose">
            {codeContent}
          </CodeBlock>
        );
      }
      
      // For pre elements without code element (happens when ``` has no language)
      // Extract all text content including nested elements
      const extractText = (node: React.ReactNode): string => {
        if (typeof node === 'string') return node;
        if (React.isValidElement(node) && node.props && typeof node.props === 'object' && 'children' in node.props) {
          return String((node.props as { children?: React.ReactNode }).children);
        }
        return '';
      };
      
      const textContent = childrenArray
        .map(child => extractText(child))
        .join('')
        .replace(/\n$/, '');
      
      // Render as CodeBlock without language for consistent styling
      return (
        <CodeBlock language={undefined} className="not-prose">
          {textContent}
        </CodeBlock>
      );
    },
    // Handle all link types: hashtags, wiki links, and regular links
    a: ({ href, className, children, ...props }) => {
      const extendedProps = props as Record<string, unknown>;
      
      // Check if this is a hashtag link
      if ((href === '#' && extendedProps['data-tag']) || className?.includes('hashtag')) {
        const tagName = extendedProps['data-tag'] as string || '';
        return (
          <a 
            href={href} 
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors no-underline"
            onClick={(e) => {
              if (onTagClick) {
                e.preventDefault();
                onTagClick(tagName);
              }
              // If no onTagClick handler, let the default link behavior work
            }}
            {...props}
          >
            {children}
          </a>
        );
      }
      
      // Check if this is a wiki link or mention link
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
  }), [apiUrl, documentId, onNavigate, onTagClick]);

  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm, remarkEmoji, remarkHashtag, remarkWikiLink, remarkEmbedLink, remarkMentionLink]}
      rehypePlugins={[rehypeRaw]}
      components={customComponents}
    >
      {content}
    </ReactMarkdown>
  );
}