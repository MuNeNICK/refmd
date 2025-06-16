"use client";

import React, { useRef, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleToc } from "@/components/editor/table-of-contents-collapsible";

interface FloatingTocProps {
  showFloatingToc: boolean;
  onToggleFloatingToc: () => void;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement>;
  contentSelector?: string;
  className?: string;
  small?: boolean;
}

export function FloatingToc({
  showFloatingToc,
  onToggleFloatingToc,
  onClose,
  containerRef,
  contentSelector = ".markdown-preview",
  className = "fixed bottom-6 right-6",
  small = false
}: FloatingTocProps) {
  const tocButtonRef = useRef<HTMLButtonElement>(null);
  const floatingTocRef = useRef<HTMLDivElement>(null);

  // Handle click outside for floating TOC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFloatingToc && 
          floatingTocRef.current && 
          !floatingTocRef.current.contains(event.target as Node) &&
          tocButtonRef.current &&
          !tocButtonRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFloatingToc, onClose]);

  return (
    <>
      {/* Floating TOC button */}
      <Button
        ref={tocButtonRef}
        onClick={onToggleFloatingToc}
        className={`${className} p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all z-50`}
        title="Table of Contents"
        size="icon"
      >
        <Menu className="h-5 w-5" />
      </Button>
      
      {/* Floating TOC window */}
      {showFloatingToc && (
        <div 
          ref={floatingTocRef}
          className="fixed bottom-20 right-6 max-w-[90vw] bg-background border rounded-lg shadow-xl z-50"
        >
          <div className="flex items-center justify-between p-2 border-b">
            <h3 className="text-xs font-semibold pr-4">Table of Contents</h3>
            <Button
              onClick={onClose}
              className="p-0.5 h-auto w-auto hover:bg-accent rounded-md transition-colors flex-shrink-0"
              variant="ghost"
              size="sm"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="max-h-[60vh]">
            <CollapsibleToc 
              contentSelector={contentSelector}
              containerRef={containerRef}
              onItemClick={onClose}
              small={small}
            />
          </div>
        </div>
      )}
    </>
  );
}