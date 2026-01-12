import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useMenu } from '@/contexts/menu-context'
import { useAuth } from '@/contexts/auth-context'
import { Spinner } from '@/components/ui/spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * ProtectedRoute Component
 * Protects routes based on user authentication and menu access
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
}) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { hasAccessToRoute, loading: menuLoading } = useMenu()
  const location = useLocation()

  // Wait for auth to load
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
        <span className="ml-2">Loading...</span>
      </div>
    )
  }

  // Check if user is authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Wait for menus to load
  if (menuLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
        <span className="ml-2">Loading menus...</span>
      </div>
    )
  }

  // Check if user has access to current route
  const currentRoute = location.pathname
  
  // Allow access to main dashboard even if not in menu (fallback)
  if (currentRoute === '/main') {
    return <>{children}</>
  }
  
  // Check access - backend routes should match frontend routes exactly
  const hasAccess = hasAccessToRoute(currentRoute)

  if (!hasAccess) {
    // Redirect to dashboard if no access
    return <Navigate to="/main" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute

