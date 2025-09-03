import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownBlockProps {
  blockMatch: {
    output: string;
    visibleText: string;
  };
}

const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ blockMatch }) => {
  return (
    <div className="prose prose-sm max-w-none text-gray-900 prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize code blocks to avoid conflicts with CodeBlock component
          code: ({ node, inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code
                  className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            // For block code, just render as plain text since CodeBlock handles this
            return (
              <pre className="bg-gray-50 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          // Customize links
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
              {...props}
            >
              {children}
            </a>
          ),
          // Customize lists
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside space-y-1 ml-4" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 ml-4" {...props}>
              {children}
            </ol>
          ),
          // Customize headings
          h1: ({ children, ...props }) => (
            <h1 className="text-xl font-semibold text-gray-900 mb-3 mt-4 first:mt-0" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-lg font-semibold text-gray-900 mb-2 mt-3 first:mt-0" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-base font-semibold text-gray-900 mb-2 mt-3 first:mt-0" {...props}>
              {children}
            </h3>
          ),
          // Customize paragraphs
          p: ({ children, ...props }) => (
            <p className="text-gray-700 mb-3 last:mb-0 leading-relaxed" {...props}>
              {children}
            </p>
          ),
          // Customize blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-4 border-blue-200 pl-4 italic text-gray-600 my-3" {...props}>
              {children}
            </blockquote>
          ),
        }}
      >
        {blockMatch.output}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownBlock;