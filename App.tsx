
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

const PREDEFINED_WORDS = [
  'Balance', 'Harmony', 'Discord', 'Unity', 'Fragmentation', 'Clarity', 'Ambiguity', 'Presence', 'Absence', 'Creation', 'Destruction', 'Light', 'Shadow', 'Beginning', 'Ending', 'Rising', 'Falling', 'Connection', 'Isolation', 'Hope', 'Despair',
  'Order and chaos', 'Light and shadow', 'Sound and silence', 'Form and formlessness', 'Being and nonbeing', 'Presence and absence', 'Motion and stillness', 'Unity and multiplicity', 'Finite and infinite', 'Sacred and profane', 'Memory and forgetting', 'Question and answer', 'Search and discovery', 'Journey and destination', 'Dream and reality', 'Time and eternity', 'Self and other', 'Known and unknown', 'Spoken and unspoken', 'Visible and invisible',
  'Zigzag', 'Waves', 'Spiral', 'Bounce', 'Slant', 'Drip', 'Stretch', 'Squeeze', 'Float', 'Fall', 'Spin', 'Melt', 'Rise', 'Twist', 'Explode', 'Stack', 'Mirror', 'Echo', 'Vibrate',
  'Gravity', 'Friction', 'Momentum', 'Inertia', 'Turbulence', 'Pressure', 'Tension', 'Oscillate', 'Fractal', 'Quantum', 'Entropy', 'Vortex', 'Resonance', 'Equilibrium', 'Centrifuge', 'Elastic', 'Viscous', 'Refract', 'Diffuse', 'Cascade', 'Levitate', 'Magnetize', 'Polarize', 'Accelerate', 'Compress', 'Undulate',
  'Liminal', 'Ephemeral', 'Paradox', 'Zeitgeist', 'Metamorphosis', 'Synesthesia', 'Recursion', 'Emergence', 'Dialectic', 'Apophenia', 'Limbo', 'Flux', 'Sublime', 'Uncanny', 'Palimpsest', 'Chimera', 'Void', 'Transcend', 'Ineffable', 'Qualia', 'Gestalt', 'Simulacra', 'Abyssal',
  'Existential', 'Nihilism', 'Solipsism', 'Phenomenology', 'Hermeneutics', 'Deconstruction', 'Postmodern', 'Absurdism', 'Catharsis', 'Epiphany', 'Melancholy', 'Nostalgia', 'Longing', 'Reverie', 'Pathos', 'Ethos', 'Logos', 'Mythos', 'Anamnesis', 'Intertextuality', 'Metafiction', 'Stream', 'Lacuna', 'Caesura', 'Enjambment'
];
const UNIQUE_WORDS = [...new Set(PREDEFINED_WORDS)];

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
  if (typeof window === 'undefined') return 'Hypertext';
  const urlParams = new URLSearchParams(window.location.search);
  const topicFromUrl = urlParams.get('topic');
  return topicFromUrl ? decodeURIComponent(topicFromUrl) : 'Hypertext';
};

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const storedTheme = window.localStorage.getItem('wiki-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  }
  return 'dark';
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

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    window.localStorage.setItem('wiki-theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('searchHistory');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) setSearchHistory(parsedHistory);
      }
    } catch (err) {
      localStorage.removeItem('searchHistory');
    }
  }, []);

  useEffect(() => {
    if (!currentTopic) return;
    
    try {
      const relativeUrl = `?topic=${encodeURIComponent(currentTopic)}`;
      if (window.location.search !== relativeUrl) {
        window.history.pushState({ topic: currentTopic }, '', relativeUrl);
      }
    } catch (e) {
      console.warn('Failed to update history:', e);
    }

    const updateHistory = (topic: string) => {
      try {
        setSearchHistory(prevHistory => {
          const newHistory = [
            topic,
            ...prevHistory.filter(item => item.toLowerCase() !== topic.toLowerCase())
          ].slice(0, 8); // Slightly longer history for live app
          localStorage.setItem('searchHistory', JSON.stringify(newHistory));
          return newHistory;
        });
      } catch (err) {
        console.error('Failed to update history:', err);
      }
    };
    updateHistory(currentTopic);

    let isCancelled = false;

    const fetchContentAndArt = async () => {
      setIsLoading(true);
      setIsImageLoading(true);
      setError(null);
      setContent('');
      setAsciiArt(null);
      setImageUrl(null);
      setGenerationTime(null);
      setCopyButtonText('Copy');
      setShareButtonText('Share');
      setDownloadButtonText('Download PDF');
      const startTime = performance.now();

      // Parallel triggers
      generateAsciiArt(currentTopic)
        .then(art => { if (!isCancelled) setAsciiArt(art); })
        .catch(() => { if (!isCancelled) setAsciiArt(createFallbackArt(currentTopic)); });
      
      generateImage(currentTopic)
        .then(base64Image => { if (!isCancelled) setImageUrl(base64Image); })
        .finally(() => { if (!isCancelled) setIsImageLoading(false); });

      let accumulatedContent = '';
      try {
        for await (const chunk of streamDefinition(currentTopic)) {
          if (isCancelled) break;
          accumulatedContent += chunk;
          setContent(accumulatedContent);
        }
      } catch (e: unknown) {
        if (!isCancelled) {
          setError(e instanceof Error ? e.message : 'An unknown error occurred');
        }
      } finally {
        if (!isCancelled) {
          setGenerationTime(performance.now() - startTime);
          setIsLoading(false);
        }
      }
    };

    fetchContentAndArt();
    
    return () => { isCancelled = true; };
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
    const randomIndex = Math.floor(Math.random() * UNIQUE_WORDS.length);
    const randomWord = UNIQUE_WORDS[randomIndex];
    setCurrentTopic(randomWord.toLowerCase() === currentTopic.toLowerCase() 
      ? UNIQUE_WORDS[(randomIndex + 1) % UNIQUE_WORDS.length] 
      : randomWord);
  }, [currentTopic]);

  const handleHistoryClick = useCallback((topic: string) => {
    if (topic.toLowerCase() !== currentTopic.toLowerCase()) setCurrentTopic(topic);
  }, [currentTopic]);

  const handleCopy = useCallback(() => {
    if (content) {
      const plainText = content.replace(/\*\*/g, '');
      navigator.clipboard.writeText(plainText).then(() => {
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy'), 2000);
      });
    }
  }, [content]);

  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Infinite Wiki: ${currentTopic}`, url: shareUrl });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareButtonText('Link Copied!');
        setTimeout(() => setShareButtonText('Share'), 2000);
      });
    }
  }, [currentTopic]);

  const handleDownloadPdf = useCallback(async () => {
    const contentElement = downloadableContentRef.current;
    if (!contentElement) return;
    setDownloadButtonText('Downloading...');
    try {
        const canvas = await html2canvas(contentElement, {
            scale: 2,
            backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
            useCORS: true,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
        pdf.save(`Wiki-${currentTopic.replace(/\s/g, '_')}.pdf`);
        setDownloadButtonText('Downloaded!');
    } catch (error) {
        setDownloadButtonText('Error!');
    } finally {
        setTimeout(() => setDownloadButtonText('Download PDF'), 2000);
    }
}, [currentTopic, theme]);

  return (
    <div>
      <div className="top-bar">
        <SearchBar onSearch={handleSearch} onRandom={handleRandom} disabled={isLoading} />
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
      </div>
      <HistoryDisplay history={searchHistory} onHistoryClick={handleHistoryClick} disabled={isLoading} />
      
      <div ref={downloadableContentRef}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="rainbow-text" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '1.2rem' }}>
            INFINITE WIKI
          </h1>
          <AsciiArtDisplay artData={asciiArt} topic={currentTopic} />
        </header>
        
        <main>
          <ImageDisplay imageUrl={imageUrl} isLoading={isImageLoading} topic={currentTopic} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <h2 style={{ textTransform: 'capitalize', margin: 0, fontSize: '1.5rem' }}>
                {currentTopic}
              </h2>
              {!isLoading && !error && content.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }} data-html2canvas-ignore="true">
                  <button onClick={handleShare} className="action-button">{shareButtonText}</button>
                  <button onClick={handleCopy} className="action-button">{copyButtonText}</button>
                  <button onClick={handleDownloadPdf} className="action-button">{downloadButtonText}</button>
                </div>
              )}
            </div>

            {error && (
              <div className="error-box">
                <p><strong>System Error</strong></p>
                <p style={{ fontSize: '0.9em' }}>{error}</p>
              </div>
            )}
            
            {isLoading && content.length === 0 && !error && <LoadingSkeleton />}

            {content.length > 0 && !error && (
               <ContentDisplay content={content} isLoading={isLoading} onWordClick={handleWordClick} />
            )}

            {!isLoading && !error && content.length === 0 && (
              <div style={{ color: 'var(--color-text-disabled)', padding: '2rem 0' }}>
                <p>Knowledge extraction failed.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="sticky-footer" data-html2canvas-ignore="true">
        <p className="footer-text" style={{ margin: 0 }}>
          Hyperlink the World · Powered by Gemini 3 Flash
          {generationTime && ` · Latency: ${Math.round(generationTime)}ms`}
        </p>
      </footer>
    </div>
  );
};

export default App;
