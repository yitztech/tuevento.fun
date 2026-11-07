-- Ampliar el catálogo sin invalidar los eventos existentes.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- squawk-ignore ban-drop-constraint
ALTER TABLE events DROP CONSTRAINT events_theme_check;
ALTER TABLE events ADD CONSTRAINT events_theme_check CHECK (theme IN (
  'gold',
  'neon',
  'tropical',
  'minimal',
  'floral',
  'kids',
  'winter',
  'spring',
  'autumn',
  'silver',
  'copper',
  'disco',
  'starlight',
  'sand',
  'wildflower',
  'pastel',
  'occasion-cumple-infantil-jardin',
  'occasion-cumple-infantil-mesa',
  'occasion-cumple-amigos-jardin',
  'occasion-cumple-amigos-picnic',
  'occasion-cumple-amigos-cena',
  'occasion-infantil-jardin',
  'occasion-infantil-pastel',
  'occasion-infantil-picnic',
  'occasion-infantil-arte',
  'occasion-infantil-safari',
  'occasion-infantil-arcoiris',
  'occasion-bodas-jardin',
  'occasion-minimalista-mesa',
  'occasion-minimalista-lino',
  'occasion-minimalista-terraza',
  'occasion-minimalista-brindis',
  'occasion-minimalista-pastel',
  'occasion-minimalista-jardin',
  'occasion-floral-fiesta',
  'occasion-elegante-cena',
  'occasion-celebracion-amigos'
)) NOT VALID;
