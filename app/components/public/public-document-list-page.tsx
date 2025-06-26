"use client";

import React from 'react';
import Link from 'next/link';
import { Calendar, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { PublicDocumentSummary } from '@/lib/api/client';
import { PublicPageLayout } from './PublicPageLayout';
import { formatPublicDate } from '@/lib/utils/date';

interface PublicDocumentListPageProps {
  username: string;  // This is actually the name now
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
    <PublicPageLayout 
      pageType="list"
      title={`@${username}`}
      subtitle={`${total} public ${total === 1 ? 'document' : 'documents'}`}
    >

      {/* Document List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8">
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Link href={`/u/${username}/${doc.id}`}>
                  <CardTitle className="flex items-start justify-between gap-4 hover:text-blue-600 dark:hover:text-blue-400">
                    <span className="flex items-center gap-2">
                      <FileText className="w-5 h-5 shrink-0" />
                      {doc.title}
                    </span>
                  </CardTitle>
                </Link>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Published {formatPublicDate(doc.published_at)}</span>
                  </div>
                  {doc.published_at !== doc.updated_at && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <span>Updated {formatPublicDate(doc.updated_at)}</span>
                    </>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              asChild={currentPage > 1}
            >
              {currentPage > 1 ? (
                <Link href={generatePageUrl((currentPage - 2) * limit)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Link>
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </>
              )}
            </Button>
            
            <span className="text-sm text-gray-600 dark:text-gray-400 px-3">
              Page {currentPage} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              asChild={currentPage < totalPages}
            >
              {currentPage < totalPages ? (
                <Link href={generatePageUrl(currentPage * limit)}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </PublicPageLayout>
  );
}