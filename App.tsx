/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import { streamDefinition, generateAsciiArt, AsciiArtData, API_KEY_MISSING_ERROR } from './services/geminiService';
import ContentDisplay from './components/ContentDisplay';
import SearchBar from './components/SearchBar';
import LoadingSkeleton from './components/LoadingSkeleton';
import AsciiArtDisplay from './components/AsciiArtDisplay';

// A curated list of "banger" words and phrases for the random button.
const PREDEFINED_WORDS = [
  // List 1
  'Balance', 'Harmony', 'Discord', 'Unity', 'Fragmentation', 'Clarity', 'Ambiguity', 'Presence', 'Absence', 'Creation', 'Destruction', 'Light', 'Shadow', 'Beginning', 'Ending', 'Rising', 'Falling', 'Connection', 'Isolation', 'Hope', 'Despair',
  // Complex phrases from List 1
  'Order and chaos', 'Light and shadow', 'Sound and silence', 'Form and formlessness', 'Being and nonbeing', 'Presence and absence', 'Motion and stillness', 'Unity and multiplicity', 'Finite and infinite', 'Sacred and profane', 'Memory and forgetting', 'Question and answer', 'Search and discovery', 'Journey and destination', 'Dream and reality', 'Time and eternity', 'Self and other', 'Known and unknown', 'Spoken and unspoken', 'Visible and invisible',
  // List 2
  'Zigzag', 'Waves', 'Spiral', 'Bounce', 'Slant', 'Drip', 'Stretch', 'Squeeze', 'Float', 'Fall', 'Spin', 'Melt', 'Rise', 'Twist', 'Explode', 'Stack', 'Mirror', 'Echo', 'Vibrate',
  // List 3
  'Gravity', 'Friction', 'Momentum', 'Inertia', 'Turbulence', 'Pressure', 'Tension', 'Oscillate', 'Fractal', 'Quantum', 'Entropy', 'Vortex', 'Resonance', 'Equilibrium', 'Centrifuge', 'Elastic', 'Viscous', 'Refract', 'Diffuse', 'Cascade', 'Levitate', 'Magnetize', 'Polarize', 'Accelerate', 'Compress', 'Undulate',
  // List 4
  'Liminal', 'Ephemeral', 'Paradox', 'Zeitgeist', 'Metamorphosis', 'Synesthesia', 'Recursion', 'Emergence', 'Dialectic', 'Apophenia', 'Limbo', 'Flux', 'Sublime', 'Uncanny', 'Palimpsest', 'Chimera', 'Void', 'Transcend', 'Ineffable', 'Qualia', 'Gestalt', 'Simulacra', 'Abyssal',
  // List 5
  'Existential', 'Nihilism', 'Solipsism', 'Phenomenology', 'Hermeneutics', 'Deconstruction', 'Postmodern', 'Absurdism', 'Catharsis', 'Epiphany', 'Melancholy', 'Nostalgia', 'Longing', 'Reverie', 'Pathos', 'Ethos', 'Logos', 'Mythos', 'Anamnesis', 'Intertextuality', 'Metafiction', 'Stream', 'Lacuna', 'Caesura', 'Enjambment'
];
const UNIQUE_WORDS = [...new Set(PREDEFINED_WORDS)];

/**
 * A user-friendly guide displayed when the API key is not configured.
 */
const ApiKeyInstructions = () => (
  <div style={{
    border: '1px solid #ffcc00',
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    padding: '1.5rem',
    color: '#ffffff',
    borderRadius: '8px',
    marginTop: '2rem'
  }}>
    <h3 style={{ marginTop: 0, color: '#ffcc00', fontSize: '1.2em', fontWeight: 'bold' }}>Configuration Needed</h3>
    <p>The <strong>API_KEY</strong> for the Gemini API is missing.</p>
    <p>To fix this, you need to add it as an environment variable in your hosting provider's settings (like Vercel or Netlify).</p>
    <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
      <li>Find the <strong>Environment Variables</strong> section in your project settings.</li>
      <li>Create a new variable with the name <code style={{ background: '#333', padding: '0.2em 0.4em', borderRadius: '4px' }}>API_KEY</code>.</li>
      <li>Paste your actual Gemini API key into the value field.</li>
      <li>Save and redeploy your application. The changes should take effect immediately.</li>
    </ol>
    <p style={{ fontSize: '0.9em', color: '#ccc', margin: '1rem 0 0 0' }}>
      You can get a new key from the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#4D90FE', textDecoration: 'underline' }}>Google AI Studio dashboard</a>.
    </p>
  </div>
);


/**
 * Creates a simple ASCII art bounding box as a fallback.
 * @param topic The text to display inside the box.
 * @returns An AsciiArtData object with the generated art.
 */
const createFallbackArt = (topic: string): AsciiArtData => {
  const displayableTopic = topic.length > 20 ? topic.substring(0, 17) + '...' : topic;
  const paddedTopic = ` ${displayableTopic} `;
  const topBorder = `┌${'─'.repeat(paddedTopic.length)}┐`;
  const middle = `│${paddedTopic}│`;
  const bottomBorder = `└${'─'.repeat(paddedTopic.length)}┘`;
  return {
    art: `${topBorder}\n${middle}\n${bottomBorder}`
  };
};

