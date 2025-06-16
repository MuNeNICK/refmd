import { useEffect, useRef, useState, useCallback, useMemo } from "react";

export type SaveStatus = "saved" | "saving" | "error";

interface UseAutoSaveOptions {
  content: string;
  delay?: number;
  onSave?: (content: string) => Promise<void>;
}

export function useAutoSave({ content, delay = 1000, onSave }: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousContentRef = useRef<string>(content);
  const onSaveRef = useRef(onSave);
  
  // Keep onSave ref updated without triggering re-renders
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const save = useCallback(async (contentToSave: string) => {
    if (!onSaveRef.current) return;
    
    try {
      setSaveStatus("saving");
      await onSaveRef.current(contentToSave);
      setSaveStatus("saved");
      setLastSaved(new Date());
      previousContentRef.current = contentToSave;
    } catch {
      setSaveStatus("error");
      // Failed to auto-save document
      // Don't update previousContentRef on error so it will retry
    }
  }, []); // No dependencies needed since we use refs

  useEffect(() => {
    // Don't save if content hasn't changed
    if (content === previousContentRef.current) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      save(content);
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [content, delay, save]);

  // Manual save function
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    save(content);
  }, [content, save]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useMemo(() => ({
    saveStatus,
    lastSaved,
    saveNow,
  }), [saveStatus, lastSaved, saveNow]);
}