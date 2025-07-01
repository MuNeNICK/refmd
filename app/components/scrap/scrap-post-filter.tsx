'use client';

import React, { useState, useCallback } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TagSearch } from './tag-search';
import { ScrapTagList } from './scrap-tag-list';

interface ScrapPostFilterProps {
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;
  onClearFilters: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ScrapPostFilter({
  selectedTags,
  onSelectedTagsChange,
  onClearFilters,
  isOpen = false,
  onOpenChange
}: ScrapPostFilterProps) {
  const [internalOpen, setInternalOpen] = useState(isOpen);
  
  const handleOpenChange = useCallback((open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  }, [onOpenChange]);

  const actualOpen = onOpenChange ? isOpen : internalOpen;
  const hasActiveFilters = selectedTags.length > 0;

  return (
    <Collapsible open={actualOpen} onOpenChange={handleOpenChange}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter by Tags
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-background px-1.5 py-0.5 text-xs text-foreground">
                {selectedTags.length}
              </span>
            )}
          </Button>
        </CollapsibleTrigger>
        
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-2">
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Search and select tags</h4>
              <TagSearch
                selectedTags={selectedTags}
                onSelectedTagsChange={onSelectedTagsChange}
                placeholder="Search tags to filter posts..."
                showPopular={true}
              />
            </div>
            
            {hasActiveFilters && (
              <div>
                <h4 className="text-sm font-medium mb-2">Active Filters</h4>
                <div className="text-xs text-muted-foreground mb-2">
                  Showing posts that contain any of these tags:
                </div>
                <ScrapTagList
                  tags={selectedTags}
                  onTagClick={(tag) => {
                    onSelectedTagsChange(selectedTags.filter(t => t !== tag));
                  }}
                />
              </div>
            )}
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}