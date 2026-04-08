import type { FlowPostJoined } from '@/lib/flow/generate-flow-post'

export type FlowAssetEntry = {
  url: string
  kind: 'generated' | 'reference_library' | 'reference_end' | 'reference_external'
  segmentId: string
  sortOrder: number
  label: string
}

function pushUnique(map: Map<string, FlowAssetEntry>, entry: FlowAssetEntry) {
  if (!entry.url?.trim()) return
  const u = entry.url.trim()
  if (map.has(u)) return
  map.set(u, { ...entry, url: u })
}

/**
 * All URLs associated with flow segments (outputs + inputs) for copy/reuse.
 */
export function collectFlowAssets(posts: FlowPostJoined[]): FlowAssetEntry[] {
  const map = new Map<string, FlowAssetEntry>()
  const sorted = [...posts].sort((a, b) => a.sort_order - b.sort_order)

  for (const p of sorted) {
    const base = `Segment ${p.sort_order + 1}`

    if (p.reference_external_url?.trim()) {
      pushUnique(map, {
        url: p.reference_external_url.trim(),
        kind: 'reference_external',
        segmentId: p.id,
        sortOrder: p.sort_order,
        label: `${base} external reference`,
      })
    }

    if (p.reference_media?.url) {
      pushUnique(map, {
        url: p.reference_media.url,
        kind: 'reference_library',
        segmentId: p.id,
        sortOrder: p.sort_order,
        label: `${base} library reference`,
      })
    }

    if (p.end_reference_media?.url) {
      pushUnique(map, {
        url: p.end_reference_media.url,
        kind: 'reference_end',
        segmentId: p.id,
        sortOrder: p.sort_order,
        label: `${base} end-frame reference`,
      })
    }

    if (p.generated_media?.url) {
      pushUnique(map, {
        url: p.generated_media.url,
        kind: 'generated',
        segmentId: p.id,
        sortOrder: p.sort_order,
        label: `${base} generated (${p.generated_media.file_type})`,
      })
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    const order: FlowAssetEntry['kind'][] = [
      'reference_external',
      'reference_library',
      'reference_end',
      'generated',
    ]
    return order.indexOf(a.kind) - order.indexOf(b.kind)
  })
}
