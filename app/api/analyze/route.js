export async function POST(request) {
  const body = await request.json();
  const { tickers, minDays = 7, maxDays = 45 } = body;

  if (!tickers || tickers.length === 0) {
    return Response.json({ error: 'No tickers provided' }, { status: 400 });
  }

  const results = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  try {
    for (const tickerConfig of tickers) {
      const { ticker, optionType, otmPercent } = tickerConfig;
      const symbol = ticker.toUpperCase();

      try {
        // Get current stock price
        const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const quoteResponse = await fetch(quoteUrl, { headers });
        const quoteData = await quoteResponse.json();
        
        if (!quoteData.chart?.result?.[0]?.meta?.regularMarketPrice) {
          console.log(`No quote data for ${symbol}`);
          continue;
        }
        const currentPrice = quoteData.chart.result[0].meta.regularMarketPrice;

        // Get options expiration dates
        const optionsUrl = `https://query1.finance.yahoo.com/v7/finance/options/${symbol}`;
        const optionsResponse = await fetch(optionsUrl, { headers });
        const optionsData = await optionsResponse.json();
        
        if (!optionsData.optionChain?.result?.[0]) {
          console.log(`No options data for ${symbol}`);
          continue;
        }

        const optionResult = optionsData.optionChain.result[0];
        const expirationDates = optionResult.expirationDates || [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter expiration dates within the desired range
        const validExpirations = expirationDates.filter(timestamp => {
          const expiry = new Date(timestamp * 1000);
          const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
          return daysToExpiry >= minDays && daysToExpiry <= maxDays;
        });

        // Fetch options for each valid expiration date
        for (const expirationTimestamp of validExpirations) {
          try {
            const chainUrl = `https://query1.finance.yahoo.com/v7/finance/options/${symbol}?date=${expirationTimestamp}`;
            const chainResponse = await fetch(chainUrl, { headers });
            const chainData = await chainResponse.json();
            
            const chainResult = chainData.optionChain?.result?.[0];
            if (!chainResult?.options?.[0]) continue;

            const chain = optionType.toLowerCase() === 'put' 
              ? chainResult.options[0].puts 
              : chainResult.options[0].calls;

            if (!chain || chain.length === 0) continue;

            const expiry = new Date(expirationTimestamp * 1000);
            const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

            for (const option of chain) {
              const strike = option.strike;
              if (!strike) continue;

              // Calculate actual OTM percentage
              let actualOtmPercent;
              if (optionType.toLowerCase() === 'put') {
                actualOtmPercent = ((currentPrice - strike) / currentPrice) * 100;
              } else {
                actualOtmPercent = ((strike - currentPrice) / currentPrice) * 100;
              }

              // Only include options that are OTM and up to the max threshold
              if (actualOtmPercent < 0) continue;
              
              const maxOtm = parseFloat(otmPercent);
              if (actualOtmPercent > maxOtm) continue;

              // Calculate premium (mid-point of bid/ask, or last price)
              const bid = option.bid || 0;
              const ask = option.ask || 0;
              let premium = (bid + ask) / 2;
              
              if (premium <= 0 && option.lastPrice) {
                premium = option.lastPrice;
              }

              if (premium <= 0) continue;

              const iv = (option.impliedVolatility || 0) * 100;
              const volume = option.volume || 0;
              const openInterest = option.openInterest || 0;

              // Calculate normalized 30-day return
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

              const expiryStr = expiry.toISOString().split('T')[0];

              results.push({
                ticker: symbol,
                type: optionType.toUpperCase(),
                expiry: expiryStr,
                days_to_expiry: daysToExpiry,
                stock_price: currentPrice,
                strike: strike,
                otm_percent: actualOtmPercent,
                bid: bid,
                ask: ask,
                premium: premium,
                return_30d: return30d,
                iv: iv,
                volume: volume,
                open_interest: openInterest
              });
            }
          } catch (chainError) {
            console.error(`Error fetching chain for ${symbol}:`, chainError.message);
          }
        }
      } catch (tickerError) {
        console.error(`Error processing ${ticker}:`, tickerError.message);
      }
    }

    results.sort((a, b) => b.return_30d - a.return_30d);
    return Response.json({ results });

  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ error: 'Error analyzing options. Please try again.' }, { status: 500 });
  }
}
