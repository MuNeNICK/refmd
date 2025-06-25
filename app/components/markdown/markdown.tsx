'use client'

import React, { useState, useEffect, useMemo, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkEmoji from 'remark-emoji'
import remarkMath from 'remark-math'
import remarkSupersub from 'remark-supersub'
import remarkIns from 'remark-ins'
import remarkDirective from 'remark-directive'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import { remarkAlert } from '@/lib/remark-alert'
import { remarkEmbed } from '@/lib/remark-embed'
import { remarkMark, remarkRuby } from '@/lib/remark-extended'
import { remarkBlockquoteTags } from '@/lib/remark-blockquote-tags'
import { remarkWikiLink, remarkEmbedLink, remarkMentionLink } from '@/lib/remark-wiki-link'
import { CodeBlock } from '@/components/markdown/code-block'
import { WikiLink, DocumentEmbed } from '@/components/markdown/wiki-link'
import { generateHeadingId } from '@/lib/utils/heading-id'

interface MarkdownProps {
  content: string
  components?: import('react-markdown').Components
  onCheckboxChange?: (lineIndex: number, checked: boolean) => void
  isPublic?: boolean
}

// Memoize plugin arrays to prevent recreation on every render
const FULL_REMARK_PLUGINS = [
  remarkGfm, 
  remarkEmoji, 
  remarkMath, 
  remarkSupersub,
  remarkIns,
  remarkMark,
  remarkRuby,
  remarkBlockquoteTags,
  remarkDirective, 
  remarkAlert, 
  remarkEmbed,
  remarkWikiLink,
  remarkEmbedLink,
  remarkMentionLink
]

const FULL_REHYPE_PLUGINS = [rehypeRaw, rehypeKatex]
const SAFE_REHYPE_PLUGINS = [rehypeKatex]
const MINIMAL_REMARK_PLUGINS = [remarkGfm]

// Create heading components with automatic IDs for tocbot
const createHeadingComponent = (level: number) => {
  const HeadingComponent = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => {
    const extractText = (node: React.ReactNode): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (React.isValidElement(node) && (node.props as Record<string, unknown>)?.children) return extractText((node.props as Record<string, unknown>).children as React.ReactNode);
      return '';
    };
    
    const text = extractText(children).trim();
    const id = generateHeadingId(text);
    const Tag = `h${level}` as const;
    
    return React.createElement(Tag, { id, ...props }, children);
  };
  HeadingComponent.displayName = `Heading${level}`;
  return HeadingComponent;
};

// Create components factory function
const createDefaultComponents = (isPublic?: boolean): import('react-markdown').Components => ({
  a({ href, className, children, ...props }) {
    // Check if this is a wiki link or mention link by URL pattern or data attributes
    const extendedProps = props as Record<string, unknown>
    const isWikiLink = href?.startsWith('#wiki:') || extendedProps['data-wiki-target']
    const isMentionLink = href?.startsWith('#mention:') || extendedProps['data-mention-target']
    
    if (isWikiLink || isMentionLink) {
      // Extract target from URL or data attribute
      let target = ''
      if (extendedProps['data-wiki-target']) {
        target = extendedProps['data-wiki-target'] as string
      } else if (extendedProps['data-mention-target']) {
        target = extendedProps['data-mention-target'] as string
      } else if (isWikiLink && href) {
        target = decodeURIComponent(href.replace('#wiki:', ''))
      } else if (isMentionLink && href) {
        target = decodeURIComponent(href.replace('#mention:', ''))
      }
      
      return (
        <WikiLink 
          href={href || '#'} 
          className={className}
          data-wiki-target={isWikiLink ? target : undefined}
          data-mention-target={isMentionLink ? target : undefined}
          isPublic={isPublic}
          {...props}
        >
          {children}
        </WikiLink>
      )
    }
    
    // Regular link
    return (
      <a href={href} className={className} {...props}>
        {children}
      </a>
    )
  },
  div({ className, children, ...props }) {
    // Check if this is a document embed
    if (className?.includes('document-embed')) {
      const extendedProps = props as Record<string, unknown>
      return (
        <DocumentEmbed 
          className={className}
          data-embed-target={extendedProps['data-embed-target'] as string}
          isPublic={isPublic}
          {...props}
        >
          {children}
        </DocumentEmbed>
      )
    }
    
    // Regular div
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  },
  // Add heading components with IDs
  h1: createHeadingComponent(1),
  h2: createHeadingComponent(2),
  h3: createHeadingComponent(3),
  h4: createHeadingComponent(4),
  h5: createHeadingComponent(5),
  h6: createHeadingComponent(6),
  code({ node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    
    // Check if it's an inline code element
    // In react-markdown v8+, inline code is when the parent is not 'pre'
    const isInline = !node || (node.position?.start.line === node.position?.end.line)
    
    // Inline code
    if (isInline) {
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      )
    }
    
    // Code block with or without language
    return (
      <CodeBlock language={match?.[1]} className="not-prose">
        {String(children).replace(/\n$/, '')}
      </CodeBlock>
    )
  },
  pre({ children, ...props }) {
    // If the pre element already contains a CodeBlock component (from the code function above),
    // just return the children without wrapping
    const hasCodeBlock = React.Children.toArray(children).some(
      child => {
        if (!React.isValidElement(child)) return false;
        
        // Check if it's a CodeBlock component
        if (child.type === CodeBlock) return true;
        
        // Check if it has the 'not-prose' className
        const childProps = child.props as { className?: string };
        return childProps.className?.includes('not-prose') ?? false;
      }
    );
    
    if (hasCodeBlock) {
      return <>{children}</>;
    }
    
    // Otherwise, render pre blocks with consistent styling
    return (
      <pre {...props}>
        {children}
      </pre>
    )
  }
})

