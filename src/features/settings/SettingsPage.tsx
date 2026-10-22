import { useState } from 'react'
import { Download, Upload, Trash2, Sparkles, ChevronRight } from 'lucide-react'
import { PageHeader, Section } from '../../components/ui'
import { exportAll, importAll, wipeAll, createTask, addSlot, logManualSession, saveNote } from '../../db/repo'
import { today } from '../../lib/date'

export function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const showMsg = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 4000)
  }

  const handleExport = async () => {
    try {
      const data = await exportAll()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `araho-backup-${today()}.json`
      a.click()
      URL.revokeObjectURL(url)
      showMsg('Sauvegarde exportée.')
    } catch (e) {
      console.error(e)
      alert('Erreur lors de l’export')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const count = await importAll(JSON.parse(await file.text()))
      showMsg(`${count} enregistrements importés ou mis à jour.`)
    } catch (err) {
      console.error(err)
      alert('Fichier invalide ou corrompu.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleLoadDemo = async () => {
    if (!confirm('Charger des exemples de tâches et de sessions récentes ?')) return
    setLoading(true)
    try {
      const t = today()

      const jsTask = await createTask(
        {
          name: 'Apprendre le JavaScript',
          description: 'Maîtriser les fondamentaux modernes (ES6+, async, DOM, React)',
          icon: 'code',
          color: 'var(--sys-blue)',
          dailyGoalMin: 60,
        },
        { daysOfWeek: [1, 2, 3, 4, 5], startMin: 9 * 60, durationMin: 60 },
      )
      const s1 = await logManualSession(jsTask.id, 60)
      await saveNote(s1, {
        learned: 'Compris le fonctionnement des Promises, async/await et la gestion des erreurs avec try/catch.',
        difficulties: 'La différence subtile entre Promise.all et Promise.allSettled sur les rejets.',
        nextStep: 'Pratiquer sur une API fetch avec affichage d’un loader et gestion d’erreur.',
        confidence: 4,
        tags: ['async', 'promises', 'es6'],
      })

      const sportTask = await createTask(
        {
          name: 'Sport & Mobilité',
          description: 'Cardio léger et étirements quotidiens',
          icon: 'dumbbell',
          color: 'var(--sys-green)',
          dailyGoalMin: 30,
        },
        { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startMin: 7 * 60 + 30, durationMin: 30 },
      )
      const s2 = await logManualSession(sportTask.id, 30)
      await saveNote(s2, {
        learned: 'Séance de 30 min fractionné + mobilité hanches et épaules.',
        difficulties: '',
        nextStep: 'Passer à 20 min de course continue sans interruption.',
        confidence: 5,
        tags: ['santé', 'énergie'],
      })

      const readTask = await createTask(
        {
          name: 'Lecture',
          description: 'Un chapitre par jour',
          icon: 'book',
          color: 'var(--sys-orange)',
          dailyGoalMin: 30,
        },
        { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startMin: 21 * 60, durationMin: 30 },
      )
      await addSlot({ taskId: readTask.id, date: t, startMin: 14 * 60, durationMin: 30, repeatDays: [] })

      showMsg('Données d’exemple chargées.')
    } catch (e) {
      console.error(e)
      alert('Erreur lors du chargement des données.')
    } finally {
      setLoading(false)
    }
  }

  const handleWipe = async () => {
    if (!confirm('Effacer TOUTES les données locales ? Cette action est irréversible.')) return
    setLoading(true)
    try {
      await wipeAll()
      showMsg('Toutes les données locales ont été effacées.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader title="Réglages" />

      {message && (
        <div className="status-banner success animate-in" style={{ marginBottom: 20 }}>
          <span>{message}</span>
        </div>
      )}

      <Section
        title="Installation"
        footer="Sur iPhone (Safari) : Partager puis « Sur l’écran d’accueil ». Sur Mac : Fichier puis « Ajouter au Dock » (Safari), ou l’icône d’installation dans la barre d’adresse (Chrome)."
      >
        <div className="cell">
          <span className="cell-body">Fonctionne hors connexion</span>
          <span className="cell-value">Oui</span>
        </div>
      </Section>

      <Section
        title="Données"
        footer="Tes données restent sur cet appareil (IndexedDB). La synchronisation avec ton serveur arrivera dans une prochaine phase."
      >
        <button className="cell" onClick={handleExport} id="settings-export">
          <div className="settings-icon" style={{ background: 'var(--sys-blue)' }}>
            <Download size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body">Exporter une sauvegarde</span>
          <ChevronRight size={18} className="cell-chevron" />
        </button>
        <label className="cell" id="settings-import-label" style={{ cursor: 'pointer' }}>
          <div className="settings-icon" style={{ background: 'var(--sys-indigo)' }}>
            <Upload size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body">Importer une sauvegarde</span>
          <ChevronRight size={18} className="cell-chevron" />
          <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} id="settings-import" />
        </label>
      </Section>

      <Section title="Outils">
        <button className="cell" onClick={handleLoadDemo} disabled={loading} id="settings-load-demo">
          <div className="settings-icon" style={{ background: 'var(--sys-purple)' }}>
            <Sparkles size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body">Charger des données d’exemple</span>
          <ChevronRight size={18} className="cell-chevron" />
        </button>
        <button className="cell" onClick={handleWipe} disabled={loading} id="settings-wipe">
          <div className="settings-icon" style={{ background: 'var(--sys-red)' }}>
            <Trash2 size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body" style={{ color: 'var(--sys-red)' }}>Effacer toutes les données</span>
        </button>
      </Section>
    </>
  )
}
