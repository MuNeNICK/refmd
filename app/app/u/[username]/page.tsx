import { getPublicApiClient } from '@/lib/api';
import { PublicDocumentListPage } from '@/components/public/public-document-list-page';

interface UserPublicDocumentsPageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function UserPublicDocuments({ 
  params
}: UserPublicDocumentsPageProps) {
  const { username } = await params;
  
  try {
    const api = getPublicApiClient();
    const response = await api.publicDocuments.listUserPublicDocuments(username);
    
    return (
      <PublicDocumentListPage 
        username={username}
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
        <h1>{username}'s Public Documents</h1>
        <p>No public documents found or an error occurred.</p>
      </div>
    );
  }
}

export async function generateMetadata({ params }: UserPublicDocumentsPageProps) {
  const { username } = await params;
  
  return {
    title: `${username}'s Public Documents`,
    description: `Browse public documents shared by ${username}`,
  };
}