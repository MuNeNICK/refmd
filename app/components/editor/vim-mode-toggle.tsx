'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VimModeToggleProps {
  isVimMode: boolean;
  onToggle: () => void;
}

export function VimModeToggle({ isVimMode, onToggle }: VimModeToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={cn(
        "p-1 sm:p-1.5 h-auto w-auto text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
        isVimMode && "bg-accent text-accent-foreground"
      )}
      title={isVimMode ? 'Disable Vim mode' : 'Enable Vim mode'}
    >
      <span className="text-xs font-mono font-semibold">Vim</span>
    </Button>
  );
}