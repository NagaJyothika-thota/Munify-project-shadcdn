import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Copyright from "@/components/Copyright";
import logoBig from "@/assets/logo-big.png";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useMenu } from "@/contexts/menu-context";
import { useEffect } from "react";

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasAccessToRoute } = useMenu()

  // Check route access when location changes
  // Note: This is a secondary check - ProtectedRoute already handles route protection
  useEffect(() => {
    // Only check if we're not already on the main dashboard
    if (location.pathname !== '/main' && location.pathname.startsWith('/main')) {
      const hasAccess = hasAccessToRoute(location.pathname)
      if (!hasAccess) {
        // If user doesn't have access, redirect to dashboard
        navigate('/main', { replace: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AppSidebar />

        <SidebarInset>
          <div className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <img src={logoBig} alt="Munify" className="h-8 w-auto" />
            </div>
            <div>
              <Button onClick={()=>navigate("/main/admin/invitation")} size={"sm"} className="mr-2">User Invitation</Button>
              <ThemeToggle />
            </div>
          </div>
          <div className="p-6 flex-1">
            <Outlet />
          </div>
          <footer className="border-t bg-muted/50 py-2 px-6 mt-auto">
            <Copyright />
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  )
}


