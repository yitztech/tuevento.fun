package api

import (
	"net/url"
	"strings"

	"github.com/yitztech/tuevento.fun/services/search/internal/catalog"
)

// Origins es el dominio de cada idioma con dominio propio (SITE_URL_<IDIOMA>).
type Origins map[string]string

// hostname de una cabecera Host: sin puerto ni punto final, en minúsculas; IPv6 sin corchetes.
func hostname(host string) string {
	value := strings.ToLower(strings.TrimSpace(host))
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "[") {
		if end := strings.Index(value, "]"); end > 0 {
			return value[1:end]
		}
	}
	if i := strings.LastIndex(value, ":"); i >= 0 && isDigits(value[i+1:]) {
		value = value[:i]
	}
	return strings.TrimSuffix(value, ".")
}

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// localeForHost: el idioma cuyo dominio (o www.<dominio>) es el Host; cualquier otro, el principal.
func localeForHost(host string, origins Origins) string {
	requested := hostname(host)
	if requested == "" {
		return catalog.Data.DefaultLocale
	}
	for _, l := range catalog.Data.Locales {
		if l.Code == catalog.Data.DefaultLocale || l.HostedBy != nil {
			continue
		}
		origin, ok := origins[l.Code]
		if !ok {
			continue
		}
		u, err := url.Parse(origin)
		if err != nil {
			continue
		}
		own := strings.ToLower(u.Hostname())
		if requested == own || requested == "www."+own {
			return l.Code
		}
	}
	return catalog.Data.DefaultLocale
}

// LocaleForRequest es la misma regla que localeForRequest de packages/contracts (la prueban los
// mismos casos, locale-cases.json): el idioma del dominio o, si este lo aloja, el de la página
// (X-App-Locale); las apps móviles usan el dominio principal y piden cualquier idioma.
func LocaleForRequest(host, appLocale string, mobile bool, origins Origins) string {
	domain := localeForHost(host, origins)
	if !catalog.IsLocale(appLocale) {
		return domain
	}
	if catalog.SiteLocale(appLocale) == domain {
		return appLocale
	}
	if mobile && domain == catalog.Data.DefaultLocale {
		return appLocale
	}
	return domain
}
