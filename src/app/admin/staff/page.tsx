'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Briefcase,
  Search,
  Loader2,
  Check,
  X,
  ChevronDown,
  Link2,
  Pencil,
  Power,
  PowerOff,
  KeyRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StaffMember {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  auth_user_id: string | null
  contractor_specialty: string | null
  created_at: string
  updated_at: string
}

interface AuthUser {
  id: string
  email: string
  full_name: string
  created_at: string
  is_linked: boolean
  linked_staff_name: string | null
}

type PageTab = 'staff' | 'auth_users'

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: '#9B30FF', desc: 'Full system access' },
  { value: 'admin', label: 'Admin', color: '#E87511', desc: 'Full access, no system config' },
  { value: 'contractor_full', label: 'Contractor (Full)', color: '#4A7C0F', desc: 'Full data access, no deletes' },
  { value: 'contractor_limited', label: 'Contractor (Limited)', color: '#D4D700', desc: 'Content only — no financial or loyalty data' },
]

const SPECIALTIES = [
  { value: 'sales', label: 'Sales' },
  { value: 'fulfillment', label: 'Fulfillment' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'production', label: 'Production' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'other', label: 'Other' },
]

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#9B30FF',
  admin: '#E87511',
  contractor_full: '#4A7C0F',
  contractor_limited: '#D4D700',
}

function roleLabel(role: string) {
  return ROLES.find(r => r.value === role)?.label || role
}

function specialtyLabel(s: string | null) {
  if (!s) return null
  return SPECIALTIES.find(sp => sp.value === s)?.label || s
}

