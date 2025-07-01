'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, X, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/use-debounce';
import { getApiClient } from '@/lib/api';
import type { TagWithCount } from '@/lib/api/client';

interface TagSearchProps {
  onTagSelect?: (tagName: string) => void;
  selectedTags?: string[];
  onSelectedTagsChange?: (tags: string[]) => void;
  placeholder?: string;
  showPopular?: boolean;
  scrapId?: string;
}

export function TagSearch({
  onTagSelect,
  selectedTags = [],
  onSelectedTagsChange,
  placeholder = "Search tags...",
  showPopular = true,
  scrapId
}: TagSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const client = getApiClient();

  const loadPopularTags = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (scrapId) {
        // Load tags specific to this scrap
        const tags = await client.tags.getScrapTags(scrapId);
        // Convert to TagWithCount format for consistency
        const tagsWithCount: TagWithCount[] = tags.map(tag => ({
          ...tag,
          count: 0 // Count not available from this endpoint
        }));
        setTags(tagsWithCount);
      } else {
        // Load system-wide popular tags
        const response = await client.tags.listTags(20, 0);
        setTags(response.tags);
      }
    } catch (error) {
      console.error('Failed to load popular tags:', error);
      setTags([]);
    } finally {
      setIsLoading(false);
    }
  }, [client.tags, scrapId]);

  const searchTags = useCallback(async (query: string) => {
    try {
      setIsLoading(true);
      
      if (scrapId) {
        // Search within scrap-specific tags
        const tags = await client.tags.getScrapTags(scrapId);
        const tagsWithCount: TagWithCount[] = tags
          .filter(tag => tag.name.toLowerCase().includes(query.toLowerCase()))
          .map(tag => ({
            ...tag,
            count: 0
          }));
        setTags(tagsWithCount);
      } else {
        // Search all tags
        const response = await client.tags.listTags(50, 0);
        const filteredTags = response.tags.filter(tag =>
          tag.name.toLowerCase().includes(query.toLowerCase())
        );
        setTags(filteredTags);
      }
    } catch (error) {
      console.error('Failed to search tags:', error);
      setTags([]);
    } finally {
      setIsLoading(false);
    }
  }, [client.tags, scrapId]);

  const handleTagClick = useCallback((tagName: string) => {
    if (onTagSelect) {
      onTagSelect(tagName);
    }
    
    // Add to selected tags if not already selected
    if (onSelectedTagsChange && !selectedTags.includes(tagName)) {
      onSelectedTagsChange([...selectedTags, tagName]);
    }
    
    // Clear search and close dropdown
    setSearchQuery('');
    setIsOpen(false);
  }, [onTagSelect, onSelectedTagsChange, selectedTags]);

  const handleRemoveTag = useCallback((tagName: string) => {
    if (onSelectedTagsChange) {
      onSelectedTagsChange(selectedTags.filter(tag => tag !== tagName));
    }
  }, [onSelectedTagsChange, selectedTags]);

  const filteredTags = useMemo(() => {
    // Exclude already selected tags
    return tags.filter(tag => !selectedTags.includes(tag.name));
  }, [tags, selectedTags]);

  // Fetch popular tags on mount
  useEffect(() => {
    if (showPopular) {
      loadPopularTags();
    }
  }, [showPopular, loadPopularTags]);

  // Search tags when query changes
  useEffect(() => {
    if (debouncedSearchQuery) {
      searchTags(debouncedSearchQuery);
    } else if (showPopular) {
      loadPopularTags();
    }
  }, [debouncedSearchQuery, showPopular, searchTags, loadPopularTags]);

  return (
    <div className="space-y-2">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleRemoveTag(tag)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-sm transition-colors"
            >
              <Hash className="h-3 w-3" />
              {tag}
              <X className="h-3 w-3 ml-0.5" />
            </button>
          ))}
        </div>
      )}

      {/* Popular Tags - Always visible */}
      {showPopular && !searchQuery && filteredTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filteredTags.slice(0, 20).map(tag => (
            <button
              key={tag.id}
              onClick={() => handleTagClick(tag.name)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm bg-muted hover:bg-accent transition-colors"
            >
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span>{tag.name}</span>
              <span className="text-xs text-muted-foreground ml-0.5">{tag.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search Input - Optional */}
      {!showPopular && (
        <>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsOpen(true)}
                className="pl-8"
              />
            </div>

            {/* Dropdown */}
            {isOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
                <ScrollArea className="max-h-60">
                  {isLoading ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Loading tags...
                    </div>
                  ) : filteredTags.length > 0 ? (
                    <div className="space-y-1">
                      {filteredTags.map(tag => (
                        <Button
                          key={tag.id}
                          variant="ghost"
                          className="w-full justify-start text-left h-auto p-2"
                          onClick={() => handleTagClick(tag.name)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Hash className="h-3 w-3" />
                              <span>{tag.name}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {tag.count}
                            </Badge>
                          </div>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      {searchQuery ? 'No tags found' : 'No tags available'}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Click outside to close */}
          {isOpen && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}