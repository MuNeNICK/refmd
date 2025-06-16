import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PageClient from "./page-client";
import { getApiUrl } from "@/lib/config";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getDocument(documentId: string, token?: string) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth-token");
  
  try {
    const apiUrl = getApiUrl();
    const endpoint = token 
      ? `${apiUrl}/documents/${documentId}?token=${token}`
      : `${apiUrl}/documents/${documentId}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (!token && authCookie?.value) {
      headers['Authorization'] = `Bearer ${authCookie.value}`;
    }
    
    
    const response = await fetch(endpoint, {
      headers,
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch document: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      if (response.status === 403 || response.status === 401) {
        redirect("/");
      }
      return null;
    }
    
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error('Failed to fetch document:', error);
    return null;
  }
}

export default async function DocumentPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const documentId = resolvedParams.id;
  const token = resolvedSearchParams.token as string | undefined;
  
  const document = await getDocument(documentId, token);
  
  return (
    <PageClient 
      documentId={documentId}
      initialDocument={document}
      token={token}
    />
  );
}