import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ScrapPageClient } from './page-client';
import { RefMDClient } from '@/lib/api/client';
import { getApiUrl } from '@/lib/config';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ScrapPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token as string | undefined;
  
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('auth-token');

  // If no auth cookie and no share token, redirect to login
  if (!authCookie?.value && !token) {
    redirect('/');
  }

  const client = new RefMDClient({
    BASE: getApiUrl(),
    TOKEN: authCookie?.value,
  });

  try {
    // Try to fetch scrap with token if provided
    let scrapData;
    if (token) {
      // Fetch with share token
      const response = await fetch(`${getApiUrl()}/scraps/${id}?token=${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          notFound();
        }
        throw new Error('Failed to fetch scrap');
      }
      scrapData = await response.json();
    } else {
      // Fetch with auth
      scrapData = await client.scraps.getScrap(id);
    }
    
    return <ScrapPageClient initialData={scrapData} scrapId={id} shareToken={token} />;
  } catch (error: unknown) {
    console.error('Failed to fetch scrap:', error);
    
    // Check if it's an ApiError with status property
    const apiError = error as { status?: number };
    if (apiError.status === 401 || apiError.status === 403) {
      redirect('/');
    }
    
    // Check if it's an ApiError with status 404
    if (apiError.status === 404) {
      notFound();
    }
    
    // For development/debugging - remove this in production
    if (apiError.status === 500) {
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