const App: React.FC = () => {
  const [currentTopic, setCurrentTopic] = useState<string>('Hypertext');
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [asciiArt, setAsciiArt] = useState<AsciiArtData | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);


  useEffect(() => {
    if (!currentTopic) return;

    let isCancelled = false;

    const fetchContentAndArt = async () => {
      // Set initial state for a clean page load
      setIsLoading(true);
      setError(null);
      setContent(''); // Clear previous content immediately
      setAsciiArt(null);
      setGenerationTime(null);
      const startTime = performance.now();

      // Kick off ASCII art generation, but don't wait for it.
      // It will appear when it's ready, without blocking the definition.
      generateAsciiArt(currentTopic)
        .then(art => {
          if (!isCancelled) {
            setAsciiArt(art);
          }
        })
        .catch(err => {
          if (!isCancelled) {
            console.error("Failed to generate ASCII art:", err);
            // Don't show an error for art, just use a fallback.
            if (err instanceof Error && err.message.includes(API_KEY_MISSING_ERROR)) {
                // If the key is missing, don't even show a fallback box.
            } else {
                const fallbackArt = createFallbackArt(currentTopic);
                setAsciiArt(fallbackArt);
            }
          }
        });

      let accumulatedContent = '';
      try {
        for await (const chunk of streamDefinition(currentTopic)) {
          if (isCancelled) break;
          
          if (chunk.startsWith('Error:')) {
            throw new Error(chunk);
          }
          accumulatedContent += chunk;
          if (!isCancelled) {
            setContent(accumulatedContent);
          }
        }
      } catch (e: unknown) {
        if (!isCancelled) {
          const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
          setError(errorMessage);
          setContent(''); // Ensure content is clear on error
          console.error(e);
        }
      } finally {
        if (!isCancelled) {
          const endTime = performance.now();
          setGenerationTime(endTime - startTime);
          setIsLoading(false);
        }
      }
    };

    fetchContentAndArt();
    
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTopic]);

  const handleWordClick = useCallback((word: string) => {
    const newTopic = word.trim();
    if (newTopic && newTopic.toLowerCase() !== currentTopic.toLowerCase()) {
      setCurrentTopic(newTopic);
    }
  }, [currentTopic]);

  const handleSearch = useCallback((topic: string) => {
    const newTopic = topic.trim();
    if (newTopic && newTopic.toLowerCase() !== currentTopic.toLowerCase()) {
      setCurrentTopic(newTopic);
    }
  }, [currentTopic]);

  const handleRandom = useCallback(() => {
    setIsLoading(true); // Disable UI immediately
    setError(null);
    setContent('');
    setAsciiArt(null);

    const randomIndex = Math.floor(Math.random() * UNIQUE_WORDS.length);
    const randomWord = UNIQUE_WORDS[randomIndex];

    // Prevent picking the same word twice in a row
    if (randomWord.toLowerCase() === currentTopic.toLowerCase()) {
      const nextIndex = (randomIndex + 1) % UNIQUE_WORDS.length;
      setCurrentTopic(UNIQUE_WORDS[nextIndex]);
    } else {
      // Fix: Corrected typo from 'setCurrentopic' to 'setCurrentTopic'.
      setCurrentTopic(randomWord);
    }
  }, [currentTopic]);


  return (
    <div>
      <SearchBar onSearch={handleSearch} onRandom={handleRandom} isLoading={isLoading} />
      
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 className="rainbow-text" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          INFINITE WIKI
        </h1>
        <AsciiArtDisplay artData={asciiArt} topic={currentTopic} />
      </header>
      
      <main>
        {error && error.includes(API_KEY_MISSING_ERROR) ? (
          <ApiKeyInstructions />
        ) : (
          <div>
            <h2 style={{ marginBottom: '2rem', textTransform: 'capitalize' }}>
              {currentTopic}
            </h2>

            {error && (
              <div style={{ border: '1px solid #ff4444', padding: '1rem', color: '#ff4444' }}>
                <p style={{ margin: 0 }}>An Error Occurred</p>
                <p style={{ marginTop: '0.5rem', margin: 0 }}>{error}</p>
              </div>
            )}
            
            {isLoading && content.length === 0 && !error && (
              <LoadingSkeleton />
            )}

            {content.length > 0 && !error && (
               <ContentDisplay 
                 content={content} 
                 isLoading={isLoading} 
                 onWordClick={handleWordClick} 
               />
            )}

            {!isLoading && !error && content.length === 0 && (
              <div style={{ color: '#888', padding: '2rem 0' }}>
                <p>Content could not be generated.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="sticky-footer">
        <p className="footer-text" style={{ margin: 0 }}>
          Infinite Wiki by thejas sreenivasu · Generated by Chat gpt 5 thinking
          {generationTime && ` · ${Math.round(generationTime)}ms`}
        </p>
      </footer>
    </div>
  );
};

export default App;