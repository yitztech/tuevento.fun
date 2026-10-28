// Package catalog embebe lo que el servicio toma de packages/contracts (shared.json): idiomas,
// límites, categorías, estados de error y textos. Así no hay una segunda copia que mantener.
package catalog

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed shared.json
var sharedJSON []byte

// Shared es dist/shared.json de @tuevento/contracts.
type Shared struct {
	DefaultLocale string `json:"defaultLocale"`
	Locales       []struct {
		Code     string  `json:"code"`
		HostedBy *string `json:"hostedBy"`
	} `json:"locales"`
	AccountLimits struct {
		Search int `json:"search"`
	} `json:"accountLimits"`
	SearchLimits struct {
		DefaultLimit    int `json:"defaultLimit"`
		MaxLimit        int `json:"maxLimit"`
		DefaultRadiusKm int `json:"defaultRadiusKm"`
		MaxRadiusKm     int `json:"maxRadiusKm"`
	} `json:"searchLimits"`
	SearchSorts        []string `json:"searchSorts"`
	ProviderCategories []string `json:"providerCategories"`
	ProblemStatuses    map[string]struct {
		Code  string `json:"code"`
		Title string `json:"title"`
	} `json:"problemStatuses"`
	Messages map[string]map[string]string `json:"messages"`
}

// Data es el catálogo cargado al arrancar.
var Data = mustLoad()

func mustLoad() Shared {
	var s Shared
	if err := json.Unmarshal(sharedJSON, &s); err != nil {
		panic(fmt.Sprintf("shared.json no es válido (npm run build -w @tuevento/contracts): %v", err))
	}
	if s.DefaultLocale == "" || len(s.ProviderCategories) == 0 || s.AccountLimits.Search == 0 {
		panic("shared.json está incompleto (npm run build -w @tuevento/contracts)")
	}
	return s
}

// SiteLocale es el idioma cuyo dominio sirve a `locale` (pt → en).
func SiteLocale(locale string) string {
	for _, l := range Data.Locales {
		if l.Code == locale && l.HostedBy != nil {
			return *l.HostedBy
		}
	}
	return locale
}

// IsLocale dice si el código es uno de los idiomas de la tabla.
func IsLocale(code string) bool {
	for _, l := range Data.Locales {
		if l.Code == code {
			return true
		}
	}
	return false
}

// IsCategory dice si el código es una categoría de proveedor.
func IsCategory(code string) bool {
	for _, c := range Data.ProviderCategories {
		if c == code {
			return true
		}
	}
	return false
}

// T traduce una clave con sus variables ({{name}}); si falta en el idioma, usa el principal.
func T(locale, key string, vars map[string]string) string {
	text, ok := Data.Messages[locale][key]
	if !ok {
		text, ok = Data.Messages[Data.DefaultLocale][key]
	}
	if !ok {
		return key
	}
	for name, value := range vars {
		text = strings.ReplaceAll(text, "{{"+name+"}}", value)
	}
	return text
}

// Letras con tilde, diéresis o cedilla de los idiomas de la tabla, sin ellas (como unaccent).
var accents = strings.NewReplacer(
	"á", "a", "à", "a", "â", "a", "ä", "a", "ã", "a", "å", "a",
	"é", "e", "è", "e", "ê", "e", "ë", "e",
	"í", "i", "ì", "i", "î", "i", "ï", "i",
	"ó", "o", "ò", "o", "ô", "o", "ö", "o", "õ", "o",
	"ú", "u", "ù", "u", "û", "u", "ü", "u",
	"ñ", "n", "ç", "c", "ß", "ss", "œ", "oe", "æ", "ae", "ÿ", "y",
)

// Normalize pasa a minúsculas, quita tildes y diéresis (como f_unaccent en la base de datos) y
// junta los espacios.
func Normalize(text string) string {
	return strings.Join(strings.Fields(accents.Replace(strings.ToLower(text))), " ")
}

// CategoriesMatching devuelve las categorías cuyo nombre, en cualquier idioma, contiene alguna
// palabra de la búsqueda («sillas», «chairs», «Stühle»…) o la búsqueda entera.
func CategoriesMatching(query string) []string {
	q := Normalize(query)
	if len([]rune(q)) < 3 {
		return nil
	}
	words := strings.Fields(q)
	var found []string
	for _, code := range Data.ProviderCategories {
		key := "providers.categories." + code
	match:
		for _, messages := range Data.Messages {
			name := Normalize(messages[key])
			if name == "" {
				continue
			}
			// Un nombre corto (DJ) cuenta solo como palabra entera de la búsqueda
			if strings.Contains(name, q) || len([]rune(name)) < 4 && contains(words, name) {
				found = append(found, code)
				break
			}
			for _, word := range strings.Fields(name) {
				for _, w := range words {
					if len([]rune(w)) >= 4 && (strings.HasPrefix(word, w) || strings.HasPrefix(w, word) && len([]rune(word)) >= 4) {
						found = append(found, code)
						break match
					}
				}
			}
		}
	}
	return found
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}
