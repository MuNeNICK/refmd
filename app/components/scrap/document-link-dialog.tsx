'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText, Folder, Hash } from 'lucide-react';
import { getApiClient } from '@/lib/api';
import { SearchResult } from '@/lib/api/client/models/SearchResult';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface DocumentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDocument: (documentId: string, documentTitle: string) => void;
}

export function DocumentLinkDialog({
  open,
  onOpenChange,
  onSelectDocument
}: DocumentLinkDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const searchDocuments = useCallback(async () => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const api = getApiClient();
      const results = await api.documents.searchDocuments(debouncedSearchQuery, 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search documents:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery]);

  useEffect(() => {
    searchDocuments();
  }, [searchDocuments]);

  const handleSelectDocument = (doc: SearchResult) => {
    if (doc.id && doc.title) {
      onSelectDocument(doc.id, doc.title);
      onOpenChange(false);
      setSearchQuery('');
    }
  };

  const getDocumentIcon = (type: SearchResult.document_type) => {
    switch (type) {
      case SearchResult.document_type.FOLDER:
        return <Folder className="h-4 w-4" />;
      case SearchResult.document_type.SCRAP:
        return <Hash className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Insert Document Link</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No documents found' : 'Start typing to search'}
              </div>
            ) : (
              <div className="p-2">
                {searchResults.map((doc) => (
                  <Button
                    key={doc.id}
                    variant="ghost"
                    className="w-full justify-start text-left mb-1"
                    onClick={() => handleSelectDocument(doc)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getDocumentIcon(doc.document_type)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {doc.title || 'Untitled'}
                        </div>
                        {doc.path && (
                          <div className="text-xs text-muted-foreground truncate">
                            {doc.path}
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>

          {searchQuery && searchResults.length === 0 && !isLoading && (
            <div className="text-sm text-muted-foreground">
              Tip: Document will be linked using its ID
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}