'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getApiClient } from '@/lib/api'
import type { Document as ApiDocument } from '@/lib/api/client/models/Document'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface WikiLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  href: string
  title?: string
  children: React.ReactNode
  className?: string
  'data-wiki-target'?: string
  'data-mention-target'?: string
}

export function WikiLink({ 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  href: _href, 
  title, 
  children, 
  className,
  'data-wiki-target': wikiTarget,
  'data-mention-target': mentionTarget,
  ...props 
}: WikiLinkProps) {
  const router = useRouter()
  const [isResolving, setIsResolving] = useState(false)
  const [resolvedId, setResolvedId] = useState<string | null>(null)
  
  const target = wikiTarget || mentionTarget || title || ''
  
  // Check if this is a UUID (ID-based link)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isUuid = uuidRegex.test(target)
  const targetId = isUuid ? target : null
  
  // Try to resolve document by title or ID
  const resolveDocument = useCallback(async () => {
    if (!target) return
    
    setIsResolving(true)
    try {
      const api = getApiClient();
      
      if (targetId) {
        // Direct ID lookup
        setResolvedId(targetId)
        return targetId
      }
      
      // Search for documents by title
      const response = await api.documents.searchDocuments({ q: target })
      const documents = Array.isArray(response) ? response : (response.data || [])
      
      // Find exact match first
      const exactMatch = documents.find((doc) => 
        doc.title?.toLowerCase() === target.toLowerCase()
      )
      
      if (exactMatch) {
        setResolvedId(exactMatch.id)
        return exactMatch.id
      }
      
      // If no exact match, use the first result
      if (documents.length > 0) {
        setResolvedId(documents[0].id)
        return documents[0].id
      }
      
      return null
    } catch (error) {
      console.error('Failed to resolve document:', error)
      return null
    } finally {
      setIsResolving(false)
    }
  }, [target, targetId])
  
  // Handle click
  const handleClick = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    // If we already have a resolved ID, navigate directly
    if (resolvedId) {
      router.push(`/document/${resolvedId}`)
      return
    }
    
    // Otherwise, try to resolve and navigate
    const id = await resolveDocument()
    if (id) {
      router.push(`/document/${id}`)
    } else {
      toast.error(`Document "${target}" not found`)
    }
  }, [resolvedId, resolveDocument, router, target])
  
  // Resolve on mount if we don't have an ID
  useEffect(() => {
    if (!resolvedId && target) {
      resolveDocument()
    }
  }, [resolvedId, target, resolveDocument])
  
  return (
    <a
      href={resolvedId ? `/document/${resolvedId}` : '#'}
      onClick={handleClick}
      className={cn(
        'text-primary hover:underline cursor-pointer',
        isResolving && 'opacity-50',
        className
      )}
      title={target}
      {...props}
    >
      {children}
    </a>
  )
}

interface DocumentEmbedProps {
  className?: string
  'data-embed-target'?: string
  children: React.ReactNode
}

export function DocumentEmbed({ 
  className,
  'data-embed-target': embedTarget,
  children 
}: DocumentEmbedProps) {
  const [document, setDocument] = useState<ApiDocument | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!embedTarget) return
    
    const loadDocument = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const api = getApiClient();
        
        // Check if this is a UUID (ID-based embed)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const isUuidEmbed = uuidRegex.test(embedTarget)
        const embedId = isUuidEmbed ? embedTarget : null
        
        if (embedId) {
          // Direct ID lookup
          const docResponse = await api.documents.getDocument(embedId)
          setDocument(docResponse.data)
          return
        }
        
        // Search for the document by title
        const response = await api.documents.searchDocuments({ q: embedTarget })
        const documents = response.data
        
        // Find exact match
        const exactMatch = documents.find((doc: ApiDocument) => 
          doc.title?.toLowerCase() === embedTarget.toLowerCase()
        )
        
        if (exactMatch) {
          // Load the full document content
          const docResponse = await api.documents.getDocument(exactMatch.id)
          setDocument(docResponse)
        } else if (documents.length > 0) {
          // Use first match if no exact match
          const docResponse = await api.documents.getDocument(documents[0].id)
          setDocument(docResponse)
        } else {
          setError(`Document "${embedTarget}" not found`)
        }
      } catch (err) {
        console.error('Failed to load embedded document:', err)
        setError('Failed to load document')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadDocument()
  }, [embedTarget])
  
  if (isLoading) {
    return (
      <div className={cn('p-4 border rounded-md bg-muted/50', className)}>
        <div className="text-sm text-muted-foreground">Loading embedded document...</div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={cn('p-4 border rounded-md bg-muted/50', className)}>
        <div className="text-sm text-destructive">{error}</div>
      </div>
    )
  }
  
  if (document) {
    return (
      <div className={cn('p-4 border rounded-md bg-muted/50', className)}>
        <div className="mb-2">
          <Link 
            href={`/document/${document.id}`}
            className="text-lg font-semibold hover:underline"
          >
            {document.title}
          </Link>
        </div>
        <div className="text-sm text-muted-foreground line-clamp-3">
          {document.content}
        </div>
      </div>
    )
  }
  
  return <div className={className}>{children}</div>
}