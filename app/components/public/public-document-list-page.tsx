"use client";

import React from 'react';
import Link from 'next/link';
import { Calendar, FileText, Globe, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { PublicDocumentSummary } from '@/lib/api/client';

interface PublicDocumentListPageProps {
  username: string;
  documents: PublicDocumentSummary[];
  total: number;
  limit: number;
  offset: number;
}

export function PublicDocumentListPage({ 
  username, 
  documents, 
  total, 
  limit, 
  offset 
}: PublicDocumentListPageProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  
  const generatePageUrl = (newOffset: number) => {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    params.set('offset', newOffset.toString());
    return `/u/${username}?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/" 
                className="text-xl font-bold text-primary hover:opacity-80"
              >
                RefMD
              </Link>
              <Badge variant="outline" className="gap-1">
                <Globe className="w-3 h-3" />
                Public Documents
              </Badge>
            </div>
            
            <Button variant="outline" asChild>
              <Link href="/">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open RefMD
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* User Header */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="text-lg">
                {username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{username}</h1>
              <p className="text-muted-foreground">
                {total} public document{total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Separator />
        </div>

        {/* Documents List */}
        {documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No public documents</h2>
            <p className="text-muted-foreground">
              {username} hasn&apos;t published any documents yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => {
              const publishedDate = new Date(doc.published_at || '').toLocaleDateString();
              const updatedDate = new Date(doc.updated_at || '').toLocaleDateString();
              
              return (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <CardTitle className="text-xl">
                          <Link 
                            href={`/u/${username}/${doc.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {doc.title}
                          </Link>
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Published {publishedDate}</span>
                          </div>
                          
                          {publishedDate !== updatedDate && (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <span>Updated {updatedDate}</span>
                            </>
                          )}
                          
                          <Separator orientation="vertical" className="h-3" />
                          <Badge variant="secondary" className="text-xs">
                            {doc.document_type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} documents
            </p>
            
            <div className="flex items-center gap-2">
              {currentPage > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={generatePageUrl(Math.max(0, offset - limit))}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Link>
                </Button>
              )}
              
              <span className="text-sm text-muted-foreground px-3">
                Page {currentPage} of {totalPages}
              </span>
              
              {currentPage < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={generatePageUrl(offset + limit)}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t">
          <div className="text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <span>Powered by</span>
              <Link 
                href="/" 
                className="font-medium text-primary hover:opacity-80"
              >
                RefMD
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}