import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { WikiLinkSuggestion } from './WikiLinkSuggestion'
import type { SuggestionNote } from './WikiLinkSuggestion'
import type { Note } from '../../lib/notesService'

interface NoteEditorProps {
  content: string
  onChange: (markdown: string) => void
  onWikiLinkClick: (title: string) => void
  notes: Note[]
  placeholder?: string
  isMobile?: boolean
}

export function NoteEditor({ content, onChange, onWikiLinkClick, notes, placeholder, isMobile }: NoteEditorProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState('')
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 })
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing... Use [[ to link notes',
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'note-editor-content',
        style: `color: ${colors.textPrimary}; outline: none; min-height: ${isMobile ? 'calc(100vh - 250px)' : '200px'}; padding: 12px; font-size: ${isMobile ? '16px' : '14px'}; line-height: 1.7;`,
      },
      handleKeyDown: (_view, event) => {
        if (showSuggestion) {
          if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
            return true
          }
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = (ed.storage as any).markdown.getMarkdown()
      onChange(md)
      checkForWikiLinkTrigger(ed)
    },
  })

  const checkForWikiLinkTrigger = useCallback((ed: any) => {
    const { state } = ed
    const { selection } = state
    const { $from } = selection

    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
    const match = textBefore.match(/\[\[([^\]]*)$/)

    if (match) {
      setSuggestionQuery(match[1])
      setShowSuggestion(true)

      // Position the suggestion popup near the cursor
      const coords = ed.view.coordsAtPos($from.pos)
      setSuggestionPosition({
        top: coords.bottom + 4,
        left: coords.left,
      })
    } else {
      setShowSuggestion(false)
      setSuggestionQuery('')
    }
  }, [])

  // Update editor content when prop changes (note switch)
  useEffect(() => {
    if (editor && content !== (editor.storage as any).markdown.getMarkdown()) {
      editor.commands.setContent(content || '')
    }
  }, [content, editor])

  // Update editor styling when theme changes
  useEffect(() => {
    if (editor) {
      editor.view.dom.style.color = colors.textPrimary
    }
  }, [editor, colors.textPrimary])

  const handleSuggestionSelect = useCallback((title: string) => {
    if (!editor) return

    const { state } = editor
    const { selection } = state
    const { $from } = selection

    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
    const match = textBefore.match(/\[\[([^\]]*)$/)

    if (match) {
      // Delete the [[ and partial query, insert the full wiki-link text
      const start = $from.pos - match[0].length
      const end = $from.pos

      editor
        .chain()
        .focus()
        .deleteRange({ from: start, to: end })
        .insertContent(`[[${title}]]`)
        .run()
    }

    setShowSuggestion(false)
    setSuggestionQuery('')
  }, [editor])

  const handleSuggestionClose = useCallback(() => {
    setShowSuggestion(false)
    setSuggestionQuery('')
  }, [])

  // Handle clicks on wiki-links in the rendered content
  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Check for [[text]] pattern in clicked text
      const text = target.textContent || ''
      const linkMatch = text.match(/^\[\[(.+)\]\]$/)
      if (linkMatch) {
        e.preventDefault()
        onWikiLinkClick(linkMatch[1] ?? '')
      }
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [onWikiLinkClick])

  const suggestionNotes: SuggestionNote[] = notes.map(n => ({
    id: n.id,
    title: n.title,
    aspect_color: n.aspect_color ?? undefined,
    aspect_name: n.aspect_name ?? undefined,
  }))

  return (
    <div ref={editorContainerRef} style={{ flex: 1, position: 'relative' }}>
      <style>{`
        .note-editor-content {
          font-family: inherit;
        }
        .note-editor-content h1 {
          font-size: 1.5em;
          font-weight: 700;
          margin: 0.5em 0 0.3em;
        }
        .note-editor-content h2 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.4em 0 0.2em;
        }
        .note-editor-content h3 {
          font-size: 1.1em;
          font-weight: 600;
          margin: 0.3em 0 0.2em;
        }
        .note-editor-content p {
          margin: 0.2em 0;
        }
        .note-editor-content ul, .note-editor-content ol {
          padding-left: 1.5em;
          margin: 0.3em 0;
        }
        .note-editor-content blockquote {
          border-left: 3px solid ${colors.border};
          padding-left: 12px;
          margin: 0.5em 0;
          color: ${colors.textSecondary};
        }
        .note-editor-content code {
          background: ${isDarkMode ? '#374151' : '#f3f4f6'};
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 0.9em;
        }
        .note-editor-content pre {
          background: ${isDarkMode ? '#1e293b' : '#f1f5f9'};
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 0.5em 0;
        }
        .note-editor-content pre code {
          background: transparent;
          padding: 0;
        }
        .note-editor-content .ProseMirror-focused {
          outline: none;
        }
        .note-editor-content p.is-editor-empty:first-child::before {
          color: ${colors.textTertiary};
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .editor-link {
          color: #3b82f6;
          text-decoration: underline;
        }
      `}</style>
      <EditorContent
        editor={editor}
        style={{
          flex: 1,
          background: colors.bgSecondary,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
          overflow: 'auto',
        }}
      />
      {showSuggestion && (
        <WikiLinkSuggestion
          query={suggestionQuery}
          notes={suggestionNotes}
          onSelect={handleSuggestionSelect}
          onClose={handleSuggestionClose}
          position={suggestionPosition}
        />
      )}
    </div>
  )
}
