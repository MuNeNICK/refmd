'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Folder, StickyNote, Calendar, User } from 'lucide-react';
import { Document } from '@/lib/api/client/models/Document';
import { formatDistanceToNow } from 'date-fns';

interface DocumentCardProps {
  document: Document;
  onClick?: () => void;
}

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const getIcon = () => {
    switch (document.type) {
      case 'folder':
        return <Folder className="h-5 w-5" />;
      case 'scrap':
        return <StickyNote className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getIcon()}
            <CardTitle className="text-lg">{document.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              Updated {document.updated_at ? formatDistanceToNow(new Date(document.updated_at), { addSuffix: true }) : 'recently'}
            </span>
          </div>
          {document.visibility && document.visibility !== 'private' && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="capitalize">{document.visibility}</span>
            </div>
          )}
        </div>
        {document.content && (
          <CardDescription className="mt-2 line-clamp-2">
            {document.content}
          </CardDescription>
        )}
      </CardContent>
    </Card>
  );
}