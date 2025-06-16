"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseDragAndDropProps {
  onFilesDrop: (files: File[]) => void;
  element?: HTMLElement | null;
}

export function useDragAndDrop({ onFilesDrop, element }: UseDragAndDropProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    
    dragCounterRef.current++;
    if (e.dataTransfer?.types.includes('Files') && !isDragOver) {
      setIsDragOver(true);
    }
  }, [isDragOver]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current--;
    
    // Use timeout to prevent flickering when moving between child elements
    if (dragCounterRef.current <= 0) {
      dragTimeoutRef.current = setTimeout(() => {
        dragCounterRef.current = 0;
        setIsDragOver(false);
      }, 50);
    }
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    
    dragCounterRef.current = 0;
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      onFilesDrop(files);
    }
  }, [onFilesDrop]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (clipboardData?.files && clipboardData.files.length > 0) {
      e.preventDefault();
      const files = Array.from(clipboardData.files);
      onFilesDrop(files);
    }
  }, [onFilesDrop]);

  useEffect(() => {
    const targetElement = element;
    if (!targetElement) return;

    targetElement.addEventListener('dragenter', handleDragEnter);
    targetElement.addEventListener('dragover', handleDragOver);
    targetElement.addEventListener('dragleave', handleDragLeave);
    targetElement.addEventListener('drop', handleDrop);
    targetElement.addEventListener('paste', handlePaste);

    return () => {
      targetElement.removeEventListener('dragenter', handleDragEnter);
      targetElement.removeEventListener('dragover', handleDragOver);
      targetElement.removeEventListener('dragleave', handleDragLeave);
      targetElement.removeEventListener('drop', handleDrop);
      targetElement.removeEventListener('paste', handlePaste);
    };
  }, [element, handleDragEnter, handleDragOver, handleDragLeave, handleDrop, handlePaste]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  return {
    isDragOver,
  };
}