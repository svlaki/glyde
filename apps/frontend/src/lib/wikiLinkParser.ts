/**
 * Extract all [[wiki-link]] titles from markdown content.
 * Supports [[Title]] and [[Title|Display Text]] syntax.
 */
export function extractWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  const titles: string[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    const title = match[1]?.trim() ?? ''
    if (title && !titles.includes(title)) {
      titles.push(title)
    }
  }

  return titles
}
