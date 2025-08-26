/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onRandom: () => void;
  disabled: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onRandom, disabled }) => {
  const [query, setQuery] = useState('');
  const [inputColor, setInputColor] = useState('#ffffff'); // Default placeholder color

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Prevent submitting if the input is considered invalid
    if (query.trim() && !disabled && inputColor !== '#ff4444') {
      onSearch(query.trim());
      setQuery(''); // Clear the input field after search
      setInputColor('#ffffff'); // Reset color to match placeholder
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    setQuery(newQuery);

    // Validation logic for "wrong words"
    // Allows letters, numbers, spaces, and hyphens.
    const isValid = /^[a-zA-Z0-9\s-]*$/.test(newQuery);

    if (newQuery === '') {
      setInputColor('#ffffff'); // Match placeholder color when empty
    } else if (isValid) {
      setInputColor('#4D90FE'); // Blue for valid, typed text
    } else {
      setInputColor('#ff4444'); // Red for invalid characters
    }
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} className="search-form" role="search">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search"
          className="search-input"
          aria-label="Search for a topic"
          disabled={disabled}
          style={{ color: inputColor }} // Apply dynamic color
        />
      </form>
      <button onClick={onRandom} className="random-button" disabled={disabled}>
        Random
      </button>
    </div>
  );
};

export default SearchBar;