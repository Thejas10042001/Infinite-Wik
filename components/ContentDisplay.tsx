/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useCallback } from 'react';
import { getShortDefinition } from '../services/geminiService';

interface ContentDisplayProps {
  content: string;
  isLoading: boolean;
  onWordClick: (word: string) => void;
}

/**
 * A component that wraps a keyword, fetching and displaying a definition tooltip on hover.
 */
const KeywordWithTooltip: React.FC<{
  keyword: string;
  onWordClick: (word: string) => void;
}> = ({ keyword, onWordClick }) => {
  const [definition, setDefinition] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  // Removes only leading/trailing punctuation, preserving it within words (e.g., "Node.js", "word's").
  const cleanWord = keyword.replace(/^[.,!?;:()"']+|[.,!?;:()"']+$/g, '');

  const fetchDefinition = useCallback(async () => {
    if (!definition && cleanWord) {
      setIsLoading(true);
      const shortDef = await getShortDefinition(cleanWord);
      setDefinition(shortDef);
      setIsLoading(false);
    }
  }, [definition, cleanWord]);

  const handleMouseEnter = () => {
    setIsTooltipVisible(true);
    if (!definition && !isLoading) {
      // Debounce the API call to avoid fetching on brief mouse-overs
      hoverTimeoutRef.current = window.setTimeout(fetchDefinition, 300);
    }
  };

  const handleMouseLeave = () => {
    setIsTooltipVisible(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };
  
  if (!cleanWord) return <span>{keyword}</span>;

  return (
    <span className="tooltip-container" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        onClick={() => onWordClick(cleanWord)}
        className="interactive-word keyword"
        aria-label={`Learn more about ${cleanWord}`}
        aria-describedby={isTooltipVisible ? `tooltip-${cleanWord}` : undefined}
      >
        {keyword}
      </button>
      {isTooltipVisible && (
        <span id={`tooltip-${cleanWord}`} className="tooltip-content" role="tooltip">
          {isLoading ? 'Loading...' : definition}
        </span>
      )}
    </span>
  );
};

/**
 * A helper function that parses a string and renders its words as clickable buttons,
 * while also handling a custom markdown for highlighted keywords.
 */
const renderClickableText = (
  text: string,
  onWordClick: (word: string) => void,
  baseKey: string,
) => {
  // Split by the markdown-like syntax for keywords, keeping the delimiters
  const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);

  return parts.map((part, partIndex) => {
    const key = `${baseKey}-part-${partIndex}`;
    // If the part is a keyword...
    if (part.startsWith('**') && part.endsWith('**')) {
      const keyword = part.substring(2, part.length - 2);
      return (
        <KeywordWithTooltip 
          key={key} 
          keyword={keyword} 
          onWordClick={onWordClick} 
        />
      );
    } else {
      // Otherwise, it's a normal text part; make its words clickable
      const words = part.split(/(\s+)/).filter(Boolean);
      return words.map((word, wordIndex) => {
        const wordKey = `${key}-word-${wordIndex}`;
        if (/\S/.test(word)) {
          // Removes only leading/trailing punctuation, preserving it within words.
          const cleanWord = word.replace(/^[.,!?;:()"']+|[.,!?;:()"']+$/g, '');
          if (cleanWord) {
            return (
              <button
                key={wordKey}
                onClick={() => onWordClick(cleanWord)}
                className="interactive-word"
                aria-label={`Learn more about ${cleanWord}`}
              >
                {word}
              </button>
            );
          }
        }
        // Render whitespace or un-clickable punctuation
        return <span key={wordKey}>{word}</span>;
      });
    }
  });
};

/**
 * Renders the final, interactive content, parsing paragraphs, lists, and keywords.
 */
const InteractiveContent: React.FC<{
  content: string;
  onWordClick: (word: string) => void;
}> = ({ content, onWordClick }) => {
  // Split content into paragraphs/lines
  const paragraphs = content.split('\n').filter(p => p.trim() !== '');

  return (
    <div>
      {paragraphs.map((para, paraIndex) => {
        const key = `para-${paraIndex}`;
        const trimmedPara = para.trim();

        // Check for bullet point to render a list item
        if (trimmedPara.startsWith('•')) {
          const listItemContent = trimmedPara.substring(1).trim();
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'flex-start', margin: '0.5em 0 0.5em 1em', textAlign: 'justify' }}>
              <span style={{ marginRight: '0.5em', lineHeight: '1.6' }}>•</span>
              <div style={{ flex: 1 }}>
                {renderClickableText(listItemContent, onWordClick, key)}
              </div>
            </div>
          );
        } else {
          // Render a standard paragraph
          return (
            <p key={key} style={{ margin: '0 0 1em 0', textAlign: 'justify' }}>
              {renderClickableText(para, onWordClick, key)}
            </p>
          );
        }
      })}
    </div>
  );
};

/**
 * Renders the content as it streams in, including highlighting keywords on the fly.
 */
const StreamingContent: React.FC<{ content: string }> = ({ content }) => {
  const parts = content.split(/(\*\*.*?\*\*)/g).filter(Boolean);

  return (
    <div style={{ margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={index} className="keyword">
              {part.substring(2, part.length - 2)}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
      <span className="blinking-cursor">|</span>
    </div>
  );
};


const ContentDisplay: React.FC<ContentDisplayProps> = ({ content, isLoading, onWordClick }) => {
  if (isLoading) {
    return <StreamingContent content={content} />;
  }
  
  if (content) {
    return <InteractiveContent content={content} onWordClick={onWordClick} />;
  }

  return null;
};

export default ContentDisplay;