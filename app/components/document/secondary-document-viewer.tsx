'use client'

import React, { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api'
import { Document } from '@/lib/api/client/models/Document'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PreviewPane } from '@/components/editor/preview-pane'

interface SecondaryDocumentViewerProps {
  documentId: string | null
  className?: string
  onClose?: () => void
  onDocumentChange?: (documentId: string) => void
}

export function SecondaryDocumentViewer({ 
  documentId, 
  className, 
  onClose,
  onDocumentChange 
}: SecondaryDocumentViewerProps) {
  const [, setDocument] = useState<Document | null>(null)
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDocument = async () => {
      if (!documentId) {
        setDocument(null)
        setContent('')
        return
      }
      
      setIsLoading(true)
      setError(null)
      
      try {
        const api = getApiClient()
        
        // Load document metadata
        const doc = await api.documents.getDocument(documentId)
        setDocument(doc)
        
        // Load document content
        const contentResponse = await api.documents.getDocumentContent(documentId)
        setContent(contentResponse.content || '')
      } catch (err) {
        console.error('Failed to load document:', err)
        const errorMessage = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error || (err as { message?: string })?.message || 'Failed to load document'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadDocument()
  }, [documentId])

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
        ) : (
          <PreviewPane
            content={content}
            documentId={documentId}
            viewMode="preview"
            onNavigate={onDocumentChange}
            className="border-0 h-full"
            isSecondaryViewer={true}
          />
        )}
      </div>
    </div>
  )
}