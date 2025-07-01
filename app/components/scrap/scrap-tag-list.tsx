'use client';

import React from 'react';
import { ScrapTag } from './scrap-tag';

interface ScrapTagListProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  className?: string;
}

export function ScrapTagList({ tags, onTagClick, className = '' }: ScrapTagListProps) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag) => (
        <ScrapTag
          key={tag}
          tag={tag}
          onClick={onTagClick}
        />
      ))}
    </div>
  );
}