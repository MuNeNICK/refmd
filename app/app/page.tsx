import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LandingPage from "./landing-page";

export default async function Home() {
  // Check for auth token in cookies
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth");
  
  if (authCookie?.value) {
    // User has auth token, redirect to dashboard
    redirect("/dashboard");
  } else {
    // User is not authenticated, redirect to signin
    redirect("/auth/signin");
  }
  
  // This component will never render due to redirects above
  // But Next.js requires a return statement
  return <LandingPage />;
}