'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

interface PlantUMLDiagramProps {
  code: string
}


export function PlantUMLDiagram({ code }: PlantUMLDiagramProps) {
  const [svgContent, setSvgContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return

      try {
        setError(null)
        setLoading(true)
        
        // Use Kroki.io POST endpoint
        const response = await fetch('https://kroki.io/plantuml/svg', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: code
        })
        
        if (!response.ok) {
          throw new Error(`Failed to render diagram: ${response.status} ${response.statusText}`)
        }
        
        const svg = await response.text()
        setSvgContent(svg)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render PlantUML diagram')
        console.error('PlantUML rendering error:', err)
      } finally {
        setLoading(false)
      }
    }

    renderDiagram()
  }, [code])

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-2">
          <p>Error rendering PlantUML diagram:</p>
          <pre className="text-sm">{error}</pre>
        </AlertDescription>
      </Alert>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading diagram...
      </div>
    )
  }

  return (
    <div className="my-4 overflow-x-auto">
      {svgContent ? (
        <div dangerouslySetInnerHTML={{ __html: svgContent }} />
      ) : (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          No diagram content
        </div>
      )}
    </div>
  )
}