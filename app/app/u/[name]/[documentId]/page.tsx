import { notFound } from 'next/navigation';
import { getPublicApiClient } from '@/lib/api';
import { PublicDocumentPage } from '@/components/public/public-document-page';
import { PublicScrapPage } from '@/components/public/public-scrap-page';

interface PublicDocumentPageProps {
  params: Promise<{
    name: string;
    documentId: string;
  }>;
}

export default async function PublicDocument({ params }: PublicDocumentPageProps) {
  const { name, documentId } = await params;
  
  try {
    const api = getPublicApiClient();
    const response = await api.publicDocuments.getPublicDocument(name, documentId);
    
    // Check if it's a scrap or document based on document_type
    if (response.document_type === 'scrap') {
      return <PublicScrapPage document={response} />;
    } else {
      return <PublicDocumentPage document={response} />;
    }
  } catch (error) {
    console.error('Error fetching public document:', error);
    notFound();
  }
}

export async function generateMetadata({ params }: PublicDocumentPageProps) {
  const { name, documentId } = await params;
  
  try {
    const api = getPublicApiClient();
    const response = await api.publicDocuments.getPublicDocument(name, documentId);
    
    return {
      title: response.title || `${response.document_type === 'scrap' ? 'Scrap' : 'Document'} by ${name}`,
      description: response.document_type === 'scrap' ? 'Public scrap page' : 'Public document page',
    };
  } catch {
    return {
      title: `Document ${documentId} by ${name}`,
      description: `Public document page`,
    };
  }
}