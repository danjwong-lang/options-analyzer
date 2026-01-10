export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return Response.json({ valid: false, error: 'No ticker provided' }, { status: 400 });
  }

  try {
    const symbol = ticker.toUpperCase();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = await response.json();
    
    if (data.chart?.result?.[0]) {
      const result = data.chart.result[0];
      const price = result.meta?.regularMarketPrice;
      const name = result.meta?.shortName || result.meta?.longName || symbol;
      
      if (price) {
        return Response.json({ valid: true, price, name });
      }
    }
    
    return Response.json({ valid: false, error: 'Invalid ticker' });
  } catch (error) {
    console.error('Validation error:', error.message);
    return Response.json({ valid: false, error: 'Invalid ticker' });
  }
}
