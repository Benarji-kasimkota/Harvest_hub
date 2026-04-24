import React, { useState, useRef, useEffect } from 'react';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';
import './AIChatbot.css';

const AIChatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm HarvestHub's AI assistant. I can help with your orders, products, delivery questions, and more. What can I help you with?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const history = messages.slice(1).map(m => ({ role: m.role, text: m.text }));
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post('/api/ai/chat', { message: text, history });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.reply, action: res.data.suggestedAction }]);
    } catch (err) {
      if (err.response?.data?.demo) {
        setMessages(prev => [...prev, { role: 'assistant', text: 'AI assistant is not configured yet. Please contact support.' }]);
      } else {
        toast.error('Chat error, please try again');
      }
    } finally { setLoading(false); }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="chatbot-widget">
      <button className={`chatbot-fab ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        {open ? '✕' : '💬'}
      </button>
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <span className="chatbot-title">🤖 AI Support</span>
            <span className="chatbot-subtitle">Powered by Gemini</span>
          </div>
          <div className="chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`}>
                <p>{m.text}</p>
                {m.action && <span className="chat-action-hint">💡 {m.action}</span>}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble assistant">
                <span className="chat-typing"><span/><span/><span/></span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="chatbot-input-row">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about your orders, products..."
              rows={2}
              disabled={loading}
            />
            <button onClick={send} disabled={loading || !input.trim()} className="chatbot-send">
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatbot;
