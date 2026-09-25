import React from 'react';
import { Badge } from './ui/badge';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type AlertSeverity = 'critical' | 'warning' | 'info';

const SEVERITY_CONFIG: Record<AlertSeverity, {
  label: string;
  icon: React.ReactNode;
  className: string;
}> = {
  critical: {
    label: 'Critical',
    icon: <AlertCircle className="w-2.5 h-2.5" />,
    className: 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400',
  },
  warning: {
    label: 'Warning',
    icon: <AlertTriangle className="w-2.5 h-2.5" />,
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
  },
  info: {
    label: 'Info',
    icon: <Info className="w-2.5 h-2.5" />,
    className: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
  },
};

/** Derive severity from alert type. */
export const getAlertSeverity = (alertType: string): AlertSeverity => {
  switch (alertType) {
    case 'dividend_cut':
    case 'price_movement':
      return 'critical';
    case 'volume_spike':
    case 'rsi_threshold':
    case 'earnings_surprise':
      return 'warning';
    case 'ma_crossover':
    case 'dividend_increase':
    default:
      return 'info';
  }
};

export const AlertSeverityBadge: React.FC<{ severity: AlertSeverity; className?: string }> = ({ severity, className = '' }) => {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${config.className} ${className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};
