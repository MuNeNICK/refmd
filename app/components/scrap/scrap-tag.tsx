'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

interface ScrapTagProps {
  tag: string;
  onClick?: (tag: string) => void;
  variant?: 'default' | 'secondary' | 'outline';
}

export function ScrapTag({ tag, onClick, variant = 'secondary' }: ScrapTagProps) {
  return (
    <Badge
      variant={variant}
      className={onClick ? 'cursor-pointer hover:opacity-80' : ''}
      onClick={() => onClick?.(tag)}
    >
      #{tag}
    </Badge>
  );
}