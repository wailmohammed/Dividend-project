import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HistoricalPriceChart } from '@/components/HistoricalPriceChart';
import { Info, Search, ShieldAlert } from 'lucide-react';

const EntryExitAnalysis = () => {
  const [input, setInput] = useState('');
  const [symbol, setSymbol] = useState('');
  const search = () => { if (input.trim()) setSymbol(input.trim().toUpperCase()); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold"><ShieldAlert className="h-6 w-6 text-primary" />Entry & Exit Research</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review available historical prices and the inputs needed for a reproducible analysis.</p>
      </div>
      <Card><CardContent className="flex gap-2 p-4"><Input aria-label="Stock symbol" placeholder="Enter ticker symbol" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => event.key === 'Enter' && search()} /><Button onClick={search} disabled={!input.trim()}><Search className="mr-2 h-4 w-4" />View history</Button></CardContent></Card>
      {symbol ? <HistoricalPriceChart symbol={symbol} /> : <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Choose a ticker to review its provider-backed history.</CardContent></Card>}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4 text-primary" />Trade signals are unavailable</CardTitle><CardDescription>This page does not produce entry prices, price targets, or stop-loss orders</CardDescription></CardHeader>
        <CardContent className="text-sm text-muted-foreground">The connected app does not have a verified, timestamped technical-indicator feed or validated forecasting model. Historical chart patterns alone do not predict a future price, so generated trade instructions are hidden.</CardContent>
      </Card>
    </div>
  );
};

export default EntryExitAnalysis;
