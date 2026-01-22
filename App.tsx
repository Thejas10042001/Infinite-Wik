
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const topicFromUrl = urlParams.get('topic');
    return topicFromUrl ? decodeURIComponent(topicFromUrl) : 'Hypertext';
  } catch (e) {
    return 'Hypertext';
  }
};

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    try {
      const storedTheme = window.localStorage.getItem('wiki-theme');
      if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch (e) {}
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

  const downloadableContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    try {
      window.localStorage.setItem('wiki-theme', theme);
    } catch (e) {}
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
    
    // Update URL without reloading - Wrapped in try-catch to handle sandboxed environment restrictions
    try {
      const relativeUrl = `?topic=${encodeURIComponent(currentTopic)}`;
      if (window.history && window.history.pushState && window.location.search !== relativeUrl) {
        window.history.pushState({ topic: currentTopic }, '', relativeUrl);
      }
    } catch (e) {
      console.warn('History API pushState failed:', e);
    }

    // Update Browser Tab Title
    document.title = `${currentTopic.charAt(0).toUpperCase() + currentTopic.slice(1)} - Infinite Wiki`;

    const updateHistory = (topic: string) => {
      setSearchHistory(prevHistory => {
        const newHistory = [
          topic,
          ...prevHistory.filter(item => item.toLowerCase() !== topic.toLowerCase())
        ].slice(0, 10);
        try {
          localStorage.setItem('searchHistory', JSON.stringify(newHistory));
        } catch (e) {}
        return newHistory;
      });
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

      // Parallelize non-streaming requests
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
      } catch (e: any) {
        if (!isCancelled) {
          setError(e.message || 'The neural network encountered an interference.');
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setCurrentTopic(randomWord);
  }, []);

  const handleHistoryClick = useCallback((topic: string) => {
    if (topic.toLowerCase() !== currentTopic.toLowerCase()) {
      setCurrentTopic(topic);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

  // Fix: Completed handleShare implementation and added handleDownload logic
  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Infinite Wiki',
          text: `Check out "${currentTopic}" on Infinite Wiki`,
          url: shareUrl,
        });
        setShareButtonText('Shared!');
        setTimeout(() => setShareButtonText('Share'), 2000);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareButtonText('Link Copied!');
        setTimeout(() => setShareButtonText('Share'), 2000);
      });
    }
  }, [currentTopic]);

  const handleDownload = useCallback(async () => {
    if (downloadableContentRef.current) {
      setDownloadButtonText('Generating...');
      try {
        const canvas = await html2canvas(downloadableContentRef.current, {
          scale: 2,
          backgroundColor: theme === 'dark' ? '#121212' : '#ffffff',
          useCORS: true,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${currentTopic.replace(/\s+/g, '_')}_infinite_wiki.pdf`);
        setDownloadButtonText('Downloaded!');
      } catch (error) {
        console.error('PDF generation failed:', error);
        setDownloadButtonText('Failed');
      } finally {
        setTimeout(() => setDownloadButtonText('Download PDF'), 3000);
      }
    }
  }, [currentTopic, theme]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-top">
          <h1 className="logo" onClick={handleRandom} style={{ cursor: 'pointer' }}>
            Infinite Wiki
          </h1>
          <ThemeToggle theme={theme} onToggle={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')} />
        </div>
        <SearchBar onSearch={handleSearch} onRandom={handleRandom} disabled={isLoading} />
        <HistoryDisplay history={searchHistory} onHistoryClick={handleHistoryClick} disabled={isLoading} />
      </header>

      <main className="main-content" ref={downloadableContentRef}>
        <div className="content-grid">
          <div className="content-left">
            <h2 className="topic-title">{currentTopic}</h2>
            {error ? (
              <div className="error-message">{error}</div>
            ) : (
              <>
                {isLoading && content === '' ? <LoadingSkeleton /> : (
                  <ContentDisplay content={content} isLoading={isLoading} onWordClick={handleWordClick} />
                )}
                {!isLoading && generationTime && (
                  <p className="generation-stats">
                    Retrieved from neural memory in {(generationTime / 1000).toFixed(2)}s
                  </p>
                )}
              </>
            )}
          </div>
          <div className="content-right">
            <AsciiArtDisplay artData={asciiArt} topic={currentTopic} />
            <ImageDisplay imageUrl={imageUrl} isLoading={isImageLoading} topic={currentTopic} />
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="action-buttons">
          <button onClick={handleCopy} disabled={!content} className="action-button">
            {copyButtonText}
          </button>
          <button onClick={handleShare} className="action-button">
            {shareButtonText}
          </button>
          <button onClick={handleDownload} disabled={isLoading} className="action-button">
            {downloadButtonText}
          </button>
        </div>
        <div className="copyright">
          © THEJAS SREEENIVASU SINCE 2025
        </div>
      </footer>
    </div>
  );
};

export default App;
