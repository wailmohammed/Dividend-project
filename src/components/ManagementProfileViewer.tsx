import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { StockSearchAutocomplete } from './StockSearchAutocomplete';
import { Users, FlaskConical, Briefcase, DollarSign, Calendar, Award, Building2, ChevronRight, Plus, X } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';

interface Executive {
  name: string;
  title: string;
  age: number;
  since: string;
  compensation: number;
  shares: number;
  shareValue: number;
  background: string;
}

interface CompanyManagement {
  symbol: string;
  name: string;
  ceoTenure: number;
  boardSize: number;
  insiderOwnership: number;
  executives: Executive[];
}

const defaultManagement: CompanyManagement[] = [
  {
    symbol: 'AAPL', name: 'Apple Inc.', ceoTenure: 13, boardSize: 8, insiderOwnership: 0.07,
    executives: [
      { name: 'Tim Cook', title: 'CEO', age: 63, since: '2011', compensation: 63.2, shares: 3280000, shareValue: 631, background: 'Former COO, led operations transformation. Duke MBA.' },
      { name: 'Luca Maestri', title: 'CFO', age: 60, since: '2014', compensation: 26.9, shares: 110000, shareValue: 21.2, background: 'Former CFO of Xerox. GM finance veteran.' },
      { name: 'Jeff Williams', title: 'COO', age: 60, since: '2015', compensation: 26.9, shares: 489000, shareValue: 94.1, background: 'Led Apple Watch development. Operations expert.' },
      { name: 'Craig Federighi', title: 'SVP Software', age: 54, since: '2012', compensation: 26.9, shares: 85000, shareValue: 16.4, background: 'NeXT veteran, led macOS and iOS evolution.' },
      { name: "Deirdre O'Brien", title: 'SVP People & Retail', age: 56, since: '2019', compensation: 26.9, shares: 136000, shareValue: 26.2, background: '35+ years at Apple. Led retail transformation.' },
    ],
  },
  {
    symbol: 'MSFT', name: 'Microsoft', ceoTenure: 10, boardSize: 12, insiderOwnership: 1.38,
    executives: [
      { name: 'Satya Nadella', title: 'CEO & Chairman', age: 56, since: '2014', compensation: 48.5, shares: 860000, shareValue: 365.8, background: 'Transformed Microsoft to cloud-first. Led Azure and AI strategy.' },
      { name: 'Amy Hood', title: 'CFO', age: 52, since: '2013', compensation: 28.5, shares: 240000, shareValue: 102.1, background: 'Former Goldman Sachs. Longest-serving MSFT CFO.' },
      { name: 'Judson Althoff', title: 'Chief Commercial Officer', age: 50, since: '2017', compensation: 22.1, shares: 95000, shareValue: 40.4, background: 'Enterprise sales leader, Oracle and SAP veteran.' },
      { name: 'Brad Smith', title: 'Vice Chair & President', age: 64, since: '2015', compensation: 24.3, shares: 185000, shareValue: 78.7, background: 'Legal and policy leader, AI ethics champion.' },
    ],
  },
  {
    symbol: 'NVDA', name: 'NVIDIA', ceoTenure: 31, boardSize: 12, insiderOwnership: 3.5,
    executives: [
      { name: 'Jensen Huang', title: 'CEO & Co-Founder', age: 61, since: '1993', compensation: 34.2, shares: 86200000, shareValue: 75478, background: 'Co-founded NVIDIA. Visionary behind GPU computing and AI revolution.' },
      { name: 'Colette Kress', title: 'CFO', age: 56, since: '2013', compensation: 19.5, shares: 420000, shareValue: 367.7, background: 'Former Cisco, Microsoft finance. Led financial transformation.' },
      { name: 'Debora Shoquist', title: 'EVP Operations', age: 68, since: '2007', compensation: 14.8, shares: 210000, shareValue: 183.8, background: 'JDS Uniphase veteran, manufacturing expert.' },
    ],
  },
];

function generateManagement(symbol: string, name: string): CompanyManagement {
  const roles = ['CEO', 'CFO', 'COO', 'CTO', 'VP Operations'];
  const firstNames = ['James', 'Sarah', 'Michael', 'Emily', 'David'];
  const lastNames = ['Chen', 'Williams', 'Patel', 'Johnson', 'Garcia'];
  return {
    symbol, name,
    ceoTenure: Math.floor(Math.random() * 15 + 2),
    boardSize: Math.floor(Math.random() * 8 + 6),
    insiderOwnership: +(Math.random() * 5).toFixed(2),
    executives: roles.slice(0, Math.floor(Math.random() * 2) + 3).map((title, i) => ({
      name: `${firstNames[i]} ${lastNames[i]}`,
      title,
      age: Math.floor(Math.random() * 20 + 42),
      since: `${Math.floor(Math.random() * 10 + 2014)}`,
      compensation: +(Math.random() * 30 + 5).toFixed(1),
      shares: Math.floor(Math.random() * 500000 + 10000),
      shareValue: +(Math.random() * 100 + 5).toFixed(1),
      background: 'Industry veteran with extensive leadership experience.',
    })),
  };
}

