/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { streamDefinition, generateAsciiArt, AsciiArtData, generateImage } from './services/geminiService';
import ContentDisplay from './components/ContentDisplay';
import SearchBar from './components/SearchBar';
import LoadingSkeleton from './components/LoadingSkeleton';
import AsciiArtDisplay from './components/AsciiArtDisplay';
import HistoryDisplay from './components/HistoryDisplay';
import ImageDisplay from './components/ImageDisplay';
import ThemeToggle from './components/ThemeToggle';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';


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

const getInitialTopic = (): string => {
  if (typeof window === 'undefined') {
    return 'Hypertext';
  }
  const urlParams = new URLSearchParams(window.location.search);
  const topicFromUrl = urlParams.get('topic');
  return topicFromUrl ? decodeURIComponent(topicFromUrl) : 'Hypertext';
};

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const storedTheme = window.localStorage.getItem('wiki-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
    // Check system preference if no stored theme is found
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  return 'dark'; // Default to dark theme
};

const App: React.FC = () => {
  const [currentTopic, setCurrentTopic] = useState<string>(getInitialTopic());
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [asciiArt, setAsciiArt] = useState<AsciiArtData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [copyButtonText, setCopyButtonText] = useState<string>('Copy');
  const [shareButtonText, setShareButtonText] = useState<string>('Share');
  const [downloadButtonText, setDownloadButtonText] = useState('Download PDF');
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme());

  const copyTimeoutRef = useRef<number | null>(null);
  const shareTimeoutRef = useRef<number | null>(null);
  const downloadTimeoutRef = useRef<number | null>(null);
  const downloadableContentRef = useRef<HTMLDivElement>(null);

  // Effect to apply theme class to body and save preference to localStorage
  useEffect(() => {
    document.body.className = `theme-${theme}`;
    try {
      window.localStorage.setItem('wiki-theme', theme);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }, [theme]);

  // Load search history from localStorage on initial mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('searchHistory');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          setSearchHistory(parsedHistory);
        }
      }
    } catch (err) {
      console.error('Failed to load search history:', err);
      localStorage.removeItem('searchHistory'); // Clear corrupted data
    }
  }, []);

  useEffect(() => {
    if (!currentTopic) return;
    
    // Update the browser's URL to make it shareable
    try {
      const relativeUrl = `?topic=${encodeURIComponent(currentTopic)}`;
      if (window.location.search !== relativeUrl) {
        // Use a relative URL to avoid security errors in sandboxed environments
        window.history.pushState({ topic: currentTopic }, '', relativeUrl);
      }
    } catch (e) {
      console.warn('Failed to update browser history:', e);
    }

    // Update search history whenever the topic changes
    const updateHistory = (topic: string) => {
      try {
        setSearchHistory(prevHistory => {
          const newHistory = [
            topic,
            ...prevHistory.filter(item => item.toLowerCase() !== topic.toLowerCase())
          ].slice(0, 5);
          
          localStorage.setItem('searchHistory', JSON.stringify(newHistory));
          return newHistory;
        });
      } catch (err) {
        console.error('Failed to update search history:', err);
      }
    };
    updateHistory(currentTopic);

    let isCancelled = false;

    const fetchContentAndArt = async () => {
      // Set initial state for a clean page load
      setIsLoading(true);
      setIsImageLoading(true);
      setError(null);
      setContent(''); // Clear previous content immediately
      setAsciiArt(null);
      setImageUrl(null);
      setGenerationTime(null);
      setCopyButtonText('Copy'); // Reset copy button on new topic
      setShareButtonText('Share'); // Reset share button on new topic
      setDownloadButtonText('Download PDF'); // Reset download button
      const startTime = performance.now();

      // Kick off ASCII art generation, but don't wait for it.
      generateAsciiArt(currentTopic)
        .then(art => {
          if (!isCancelled) {
            setAsciiArt(art);
          }
        })
        .catch(err => {
          if (!isCancelled) {
            console.error("Failed to generate ASCII art:", err);
            const fallbackArt = createFallbackArt(currentTopic);
            setAsciiArt(fallbackArt);
          }
        });
      
      // Kick off Image generation in parallel.
      generateImage(currentTopic)
        .then(base64Image => {
          if (!isCancelled) {
            setImageUrl(base64Image);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsImageLoading(false);
          }
        });

      let accumulatedContent = '';
      try {
        for await (const chunk of streamDefinition(currentTopic)) {
          if (isCancelled) break;
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
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current);
      }
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
    setIsImageLoading(true);
    setError(null);
    setContent('');
    setAsciiArt(null);
    setImageUrl(null);

    const randomIndex = Math.floor(Math.random() * UNIQUE_WORDS.length);
    const randomWord = UNIQUE_WORDS[randomIndex];

    // Prevent picking the same word twice in a row
    if (randomWord.toLowerCase() === currentTopic.toLowerCase()) {
      const nextIndex = (randomIndex + 1) % UNIQUE_WORDS.length;
      setCurrentTopic(UNIQUE_WORDS[nextIndex]);
    } else {
      setCurrentTopic(randomWord);
    }
  }, [currentTopic]);

  const handleHistoryClick = useCallback((topic: string) => {
    if (topic.toLowerCase() !== currentTopic.toLowerCase()) {
      setCurrentTopic(topic);
    }
  }, [currentTopic]);

  const handleCopy = useCallback(() => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    if (content) {
      // Remove markdown asterisks for a clean copy
      const plainText = content.replace(/\*\*/g, '');
      navigator.clipboard.writeText(plainText).then(() => {
        setCopyButtonText('Copied!');
        copyTimeoutRef.current = window.setTimeout(() => {
          setCopyButtonText('Copy');
        }, 2000); // Revert back after 2 seconds
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        setCopyButtonText('Error!'); // Provide feedback on error
        copyTimeoutRef.current = window.setTimeout(() => {
          setCopyButtonText('Copy');
        }, 2000);
      });
    }
  }, [content]);

  const handleShare = useCallback(async () => {
    if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    const shareUrl = window.location.href; // URL is already current
    const shareTitle = `Infinite Wiki: ${currentTopic}`;
    const shareText = `Check out the definition for "${currentTopic}" on Infinite Wiki.`;

    // Use the Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        console.error('Error using Web Share API:', error);
      }
    } else {
      // Fallback: copy the URL to the clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareButtonText('Link Copied!');
        shareTimeoutRef.current = window.setTimeout(() => {
          setShareButtonText('Share');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy link: ', err);
        setShareButtonText('Error!');
        shareTimeoutRef.current = window.setTimeout(() => {
          setShareButtonText('Share');
        }, 2000);
      });
    }
  }, [currentTopic]);

  const handleDownloadPdf = useCallback(async () => {
    if (downloadTimeoutRef.current) clearTimeout(downloadTimeoutRef.current);
    const contentElement = downloadableContentRef.current;
    if (!contentElement) {
        console.error('Downloadable content area not found.');
        return;
    }

    setDownloadButtonText('Downloading...');

    try {
        const canvas = await html2canvas(contentElement, {
            scale: 2, // Higher scale for better image quality
            backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
            useCORS: true,
        });

        const imgData = canvas.toDataURL('image/png');
        
        // A4 page dimensions in mm: 210 x 297
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = 0;

        // Add the first page
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Add more pages if content is longer than one page
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save(`Infinite_Wiki-${currentTopic.replace(/\s/g, '_')}.pdf`);
        setDownloadButtonText('Downloaded!');

    } catch (error) {
        console.error('Failed to download PDF:', error);
        setDownloadButtonText('Error!');
    } finally {
        downloadTimeoutRef.current = window.setTimeout(() => {
            setDownloadButtonText('Download PDF');
        }, 2000);
    }
}, [currentTopic, theme]);

  const handleThemeToggle = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div>
      <div className="top-bar">
        <SearchBar onSearch={handleSearch} onRandom={handleRandom} disabled={isLoading} />
        <ThemeToggle theme={theme} onToggle={handleThemeToggle} />
      </div>
      <HistoryDisplay history={searchHistory} onHistoryClick={handleHistoryClick} disabled={isLoading} />
      
      <div ref={downloadableContentRef}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="rainbow-text" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            INFINITE WIKI
          </h1>
          <AsciiArtDisplay artData={asciiArt} topic={currentTopic} />
        </header>
        
        <main>
          <ImageDisplay imageUrl={imageUrl} isLoading={isImageLoading} topic={currentTopic} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <h2 style={{ textTransform: 'capitalize', margin: 0 }}>
                {currentTopic}
              </h2>
              {!isLoading && !error && content.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }} data-html2canvas-ignore="true">
                  <button
                    onClick={handleShare}
                    className="action-button"
                    aria-label="Share definition"
                  >
                    {shareButtonText}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="action-button"
                    aria-label="Copy definition to clipboard"
                  >
                    {copyButtonText}
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="action-button"
                    aria-label="Download definition as PDF"
                  >
                    {downloadButtonText}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="error-box">
                <p style={{ margin: 0 }}>An Error Occurred</p>
                <p style={{ marginTop: '0.5rem', margin: 0 }}>{error}</p>
              </div>
            )}
            
            {/* Show skeleton loader when loading and no content is yet available */}
            {isLoading && content.length === 0 && !error && (
              <LoadingSkeleton />
            )}

            {/* Show content as it streams or when it's interactive */}
            {content.length > 0 && !error && (
               <ContentDisplay 
                 content={content} 
                 isLoading={isLoading} 
                 onWordClick={handleWordClick}
               />
            )}

            {/* Show empty state if fetch completes with no content and is not loading */}
            {!isLoading && !error && content.length === 0 && (
              <div style={{ color: 'var(--color-text-disabled)', padding: '2rem 0' }}>
                <p>Content could not be generated.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="sticky-footer" data-html2canvas-ignore="true">
        <p className="footer-text" style={{ margin: 0 }}>
          Infinite Wiki by thejas sreenivasu ·{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by Gemini
          </a>
          {generationTime && ` · ${Math.round(generationTime)}ms`}
        </p>
      </footer>
    </div>
  );
};

export default App;