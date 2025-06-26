'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getApiClient } from '@/lib/api'
import { Document } from '@/lib/api/client/models/Document'
import { BacklinkInfo } from '@/lib/api/client/models/BacklinkInfo'
import { OutgoingLink } from '@/lib/api/client/models/OutgoingLink'
import { FileText, Folder, NotebookText, ArrowLeft, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface BacklinksPanelProps {
  documentId: string
  className?: string
  onClose?: () => void
}

interface BacklinkItem {
  document: Document & { file_path?: string; document_type?: string }
  linkCount: number
  linkType: 'reference' | 'embed' | 'mention'
}

export function BacklinksPanel({ documentId, className, onClose }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])
  const [outgoingLinks, setOutgoingLinks] = useState<BacklinkItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'backlinks' | 'outgoing'>('backlinks')

  useEffect(() => {
    const loadLinks = async () => {
      if (!documentId) return
      
      setIsLoading(true)
      setError(null)
      
      try {
        // Load backlinks (documents that link TO this document)
        const api = getApiClient();
        console.log('API client:', api);
        console.log('Documents service:', api.documents);
        console.log('getDocumentBacklinks method:', api.documents.getDocumentBacklinks);
        const backlinksResponse = await api.documents.getDocumentBacklinks(documentId)
        const backlinkData = backlinksResponse;
        const backlinkItems: BacklinkItem[] = (backlinkData.backlinks || []).map((link) => ({
          document: {
            id: link.document_id || '',
            title: link.title || '',
            file_path: link.file_path || undefined,
            document_type: link.document_type,
            type: link.document_type === BacklinkInfo.document_type.SCRAP ? Document.type.SCRAP : Document.type.DOCUMENT,
            owner_id: '',
            created_at: '',
            updated_at: ''
          },
          linkCount: link.link_count || 1,
          linkType: (link.link_type || 'reference') as 'reference' | 'embed' | 'mention'
        }))
        setBacklinks(backlinkItems)
        
        // Load outgoing links (documents that this document links TO)
        const outgoingResponse = await api.documents.getDocumentLinks(documentId)
        const outgoingData = outgoingResponse;
        const outgoingItems: BacklinkItem[] = (outgoingData.links || []).map((link) => ({
          document: {
            id: link.document_id || '',
            title: link.title || '',
            file_path: link.file_path || undefined,
            document_type: link.document_type,
            type: link.document_type === OutgoingLink.document_type.SCRAP ? Document.type.SCRAP : Document.type.DOCUMENT,
            owner_id: '',
            created_at: '',
            updated_at: ''
          },
          linkCount: 1, // Outgoing links don't have a count
          linkType: (link.link_type || 'reference') as 'reference' | 'embed' | 'mention'
        }))
        setOutgoingLinks(outgoingItems)
      } catch (err) {
        console.error('Failed to load links:', err)
        const errorMessage = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error || (err as { message?: string })?.message || 'Failed to load links'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadLinks()
  }, [documentId])

  const getIcon = (type: Document['type']) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-4 w-4" />
      case 'scrap':
        return <NotebookText className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getLinkTypeLabel = (type: string) => {
    switch (type) {
      case 'embed':
        return 'Embedded'
      case 'mention':
        return 'Mentioned'
      default:
        return 'Referenced'
    }
  }

  const formatFilePath = (path: string | undefined) => {
    if (!path) return undefined
    
    // Remove user ID directory from path (format: "user-id/rest/of/path")
    const pathParts = path.split('/')
    if (pathParts.length > 1) {
      // Skip the first part (user ID) and join the rest
      return pathParts.slice(1).join('/')
    }
    return path
  }

  const renderLinksList = (links: BacklinkItem[]) => {
    if (links.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          {activeTab === 'backlinks' ? 'No documents link to this document' : 'This document has no outgoing links'}
        </div>
      )
    }

    return (
      <div className="space-y-1 p-2">
        {links.map((item, index) => (
          <Link
            key={`${item.document.id}-${index}`}
            href={item.document.type === Document.type.SCRAP ? `/scrap/${item.document.id}` : `/document/${item.document.id}`}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors"
          >
            <span className="text-muted-foreground">
              {getIcon(item.document.type)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {item.document.title}
              </div>
              {item.document.file_path && (
                <div className="text-xs text-muted-foreground truncate">
                  {formatFilePath(item.document.file_path)}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {getLinkTypeLabel(item.linkType)} • {item.linkCount} {item.linkCount === 1 ? 'link' : 'links'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="border-b p-3 flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Document Links
        </h3>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as 'backlinks' | 'outgoing')}
        className="flex-1 flex flex-col"
      >
        <TabsList className="mx-2 mt-2">
          <TabsTrigger value="backlinks" className="flex-1">
            Backlinks ({backlinks.length})
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex-1">
            Outgoing ({outgoingLinks.length})
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-destructive">
              {error}
            </div>
          ) : (
            <>
              <TabsContent value="backlinks" className="m-0">
                {renderLinksList(backlinks)}
              </TabsContent>
              <TabsContent value="outgoing" className="m-0">
                {renderLinksList(outgoingLinks)}
              </TabsContent>
            </>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  )
}

// Compact version for sidebar
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BacklinksCount({ documentId }: { documentId: string }) {
  const [count, setCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCount = async () => {
      try {
        const api = getApiClient();
        const response = await api.documents.getDocumentLinkStats(documentId)
        const data = response;
        setCount((data as { backlink_count?: number }).backlink_count || 0)
      } catch (err) {
        console.error('Failed to load backlink count:', err)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadCount()
  }, [documentId])

  if (isLoading) return null
  if (count === 0) return null

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <ArrowLeft className="h-3 w-3" />
      <span>{count}</span>
    </div>
  )
}