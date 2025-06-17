"use client";

import React, { useCallback, useMemo, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/authContext";
import { useTheme } from "@/lib/contexts/theme-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  LogOut, 
  FileText,
  Share2, 
  Download, 
  Moon, 
  Sun,
  Github,
  Columns,
  FileCode,
  Eye,
  X,
  Wifi,
  WifiOff,
  Users
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/lib/hooks/useAutoSave";
import { SidebarTrigger } from "@/components/ui/sidebar";

export type ViewMode = "editor" | "split" | "preview";

interface HeaderProps {
  // Editor-specific props (optional for non-editor pages)
  viewMode?: ViewMode;
  saveStatus?: SaveStatus;
  lastSaved?: Date;
  isRealtimeConnected?: boolean;
  realtimeUserCount?: number;
  documentTitle?: string;
  onViewModeChange?: (mode: ViewMode) => void;
  onSave?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  // Show editor features only when in document view
  showEditorFeatures?: boolean;
  hideSidebarToggle?: boolean;
  isViewOnly?: boolean;
  className?: string;
}

export function Header({
  viewMode = "split",
  saveStatus = "saved",
  lastSaved,
  isRealtimeConnected = false,
  realtimeUserCount = 0,
  documentTitle,
  onViewModeChange,
  onShare,
  onDownload,
  showEditorFeatures = false,
  hideSidebarToggle = false,
  isViewOnly = false,
  className
}: HeaderProps) {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = useCallback(() => {
    logout();
  }, [logout]);

  const { text: statusText, className: statusClassName } = useMemo(() => {
    switch (saveStatus) {
      case "saving":
        return { text: "Saving...", className: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" };
      case "error":
        return { text: "Error saving", className: "bg-red-500/20 text-red-600 dark:text-red-400" };
      default:
        return { text: "Saved", className: "bg-green-500/20 text-green-600 dark:text-green-400" };
    }
  }, [saveStatus]);

  return (
    <>
      <header 
        className={cn(
          "h-14 border-b bg-background flex items-center justify-between px-4",
          className
        )}
      >
        {/* Left side - Logo and title */}
        <div className="flex items-center gap-3">
          {/* Sidebar trigger */}
          {!hideSidebarToggle && (
            <SidebarTrigger className="h-9 w-9" />
          )}
          
          {/* Logo - link on all devices */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-semibold">RefMD</h1>
          </Link>
          {!showEditorFeatures && (
            <span className="text-sm text-muted-foreground hidden lg:inline">
              Collaborative Markdown Editor
            </span>
          )}
        </div>

        {/* Center - Document info and realtime status (only for editor) */}
        {showEditorFeatures && (
          <div className="hidden sm:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden xl:inline">{documentTitle || 'Untitled Document'}</span>
            
            {/* Save status */}
            <span className={cn("text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex items-center gap-1", statusClassName)}>
              {saveStatus === "saving" && (
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
              )}
              <span className="hidden sm:inline">{statusText}</span>
              <span className="sm:hidden">
                {saveStatus === "saving" ? "..." : saveStatus === "error" ? "!" : "✓"}
              </span>
            </span>
            
            {/* Realtime connection status */}
            <div className="flex items-center gap-1">
              {isRealtimeConnected ? (
                <Wifi className="w-3 h-3 text-green-500" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-500" />
              )}
              <span className={cn(
                "text-xs hidden sm:inline",
                isRealtimeConnected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {isRealtimeConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            
            {/* User count */}
            {isRealtimeConnected && realtimeUserCount > 1 && (
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-500" />
                <span className="text-xs text-blue-600 dark:text-blue-400 hidden md:inline">
                  {realtimeUserCount} {realtimeUserCount === 1 ? 'person' : 'people'} editing
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 md:hidden">
                  {realtimeUserCount}
                </span>
              </div>
            )}
            
            {lastSaved && saveStatus === "saved" && (
              <span className="text-xs hidden xl:inline">
                {new Date(lastSaved).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
        
        {/* Mobile status indicators - shown inline on mobile */}
        {showEditorFeatures && (
          <div className="flex sm:hidden items-center gap-2 text-sm text-muted-foreground mx-2">
            {/* Save status icon only */}
            <span className={cn("text-xs px-1.5 py-0.5 rounded", statusClassName)}>
              {saveStatus === "saving" ? "..." : saveStatus === "error" ? "!" : "✓"}
            </span>
            
            {/* Connection icon */}
            {isRealtimeConnected ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            
            {/* User count icon with number only */}
            {isRealtimeConnected && realtimeUserCount > 1 && (
              <div className="flex items-center gap-0.5">
                <Users className="w-3 h-3 text-blue-500" />
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {realtimeUserCount}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Right side - Actions and user info */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Editor features */}
          {showEditorFeatures && (
            <div className="flex items-center gap-1 sm:gap-2">
              {/* View mode buttons - Hidden on mobile, disabled for view-only */}
              {!isViewOnly && (
                <div className="hidden md:flex items-center rounded-md border">
                  <Button
                    onClick={() => onViewModeChange?.("editor")}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-2 rounded-none rounded-l-md",
                      viewMode === "editor" && "bg-accent text-accent-foreground"
                    )}
                    title="Editor only"
                  >
                    <FileCode className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => onViewModeChange?.("split")}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-2 rounded-none border-x",
                      viewMode === "split" && "bg-accent text-accent-foreground"
                    )}
                    title="Split view"
                  >
                    <Columns className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => onViewModeChange?.("preview")}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-2 rounded-none rounded-r-md",
                      viewMode === "preview" && "bg-accent text-accent-foreground"
                    )}
                    title="Preview only"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* View-only indicator */}
              {isViewOnly && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md border">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm font-medium">View Only</span>
                </div>
              )}

              <div className="hidden md:block w-px h-6 bg-border mx-1" />
              
              {/* Desktop actions */}
              <Button
                onClick={onShare}
                variant="ghost"
                size="icon"
                className="hidden lg:flex h-9 w-9"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              
              <Button
                onClick={onDownload}
                variant="ghost"
                size="icon"
                className="hidden lg:flex h-9 w-9"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>

              <div className="hidden sm:block w-px h-6 bg-border mx-1" />
            </div>
          )}
          
          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title={mounted ? (isDarkMode ? "Light mode" : "Dark mode") : "Toggle theme"}
          >
            {mounted ? (isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />) : <Sun className="h-4 w-4" />}
          </Button>

          {/* GitHub link - only when not showing editor features */}
          {!showEditorFeatures && (
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:block p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              title="View on GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          )}

          {/* User menu */}
          {user && (
            <div className="flex items-center gap-1">
              <div className="hidden sm:block w-px h-6 bg-border mx-1" />
              {/* Desktop: Dropdown menu */}
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user?.name || 'User'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Mobile: Avatar that opens mobile menu */}
              <Button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                variant="ghost" 
                className="relative h-8 w-8 rounded-full md:hidden"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </div>
          )}
          
          {/* Mobile menu button removed - functionality moved to logo */}
        </div>
      </header>
      
      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-64 bg-background border-l shadow-xl z-50 md:hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Menu</h2>
              <Button
                onClick={() => setMobileMenuOpen(false)}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* View mode section (only for editor and not view-only) */}
              {showEditorFeatures && !isViewOnly && (
                <div>
                  <h3 className="text-sm font-medium mb-2">View Mode</h3>
                  <div className="space-y-1">
                    <Button
                      onClick={() => {
                        onViewModeChange?.("editor");
                        setMobileMenuOpen(false);
                      }}
                      variant={viewMode === "editor" ? "secondary" : "ghost"}
                      className="w-full justify-start"
                    >
                      <FileCode className="h-4 w-4 mr-2" />
                      Editor
                    </Button>
                    <Button
                      onClick={() => {
                        onViewModeChange?.("preview");
                        setMobileMenuOpen(false);
                      }}
                      variant={viewMode === "preview" ? "secondary" : "ghost"}
                      className="w-full justify-start"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </div>
                </div>
              )}

              {/* View-only indicator (mobile) */}
              {showEditorFeatures && isViewOnly && (
                <div>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md border">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm font-medium">View Only</span>
                  </div>
                </div>
              )}
              
              {/* Actions section (only for editor) */}
              {showEditorFeatures && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Actions</h3>
                  <div className="space-y-1">
                    <Button
                      onClick={() => {
                        onShare?.();
                        setMobileMenuOpen(false);
                      }}
                      variant="ghost"
                      className="w-full justify-start"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button
                      onClick={() => {
                        onDownload?.();
                        setMobileMenuOpen(false);
                      }}
                      variant="ghost"
                      className="w-full justify-start"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              )}

              {/* GitHub link section (only when not showing editor features) */}
              {!showEditorFeatures && (
                <div className="border-t pt-4">
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Github className="h-4 w-4" />
                    <span>GitHub</span>
                  </a>
                </div>
              )}
              
              {/* User section */}
              {user && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Account</h3>
                  <div className="text-sm text-muted-foreground mb-2">
                    {user?.name || user?.email}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}