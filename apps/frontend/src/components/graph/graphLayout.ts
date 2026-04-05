import type { GraphNode, GraphLink } from './graphTypes'
import type { KGAspect, KGGoal, KGNote, EntityLink } from '../../lib/knowledgeGraphService'

const ASPECT_RADIUS = 22
const GOAL_RADIUS = 14
const NOTE_RADIUS = 8

export function buildGraphNodes(
  aspects: KGAspect[],
  goals: KGGoal[],
  notes: KGNote[],
  centerX: number,
  centerY: number,
  orbitRadius: number,
  savedPositions?: Map<string, { x: number; y: number }>
): GraphNode[] {
  const nodes: GraphNode[] = []
  const aspectPositions = new Map<string, { x: number; y: number }>()

  // Aspects: evenly spaced in outer circle
  aspects.forEach((a, i) => {
    const angle = (2 * Math.PI * i) / aspects.length - Math.PI / 2
    const defaultX = centerX + orbitRadius * Math.cos(angle)
    const defaultY = centerY + orbitRadius * Math.sin(angle)
    const saved = savedPositions?.get(a.id)
    const x = saved?.x ?? defaultX
    const y = saved?.y ?? defaultY
    aspectPositions.set(a.id, { x, y })
    nodes.push({ id: a.id, nodeType: 'aspect', label: a.name, color: a.color || '#6b7280', x, y, radius: ASPECT_RADIUS })
  })

  // Goals: clustered near their aspect
  const goalsByAspect = new Map<string, KGGoal[]>()
  for (const g of goals) {
    const list = goalsByAspect.get(g.aspect_id) || []
    list.push(g)
    goalsByAspect.set(g.aspect_id, list)
  }

  for (const [aspectId, aspectGoals] of goalsByAspect) {
    const ap = aspectPositions.get(aspectId)
    if (!ap) continue
    const dx = ap.x - centerX
    const dy = ap.y - centerY
    const baseAngle = Math.atan2(dy, dx)

    aspectGoals.forEach((g, i) => {
      const spread = 0.5
      const offset = (i - (aspectGoals.length - 1) / 2) * spread
      const angle = baseAngle + offset
      const dist = orbitRadius * 0.6
      const defaultX = centerX + dist * Math.cos(angle)
      const defaultY = centerY + dist * Math.sin(angle)
      const saved = savedPositions?.get(g.id)
      nodes.push({
        id: g.id, nodeType: 'goal', label: g.title, color: g.aspect_color || '#6b7280',
        x: saved?.x ?? defaultX, y: saved?.y ?? defaultY, radius: GOAL_RADIUS, aspectId: g.aspect_id,
      })
    })
  }

  // Notes: near their aspect, or center if no aspect
  const notesByAspect = new Map<string, KGNote[]>()
  const unlinkedNotes: KGNote[] = []
  for (const n of notes) {
    if (n.aspect_id && aspectPositions.has(n.aspect_id)) {
      const list = notesByAspect.get(n.aspect_id) || []
      list.push(n)
      notesByAspect.set(n.aspect_id, list)
    } else {
      unlinkedNotes.push(n)
    }
  }

  for (const [aspectId, aspectNotes] of notesByAspect) {
    const ap = aspectPositions.get(aspectId)
    if (!ap) continue
    const dx = ap.x - centerX
    const dy = ap.y - centerY
    const baseAngle = Math.atan2(dy, dx)

    aspectNotes.forEach((n, i) => {
      const spread = 0.35
      const offset = (i - (aspectNotes.length - 1) / 2) * spread
      const angle = baseAngle + offset
      const dist = orbitRadius * 0.3 + (i % 3) * 20
      const defaultX = centerX + dist * Math.cos(angle)
      const defaultY = centerY + dist * Math.sin(angle)
      const saved = savedPositions?.get(n.id)
      nodes.push({
        id: n.id, nodeType: 'note', label: n.title, color: n.aspect_color || '#6b7280',
        x: saved?.x ?? defaultX, y: saved?.y ?? defaultY, radius: NOTE_RADIUS, aspectId: n.aspect_id,
        isScribe: n.source === 'scribe',
      })
    })
  }

  // Aspect-free notes: arrange near center in a loose cluster
  unlinkedNotes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(unlinkedNotes.length, 1)
    const dist = orbitRadius * 0.15 + (i % 3) * 15
    const defaultX = centerX + dist * Math.cos(angle)
    const defaultY = centerY + dist * Math.sin(angle)
    const saved = savedPositions?.get(n.id)
    nodes.push({
      id: n.id, nodeType: 'note', label: n.title, color: n.aspect_color || '#9ca3af',
      x: saved?.x ?? defaultX, y: saved?.y ?? defaultY, radius: NOTE_RADIUS,
      isScribe: n.source === 'scribe',
    })
  })

  return nodes
}

export function buildGraphLinks(
  links: EntityLink[],
  goals: KGGoal[],
  nodes: GraphNode[],
  nodeIds: Set<string>
): GraphLink[] {
  const result: GraphLink[] = []
  const explicitSet = new Set<string>() // "id1-id2" pairs for dedup

  // Implicit links: goal -> aspect
  for (const g of goals) {
    if (g.aspect_id && nodeIds.has(g.aspect_id) && nodeIds.has(g.id)) {
      const key = [g.id, g.aspect_id].sort().join('-')
      explicitSet.add(key)
      result.push({ id: `goal-aspect-${g.id}`, sourceId: g.id, targetId: g.aspect_id, implicit: true })
    }
  }

  // Explicit entity_links
  for (const link of links) {
    if (nodeIds.has(link.source_id) && nodeIds.has(link.target_id)) {
      const key = [link.source_id, link.target_id].sort().join('-')
      explicitSet.add(key)
      result.push({ id: link.id, sourceId: link.source_id, targetId: link.target_id, implicit: false })
    }
  }

  // Same-aspect affinity lines (dotted) - between nodes sharing an aspect, not already linked
  const byAspect = new Map<string, GraphNode[]>()
  for (const n of nodes) {
    if (n.nodeType === 'aspect') {
      // Include aspect node in its own group so notes/goals get dotted lines to it
      const list = byAspect.get(n.id) || []
      list.push(n)
      byAspect.set(n.id, list)
    } else if (n.aspectId) {
      const list = byAspect.get(n.aspectId) || []
      list.push(n)
      byAspect.set(n.aspectId, list)
    }
  }

  for (const [, group] of byAspect) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = [group[i].id, group[j].id].sort().join('-')
        if (!explicitSet.has(key)) {
          result.push({ id: `affinity-${key}`, sourceId: group[i].id, targetId: group[j].id, implicit: true })
        }
      }
    }
  }

  return result
}
