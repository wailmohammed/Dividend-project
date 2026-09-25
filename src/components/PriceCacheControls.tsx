import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { clearPriceCache, usePriceCacheTtl } from '@/hooks/useStockPrices';

/** TTL selector + "Clear cached prices" action for the live price cache. */
const PriceCacheControls: React.FC<{ className?: string }> = ({ className }) => {
  const { ttl, setTtl, options } = usePriceCacheTtl();

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <span className="text-[11px] text-muted-foreground">Cache</span>
      <Select value={String(ttl)} onValueChange={(v) => setTtl(Number(v))}>
        <SelectTrigger className="h-7 w-[110px] text-[11px]" data-testid="cache-ttl-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={String(o.value)} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[11px] gap-1"
        data-testid="clear-price-cache"
        onClick={() => {
          clearPriceCache();
          toast.success('Cached prices cleared — fetching fresh data');
        }}
      >
        <Trash2 className="w-3 h-3" /> Clear cached prices
      </Button>
    </div>
  );
};

export default PriceCacheControls;
