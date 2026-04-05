export type NodeType = 'aspect' | 'goal' | 'note'

export interface GraphNode {
  id: string
  nodeType: NodeType
  label: string
  color: string
  x: number
  y: number
  radius: number
  aspectId?: string
}

export interface GraphLink {
  id: string
  sourceId: string
  targetId: string
  implicit: boolean // true = same-aspect affinity or goal->aspect, not a user-created link
}
