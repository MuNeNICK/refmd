"use client";

import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Users, Zap } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  return (
    <MainLayout
      showEditorFeatures={false}
    >
      <div className="h-full bg-gradient-to-br from-background to-muted/20">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Welcome to <span className="text-primary">RefMD</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Collaborative Markdown Editor with real-time editing, file management, and seamless sharing.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg" 
                onClick={() => router.push("/dashboard")}
                className="text-lg px-8 py-6"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => router.push("/editor")}
                className="text-lg px-8 py-6"
              >
                Start Writing
                <FileText className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Real-time Editing</h3>
                <p className="text-muted-foreground">
                  Collaborate with others in real-time with live cursor tracking and instant updates.
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">File Management</h3>
                <p className="text-muted-foreground">
                  Organize your documents with an intuitive file tree and upload attachments easily.
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Team Collaboration</h3>
                <p className="text-muted-foreground">
                  Share documents, track changes, and work together seamlessly across devices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}