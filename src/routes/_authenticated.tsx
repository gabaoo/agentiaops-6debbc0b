import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { InstancesProvider, useInstances } from "@/hooks/use-instances";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [session, loading, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <InstancesProvider>
      <OnboardingGate>
        <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 sticky top-0 bg-background/80 backdrop-blur z-20">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">AgentOps</span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto"><Outlet /></main>
        </div>
      </div>
        </SidebarProvider>
      </OnboardingGate>
    </InstancesProvider>
  );
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { instances, loading } = useInstances();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (instances.length === 0 && path !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [loading, instances, path, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}