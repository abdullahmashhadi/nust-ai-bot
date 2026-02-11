import React, { useState } from "react";

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
  onFeedback?: (feedback: 'positive' | 'negative') => void;
  feedback?: 'positive' | 'negative' | 'neutral';
  showFeedback?: boolean;
  onCopy?: () => void;
  isStreaming?: boolean;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({
  content,
  isUser = false,
  onFeedback,
  feedback,
  showFeedback = false,
  onCopy,
  isStreaming = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
    <div>
      <div className="formatted-message">{renderFormattedContent(content)}</div>
      
      {!isUser && !isStreaming && (
        <div className="flex items-center gap-2 mt-2">
          {/* Copy button - show when response is complete */}
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded transition-colors ${
              copied
                ? 'bg-blue-100 text-blue-600'
                : 'hover:bg-gray-100 text-gray-500 hover:text-blue-600'
            }`}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            )}
          </button>

          {/* Feedback buttons - only show when queryId exists */}
          {showFeedback && onFeedback && (
            <>
              <button
                onClick={() => onFeedback('positive')}
                disabled={feedback === 'positive'}
                className={`p-1.5 rounded transition-colors ${
                  feedback === 'positive'
                    ? 'bg-green-100 text-green-600'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-green-600'
                }`}
                title="Helpful"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
              </button>
              <button
                onClick={() => onFeedback('negative')}
                disabled={feedback === 'negative'}
                className={`p-1.5 rounded transition-colors ${
                  feedback === 'negative'
                    ? 'bg-red-100 text-red-600'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-red-600'
                }`}
                title="Not helpful"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageRenderer;