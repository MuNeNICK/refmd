"use client";

import React, { useEffect, useRef, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import tocbot from "tocbot";
import { useActiveHeading } from "@/lib/hooks/useActiveHeading";
import { ChevronRight, ChevronDown } from "lucide-react";
import { createRoot } from "react-dom/client";

interface CollapsibleTocProps {
  contentSelector?: string;
  onItemClick?: (id: string) => void;
  className?: string;
  containerRef?: React.RefObject<HTMLElement>;
  small?: boolean;
}

const TableOfContentsCollapsibleComponent = ({ 
  contentSelector = ".markdown-preview", 
  onItemClick, 
  className,
  containerRef, 
  small 
}: CollapsibleTocProps) => {
  const tocRef = useRef<HTMLDivElement>(null);
  const activeId = useActiveHeading(containerRef);

  const addExpandIcons = useCallback(() => {
    if (!tocRef.current) return;

    const tocContainer = tocRef.current;
    const allListItems = tocContainer.querySelectorAll('.toc-list-item');
    
    allListItems.forEach(item => {
      const nestedList = item.querySelector(':scope > .toc-list');
      const link = item.querySelector(':scope > .toc-link');
      
      if (nestedList && link && !link.querySelector('.toc-expand-icon')) {
        // Create expand icon (start with Chevron Right for collapsed state)
        const expandIcon = document.createElement('span');
        expandIcon.className = 'toc-expand-icon';
        
        // Use React to render the lucide icon
        const root = createRoot(expandIcon);
        (expandIcon as HTMLElement & { _reactRoot?: import('react-dom/client').Root })._reactRoot = root;
        root.render(React.createElement(ChevronRight, { className: 'w-3 h-3 mr-1' }));
        
        // Insert at the beginning of the link
        link.insertBefore(expandIcon, link.firstChild);
      }
    });
  }, []);


  const collapseAllExcept = useCallback((activeHeadingId: string) => {
    if (!tocRef.current) return;

    const tocContainer = tocRef.current;
    const allLists = tocContainer.querySelectorAll('.toc-list');
    const allLinks = tocContainer.querySelectorAll('.toc-link');
    
    // Remove active class from all links first
    allLinks.forEach(link => {
      link.classList.remove('is-active-link');
    });
    
    // First, collapse all nested lists (except root)
    allLists.forEach((list, index) => {
      if (index > 0) { // Skip the root list
        list.classList.add('toc-collapsed');
        list.classList.remove('toc-expanded');
      }
    });

    if (!activeHeadingId) return;

    // Find the active heading and expand its parent chain
    const activeLink = tocContainer.querySelector(`a[href="#${activeHeadingId}"]`);
    if (activeLink) {
      // Add active class to the current link
      activeLink.classList.add('is-active-link');
      
      let currentElement = activeLink.parentElement;
      while (currentElement && currentElement !== tocContainer) {
        if (currentElement.classList.contains('toc-list-item')) {
          // Expand nested list if it exists
          const nestedList = currentElement.querySelector('.toc-list');
          if (nestedList) {
            nestedList.classList.remove('toc-collapsed');
            nestedList.classList.add('toc-expanded');
          }
        }
        currentElement = currentElement.parentElement;
      }
    }

    // Update icon states after expansion changes - call updateIconStates directly
    if (!tocRef.current) return;

    const tocContainer2 = tocRef.current;
    const allExpandIcons = tocContainer2.querySelectorAll('.toc-expand-icon');
    
    allExpandIcons.forEach(icon => {
      const parentLink = icon.closest('.toc-link');
      const parentItem = parentLink?.closest('.toc-list-item');
      const nestedList = parentItem?.querySelector(':scope > .toc-list');
      
      if (nestedList) {
        const isExpanded = nestedList.classList.contains('toc-expanded');
        
        // Update icon based on expansion state
        const iconElement = icon as HTMLElement & { _reactRoot?: import('react-dom/client').Root };
        if (!iconElement._reactRoot) {
          iconElement._reactRoot = createRoot(icon);
        }
        const root = iconElement._reactRoot;
        
        if (isExpanded) {
          // Chevron Down for expanded
          root.render(React.createElement(ChevronDown, { className: 'w-3 h-3 mr-1' }));
        } else {
          // Chevron Right for collapsed
          root.render(React.createElement(ChevronRight, { className: 'w-3 h-3 mr-1' }));
        }
      }
    });
  }, []);

  useEffect(() => {
    const currentTocRef = tocRef.current;
    if (!currentTocRef) return;

    // Function to check if content is available and initialize TOC
    const tryInitializeToc = () => {
      const contentElement = document.querySelector(contentSelector);
      const hasHeadings = (contentElement?.querySelectorAll('h1, h2, h3, h4, h5, h6').length ?? 0) > 0;
      
      if (!hasHeadings) {
        // Content not ready yet, try again in a bit
        return false;
      }

      // Add a unique ID to the TOC element for tocbot
      if (!currentTocRef.id) {
        currentTocRef.id = `toc-collapsible-${Date.now()}`;
      }
      
      // Destroy existing instance first
      tocbot.destroy();
      
      // Initialize tocbot with collapsible features
      tocbot.init({
        tocSelector: `#${currentTocRef.id}`,
        contentSelector: contentSelector,
        headingSelector: "h1, h2, h3, h4, h5, h6",
        scrollSmooth: true,
        scrollSmoothDuration: 420,
        scrollSmoothOffset: -80,
        headingsOffset: 80,
        disableTocScrollSync: true, // Disable automatic active link detection
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
        collapseDepth: 1, // Only show H1 by default
        throttleTimeout: 16, // ~60fps for smooth response
      });

      // Apply initial collapse state and add expand icons
      setTimeout(() => {
        addExpandIcons();
      }, 50);
      
      return true;
    };

    // Try initializing immediately
    let initialized = false;
    const timer = setTimeout(() => {
      initialized = tryInitializeToc();
      
      // If not initialized, keep trying until content is ready
      if (!initialized) {
        const retryInterval = setInterval(() => {
          if (tryInitializeToc()) {
            clearInterval(retryInterval);
          }
        }, 200);
        
        // Stop trying after 5 seconds
        setTimeout(() => {
          clearInterval(retryInterval);
        }, 5000);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      tocbot.destroy();
      
      // Clean up React roots
      if (currentTocRef) {
        const allExpandIcons = currentTocRef.querySelectorAll('.toc-expand-icon');
        allExpandIcons.forEach(icon => {
          const iconElement = icon as HTMLElement & { _reactRoot?: import('react-dom/client').Root };
          if (iconElement._reactRoot) {
            iconElement._reactRoot.unmount();
            iconElement._reactRoot = undefined;
          }
        });
      }
    };
  }, [contentSelector, onItemClick, addExpandIcons]);

  // Handle active heading changes with debouncing
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  useEffect(() => {
    if (activeId) {
      // Clear previous timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // Debounce the collapse operation to prevent flickering
      debounceTimeoutRef.current = setTimeout(() => {
        collapseAllExcept(activeId);
      }, 50); // Faster response
    }
    
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [activeId, collapseAllExcept]);


  const isSmall = small || className?.includes('text-xs');
  
  return (
    <nav className={cn("h-full", className)}>
      <div className={cn("sticky top-20", isSmall ? "p-2" : "p-4", className)}>
        {!isSmall && (
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Table of Contents</h3>
        )}
        <div 
          ref={tocRef}
          className={cn(
            "toc-container collapsible-toc max-h-[70vh] overflow-y-auto",
            isSmall && "text-xs"
          )}
        />
      </div>
    </nav>
  );
};

export const CollapsibleToc = memo(TableOfContentsCollapsibleComponent);