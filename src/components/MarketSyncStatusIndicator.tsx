import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type MarketSyncStatusIndicatorVariant = "full" | "compact";

interface SyncLog {
  created_at: string;
  sync_type: string;
  symbols_count: number;
  success_count: number;
  error_count: number;
}

export function MarketSyncStatusIndicator({
  className,
  variant = "full",
}: {
  className?: string;
  variant?: MarketSyncStatusIndicatorVariant;
}) {
  const [logs, setLogs] = useState<SyncLog[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from("market_sync_logs")
        .select("created_at, sync_type, symbols_count, success_count, error_count")
        .eq("sync_type", "scheduled_refresh")
        .order("created_at", { ascending: false })
        .limit(14);

      if (!cancelled) setLogs(data || []);
    };

    fetchLogs();
    const t = window.setInterval(fetchLogs, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const computed = useMemo(() => {
    const last = logs[0] || null;
    const totals = logs.reduce(
      (acc, l) => {
        acc.symbols += l.symbols_count || 0;
        acc.success += l.success_count || 0;
        return acc;
      },
      { symbols: 0, success: 0 }
    );

    const successRate = totals.symbols > 0 ? (totals.success / totals.symbols) * 100 : null;
    return { last, successRate };
  }, [logs]);

  const label = (() => {
    if (!computed.last) return variant === "compact" ? "Market data: never" : "Auto refresh: never";

    const when = formatDistanceToNow(new Date(computed.last.created_at), { addSuffix: true });
    const rate = computed.successRate === null ? null : Math.round(computed.successRate);

    if (variant === "compact") {
      return rate === null ? `Market data: ${when}` : `Market data: ${when} • ${rate}%`;
    }

    return rate === null ? `Auto refresh: ${when}` : `Auto refresh: ${when} • ${rate}%`;
  })();

  return (
    <Badge
      variant="outline"
      className={cn("gap-2 whitespace-nowrap", className)}
      title={
        computed.last
          ? `Last scheduled market-data refresh: ${new Date(computed.last.created_at).toLocaleString()}`
          : "No scheduled refresh has run yet"
      }
    >
      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-foreground">{label}</span>
    </Badge>
  );
}
