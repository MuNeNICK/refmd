'use client'

import React, { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api'
import { Document } from '@/lib/api/client/models/Document'
import { ScrapWithPosts } from '@/lib/api/client/models/ScrapWithPosts'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PreviewPane } from '@/components/editor/preview-pane'
import { ScrapContentView } from '@/components/scrap/scrap-content-view'

interface SecondaryViewerProps {
  documentId: string | null
  documentType?: 'document' | 'scrap'
  className?: string
  onClose?: () => void
  onDocumentChange?: (documentId: string, type?: 'document' | 'scrap') => void
}

export function SecondaryViewer({ 
  documentId, 
  documentType = 'document',
  className, 
  onClose,
  onDocumentChange 
}: SecondaryViewerProps) {
  const [, setDocument] = useState<Document | null>(null)
  const [scrapData, setScrapData] = useState<ScrapWithPosts | null>(null)
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentType, setCurrentType] = useState<'document' | 'scrap'>(documentType)
  
  // Update currentType when documentType prop changes
  useEffect(() => {
    setCurrentType(documentType)
  }, [documentType])

  useEffect(() => {
    const loadContent = async () => {
      if (!documentId) {
        setDocument(null)
        setScrapData(null)
        setContent('')
        return
      }
      
      setIsLoading(true)
      setError(null)
      
      try {
        const api = getApiClient()
        
        if (documentType === 'scrap') {
          // Load as scrap with posts
          const data = await api.scraps.getScrap(documentId)
          setScrapData(data)
          setDocument(null)
          setContent('')
          setCurrentType('scrap')
        } else {
          // Load as document
          try {
            const doc = await api.documents.getDocument(documentId)
            setDocument(doc)
            setScrapData(null)
            
            // Load document content
            const contentResponse = await api.documents.getDocumentContent(documentId)
            setContent(contentResponse || '')
            setCurrentType('document')
          } catch (docError) {
            // If document fails and type wasn't explicitly set, try as scrap
            if (documentType === 'document') {
              try {
                const data = await api.scraps.getScrap(documentId)
                setScrapData(data)
                setDocument(null)
                setContent('')
                setCurrentType('scrap')
              } catch {
                throw docError // Throw original error if both fail
              }
            } else {
              throw docError
            }
          }
        }
      } catch (err) {
        console.error('Failed to load content:', err)
        const errorMessage = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error || (err as { message?: string })?.message || 'Failed to load content'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadContent()
  }, [documentId, documentType])

  if (!documentId) {
    return null
  }

  return (
    <div className={cn('flex flex-col h-full relative', className)}>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 h-8 w-8 z-50"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-destructive">
            {error}
          </div>
        ) : currentType === 'scrap' && scrapData ? (
          <div className="h-full overflow-auto">
            <ScrapContentView
              scrapData={scrapData}
              className="h-full"
              onNavigate={(id, type) => onDocumentChange?.(id, type)}
            />
          </div>
        ) : (
          <PreviewPane
            content={content}
            documentId={documentId}
            viewMode="preview"
            onNavigate={(id) => onDocumentChange?.(id, 'document')}
            className="border-0 h-full"
            isSecondaryViewer={true}
          />
        )}
      </div>
    </div>
  )
}