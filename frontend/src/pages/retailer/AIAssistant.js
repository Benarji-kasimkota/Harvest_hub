import React, { useState, useCallback } from 'react';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';
import './AIAssistant.css';

const URGENCY_COLOR = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
const URGENCY_ICON = { critical: '🚨', high: '⚠️', medium: '📌', low: '✅' };
const TREND_ICON = { rising: '📈', stable: '➡️', declining: '📉' };

const RestockItem = ({ rec, selected, onToggle, onQtyChange }) => {
  const urgency = rec.urgency || 'medium';
  return (
    <div className={`restock-item ${selected ? 'selected' : ''}`}>
      <div className="restock-check">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(rec.productId)}
          id={`chk-${rec.productId}`}
        />
      </div>
      <div className="restock-info">
        <label htmlFor={`chk-${rec.productId}`} className="restock-name">{rec.productName}</label>
        <p className="restock-reason">{rec.reason}</p>
        {rec.estimatedDaysUntilStockout != null && (
          <span className="stockout-badge">
            ⏱ ~{rec.estimatedDaysUntilStockout} days until stockout
          </span>
        )}
      </div>
      <div className="restock-meta">
        <span className="restock-stock">Current: <strong>{rec.currentStock}</strong> units</span>
        <span className="urgency-badge" style={{ background: URGENCY_COLOR[urgency] }}>
          {URGENCY_ICON[urgency]} {urgency}
        </span>
      </div>
      <div className="restock-qty-group">
        <label>Restock qty</label>
        <input
          type="number"
          min="1"
          value={rec._editedQty ?? rec.suggestedRestockQty}
          onChange={e => onQtyChange(rec.productId, Number(e.target.value))}
          className="restock-qty-input"
        />
      </div>
    </div>
  );
};

const ForecastCard = ({ item }) => (
  <div className="forecast-card">
    <div className="forecast-header">
      <span className="forecast-category">{item.category}</span>
      <span className="forecast-trend">{TREND_ICON[item.trend]} {item.trend}</span>
    </div>
    <p className="forecast-next">{item.forecastNextMonth}</p>
    <p className="forecast-action">{item.actionableInsight}</p>
  </div>
);

const OpportunityCard = ({ item }) => (
  <div className="opportunity-card">
    <h4>{item.title}</h4>
    <p>{item.description}</p>
    {item.potentialRevenue && (
      <span className="opp-revenue">💰 {item.potentialRevenue}</span>
    )}
  </div>
);

