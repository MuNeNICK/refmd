"use client";

import { useState, useCallback, useRef } from 'react';

interface DragState {
  draggedItem: string | null;
  dropTarget: string | null;
  dropPosition: { nodeId: string; position: 'before' | 'after' } | null;
  isExternalDrag: boolean;
}

interface UseFileTreeDragProps {
  onMove: (nodeId: string, targetId?: string) => Promise<void>;
  onFileUpload: (files: File[], parentId?: string) => Promise<void>;
}

export function useFileTreeDrag({ onMove, onFileUpload }: UseFileTreeDragProps) {
  const [dragState, setDragState] = useState<DragState>({
    draggedItem: null,
    dropTarget: null,
    dropPosition: null,
    isExternalDrag: false,
  });

  const dragTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    setDragState({
      draggedItem: nodeId,
      dropTarget: null,
      dropPosition: null,
      isExternalDrag: false,
    });
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    
    dragTimeoutRef.current = setTimeout(() => {
      setDragState({
        draggedItem: null,
        dropTarget: null,
        dropPosition: null,
        isExternalDrag: false,
      });
    }, 50);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, nodeId: string, nodeType: 'file' | 'folder' | 'scrap') => {
    e.preventDefault();
    e.stopPropagation();

    const hasFiles = e.dataTransfer?.types.includes('Files');
    
    if (hasFiles) {
      if (nodeType === 'folder' || nodeId === '') {
        setDragState(prev => ({
          ...prev,
          dropTarget: nodeId,
          dropPosition: null,
          isExternalDrag: true,
        }));
      }
      return;
    }

    // For internal drag (when text/plain type exists)
    const hasInternalDrag = e.dataTransfer?.types.includes('text/plain');
    
    if (nodeType === 'folder' && hasInternalDrag) {
      setDragState(prev => {
        // Ignore if trying to drop on itself
        if (prev.draggedItem !== nodeId) {
          return {
            ...prev,
            dropTarget: nodeId,
            dropPosition: null,
          };
        }
        return prev;
      });
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    
    dragTimeoutRef.current = setTimeout(() => {
      const target = e.currentTarget as HTMLElement;
      if (!target) return;
      
      const rect = target.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      const isOutside = x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
      
      if (isOutside) {
        setDragState(prev => ({
          ...prev,
          dropTarget: null,
          dropPosition: null,
          isExternalDrag: false,
        }));
      }
    }, 100);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string, targetType: 'file' | 'folder' | 'scrap', parentId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const uploadParentId = targetType === 'folder' ? targetId : parentId;
      await onFileUpload(files, uploadParentId);
    } else {
      const draggedNodeId = e.dataTransfer.getData('text/plain') || dragState.draggedItem;
      
      if (draggedNodeId && draggedNodeId !== targetId) {
        if (!targetId || targetType === 'folder') {
          await onMove(draggedNodeId, targetId);
        }
      }
    }

    setDragState({
      draggedItem: null,
      dropTarget: null,
      dropPosition: null,
      isExternalDrag: false,
    });
  }, [dragState.draggedItem, onMove, onFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent, nodeId?: string, nodeType?: 'file' | 'folder' | 'scrap') => {
    e.preventDefault();
    const hasFiles = e.dataTransfer.types.includes('Files');
    e.dataTransfer.dropEffect = hasFiles ? 'copy' : 'move';
    
    // When dragging over a folder, set drop target
    if (nodeId && nodeType === 'folder') {
      const hasInternalDrag = e.dataTransfer?.types.includes('text/plain');
      if (hasFiles || hasInternalDrag) {
        setDragState(prev => {
          if (prev.dropTarget !== nodeId && prev.draggedItem !== nodeId) {
            return {
              ...prev,
              dropTarget: nodeId,
              dropPosition: null,
            };
          }
          return prev;
        });
      }
    }
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragOver,
  };
}