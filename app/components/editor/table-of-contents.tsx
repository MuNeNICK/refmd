"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import tocbot from "tocbot";

interface TableOfContentsProps {
  contentSelector?: string;
  onItemClick?: (id: string) => void;
  className?: string;
}

export function TableOfContents({ 
  contentSelector = ".markdown-preview", 
  onItemClick, 
  className 
}: TableOfContentsProps) {
  const tocRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tocRef.current) return;

    // Small delay to ensure content is rendered
    const timer = setTimeout(() => {
      // Add a unique ID to the TOC element for tocbot
      if (!tocRef.current!.id) {
        tocRef.current!.id = `toc-${Date.now()}`;
      }
      
      // Initialize tocbot
      tocbot.init({
        tocSelector: `#${tocRef.current!.id}`,
        contentSelector: contentSelector,
        headingSelector: "h1, h2, h3, h4, h5, h6",
        scrollSmooth: true,
        scrollSmoothDuration: 420,
        scrollSmoothOffset: -80,
        headingsOffset: 80,
        onClick: (e) => {
          const target = e.target as HTMLAnchorElement;
          const id = target.getAttribute("href")?.replace("#", "");
          if (id) {
            onItemClick?.(id);
          }
        },
        linkClass: "toc-link",
        activeLinkClass: "is-active-link",
        listClass: "toc-list",
        listItemClass: "toc-list-item",
        activeListItemClass: "is-active-li",
        collapseDepth: 6,
        throttleTimeout: 50,
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      tocbot.destroy();
    };
  }, [contentSelector, onItemClick]);

  return (
    <nav className={cn("h-full", className)}>
      <div className="p-6">
        <h3 className="text-base font-bold mb-4">Table of Contents</h3>
        <div 
          ref={tocRef}
          className="toc-container"
        />
      </div>
    </nav>
  );
}