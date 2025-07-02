"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import MainLayout from "@/components/layout/main-layout";
import { FileText, Clock } from "lucide-react";
import type { Document } from "@/lib/api/client";

interface DashboardClientProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  initialDocuments: Document[];
}

export default function DashboardClient({ user, initialDocuments }: DashboardClientProps) {
  const router = useRouter();
  const [documents] = useState<Document[]>(initialDocuments);

  const handleDocumentClick = (document: Document) => {
    if (!document.id) return;
    
    if (document.type === 'scrap') {
      router.push(`/scrap/${document.id}`);
    } else {
      router.push(`/document/${document.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    // Use consistent date format to avoid hydration mismatch
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  return (
    <MainLayout
      showEditorFeatures={false}
    >
      <div className="h-full bg-background">
        {/* Desktop view - scrollable recent documents */}
        <div className="hidden lg:block h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-12">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Select a document from the sidebar or create a new one to get started.
              </p>
            </div>
            
            {/* Recent documents section */}
            {documents.length > 0 ? (
              <div>
                <h2 className="text-lg font-semibold mb-4">Recent Documents</h2>
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors bg-card"
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {doc.title || 'Untitled Document'}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {doc.updated_at && formatDate(doc.updated_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {documents.length >= 10 && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing 10 most recent documents. Use the file tree on the left to see all documents.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="border rounded-lg p-8 bg-card">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No documents yet</p>
                  <button 
                    className="text-sm text-primary hover:underline"
                    onClick={() => router.push('/editor')}
                  >
                    Create your first document
                  </button>
                </div>
              </div>
            )}
            
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center mt-8">
              Your documents are organized in the file tree on the left.
            </div>
          </div>
        </div>
        
        {/* Mobile view - show file list */}
        <div className="lg:hidden p-4">
          <h1 className="text-2xl font-bold mb-4">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Select a document to get started:
          </p>
          
          {/* Recent documents for mobile */}
          <div className="border rounded-lg bg-card">
            <div className="p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Tap the RefMD logo in the top left to access the full file tree, or select a recent document below.
              </div>
              
              {documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="p-3 border rounded hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {doc.title || 'Untitled Document'}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {doc.updated_at && formatDate(doc.updated_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {documents.length >= 10 && (
                    <div className="text-center pt-2">
                      <button 
                        className="text-sm text-primary hover:underline"
                        onClick={() => {/* Could implement show more or navigate to full list */}}
                      >
                        View all documents
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No documents yet</p>
                  <button 
                    className="text-sm text-primary hover:underline"
                    onClick={() => router.push('/editor')}
                  >
                    Create your first document
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}