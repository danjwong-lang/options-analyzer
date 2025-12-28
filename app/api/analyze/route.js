import yahooFinance from 'yahoo-finance2';

export async function POST(request) {
  const body = await request.json();
  const { tickers, minDays = 7, maxDays = 45 } = body;

  if (!tickers || tickers.length === 0) {
    return Response.json({ error: 'No tickers provided' }, { status: 400 });
  }

  // Suppress yahoo-finance2 validation notices
  yahooFinance.suppressNotices(['yahooSurvey']);

  const results = [];

  try {
    for (const tickerConfig of tickers) {
      const { ticker, optionType, otmPercent } = tickerConfig;
      const symbol = ticker.toUpperCase();

      try {
        // Get current stock price
        const quote = await yahooFinance.quote(symbol);
        if (!quote || !quote.regularMarketPrice) {
          console.log(`No quote data for ${symbol}`);
          continue;
        }
        const currentPrice = quote.regularMarketPrice;

        // Get options chain with all expiration dates
        const options = await yahooFinance.options(symbol);
        
        if (!options || !options.expirationDates || options.expirationDates.length === 0) {
          console.log(`No options data for ${symbol}`);
          continue;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter expiration dates within the desired range
        const validExpirations = options.expirationDates.filter(expDate => {
          const expiry = new Date(expDate);
          const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
          return daysToExpiry >= minDays && daysToExpiry <= maxDays;
        });

        // Fetch options for each valid expiration date
        for (const expirationDate of validExpirations) {
          try {
            const chainData = await yahooFinance.options(symbol, { date: expirationDate });
            
            const chain = optionType.toLowerCase() === 'put' 
              ? chainData.options?.[0]?.puts 
              : chainData.options?.[0]?.calls;

            if (!chain || chain.length === 0) continue;

            const expiry = new Date(expirationDate);
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

              // Only include options that are actually OTM and within tolerance
              if (actualOtmPercent < 0) continue; // Skip ITM options
              
              const targetOtm = parseFloat(otmPercent);
              const otmDiff = Math.abs(actualOtmPercent - targetOtm);
              if (otmDiff > 5) continue; // Only include options within 5% of target OTM

              // Calculate premium (mid-point of bid/ask, or last price)
              const bid = option.bid || 0;
              const ask = option.ask || 0;
              let premium = (bid + ask) / 2;
              
              // If bid/ask not available, use last price
              if (premium <= 0 && option.lastPrice) {
                premium = option.lastPrice;
              }

              // Skip if no valid premium
              if (premium <= 0) continue;

              const iv = (option.impliedVolatility || 0) * 100;
              const volume = option.volume || 0;
              const openInterest = option.openInterest || 0;

              // Calculate normalized 30-day return
              let return30d;
              if (optionType.toLowerCase() === 'put') {
                // Put: Return = Premium / (Strike - Premium) × (30 / Days) × 100
                const effectiveCapital = strike - premium;
                if (effectiveCapital > 0) {
                  return30d = (premium / effectiveCapital) * (30 / daysToExpiry) * 100;
                } else {
                  continue;
                }
              } else {
                // Call: Return = Premium / Stock Price × (30 / Days) × 100
                return30d = (premium / currentPrice) * (30 / daysToExpiry) * 100;
              }

              // Format expiry date
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
            console.error(`Error fetching chain for ${symbol} ${expirationDate}:`, chainError.message);
          }
        }
      } catch (tickerError) {
        console.error(`Error processing ${ticker}:`, tickerError.message);
      }
    }

    // Sort by 30-day return descending
    results.sort((a, b) => b.return_30d - a.return_30d);

    return Response.json({ results });

  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ 
      error: 'Error analyzing options. Please try again.' 
    }, { status: 500 });
  }
}