const AIAssistant = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState({});
  const [restocking, setRestocking] = useState(false);
  const [activeTab, setActiveTab] = useState('restock');

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setData(null);
    setSelected({});
    try {
      const res = await axios.get('/api/ai/insights');
      if (res.data.demo) {
        toast.error('AI key not configured. Get a free key at aistudio.google.com and add GEMINI_API_KEY to backend .env');
        return;
      }
      const recs = res.data.recommendations;
      // Pre-select critical + high urgency items
      const preSelected = {};
      (recs.restockRecommendations || []).forEach(r => {
        if (['critical', 'high'].includes(r.urgency)) preSelected[r.productId] = true;
      });
      setData(res.data);
      setSelected(preSelected);
      toast.success('AI analysis complete!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to get AI insights');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelect = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const updateQty = (id, qty) => {
    setData(prev => ({
      ...prev,
      recommendations: {
        ...prev.recommendations,
        restockRecommendations: prev.recommendations.restockRecommendations.map(r =>
          r.productId === id ? { ...r, _editedQty: qty } : r
        ),
      },
    }));
  };

  const applyRestock = async () => {
    const recs = data?.recommendations?.restockRecommendations || [];
    const items = recs
      .filter(r => selected[r.productId])
      .map(r => ({ productId: r.productId, quantity: r._editedQty ?? r.suggestedRestockQty }));

    if (items.length === 0) {
      toast.error('Select at least one product to restock');
      return;
    }

    setRestocking(true);
    try {
      const res = await axios.post('/api/ai/restock', { items });
      toast.success(`Restocked ${res.data.count} product(s) successfully!`);
      // Optimistically update displayed stock levels
      const updatedMap = {};
      res.data.restocked.forEach(r => { updatedMap[r.productId] = r.newStock; });
      setData(prev => ({
        ...prev,
        recommendations: {
          ...prev.recommendations,
          restockRecommendations: prev.recommendations.restockRecommendations.map(r =>
            updatedMap[r.productId] != null
              ? { ...r, currentStock: updatedMap[r.productId] }
              : r
          ),
        },
      }));
      setSelected({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restock failed');
    } finally {
      setRestocking(false);
    }
  };

  const recs = data?.recommendations;
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="ai-assistant">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-text">
          <h2>AI Business Assistant</h2>
          <p>Powered by Gemini — analyzes your sales history, seasons, and regional festivals to optimize your inventory</p>
        </div>
        <button
          className={`btn-analyze ${loading ? 'loading' : ''}`}
          onClick={fetchInsights}
          disabled={loading}
        >
          {loading ? (
            <><span className="spinner" /> Analyzing…</>
          ) : (
            <><span>✨</span> {data ? 'Refresh Analysis' : 'Analyze My Business'}</>
          )}
        </button>
      </div>

      {/* Empty state */}
      {!loading && !data && (
        <div className="ai-empty">
          <div className="ai-empty-icon">🤖</div>
          <h3>Your AI business assistant is ready</h3>
          <p>Click <strong>Analyze My Business</strong> to get AI-powered inventory predictions based on your sales history, upcoming seasons, and regional festivals.</p>
          <ul className="ai-feature-list">
            <li>📊 Identifies products at risk of stockout</li>
            <li>🌍 Detects regional festival demand spikes</li>
            <li>♻️ Reduces food waste with smart restock timing</li>
            <li>🎯 One-click restock for approved quantities</li>
          </ul>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="ai-loading">
          <div className="ai-loading-card skeleton" />
          <div className="ai-loading-card skeleton" style={{ height: 120 }} />
          <div className="ai-loading-card skeleton" style={{ height: 200 }} />
        </div>
      )}

      {/* Results */}
      {data && recs && (
        <>
          {/* Summary cards */}
          <div className="ai-summary-row">
            <div className="ai-summary-card blue">
              <div className="ai-sum-icon">📊</div>
              <div>
                <p className="ai-sum-val">{recs.restockRecommendations?.length || 0}</p>
                <p className="ai-sum-label">Restock Alerts</p>
              </div>
            </div>
            <div className="ai-summary-card orange">
              <div className="ai-sum-icon">🎯</div>
              <div>
                <p className="ai-sum-val">{recs.opportunityAlerts?.length || 0}</p>
                <p className="ai-sum-label">Opportunities</p>
              </div>
            </div>
            <div className="ai-summary-card green">
              <div className="ai-sum-icon">♻️</div>
              <div>
                <p className="ai-sum-val">{recs.wasteReductionTips?.length || 0}</p>
                <p className="ai-sum-label">Waste Tips</p>
              </div>
            </div>
            <div className="ai-summary-card purple">
              <div className="ai-sum-icon">🌍</div>
              <div>
                <p className="ai-sum-val">{data.meta?.productsAnalyzed || 0}</p>
                <p className="ai-sum-label">Products Analyzed</p>
              </div>
            </div>
          </div>

          {/* Executive summary + seasonal context */}
          <div className="ai-insight-banner">
            <div className="ai-insight-section">
              <h3>📋 Executive Summary</h3>
              <p>{recs.executiveSummary}</p>
            </div>
            <div className="ai-insight-section seasonal">
              <h3>🌸 Seasonal & Regional Context</h3>
              <p>{recs.seasonalContext}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="ai-tabs">
            {[
              { id: 'restock', label: `📦 Restock (${recs.restockRecommendations?.length || 0})` },
              { id: 'forecast', label: `📈 Forecast (${recs.demandForecast?.length || 0})` },
              { id: 'opportunities', label: `🎯 Opportunities (${recs.opportunityAlerts?.length || 0})` },
              { id: 'waste', label: `♻️ Waste Tips` },
            ].map(t => (
              <button
                key={t.id}
                className={`ai-tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Restock */}
          {activeTab === 'restock' && (
            <div className="ai-tab-content">
              {recs.restockRecommendations?.length === 0 ? (
                <div className="ai-empty-tab">✅ All products are adequately stocked!</div>
              ) : (
                <>
                  <div className="restock-toolbar">
                    <div className="restock-select-all">
                      <input
                        type="checkbox"
                        id="select-all"
                        checked={selectedCount === recs.restockRecommendations.length}
                        onChange={e => {
                          const next = {};
                          if (e.target.checked) recs.restockRecommendations.forEach(r => { next[r.productId] = true; });
                          setSelected(next);
                        }}
                      />
                      <label htmlFor="select-all">Select all ({recs.restockRecommendations.length})</label>
                    </div>
                    <button
                      className={`btn-restock-now ${restocking ? 'loading' : ''}`}
                      onClick={applyRestock}
                      disabled={restocking || selectedCount === 0}
                    >
                      {restocking ? (
                        <><span className="spinner" /> Restocking…</>
                      ) : (
                        `⚡ Restock Selected (${selectedCount})`
                      )}
                    </button>
                  </div>
                  <div className="restock-list">
                    {recs.restockRecommendations.map(rec => (
                      <RestockItem
                        key={rec.productId}
                        rec={rec}
                        selected={!!selected[rec.productId]}
                        onToggle={toggleSelect}
                        onQtyChange={updateQty}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab: Forecast */}
          {activeTab === 'forecast' && (
            <div className="ai-tab-content">
              <div className="forecast-grid">
                {recs.demandForecast?.map((item, i) => (
                  <ForecastCard key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Tab: Opportunities */}
          {activeTab === 'opportunities' && (
            <div className="ai-tab-content">
              <div className="opportunities-grid">
                {recs.opportunityAlerts?.length === 0 ? (
                  <div className="ai-empty-tab">No new opportunities detected this period.</div>
                ) : (
                  recs.opportunityAlerts.map((item, i) => (
                    <OpportunityCard key={i} item={item} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab: Waste Tips */}
          {activeTab === 'waste' && (
            <div className="ai-tab-content">
              <ul className="waste-tips-list">
                {recs.wasteReductionTips?.map((tip, i) => (
                  <li key={i} className="waste-tip-item">
                    <span className="tip-num">{i + 1}</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="ai-meta">
            Analysis generated {new Date(data.meta.generatedAt).toLocaleString()} · {data.meta.dataPoints} top products{data.meta.tokensUsed != null ? ` · ${data.meta.tokensUsed.toLocaleString()} tokens used` : ''}
          </p>
        </>
      )}
    </div>
  );
};

export default AIAssistant;
