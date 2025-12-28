# Options Premium Analyzer

A Next.js app that calculates normalized 30-day returns for selling options premium (covered calls and cash-secured puts).

## Features

- **Multi-ticker support**: Analyze up to 10 tickers at once
- **Put & Call options**: Cash-secured puts and covered calls
- **Configurable expiration window**: Set min/max days to expiry (default 7-45 days)
- **Target OTM percentage**: Filter options by % out-of-the-money (±5% tolerance)
- **Normalized 30-day returns**: Compare options across different expirations
- **Sortable results**: Click any column header to sort
- **CSV export**: Download results for further analysis

## Return Calculation Formulas

**Puts (Cash-Secured Put):**
```
Return = Premium / (Strike - Premium) × (30 / Days to Expiry) × 100
```

**Calls (Covered Call):**
```
Return = Premium / Stock Price × (30 / Days to Expiry) × 100
```

## Data Source

Uses **Yahoo Finance** (via yahoo-finance2) for real-time stock quotes and options chains. No API key required.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Deploy (no environment variables needed)

### Custom Domain Setup

To deploy to `options.danjwong.com`:

1. In Vercel project settings → Domains
2. Add `options.danjwong.com`
3. Add DNS records as instructed (CNAME to cname.vercel-dns.com)

## Tech Stack

- Next.js 14 (App Router)
- React 18
- yahoo-finance2 for options data
- CSS Modules for styling

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── analyze/route.js    # Options analysis endpoint
│   │   └── validate/route.js   # Ticker validation endpoint
│   ├── globals.css
│   ├── layout.js
│   ├── page.js                 # Main UI component
│   └── page.module.css         # Styles
├── next.config.js
└── package.json
```
