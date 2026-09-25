import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Activity, Zap, AlertCircle, Building2, Filter,
  RotateCcw, Save, Trash2, Bookmark, ChevronDown, Search, Pencil, Copy, Check, X,
  Download, Upload, FilePlus,
} from 'lucide-react';

interface FlowItem {
  symbol: string; type: 'CALL' | 'PUT'; side: 'BUY' | 'SELL';
  strike: number; expiry: string; premium: number; size: number;
  delta: number; unusual: boolean; block: boolean;
}

const EXPIRY_ORDER = ['Weekly', '30d', '60d', '90d'];
const PAGE_SIZE = 15;

interface FilterState {
  symbolFilter: string;
  typeFilter: 'ALL' | 'CALL' | 'PUT';
  expiryRange: [number, number];
  deltaRange: [number, number];
  minPremium: number;
  filter: 'all' | 'unusual' | 'block';
}

const defaultFilters: FilterState = {
  symbolFilter: '', typeFilter: 'ALL', expiryRange: [0, 3],
  deltaRange: [-1, 1], minPremium: 0, filter: 'all',
};

interface Preset { id: string; name: string; filters: FilterState; }

const OptionsFlowTracker = () => {
  const { user } = useAuth();
  const [state, setState] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const isDemoMode = !user || user.id === 'demo-user';

  // Load presets
  useEffect(() => {
    if (isDemoMode) {
      try {
        const raw = localStorage.getItem('options_flow_presets');
        if (raw) setPresets(JSON.parse(raw));
      } catch { /* noop */ }
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('options_flow_presets')
        .select('id, name, filters')
        .order('created_at', { ascending: false });
      if (!error && data) setPresets(data.map((d: any) => ({ id: d.id, name: d.name, filters: d.filters })));
    })();
  }, [isDemoMode, user?.id]);

  const persistPresetsLocal = (next: Preset[]) => {
    setPresets(next);
    try { localStorage.setItem('options_flow_presets', JSON.stringify(next)); } catch { /* noop */ }
  };

  const savePresetWithName = async (rawName: string) => {
    const name = rawName.trim().slice(0, 40);
    if (!name) { toast.error('Preset name required'); return; }
    if (isDemoMode) {
      const next = [{ id: crypto.randomUUID(), name, filters: state }, ...presets].slice(0, 20);
      persistPresetsLocal(next);
      toast.success(`Preset "${name}" saved (demo)`);
      return;
    }
    const { data, error } = await supabase
      .from('options_flow_presets')
      .insert({ user_id: user!.id, name, filters: state as any })
      .select('id, name, filters').single();
    if (error) { toast.error('Failed to save preset'); return; }
    setPresets((p) => [{ id: data.id, name: data.name, filters: data.filters as any }, ...p]);
    toast.success(`Preset "${name}" saved`);
  };

  const savePreset = async () => {
    await savePresetWithName(presetName);
    setPresetName('');
  };

  const saveAsNewPreset = async () => {
    const suggested = `Preset ${presets.length + 1}`;
    const name = window.prompt('Name for the new preset:', suggested);
    if (name === null) return;
    await savePresetWithName(name);
  };

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setState({ ...defaultFilters, ...p.filters });
    setSelectedPreset(id);
    setPage(1);
    toast.success(`Loaded "${p.name}"`);
  };

  const [confirmDelete, setConfirmDelete] = useState<Preset | null>(null);

  const deletePreset = async (id: string) => {
    if (isDemoMode) {
      persistPresetsLocal(presets.filter((p) => p.id !== id));
      toast.success('Preset removed');
    } else {
      const { error } = await supabase.from('options_flow_presets').delete().eq('id', id);
      if (error) { toast.error('Failed to remove'); return; }
      setPresets((p) => p.filter((x) => x.id !== id));
      toast.success('Preset removed');
    }
    if (selectedPreset === id) setSelectedPreset('');
  };

  const EXPORT_VERSION = 2;
  const exportPresets = () => {
    if (presets.length === 0) { toast.error('No presets to export'); return; }
    const payload = {
      app: 'options-flow-presets',
      version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      presets: presets.map((p) => ({ name: p.name, filters: p.filters })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `options-flow-presets-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${presets.length} preset(s)`);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null); // unused placeholder kept for parity
  type ConflictAction = 'overwrite' | 'keep-both' | 'skip';
  type StagedValid = {
    name: string;
    filters: FilterState;
    conflict: boolean;
    conflictAction: ConflictAction;
    migratedFields: string[];
  };
  const [pendingImport, setPendingImport] = useState<{
    valid: StagedValid[];
    invalid: { index: number; reason: string; name?: string }[];
    sourceVersion: number;
    migrated: boolean;
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Detailed v1→v2 field mapping registry used in preview breakdown
  const FIELD_MAP_V1_V2: Record<string, { from: string; to: string; note?: string }> = {
    'minPrem→minPremium': { from: 'minPrem', to: 'minPremium' },
    'side→sentiment': { from: 'side', to: 'sentiment' },
    'expiry→expiryRange': { from: 'expiry', to: 'expiryRange', note: 'single value → range' },
    'delta→deltaRange (reset)': { from: 'delta', to: 'deltaRange', note: 'reset to defaults' },
  };

  const migratePreset = (
    raw: any,
    sourceVersion: number,
  ): { filters?: FilterState; migratedFields: string[] } => {
    if (!raw || typeof raw !== 'object') return { migratedFields: [] };
    const f: any = { ...raw };
    const migratedFields: string[] = [];
    if (sourceVersion < 2) {
      if ('minPrem' in f && !('minPremium' in f)) {
        f.minPremium = f.minPrem; delete f.minPrem;
        migratedFields.push('minPrem→minPremium');
      }
      if ('side' in f && !('sentiment' in f)) {
        f.sentiment = f.side; delete f.side;
        migratedFields.push('side→sentiment');
      }
      if ('expiry' in f && !('expiryRange' in f)) {
        // legacy single-value expiry → range
        const v = Number(f.expiry);
        if (!Number.isNaN(v)) f.expiryRange = [0, Math.max(0, Math.min(3, v))];
        delete f.expiry;
        migratedFields.push('expiry→expiryRange');
      }
      if ('delta' in f && !('deltaRange' in f)) {
        delete f.delta;
        migratedFields.push('delta→deltaRange (reset)');
      }
    }
    return { filters: { ...defaultFilters, ...f } as FilterState, migratedFields };
  };

  const stageImport = async (file: File) => {
    if (!file) return;
    setSelectedFileName(file.name);
    const fail = (msg: string) => { setDropError(msg); toast.error(msg); };
    if (file.size > 2 * 1024 * 1024) {
      return fail(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB) — max 2MB`);
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.json') && file.type && !file.type.includes('json')) {
      return fail(`Invalid file type "${file.type || 'unknown'}" — please choose a .json file`);
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: any[] = Array.isArray(parsed) ? parsed : parsed?.presets;
      const sourceVersion: number = typeof parsed?.version === 'number' ? parsed.version : 1;
      if (!Array.isArray(list)) return fail('Invalid file format');
      if (sourceVersion > EXPORT_VERSION) {
        return fail(`Export version ${sourceVersion} is newer than supported (${EXPORT_VERSION})`);
      }
      const valid: StagedValid[] = [];
      const invalid: { index: number; reason: string; name?: string }[] = [];
      let anyMigrated = false;
      const existingNames = new Set(presets.map((p) => p.name.toLowerCase()));
      list.forEach((p, i) => {
        if (!p || typeof p !== 'object') { invalid.push({ index: i, reason: 'Not an object' }); return; }
        if (typeof p.name !== 'string' || !p.name.trim()) { invalid.push({ index: i, reason: 'Missing name' }); return; }
        if (!p.filters || typeof p.filters !== 'object') { invalid.push({ index: i, reason: 'Missing filters', name: p.name }); return; }
        const { filters, migratedFields } = migratePreset(p.filters, sourceVersion);
        if (!filters) { invalid.push({ index: i, reason: 'Could not migrate filters', name: p.name }); return; }
        if (migratedFields.length > 0) anyMigrated = true;
        const name = String(p.name).slice(0, 40);
        const conflict = existingNames.has(name.toLowerCase());
        valid.push({
          name, filters, conflict, migratedFields,
          conflictAction: conflict ? 'overwrite' : 'overwrite',
        });
      });
      if (valid.length === 0 && invalid.length === 0) return fail('File is empty');
      setDropError(null);
      setExpandedRows(new Set());
      setImportMode('merge');
      setPendingImport({ valid, invalid, sourceVersion, migrated: anyMigrated });
    } catch {
      fail('Could not parse file — invalid JSON');
    }
  };

  const setRowConflictAction = (i: number, action: ConflictAction) => {
    setPendingImport((cur) => {
      if (!cur) return cur;
      const next = [...cur.valid];
      next[i] = { ...next[i], conflictAction: action };
      return { ...cur, valid: next };
    });
  };

  const uniqueName = (base: string, taken: Set<string>) => {
    let n = `${base} (imported)`;
    let i = 2;
    while (taken.has(n.toLowerCase())) { n = `${base} (imported ${i})`; i++; }
    return n.slice(0, 40);
  };

  const commitImport = async (mode: 'merge' | 'replace') => {
    if (!pendingImport) return;
    const invalid = pendingImport.invalid;
    const skipped = invalid.length;
    const previousCount = presets.length;

    // Resolve conflicts
    const taken = new Set<string>(
      mode === 'replace' ? [] : presets.map((p) => p.name.toLowerCase()),
    );
    const toInsert: { name: string; filters: FilterState }[] = [];
    const toOverwriteByName: { name: string; filters: FilterState }[] = [];
    const skippedByConflict: string[] = [];

    for (const v of pendingImport.valid) {
      if (mode === 'replace' || !v.conflict) {
        toInsert.push({ name: v.name, filters: v.filters });
        taken.add(v.name.toLowerCase());
        continue;
      }
      if (v.conflictAction === 'skip') { skippedByConflict.push(v.name); continue; }
      if (v.conflictAction === 'overwrite') {
        toOverwriteByName.push({ name: v.name, filters: v.filters });
        continue;
      }
      // keep-both
      const name = uniqueName(v.name, taken);
      toInsert.push({ name, filters: v.filters });
      taken.add(name.toLowerCase());
    }

    setPendingImport(null);
    const totalApplied = toInsert.length + toOverwriteByName.length;
    if (totalApplied === 0) { toast.error('Nothing to import after conflict resolution'); return; }

    const parts: string[] = [];
    if (skipped > 0) parts.push(`Skipped ${skipped} invalid: ${invalid.slice(0, 4).map((v) => `${v.name ? `"${v.name}"` : `#${v.index + 1}`} (${v.reason})`).join(', ')}${invalid.length > 4 ? `, +${invalid.length - 4} more` : ''}`);
    if (skippedByConflict.length > 0) parts.push(`Skipped ${skippedByConflict.length} on conflict: ${skippedByConflict.slice(0, 4).map((n) => `"${n}"`).join(', ')}${skippedByConflict.length > 4 ? `, +${skippedByConflict.length - 4} more` : ''}`);
    const description = parts.length > 0 ? parts.join(' • ') : undefined;

    const successMsg = mode === 'replace'
      ? `Replaced ${previousCount} preset(s) with ${totalApplied} imported preset(s)`
      : `Merged ${toInsert.length} new + ${toOverwriteByName.length} overwritten preset(s)`;

    if (isDemoMode) {
      const overwriteNames = new Set(toOverwriteByName.map((p) => p.name.toLowerCase()));
      const baseList = mode === 'replace'
        ? []
        : presets.filter((p) => !overwriteNames.has(p.name.toLowerCase()));
      const overwritten = toOverwriteByName.map((p) => ({ id: crypto.randomUUID(), name: p.name, filters: p.filters }));
      const inserted = toInsert.map((p) => ({ id: crypto.randomUUID(), name: p.name, filters: p.filters }));
      const next = [...inserted, ...overwritten, ...baseList].slice(0, 50);
      persistPresetsLocal(next);
      toast.success(successMsg, description ? { description } : undefined);
      return;
    }

    if (mode === 'replace') {
      const { error: delErr } = await supabase.from('options_flow_presets').delete().eq('user_id', user!.id);
      if (delErr) { toast.error('Replace failed'); return; }
    } else if (toOverwriteByName.length > 0) {
      const { error: delErr } = await supabase
        .from('options_flow_presets')
        .delete()
        .eq('user_id', user!.id)
        .in('name', toOverwriteByName.map((p) => p.name));
      if (delErr) { toast.error('Overwrite step failed'); return; }
    }
    const rows = [...toOverwriteByName, ...toInsert].map((v) => ({ user_id: user!.id, name: v.name, filters: v.filters as any }));
    const { data, error } = await supabase.from('options_flow_presets').insert(rows).select('id, name, filters');
    if (error) { toast.error('Import failed'); return; }
    const inserted = (data as any[]).map((d) => ({ id: d.id, name: d.name, filters: d.filters }));
    if (mode === 'replace') {
      setPresets(inserted);
    } else {
      const overwriteNames = new Set(toOverwriteByName.map((p) => p.name.toLowerCase()));
      setPresets((p) => [...inserted, ...p.filter((x) => !overwriteNames.has(x.name.toLowerCase()))]);
    }
    toast.success(successMsg, description ? { description } : undefined);
  };


  const renamePreset = async (id: string, newName: string) => {
    const name = newName.trim().slice(0, 40);
    if (!name) { toast.error('Name required'); return; }
    if (isDemoMode) {
      persistPresetsLocal(presets.map((p) => p.id === id ? { ...p, name } : p));
      toast.success('Preset renamed');
      return;
    }
    const { error } = await supabase.from('options_flow_presets').update({ name }).eq('id', id);
    if (error) { toast.error('Rename failed'); return; }
    setPresets((p) => p.map((x) => x.id === id ? { ...x, name } : x));
    toast.success('Preset renamed');
  };

  const duplicatePreset = async (id: string) => {
    const src = presets.find((p) => p.id === id);
    if (!src) return;
    const name = `${src.name} (copy)`.slice(0, 40);
    if (isDemoMode) {
      const next = [{ id: crypto.randomUUID(), name, filters: src.filters }, ...presets].slice(0, 20);
      persistPresetsLocal(next);
      toast.success('Preset duplicated');
      return;
    }
    const { data, error } = await supabase
      .from('options_flow_presets')
      .insert({ user_id: user!.id, name, filters: src.filters as any })
      .select('id, name, filters').single();
    if (error) { toast.error('Duplicate failed'); return; }
    setPresets((p) => [{ id: data.id, name: data.name, filters: data.filters as any }, ...p]);
    toast.success('Preset duplicated');
  };

  const [presetSearch, setPresetSearch] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const filteredPresets = useMemo(
    () => presets.filter((p) => p.name.toLowerCase().includes(presetSearch.toLowerCase())),
    [presets, presetSearch]
  );

  const resetFilters = () => { setState(defaultFilters); setSelectedPreset(''); setPage(1); };

  // No verified options trades feed is connected; never synthesize institutional flow.
  const flow = useMemo<FlowItem[]>(() => [], []);

  const stats = useMemo(() => {
    const callPrem = flow.filter((f) => f.type === 'CALL').reduce((s, f) => s + f.premium, 0);
    const putPrem = flow.filter((f) => f.type === 'PUT').reduce((s, f) => s + f.premium, 0);
    const total = callPrem + putPrem || 1;
    return {
      callPrem, putPrem, callPct: (callPrem / total) * 100, putPct: (putPrem / total) * 100,
      blockCount: flow.filter((f) => f.block).length,
      unusualCount: flow.filter((f) => f.unusual).length,
      bullish: callPrem > putPrem,
    };
  }, [flow]);

  const filtered = useMemo(() => {
    return flow.filter((f) => {
      if (state.filter === 'unusual' && !f.unusual) return false;
      if (state.filter === 'block' && !f.block) return false;
      if (state.typeFilter !== 'ALL' && f.type !== state.typeFilter) return false;
      if (state.symbolFilter && !f.symbol.toLowerCase().includes(state.symbolFilter.toLowerCase())) return false;
      const ei = EXPIRY_ORDER.indexOf(f.expiry);
      if (ei < state.expiryRange[0] || ei > state.expiryRange[1]) return false;
      if (f.delta < state.deltaRange[0] || f.delta > state.deltaRange[1]) return false;
      if (f.premium < state.minPremium) return false;
      return true;
    });
  }, [flow, state]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [state]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = page < totalPages;

  const activeFilterCount =
    (state.symbolFilter ? 1 : 0) +
    (state.typeFilter !== 'ALL' ? 1 : 0) +
    (state.expiryRange[0] !== 0 || state.expiryRange[1] !== 3 ? 1 : 0) +
    (state.deltaRange[0] !== -1 || state.deltaRange[1] !== 1 ? 1 : 0) +
    (state.minPremium > 0 ? 1 : 0);

  const setS = (patch: Partial<FilterState>) => setState((s) => ({ ...s, ...patch }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="w-7 h-7 text-primary" /> Options Flow Tracker
        </h1>
        <p className="text-muted-foreground mt-1">
          Options trades with verified exchange data, timestamps, and contract details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-warning" />Options flow feed unavailable</CardTitle>
          <p className="text-sm text-muted-foreground">Connect a verified options data provider before showing call/put pressure, unusual activity, or block-trade signals.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">No live trade records are currently available.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total Premium Tracked</div>
          <div className="text-2xl font-bold mt-1">—</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Unusual Activity</div>
          <div className="text-2xl font-bold mt-1 text-warning">—</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Block Trades</div>
          <div className="text-2xl font-bold mt-1 text-primary">—</div>
        </CardContent></Card>
      </div>

      {/* Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bookmark className="w-4 h-4" /> Filter Presets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={presetName} maxLength={40}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Save current filters as…" className="h-9"
            />
            <Button size="sm" className="h-9 gap-1" onClick={savePreset}>
              <Save className="w-3 h-3" /> Save
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={saveAsNewPreset}>
              <FilePlus className="w-3 h-3" /> Save as new preset
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={exportPresets}>
              <Download className="w-3 h-3" /> Export JSON
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3 h-3" /> Import JSON
            </Button>
            <input
              ref={fileInputRef} type="file" accept="application/json,.json" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setDropError(null);
                if (f) stageImport(f);
                e.target.value = '';
              }}
            />
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              stageImport(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={`cursor-pointer rounded border border-dashed px-3 py-3 text-center text-xs transition-colors ${
              dropError
                ? 'border-destructive bg-destructive/10 text-destructive'
                : isDragging
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground'
            }`}
          >
            <Upload className="inline w-3 h-3 mr-1 -mt-0.5" />
            {isDragging
              ? 'Drop your presets JSON here…'
              : selectedFileName
              ? <>Selected: <span className="font-mono text-foreground">{selectedFileName}</span></>
              : 'Drag & drop a presets .json here, or click to browse'}
            {dropError && (
              <div className="mt-1 text-[11px] font-medium">{dropError}</div>
            )}
            {!dropError && selectedFileName && (
              <div className="mt-1 text-[10px] text-muted-foreground">Click or drop another file to replace</div>
            )}
          </div>

          {presets.length > 0 && (
            <>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder={`Search ${presets.length} preset${presets.length === 1 ? '' : 's'}…`}
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredPresets.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No presets match "{presetSearch}".</p>
                ) : filteredPresets.map((p) => (
                  <div key={p.id} className={`flex items-center gap-1 border rounded-md px-2 py-1.5 ${selectedPreset === p.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}>
                    {editingPresetId === p.id ? (
                      <>
                        <Input value={editName} maxLength={40} onChange={(e) => setEditName(e.target.value)} className="h-7 text-xs flex-1" autoFocus />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { renamePreset(p.id, editName); setEditingPresetId(null); }}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingPresetId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => applyPreset(p.id)} className="flex-1 text-left text-xs font-medium truncate hover:text-primary">
                          {p.name}
                        </button>
                        <button title="Rename" onClick={() => { setEditingPresetId(p.id); setEditName(p.name); }} className="text-muted-foreground hover:text-primary p-1">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button title="Duplicate" onClick={() => duplicatePreset(p.id)} className="text-muted-foreground hover:text-primary p-1">
                          <Copy className="w-3 h-3" />
                        </button>
                        <button title="Delete" onClick={() => setConfirmDelete(p)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {isDemoMode && <p className="text-[10px] text-muted-foreground">Demo mode: presets stored locally in this browser.</p>}
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" /> Advanced Filters
              {activeFilterCount > 0 && <Badge variant="secondary" className="text-[10px]">{activeFilterCount} active</Badge>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 gap-1 text-xs">
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Symbol search</Label>
            <Input value={state.symbolFilter} maxLength={10}
              onChange={(e) => setS({ symbolFilter: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
              placeholder="e.g. AAPL" className="mt-1 h-8" />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <div className="flex gap-1 mt-1">
              {(['ALL', 'CALL', 'PUT'] as const).map((t) => (
                <Button key={t} size="sm" variant={state.typeFilter === t ? 'default' : 'outline'} className="h-8 flex-1 text-xs" onClick={() => setS({ typeFilter: t })}>{t}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Expiry: {EXPIRY_ORDER[state.expiryRange[0]]} → {EXPIRY_ORDER[state.expiryRange[1]]}</Label>
            <Slider min={0} max={3} step={1} value={state.expiryRange} onValueChange={(v) => setS({ expiryRange: [v[0], v[1]] as [number, number] })} className="mt-3" />
          </div>
          <div>
            <Label className="text-xs">Delta range: {state.deltaRange[0].toFixed(2)} → {state.deltaRange[1].toFixed(2)}</Label>
            <Slider min={-1} max={1} step={0.05} value={state.deltaRange} onValueChange={(v) => setS({ deltaRange: [v[0], v[1]] as [number, number] })} className="mt-3" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Minimum premium: ${(state.minPremium / 1000).toFixed(0)}K</Label>
            <Slider min={0} max={1000000} step={10000} value={[state.minPremium]} onValueChange={(v) => setS({ minPremium: v[0] })} className="mt-3" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Tabs value={state.filter} onValueChange={(v) => setS({ filter: v as any })}>
            <TabsList>
              <TabsTrigger value="all">All Flow ({filtered.length})</TabsTrigger>
              <TabsTrigger value="unusual">Unusual ({stats.unusualCount})</TabsTrigger>
              <TabsTrigger value="block">Blocks ({stats.blockCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">Symbol</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">Side</th>
                  <th className="text-right py-2 px-2">Strike</th>
                  <th className="text-left py-2 px-2">Expiry</th>
                  <th className="text-right py-2 px-2">Premium</th>
                  <th className="text-right py-2 px-2">Delta</th>
                  <th className="text-left py-2 px-2">Tags</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((f, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 font-semibold">{f.symbol}</td>
                    <td className="py-2 px-2"><Badge variant={f.type === 'CALL' ? 'default' : 'destructive'} className="text-[10px]">{f.type}</Badge></td>
                    <td className="py-2 px-2"><span className={f.side === 'BUY' ? 'text-success' : 'text-destructive'}>{f.side}</span></td>
                    <td className="py-2 px-2 text-right">${f.strike.toFixed(2)}</td>
                    <td className="py-2 px-2 text-muted-foreground">{f.expiry}</td>
                    <td className="py-2 px-2 text-right font-mono">${(f.premium / 1000).toFixed(0)}K</td>
                    <td className="py-2 px-2 text-right">{f.delta.toFixed(2)}</td>
                    <td className="py-2 px-2 space-x-1">
                      {f.unusual && <Badge variant="outline" className="text-[9px] border-warning text-warning">UNUSUAL</Badge>}
                      {f.block && <Badge variant="outline" className="text-[9px] border-primary text-primary">BLOCK</Badge>}
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">No verified options feed is connected. No sample trades are shown.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {pageItems.length} of {filtered.length}
            </span>
            <Button size="sm" variant="outline" disabled={!hasMore} onClick={() => setPage((p) => p + 1)} className="gap-1">
              <ChevronDown className="w-3 h-3" /> Load more
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{confirmDelete?.name}". You can't undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDelete) { deletePreset(confirmDelete.id); setConfirmDelete(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingImport}
        onOpenChange={(o) => {
          if (!o) {
            setPendingImport(null);
            setExpandedRows(new Set());
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Import preview — {pendingImport?.valid.length ?? 0} valid
              {pendingImport && pendingImport.invalid.length > 0 ? `, ${pendingImport.invalid.length} invalid` : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingImport && (
                <>
                  Source version <span className="font-mono">v{pendingImport.sourceVersion}</span>
                  {pendingImport.sourceVersion < EXPORT_VERSION ? ` → migrated to v${EXPORT_VERSION}` : ''}
                  {pendingImport.migrated ? ' (some fields converted)' : ''}.
                  {' '}Toggle Merge/Replace below to preview the per-preset action.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingImport && (() => {
            const isReplace = importMode === 'replace';
            // Live conflict summary
            let overwriteN = 0, keepBothN = 0, skipN = 0, addN = 0, replaceN = 0;
            for (const v of pendingImport.valid) {
              if (isReplace) { replaceN++; continue; }
              if (!v.conflict) { addN++; continue; }
              if (v.conflictAction === 'overwrite') overwriteN++;
              else if (v.conflictAction === 'keep-both') keepBothN++;
              else skipN++;
            }
            const conflictRows = pendingImport.valid.filter((v) => v.conflict).length;
            const Chip = ({ label, n, cls }: { label: string; n: number; cls: string }) => (
              <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>
                {label}: <span className="font-mono">{n}</span>
              </span>
            );
            return (
              <>
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`flex-1 rounded border px-2 py-1 ${importMode === 'merge' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
                  >
                    Merge
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`flex-1 rounded border px-2 py-1 ${importMode === 'replace' ? 'bg-destructive text-destructive-foreground border-destructive' : 'border-border'}`}
                  >
                    Replace all
                  </button>
                </div>

                {/* Live conflict summary */}
                <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                  <div className="text-[11px] font-medium text-muted-foreground mb-1.5">Summary based on current selections</div>
                  <div className="flex flex-wrap gap-1.5">
                    {isReplace ? (
                      <Chip label="Replace" n={replaceN} cls="bg-destructive/15 text-destructive" />
                    ) : (
                      <>
                        <Chip label="Add as new" n={addN} cls="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
                        <Chip label="Overwrite" n={overwriteN} cls="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
                        <Chip label="Keep both" n={keepBothN} cls="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
                        <Chip label="Skip" n={skipN} cls="bg-muted text-muted-foreground" />
                      </>
                    )}
                    {pendingImport.invalid.length > 0 && (
                      <Chip label="Invalid" n={pendingImport.invalid.length} cls="bg-destructive/10 text-destructive" />
                    )}
                  </div>
                </div>

                {/* Bulk conflict control (always visible when conflicts exist, in either mode) */}
                {conflictRows > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-medium text-foreground">
                        Bulk action for {conflictRows} duplicate-name preset{conflictRows === 1 ? '' : 's'}
                      </span>
                      {isReplace && (
                        <span className="text-muted-foreground italic">Applies once you switch to Merge</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {(['overwrite', 'keep-both', 'skip'] as ConflictAction[]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setPendingImport((cur) => cur ? {
                            ...cur,
                            valid: cur.valid.map((v) => v.conflict ? { ...v, conflictAction: a } : v),
                          } : cur)}
                          className="rounded border border-border bg-background px-2 py-0.5 text-foreground hover:bg-accent"
                        >
                          Apply "{a === 'keep-both' ? 'Keep both' : a.charAt(0).toUpperCase() + a.slice(1)}" to all
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="max-h-72 overflow-y-auto space-y-2 text-xs">
                  {pendingImport.valid.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-emerald-500">
                          Will be imported ({pendingImport.valid.length}) — mode: {importMode}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setExpandedRows(new Set(pendingImport.valid.slice(0, 30).map((_, idx) => idx)))}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Expand all
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedRows(new Set())}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Collapse all
                          </button>
                        </div>
                      </div>
                      <ul className="space-y-1 pl-1">
                        {pendingImport.valid.slice(0, 30).map((v, i) => {
                          let badgeText: string;
                          let badgeClass: string;
                          if (isReplace) {
                            badgeText = 'Replace';
                            badgeClass = 'bg-destructive/15 text-destructive';
                          } else if (!v.conflict) {
                            badgeText = 'Add';
                            badgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
                          } else {
                            badgeText = v.conflictAction === 'overwrite'
                              ? 'Overwrite'
                              : v.conflictAction === 'keep-both' ? 'Keep both' : 'Skip';
                            badgeClass = v.conflictAction === 'skip'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
                          }
                          const expanded = expandedRows.has(i);
                          const hasMigration = v.migratedFields.length > 0;
                          return (
                            <li key={i} className="rounded border border-border/60 px-2 py-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandedRows((cur) => {
                                    const next = new Set(cur);
                                    if (next.has(i)) next.delete(i); else next.add(i);
                                    return next;
                                  })}
                                  className="flex items-center gap-1 text-foreground truncate hover:underline"
                                >
                                  <span className="text-muted-foreground">{expanded ? '▾' : '▸'}</span>
                                  <span className="truncate">{v.name}</span>
                                  {hasMigration && (
                                    <span className="ml-1 rounded bg-blue-500/15 px-1 py-0.5 text-[9px] text-blue-600 dark:text-blue-400">
                                      v{pendingImport.sourceVersion}→v{EXPORT_VERSION}
                                    </span>
                                  )}
                                </button>
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${badgeClass}`}>{badgeText}</span>
                              </div>

                              {expanded && (
                                <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                                  <div className="text-[10px] font-medium text-muted-foreground">
                                    Migration breakdown (v{pendingImport.sourceVersion} → v{EXPORT_VERSION})
                                  </div>
                                  {hasMigration ? (
                                    <ul className="space-y-1">
                                      {v.migratedFields.map((mf, mi) => {
                                        const m = FIELD_MAP_V1_V2[mf];
                                        const from = m?.from ?? mf.split('→')[0];
                                        const to = m?.to ?? mf.split('→')[1] ?? '';
                                        const note = m?.note;
                                        const isReset = mf.includes('reset');
                                        return (
                                          <li key={mi} className="flex flex-wrap items-center gap-1 text-[10px]">
                                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground line-through">{from}</span>
                                            <span className="text-muted-foreground">→</span>
                                            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400">{to}</span>
                                            {(note || isReset) && (
                                              <span className={`text-[10px] italic ${isReset ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                                ({note ?? 'reset'})
                                              </span>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : (
                                    <div className="text-[10px] text-muted-foreground italic">No field changes — schema already current.</div>
                                  )}
                                </div>
                              )}

                              {!isReplace && v.conflict && (
                                <div className="mt-1 flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">On conflict:</span>
                                  {(['overwrite', 'keep-both', 'skip'] as ConflictAction[]).map((a) => (
                                    <button
                                      key={a}
                                      type="button"
                                      onClick={() => setRowConflictAction(i, a)}
                                      className={`rounded px-1.5 py-0.5 text-[10px] border ${
                                        v.conflictAction === a
                                          ? 'bg-foreground text-background border-foreground'
                                          : 'border-border text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      {a === 'keep-both' ? 'Keep both' : a.charAt(0).toUpperCase() + a.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </li>
                          );
                        })}
                        {pendingImport.valid.length > 30 && (
                          <li className="text-muted-foreground italic">…and {pendingImport.valid.length - 30} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {pendingImport.invalid.length > 0 && (
                    <div>
                      <div className="font-medium text-destructive mb-1">Skipped — invalid ({pendingImport.invalid.length})</div>
                      <ul className="space-y-0.5 pl-3 list-disc">
                        {pendingImport.invalid.slice(0, 20).map((v, i) => (
                          <li key={i} className="text-muted-foreground">
                            <span className="text-foreground">#{v.index + 1}{v.name ? ` "${v.name}"` : ''}</span> — {v.reason}
                          </li>
                        ))}
                        {pendingImport.invalid.length > 20 && (
                          <li className="text-muted-foreground italic">…and {pendingImport.invalid.length - 20} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Final confirmation line */}
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-foreground">
                  <span className="font-medium">On confirm:</span>{' '}
                  {isReplace ? (
                    <>Replace existing library with <span className="font-mono">{replaceN}</span> preset(s).</>
                  ) : (
                    <>
                      Add <span className="font-mono">{addN}</span> new
                      {' · '}Overwrite <span className="font-mono">{overwriteN}</span>
                      {' · '}Keep both <span className="font-mono">{keepBothN}</span>
                      {' · '}Skip <span className="font-mono">{skipN}</span>
                    </>
                  )}
                  {pendingImport.invalid.length > 0 && (
                    <> · Invalid <span className="font-mono">{pendingImport.invalid.length}</span></>
                  )}
                </div>
              </>
            );
          })()}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={importMode === 'replace' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              disabled={!pendingImport || pendingImport.valid.length === 0}
              onClick={() => commitImport(importMode)}
            >
              Confirm {importMode === 'replace' ? 'Replace' : 'Merge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OptionsFlowTracker;
