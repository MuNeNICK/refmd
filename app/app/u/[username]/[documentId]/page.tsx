import { notFound } from 'next/navigation';
import { getPublicApiClient } from '@/lib/api';
import { PublicDocumentPage } from '@/components/public/public-document-page';

interface PublicDocumentPageProps {
  params: Promise<{
    username: string;
    documentId: string;
  }>;
}

export default async function PublicDocument({ params }: PublicDocumentPageProps) {
  const { username, documentId } = await params;
  
  try {
    const api = getPublicApiClient();
    const document = await api.publicDocuments.getPublicDocument(username, documentId);
    
    return <PublicDocumentPage document={document} />;
  } catch (error) {
    console.error('Error fetching public document:', error);
    notFound();
  }
}

export async function generateMetadata({ params }: PublicDocumentPageProps) {
  const { username, documentId } = await params;
  
  return {
    title: `Document ${documentId} by ${username}`,
    description: `Public document page`,
  };
}