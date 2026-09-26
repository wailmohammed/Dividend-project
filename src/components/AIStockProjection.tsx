import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HistoricalPriceChart } from '@/components/HistoricalPriceChart';
import { Brain, Info, Search } from 'lucide-react';

const AIStockProjection = () => {
  const [input, setInput] = useState('');
  const [symbol, setSymbol] = useState('');

  const search = () => {
    const next = input.trim().toUpperCase();
    if (next) setSymbol(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold"><Brain className="h-6 w-6 text-primary" />Price History & Projection Readiness</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review sourced historical prices while the app’s forecast inputs are being connected.</p>
      </div>
      <Card>
        <CardContent className="flex gap-2 p-4">
          <Input aria-label="Stock symbol" placeholder="Enter ticker symbol" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => event.key === 'Enter' && search()} />
          <Button onClick={search} disabled={!input.trim()}><Search className="mr-2 h-4 w-4" />View history</Button>
        </CardContent>
      </Card>
      {symbol ? <HistoricalPriceChart symbol={symbol} /> : (
        <Card className="border-dashed"><CardContent className="py-14 text-center text-sm text-muted-foreground">Choose a ticker to load its available historical price chart.</CardContent></Card>
      )}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4 text-primary" />Forecast status</CardTitle><CardDescription>Why no target prices or confidence scores appear here</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Price targets, seasonal patterns, and technical signals need a dated historical dataset and a documented calculation method. The current AI service does not receive those inputs, so this screen does not generate forecasts or buy/sell signals.</p>
          <p>Historical performance is not a prediction of future returns. Verify the selected provider’s source and delay before relying on a quote.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIStockProjection;
