/**
 * Menu Icon Mapper
 * Maps backend icon names to Lucide React icons
 */
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  Settings,
  Wrench,
  Table,
  Shield,
  Handshake,
  FileText,
  Activity,
  Users,
  Bell,
  CheckCircle,
  Eye,
  Plus,
  BarChart3,
  TrendingUp,
  MessageSquare,
  Calendar,
  MapPin,
  Star,
  Heart,
  Download,
  Upload,
  Search,
  Filter,
  X,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'

/**
 * Icon mapping from backend icon names to Lucide icons
 */
const iconMap: Record<string, LucideIcon> = {
  // Dashboard icons
  dashboard: LayoutDashboard,
  'layout-dashboard': LayoutDashboard,
  overview: LayoutDashboard,
  
  // Project icons
  projects: FolderKanban,
  'folder-kanban': FolderKanban,
  'project': FolderKanban,
  'live': CheckCircle,
  'funded': TrendingUp,
  'favorites': Heart,
  'star': Star,
  
  // Municipality icons
  municipalities: Building2,
  'building2': Building2,
  'building': Building2,
  'municipality': Building2,
  
  // Lender icons
  lenders: Handshake,
  'handshake': Handshake,
  'lender': Handshake,
  
  // Reports icons
  reports: FileText,
  'file-text': FileText,
  'report': FileText,
  'document': FileText,
  
  // Master/Admin icons
  master: Shield,
  'shield': Shield,
  'admin': Settings,
  'settings': Settings,
  'wrench': Wrench,
  
  // Tracking/Monitoring icons
  trackings: Activity,
  'activity': Activity,
  'monitoring': Activity,
  'tracking': Activity,
  'lifecycle': Activity,
  
  // Component icons
  components: Table,
  'table': Table,
  'component': Table,
  
  // Common icons
  users: Users,
  'user': Users,
  'notifications': Bell,
  'bell': Bell,
  'eye': Eye,
  'plus': Plus,
  'add': Plus,
  'create': Plus,
  'analytics': BarChart3,
  'chart': BarChart3,
  'message': MessageSquare,
  'qa': MessageSquare,
  'calendar': Calendar,
  'location': MapPin,
  'map': MapPin,
  'download': Download,
  'upload': Upload,
  'search': Search,
  'filter': Filter,
  'close': X,
  'more': MoreHorizontal,
}

/**
 * Get Lucide icon component from backend icon name
 * Returns LayoutDashboard as default if icon not found
 */
export function getMenuIcon(iconName?: string): LucideIcon {
  if (!iconName) {
    return LayoutDashboard
  }

  const normalizedName = iconName.toLowerCase().trim()
  return iconMap[normalizedName] || LayoutDashboard
}

/**
 * Get icon for menu item
 */
export function getMenuIconForMenu(menuName: string, iconName?: string): LucideIcon {
  if (iconName) {
    return getMenuIcon(iconName)
  }

  // Fallback: try to infer from menu name
  const normalizedMenuName = menuName.toLowerCase()
  
  if (normalizedMenuName.includes('dashboard')) return LayoutDashboard
  if (normalizedMenuName.includes('project')) return FolderKanban
  if (normalizedMenuName.includes('municipal')) return Building2
  if (normalizedMenuName.includes('lender')) return Handshake
  if (normalizedMenuName.includes('report')) return FileText
  if (normalizedMenuName.includes('master')) return Shield
  if (normalizedMenuName.includes('admin')) return Settings
  if (normalizedMenuName.includes('tracking') || normalizedMenuName.includes('monitoring')) return Activity
  if (normalizedMenuName.includes('component')) return Table
  if (normalizedMenuName.includes('setting')) return Settings
  
  return LayoutDashboard
}

