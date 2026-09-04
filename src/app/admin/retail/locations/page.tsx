'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { MapLinks } from '@/components/locations/MapLinks'
import type { GeocodeCandidate } from '@/lib/retail/geocode'
import {
  formatAddress,
  LOCATION_TYPE_LABELS,
  LOCATION_TYPES,
  type RetailLocation,
  type RetailLocationType,
} from '@/lib/retail/locations'

interface FormState {
  name: string
  chain: string
  location_type: RetailLocationType
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
  latitude: string
  longitude: string
  phone: string
  published: boolean
  notes: string
}

const EMPTY: FormState = {
  name: '',
  chain: 'Total Wine & More',
  location_type: 'liquor_store',
  address_line1: '',
  address_line2: '',
  city: '',
  state: 'FL',
  postal_code: '',
  latitude: '',
  longitude: '',
  phone: '',
  published: true,
  notes: '',
}

function fromLocation(loc: RetailLocation): FormState {
  return {
    name: loc.name,
    chain: loc.chain || '',
    location_type: loc.location_type,
    address_line1: loc.address_line1,
    address_line2: loc.address_line2 || '',
    city: loc.city,
    state: loc.state,
    postal_code: loc.postal_code,
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    phone: loc.phone || '',
    published: loc.published,
    notes: loc.notes || '',
  }
}

function toPayload(form: FormState) {
  return {
    name: form.name,
    chain: form.chain,
    location_type: form.location_type,
    address_line1: form.address_line1,
    address_line2: form.address_line2,
    city: form.city,
    state: form.state,
    postal_code: form.postal_code,
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    phone: form.phone,
    published: form.published,
    notes: form.notes,
  }
}

const inputClass =
  'w-full rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2.5 text-sm text-white placeholder:text-[#666] focus:outline-none focus:border-[#9B30FF]'

