import { useEffect, useState } from 'react'
import { Copy, Trash2, Check, Plus, ShieldCheck } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { Section } from '../../components/ui'
import { createShareLink, deleteShareLink, listShareLinks, type ShareLink } from '../../db/share'
import { supabase } from '../../lib/supabase'
import { syncAll } from '../../db/sync'

interface Props {
  open: boolean
  onClose: () => void
}

export function ShareManagerSheet({ open, onClose }: Props) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(false)
  const [label, setLabel] = useState('Ma petite amie')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const reload = async () => {
    setLoading(true)
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await syncAll(user.id)
      }
    }
    const list = await listShareLinks()
    setLinks(list)
    setLoading(false)
  }

  useEffect(() => {
    if (open) reload()
  }, [open])

  const handleCreate = async () => {
    setCreating(true)
    const newLink = await createShareLink(label || 'Ma petite amie', {
      showTasks: true,
      showSchedule: true,
      showNotes: false, // Confidentiel : notes masquées
    })
    setCreating(false)
    if (newLink) {
      setLinks([newLink, ...links])
      setLabel('Ma petite amie')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Révoquer ce lien de partage ? La personne ne pourra plus accéder à ton planning.')) return
    await deleteShareLink(id)
    setLinks(links.filter((l) => l.id !== id))
  }

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 3000)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Partager mon planning">
      <p className="small muted mb-5">
        Génère un lien secret pour que ta petite amie puisse voir ton planning et savoir quand tu es libre, sans créer de compte.
      </p>

      <Section title="Nouveau lien de partage">
        <div className="cell">
          <span className="cell-body">Pour qui ?</span>
          <input
            type="text"
            className="bare-input"
            placeholder="Ex : Ma petite amie"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="cell">
          <span className="cell-body row gap-2">
            <ShieldCheck size={16} className="text-success" />
            <span>Notes intimes masquées</span>
          </span>
          <span className="cell-value">Protégé</span>
        </div>
      </Section>

      <div className="section">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleCreate}
          disabled={creating}
        >
          <Plus size={16} /> Créer le lien de partage
        </button>
      </div>

      <Section title={`Liens actifs (${links.length})`}>
        {loading ? (
          <div className="cell">
            <span className="cell-body muted">Chargement des liens…</span>
          </div>
        ) : links.length === 0 ? (
          <div className="cell">
            <span className="cell-body muted">Aucun lien actif pour l’instant.</span>
          </div>
        ) : (
          links.map((link) => (
            <div key={link.id} className="cell">
              <div className="cell-body">
                <div className="cell-title">{link.label}</div>
                <div className="cell-sub">
                  Créé le {new Date(link.createdAt).toLocaleDateString('fr-FR')}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => copyLink(link.token, link.id)}
              >
                {copiedId === link.id ? (
                  <>
                    <Check size={14} /> Copié
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copier le lien
                  </>
                )}
              </button>

              <button
                type="button"
                className="icon-btn is-sm is-danger"
                onClick={() => handleDelete(link.id)}
                aria-label="Supprimer le lien"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </Section>
    </Sheet>
  )
}
