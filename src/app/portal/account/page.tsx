'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  User as UserIcon,
} from 'lucide-react'

export default function PortalAccountPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [loading, setLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || '')
        const passwordIdentity = user.identities?.some(
          (i) => i.provider === 'email' && i.identity_data?.email === user.email
        )
        setHasPassword(!!passwordIdentity)
      }
      setLoading(false)
    }
    loadUser()
  }, [supabase])

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')

    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.')
      return
    }

    setPwLoading(true)

    if (hasPassword && currentPassword) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (verifyError) {
        setPwError('Current password is incorrect.')
        setPwLoading(false)
        return
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPwError(error.message)
      setPwLoading(false)
      return
    }

    setPwSuccess(
      hasPassword ? 'Password updated.' : 'Password set. You can sign in with email + password going forward.'
    )
    setHasPassword(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#A0A0A0]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-[#9B30FF]" />
          Profile
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#A0A0A0] mb-1">Email</label>
            <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3">
              <Mail className="w-4 h-4 text-[#666]" />
              <span className="text-white text-sm">{email}</span>
            </div>
            <p className="text-xs text-[#666] mt-1">
              To change your email, contact{' '}
              <a
                href="mailto:loyalty@untamedbeverages.com"
                className="text-[#9B30FF] underline"
              >
                loyalty@untamedbeverages.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#9B30FF]" />
          {hasPassword ? 'Change password' : 'Set a password'}
        </h2>
        <p className="text-xs text-[#A0A0A0] mb-5">
          {hasPassword
            ? 'Update the password you use to sign in.'
            : 'Set a password to sign in faster next time without waiting for a magic link.'}
        </p>

        {pwError && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{pwError}</span>
          </div>
        )}
        {pwSuccess && (
          <div className="flex items-start gap-2 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] rounded-xl px-4 py-3 text-sm mb-4">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{pwSuccess}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {hasPassword && (
            <PasswordInput
              id="currentPassword"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showPassword}
              onToggle={() => setShowPassword((p) => !p)}
              required
            />
          )}
          <PasswordInput
            id="newPassword"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showPassword}
            onToggle={() => setShowPassword((p) => !p)}
            minLength={8}
            required
            placeholder="At least 8 characters"
          />
          <PasswordInput
            id="confirmPassword"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showPassword}
            onToggle={() => setShowPassword((p) => !p)}
            minLength={8}
            required
          />
          <button
            type="submit"
            disabled={pwLoading}
            className="bg-[#9B30FF] text-white font-semibold rounded-full px-5 py-2.5 inline-flex items-center gap-2 hover:bg-[#7E22CE] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pwLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            {pwLoading
              ? 'Saving...'
              : hasPassword
                ? 'Update password'
                : 'Set password'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  minLength,
  required,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  minLength?: number
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[#A0A0A0] mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 pr-12 text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
