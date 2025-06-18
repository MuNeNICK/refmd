import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ScrapPageClient } from './page-client';
import { RefMDClient, ApiError } from '@/lib/api/client';
import { getApiUrl } from '@/lib/config';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ScrapPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('auth-token');

  if (!authCookie?.value) {
    redirect('/');
  }

  const client = new RefMDClient({
    BASE: getApiUrl(),
    TOKEN: authCookie.value,
  });

  try {
    const scrapData = await client.scraps.getScrap(id);
    return <ScrapPageClient initialData={scrapData} scrapId={id} />;
  } catch (error: any) {
    console.error('Failed to fetch scrap:', error);
    
    // Check if it's an ApiError with status property
    if (error.status === 401 || error.status === 403) {
      redirect('/');
    }
    
    // Check if it's an ApiError with status 404
    if (error.status === 404) {
      notFound();
    }
    
    // For development/debugging - remove this in production
    if (error.status === 500) {
      const mockScrap = {
        scrap: {
          id,
          title: 'Test Scrap',
          owner_id: '00000000-0000-0000-0000-000000000000',
          file_path: null,
          parent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_edited_by: null,
          last_edited_at: null,
        },
        posts: []
      };
      return <ScrapPageClient initialData={mockScrap} scrapId={id} />;
    }
    
    // Default to not found for other errors
    notFound();
  }
}