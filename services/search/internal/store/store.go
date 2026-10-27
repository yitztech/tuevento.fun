// Package store consulta provider_search (solo lectura, rol search_ro).
package store

import (
	"context"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Point es un punto en el mapa (WGS 84).
type Point struct{ Lat, Lng float64 }

// Cursor es el valor de orden y el id del último resultado de una página.
type Cursor struct {
	Value float64
	ID    string
}

// Query es una búsqueda ya validada.
type Query struct {
	Text       string
	Categories []string
	Point      *Point
	RadiusKm   float64
	Sort       string // relevance | distance
	Limit      int
	After      *Cursor
	// Categorías cuyo nombre coincide con el texto: cuentan como coincidencia y suben en el orden
	Boost []string
}

// Price es el precio «desde» más bajo de sus servicios.
type Price struct {
	FromCents int64  `json:"fromCents"`
	Currency  string `json:"currency"`
}

// Card es un resultado, como ProviderCard en packages/contracts.
type Card struct {
	Slug         string   `json:"slug"`
	BusinessName string   `json:"businessName"`
	Headline     string   `json:"headline"`
	City         string   `json:"city"`
	Region       string   `json:"region"`
	Categories   []string `json:"categories"`
	CoverURL     *string  `json:"coverUrl"`
	PriceFrom    *Price   `json:"priceFrom"`
	DistanceKm   *float64 `json:"distanceKm"`
}

// Store envuelve el pool de conexiones.
type Store struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Filas candidatas: texto (palabras, nombre parecido o categoría nombrada) y recuadro alrededor
// del punto, que usa el índice antes de calcular la distancia exacta.
const scored = `
WITH input AS (
  SELECT websearch_to_tsquery('simple', f_unaccent($1)) AS tsq, lower(f_unaccent($1)) AS qn
), scored AS (
  SELECT ps.provider_id, ps.slug, ps.business_name, ps.headline, ps.city, ps.region, ps.categories,
    ps.cover_image_id, ps.price_from_cents, ps.currency,
    CASE WHEN $1 = '' THEN 0::float8 ELSE (
      ts_rank_cd(ps.document, i.tsq)::float8 + similarity(ps.name_norm, i.qn)::float8
      + CASE WHEN ps.categories && $2::text[] THEN 0.5 ELSE 0 END
    ) END AS score,
    CASE WHEN $3::float8 IS NULL THEN NULL ELSE 6371 * 2 * asin(sqrt(
      power(sin(radians(ps.latitude - $3::float8) / 2), 2)
      + cos(radians($3::float8)) * cos(radians(ps.latitude)) * power(sin(radians(ps.longitude - $4::float8) / 2), 2)
    )) END AS distance
  FROM provider_search ps, input i
  WHERE ($1 = '' OR ps.document @@ i.tsq OR ps.name_norm % i.qn OR ps.categories && $2::text[])
    AND ($3::float8 IS NULL OR (
      ps.latitude BETWEEN $3::float8 - $6::float8 AND $3::float8 + $6::float8
      AND ps.longitude BETWEEN $4::float8 - $7::float8 AND $4::float8 + $7::float8
    ))
)`

// Search devuelve una página, el cursor de la siguiente (o nil) y cuántos hay por categoría.
func (s *Store) Search(ctx context.Context, q Query) ([]Card, *Cursor, map[string]int, error) {
	var lat, lng *float64
	dLat, dLng := 0.0, 0.0
	if q.Point != nil {
		lat, lng = &q.Point.Lat, &q.Point.Lng
		dLat = q.RadiusKm / 111.32
		// Cerca de los polos el recuadro abarca todas las longitudes
		if c := math.Cos(q.Point.Lat * math.Pi / 180); c > 0.01 {
			dLng = math.Min(180, q.RadiusKm/(111.32*c))
		} else {
			dLng = 180
		}
	}
	boost := q.Boost
	if boost == nil {
		boost = []string{}
	}
	categories := q.Categories
	if categories == nil {
		categories = []string{}
	}
	args := []any{q.Text, boost, lat, lng, q.RadiusKm, dLat, dLng, categories}
	order, after := "score DESC, provider_id", "(score < $9 OR (score = $9 AND provider_id > $10::uuid))"
	if q.Sort == "distance" {
		order, after = "distance, provider_id", "(distance > $9 OR (distance = $9 AND provider_id > $10::uuid))"
	}
	where := "($3::float8 IS NULL OR distance <= $5::float8) AND (cardinality($8::text[]) = 0 OR categories && $8::text[])"
	if q.After != nil {
		where += " AND " + after
		args = append(args, q.After.Value, q.After.ID)
	}
	sql := fmt.Sprintf(`%s
SELECT provider_id::text, slug, business_name, headline, city, region, categories, cover_image_id::text,
  price_from_cents, currency, score, distance
FROM scored WHERE %s ORDER BY %s LIMIT %d`, scored, where, order, q.Limit+1)
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, nil, nil, err
	}
	type row struct {
		card  Card
		id    string
		score float64
		dist  *float64
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (row, error) {
		var x row
		var cover, currency *string
		var price *int64
		err := r.Scan(&x.id, &x.card.Slug, &x.card.BusinessName, &x.card.Headline, &x.card.City, &x.card.Region,
			&x.card.Categories, &cover, &price, &currency, &x.score, &x.dist)
		if cover != nil {
			url := fmt.Sprintf("/api/public/providers/images/%s/480", *cover)
			x.card.CoverURL = &url
		}
		if price != nil && currency != nil {
			x.card.PriceFrom = &Price{FromCents: *price, Currency: *currency}
		}
		if x.dist != nil {
			km := math.Round(*x.dist*10) / 10
			x.card.DistanceKm = &km
		}
		return x, err
	})
	if err != nil {
		return nil, nil, nil, err
	}
	var next *Cursor
	if len(list) > q.Limit {
		last := list[q.Limit-1]
		value := last.score
		if q.Sort == "distance" && last.dist != nil {
			value = *last.dist
		}
		next = &Cursor{Value: value, ID: last.id}
		list = list[:q.Limit]
	}
	cards := make([]Card, len(list))
	for i, x := range list {
		cards[i] = x.card
	}
	facets, err := s.facets(ctx, args[:8])
	return cards, next, facets, err
}

// facets cuenta los resultados de cada categoría con los mismos filtros salvo el de categorías
// ($8 no se usa aquí, pero la lista de argumentos es la misma).
func (s *Store) facets(ctx context.Context, args []any) (map[string]int, error) {
	rows, err := s.pool.Query(ctx, scored+`
SELECT c, count(*)::int FROM scored, unnest(categories) c
WHERE ($3::float8 IS NULL OR distance <= $5::float8) AND cardinality($8::text[]) >= 0
GROUP BY c`, args...)
	if err != nil {
		return nil, err
	}
	type pair struct {
		C string
		N int
	}
	pairs, err := pgx.CollectRows(rows, pgx.RowToStructByPos[pair])
	facets := make(map[string]int, len(pairs))
	for _, p := range pairs {
		facets[p.C] = p.N
	}
	return facets, err
}
