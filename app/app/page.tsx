import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  
  // Check if this is a redirect from a shared link
  if (params.token) {
    // This shouldn't happen, but if it does, preserve the token
    redirect(`/auth/signin?token=${params.token}`);
  }
  
  // Check for auth token in cookies
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth-token");
  
  if (authCookie?.value) {
    // User has auth token, redirect to dashboard
    redirect("/dashboard");
  } else {
    // User is not authenticated, redirect to signin
    redirect("/auth/signin");
  }
}