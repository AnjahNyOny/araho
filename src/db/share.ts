import { supabase } from '../lib/supabase'

export interface ShareLink {
  id: string
  userId: string
  token: string
  label: string
  showTasks: boolean
  showSchedule: boolean
  showNotes: boolean
  isActive: boolean
  createdAt: string
}

export interface SharedData {
  ownerName: string
  label: string
  showTasks: boolean
  showSchedule: boolean
  showNotes: boolean
  activeSession: {
    id: string
    taskId: string
    taskName: string
    taskColor: string
    startedAt: string
    durationMin: number
  } | null
  tasks: Array<{
    id: string
    name: string
    color: string
    icon: string
    dailyGoalMin: number
  }>
  slots: Array<{
    id: string
    taskId: string
    date: string
    startMin: number
    durationMin: number
    status: 'planned' | 'done' | 'skipped'
  }>
  error?: string
}

/** Créer un lien secret de partage avec permissions personnalisées */
export async function createShareLink(
  label: string = 'Ma petite amie',
  options: { showTasks?: boolean; showSchedule?: boolean; showNotes?: boolean } = {}
): Promise<ShareLink | null> {
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('shares')
    .insert({
      user_id: user.id,
      label,
      show_tasks: options.showTasks ?? true,
      show_schedule: options.showSchedule ?? true,
      show_notes: options.showNotes ?? false, // Toujours false par défaut pour protéger l'intimité
      is_active: true,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('Erreur création lien de partage:', error)
    return null
  }

  return {
    id: data.id,
    userId: data.user_id,
    token: data.token,
    label: data.label,
    showTasks: data.show_tasks,
    showSchedule: data.show_schedule,
    showNotes: data.show_notes,
    isActive: data.is_active,
    createdAt: data.created_at,
  }
}

/** Lister tous les liens de partage de l'utilisateur connecté */
export async function listShareLinks(): Promise<ShareLink[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('shares')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((d) => ({
    id: d.id,
    userId: d.user_id,
    token: d.token,
    label: d.label,
    showTasks: d.show_tasks,
    showSchedule: d.show_schedule,
    showNotes: d.show_notes,
    isActive: d.is_active,
    createdAt: d.created_at,
  }))
}

/** Supprimer / révoquer un lien de partage */
export async function deleteShareLink(shareId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('shares').delete().eq('id', shareId)
  return !error
}

/** Récupérer publiquement le planning partagé via le token secret */
export async function fetchSharedSchedule(
  token: string,
  startDate: string,
  endDate: string
): Promise<SharedData | null> {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_shared_schedule', {
    p_token: token,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error || !data) {
    console.error('Erreur chargement planning partagé:', error)
    return null
  }

  return data as SharedData
}
