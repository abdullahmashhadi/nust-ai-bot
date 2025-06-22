import React from "react";

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({
  content,
  isUser = false,
}) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  const renderFormattedContent = (text: string) => {
    const paragraphs = text.split("\n\n");

    return paragraphs
      .map((paragraph, index) => {
        if (!paragraph.trim()) return null;

        return (
          <div key={index} className={index > 0 ? "mt-3" : ""}>
            {renderParagraph(paragraph)}
          </div>
        );
      })
      .filter(Boolean);
  };

  const renderParagraph = (text: string) => {
    const lines = text.split("\n");

    return lines
      .map((line, lineIndex) => {
        if (!line.trim()) return null;

        if (line.match(/^[•-]\s+/)) {
          const content = line.replace(/^[•-]\s+/, "");
          return (
            <div key={lineIndex} className="flex items-start mb-1">
              <span className="text-blue-500 mr-2 mt-0.5">•</span>
              <span>{renderInlineFormatting(content)}</span>
            </div>
          );
        }

        if (line.match(/^\d+\.\s+/)) {
          return (
            <div key={lineIndex} className="mb-1">
              {renderInlineFormatting(line)}
            </div>
          );
        }

        return (
          <div key={lineIndex} className={lineIndex > 0 ? "mt-2" : ""}>
            {renderInlineFormatting(line)}
          </div>
        );
      })
      .filter(Boolean);
  };

  const renderInlineFormatting = (text: string) => {
    const parts = [];
    let lastIndex = 0;

    const inlineRegex =
      /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;

    let match;
    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const fullMatch = match[1];

      if (fullMatch.startsWith("**") && fullMatch.endsWith("**")) {
        // Bold text
        const boldText = match[2];
        parts.push(
          <strong
            key={match.index}
            className="font-semibold text-gray-900 dark:text-white"
          >
            {boldText}
          </strong>
        );
      } else if (fullMatch.startsWith("*") && fullMatch.endsWith("*")) {
        // Italic text
        const italicText = match[3];
        parts.push(
          <em key={match.index} className="italic">
            {italicText}
          </em>
        );
      } else if (fullMatch.startsWith("[") && fullMatch.includes("](")) {
        // Link
        const linkText = match[4];
        const linkUrl = match[5];
        parts.push(
          <a
            key={match.index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 underline font-medium transition-colors"
          >
            {linkText}
          </a>
        );
      }

      lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="formatted-message">{renderFormattedContent(content)}</div>
  );
};

export default MessageRenderer;