export default function StaffManagementPage() {
  const [activeTab, setActiveTab] = useState<PageTab>('staff')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Auth user name editing
  const [editingAuthId, setEditingAuthId] = useState<string | null>(null)
  const [editAuthName, setEditAuthName] = useState('')
  const [savingAuth, setSavingAuth] = useState(false)
  const [authSearchQuery, setAuthSearchQuery] = useState('')

  // Create form
  const [createMode, setCreateMode] = useState<'link' | 'new'>('link')
  const [selectedAuthUser, setSelectedAuthUser] = useState<AuthUser | null>(null)
  const [authSearch, setAuthSearch] = useState('')
  const [authDropdownOpen, setAuthDropdownOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('contractor_limited')
  const [newSpecialty, setNewSpecialty] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editSpecialty, setEditSpecialty] = useState('')
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff')
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to load')
      }
      const data: StaffMember[] = await res.json()
      setStaff(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAuthUsers = useCallback(async () => {
    setAuthLoading(true)
    try {
      const res = await fetch('/api/admin/staff/auth-users')
      if (res.ok) {
        setAuthUsers(await res.json())
      }
    } catch { /* silent */ }
    finally { setAuthLoading(false) }
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])
  useEffect(() => { fetchAuthUsers() }, [fetchAuthUsers])

  const isContractor = (role: string) => role === 'contractor_full' || role === 'contractor_limited'

  const handleCreate = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const payload: Record<string, unknown> = {
        full_name: createMode === 'link' && selectedAuthUser
          ? (newName.trim() || selectedAuthUser.full_name || selectedAuthUser.email.split('@')[0])
          : newName.trim(),
        role: newRole,
      }

      if (createMode === 'link' && selectedAuthUser) {
        payload.auth_user_id = selectedAuthUser.id
        payload.email = selectedAuthUser.email
      } else {
        payload.email = newEmail.trim()
        if (newPassword.trim()) payload.password = newPassword.trim()
      }

      if (isContractor(newRole) && newSpecialty) {
        payload.contractor_specialty = newSpecialty
      }

      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')

      setStaff(prev => [data, ...prev])
      resetCreateForm()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const resetCreateForm = () => {
    setShowCreate(false)
    setSelectedAuthUser(null)
    setAuthSearch('')
    setNewName('')
    setNewEmail('')
    setNewPassword('')
    setNewRole('contractor_limited')
    setNewSpecialty('')
    setCreateError(null)
    setCreateMode('link')
  }

  const startEdit = (member: StaffMember) => {
    setEditingId(member.id)
    setEditRole(member.role)
    setEditSpecialty(member.contractor_specialty || '')
    setEditName(member.full_name)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        full_name: editName.trim(),
        role: editRole,
        contractor_specialty: isContractor(editRole) && editSpecialty ? editSpecialty : null,
      }
      const res = await fetch(`/api/admin/staff/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setStaff(prev => prev.map(s => s.id === editingId ? data : s))
      setEditingId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveAuthName = async () => {
    if (!editingAuthId) return
    setSavingAuth(true)
    try {
      const res = await fetch('/api/admin/staff/auth-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_user_id: editingAuthId, full_name: editAuthName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setAuthUsers(prev =>
        prev.map(u => u.id === editingAuthId ? { ...u, full_name: data.full_name } : u)
      )
      setEditingAuthId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingAuth(false)
    }
  }

  const toggleActive = async (member: StaffMember) => {
    const action = member.is_active ? 'deactivate' : 'reactivate'
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${member.full_name}?`)) return

    try {
      if (member.is_active) {
        const res = await fetch(`/api/admin/staff/${member.id}`, { method: 'DELETE' })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error)
        }
      } else {
        const res = await fetch(`/api/admin/staff/${member.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error)
        }
      }
      await fetchStaff()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const filtered = staff.filter(s => {
    if (!showInactive && !s.is_active) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
    }
    return true
  })

  const unlinkedAuthUsers = authUsers.filter(u => {
    if (u.is_linked) return false
    if (authSearch) {
      const q = authSearch.toLowerCase()
      return u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q)
    }
    return true
  })

  const filteredAuthUsers = authUsers.filter(u => {
    if (authSearchQuery) {
      const q = authSearchQuery.toLowerCase()
      return u.email.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        (u.linked_staff_name || '').toLowerCase().includes(q)
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#9B30FF] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <p className="text-sm text-[#666] mt-1">Only super admins can access this page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-[var(--font-oswald)] uppercase tracking-wider">
            Staff Management
          </h1>
          <p className="text-sm text-[#666] mt-1">
            Manage team members, contractors, and auth accounts.
          </p>
        </div>
        {activeTab === 'staff' && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9B30FF] hover:bg-[#8B20EF] text-white text-sm font-medium rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Staff
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2A2A2A] pb-0">
        <button
          onClick={() => setActiveTab('staff')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
            activeTab === 'staff'
              ? 'text-[#9B30FF] border-[#9B30FF]'
              : 'text-[#A0A0A0] border-transparent hover:text-white'
          )}
        >
          <Users className="w-4 h-4" />
          Staff ({staff.filter(s => s.is_active).length})
        </button>
        <button
          onClick={() => setActiveTab('auth_users')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
            activeTab === 'auth_users'
              ? 'text-[#9B30FF] border-[#9B30FF]'
              : 'text-[#A0A0A0] border-transparent hover:text-white'
          )}
        >
          <KeyRound className="w-4 h-4" />
          Auth Users ({authUsers.length})
        </button>
      </div>

      {/* ================================================================= */}
      {/* AUTH USERS TAB                                                     */}
      {/* ================================================================= */}
      {activeTab === 'auth_users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
              <input
                type="text"
                value={authSearchQuery}
                onChange={e => setAuthSearchQuery(e.target.value)}
                placeholder="Search auth users..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder:text-[#666] outline-none focus:border-[#9B30FF]/50 transition-colors"
              />
            </div>
            <button
              onClick={fetchAuthUsers}
              disabled={authLoading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#A0A0A0] hover:text-white bg-[#141414] border border-[#2A2A2A] rounded-xl hover:border-[#444] transition-colors shrink-0"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Refresh
            </button>
          </div>

          {authLoading && authUsers.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-[#9B30FF] animate-spin" />
            </div>
          ) : filteredAuthUsers.length === 0 ? (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
              <KeyRound className="w-8 h-8 text-[#666] mx-auto mb-3" />
              <p className="text-[#666]">{authSearchQuery ? 'No matching auth users' : 'No auth users found'}</p>
            </div>
          ) : (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    <th className="text-left py-3 px-5 text-xs text-[#666] font-medium uppercase tracking-wider">Email</th>
                    <th className="text-left py-3 px-5 text-xs text-[#666] font-medium uppercase tracking-wider">Name (user_metadata)</th>
                    <th className="text-left py-3 px-5 text-xs text-[#666] font-medium uppercase tracking-wider">Staff Link</th>
                    <th className="text-left py-3 px-5 text-xs text-[#666] font-medium uppercase tracking-wider">Created</th>
                    <th className="text-right py-3 px-5 text-xs text-[#666] font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuthUsers.map(u => {
                    const isEditingThis = editingAuthId === u.id
                    return (
                      <tr key={u.id} className="border-b border-[#2A2A2A]/50 hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-5">
                          <p className="text-sm text-white">{u.email}</p>
                          <p className="text-[10px] text-[#444] font-mono mt-0.5">{u.id.slice(0, 8)}...</p>
                        </td>
                        <td className="py-3 px-5">
                          {isEditingThis ? (
                            <input
                              value={editAuthName}
                              onChange={e => setEditAuthName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveAuthName(); if (e.key === 'Escape') setEditingAuthId(null) }}
                              autoFocus
                              className="px-3 py-1.5 bg-[#111] border border-[#9B30FF]/40 rounded-lg text-sm text-white outline-none w-full max-w-[220px]"
                              placeholder="Enter full name..."
                            />
                          ) : (
                            <span className={cn('text-sm', u.full_name ? 'text-white' : 'text-[#666] italic')}>
                              {u.full_name || 'No name set'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5">
                          {u.is_linked ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-[#4A7C0F]/15 text-[#4A7C0F] inline-flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              {u.linked_staff_name || 'Linked'}
                            </span>
                          ) : (
                            <span className="text-xs text-[#666]">Not linked</span>
                          )}
                        </td>
                        <td className="py-3 px-5">
                          <span className="text-xs text-[#666]">
                            {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right">
                          {isEditingThis ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={saveAuthName}
                                disabled={savingAuth}
                                className="p-1.5 rounded-lg text-[#4A7C0F] hover:bg-[#4A7C0F]/15 transition-colors"
                                title="Save"
                              >
                                {savingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => setEditingAuthId(null)}
                                className="p-1.5 rounded-lg text-[#666] hover:bg-[#1A1A1A] transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingAuthId(u.id); setEditAuthName(u.full_name || '') }}
                              className="p-1.5 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] transition-colors"
                              title="Edit name"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
            <p className="text-xs text-[#666]">
              Auth users are Supabase authentication accounts. The <strong className="text-[#A0A0A0]">Name</strong> column
              is stored in <code className="text-[#9B30FF]/80 bg-[#9B30FF]/10 px-1.5 py-0.5 rounded text-[10px]">user_metadata.full_name</code>.
              To give an auth user access to the admin panel, go to the Staff tab and link them to a staff row with a role.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STAFF TAB                                                          */}
      {/* ================================================================= */}
      {activeTab === 'staff' && <>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-[#141414] border border-[#9B30FF]/30 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Add Staff Member</h3>
            <button onClick={resetCreateForm} className="text-[#666] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setCreateMode('link')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                createMode === 'link'
                  ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                  : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] border border-transparent'
              )}
            >
              <Link2 className="w-4 h-4" />
              Link Auth User
            </button>
            <button
              onClick={() => setCreateMode('new')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                createMode === 'new'
                  ? 'bg-[#9B30FF]/15 text-[#9B30FF] border border-[#9B30FF]/30'
                  : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] border border-transparent'
              )}
            >
              <UserPlus className="w-4 h-4" />
              Create New
            </button>
          </div>

          {createMode === 'link' ? (
            /* Auth user picker */
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs text-[#666] uppercase tracking-wider mb-1.5">Select Auth User</label>
                <button
                  type="button"
                  onClick={() => setAuthDropdownOpen(!authDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white hover:border-[#444] transition-colors"
                >
                  {selectedAuthUser ? (
                    <span>{selectedAuthUser.email} <span className="text-[#666]">({selectedAuthUser.full_name || 'no name'})</span></span>
                  ) : (
                    <span className="text-[#666]">Choose an auth user...</span>
                  )}
                  <ChevronDown className={cn('w-4 h-4 text-[#666] transition-transform', authDropdownOpen && 'rotate-180')} />
                </button>
                {authDropdownOpen && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl max-h-64 overflow-hidden">
                    <div className="p-2 border-b border-[#2A2A2A]">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#111] rounded-lg">
                        <Search className="w-3.5 h-3.5 text-[#666]" />
                        <input
                          type="text"
                          value={authSearch}
                          onChange={e => setAuthSearch(e.target.value)}
                          placeholder="Search by email or name..."
                          className="bg-transparent text-sm text-white placeholder:text-[#666] outline-none flex-1"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      {unlinkedAuthUsers.length === 0 ? (
                        <p className="text-sm text-[#666] p-4 text-center">
                          {authSearch ? 'No matching unlinked users' : 'All auth users are already linked'}
                        </p>
                      ) : (
                        unlinkedAuthUsers.map(u => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setSelectedAuthUser(u)
                              setNewName(u.full_name || '')
                              setAuthDropdownOpen(false)
                              setAuthSearch('')
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-[#222] transition-colors flex items-center justify-between"
                          >
                            <div>
                              <p className="text-sm text-white">{u.email}</p>
                              {u.full_name && <p className="text-xs text-[#666]">{u.full_name}</p>}
                            </div>
                            <span className="text-[10px] text-[#666]">
                              {new Date(u.created_at).toLocaleDateString()}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {selectedAuthUser && (
                <div>
                  <label className="block text-xs text-[#666] uppercase tracking-wider mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={selectedAuthUser.full_name || selectedAuthUser.email.split('@')[0]}
                    className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder:text-[#444] outline-none focus:border-[#9B30FF]/50 transition-colors"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Manual create */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#666] uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Jordan Smith"
                  className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder:text-[#444] outline-none focus:border-[#9B30FF]/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#666] uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="jordan@untamedbeverages.com"
                  className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder:text-[#444] outline-none focus:border-[#9B30FF]/50 transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-[#666] uppercase tracking-wider mb-1.5">Password (creates a login)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Leave blank for staff record only (no login)"
                  className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder:text-[#444] outline-none focus:border-[#9B30FF]/50 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Role + specialty (shared) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#666] uppercase tracking-wider mb-1.5">Role</label>
              <div className="space-y-2">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setNewRole(r.value)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-xl border transition-all text-sm',
                      newRole === r.value
                        ? 'border-[#9B30FF]/50 bg-[#9B30FF]/10'
                        : 'border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#444]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-white font-medium">{r.label}</span>
                    </div>
                    <p className="text-xs text-[#666] mt-0.5 ml-4">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {isContractor(newRole) && (
              <div>
                <label className="block text-xs text-[#666] uppercase tracking-wider mb-1.5">Specialty</label>
                <div className="space-y-2">
                  {SPECIALTIES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setNewSpecialty(newSpecialty === s.value ? '' : s.value)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 rounded-xl border transition-all text-sm',
                        newSpecialty === s.value
                          ? 'border-[#9B30FF]/50 bg-[#9B30FF]/10 text-white'
                          : 'border-[#2A2A2A] bg-[#1A1A1A] text-[#A0A0A0] hover:border-[#444] hover:text-white'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {createError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{createError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={resetCreateForm} className="px-4 py-2 text-sm text-[#A0A0A0] hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || (createMode === 'link' ? !selectedAuthUser : (!newName.trim() || !newEmail.trim()))}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#9B30FF] hover:bg-[#8B20EF] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {creating ? 'Creating...' : 'Create Staff Member'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search staff..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder:text-[#666] outline-none focus:border-[#9B30FF]/50 transition-colors"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#A0A0A0] cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-[#2A2A2A] bg-[#141414] text-[#9B30FF] focus:ring-[#9B30FF]/30"
          />
          Show inactive
        </label>
      </div>

      {/* Staff list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
            <Users className="w-8 h-8 text-[#666] mx-auto mb-3" />
            <p className="text-[#666]">No staff found</p>
          </div>
        ) : (
          filtered.map(member => {
            const color = ROLE_COLORS[member.role] || '#666'
            const isEditing = editingId === member.id
            const RoleIcon = member.role === 'super_admin' ? ShieldCheck
              : member.role === 'admin' ? Shield
              : member.role === 'contractor_full' ? ShieldAlert
              : Briefcase

            return (
              <div
                key={member.id}
                className={cn(
                  'bg-[#141414] border rounded-2xl transition-all duration-200',
                  !member.is_active ? 'opacity-50 border-[#2A2A2A]' : 'border-[#2A2A2A] hover:border-[#444]',
                  isEditing && 'border-[#9B30FF]/40'
                )}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {/* Avatar / Role icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <RoleIcon className="w-5 h-5" style={{ color }} />
                      </div>

                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="text-white font-semibold bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-sm w-full max-w-xs outline-none focus:border-[#9B30FF]/50"
                          />
                        ) : (
                          <p className="text-white font-semibold text-sm truncate">{member.full_name}</p>
                        )}
                        <p className="text-xs text-[#666] mt-0.5 truncate">{member.email}</p>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {isEditing ? (
                            <select
                              value={editRole}
                              onChange={e => setEditRole(e.target.value)}
                              className="text-xs bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-1.5 outline-none focus:border-[#9B30FF]/50"
                            >
                              {ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              {roleLabel(member.role)}
                            </span>
                          )}

                          {isEditing && isContractor(editRole) ? (
                            <select
                              value={editSpecialty}
                              onChange={e => setEditSpecialty(e.target.value)}
                              className="text-xs bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-1.5 outline-none focus:border-[#9B30FF]/50"
                            >
                              <option value="">No specialty</option>
                              {SPECIALTIES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          ) : member.contractor_specialty ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-[#2A2A2A] text-[#A0A0A0]">
                              {specialtyLabel(member.contractor_specialty)}
                            </span>
                          ) : null}

                          {member.auth_user_id ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-[#4A7C0F]/15 text-[#4A7C0F] flex items-center gap-1">
                              <Link2 className="w-3 h-3" /> Linked
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-[#333] text-[#666]">
                              No login
                            </span>
                          )}

                          {!member.is_active && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-400">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="p-2 rounded-lg text-[#4A7C0F] hover:bg-[#4A7C0F]/15 transition-colors"
                            title="Save"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-2 rounded-lg text-[#666] hover:bg-[#1A1A1A] transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(member)}
                            className="p-2 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(member)}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              member.is_active
                                ? 'text-[#A0A0A0] hover:text-red-400 hover:bg-red-500/10'
                                : 'text-[#A0A0A0] hover:text-[#4A7C0F] hover:bg-[#4A7C0F]/10'
                            )}
                            title={member.is_active ? 'Deactivate' : 'Reactivate'}
                          >
                            {member.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Permission reference */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Permission Reference</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2A]">
                <th className="text-left py-2 pr-4 text-[#666] font-medium">Capability</th>
                {ROLES.map(r => (
                  <th key={r.value} className="text-center py-2 px-3 font-medium" style={{ color: r.color }}>
                    {r.label.replace(' (', '\n(').split('\n')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[#A0A0A0]">
              {[
                { cap: 'Ideas / Media / Campaigns', vals: ['Full', 'Full', 'Read/Write', 'Read/Write'] },
                { cap: 'Studio (AI generation)', vals: ['Full', 'Full', 'Full', 'Full'] },
                { cap: 'Delete content', vals: ['Yes', 'Yes', 'No', 'No'] },
                { cap: 'Loyalty data', vals: ['Full', 'Full', 'Read/Write', 'Blocked'] },
                { cap: 'Financial pages', vals: ['Full', 'Full', 'Full', 'Hidden'] },
                { cap: 'Visitor / session analytics', vals: ['Full', 'Full', 'Full', 'Blocked'] },
                { cap: 'Staff management', vals: ['Full', 'No', 'No', 'No'] },
              ].map(row => (
                <tr key={row.cap} className="border-b border-[#2A2A2A]/50">
                  <td className="py-2 pr-4 text-white">{row.cap}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} className={cn(
                      'py-2 px-3 text-center',
                      v === 'Blocked' || v === 'Hidden' || v === 'No' ? 'text-red-400/70' : 'text-[#4A7C0F]'
                    )}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </>}
    </div>
  )
}
