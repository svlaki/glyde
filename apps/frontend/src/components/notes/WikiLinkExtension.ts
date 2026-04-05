import { Node, mergeAttributes } from '@tiptap/core'

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, any>
  onWikiLinkClick: ((title: string) => void) | undefined
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      insertWikiLink: (title: string) => ReturnType
    }
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onWikiLinkClick: undefined,
    }
  },

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-wiki-title'),
        renderHTML: (attributes) => ({
          'data-wiki-title': attributes.title,
        }),
      },
      color: {
        default: '#6b7280',
        parseHTML: (element) => element.getAttribute('data-wiki-color'),
        renderHTML: (attributes) => ({
          'data-wiki-color': attributes.color,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-wiki-link': '',
        style: `color: ${HTMLAttributes['data-wiki-color'] || '#6b7280'}; cursor: pointer; text-decoration: underline; text-decoration-style: dotted; font-weight: 500;`,
        class: 'wiki-link',
      }),
      `[[${HTMLAttributes['data-wiki-title'] || ''}]]`,
    ]
  },

  addCommands() {
    return {
      insertWikiLink:
        (title: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { title },
          })
        },
    }
  },

  addNodeView() {
    return ({ node }: { node: any }) => {
      const span = document.createElement('span')
      span.setAttribute('data-wiki-link', '')
      span.setAttribute('data-wiki-title', node.attrs.title || '')
      span.style.color = node.attrs.color || '#6b7280'
      span.style.cursor = 'pointer'
      span.style.textDecoration = 'underline'
      span.style.textDecorationStyle = 'dotted'
      span.style.fontWeight = '500'
      span.textContent = `[[${node.attrs.title || ''}]]`

      span.addEventListener('click', () => {
        if (this.options.onWikiLinkClick) {
          this.options.onWikiLinkClick(node.attrs.title)
        }
      })

      return {
        dom: span,
      }
    }
  },
})
