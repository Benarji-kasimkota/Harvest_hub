import React, { useState, useRef, useEffect } from 'react';
import axios from '../../utils/axios';
import './AISearchBar.css';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const AISearchBar = ({ onResults, onClear }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [interpretation, setInterpretation] = useState('');
  const [aiActive, setAiActive] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const runSearch = async (text) => {
    if (!text.trim()) { onClear(); setAiActive(false); setInterpretation(''); return; }
    setLoading(true);
    try {
      const res = await axios.post('/api/ai/search', { query: text });
      setInterpretation(res.data.interpretation);
      setAiActive(true);
      onResults(res.data.products, res.data.interpretation);
    } catch (err) {
      if (err.response?.data?.demo) onClear();
    } finally { setLoading(false); }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    runSearch(query);
  };

  const handleClear = () => {
    setQuery(''); setAiActive(false); setInterpretation('');
    recognitionRef.current?.abort();
    setListening(false);
    onClear();
  };

  const toggleVoice = () => {
    if (!SpeechRecognition) return;

    if (listening) {
      recognitionRef.current?.abort();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      setQuery(transcript);
      // Auto-submit once the result is final
      if (e.results[e.results.length - 1].isFinal) {
        runSearch(transcript);
      }
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
  };

  return (
    <div className="ai-search-wrapper">
      <form onSubmit={handleSearch} className="ai-search-form">
        <span className="ai-search-icon">✨</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={listening ? 'Listening…' : 'Try "cheap leafy greens" or "ingredients for pasta"...'}
          className="ai-search-input"
        />
        {query && !listening && (
          <button type="button" className="ai-search-clear" onClick={handleClear}>✕</button>
        )}
        {SpeechRecognition && (
          <button
            type="button"
            className={`ai-mic-btn ${listening ? 'listening' : ''}`}
            onClick={toggleVoice}
            title={listening ? 'Stop listening' : 'Search by voice'}
          >
            {listening ? (
              <span className="mic-pulse">🎙️</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-5 9v-2a7 7 0 007-7h-2a5 5 0 01-10 0H5a7 7 0 007 7v2H9v2h6v-2h-3z"/>
              </svg>
            )}
          </button>
        )}
        <button type="submit" className="ai-search-btn" disabled={loading || listening}>
          {loading ? '...' : 'AI Search'}
        </button>
      </form>
      {listening && (
        <p className="ai-search-listening">🎙️ <em>Speak now — I'm listening…</em></p>
      )}
      {aiActive && interpretation && !listening && (
        <p className="ai-search-interpretation">🤖 <em>{interpretation}</em></p>
      )}
    </div>
  );
};

export default AISearchBar;
