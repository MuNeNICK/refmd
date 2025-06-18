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
import { CodeBlock } from '@/components/markdown/code-block'

interface MarkdownProps {
  content: string
  components?: import('react-markdown').Components
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
  remarkEmbed
]

const FULL_REHYPE_PLUGINS = [rehypeRaw, rehypeKatex]
const SAFE_REHYPE_PLUGINS = [rehypeKatex]
const MINIMAL_REMARK_PLUGINS = [remarkGfm]

// Default components with code highlighting
const DEFAULT_COMPONENTS: import('react-markdown').Components = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    
    // Code block with or without language
    if (!inline) {
      return (
        <CodeBlock language={match?.[1]} className="not-prose">
          {String(children).replace(/\n$/, '')}
        </CodeBlock>
      )
    }
    
    // Inline code
    return (
      <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
        {children}
      </code>
    )
  },
  pre({ children, ...props }) {
    // If the pre element already contains a CodeBlock component (from the code function above),
    // just return the children without wrapping
    const hasCodeBlock = React.Children.toArray(children).some(
      child => React.isValidElement(child) && (child.type === CodeBlock || child.props?.className?.includes('not-prose'))
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
}

function MarkdownComponent({ content, components }: MarkdownProps) {
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
  
  // Memoize enhanced components to prevent recreation
  const enhancedComponents = useMemo(() => ({
    ...DEFAULT_COMPONENTS,
    ...components,
    // Filter out unrecognized tags
    'anonymous': () => null,
  }), [components])
  
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