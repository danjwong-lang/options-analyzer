'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [tickers, setTickers] = useState([
    { id: 1, ticker: '', optionType: 'put', otmPercent: 10, price: null, name: null, validating: false, error: null }
  ]);
  const [minDays, setMinDays] = useState(7);
  const [maxDays, setMaxDays] = useState(45);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'return_30d', direction: 'desc' });

  const addTicker = () => {
    if (tickers.length >= 10) {
      alert('Maximum 10 ticker configurations allowed');
      return;
    }
    setTickers([
      ...tickers,
      { 
        id: Date.now(), 
        ticker: '', 
        optionType: 'put', 
        otmPercent: 10, 
        price: null,
        name: null,
        validating: false,
        error: null 
      }
    ]);
  };

  const removeTicker = (id) => {
    setTickers(tickers.filter(t => t.id !== id));
  };

  const updateTicker = (id, field, value) => {
    setTickers(tickers.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const validateTicker = async (id, tickerSymbol) => {
    if (!tickerSymbol) return;

    setTickers(prev => prev.map(t => 
      t.id === id ? { ...t, validating: true, error: null } : t
    ));

    try {
      const response = await fetch(`/api/validate?ticker=${tickerSymbol}`);
      const data = await response.json();

      setTickers(prev => prev.map(t => {
        if (t.id !== id) return t;
        if (data.valid) {
          return { 
            ...t, 
            price: data.price, 
            name: data.name,
            ticker: tickerSymbol.toUpperCase(),
            validating: false,
            error: null
          };
        } else {
          return { 
            ...t, 
            error: 'Invalid ticker', 
            price: null,
            name: null,
            validating: false 
          };
        }
      }));
    } catch (error) {
      setTickers(prev => prev.map(t => 
        t.id === id ? { ...t, error: 'Validation error', price: null, name: null, validating: false } : t
      ));
    }
  };

  const analyzeOptions = async () => {
    const validTickers = tickers.filter(t => t.ticker && !t.error);
    
    if (validTickers.length === 0) {
      alert('Please enter at least one valid ticker');
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tickers: validTickers,
          minDays: parseInt(minDays),
          maxDays: parseInt(maxDays)
        })
      });

      const data = await response.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }

      setResults(data.results || []);
    } catch (error) {
      alert('Error analyzing options. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const sortResults = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sorted = [...results].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setResults(sorted);
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = ['Ticker', 'Type', 'Expiry', 'Days', 'Strike', '% OTM', 'Bid', 'Ask', 'Premium', '30D Return %', 'IV %', 'Volume', 'Open Interest'];
    const rows = results.map(r => [
      r.ticker,
      r.type,
      r.expiry,
      r.days_to_expiry,
      r.strike?.toFixed(2),
      r.otm_percent?.toFixed(2),
      r.bid?.toFixed(2),
      r.ask?.toFixed(2),
      r.premium?.toFixed(2),
      r.return_30d?.toFixed(2),
      r.iv?.toFixed(1),
      r.volume,
      r.open_interest
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `options_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Options Premium Analyzer</h1>
        <p>Calculate normalized 30-day returns for selling options premium</p>
      </header>

      <main className={styles.main}>
        <section className={styles.configuration}>
          <h2>Configuration</h2>
          <p className={styles.subtitle}>Add up to 10 tickers - Data from Yahoo Finance</p>

          <div className={styles.globalSettings}>
            <div className={styles.formGroup}>
              <label>Min Days to Expiry</label>
              <input
                type="number"
                value={minDays}
                onChange={(e) => setMinDays(e.target.value)}
                min="1"
                max="365"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Max Days to Expiry</label>
              <input
                type="number"
                value={maxDays}
                onChange={(e) => setMaxDays(e.target.value)}
                min="1"
                max="365"
              />
            </div>
          </div>

          {tickers.map((ticker, index) => (
            <div key={ticker.id} className={styles.tickerForm}>
              <div className={styles.tickerHeader}>
                <h3>Ticker {index + 1}</h3>
                {tickers.length > 1 && (
                  <button 
                    className={styles.removeTicker}
                    onClick={() => removeTicker(ticker.id)}
                    title="Remove ticker"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Stock Ticker</label>
                  <input
                    type="text"
                    placeholder="e.g., NVDA"
                    value={ticker.ticker}
                    onChange={(e) => updateTicker(ticker.id, 'ticker', e.target.value.toUpperCase())}
                    onBlur={(e) => validateTicker(ticker.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        validateTicker(ticker.id, e.target.value);
                      }
                    }}
                  />
                  <div className={styles.validation}>
                    {ticker.validating && <span className={styles.validating}>Validating...</span>}
                    {ticker.price && (
                      <span className={styles.valid}>
                        ${ticker.price.toFixed(2)} {ticker.name && `- ${ticker.name}`}
                      </span>
                    )}
                    {ticker.error && (
                      <span className={styles.invalid}>{ticker.error}</span>
                    )}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Option Type</label>
                  <select
                    value={ticker.optionType}
                    onChange={(e) => updateTicker(ticker.id, 'optionType', e.target.value)}
                  >
                    <option value="put">Put (Cash-Secured)</option>
                    <option value="call">Call (Covered)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Max % OTM</label>
                  <input
                    type="number"
                    value={ticker.otmPercent}
                    onChange={(e) => updateTicker(ticker.id, 'otmPercent', e.target.value)}
                    min="0"
                    max="50"
                    step="1"
                  />
                  <small>0% to this value</small>
                </div>
              </div>
            </div>
          ))}

          <div className={styles.buttonGroup}>
            <button className={styles.btnSecondary} onClick={addTicker}>
              + Add Ticker
            </button>
            <button 
              className={styles.btnPrimary} 
              onClick={analyzeOptions}
              disabled={loading}
            >
              {loading ? 'Analyzing...' : 'Analyze Options'}
            </button>
          </div>
        </section>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Fetching options data from Yahoo Finance...</p>
          </div>
        )}

        {results.length > 0 && (
          <section className={styles.resultsSection}>
            <div className={styles.resultsHeader}>
              <h2>Results ({results.length} options)</h2>
              <button className={styles.btnExport} onClick={exportToCSV}>
                Export CSV
              </button>
            </div>

            <div className={styles.formulaNote}>
              <strong>30D Return Formula:</strong> 
              <span className={styles.formula}>Puts: Premium / (Strike - Premium) x (30 / Days) x 100</span>
              <span className={styles.formula}>Calls: Premium / Stock Price x (30 / Days) x 100</span>
            </div>

            <div className={styles.tableContainer}>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => sortResults('ticker')}>Ticker{getSortIndicator('ticker')}</th>
                    <th onClick={() => sortResults('type')}>Type{getSortIndicator('type')}</th>
                    <th onClick={() => sortResults('expiry')}>Expiry{getSortIndicator('expiry')}</th>
                    <th onClick={() => sortResults('days_to_expiry')}>Days{getSortIndicator('days_to_expiry')}</th>
                    <th onClick={() => sortResults('strike')}>Strike{getSortIndicator('strike')}</th>
                    <th onClick={() => sortResults('otm_percent')}>% OTM{getSortIndicator('otm_percent')}</th>
                    <th onClick={() => sortResults('premium')}>Premium{getSortIndicator('premium')}</th>
                    <th onClick={() => sortResults('return_30d')}>30D Return{getSortIndicator('return_30d')}</th>
                    <th onClick={() => sortResults('iv')}>IV %{getSortIndicator('iv')}</th>
                    <th onClick={() => sortResults('volume')}>Volume{getSortIndicator('volume')}</th>
                    <th onClick={() => sortResults('open_interest')}>OI{getSortIndicator('open_interest')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, idx) => (
                    <tr key={idx}>
                      <td><strong>{result.ticker}</strong></td>
                      <td className={result.type === 'PUT' ? styles.putType : styles.callType}>
                        {result.type}
                      </td>
                      <td>{result.expiry}</td>
                      <td>{result.days_to_expiry}</td>
                      <td>${result.strike?.toFixed(2)}</td>
                      <td>{result.otm_percent?.toFixed(1)}%</td>
                      <td>${result.premium?.toFixed(2)}</td>
                      <td className={styles.returnCell}>
                        <strong>{result.return_30d?.toFixed(2)}%</strong>
                      </td>
                      <td>{result.iv?.toFixed(1)}%</td>
                      <td>{result.volume?.toLocaleString()}</td>
                      <td>{result.open_interest?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && results.length === 0 && tickers.some(t => t.price) && (
          <div className={styles.emptyState}>
            <p>Click "Analyze Options" to fetch options data</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>Data provided by Yahoo Finance - For educational purposes only</p>
      </footer>
    </div>
  );
}
