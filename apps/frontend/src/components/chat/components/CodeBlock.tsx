import React, { useState, useEffect } from 'react';
import { loadHighlighter } from '@llm-ui/code';
import { getHighlighterCore } from 'shiki/core';
import { bundledLanguages } from 'shiki/langs';
import { bundledThemes } from 'shiki/themes';
import getWasm from 'shiki/wasm';
import htmlParser from 'html-react-parser';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  blockMatch: {
    output: string;
    visibleText: string;
  };
}

// Initialize the highlighter
const highlighterPromise = loadHighlighter(
  getHighlighterCore({
    langs: Object.keys(bundledLanguages),
    themes: ['github-dark', 'github-light'],
    loadWasm: getWasm,
  })
);

const CodeBlock: React.FC<CodeBlockProps> = ({ blockMatch }) => {
  const [highlightedCode, setHighlightedCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const highlightCode = async () => {
      try {
        const { getHighlighter } = highlighterPromise;
        const highlighter = getHighlighter();
        
        if (highlighter) {
          // Extract code and language from markdown code block format
          const codeBlockMatch = blockMatch.output.match(/```(\w+)?\n?([\s\S]*?)```?$/);
          
          if (codeBlockMatch) {
            const language = codeBlockMatch[1] || 'text';
            const code = codeBlockMatch[2] || blockMatch.output;
            
            const highlighted = highlighter.codeToHtml(code, {
              lang: language,
              theme: 'github-dark',
            });
            
            setHighlightedCode(highlighted);
          } else {
            // Fallback for plain code
            const highlighted = highlighter.codeToHtml(blockMatch.output, {
              lang: 'text',
              theme: 'github-dark',
            });
            setHighlightedCode(highlighted);
          }
        } else {
          // Fallback if highlighter not ready
          setHighlightedCode(`<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto"><code>${blockMatch.output}</code></pre>`);
        }
      } catch (error) {
        console.error('Error highlighting code:', error);
        // Fallback
        setHighlightedCode(`<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto"><code>${blockMatch.output}</code></pre>`);
      }
    };

    highlightCode();
  }, [blockMatch.output]);

  const copyToClipboard = async () => {
    try {
      // Extract raw code from the code block
      const codeBlockMatch = blockMatch.output.match(/```(\w+)?\n?([\s\S]*?)```?$/);
      const codeToCopy = codeBlockMatch ? codeBlockMatch[2] : blockMatch.output;
      
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  if (!highlightedCode) {
    return (
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative group my-4">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded text-xs transition-colors duration-200"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy
            </>
          )}
        </button>
      </div>
      
      <div className="code-block-container [&_pre]:!bg-gray-900 [&_pre]:!p-4 [&_pre]:!rounded-lg [&_pre]:!overflow-x-auto [&_code]:!bg-transparent [&_code]:!text-sm [&_code]:!font-mono">
        {htmlParser(highlightedCode)}
      </div>
    </div>
  );
};

export default CodeBlock;