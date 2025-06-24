'use client'

import React, { useCallback, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getApiClient } from '@/lib/api'
import type { Document as ApiDocument } from '@/lib/api/client/models/Document'
import { SearchResult } from '@/lib/api/client/models/SearchResult'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DocumentLinkCard } from './document-link-card'
import { Loader2 } from 'lucide-react'

interface WikiLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  href: string
  title?: string
  children: React.ReactNode
  className?: string
  'data-wiki-target'?: string
  'data-mention-target'?: string
}

// Simple in-memory cache for document metadata
const documentCache = new Map<string, { document: ApiDocument; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

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
  const [documentType, setDocumentType] = useState<string>('document')
  const [documentMetadata, setDocumentMetadata] = useState<ApiDocument | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const loadMetadataTimeoutRef = useRef<NodeJS.Timeout>()
  
  const target = wikiTarget || mentionTarget || title || ''
  
  // Check display variant from children text
  const displayVariant = React.Children.toArray(children).some(child => 
    typeof child === 'string' && child.includes('|inline')
  ) ? 'inline' : 'embed'
  
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
        // Direct ID lookup - we need to fetch document to get type
        try {
          const docResponse = await api.documents.getDocument(targetId)
          if (docResponse) {
            setResolvedId(targetId)
            setDocumentType(docResponse.type || 'document')
            return targetId
          }
        } catch {
          // If document not found, maybe it's a scrap
          try {
            const scrapResponse = await api.scraps.getScrap(targetId)
            if (scrapResponse) {
              setResolvedId(targetId)
              setDocumentType('scrap')
              return targetId
            }
          } catch {
            // Not found as either type
            console.error('Document/Scrap not found:', targetId)
          }
        }
        return null
      }
      
      // Search for documents by title
      const documents = await api.documents.searchDocuments(target)
      
      // Find exact match first
      const exactMatch = documents.find((doc) => 
        doc.title?.toLowerCase() === target.toLowerCase()
      )
      
      if (exactMatch && exactMatch.id) {
        setResolvedId(exactMatch.id)
        setDocumentType(exactMatch.document_type === SearchResult.document_type.SCRAP ? 'scrap' : 'document')
        return exactMatch.id
      }
      
      // If no exact match, use the first result
      if (documents.length > 0 && documents[0].id) {
        setResolvedId(documents[0].id)
        setDocumentType(documents[0].document_type === SearchResult.document_type.SCRAP ? 'scrap' : 'document')
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
      const path = documentType === 'scrap' ? `/scrap/${resolvedId}` : `/document/${resolvedId}`
      router.push(path)
      return
    }
    
    // Otherwise, try to resolve and navigate
    const id = await resolveDocument()
    if (id) {
      const path = documentType === 'scrap' ? `/scrap/${id}` : `/document/${id}`
      router.push(path)
    } else {
      toast.error(`Document "${target}" not found`)
    }
  }, [resolvedId, resolveDocument, router, target, documentType])
  
  // Load document metadata for preview
  const loadDocumentMetadata = useCallback(async () => {
    if (!resolvedId || documentMetadata) return
    
    // Check cache first
    const cached = documentCache.get(resolvedId)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setDocumentMetadata(cached.document)
      return
    }
    
    setIsLoadingMetadata(true)
    try {
      const api = getApiClient()
      const doc = await api.documents.getDocument(resolvedId)
      
      // Update cache
      documentCache.set(resolvedId, {
        document: doc,
        timestamp: Date.now()
      })
      
      setDocumentMetadata(doc)
    } catch (error) {
      console.error('Failed to load document metadata:', error)
    } finally {
      setIsLoadingMetadata(false)
    }
  }, [resolvedId, documentMetadata])

  // Handle tooltip open state
  const handleTooltipOpenChange = useCallback((open: boolean) => {
    setIsTooltipOpen(open)
    
    if (open && resolvedId && !documentMetadata && !isLoadingMetadata) {
      // Delay loading slightly to avoid loading on quick hovers
      loadMetadataTimeoutRef.current = setTimeout(() => {
        loadDocumentMetadata()
      }, 300)
    } else if (!open && loadMetadataTimeoutRef.current) {
      clearTimeout(loadMetadataTimeoutRef.current)
    }
  }, [resolvedId, documentMetadata, isLoadingMetadata, loadDocumentMetadata])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadMetadataTimeoutRef.current) {
        clearTimeout(loadMetadataTimeoutRef.current)
      }
    }
  }, [])

  // Resolve on mount if we don't have an ID
  useEffect(() => {
    if (!resolvedId && target) {
      resolveDocument()
    }
  }, [resolvedId, target, resolveDocument])
  
  // Load metadata immediately when component mounts or resolvedId changes
  useEffect(() => {
    if (resolvedId && !documentMetadata && !isLoadingMetadata) {
      loadDocumentMetadata()
    }
  }, [resolvedId, documentMetadata, isLoadingMetadata, loadDocumentMetadata])
  
  const href = resolvedId 
    ? (documentType === 'scrap' ? `/scrap/${resolvedId}` : `/document/${resolvedId}`)
    : '#'
  
  // Show loading state while resolving
  if (isResolving || (resolvedId && isLoadingMetadata)) {
    return (
      <span className={cn(
        "inline-flex items-center gap-2",
        displayVariant === 'inline' ? "px-3 py-1.5 text-sm" : "p-4",
        "border rounded-md bg-card"
      )}>
        <Loader2 className={cn(
          "animate-spin",
          displayVariant === 'inline' ? "h-3 w-3" : "h-4 w-4"
        )} />
        <span className={displayVariant === 'inline' ? "text-sm" : ""}>Loading...</span>
      </span>
    )
  }
  
  // Show error if resolution failed
  if (!resolvedId && !isResolving) {
    return (
      <span className={cn(
        "inline-flex items-center gap-2",
        displayVariant === 'inline' ? "px-3 py-1.5 text-sm" : "p-4",
        "border rounded-md bg-muted/50 text-muted-foreground"
      )}>
        {children || target}
      </span>
    )
  }
  
  // Show document card when we have metadata
  if (resolvedId && documentMetadata) {
    return (
      <Link 
        href={href}
        className={cn(
          "no-underline",
          displayVariant === 'inline' ? "inline-block align-baseline" : "block"
        )}
      >
        <DocumentLinkCard 
          document={documentMetadata} 
          variant={displayVariant}
          className="cursor-pointer"
        />
      </Link>
    )
  }
  
  // Fallback while metadata is loading
  return (
    <Link 
      href={href}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2",
        displayVariant === 'inline' ? "px-3 py-1.5 text-sm" : "p-4",
        "border rounded-md bg-card hover:bg-accent/50 transition-colors no-underline"
      )}
    >
      <span className="text-foreground">{children || target}</span>
    </Link>
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
          setDocument(docResponse)
          return
        }
        
        // Search for the document by title
        const documents = await api.documents.searchDocuments(embedTarget)
        
        // Find exact match
        const exactMatch = documents.find((doc) => 
          doc.title?.toLowerCase() === embedTarget.toLowerCase()
        )
        
        if (exactMatch && exactMatch.id) {
          // Load the full document content
          const docResponse = await api.documents.getDocument(exactMatch.id)
          setDocument(docResponse)
        } else if (documents.length > 0 && documents[0].id) {
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
      <Link 
        href={document.type === 'scrap' ? `/scrap/${document.id}` : `/document/${document.id}`}
        className="block no-underline"
      >
        <DocumentLinkCard 
          document={document} 
          variant="embed"
          className={cn('hover:shadow-xl transition-shadow cursor-pointer', className)} 
        />
      </Link>
    )
  }
  
  return <div className={className}>{children}</div>
}