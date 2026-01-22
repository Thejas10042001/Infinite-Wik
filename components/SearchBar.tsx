
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onRandom: () => void;
  disabled: boolean;
}

const ANIMATION_WORDS = ['Flux', 'Spiral', 'Echo', 'Void', 'Paradox', 'Quantum'];

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onRandom, disabled }) => {
  const [query, setQuery] = useState('');
  const [inputColor, setInputColor] = useState('#ffffff');
  const [buttonText, setButtonText] = useState('Random');
  const [isListening, setIsListening] = useState(false);
  const animationIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

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
        // Auto-search after voice input if it's a clear term
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim() && !disabled && inputColor !== '#ff4444') {
      onSearch(query.trim());
      setQuery('');
      setInputColor('#ffffff');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    setQuery(newQuery);
    const isValid = /^[a-zA-Z0-9\s-]*$/.test(newQuery);

    if (newQuery === '') {
      setInputColor('#ffffff');
    } else if (isValid) {
      setInputColor('#4D90FE');
    } else {
      setInputColor('#ff4444');
    }
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} className="search-form" role="search">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={isListening ? "Listening..." : "Search"}
          className="search-input"
          aria-label="Search for a topic"
          disabled={disabled}
          style={{ color: inputColor }}
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
