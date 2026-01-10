import * as React from "react"
import { GalleryVerticalEnd, Wrench } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { SearchForm } from "./search-form"
import { useAuth } from "@/contexts/auth-context"
import { useMenu } from "@/contexts/menu-context"
import { getMenuIconForMenu } from "@/lib/menu-icon-mapper"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"

// Static teams data
const teams = [
  {
    name: "Munify",
    logo: GalleryVerticalEnd,
    plan: "Enterprise",
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [query, setQuery] = React.useState("")
  const { user } = useAuth()
  const { menus, loading, error } = useMenu()
  const q = query.trim().toLowerCase()

  // Convert backend menus to sidebar format
  const navMainItems = React.useMemo(() => {
    if (!menus || menus.length === 0) {
      return []
    }

    return menus
      .map((menu) => {
        // Filter submenus based on search query
        const filteredSubmenus = menu.submenus
          .filter((submenu) => 
            submenu.submenu_name.toLowerCase().includes(q) ||
            menu.menu_name.toLowerCase().includes(q)
          )
          .map((submenu) => ({
            title: submenu.submenu_name,
            url: submenu.route.startsWith('/') ? submenu.route : `/${submenu.route}`,
          }))

        // Only include menu if it has submenus (after filtering)
        if (filteredSubmenus.length === 0 && q) {
          return null
        }

        return {
          title: menu.menu_name,
          url: filteredSubmenus.length > 0 ? filteredSubmenus[0].url : "#",
          icon: getMenuIconForMenu(menu.menu_name, menu.menu_icon),
          items: filteredSubmenus,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [menus, q])

  // Static projects section (Settings)
  const projects = [
    {
      name: "Settings",
      url: "/main/settings",
      icon: Wrench,
    },
  ]

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(q))

  // Extract user data from auth context
  const userData = {
    name: user?.data?.login,
    email: user?.data?.email,
    avatar: "/avatars/shadcn.jpg",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
        <div className="group-data-[collapsible=icon]:hidden">
          <SearchForm value={query} onChange={setQuery} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Spinner size={24} />
            <span className="ml-2 text-sm text-muted-foreground">Loading menus...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="m-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : navMainItems.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No menus available
          </div>
        ) : (
          <>
            <NavMain items={navMainItems} />
            <NavProjects projects={filteredProjects} />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
