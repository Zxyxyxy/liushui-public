import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Tool } from '../data/types'
import { loadSkillsFromBackend } from '../lib/skillsApi'
import { buildToolMap } from '../data/toolsUtils'

interface SkillsValue {
  skills: Tool[]
  skillsMap: Record<string, Tool>
  loading: boolean
  error: string | null
  reload: () => void
}

const Ctx = createContext<SkillsValue | null>(null)

export function SkillsProvider({ children }: { children: ReactNode }) {
  const [skills, setSkills] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const skillsMap = useMemo(() => buildToolMap(skills), [skills])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await loadSkillsFromBackend()
      setSkills(data)
    } catch (err) {
      console.error('[SkillsContext] 后端加载失败', err)
      setError(err instanceof Error ? err.message : '加载失败')
      setSkills([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Ctx.Provider value={{ skills, skillsMap, loading, error, reload: load }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSkills() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSkills must be used within SkillsProvider')
  return ctx
}
