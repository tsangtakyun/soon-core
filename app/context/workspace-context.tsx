'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface WorkspaceContextType {
  activeWorkspaceId: string
  activeWorkspaceName: string
  setActiveWorkspace: (id: string, name: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  activeWorkspaceId: '',
  activeWorkspaceName: '',
  setActiveWorkspace: () => {},
})

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [activeWorkspaceName, setActiveWorkspaceName] = useState('')

  useEffect(() => {
    const saved = window.localStorage.getItem('soon_active_workspace')
    if (!saved) return

    try {
      const parsed = JSON.parse(saved) as { id?: string; name?: string }
      setActiveWorkspaceId(parsed.id ?? '')
      setActiveWorkspaceName(parsed.name ?? '')
    } catch {
      window.localStorage.removeItem('soon_active_workspace')
    }
  }, [])

  const setActiveWorkspace = useCallback((id: string, name: string) => {
    setActiveWorkspaceId(id)
    setActiveWorkspaceName(name)
    window.localStorage.setItem('soon_active_workspace', JSON.stringify({ id, name }))
  }, [])

  const value = useMemo(
    () => ({ activeWorkspaceId, activeWorkspaceName, setActiveWorkspace }),
    [activeWorkspaceId, activeWorkspaceName, setActiveWorkspace]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => useContext(WorkspaceContext)
