-- Ampliar el catálogo conserva los eventos existentes y permite guardar las
-- diez variantes hermanas incluidas en packages/contracts/src/index.ts.
ALTER TABLE events DROP CONSTRAINT events_theme_check;
ALTER TABLE events ADD CONSTRAINT events_theme_check CHECK (theme IN (
  'gold', 'neon', 'tropical', 'minimal', 'floral', 'kids',
  'winter', 'spring', 'autumn', 'silver', 'copper', 'disco',
  'starlight', 'sand', 'wildflower', 'pastel'
));
