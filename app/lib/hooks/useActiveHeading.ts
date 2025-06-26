import { useState, useEffect, useRef } from "react";

export function useActiveHeading(containerRef?: React.RefObject<HTMLElement>) {
  const [activeId, setActiveId] = useState<string>("");
  const headingsRef = useRef<Map<string, Element>>(new Map());
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveIdRef = useRef<string>("");

  useEffect(() => {
    // Initialize the Map in useEffect to avoid SSR serialization issues
    if (!headingsRef.current) {
      headingsRef.current = new Map();
    }
    
    // Give time for the DOM to render
    const timer = setTimeout(() => {
      const updateActiveHeading = () => {
        const container = containerRef?.current;
        const isWindowScroll = !container;
        
        let containerTop = 0;
        let containerHeight = window.innerHeight;
        
        if (container) {
          const containerRect = container.getBoundingClientRect();
          containerTop = containerRect.top;
          containerHeight = containerRect.height;
        }
        
        let activeHeading: string = "";
        let minDistance = Infinity;

        // Find heading that's visible and closest to top of viewport
        headingsRef.current.forEach((heading, id) => {
          const rect = heading.getBoundingClientRect();
          const headingTop = rect.top - containerTop;
          
          // Check if heading is in the visible area
          const threshold = isWindowScroll ? 100 : containerHeight * 0.3;
          if (headingTop >= -100 && headingTop <= threshold) {
            const distance = Math.abs(headingTop);
            if (distance < minDistance) {
              minDistance = distance;
              activeHeading = id;
            }
          }
        });

        // If no heading is near the top, find the last one before current scroll position
        if (!activeHeading) {
          let lastHeadingBeforeTop = "";
          headingsRef.current.forEach((heading, id) => {
            const rect = heading.getBoundingClientRect();
            const headingTop = rect.top - containerTop;
            
            if (headingTop <= 100) { // Give some buffer
              lastHeadingBeforeTop = id;
            }
          });
          activeHeading = lastHeadingBeforeTop;
        }

        // Only update state if activeId actually changed
        if (activeHeading && activeHeading !== lastActiveIdRef.current) {
          lastActiveIdRef.current = activeHeading;
          setActiveId(activeHeading);
        }
      };

      const scanHeadings = () => {
        // Debounce scanning to prevent rapid updates
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(() => {
          const container = containerRef?.current || document;
          const headings = container.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
          
          // Only update if headings have actually changed
          const newHeadingIds = Array.from(headings).map(h => h.id).filter(Boolean);
          const oldHeadingIds = Array.from(headingsRef.current.keys());
          
          if (newHeadingIds.length !== oldHeadingIds.length || 
              !newHeadingIds.every((id, i) => id === oldHeadingIds[i])) {
            // Clear and repopulate headings map
            headingsRef.current.clear();
            headings.forEach(heading => {
              if (heading.id) {
                headingsRef.current.set(heading.id, heading);
              }
            });
            
            // Update active heading after scanning
            updateActiveHeading();
          }
        }, 50);
      };

      // Initial scan
      scanHeadings();

      // Set up scroll listener with throttling
      const scrollContainer = containerRef?.current;
      const scrollTarget = scrollContainer || window;
      const observeTarget = scrollContainer || document.body;
      
      if (scrollTarget) {
        let scrollTimeout: NodeJS.Timeout;
        const handleScroll = () => {
          // Throttle scroll events to prevent excessive updates
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            updateActiveHeading();
          }, 16); // ~60fps for smooth response
        };
        
        scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
        
        // Set up mutation observer to detect when headings are added/removed
        // Debounce the scanning to prevent excessive updates
        let mutationTimeout: NodeJS.Timeout;
        mutationObserverRef.current = new MutationObserver(() => {
          clearTimeout(mutationTimeout);
          mutationTimeout = setTimeout(() => {
            scanHeadings();
          }, 100);
        });
        
        mutationObserverRef.current.observe(observeTarget, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['id']
        });
        
        return () => {
          scrollTarget.removeEventListener('scroll', handleScroll);
          mutationObserverRef.current?.disconnect();
        };
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      mutationObserverRef.current?.disconnect();
    };
  }, [containerRef]); // Remove activeId from dependencies to prevent infinite loop

  return activeId;
}