export default function AdminRetailLocationsPage() {
  const [locations, setLocations] = useState<RetailLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [lookupQuery, setLookupQuery] = useState('')
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([])

  const load = useCallback(() => {
    return fetch('/api/admin/retail/locations')
      .then((res) => res.json())
      .then((data) => setLocations(data.locations || []))
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const selected = selectedId && selectedId !== 'new'
    ? locations.find((l) => l.id === selectedId) || null
    : null

  function startNew() {
    setSelectedId('new')
    setForm(EMPTY)
    setCandidates([])
    setLookupQuery('')
    setError('')
  }

  function selectLocation(loc: RetailLocation) {
    setSelectedId(loc.id)
    setForm(fromLocation(loc))
    setCandidates([])
    setLookupQuery(formatAddress(loc))
    setError('')
  }

  async function lookup() {
    const query = lookupQuery.trim() || [form.address_line1, form.city, form.state, form.postal_code]
      .filter(Boolean)
      .join(', ')
    if (query.length < 3) {
      setError('Paste a street address to look up')
      return
    }
    setLookingUp(true)
    setError('')
    try {
      const res = await fetch('/api/admin/retail/locations/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lookup failed')
      setCandidates(data.candidates || [])
      if (!data.candidates?.length) setError('No map match. Check the address and try again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLookingUp(false)
    }
  }

  function applyCandidate(c: GeocodeCandidate) {
    setForm((prev) => ({
      ...prev,
      name: prev.name || c.name || prev.chain || prev.name,
      address_line1: c.addressLine1 || prev.address_line1,
      city: c.city || prev.city,
      state: c.state || prev.state,
      postal_code: c.postalCode || prev.postal_code,
      latitude: String(c.latitude),
      longitude: String(c.longitude),
    }))
    setCandidates([])
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const isNew = selectedId === 'new' || !selectedId
      const res = await fetch(
        isNew ? '/api/admin/retail/locations' : `/api/admin/retail/locations/${selectedId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toPayload(form)),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      await load()
      setSelectedId(data.location.id)
      setForm(fromLocation(data.location))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublished(loc: RetailLocation) {
    await fetch(`/api/admin/retail/locations/${loc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !loc.published }),
    })
    await load()
    if (selectedId === loc.id) {
      setForm((prev) => ({ ...prev, published: !loc.published }))
    }
  }

  async function remove() {
    if (!selectedId || selectedId === 'new') return
    if (!confirm('Remove this location from the map?')) return
    await fetch(`/api/admin/retail/locations/${selectedId}`, { method: 'DELETE' })
    setSelectedId(null)
    setForm(EMPTY)
    await load()
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#9B30FF]" />
      </div>
    )
  }

  const previewLoc = {
    name: form.name || 'Untitled',
    address_line1: form.address_line1 || '',
    address_line2: form.address_line2 || null,
    city: form.city || '',
    state: form.state || 'FL',
    postal_code: form.postal_code || '',
    latitude: Number(form.latitude) || 0,
    longitude: Number(form.longitude) || 0,
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Retail Locations</h1>
          <p className="text-sm text-[#999]">
            {locations.length} doors · {locations.filter((l) => l.published).length} published on /locations
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/locations"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-white hover:bg-[#1A1A1A]"
          >
            <MapPin className="h-4 w-4 text-[#FFD700]" />
            Public map
          </Link>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-2 rounded-lg bg-[#9B30FF] px-3 py-2 text-sm font-medium text-white hover:bg-[#8A28E6]"
          >
            <Plus className="h-4 w-4" />
            Add location
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => selectLocation(loc)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                selectedId === loc.id
                  ? 'border-[#9B30FF] bg-[#9B30FF]/10'
                  : 'border-[#2A2A2A] bg-[#141414] hover:border-[#444]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{loc.name}</p>
                  <p className="mt-0.5 text-xs text-[#999]">{formatAddress(loc)}</p>
                </div>
                <span
                  className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    loc.published ? 'bg-[#9B30FF]/20 text-[#C084FC]' : 'bg-[#2A2A2A] text-[#888]'
                  }`}
                >
                  {loc.published ? 'Live' : 'Hidden'}
                </span>
              </div>
            </button>
          ))}
        </div>

        {selectedId ? (
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">
                {selectedId === 'new' ? 'New location' : selected?.city || 'Edit location'}
              </h2>
              {selectedId !== 'new' && (
                <button
                  type="button"
                  onClick={remove}
                  className="inline-flex items-center gap-1.5 text-xs text-[#888] hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>

            <div className="mb-4 flex gap-2">
              <input
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Paste address — 13711 S. Tamiami Trail, Fort Myers 33912"
                className={inputClass}
              />
              <button
                type="button"
                onClick={lookup}
                disabled={lookingUp}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#2A2A2A] px-3 py-2 text-sm text-white hover:bg-[#1A1A1A] disabled:opacity-50"
              >
                {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Look up
              </button>
            </div>

            {candidates.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {candidates.map((c) => (
                  <button
                    key={`${c.latitude}-${c.longitude}-${c.source}`}
                    type="button"
                    onClick={() => applyCandidate(c)}
                    className="w-full rounded-lg border border-[#2A2A2A] px-3 py-2 text-left text-xs text-[#C8C8C8] hover:border-[#9B30FF] hover:text-white"
                  >
                    {c.name ? <span className="font-medium text-white">{c.name} · </span> : null}
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs text-[#888]">
                Name
                <input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="text-xs text-[#888]">
                Chain
                <input className={`${inputClass} mt-1`} value={form.chain} onChange={(e) => setForm({ ...form, chain: e.target.value })} />
              </label>
              <label className="text-xs text-[#888]">
                Type
                <select
                  className={`${inputClass} mt-1`}
                  value={form.location_type}
                  onChange={(e) => setForm({ ...form, location_type: e.target.value as RetailLocationType })}
                >
                  {LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              <label className="sm:col-span-2 text-xs text-[#888]">
                Street
                <input className={`${inputClass} mt-1`} value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
              </label>
              <label className="text-xs text-[#888]">
                City
                <input className={`${inputClass} mt-1`} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-[#888]">
                  State
                  <input className={`${inputClass} mt-1`} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </label>
                <label className="text-xs text-[#888]">
                  ZIP
                  <input className={`${inputClass} mt-1`} value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
                </label>
              </div>
              <label className="text-xs text-[#888]">
                Phone
                <input className={`${inputClass} mt-1`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="text-xs text-[#888]">
                Notes (admin only)
                <input className={`${inputClass} mt-1`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (selected) void togglePublished(selected)
                  else setForm((prev) => ({ ...prev, published: !prev.published }))
                }}
                className="inline-flex items-center gap-2 text-sm text-[#C8C8C8] hover:text-white"
              >
                {form.published ? <Eye className="h-4 w-4 text-[#9B30FF]" /> : <EyeOff className="h-4 w-4" />}
                {form.published ? 'Published' : 'Hidden'}
              </button>
              {Number.isFinite(Number(form.latitude)) && Number(form.latitude) !== 0 && (
                <MapLinks location={previewLoc} size="sm" />
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#9B30FF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#8A28E6] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save location
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-[#2A2A2A] p-10 text-sm text-[#666]">
            Select a door or add a new one. Paste an address and look it up — no Google API key.
          </div>
        )}
      </div>
    </div>
  )
}
