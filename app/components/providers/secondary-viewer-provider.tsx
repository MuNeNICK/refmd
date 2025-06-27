'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'

interface SecondaryViewerContextType {
  secondaryDocumentId: string | null
  secondaryDocumentType: 'document' | 'scrap'
  showSecondaryViewer: boolean
  setSecondaryDocumentId: (id: string | null) => void
  setSecondaryDocumentType: (type: 'document' | 'scrap') => void
  setShowSecondaryViewer: (show: boolean) => void
  openSecondaryViewer: (id: string, type?: 'document' | 'scrap') => void
  closeSecondaryViewer: () => void
}

const SecondaryViewerContext = createContext<SecondaryViewerContextType | undefined>(undefined)

const STORAGE_KEY = 'refmd-secondary-viewer'

interface StoredState {
  documentId: string | null
  documentType: 'document' | 'scrap'
  isOpen: boolean
}

export function SecondaryViewerProvider({ children }: { children: ReactNode }) {
  const [secondaryDocumentId, setSecondaryDocumentIdState] = useState<string | null>(null)
  const [secondaryDocumentType, setSecondaryDocumentTypeState] = useState<'document' | 'scrap'>('document')
  const [showSecondaryViewer, setShowSecondaryViewerState] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: StoredState = JSON.parse(stored)
        setSecondaryDocumentIdState(parsed.documentId)
        setSecondaryDocumentTypeState(parsed.documentType || 'document')
        setShowSecondaryViewerState(parsed.isOpen)
      }
    } catch (error) {
      console.error('Failed to load secondary viewer state:', error)
    }
    
    setIsInitialized(true)
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return
    
    try {
      const state: StoredState = {
        documentId: secondaryDocumentId,
        documentType: secondaryDocumentType,
        isOpen: showSecondaryViewer
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.error('Failed to save secondary viewer state:', error)
    }
  }, [secondaryDocumentId, secondaryDocumentType, showSecondaryViewer, isInitialized])

  const setSecondaryDocumentId = useCallback((id: string | null) => {
    setSecondaryDocumentIdState(id)
  }, [])

  const setSecondaryDocumentType = useCallback((type: 'document' | 'scrap') => {
    setSecondaryDocumentTypeState(type)
  }, [])

  const setShowSecondaryViewer = useCallback((show: boolean) => {
    setShowSecondaryViewerState(show)
  }, [])

  const openSecondaryViewer = useCallback((id: string, type: 'document' | 'scrap' = 'document') => {
    setSecondaryDocumentIdState(id)
    setSecondaryDocumentTypeState(type)
    setShowSecondaryViewerState(true)
  }, [])

  const closeSecondaryViewer = useCallback(() => {
    setShowSecondaryViewerState(false)
    // Keep the document ID so it can be restored if reopened
  }, [])

  return (
    <SecondaryViewerContext.Provider
      value={{
        secondaryDocumentId,
        secondaryDocumentType,
        showSecondaryViewer,
        setSecondaryDocumentId,
        setSecondaryDocumentType,
        setShowSecondaryViewer,
        openSecondaryViewer,
        closeSecondaryViewer,
      }}
    >
      {children}
    </SecondaryViewerContext.Provider>
  )
}

export function useSecondaryViewer() {
  const context = useContext(SecondaryViewerContext)
  if (context === undefined) {
    throw new Error('useSecondaryViewer must be used within a SecondaryViewerProvider')
  }
  return context
}