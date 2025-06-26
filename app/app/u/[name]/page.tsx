import { getPublicApiClient } from '@/lib/api';
import { PublicDocumentListPage } from '@/components/public/public-document-list-page';

interface UserPublicDocumentsPageProps {
  params: Promise<{
    name: string;
  }>;
}

export default async function UserPublicDocuments({ 
  params
}: UserPublicDocumentsPageProps) {
  const { name } = await params;
  
  try {
    const api = getPublicApiClient();
    const response = await api.publicDocuments.listUserPublicDocuments(name);
    
    return (
      <PublicDocumentListPage 
        username={name}
        documents={response.documents || []}
        total={response.total || 0}
        limit={20}
        offset={0}
      />
    );
  } catch (error) {
    console.error('Error fetching public documents:', error);
    // Simple fallback UI for now
    return (
      <div style={{ padding: '20px' }}>
        <h1>{name}&apos;s Public Documents</h1>
        <p>No public documents found or an error occurred.</p>
      </div>
    );
  }
}

export async function generateMetadata({ params }: UserPublicDocumentsPageProps) {
  const { name } = await params;
  
  return {
    title: `${name}'s Public Documents`,
    description: `Browse public documents shared by ${name}`,
  };
}