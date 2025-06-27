'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface SecondaryDocumentContextType {
  secondaryDocumentId: string | null
  showSecondaryDocument: boolean
  setSecondaryDocumentId: (id: string | null) => void
  setShowSecondaryDocument: (show: boolean) => void
  openSecondaryDocument: (id: string) => void
  closeSecondaryDocument: () => void
}

const SecondaryDocumentContext = createContext<SecondaryDocumentContextType | undefined>(undefined)

export function SecondaryDocumentProvider({ children }: { children: ReactNode }) {
  const [secondaryDocumentId, setSecondaryDocumentId] = useState<string | null>(null)
  const [showSecondaryDocument, setShowSecondaryDocument] = useState(false)

  const openSecondaryDocument = useCallback((id: string) => {
    setSecondaryDocumentId(id)
    setShowSecondaryDocument(true)
  }, [])

  const closeSecondaryDocument = useCallback(() => {
    setShowSecondaryDocument(false)
    // Keep the document ID so it can be restored if reopened
  }, [])

  return (
    <SecondaryDocumentContext.Provider
      value={{
        secondaryDocumentId,
        showSecondaryDocument,
        setSecondaryDocumentId,
        setShowSecondaryDocument,
        openSecondaryDocument,
        closeSecondaryDocument,
      }}
    >
      {children}
    </SecondaryDocumentContext.Provider>
  )
}

export function useSecondaryDocument() {
  const context = useContext(SecondaryDocumentContext)
  if (context === undefined) {
    throw new Error('useSecondaryDocument must be used within a SecondaryDocumentProvider')
  }
  return context
}