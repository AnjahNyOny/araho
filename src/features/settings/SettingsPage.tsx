import { useEffect, useState } from 'react'
import {
  Download,
  Upload,
  Trash2,
  Sparkles,
  ChevronRight,
  User,
  Share2,
  RefreshCw,
  LogOut,
  ShieldAlert,
  Bell,
  Volume2,
  CheckCircle2,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react'
import { PageHeader, Section } from '../../components/ui'
import { exportAll, importAll, wipeAll, createTask, addSlot, logManualSession, saveNote } from '../../db/repo'
import { today } from '../../lib/date'
import { useAuth } from '../../lib/supabase'
import { syncAll, subscribeSyncState, type SyncState } from '../../db/sync'
import { getReminderConfig, saveReminderConfig, type ReminderConfig } from '../../lib/reminders'
import { playReminderChime, requestNotificationPermission } from '../../lib/sound'
import { getTheme, setTheme, type ThemeMode } from '../../lib/theme'
import { AuthSheet } from '../auth/AuthSheet'
import { ShareManagerSheet } from '../share/ShareManagerSheet'

export function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Supabase Auth & Sync
  const { user, isConfigured, signOut } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [sync, setSync] = useState<SyncState>({ status: 'idle', lastSyncAt: null, error: null })
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(getReminderConfig())
  const [themeMode, setThemeMode] = useState<ThemeMode>(getTheme())

  useEffect(() => subscribeSyncState(setSync), [])

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode)
    setTheme(mode)
  }

  const showMsg = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 4000)
  }

  const handleSync = async () => {
    if (!user) return
    const ok = await syncAll(user.id)
    if (ok) showMsg('Synchronisation réussie avec le cloud.')
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

      {/* Section Compte & Cloud Multi-Utilisateurs */}
      <Section
        title="Compte & Cloud"
        footer={
          !isConfigured
            ? "Pour activer le multi-utilisateurs et le partage en ligne, ajoute tes clés Supabase dans le fichier .env (schéma SQL prêt dans supabase/schema.sql)."
            : user
            ? `Connecté en tant que ${user.email}. Tes données sont synchronisées sur le cloud.`
            : "Connecte-toi pour sauvegarder tes données sur le cloud et les partager avec tes proches."
        }
      >
        {!isConfigured ? (
          <div className="cell">
            <div className="settings-icon" style={{ background: 'var(--sys-orange)' }}>
              <ShieldAlert size={16} strokeWidth={2.4} />
            </div>
            <div className="cell-body">
              <div className="cell-title">Supabase non connecté</div>
              <div className="cell-sub">Clés .env en attente</div>
            </div>
          </div>
        ) : user ? (
          <>
            <div className="cell">
              <div className="settings-icon" style={{ background: 'var(--sys-blue)' }}>
                <User size={16} strokeWidth={2.4} />
              </div>
              <div className="cell-body">
                <div className="cell-title truncate">{user.user_metadata?.display_name || 'Utilisateur'}</div>
                <div className="cell-sub truncate">{user.email}</div>
              </div>
            </div>

            <button className="cell" onClick={handleSync} disabled={sync.status === 'syncing'}>
              <div className="settings-icon" style={{ background: 'var(--sys-green)' }}>
                <RefreshCw
                  size={16}
                  strokeWidth={2.4}
                  className={sync.status === 'syncing' ? 'spin' : ''}
                />
              </div>
              <span className="cell-body">
                {sync.status === 'syncing'
                  ? 'Synchronisation…'
                  : sync.lastSyncAt
                  ? `Synchronisé (${new Date(sync.lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`
                  : 'Synchroniser maintenant'}
              </span>
            </button>

            <button className="cell" onClick={signOut}>
              <div className="settings-icon" style={{ background: 'var(--label-3)' }}>
                <LogOut size={16} strokeWidth={2.4} />
              </div>
              <span className="cell-body" style={{ color: 'var(--sys-red)' }}>Se déconnecter</span>
            </button>
          </>
        ) : (
          <button className="cell" onClick={() => setAuthOpen(true)}>
            <div className="settings-icon" style={{ background: 'var(--sys-blue)' }}>
              <User size={16} strokeWidth={2.4} />
            </div>
            <span className="cell-body">Se connecter ou créer un compte</span>
            <ChevronRight size={18} className="cell-chevron" />
          </button>
        )}
      </Section>

      {/* Section Partage avec des proches (Petite amie) */}
      <Section
        title="Partage"
        footer="Génère un lien secret en lecture seule pour que ta petite amie puisse voir ton planning et savoir quand tu es libre, sans voir tes notes personnelles."
      >
        <button
          className="cell"
          onClick={() => {
            if (!user) {
              setAuthOpen(true)
            } else {
              setShareOpen(true)
            }
          }}
        >
          <div className="settings-icon" style={{ background: 'var(--sys-pink, #FF2D55)' }}>
            <Share2 size={16} strokeWidth={2.4} />
          </div>
          <div className="cell-body">
            <div className="cell-title">Partager mon planning</div>
            <div className="cell-sub">
              {user ? 'Lien de lecture pour ma petite amie' : 'Connexion requise pour partager'}
            </div>
          </div>
          <ChevronRight size={18} className="cell-chevron" />
        </button>
      </Section>

      {/* Section Apparence (Mode Sombre / Clair / Auto) */}
      <Section
        title="Apparence"
        footer="En mode automatique, Araho synchronise son affichage sur le réglage système de ton Mac ou iPhone."
      >
        <div className="cell" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 12 }}>
            <div
              className="settings-icon"
              style={{
                background:
                  themeMode === 'dark'
                    ? 'var(--sys-indigo)'
                    : themeMode === 'light'
                    ? 'var(--sys-orange)'
                    : 'var(--sys-blue)',
              }}
            >
              {themeMode === 'dark' ? (
                <Moon size={16} strokeWidth={2.4} />
              ) : themeMode === 'light' ? (
                <Sun size={16} strokeWidth={2.4} />
              ) : (
                <Laptop size={16} strokeWidth={2.4} />
              )}
            </div>
            <span className="cell-body">Thème d'affichage</span>
          </div>
          <div className="chips" style={{ margin: 0 }}>
            <button
              className={`chip chip-sm ${themeMode === 'auto' ? 'is-active' : ''}`}
              onClick={() => handleThemeChange('auto')}
            >
              Auto
            </button>
            <button
              className={`chip chip-sm ${themeMode === 'light' ? 'is-active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              Clair
            </button>
            <button
              className={`chip chip-sm ${themeMode === 'dark' ? 'is-active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              Sombre
            </button>
          </div>
        </div>
      </Section>

      {/* Section Rappels & Notifications */}
      <Section
        title="Rappels de créneau"
        footer="Reçois un doux carillon et une notification système 5 minutes avant le début de tes sessions planifiées pour te préparer."
      >
        <div className="cell">
          <div className="settings-icon" style={{ background: 'var(--sys-blue)' }}>
            <Bell size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body">Rappels 5 min avant créneau</span>
          <input
            type="checkbox"
            className="switch"
            id="settings-reminder-toggle"
            checked={reminderConfig.enabled}
            onChange={async (e) => {
              const val = e.target.checked
              if (val) {
                await requestNotificationPermission()
              }
              const next = { ...reminderConfig, enabled: val }
              setReminderConfig(next)
              saveReminderConfig(next)
            }}
          />
        </div>

        <div className="cell">
          <div className="settings-icon" style={{ background: 'var(--sys-purple)' }}>
            <Volume2 size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body">Alerte sonore (carillon zen)</span>
          <input
            type="checkbox"
            className="switch"
            id="settings-sound-toggle"
            checked={reminderConfig.sound}
            onChange={(e) => {
              const next = { ...reminderConfig, sound: e.target.checked }
              setReminderConfig(next)
              saveReminderConfig(next)
            }}
          />
        </div>

        <button
          className="cell"
          id="settings-reminder-test"
          onClick={async () => {
            const granted = await requestNotificationPermission()
            playReminderChime()
            if (granted) {
              try {
                new Notification('⏰ Rappel de créneau : Démonstration', {
                  body: 'Début dans 5 minutes (14:00 – 15:00) · Prépare ton espace de travail.',
                  icon: '/icons/icon-192.png',
                })
              } catch {}
            }
            showMsg('Carillon joué et notification de test envoyée !')
          }}
        >
          <div className="settings-icon" style={{ background: 'var(--sys-teal, #30B0C7)' }}>
            <CheckCircle2 size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body">Tester l’alerte sonore et la notification</span>
          <ChevronRight size={18} className="cell-chevron" />
        </button>
      </Section>

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
        title="Données locales"
        footer="Tes données restent toujours disponibles sur cet appareil via IndexedDB, même hors connexion."
      >
        <button className="cell" onClick={handleExport} id="settings-export">
          <div className="settings-icon" style={{ background: 'var(--sys-blue)' }}>
            <Download size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body">Exporter une sauvegarde JSON</span>
          <ChevronRight size={18} className="cell-chevron" />
        </button>
        <label className="cell" id="settings-import-label" style={{ cursor: 'pointer' }}>
          <div className="settings-icon" style={{ background: 'var(--sys-indigo)' }}>
            <Upload size={16} strokeWidth={2.4} />
          </div>
          <span className="cell-body">Importer une sauvegarde JSON</span>
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
          <span className="cell-body" style={{ color: 'var(--sys-red)' }}>Effacer toutes les données locales</span>
        </button>
      </Section>

      {/* Feuilles modales */}
      <AuthSheet
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          showMsg('Connexion réussie.')
        }}
      />
      <ShareManagerSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </>
  )
}
