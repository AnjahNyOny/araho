import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Section } from '../../components/ui'
import { useAuth } from '../../lib/supabase'

import { syncAll } from '../../db/sync'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AuthSheet({ open, onClose, onSuccess }: Props) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setError(null)
    setLoading(true)

    try {
      let res
      if (mode === 'login') {
        res = await signIn(email, password)
      } else {
        res = await signUp(email, password, displayName)
      }
      if (res?.user) {
        await syncAll(res.user.id)
      }
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erreur d’authentification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'login' ? 'Connexion Araho' : 'Créer un compte'}
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="status-banner danger animate-in" style={{ marginBottom: 16 }}>
            <span>{error}</span>
          </div>
        )}

        <Section>
          {mode === 'signup' && (
            <div className="cell">
              <span className="cell-body">Prénom</span>
              <input
                type="text"
                className="bare-input"
                placeholder="Ex : Alex"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div className="cell">
            <span className="cell-body">Email</span>
            <input
              type="email"
              className="bare-input"
              placeholder="alex@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="cell">
            <span className="cell-body">Mot de passe</span>
            <input
              type="password"
              className="bare-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
        </Section>

        <div className="section" style={{ marginTop: 24 }}>
          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={loading}
          >
            {loading ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 14 }}
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
            }}
          >
            {mode === 'login'
              ? 'Pas encore de compte ? S’inscrire'
              : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
