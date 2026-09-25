import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieIcon, Globe, Building2, Factory, Layers } from 'lucide-react';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 80%, 55%)',
  'hsl(160, 70%, 45%)',
  'hsl(45, 90%, 55%)',
  'hsl(340, 75%, 55%)',
  'hsl(270, 60%, 55%)',
  'hsl(190, 70%, 50%)',
  'hsl(20, 85%, 55%)',
  'hsl(100, 60%, 45%)',
  'hsl(300, 50%, 50%)',
  'hsl(230, 55%, 60%)',
  'hsl(0, 70%, 55%)',
];

const REGION_MAP: Record<string, string> = {
  US: 'North America', CA: 'North America',
  GB: 'Europe', DE: 'Europe', FR: 'Europe', IE: 'Europe', NL: 'Europe', CH: 'Europe', IT: 'Europe', ES: 'Europe',
  JP: 'Asia Pacific', CN: 'Asia Pacific', HK: 'Asia Pacific', KR: 'Asia Pacific', AU: 'Asia Pacific', SG: 'Asia Pacific', IN: 'Asia Pacific', TW: 'Asia Pacific',
  BR: 'Latin America', MX: 'Latin America',
  ZA: 'Africa/Middle East', SA: 'Africa/Middle East', AE: 'Africa/Middle East',
};

const INDUSTRY_MAP: Record<string, string> = {
  Technology: 'Software & Services',
  Healthcare: 'Pharmaceuticals & Biotech',
  'Financial Services': 'Banks & Insurance',
  'Consumer Cyclical': 'Retail & Luxury',
  'Consumer Defensive': 'Food & Beverages',
  Energy: 'Oil & Gas',
  Industrials: 'Aerospace & Defense',
  Utilities: 'Electric Utilities',
  'Real Estate': 'REITs',
  'Communication Services': 'Media & Telecom',
  'Basic Materials': 'Mining & Chemicals',
};

interface SliceData {
  name: string;
  value: number;
  percent: number;
  count: number;
}

const AllocationDeepDive: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [activeTab, setActiveTab] = useState('type');
  const [selectedSlice, setSelectedSlice] = useState<SliceData | null>(null);

  const holdings = activePortfolio.holdings || [];
  const totalValue = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);

  const buildSlices = (groupFn: (h: any) => string): SliceData[] => {
    const groups: Record<string, { value: number; count: number }> = {};
    holdings.forEach(h => {
      const key = groupFn(h) || 'Other';
      const val = h.shares * h.currentPrice;
      if (!groups[key]) groups[key] = { value: 0, count: 0 };
      groups[key].value += val;
      groups[key].count += 1;
    });
    return Object.entries(groups)
      .map(([name, { value, count }]) => ({
        name,
        value: Math.round(value * 100) / 100,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
        count,
      }))
      .sort((a, b) => b.value - a.value);
  };

  const data = useMemo(() => ({
    type: buildSlices(h => h.assetType || 'Stock'),
    sector: buildSlices(h => h.sector || 'Unknown'),
    region: buildSlices(h => REGION_MAP[h.country] || REGION_MAP['US']),
    industry: buildSlices(h => INDUSTRY_MAP[h.sector] || h.sector || 'Other'),
  }), [holdings]);

  const currentData = data[activeTab as keyof typeof data] || [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.[0]) {
      const d = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl">
          <div className="font-bold text-foreground text-sm">{d.name}</div>
          <div className="text-xs text-muted-foreground mt-1">
            ${d.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {d.percent.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">{d.count} holding{d.count > 1 ? 's' : ''}</div>
        </div>
      );
    }
    return null;
  };

  if (holdings.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Add holdings to see allocation breakdown</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-primary" />
            Allocation DeepDive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="type" className="gap-1.5 text-xs"><Layers className="w-3.5 h-3.5" />Type</TabsTrigger>
              <TabsTrigger value="sector" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" />Sector</TabsTrigger>
              <TabsTrigger value="region" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" />Region</TabsTrigger>
              <TabsTrigger value="industry" className="gap-1.5 text-xs"><Factory className="w-3.5 h-3.5" />Industry</TabsTrigger>
            </TabsList>

            {['type', 'sector', 'region', 'industry'].map(tab => (
              <TabsContent key={tab} value={tab}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Donut Chart */}
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={currentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={130}
                          dataKey="value"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          onClick={(_, idx) => setSelectedSlice(currentData[idx])}
                          className="cursor-pointer"
                        >
                          {currentData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={selectedSlice && selectedSlice.name !== currentData[i].name ? 0.4 : 1} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Breakdown Table */}
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {currentData.map((d, i) => (
                      <div
                        key={d.name}
                        onClick={() => setSelectedSlice(selectedSlice?.name === d.name ? null : d)}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                          selectedSlice?.name === d.name ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
                        }`}
                      >
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.count} holding{d.count > 1 ? 's' : ''}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-foreground">{d.percent.toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">${d.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Center label */}
                {selectedSlice && (
                  <div className="mt-4 p-4 bg-muted/30 rounded-xl text-center">
                    <div className="text-lg font-bold text-foreground">{selectedSlice.name}</div>
                    <div className="text-2xl font-bold text-primary">${selectedSlice.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-sm text-muted-foreground">{selectedSlice.percent.toFixed(1)}% of portfolio · {selectedSlice.count} positions</div>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AllocationDeepDive;
