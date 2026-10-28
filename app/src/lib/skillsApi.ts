import type { Tool } from '../data/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export async function loadSkillsFromBackend(): Promise<Tool[]> {
  try {
    const response = await fetch(`${API_BASE}/skills`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (!data.success || !Array.isArray(data.skills)) {
      throw new Error('Invalid response format')
    }

    return data.skills as Tool[]
  } catch (error) {
    console.error('[skillsApi] Failed to load skills from backend:', error)
    throw error
  }
}
