import yahooFinance from 'yahoo-finance2';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return Response.json({ valid: false, error: 'No ticker provided' }, { status: 400 });
  }

  try {
    // Suppress yahoo-finance2 validation notices
    yahooFinance.suppressNotices(['yahooSurvey']);
    
    const quote = await yahooFinance.quote(ticker.toUpperCase());
    
    if (quote && quote.regularMarketPrice) {
      return Response.json({ 
        valid: true, 
        price: quote.regularMarketPrice,
        name: quote.shortName || quote.longName || ticker.toUpperCase()
      });
    } else {
      return Response.json({ valid: false, error: 'Invalid ticker' });
    }
  } catch (error) {
    console.error('Validation error:', error.message);
    return Response.json({ valid: false, error: 'Invalid ticker' });
  }
}