const ManagementProfileViewer: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [companies, setCompanies] = useState<CompanyManagement[]>(isDemoMode ? defaultManagement : []);
  const [selectedCompany, setSelectedCompany] = useState<CompanyManagement | null>(null);
  const [selectedExec, setSelectedExec] = useState<Executive | null>(null);

  const handleAddStock = (symbol: string, name: string) => {
    const existing = companies.find(c => c.symbol === symbol);
    if (existing) { setSelectedCompany(existing); return; }
    const newCompany = generateManagement(symbol, name);
    setCompanies(prev => [...prev, newCompany]);
    setSelectedCompany(newCompany);
  };

  const handleRemoveCompany = (symbol: string) => {
    setCompanies(prev => prev.filter(c => c.symbol !== symbol));
    if (selectedCompany?.symbol === symbol) setSelectedCompany(null);
  };

  return (
    <div className="space-y-6 p-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Showing sample management data. Sign in for live profiles.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl"><Users className="w-6 h-6 text-primary" /></div>
          Management Profiles
        </h1>
        <p className="text-muted-foreground">Executive team, compensation & ownership analysis</p>
      </div>

      {/* Search & Add */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Add Company</span>
          </div>
          <div className="max-w-md">
            <StockSearchAutocomplete onSelect={handleAddStock} placeholder="Search & add company (e.g. AAPL, Tesla)..." />
          </div>
        </CardContent>
      </Card>

      {/* Company Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(company => {
          const totalComp = company.executives.reduce((s, e) => s + e.compensation, 0);
          return (
            <Card key={company.symbol} className="hover:border-primary/30 transition-all cursor-pointer group hover:shadow-md" onClick={() => setSelectedCompany(company)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-foreground">{company.symbol}</span>
                    <span className="text-xs text-muted-foreground">{company.name}</span>
                    {!defaultManagement.find(d => d.symbol === company.symbol) && (
                      <button onClick={e => { e.stopPropagation(); handleRemoveCompany(company.symbol); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center mb-3">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-[10px] text-muted-foreground">CEO Tenure</div>
                    <div className="text-sm font-bold text-foreground">{company.ceoTenure} yrs</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-[10px] text-muted-foreground">Insider Own</div>
                    <div className="text-sm font-bold text-foreground">{company.insiderOwnership}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" /> {company.executives.length} executives · ${totalComp.toFixed(0)}M total comp
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCompany} onOpenChange={() => { setSelectedCompany(null); setSelectedExec(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCompany && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{selectedCompany.symbol}</span>
                  <span className="text-muted-foreground text-base font-normal">{selectedCompany.name}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Calendar className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="text-xs text-muted-foreground">CEO Tenure</div>
                  <div className="text-lg font-bold text-foreground">{selectedCompany.ceoTenure} yrs</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Building2 className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="text-xs text-muted-foreground">Board Size</div>
                  <div className="text-lg font-bold text-foreground">{selectedCompany.boardSize}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="text-xs text-muted-foreground">Total Comp</div>
                  <div className="text-lg font-bold text-foreground">${selectedCompany.executives.reduce((s, e) => s + e.compensation, 0).toFixed(1)}M</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Award className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="text-xs text-muted-foreground">Insider Own</div>
                  <div className="text-lg font-bold text-foreground">{selectedCompany.insiderOwnership}%</div>
                </div>
              </div>

              <div className="space-y-2">
                {selectedCompany.executives.map(exec => {
                  const initials = exec.name.split(' ').map(n => n[0]).join('');
                  const isExpanded = selectedExec?.name === exec.name;
                  return (
                    <Card key={exec.name} className={`transition-all cursor-pointer hover:border-primary/30 ${isExpanded ? 'border-primary/30' : ''}`} onClick={() => setSelectedExec(isExpanded ? null : exec)}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">{exec.name}</span>
                              <Badge variant="secondary" className="text-[10px]">{exec.title}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Age {exec.age}</span>
                              <span>Since {exec.since}</span>
                              <span className="text-primary font-medium">${exec.compensation.toFixed(1)}M</span>
                            </div>
                          </div>
                          <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-foreground">{(exec.shares / 1000).toFixed(0)}K shares</div>
                            <div className="text-[10px] text-muted-foreground">
                              ${exec.shareValue >= 1000 ? `${(exec.shareValue / 1000).toFixed(1)}B` : `${exec.shareValue.toFixed(1)}M`}
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div className="bg-muted/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-muted-foreground uppercase">Compensation</div>
                                <div className="text-sm font-bold text-foreground">${exec.compensation.toFixed(1)}M</div>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-muted-foreground uppercase">Shares</div>
                                <div className="text-sm font-bold text-foreground">{exec.shares.toLocaleString()}</div>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-muted-foreground uppercase">Value</div>
                                <div className="text-sm font-bold text-foreground">
                                  ${exec.shareValue >= 1000 ? `${(exec.shareValue / 1000).toFixed(1)}B` : `${exec.shareValue.toFixed(1)}M`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-sm text-muted-foreground">{exec.background}</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagementProfileViewer;
