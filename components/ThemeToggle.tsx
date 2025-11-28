/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  const isChecked = theme === 'light';

  return (
    <label className="theme-toggle" htmlFor="theme-switch" aria-label={`Switch to ${isChecked ? 'dark' : 'light'} mode`}>
      <input
        type="checkbox"
        id="theme-switch"
        checked={isChecked}
        onChange={onToggle}
        className="theme-toggle-input"
      />
      <span className="theme-toggle-slider"></span>
    </label>
  );
};

export default ThemeToggle;
