'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { FileText, Hash, StickyNote, Folder } from 'lucide-react';
import { getApiClient } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import type { Document, TagWithCount } from '@/lib/api/client';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const client = getApiClient();

  // Search for documents and tags
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setDocuments([]);
      setTags([]);
      return;
    }

    setIsLoading(true);
    try {
      // Search documents
      const docsPromise = client.documents.searchDocuments(query, 10);
      
      // Search tags
      const tagsPromise = client.tags.listTags(20, 0);
      
      const [docsResponse, tagsResponse] = await Promise.all([
        docsPromise.catch(() => []),
        tagsPromise.catch(() => ({ tags: [], total: 0 }))
      ]);
      
      setDocuments(docsResponse || []);
      
      // Filter tags by search query
      const filteredTags = (tagsResponse.tags || []).filter(tag =>
        tag.name.toLowerCase().includes(query.toLowerCase())
      );
      setTags(filteredTags.slice(0, 10));
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Load popular tags when dialog opens
  useEffect(() => {
    if (open && !searchQuery) {
      client.tags.listTags(10, 0).then(response => {
        setTags(response.tags);
      }).catch(console.error);
    }
  }, [open, searchQuery, client]);

  // Perform search when query changes
  useEffect(() => {
    if (debouncedSearchQuery) {
      performSearch(debouncedSearchQuery);
    } else {
      setDocuments([]);
      if (open) {
        // Show popular tags when no search query
        client.tags.listTags(10, 0).then(response => {
          setTags(response.tags);
        }).catch(console.error);
      }
    }
  }, [debouncedSearchQuery, open, performSearch, client]);

  const handleSelect = useCallback((value: string) => {
    const [type, id] = value.split(':');
    
    if (type === 'doc') {
      router.push(`/document/${id}`);
    } else if (type === 'tag') {
      router.push(`/search?tag=${encodeURIComponent(id)}`);
    }
    
    onOpenChange(false);
    setSearchQuery('');
  }, [router, onOpenChange]);

  const getDocumentIcon = (doc: Document) => {
    switch (doc.type) {
      case 'folder':
        return <Folder className="h-4 w-4" />;
      case 'scrap':
        return <StickyNote className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search documents, tags..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        {!searchQuery && tags.length === 0 && !isLoading && (
          <CommandEmpty>Type to search...</CommandEmpty>
        )}
        
        {searchQuery && documents.length === 0 && tags.length === 0 && !isLoading && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        
        {tags.length > 0 && (
          <>
            <CommandGroup heading="Tags">
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={`tag:${tag.name}`}
                  onSelect={handleSelect}
                  className="flex items-center gap-2"
                >
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span>{tag.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {tag.count} {tag.count === 1 ? 'item' : 'items'}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {documents.length > 0 && <CommandSeparator />}
          </>
        )}
        
        {documents.length > 0 && (
          <CommandGroup heading="Documents">
            {documents.map((doc) => (
              <CommandItem
                key={doc.id}
                value={`doc:${doc.id}`}
                onSelect={handleSelect}
                className="flex items-center gap-2"
              >
                {getDocumentIcon(doc)}
                <span className="flex-1 truncate">{doc.title}</span>
                {doc.type !== 'document' && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {doc.type}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}