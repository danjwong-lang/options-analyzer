export async function POST(request) {
  const body = await request.json();
  const { tickers, minDays = 7, maxDays = 45 } = body;

  if (!tickers || tickers.length === 0) {
    return Response.json({ error: 'No tickers provided' }, { status: 400 });
  }

  const results = [];

  try {
    for (const tickerConfig of tickers) {
      const { ticker, optionType, otmPercent } = tickerConfig;
      const symbol = ticker.toUpperCase();

      try {
        // Fetch with retry logic
        const optionsData = await fetchWithRetry(
          `https://query1.finance.yahoo.com/v7/finance/options/${symbol}`
        );
        
        if (!optionsData?.optionChain?.result?.[0]) {
          console.log(`No options data for ${symbol}`);
          continue;
        }

        const optionResult = optionsData.optionChain.result[0];
        const currentPrice = optionResult.quote?.regularMarketPrice;
        
        if (!currentPrice) {
          console.log(`No price for ${symbol}`);
          continue;
        }

        const expirationDates = optionResult.expirationDates || [];
        if (expirationDates.length === 0) continue;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter expiration dates within the desired range
        const validExpirations = expirationDates.filter(timestamp => {
          const expiry = new Date(timestamp * 1000);
          const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
          return daysToExpiry >= minDays && daysToExpiry <= maxDays;
        });

        // Process first expiration from initial request
        if (optionResult.options?.[0]) {
          const firstExpiry = new Date(expirationDates[0] * 1000);
          const firstDaysToExpiry = Math.ceil((firstExpiry - today) / (1000 * 60 * 60 * 24));
          
          if (firstDaysToExpiry >= minDays && firstDaysToExpiry <= maxDays) {
            processOptions(optionResult.options[0], optionType, currentPrice, otmPercent, firstExpiry, firstDaysToExpiry, symbol, results);
          }
        }

        // Fetch remaining expirations with delays
        for (const expirationTimestamp of validExpirations) {
          if (expirationTimestamp === expirationDates[0]) continue;
          
          // Add delay between requests
          await delay(500);
          
          try {
            const chainData = await fetchWithRetry(
              `https://query1.finance.yahoo.com/v7/finance/options/${symbol}?date=${expirationTimestamp}`
            );
            
            const chainResult = chainData?.optionChain?.result?.[0];
            if (!chainResult?.options?.[0]) continue;

            const expiry = new Date(expirationTimestamp * 1000);
            const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

            processOptions(chainResult.options[0], optionType, currentPrice, otmPercent, expiry, daysToExpiry, symbol, results);
          } catch (e) {
            console.log(`Chain fetch error: ${e.message}`);
          }
        }
        
        // Delay between tickers
        await delay(1000);
        
      } catch (tickerError) {
        console.error(`Error processing ${ticker}: ${tickerError.message}`);
      }
    }

    results.sort((a, b) => b.return_30d - a.return_30d);
    return Response.json({ results });

  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ error: 'Error analyzing options.' }, { status: 500 });
  }
}

async function fetchWithRetry(url, maxRetries = 3) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json',
  };

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting... (attempt ${i + 1})`);
        await delay(2000 * (i + 1)); // Exponential backoff
        continue;
      }
      
      if (!response.ok) {
        console.log(`HTTP error: ${response.status}`);
        return null;
      }
      
      return await response.json();
    } catch (e) {
      console.log(`Fetch error: ${e.message}`);
      if (i < maxRetries - 1) await delay(1000);
    }
  }
  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function processOptions(optionsData, optionType, currentPrice, otmPercent, expiry, daysToExpiry, symbol, results) {
  const chain = optionType.toLowerCase() === 'put' ? optionsData.puts : optionsData.calls;
  if (!chain || chain.length === 0) return;

  for (const option of chain) {
    const strike = option.strike;
    if (!strike) continue;

    let actualOtmPercent;
    if (optionType.toLowerCase() === 'put') {
      actualOtmPercent = ((currentPrice - strike) / currentPrice) * 100;
    } else {
      actualOtmPercent = ((strike - currentPrice) / currentPrice) * 100;
    }

    if (actualOtmPercent < 0) continue;
    const maxOtm = parseFloat(otmPercent);
    if (actualOtmPercent > maxOtm) continue;

    const bid = option.bid || 0;
    const ask = option.ask || 0;
    let premium = (bid + ask) / 2;
    if (premium <= 0 && option.lastPrice) premium = option.lastPrice;
    if (premium <= 0) continue;

    const iv = (option.impliedVolatility || 0) * 100;
    const volume = option.volume || 0;
    const openInterest = option.openInterest || 0;

    let return30d;
    if (optionType.toLowerCase() === 'put') {
      const effectiveCapital = strike - premium;
      if (effectiveCapital > 0) {
        return30d = (premium / effectiveCapital) * (30 / daysToExpiry) * 100;
      } else {
        continue;
      }
    } else {
      return30d = (premium / currentPrice) * (30 / daysToExpiry) * 100;
    }

    results.push({
      ticker: symbol,
      type: optionType.toUpperCase(),
      expiry: expiry.toISOString().split('T')[0],
      days_to_expiry: daysToExpiry,
      stock_price: currentPrice,
      strike,
      otm_percent: actualOtmPercent,
      bid,
      ask,
      premium,
      return_30d: return30d,
      iv,
      volume,
      open_interest: openInterest
    });
  }
}
