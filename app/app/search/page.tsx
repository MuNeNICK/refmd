'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, StickyNote, Hash } from 'lucide-react';
import { getApiClient } from '@/lib/api';
import { Document } from '@/lib/api/client/models/Document';
import { ScrapPost } from '@/lib/api/client/models/ScrapPost';
import { DocumentCard } from '@/components/document/document-card';
import { ScrapPostComponent } from '@/components/scrap/scrap-post';
import { useAuth } from '@/lib/auth/authContext';
import { useRouter } from 'next/navigation';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const tagName = searchParams.get('tag');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [scrapPosts, setScrapPosts] = useState<ScrapPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!tagName) {
      router.push('/');
      return;
    }

    const fetchTagContent = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const client = getApiClient();
        const result = await client.tags.getAllByTag(tagName);
        
        // Fetch full document details
        if (result.documents && result.documents.length > 0) {
          const documentPromises = result.documents.map(id => 
            client.documents.getDocument(id)
          );
          const docs = await Promise.all(documentPromises);
          setDocuments(docs);
        }
        
        // For now, we only have IDs for scrap posts
        // In a real implementation, we'd need to fetch full post details
        setScrapPosts([]);
      } catch (err) {
        console.error('Failed to fetch tag content:', err);
        setError('Failed to load content for this tag');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTagContent();
  }, [tagName, router]);

  if (!tagName) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  const totalCount = documents.length + scrapPosts.length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">#{tagName}</h1>
        </div>
        <p className="text-muted-foreground">
          {totalCount} {totalCount === 1 ? 'item' : 'items'} found
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="all">
            All ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="scraps">
            <StickyNote className="h-4 w-4 mr-2" />
            Scraps ({scrapPosts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {documents.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">Documents</h2>
              <div className="grid gap-4">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onClick={() => router.push(`/document/${doc.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {scrapPosts.length > 0 && (
            <div className="space-y-4 mt-8">
              <h2 className="text-lg font-semibold text-muted-foreground">Scrap Posts</h2>
              <div className="space-y-4">
                {scrapPosts.map((post) => (
                  <ScrapPostComponent
                    key={post.id}
                    post={post}
                    currentUserId={user?.id}
                    currentUserName={user?.name}
                    isViewOnly={true}
                  />
                ))}
              </div>
            </div>
          )}
          
          {totalCount === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No content found with this tag
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {documents.length > 0 ? (
            <div className="grid gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onClick={() => router.push(`/document/${doc.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No documents found with this tag
            </div>
          )}
        </TabsContent>

        <TabsContent value="scraps" className="space-y-4">
          {scrapPosts.length > 0 ? (
            <div className="space-y-4">
              {scrapPosts.map((post) => (
                <ScrapPostComponent
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  currentUserName={user?.name}
                  isViewOnly={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No scrap posts found with this tag
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}