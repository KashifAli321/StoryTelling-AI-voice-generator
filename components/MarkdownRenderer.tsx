import React from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Configure marked to add breaks on newlines
  const html = marked.parse(content, { breaks: true });

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html as string }}
    />
  );
};

export default MarkdownRenderer;
