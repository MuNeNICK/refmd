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
  isPublic?: boolean
  onNavigate?: (documentId: string, type?: 'document' | 'scrap') => void
}

// Simple in-memory cache for document metadata and search results
const documentCache = new Map<string, { document: ApiDocument; timestamp: number }>()
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>()
const resolveCache = new Map<string, { id: string | null; type: string; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Debounce search requests to avoid excessive API calls
const pendingSearches = new Map<string, Promise<SearchResult[]>>()
const pendingResolves = new Map<string, Promise<string | null>>()

export function WikiLink({ 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  href: _href, 
  title, 
  children, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  className,
  'data-wiki-target': wikiTarget,
  'data-mention-target': mentionTarget,
  isPublic = false,
  onNavigate,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ...props 
}: WikiLinkProps) {
  const router = useRouter()
  const [isResolving, setIsResolving] = useState(false)
  const [resolvedId, setResolvedId] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState<string>('document')
  const [documentMetadata, setDocumentMetadata] = useState<ApiDocument | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const loadMetadataTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const target = wikiTarget || mentionTarget || title || ''
  
  // Check display variant from children text
  const displayVariant = React.Children.toArray(children).some(child => 
    typeof child === 'string' && child.includes('|inline')
  ) ? 'inline' : 'embed'
  
  // Check if this is a UUID (ID-based link)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isUuid = uuidRegex.test(target)
  const targetId = isUuid ? target : null
  
  // Try to resolve document by title or ID with caching and deduplication
  const resolveDocument = useCallback(async () => {
    if (!target) return null
    
    // Check cache first
    const cacheKey = `${target}:${isUuid ? 'id' : 'title'}`
    const cached = resolveCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setResolvedId(cached.id)
      setDocumentType(cached.type)
      return cached.id
    }
    
    // Check if there's already a pending resolve for this target
    const existing = pendingResolves.get(cacheKey)
    if (existing) {
      const result = await existing
      return result
    }
    
    // Create new resolve promise
    const resolvePromise = (async () => {
      setIsResolving(true)
      try {
        const api = getApiClient();
        
        if (targetId) {
          // Direct ID lookup - we need to fetch document to get type
          try {
            const docResponse = await api.documents.getDocument(targetId)
            if (docResponse) {
              const result = { id: targetId, type: docResponse.type || 'document', timestamp: Date.now() }
              resolveCache.set(cacheKey, result)
              setResolvedId(targetId)
              setDocumentType(docResponse.type || 'document')
              return targetId
            }
          } catch {
            // If document not found, maybe it's a scrap
            try {
              const scrapResponse = await api.scraps.getScrap(targetId)
              if (scrapResponse) {
                const result = { id: targetId, type: 'scrap', timestamp: Date.now() }
                resolveCache.set(cacheKey, result)
                setResolvedId(targetId)
                setDocumentType('scrap')
                return targetId
              }
            } catch {
              // Not found as either type
              console.error('Document/Scrap not found:', targetId)
            }
          }
          const result = { id: null, type: 'document', timestamp: Date.now() }
          resolveCache.set(cacheKey, result)
          return null
        }
        
        // Search for documents by title with caching
        let documents: SearchResult[]
        const searchCached = searchCache.get(target)
        if (searchCached && Date.now() - searchCached.timestamp < CACHE_DURATION) {
          documents = searchCached.results
        } else {
          // Check for pending search
          const pendingSearch = pendingSearches.get(target)
          if (pendingSearch) {
            documents = await pendingSearch
          } else {
            // Create new search promise
            const searchPromise = api.documents.searchDocuments(target)
            pendingSearches.set(target, searchPromise)
            documents = await searchPromise
            searchCache.set(target, { results: documents, timestamp: Date.now() })
            pendingSearches.delete(target)
          }
        }
        
        // Find exact match first
        const exactMatch = documents.find((doc) => 
          doc.title?.toLowerCase() === target.toLowerCase()
        )
        
        if (exactMatch && exactMatch.id) {
          const docType = exactMatch.document_type === SearchResult.document_type.SCRAP ? 'scrap' : 'document'
          const result = { id: exactMatch.id, type: docType, timestamp: Date.now() }
          resolveCache.set(cacheKey, result)
          setResolvedId(exactMatch.id)
          setDocumentType(docType)
          return exactMatch.id
        }
        
        // If no exact match, use the first result
        if (documents.length > 0 && documents[0].id) {
          const docType = documents[0].document_type === SearchResult.document_type.SCRAP ? 'scrap' : 'document'
          const result = { id: documents[0].id, type: docType, timestamp: Date.now() }
          resolveCache.set(cacheKey, result)
          setResolvedId(documents[0].id)
          setDocumentType(docType)
          return documents[0].id
        }
        
        const result = { id: null, type: 'document', timestamp: Date.now() }
        resolveCache.set(cacheKey, result)
        return null
      } catch (error) {
        console.error('Failed to resolve document:', error)
        const result = { id: null, type: 'document', timestamp: Date.now() }
        resolveCache.set(cacheKey, result)
        return null
      } finally {
        setIsResolving(false)
        pendingResolves.delete(cacheKey)
      }
    })()
    
    pendingResolves.set(cacheKey, resolvePromise)
    return resolvePromise
  }, [target, targetId, isUuid])
  
  // Handle click
  const handleClick = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // In public mode, disable navigation
    if (isPublic) {
      e.preventDefault()
      e.stopPropagation()
      toast.info('Document links are not available in public view')
      return
    }
    
    // Check if Ctrl/Cmd key is held
    const openInNewTab = e.ctrlKey || e.metaKey
    
    e.preventDefault()
    e.stopPropagation()
    
    // If onNavigate is provided and not opening in new tab, use it
    if (onNavigate && !openInNewTab) {
      const id = resolvedId || await resolveDocument()
      if (id) {
        const type = documentType === 'scrap' ? 'scrap' : 'document'
        onNavigate(id, type)
      } else {
        toast.error(`Document "${target}" not found`)
      }
      return
    }
    
    // If we already have a resolved ID, navigate directly
    if (resolvedId) {
      // Preserve query parameters (like token) when navigating
      const currentParams = new URLSearchParams(window.location.search)
      const queryString = currentParams.toString()
      const query = queryString ? `?${queryString}` : ''
      
      const path = documentType === 'scrap' ? `/scrap/${resolvedId}` : `/document/${resolvedId}`
      const url = `${path}${query}`
      
      if (openInNewTab) {
        window.open(url, '_blank')
      } else {
        router.push(url)
      }
      return
    }
    
    // Otherwise, try to resolve and navigate
    const id = await resolveDocument()
    if (id) {
      // Preserve query parameters (like token) when navigating
      const currentParams = new URLSearchParams(window.location.search)
      const queryString = currentParams.toString()
      const query = queryString ? `?${queryString}` : ''
      
      const path = documentType === 'scrap' ? `/scrap/${id}` : `/document/${id}`
      const url = `${path}${query}`
      
      if (openInNewTab) {
        window.open(url, '_blank')
      } else {
        router.push(url)
      }
    } else {
      toast.error(`Document "${target}" not found`)
    }
  }, [isPublic, resolvedId, resolveDocument, router, target, documentType, onNavigate])
  
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // Don't resolve in public mode (requires authentication)
    if (isPublic) return
    
    if (!resolvedId && target) {
      resolveDocument()
    }
  }, [isPublic, resolvedId, target, resolveDocument])
  
  // Load metadata immediately when component mounts or resolvedId changes
  useEffect(() => {
    // Don't load metadata in public mode (requires authentication)
    if (isPublic) return
    
    if (resolvedId && !documentMetadata && !isLoadingMetadata) {
      loadDocumentMetadata()
    }
  }, [isPublic, resolvedId, documentMetadata, isLoadingMetadata, loadDocumentMetadata])
  
  const href = isPublic 
    ? '#' // Disable links in public mode
    : resolvedId 
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
  isPublic?: boolean
}

export function DocumentEmbed({ 
  className,
  'data-embed-target': embedTarget,
  children,
  isPublic = false
}: DocumentEmbedProps) {
  const [document, setDocument] = useState<ApiDocument | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!embedTarget) return
    
    // Don't load document in public mode (requires authentication)
    if (isPublic) {
      setError('Document embeds are not available in public view')
      return
    }
    
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
  }, [embedTarget, isPublic])
  
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