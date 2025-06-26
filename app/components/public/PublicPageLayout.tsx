import React from 'react'
import Link from 'next/link'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Moon, Sun, Calendar, Github } from 'lucide-react'
import { useTheme } from '@/lib/contexts/theme-context'
import { AuthorAvatar } from '../ui/author-avatar'
import { Separator } from '../ui/separator'

interface PublicPageLayoutProps {
  children: React.ReactNode
  pageType: 'document' | 'scrap' | 'list'
  showThemeToggle?: boolean
  title?: string
  subtitle?: string
  author?: {
    name?: string | null
    username?: string | null
  }
  publishedDate?: string
  updatedDate?: string
}

export function PublicPageLayout({ 
  children, 
  pageType, 
  showThemeToggle = true,
  title,
  subtitle,
  author,
  publishedDate
}: PublicPageLayoutProps) {
  const { isDarkMode, toggleTheme } = useTheme()

  const pageBadgeText = pageType === 'document' ? 'Public Document' : 
                        pageType === 'scrap' ? 'Public Scrap' : 
                        'Public Documents'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Logo and Badge */}
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/" className="text-xl font-bold text-foreground hover:text-muted-foreground">
                RefMD
              </Link>
              <Badge variant="secondary">{pageBadgeText}</Badge>
            </div>
            
            {/* Center - Title and metadata */}
            {(title || author || publishedDate) && (
              <div className="flex-1 flex items-center justify-center gap-3 text-sm text-muted-foreground min-w-0">
                {title && (
                  <span className="font-semibold text-foreground truncate">
                    {title}
                    {subtitle && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({subtitle})
                      </span>
                    )}
                  </span>
                )}
                
                {author && (
                  <>
                    {title && <Separator orientation="vertical" className="h-4" />}
                    <div className="flex items-center gap-1 shrink-0">
                      <AuthorAvatar 
                        name={author.name} 
                        username={author.username} 
                        className="w-4 h-4" 
                      />
                      <Link 
                        href={`/u/${author.username}`}
                        className="font-medium hover:text-foreground"
                      >
                        {author.name || author.username}
                      </Link>
                    </div>
                  </>
                )}
                
                {publishedDate && (
                  <>
                    {(title || author) && <Separator orientation="vertical" className="h-4" />}
                    <div className="flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      <span>{publishedDate}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Right side - Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {showThemeToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="text-muted-foreground h-8 w-8"
                >
                  {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground h-8 w-8"
              >
                <a href="https://github.com/MuNeNICK/refmd" target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="h-8">
                <Link href="/">Open RefMD</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-0">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <a href="https://github.com/MuNeNICK/refmd" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            Powered by RefMD
          </a>
        </div>
      </footer>
    </div>
  )
}