import React from "react";

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({
  content,
  isUser = false,
}) => {
  // Function to detect if text contains Urdu/Arabic characters
  const containsUrdu = (text: string) => {
    const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
    return urduRegex.test(text);
  };

  const hasUrduContent = containsUrdu(content);

  if (isUser) {
    return (
      <div 
        className={`whitespace-pre-wrap ${hasUrduContent ? 'text-right' : ''}`}
        style={{ 
          fontFamily: hasUrduContent ? 'Noto Sans Urdu, Arial, sans-serif' : 'inherit',
          direction: hasUrduContent ? 'rtl' : 'ltr'
        }}
      >
        {content}
      </div>
    );
  }

  const renderFormattedContent = (text: string) => {
    const paragraphs = text.split("\n\n");

    return paragraphs
      .map((paragraph, index) => {
        if (!paragraph.trim()) return null;

        const paragraphHasUrdu = containsUrdu(paragraph);

        return (
          <div 
            key={index} 
            className={index > 0 ? "mt-3" : ""}
            style={{ 
              fontFamily: paragraphHasUrdu ? 'Noto Sans Urdu, Arial, sans-serif' : 'inherit',
              direction: paragraphHasUrdu ? 'rtl' : 'ltr',
              textAlign: paragraphHasUrdu ? 'right' : 'left'
            }}
          >
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
        if (line.trim() === "---") {
          return (
            <div key={lineIndex} className="my-4">
              <hr className="border-t border-gray-300 dark:border-gray-600" />
            </div>
          );
        }

        const lineHasUrdu = containsUrdu(line);

        if (line.match(/^[•-]\s+/)) {
          const content = line.replace(/^[•-]\s+/, "");
          return (
            <div 
              key={lineIndex} 
              className={`flex items-start mb-1 ${lineHasUrdu ? 'flex-row-reverse' : ''}`}
              style={{ 
                direction: lineHasUrdu ? 'rtl' : 'ltr'
              }}
            >
              <span className={`text-blue-500 mt-0.5 ${lineHasUrdu ? 'ml-2 mr-0' : 'mr-2 ml-0'}`}>•</span>
              <span>{renderInlineFormatting(content)}</span>
            </div>
          );
        }

        if (line.match(/^\d+\.\s+/)) {
          return (
            <div 
              key={lineIndex} 
              className="mb-1"
              style={{ 
                direction: lineHasUrdu ? 'rtl' : 'ltr',
                textAlign: lineHasUrdu ? 'right' : 'left'
              }}
            >
              {renderInlineFormatting(line)}
            </div>
          );
        }

        return (
          <div 
            key={lineIndex} 
            className={lineIndex > 0 ? "mt-2" : ""}
            style={{ 
              direction: lineHasUrdu ? 'rtl' : 'ltr',
              textAlign: lineHasUrdu ? 'right' : 'left'
            }}
          >
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
            className="font-semibold text-gray-800"
            style={{ 
              fontFamily: containsUrdu(boldText) ? 'Noto Sans Urdu, Arial, sans-serif' : 'inherit'
            }}
          >
            {boldText}
          </strong>
        );
      } else if (fullMatch.startsWith("*") && fullMatch.endsWith("*")) {
        // Italic text
        const italicText = match[3];
        parts.push(
          <em 
            key={match.index} 
            className="italic"
            style={{ 
              fontFamily: containsUrdu(italicText) ? 'Noto Sans Urdu, Arial, sans-serif' : 'inherit'
            }}
          >
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
            style={{ 
              fontFamily: containsUrdu(linkText) ? 'Noto Sans Urdu, Arial, sans-serif' : 'inherit'
            }}
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