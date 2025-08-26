/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ContentDisplayProps {
  content: string;
  isLoading: boolean;
  onWordClick: (word: string) => void;
}

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
      const cleanWord = keyword.replace(/[.,!?;:()"']/g, '');
      if (!cleanWord) return <span key={key}>{keyword}</span>;

      return (
        <button
          key={key}
          onClick={() => onWordClick(cleanWord)}
          className="interactive-word"
          style={{ color: '#6F4E37', fontWeight: 'bold' }} // Coffee color and bold
          aria-label={`Learn more about ${cleanWord}`}
        >
          {keyword}
        </button>
      );
    } else {
      // Otherwise, it's a normal text part; make its words clickable
      const words = part.split(/(\s+)/).filter(Boolean);
      return words.map((word, wordIndex) => {
        const wordKey = `${key}-word-${wordIndex}`;
        if (/\S/.test(word)) {
          const cleanWord = word.replace(/[.,!?;:()"']/g, '');
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
            <span key={index} style={{ color: '#6F4E37', fontWeight: 'bold' }}>
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