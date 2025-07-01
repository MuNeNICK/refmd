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
import remarkHashtag from '@/lib/remark-hashtag'
import { CodeBlock } from '@/components/markdown/code-block'
import { WikiLink, DocumentEmbed } from '@/components/markdown/wiki-link'
import { generateHeadingId } from '@/lib/utils/heading-id'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  components?: import('react-markdown').Components
  onCheckboxChange?: (lineIndex: number, checked: boolean) => void
  onTagClick?: (tagName: string) => void
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
  remarkMentionLink,
  remarkHashtag
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FULL_REHYPE_PLUGINS: any[] = [
  [rehypeRaw, {
    passThrough: [
      // Preserve custom attributes
      'element.properties.dataTag',
      'element.properties.dataWikiTarget', 
      'element.properties.dataMentionTarget',
      'element.properties.dataEmbedTarget'
    ]
  }],
  rehypeKatex
]
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
const createDefaultComponents = (isPublic?: boolean, onTagClick?: (tagName: string) => void): import('react-markdown').Components => ({
  a({ href, className, children, node, ...props }) {
    // Debug log for all links
    if (href === '#' || className?.includes('hashtag')) {
      console.log('Link debug:', {
        href,
        className,
        children,
        props: Object.keys(props),
        extendedProps: props,
        node,
        nodeData: (node as { data?: unknown })?.data,
        hProperties: (node as { data?: { hProperties?: unknown } })?.data?.hProperties
      })
    }
    
    // Check if this is a wiki link or mention link by URL pattern or data attributes
    const extendedProps = props as Record<string, unknown>
    
    // Check node data for custom properties
    const nodeData = (node as { data?: { hProperties?: Record<string, unknown> } })?.data || {}
    const hProperties = nodeData.hProperties || {}
    
    // First check if this is a hashtag by class or data attributes
    const hasHashtagClass = className?.includes('hashtag')
    const hasDataTag = hProperties['data-tag'] || extendedProps['data-tag'] || extendedProps['dataTag'] || (hProperties as Record<string, unknown>)?.dataTag
    
    // Check if children contains hashtag text
    const childText = typeof children === 'string' ? children : 
                     Array.isArray(children) && children.length > 0 && typeof children[0] === 'string' ? children[0] : ''
    const startsWithHash = childText.startsWith('#')
    
    // Check link types - hashtags first
    const isTagLink = hasHashtagClass || hasDataTag || (href === '#' && startsWithHash) || href?.startsWith('#tag-')
    const isWikiLink = !isTagLink && (href?.startsWith('#wiki:') || extendedProps['data-wiki-target'])
    const isMentionLink = !isTagLink && !isWikiLink && (href?.startsWith('#mention:') || extendedProps['data-mention-target'])
    
    if (isTagLink) {
      // Extract tag name from various sources
      let tagName = ''
      
      // Try to get tag name from data attributes
      if (typeof hasDataTag === 'string' && hasDataTag) {
        tagName = hasDataTag
      }
      // If no data-tag, try to extract from children text
      else if (childText.startsWith('#')) {
        tagName = childText.substring(1)
      }
      
      // Ensure we have a tag name
      if (!tagName) {
        console.warn('Tag link detected but no tag name found', { href, className, children, hProperties, extendedProps })
        return null
      }
      
      // Remove target prop if exists
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { target, ...restProps } = props as Record<string, unknown>;
      
      return (
        <a 
          href={href || '#'} 
          className={cn("hashtag", className)}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (onTagClick && tagName) {
              onTagClick(tagName)
            }
          }}
          {...restProps}
        >
          {children}
        </a>
      )
    }
    
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
    // Prevent # links from opening in new tab
    if (href === '#') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { target, ...restProps } = props as Record<string, unknown>;
      return (
        <a 
          href={href} 
          className={className} 
          onClick={(e) => {
            e.preventDefault()
            console.warn('Unhandled # link clicked', { className, children, props })
          }}
          {...restProps}
        >
          {children}
        </a>
      )
    }
    
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
  code({ className, children, ...props }) {
    // For code blocks, preserve everything and let pre handle it
    const parent = (props as { parent?: { tagName?: string } }).parent;
    const isCodeBlock = parent && parent.tagName === 'pre';
    
    if (isCodeBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }
    
    // For inline code
    return (
      <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
        {children}
      </code>
    )
  },
  pre({ children }) {
    const childrenArray = React.Children.toArray(children);
    
    // Check if we have a code element
    const codeElement = childrenArray.find(
      child => React.isValidElement(child) && 
              child.props &&
              typeof child.props === 'object' &&
              'className' in child.props && 
              'children' in child.props
    );
    
    if (codeElement && React.isValidElement(codeElement)) {
      // Extract language from className
      const className = (codeElement.props as { className?: string }).className || '';
      const match = /language-(\w+)/.exec(className);
      const language = match?.[1];
      
      // Extract the text content
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
  }
})

function MarkdownComponent({ content, components, onCheckboxChange, onTagClick, isPublic }: MarkdownProps) {
  const [renderingMode, setRenderingMode] = useState<'full' | 'safe' | 'minimal'>('full')
  const [hasError, setHasError] = useState(false)
  
  // Memoize content processing to avoid re-sanitizing on every render
  const { sanitizedContent } = useMemo(() => {
    // Ensure content is a plain string
    const safe = typeof content === 'string' ? content : String(content)
    
    // Only remove specifically problematic tags that cause rendering errors
    const sanitized = safe
      .replace(/<\/?anonymous[^>]*>/gi, '') // Remove anonymous tags that cause React errors
    
    // rehype-raw will handle HTML sanitization properly, so we don't need to strip all HTML
    // Only do minimal intervention for known problematic cases
    
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
    const defaultComponents = createDefaultComponents(isPublic, onTagClick)
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
  }, [components, onCheckboxChange, onTagClick, isPublic])
  
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
