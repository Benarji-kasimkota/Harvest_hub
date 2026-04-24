import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';
import './DeliveryAITools.css';

// ── Route Optimizer ────────────────────────────────────────────────────────────
const RouteOptimizer = () => {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    axios.get('/api/delivery/assigned')
      .then(r => setOrders(r.data.filter(o => ['shipped','out_for_delivery'].includes(o.status))))
      .catch(() => {});
  }, []);

  const toggle = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const selectedIds = Object.entries(selected).filter(([,v]) => v).map(([k]) => k);

  const optimise = async () => {
    if (selectedIds.length < 2) { toast.error('Select at least 2 orders to optimise'); return; }
    setLoading(true);
    try {
      const res = await axios.post('/api/ai/route-optimize', { orderIds: selectedIds });
      if (res.data.demo) { toast.error('Add GEMINI_API_KEY to backend .env'); return; }
      setResult(res.data);
      toast.success('Route optimised!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="delivery-ai-section">
      <div className="delivery-ai-header">
        <div>
          <h3>🗺️ Route Optimizer</h3>
          <p>Select your active deliveries and AI will find the most efficient delivery order.</p>
        </div>
        <button className="btn-ai-delivery" onClick={optimise} disabled={loading || selectedIds.length < 2}>
          {loading ? '⏳ Optimising…' : `✨ Optimise Route (${selectedIds.length} selected)`}
        </button>
      </div>

      {orders.length === 0 && <div className="dai-empty">No active deliveries to optimise.</div>}

      {orders.length > 0 && (
        <div className="route-order-list">
          <p className="route-hint">Select the orders you want to optimise:</p>
          {orders.map(o => (
            <div key={o._id} className={`route-order-card ${selected[o._id] ? 'selected' : ''}`} onClick={() => toggle(o._id)}>
              <input type="checkbox" checked={!!selected[o._id]} onChange={() => toggle(o._id)} onClick={e => e.stopPropagation()} />
              <div className="route-order-info">
                <span className="order-id">#{o._id.slice(-6).toUpperCase()}</span>
                <span>{o.user?.name}</span>
                <span className="route-address">
                  {o.shippingAddress?.street}, {o.shippingAddress?.city}
                </span>
              </div>
              <span className={'status-badge-sm status-' + o.status}>{o.status?.replace('_',' ')}</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="route-result">
          <div className="route-result-header">
            <h4>Optimised Route</h4>
            <span className="route-total-time">⏱ ~{result.totalEstimatedMinutes} min total</span>
          </div>
          <div className="route-steps">
            {result.optimizedRoute?.map((step, i) => (
              <div key={i} className="route-step">
                <div className="route-step-num">{step.step}</div>
                <div className="route-step-info">
                  <strong>{step.customer}</strong>
                  <p>{step.address}</p>
                  {step.tip && <span className="route-tip-hint">💰 {step.tip}</span>}
                </div>
                <span className="route-step-time">~{step.estimatedMinutes} min</span>
              </div>
            ))}
          </div>
          {result.routingTips?.length > 0 && (
            <div className="route-tips-box">
              <p><strong>💡 Routing Tips</strong></p>
              <ul>{result.routingTips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Earnings Optimizer ─────────────────────────────────────────────────────────
const EarningsOptimizer = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchTips = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ai/earnings-tips');
      if (res.data.demo) { toast.error('Add GEMINI_API_KEY to backend .env'); return; }
      setData(res.data);
      toast.success('Earnings analysis ready!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="delivery-ai-section">
      <div className="delivery-ai-header">
        <div>
          <h3>💰 Earnings Optimizer</h3>
          <p>AI analyses your delivery history to help you earn more and get better tips.</p>
        </div>
        <button className="btn-ai-delivery" onClick={fetchTips} disabled={loading}>
          {loading ? '⏳ Analysing…' : '✨ Get Earnings Tips'}
        </button>
      </div>

      {!data && !loading && (
        <div className="dai-empty">
          <p>Click <strong>Get Earnings Tips</strong> to get personalised advice based on your delivery history.</p>
        </div>
      )}

      {data && (
        <div className="earnings-result">
          <div className="earnings-forecast-banner">
            <span>📅 Weekly Forecast</span>
            <p>{data.weeklyForecast}</p>
          </div>

          <div className="earnings-grid">
            <div className="earnings-panel">
              <h4>⏰ Best Time Slots</h4>
              <ul className="earnings-list">
                {data.bestTimeSlots?.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
            <div className="earnings-panel">
              <h4>💡 Tip Optimisation</h4>
              <p>{data.tipOptimizationAdvice}</p>
            </div>
          </div>

          <div className="earnings-tips-section">
            <h4>🚀 Earnings Tips</h4>
            <ul className="earnings-tips-list">
              {data.earningsTips?.map((t, i) => (
                <li key={i} className="earnings-tip-item">
                  <span className="tip-num">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="performance-summary">
            <h4>📊 Performance Summary</h4>
            <p>{data.performanceSummary}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const DeliveryAITools = () => {
  const [tab, setTab] = useState('route');

  return (
    <div className="delivery-ai-tools">
      <h2>✨ AI Tools</h2>
      <div className="dai-tabs">
        <button className={tab === 'route' ? 'active' : ''} onClick={() => setTab('route')}>🗺️ Route Optimizer</button>
        <button className={tab === 'earnings' ? 'active' : ''} onClick={() => setTab('earnings')}>💰 Earnings Optimizer</button>
      </div>
      <div className="dai-tab-content">
        {tab === 'route' && <RouteOptimizer />}
        {tab === 'earnings' && <EarningsOptimizer />}
      </div>
    </div>
  );
};

export default DeliveryAITools;
