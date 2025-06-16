import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";
import { getApiUrl } from "@/lib/config";

async function getUser() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth-token");
  
  // Parse JWT to get user info (simplified - in production, verify the token)
  try {
    const payload = JSON.parse(Buffer.from(authCookie!.value.split('.')[1], 'base64').toString());
    return {
      id: payload.sub,
      name: payload.name || 'User',
      email: payload.email
    };
  } catch {
    throw new Error("Invalid token");
  }
}

async function getRecentDocuments() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth-token");
  
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/documents`, {
      headers: {
        'Authorization': `Bearer ${authCookie!.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.data?.slice(0, 10) || [];
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return [];
  }
}

export default async function DashboardPage() {
  const user = await getUser();
  const initialDocuments = await getRecentDocuments();
  
  return <DashboardClient user={user} initialDocuments={initialDocuments} />;
}