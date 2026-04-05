import { KnowledgeGraphSVG } from '../graph/KnowledgeGraphSVG'
import type { KnowledgeGraphData } from '../../lib/knowledgeGraphService'

interface NoteGraphProps {
  graphData: KnowledgeGraphData
  onNodeClick?: (nodeType: string, nodeId: string) => void
  onCreateLink: (sourceType: string, sourceId: string, targetType: string, targetId: string) => void
  onDeleteLink?: (linkId: string) => void
  onBackgroundAction?: (action: string) => void
  onSavePositions?: (positions: Record<string, { x: number; y: number }>) => void
  onNodeAction?: (action: string, nodeType: string, nodeId: string) => void
  isLoading?: boolean
}

export function NoteGraph({ graphData, onNodeClick, onCreateLink, onDeleteLink, onBackgroundAction, onSavePositions, onNodeAction, isLoading }: NoteGraphProps) {
  return (
    <KnowledgeGraphSVG
      data={graphData}
      isLoading={isLoading || false}
      onCreateLink={onCreateLink}
      onDeleteLink={onDeleteLink}
      onNodeClick={onNodeClick}
      onBackgroundAction={onBackgroundAction}
      onSavePositions={onSavePositions}
      onNodeAction={onNodeAction}
    />
  )
}
