-- Fill in proper company names and missing sectors for holdings that were
-- imported with the raw ticker as the display name.
UPDATE public.holdings AS h
SET name = v.name,
    sector = COALESCE(NULLIF(h.sector, ''), v.sector),
    updated_at = now()
FROM (VALUES
  ('ABBV','AbbVie Inc.','Healthcare'),
  ('ABT','Abbott Laboratories','Healthcare'),
  ('ASML','ASML Holding N.V.','Technology'),
  ('AVGO','Broadcom Inc.','Technology'),
  ('BBY','Best Buy Co., Inc.','Consumer Discretionary'),
  ('BKE','The Buckle, Inc.','Consumer Discretionary'),
  ('CVX','Chevron Corporation','Energy'),
  ('DDS','Dillard''s, Inc.','Consumer Discretionary'),
  ('DHT','DHT Holdings, Inc.','Energy'),
  ('EQIX','Equinix, Inc.','Real Estate'),
  ('INSW','International Seaways, Inc.','Energy'),
  ('JNJ','Johnson & Johnson','Healthcare'),
  ('KMB','Kimberly-Clark Corporation','Consumer Staples'),
  ('PEP','PepsiCo, Inc.','Consumer Staples'),
  ('PG','The Procter & Gamble Company','Consumer Staples'),
  ('RHI','Robert Half Inc.','Industrials'),
  ('RMR','The RMR Group Inc.','Real Estate'),
  ('SBR','Sabine Royalty Trust','Energy'),
  ('SPOK','Spok Holdings, Inc.','Communication Services'),
  ('VNOM','Viper Energy, Inc.','Energy'),
  ('VTS','Vitesse Energy, Inc.','Energy'),
  ('WSO','Watsco, Inc.','Industrials'),
  ('XOM','Exxon Mobil Corporation','Energy')
) AS v(symbol, name, sector)
WHERE upper(h.symbol) = v.symbol;