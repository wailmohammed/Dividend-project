# Growth roadmap

## Done
- [x] Dividend insights: yield on cost, income concentration warning, financial-independence coverage
- [x] Installable app manifest (PWA)
- [x] Already existed: income forecast, benchmark, FIRE planner, sharing, DRIP, Zakat, onboarding tour
- [x] Dual return engine: TWR (chain-linked, Modified Dietz) + MWR/XIRR — `src/utils/returns.ts`, dashboard card
- [x] Ticker alias / corporate-action registry (broker suffixes, renames, mergers) — `src/lib/tickerAliases.ts`
- [x] Public SEO tool pages: /tools, Zakat calculator, halal screener, dividend calculator, TWR vs MWR guide
- [x] Real app-level head metadata + per-route SEO helper (`useSeo`)

- [x] Safety score history + public track record (/tools/safety-track-record)
- [x] "How safe is my income" summary on Dividend Safety
- [x] Score-change alerts into Portfolio Updates
- [x] Free per-stock pages /dividend/{ticker} with dividend-cut history chart
- [x] Already existed: snowflake, return attribution, alerts feed, tax reports, earnings calendar

## Next
- [ ] Credit ratings per stock (needs paid data source)
- [ ] Import trades by forwarding broker emails
- [ ] More broker syncs: IBKR, Saxo, Sarwa (need partner API access)
- [x] Arabic toggle + right-to-left layout (menu translated; page text translation ongoing)
- [x] Public leaderboard at /tools/leaderboard (opt-in, % only)
- [x] Currency vs real income split card on Dividends
- [ ] Fees, FX spreads and ETF expense-ratio drag shown in dollar terms
- [ ] Separate FX gain/loss from asset gain/loss for multi-currency portfolios
- [ ] Halal/Zakat engine as flagship: AAOIFI screening on live holdings + automated Zakat
- [ ] Weekly AI "what changed and why" digest
- [ ] Tax-lot intelligence: wash sales, FIFO/HIFO comparison, tax estimates
- [ ] Shareable public portfolio pages tuned for viral growth
- [ ] Mobile-first PWA polish + push notification improvements
- [ ] Split/spinoff share-ratio adjustments applied to holdings on sync
