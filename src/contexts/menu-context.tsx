import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import menuService, { type UserMenu } from '@/services/menuService'
import { useAuth } from './auth-context'
import { userStorage } from '@/lib/session-storage'

interface MenuContextType {
  menus: UserMenu[]
  loading: boolean
  error: string | null
  refreshMenus: () => Promise<void>
  hasAccessToRoute: (route: string) => boolean
  getAllRoutes: () => string[]
}

const MenuContext = createContext<MenuContextType | undefined>(undefined)

export function MenuProvider({ children }: { children: ReactNode }) {
  const [menus, setMenus] = useState<UserMenu[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { user, isAuthenticated } = useAuth()

  /**
   * Extract role_id and org_type from user object
   * Based on actual user data structure from session storage
   */
  const extractUserRoleInfo = () => {
    const storedUser = userStorage.get()
    // User data structure: { status, message, data: { userRoles, org_type, ... } }
    const userData = user?.data || storedUser?.data || storedUser

    if (!userData) {
      return { roleId: undefined, orgType: undefined }
    }

    // Extract role_id from userRoles array (exact structure: userRoles[0].roleId)
    const roleId = userData.userRoles?.[0]?.roleId || 
                   userData.roleId || 
                   userData.role_id ||
                   undefined

    // Extract org_type - backend sends: "Lender", "Municipality", "Munify", "Government"
    // But we need lowercase: "lender", "municipality", "munify", "government"
    let orgType = userData.org_type || 
                  userData.orgType || 
                  userData.organizationType ||
                  userData.organization_type

    // Convert to lowercase and normalize
    if (orgType) {
      const orgTypeLower = orgType.toLowerCase().trim()
      
      // Map to exact backend expected values
      if (orgTypeLower === 'lender' || orgTypeLower.includes('lender')) {
        orgType = 'lender'
      } else if (orgTypeLower === 'municipality' || orgTypeLower.includes('municipal')) {
        orgType = 'municipality'
      } else if (orgTypeLower === 'munify' || orgTypeLower.includes('munify') || orgTypeLower.includes('admin')) {
        orgType = 'munify'
      } else if (orgTypeLower === 'government' || orgTypeLower.includes('government') || orgTypeLower.includes('niua')) {
        orgType = 'government'
      } else {
        // If not recognized, keep original but lowercase
        orgType = orgTypeLower
      }
    } else {
      // Fallback: try to derive from userType or branchName
      if (userData.userType) {
        const userTypeLower = userData.userType.toLowerCase()
        if (userTypeLower === 'm' || userTypeLower.includes('municipal')) {
          orgType = 'municipality'
        } else if (userTypeLower === 'l' || userTypeLower.includes('lender')) {
          orgType = 'lender'
        } else if (userTypeLower === 'a' || userTypeLower.includes('admin') || userTypeLower.includes('munify')) {
          orgType = 'munify'
        } else if (userTypeLower.includes('government') || userTypeLower.includes('niua')) {
          orgType = 'government'
        }
      }
      
      // Also check branchName as fallback
      if (!orgType && userData.branchName) {
        const branchNameLower = userData.branchName.toLowerCase()
        if (branchNameLower.includes('lender')) {
          orgType = 'lender'
        } else if (branchNameLower.includes('municipal')) {
          orgType = 'municipality'
        } else if (branchNameLower.includes('munify') || branchNameLower.includes('admin')) {
          orgType = 'munify'
        }
      }
    }

    return { roleId, orgType }
  }

  const fetchMenus = async () => {
    if (!isAuthenticated || !user) {
      setLoading(false)
      setMenus([])
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { roleId, orgType } = extractUserRoleInfo()

      if (!roleId || !orgType) {
        console.warn('Missing roleId or orgType:', { roleId, orgType })
        // Still try to fetch - backend might extract from token
      }

      const userMenus = await menuService.getUserMenus(roleId, orgType)
      setMenus(userMenus)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load menus'
      setError(errorMessage)
      setMenus([])
      
      // Only show error if it's not a 401 (handled by auth interceptor)
      if (err.response?.status !== 401) {
        console.error('Failed to fetch menus:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMenus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const refreshMenus = async () => {
    await fetchMenus()
  }

  /**
   * Check if user has access to a specific route
   * Routes from backend should match frontend routes exactly (e.g., /main/projects)
   */
  const hasAccessToRoute = (route: string): boolean => {
    if (!menus || menus.length === 0) {
      return false
    }

    // Normalize route - ensure it starts with /main if it's a main route
    let normalizedRoute = route.trim()
    if (normalizedRoute.startsWith('/main')) {
      // Keep as is
    } else if (normalizedRoute.startsWith('/')) {
      // Add /main prefix if missing
      normalizedRoute = '/main' + normalizedRoute
    } else {
      // Add /main/ prefix if no leading slash
      normalizedRoute = '/main/' + normalizedRoute
    }

    return menus.some((menu) =>
      menu.submenus.some((submenu) => {
        const submenuRoute = submenu.route.trim()
        
        // Exact match (most common case)
        if (submenuRoute === normalizedRoute) {
          return true
        }
        
        // Check if route starts with submenu route (for nested routes)
        // Example: /main/projects matches /main/projects/live
        if (normalizedRoute.startsWith(submenuRoute + '/')) {
          return true
        }
        
        // Handle dynamic routes like /main/projects/:id
        // Convert submenu route pattern to regex
        // Example: /main/projects/:id -> /main/projects/[^/]+
        const pattern = submenuRoute.replace(/:[^/]+/g, '[^/]+')
        const regex = new RegExp(`^${pattern}(/.*)?$`)
        if (regex.test(normalizedRoute)) {
          return true
        }
        
        // Also check without /main prefix (in case backend sends routes without /main)
        const routeWithoutMain = normalizedRoute.replace(/^\/main/, '')
        const submenuWithoutMain = submenuRoute.replace(/^\/main/, '')
        
        if (submenuWithoutMain === routeWithoutMain) {
          return true
        }
        
        if (routeWithoutMain.startsWith(submenuWithoutMain + '/')) {
          return true
        }
        
        return false
      })
    )
  }

  /**
   * Get all accessible routes for the user
   */
  const getAllRoutes = (): string[] => {
    const routes: string[] = []
    menus.forEach((menu) => {
      menu.submenus.forEach((submenu) => {
        routes.push(submenu.route)
      })
    })
    return routes
  }

  return (
    <MenuContext.Provider
      value={{
        menus,
        loading,
        error,
        refreshMenus,
        hasAccessToRoute,
        getAllRoutes,
      }}
    >
      {children}
    </MenuContext.Provider>
  )
}

export function useMenu() {
  const context = useContext(MenuContext)
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider')
  }
  return context
}

