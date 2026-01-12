import apiService from './api'

/**
 * Menu Service
 * Handles fetching user menus from backend based on role and organization type
 */

export interface Submenu {
  id: number
  submenu_name: string
  submenu_icon?: string
  route: string
  menu_id: number
  display_order?: number
  status: string
}

export interface UserMenu {
  menu_id: number
  menu_name: string
  menu_icon?: string
  submenus: Submenu[]
}

export interface UserMenuResponse {
  status: string
  message: string
  data: UserMenu[]
}

class MenuService {
  /**
   * Get user menus based on role and organization type
   * Backend will extract role_id and org_type from JWT token if not provided
   */
  async getUserMenus(roleId?: number, orgType?: string): Promise<UserMenu[]> {
    try {
      const params: Record<string, any> = {}
      
      // Add query params only if provided (otherwise backend extracts from token)
      if (roleId) {
        params.role_id = roleId
      }
      if (orgType) {
        params.org_type = orgType
      }

      const response = await apiService.get<UserMenuResponse>(
        '/menus/user-menus',
        Object.keys(params).length > 0 ? params : undefined
      )

      if (response.status === 'success') {
        return response.data || []
      }
      
      throw new Error(response.message || 'Failed to fetch menus')
    } catch (error: any) {
      console.error('Error fetching user menus:', error)
      
      if (error.response?.status === 401) {
        // Handle unauthorized - token might be expired
        throw new Error('Unauthorized: Please login again')
      }
      
      throw error
    }
  }
}

export default new MenuService()

