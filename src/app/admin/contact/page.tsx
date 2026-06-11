'use client'

import { useState, useEffect } from 'react'
import {
  Mail, Loader2, ChevronDown, MessageSquare,
  User, Save, Clock, CheckCircle, Archive, Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ContactStatus = 'new' | 'read' | 'replied' | 'archived'

interface ContactSubmission {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: ContactStatus
  admin_notes: string | null
  created_at: string
  replied_at: string | null
}

const STATUS_COLORS: Record<ContactStatus, string> = {
  new: '#3b82f6',
  read: '#FFD700',
  replied: '#22c55e',
  archived: '#6b7280',
}

const STATUS_ICONS: Record<ContactStatus, typeof Mail> = {
  new: Mail,
  read: Eye,
  replied: CheckCircle,
  archived: Archive,
}

const STATUSES: ContactStatus[] = ['new', 'read', 'replied', 'archived']

const SUBJECT_LABELS: Record<string, string> = {
  general: 'General',
  partnership: 'Partnership',
  media: 'Media / Press',
  distribution: 'Distribution',
  support: 'Support',
  feedback: 'Feedback',
}

export default function AdminContactPage() {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [filterStatus, setFilterStatus] = useState<ContactStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { loadSubmissions() }, [])

  async function loadSubmissions() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/contact')
      const data = await res.json()
      setSubmissions(data.submissions || [])
      setStatusCounts(data.statusCounts || {})
    } catch (err) {
      console.error('Failed to load contact submissions', err)
    } finally {
      setLoading(false)
    }
  }

  async function updateSubmission(id: string, updates: { status?: ContactStatus; admin_notes?: string }) {
    await fetch(`/api/admin/contact/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    loadSubmissions()
  }

  const filtered = filterStatus === 'all'
    ? submissions
    : submissions.filter((s) => s.status === filterStatus)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Contact Submissions</h1>
          <p className="text-untamed-white-muted text-sm mt-1">
            {submissions.length} total &middot; {statusCounts.new || 0} new
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterStatus('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-all border',
            filterStatus === 'all'
              ? 'border-white/40 bg-white/10 text-white'
              : 'border-card-border text-untamed-white-muted hover:border-white/30'
          )}
        >
          All ({submissions.length})
        </button>
        {STATUSES.map((status) => {
          const Icon = STATUS_ICONS[status]
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-all border inline-flex items-center gap-1.5',
                filterStatus === status
                  ? 'bg-white/10 text-white'
                  : 'border-card-border text-untamed-white-muted hover:border-white/30'
              )}
              style={filterStatus === status ? { borderColor: STATUS_COLORS[status] } : undefined}
            >
              <Icon className="w-3 h-3" />
              {status} ({statusCounts[status] || 0})
            </button>
          )
        })}
      </div>

      {/* Submissions list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-untamed-white-muted text-center py-12">No submissions found.</p>
        )}
        {filtered.map((sub) => {
          const isExpanded = expandedId === sub.id
          return (
            <div
              key={sub.id}
              className="rounded-xl border border-card-border bg-untamed-black-card overflow-hidden"
            >
              {/* Header row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-untamed-black-light/30 transition-colors"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[sub.status] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">{sub.name}</span>
                    <span className="text-untamed-white-muted text-xs">&lt;{sub.email}&gt;</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-untamed-black-light text-untamed-white-muted border border-card-border">
                      {SUBJECT_LABELS[sub.subject] || sub.subject}
                    </span>
                    <span className="text-xs text-untamed-white-muted/60">
                      {new Date(sub.created_at).toLocaleDateString()} {new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-untamed-white-muted transition-transform', isExpanded && 'rotate-180')} />
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <SubmissionDetail
                  submission={sub}
                  onUpdate={(updates) => updateSubmission(sub.id, updates)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SubmissionDetail({
  submission: sub,
  onUpdate,
}: {
  submission: ContactSubmission
  onUpdate: (updates: { status?: ContactStatus; admin_notes?: string }) => void
}) {
  const [notes, setNotes] = useState(sub.admin_notes || '')
  const [saving, setSaving] = useState(false)

  async function saveNotes() {
    setSaving(true)
    await onUpdate({ admin_notes: notes })
    setSaving(false)
  }

  return (
    <div className="px-5 pb-5 border-t border-card-border pt-4 space-y-4">
      {/* Message */}
      <div className="flex gap-3">
        <MessageSquare className="w-4 h-4 text-[#FFD700] mt-1 shrink-0" />
        <p className="text-untamed-white text-sm leading-relaxed whitespace-pre-wrap">{sub.message}</p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-untamed-white-muted/60">
        <span className="flex items-center gap-1"><User className="w-3 h-3" />{sub.email}</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(sub.created_at).toLocaleString()}</span>
        {sub.replied_at && (
          <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" />Replied {new Date(sub.replied_at).toLocaleDateString()}</span>
        )}
      </div>

      {/* Status change */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-untamed-white-muted mr-1">Status:</span>
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => onUpdate({ status })}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider border transition-all',
              sub.status === status
                ? 'text-white'
                : 'border-card-border text-untamed-white-muted hover:border-white/30'
            )}
            style={sub.status === status ? { borderColor: STATUS_COLORS[status], backgroundColor: `${STATUS_COLORS[status]}20` } : undefined}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Admin notes */}
      <div>
        <label className="block text-xs text-untamed-white-muted mb-1">Admin Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-untamed-black-light border border-card-border rounded-lg text-white text-sm placeholder:text-untamed-white-muted/50 focus:outline-none focus:border-[#FFD700]/50 transition-colors resize-none"
          placeholder="Internal notes..."
        />
        <button
          onClick={saveNotes}
          disabled={saving || notes === (sub.admin_notes || '')}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/20 disabled:opacity-40 transition-all"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save Notes
        </button>
      </div>

      {/* Reply link */}
      <a
        href={`mailto:${sub.email}?subject=Re: Your message to Untamed Beverages`}
        onClick={() => onUpdate({ status: 'replied' })}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-all"
      >
        <Mail className="w-4 h-4" />
        Reply via Email
      </a>
    </div>
  )
}
