'use client'

import React from 'react'
import { FileText, Folder, NotebookText, Calendar, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Document } from '@/lib/api/client/models/Document'

interface DocumentLinkCardProps {
  document: Document
  className?: string
  variant?: 'default' | 'embed' | 'inline'
}

export function DocumentLinkCard({ document, className, variant = 'default' }: DocumentLinkCardProps) {
  const getIcon = () => {
    switch (document.type) {
      case 'folder':
        return <Folder className="h-4 w-4 text-blue-600" />
      case 'scrap':
        return <NotebookText className="h-4 w-4 text-gray-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMinutes < 1) return 'just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return date.toLocaleDateString()
  }

  const getContentPreview = () => {
    if (!document.content) return null
    
    // Remove markdown formatting for preview
    const plainText = document.content
      .replace(/^#+\s+/gm, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/```[^`]*```/g, '') // Remove code blocks
      .replace(/!\[\[([^\]]+)\]\]/g, '') // Remove embeds
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Remove wiki links
      .replace(/\n+/g, ' ') // Replace multiple newlines with space
      .trim()

    if (!plainText) return null

    // Get first 150 characters
    if (plainText.length > 150) {
      return plainText.substring(0, 150) + '...'
    }
    return plainText
  }

  const formatFilePath = (path: string | null | undefined) => {
    if (!path) return null
    
    // Remove user ID directory from path
    const pathParts = path.split('/')
    if (pathParts.length > 1) {
      // Skip the first part (user ID) and return the rest
      const formattedPath = pathParts.slice(1).join('/')
      return formattedPath || null
    }
    return path
  }

  const contentPreview = getContentPreview()
  const filePath = formatFilePath(document.file_path)

  const isEmbed = variant === 'embed'
  const isInline = variant === 'inline'
  
  // Inline variant - compact horizontal layout
  if (isInline) {
    return (
      <span className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md bg-card hover:bg-accent/50 transition-colors",
        className
      )}>
        <span className="flex-shrink-0">{getIcon()}</span>
        <span className="flex-1 min-w-0">
          <span className="font-medium">{document.title || 'Untitled'}</span>
          {filePath && (
            <span className="text-xs text-muted-foreground ml-2">
              {filePath}
            </span>
          )}
        </span>
      </span>
    )
  }
  
  // Embed variant - file-attachment style
  if (isEmbed) {
    return (
      <div className={cn("w-full", className)}>
        <span className="flex items-center gap-2 px-4 py-3 border rounded-md bg-card hover:bg-accent/50 transition-colors group w-full">
          <span className="flex-shrink-0">
            {getIcon()}
          </span>
          
          <span className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-sm font-medium text-foreground truncate" title={document.title || 'Untitled'}>
              {document.title || 'Untitled'}
            </span>
            {filePath && (
              <span className="text-xs text-muted-foreground truncate">
                {filePath}
              </span>
            )}
          </span>
          
          {/* Type badge */}
          <Badge variant="secondary" className="text-xs">
            {document.type?.toUpperCase() || 'DOCUMENT'}
          </Badge>
          
          {/* Updated time - with min height to match file-attachment button */}
          <span className="flex items-center gap-1 text-xs text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity h-8">
            <Clock className="h-3 w-3" />
            <span>{formatDate(document.updated_at || '')}</span>
          </span>
        </span>
      </div>
    )
  }
  
  // Default variant (tooltip preview)
  return (
    <Card className={cn(
      "w-80 shadow-lg",
      className
    )}>
      <CardContent className="space-y-3 p-4">
        {/* Header with icon and title */}
        <div className="flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">{getIcon()}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight truncate">
              {document.title || 'Untitled'}
            </h3>
            {filePath && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {filePath}
              </p>
            )}
          </div>
        </div>

        {/* Content preview */}
        {contentPreview && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {contentPreview}
          </p>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {document.created_at && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Created {formatDate(document.created_at)}</span>
            </div>
          )}
          {document.updated_at && document.updated_at !== document.created_at && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Updated {formatDate(document.updated_at)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}