function MarkdownComponent({ content, components, onCheckboxChange, isPublic }: MarkdownProps) {
  const [renderingMode, setRenderingMode] = useState<'full' | 'safe' | 'minimal'>('full')
  const [hasError, setHasError] = useState(false)
  
  // Memoize content processing to avoid re-sanitizing on every render
  const { sanitizedContent } = useMemo(() => {
    // Ensure content is a plain string
    const safe = typeof content === 'string' ? content : String(content)
    
    // Filter out problematic HTML tags and malformed elements
    let sanitized = safe
      .replace(/<\/?anonymous[^>]*>/gi, '')
      .replace(/<[^>]*>/g, (match) => {
        // Only allow known HTML tags to prevent anonymous tag errors
        const allowedTags = /^<\/?(?:div|span|p|h[1-6]|strong|em|b|i|u|a|img|pre|code|ul|ol|li|blockquote|table|thead|tbody|tr|td|th|br|hr)[^>]*>$/i
        return allowedTags.test(match) ? match : ''
      })
    
    // If content seems problematic, fall back to plain text preview
    if (sanitized.includes('<script') || sanitized.includes('javascript:')) {
      sanitized = safe.replace(/<[^>]*>/g, '') // Strip all HTML
    }
    
    return { sanitizedContent: sanitized }
  }, [content])
  
  // Reset error state when content changes
  useEffect(() => {
    setHasError(false)
    setRenderingMode('full')
  }, [content])
  
  // Error boundary effect
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('anonymous') || event.message.includes('unrecognized')) {
        setHasError(true)
        setRenderingMode('safe')
      }
    }
    
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])
  
  // Create enhanced components
  const enhancedComponents = useMemo(() => {
    const defaultComponents = createDefaultComponents(isPublic)
    return {
      ...defaultComponents,
      ...components,
      // Override input component for interactive checkboxes
      input(props: React.ComponentPropsWithoutRef<'input'> & { node?: unknown }) {
        // Check if this is a checkbox input (task list item)
        if (props.type === 'checkbox') {
          return (
            <input
              {...props}
              className="task-list-checkbox"
              disabled={!onCheckboxChange}
              onChange={(e) => {
                if (onCheckboxChange) {
                  // Find the index of this checkbox by querying all checkboxes
                  const target = e.target as HTMLInputElement
                  const allCheckboxes = Array.from(
                    target.closest('.markdown-preview')?.querySelectorAll('input.task-list-checkbox') || []
                  )
                  const index = allCheckboxes.indexOf(target)
                  
                  if (index !== -1) {
                    onCheckboxChange(index, e.target.checked)
                  }
                }
              }}
            />
          )
        }
        
        // For non-checkbox inputs, delegate to the provided component if any,
        // ensuring we work with both function and class components safely.
        if (components?.input) {
          const InputComponent = components.input as React.ComponentType<
            React.ComponentPropsWithoutRef<'input'> & { node?: unknown }
          >;
          return <InputComponent {...props} />;
        }
        return <input {...props} />
      },
      // Filter out unrecognized tags
      'anonymous': () => null,
    }
  }, [components, onCheckboxChange, isPublic])
  
  // Full rendering with all plugins
  if (renderingMode === 'full' && !hasError) {
    try {
      return (
        <ReactMarkdown 
          remarkPlugins={FULL_REMARK_PLUGINS}
          rehypePlugins={FULL_REHYPE_PLUGINS}
          components={enhancedComponents}
          allowElement={(element, index, parent) => {
            // Prevent div elements inside p elements
            if ('tagName' in element && element.tagName === 'div' && parent && 'tagName' in parent && parent.tagName === 'p') {
              return false;
            }
            return true;
          }}
          unwrapDisallowed={true}
        >
          {sanitizedContent}
        </ReactMarkdown>
      )
    } catch (error) {
      console.error('Full markdown rendering failed:', error)
      setHasError(true)
      setRenderingMode('safe')
    }
  }
  
  // Safe rendering without raw HTML
  if (renderingMode === 'safe' || hasError) {
    try {
      return (
        <ReactMarkdown 
          remarkPlugins={FULL_REMARK_PLUGINS}
          rehypePlugins={SAFE_REHYPE_PLUGINS}
          components={enhancedComponents}
        >
          {sanitizedContent}
        </ReactMarkdown>
      )
    } catch (error) {
      console.error('Safe markdown rendering failed:', error)
      setRenderingMode('minimal')
    }
  }
  
  // Minimal fallback - basic markdown only
  return (
    <ReactMarkdown 
      remarkPlugins={MINIMAL_REMARK_PLUGINS}
      components={components}
    >
      {sanitizedContent}
    </ReactMarkdown>
  )
}

// Export memoized component to prevent unnecessary re-renders
export const Markdown = memo(MarkdownComponent)
