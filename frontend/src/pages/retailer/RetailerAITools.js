import React, { useState, useCallback } from 'react';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';
import './RetailerAITools.css';

const URGENCY_COLOR = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };

// ── Dynamic Pricing ────────────────────────────────────────────────────────────
const PricingEngine = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const analyse = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ai/pricing');
      if (res.data.demo) { toast.error('Add GEMINI_API_KEY to backend .env'); return; }
      setData(res.data);
      toast.success('Pricing analysis complete!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="ai-tool-section">
      <div className="ai-tool-header">
        <div>
          <h3>💲 Dynamic Pricing Engine</h3>
          <p>AI analyses your stock levels and 6-month sales to suggest optimal price adjustments.</p>
        </div>
        <button className={`btn-analyze ${loading ? 'loading' : ''}`} onClick={analyse} disabled={loading}>
          {loading ? <><span className="spinner" /> Analysing…</> : '✨ Analyse Prices'}
        </button>
      </div>

      {data && (
        <>
          <div className="pricing-summary-banner">{data.summary}</div>
          <div className="pricing-list">
            {data.suggestions?.map((s, i) => {
              const diff = s.suggestedPrice - s.currentPrice;
              const pct = ((diff / s.currentPrice) * 100).toFixed(1);
              return (
                <div key={i} className="pricing-row">
                  <div className="pricing-product">
                    <strong>{s.productName}</strong>
                    <span className="pricing-action-tag" style={{ background: URGENCY_COLOR[s.urgency] }}>{s.urgency}</span>
                  </div>
                  <div className="pricing-prices">
                    <span className="current-price">${s.currentPrice.toFixed(2)}</span>
                    <span className="price-arrow">{diff >= 0 ? '↑' : '↓'}</span>
                    <span className={`suggested-price ${diff >= 0 ? 'up' : 'down'}`}>${s.suggestedPrice.toFixed(2)}</span>
                    <span className={`pct-change ${diff >= 0 ? 'up' : 'down'}`}>{diff >= 0 ? '+' : ''}{pct}%</span>
                  </div>
                  <p className="pricing-reason">{s.reason}</p>
                  <span className="pricing-action-label">{s.action}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="ai-empty">
          <div className="ai-empty-icon">💲</div>
          <p>Click <strong>Analyse Prices</strong> to get AI-powered pricing recommendations that prevent waste and maximise revenue.</p>
        </div>
      )}
    </div>
  );
};

// ── Description Generator ──────────────────────────────────────────────────────
const DescriptionGenerator = () => {
  const [form, setForm] = useState({ name: '', category: 'vegetables', price: '', unit: 'kg' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    setLoading(true);
    try {
      const res = await axios.post('/api/ai/generate-description', form);
      if (res.data.demo) { toast.error('Add GEMINI_API_KEY to backend .env'); return; }
      setResult(res.data);
      toast.success('Description generated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  return (
    <div className="ai-tool-section">
      <div className="ai-tool-header">
        <div>
          <h3>✍️ Product Description Generator</h3>
          <p>Enter basic product details and AI writes a compelling listing for you.</p>
        </div>
      </div>
      <div className="desc-form">
        <div className="desc-form-grid">
          <div className="form-group">
            <label>Product Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Organic Heirloom Tomatoes" />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {['vegetables','fruits','meat','dairy','grains'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Price ($)</label>
            <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="3.99" />
          </div>
          <div className="form-group">
            <label>Unit</label>
            <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
              {['kg','lb','bunch','piece','litre','dozen','bag'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <button className={`btn-analyze ${loading ? 'loading' : ''}`} onClick={generate} disabled={loading}>
          {loading ? <><span className="spinner" /> Generating…</> : '✨ Generate Description'}
        </button>
      </div>

      {result && (
        <div className="desc-result">
          <div className="desc-result-block">
            <div className="desc-result-header">
              <span>Product Name</span>
              <button className="copy-btn" onClick={() => copy(result.name)}>📋 Copy</button>
            </div>
            <p className="desc-result-name">{result.name}</p>
          </div>
          <div className="desc-result-block">
            <div className="desc-result-header">
              <span>Description</span>
              <button className="copy-btn" onClick={() => copy(result.description)}>📋 Copy</button>
            </div>
            <p>{result.description}</p>
          </div>
          {result.highlights?.length > 0 && (
            <div className="desc-result-block">
              <span>Highlights</span>
              <ul className="desc-highlights">{result.highlights.map((h,i) => <li key={i}>✅ {h}</li>)}</ul>
            </div>
          )}
          {result.storageNote && (
            <div className="desc-result-block">
              <span>Storage Note</span>
              <p className="storage-note">🌿 {result.storageNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Sentiment Analysis ─────────────────────────────────────────────────────────
const SentimentAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const analyse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ai/sentiment');
      if (res.data.demo) { toast.error('Add GEMINI_API_KEY to backend .env'); return; }
      setData(res.data);
      toast.success('Sentiment analysis complete!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }, []);

  const sentimentColor = { positive: '#16a34a', neutral: '#d97706', negative: '#dc2626', mixed: '#7c3aed' };

  return (
    <div className="ai-tool-section">
      <div className="ai-tool-header">
        <div>
          <h3>⭐ Customer Sentiment Analysis</h3>
          <p>AI reads all your product reviews and surfaces what customers love and what needs fixing.</p>
        </div>
        <button className={`btn-analyze ${loading ? 'loading' : ''}`} onClick={analyse} disabled={loading}>
          {loading ? <><span className="spinner" /> Analysing…</> : '✨ Analyse Reviews'}
        </button>
      </div>

      {data && (
        <>
          <div className="pricing-summary-banner">{data.overallHealth}</div>
          {data.products?.length === 0 && <p className="no-reviews-msg">No reviews to analyse yet — keep growing your customer base!</p>}
          <div className="sentiment-grid">
            {data.products?.map((p, i) => (
              <div key={i} className="sentiment-card">
                <div className="sentiment-card-header">
                  <strong>{p.productName}</strong>
                  <span className="sentiment-badge" style={{ background: sentimentColor[p.overallSentiment?.toLowerCase()] || '#aaa' }}>
                    {p.overallSentiment}
                  </span>
                </div>
                <div className="sentiment-rating">{'⭐'.repeat(Math.round(p.averageRating))} {p.averageRating?.toFixed(1)}</div>
                {p.positiveThemes?.length > 0 && (
                  <div className="sentiment-themes positive">
                    <span>👍 Customers love:</span>
                    <ul>{p.positiveThemes.map((t,j) => <li key={j}>{t}</li>)}</ul>
                  </div>
                )}
                {p.negativeThemes?.length > 0 && (
                  <div className="sentiment-themes negative">
                    <span>👎 Areas to improve:</span>
                    <ul>{p.negativeThemes.map((t,j) => <li key={j}>{t}</li>)}</ul>
                  </div>
                )}
                <p className="sentiment-suggestion">💡 {p.actionableSuggestion}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="ai-empty">
          <div className="ai-empty-icon">⭐</div>
          <p>Click <strong>Analyse Reviews</strong> to understand what customers are saying about your products.</p>
        </div>
      )}
    </div>
  );
};

// ── Main Tabs Component ────────────────────────────────────────────────────────
const RetailerAITools = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const tabs = [
    { id: 'inventory', label: '📦 Inventory AI' },
    { id: 'pricing', label: '💲 Pricing Engine' },
    { id: 'description', label: '✍️ Description Generator' },
    { id: 'sentiment', label: '⭐ Review Sentiment' },
  ];

  return (
    <div className="retailer-ai-tools">
      <div className="ai-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`ai-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="ai-tab-content">
        {activeTab === 'inventory' && <InventoryPlaceholder />}
        {activeTab === 'pricing' && <PricingEngine />}
        {activeTab === 'description' && <DescriptionGenerator />}
        {activeTab === 'sentiment' && <SentimentAnalysis />}
      </div>
    </div>
  );
};

const InventoryPlaceholder = () => (
  <div className="ai-tool-section">
    <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
      The full Inventory AI assistant is on the <strong>AI Assistant</strong> page in your dashboard.
    </p>
  </div>
);

export default RetailerAITools;
