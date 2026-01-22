
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onRandom: () => void;
  disabled: boolean;
  suggestions?: string[];
}

const ANIMATION_WORDS = ['Flux', 'Spiral', 'Echo', 'Void', 'Paradox', 'Quantum'];

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onRandom, disabled, suggestions = [] }) => {
  const [query, setQuery] = useState('');
  const [inputColor, setInputColor] = useState('#ffffff');
  const [buttonText, setButtonText] = useState('Random');
  const [isListening, setIsListening] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const animationIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) {
      let i = 0;
      animationIntervalRef.current = window.setInterval(() => {
        setButtonText(ANIMATION_WORDS[i % ANIMATION_WORDS.length]);
        i++;
      }, 120);
    } else {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
      setButtonText('Random');
    }

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [disabled]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setInputColor('#4D90FE');
        if (transcript.trim()) {
          onSearch(transcript.trim());
          setQuery('');
        }
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [onSearch]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const executeSearch = useCallback((term: string) => {
    if (term.trim() && !disabled && inputColor !== '#ff4444') {
      onSearch(term.trim());
      setQuery('');
      setInputColor('#ffffff');
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }, [disabled, inputColor, onSearch]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
      executeSearch(filteredSuggestions[activeIndex]);
    } else {
      executeSearch(query);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    setQuery(newQuery);
    const isValid = /^[a-zA-Z0-9\s-]*$/.test(newQuery);

    if (newQuery === '') {
      setInputColor('#ffffff');
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    } else if (isValid) {
      setInputColor('#4D90FE');
      const filtered = suggestions
        .filter(word => word.toLowerCase().includes(newQuery.toLowerCase()))
        .slice(0, 8);
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setActiveIndex(-1);
    } else {
      setInputColor('#ff4444');
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleBlur = () => {
    // Small delay to allow click on suggestion to register
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="search-container">
      <div className="search-wrapper">
        <form onSubmit={handleSubmit} className="search-form" role="search">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(filteredSuggestions.length > 0)}
            onBlur={handleBlur}
            placeholder={isListening ? "Listening..." : "Search"}
            className="search-input"
            aria-label="Search for a topic"
            disabled={disabled}
            style={{ color: inputColor }}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`mic-button ${isListening ? 'recording' : ''}`}
            disabled={disabled}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
        </form>
        {showSuggestions && (
          <div className="suggestions-list" ref={suggestionsRef}>
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`suggestion-item ${index === activeIndex ? 'active' : ''}`}
                onMouseDown={() => executeSearch(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
      <button 
        onClick={onRandom} 
        className={`random-button ${disabled ? 'is-animating' : ''}`} 
        disabled={disabled}
      >
        {buttonText}
      </button>
    </div>
  );
};

export default SearchBar;
