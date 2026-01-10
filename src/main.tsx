import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { ThemeProvider } from '@/contexts/theme-context'
import { AuthProvider } from '@/contexts/auth-context'
import { MenuProvider } from '@/contexts/menu-context'
import { Toaster } from '@/components/ui/toaster'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'

const isDevelopment = import.meta.env.DEV

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MenuProvider>
          <ThemeProvider defaultTheme="system" storageKey="munify-ui-theme">
            <RouterProvider router={router} />
            <Toaster />
          </ThemeProvider>
        </MenuProvider>
      </AuthProvider>
      {isDevelopment && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)
