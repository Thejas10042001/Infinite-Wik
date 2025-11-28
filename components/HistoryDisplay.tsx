/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface HistoryDisplayProps {
  history: string[];
  onHistoryClick: (topic: string) => void;
  disabled: boolean;
}

const HistoryDisplay: React.FC<HistoryDisplayProps> = ({ history, onHistoryClick, disabled }) => {
  if (history.length === 0) {
    return null; // Don't render anything if there's no history
  }

  return (
    <div className="history-container" aria-label="Search history">
      {history.map((topic) => (
        <button
          key={topic}
          onClick={() => onHistoryClick(topic)}
          className="history-item"
          disabled={disabled}
          aria-label={`Search for ${topic}`}
        >
          {topic}
        </button>
      ))}
    </div>
  );
};

export default HistoryDisplay;
