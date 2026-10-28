package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/yitztech/tuevento.fun/services/search/internal/catalog"
)

// Problem es una respuesta de error en Problem Details (RFC 9457, AGENTS.md §22).
type Problem struct {
	Type      string       `json:"type"`
	Title     string       `json:"title"`
	Status    int          `json:"status"`
	Code      string       `json:"code"`
	Detail    string       `json:"detail"`
	RequestID string       `json:"requestId"`
	Errors    []FieldError `json:"errors,omitempty"`
}

// writeProblem responde el error con su título y su detalle en el idioma de la petición.
func writeProblem(w http.ResponseWriter, r *http.Request, status int, detailKey string, errs []FieldError) {
	locale := requestLocale(r)
	known, ok := catalog.Data.ProblemStatuses[strconv.Itoa(status)]
	if !ok {
		// Como problemStatus() de packages/contracts: lo que no está en la tabla, 500 o 400
		known = catalog.Data.ProblemStatuses[map[bool]string{true: "500", false: "400"}[status >= 500]]
	}
	detail := catalog.T(locale, detailKey, nil)
	if len(errs) > 0 {
		detail = errs[0].Message
	}
	w.Header().Set("Content-Type", "application/problem+json")
	w.Header().Set("Content-Language", locale)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Problem{
		Type: "about:blank", Title: catalog.T(locale, known.Title, nil), Status: status, Code: known.Code,
		Detail: detail, RequestID: requestID(r), Errors: errs,
	})
}
