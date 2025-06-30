import { Suspense } from "react";
import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";
import DashboardSkeleton from "./dashboard-skeleton";
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
      // Enable caching for 5 seconds to improve performance
      next: { revalidate: 5 }
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

// Separate component for async data loading
async function DashboardContent() {
  const [user, initialDocuments] = await Promise.all([
    getUser(),
    getRecentDocuments()
  ]);
  
  return <DashboardClient user={user} initialDocuments={initialDocuments} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}