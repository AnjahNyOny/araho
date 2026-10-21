import { useState } from 'react'
import { Download, Upload, Trash2, Sparkles, Smartphone, ShieldCheck, Database } from 'lucide-react'
import { PageHeader } from '../../components/ui'
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
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `araho-backup-${today()}.json`
      a.click()
      URL.revokeObjectURL(url)
      showMsg('Sauvegarde exportée avec succès !')
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
      const text = await file.text()
      const json = JSON.parse(text)
      const count = await importAll(json)
      showMsg(`${count} enregistrements importés / mis à jour avec succès !`)
    } catch (err) {
      console.error(err)
      alert('Fichier invalide ou corrompu.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleLoadDemo = async () => {
    if (!confirm('Charger des exemples de tâches (ex: "Apprendre le JavaScript") et des sessions récentes ?')) return
    setLoading(true)
    try {
      const t = today()

      // Tâche 1 : Apprendre le JavaScript
      const jsTask = await createTask(
        {
          name: 'Apprendre le JavaScript',
          description: 'Maîtriser les fondamentaux modernes (ES6+, async, DOM, React)',
          icon: '💻',
          color: 'hsl(40 95% 60%)',
          dailyGoalMin: 60,
        },
        {
          daysOfWeek: [1, 2, 3, 4, 5], // Lun - Ven
          startMin: 9 * 60, // 09:00
          durationMin: 60,
        },
      )

      // Sessions passées et notes pour JS
      const s1 = await logManualSession(jsTask.id, 60)
      await saveNote(s1, {
        learned: 'Compris le fonctionnement des Promises, async/await et la gestion des erreurs avec try/catch.',
        difficulties: 'La différence subtile entre Promise.all et Promise.allSettled sur les rejets.',
        nextStep: 'Pratiquer sur une API fetch avec affichage d’un loader et gestion d’erreur.',
        confidence: 4,
        tags: ['async', 'promises', 'es6'],
      })

      // Tâche 2 : Sport & Mobilité
      const sportTask = await createTask(
        {
          name: 'Sport & Mobilité',
          description: 'Cardio léger et étirements quotidiens pour l’énergie',
          icon: '🏃',
          color: 'hsl(152 62% 55%)',
          dailyGoalMin: 30,
        },
        {
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startMin: 7 * 60 + 30, // 07:30
          durationMin: 30,
        },
      )

      const s2 = await logManualSession(sportTask.id, 30)
      await saveNote(s2, {
        learned: 'Séance de 30 min fractionné + mobilité hanches et épaules.',
        difficulties: '',
        nextStep: 'Passer à 20 min de course continue sans interruption.',
        confidence: 5,
        tags: ['santé', 'énergie'],
      })

      // Créneaux pour aujourd'hui et demain
      await addSlot({
        taskId: jsTask.id,
        date: t,
        startMin: 14 * 60, // 14:00
        durationMin: 60,
        repeatDays: [],
      })

      showMsg('Données de démonstration chargées avec succès !')
    } catch (e) {
      console.error(e)
      alert('Erreur lors du chargement des données.')
    } finally {
      setLoading(false)
    }
  }

  const handleWipe = async () => {
    if (!confirm('ATTENTION : Voulez-vous vraiment effacer TOUTES les données locales ? Cette action est irréversible.')) return
    setLoading(true)
    try {
      await wipeAll()
      showMsg('Toutes les données locales ont été réinitialisées.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Configuration" title="Réglages" />

      {message && (
        <div className="status-banner success animate-in" style={{ marginBottom: 18 }}>
          <ShieldCheck size={18} />
          <span>{message}</span>
        </div>
      )}

      <div className="stack" style={{ gap: 20 }}>
        {/* Section 1 : Local-First & PWA */}
        <section className="card card-pad stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="empty-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <Smartphone size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 17 }}>Installation sur iPhone & Mac</h3>
              <p className="small muted">Utilise Araho comme une vraie application native hors ligne.</p>
            </div>
          </div>
          <div className="card card-pad" style={{ background: 'var(--surface-2)', fontSize: 13.5, lineHeight: 1.6 }}>
            <strong>Sur iPhone (Safari) :</strong> Appuie sur le bouton de partage <span style={{ opacity: 0.8 }}>⎋ / Partager</span> dans la barre d'outils, puis sélectionne <strong>« Sur l'écran d'accueil »</strong>.
            <br />
            <strong>Sur Mac (Chrome / Safari) :</strong> Clique sur l'icône d'installation dans la barre d'adresse pour l'ajouter à tes applications.
          </div>
        </section>

        {/* Section 2 : Synchronisation & Cloud */}
        <section className="card card-pad stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="empty-icon" style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, hsl(200 90% 50%), hsl(260 90% 60%))' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 17 }}>Stockage local-first</h3>
              <p className="small muted">
                Vos données sont stockées dans la base IndexedDB de votre navigateur. Aucune donnée ne quitte votre appareil en V1.
              </p>
            </div>
          </div>
          <p className="small muted">
            La phase 3 permettra la synchronisation instantanée sur votre VPS privé avec comptes utilisateurs et notifications Web Push.
          </p>
        </section>

        {/* Section 3 : Sauvegarde & Restauration */}
        <section className="card card-pad stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="empty-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <Database size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 17 }}>Sauvegarde des données</h3>
              <p className="small muted">Exportez et restaurez vos données à tout moment au format JSON standard.</p>
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleExport} id="settings-export">
              <Download size={16} /> Exporter mes données
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }} id="settings-import-label">
              <Upload size={16} /> Importer un fichier JSON
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
        </section>

        {/* Section 4 : Outils & Démo */}
        <section className="card card-pad stack" style={{ gap: 14 }}>
          <h3 style={{ fontSize: 17 }}>Actions rapides</h3>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={handleLoadDemo}
              disabled={loading}
              id="settings-load-demo"
            >
              <Sparkles size={16} /> Charger des données d'exemple (JS & Sport)
            </button>
            <button
              className="btn btn-danger"
              onClick={handleWipe}
              disabled={loading}
              id="settings-wipe"
            >
              <Trash2 size={16} /> Effacer toutes les données
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
