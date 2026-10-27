package api

import (
	"encoding/base64"
	"encoding/json"
	"regexp"

	"github.com/yitztech/tuevento.fun/services/search/internal/store"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type cursorData struct {
	Sort  string  `json:"s"`
	Value float64 `json:"v"`
	ID    string  `json:"i"`
}

// EncodeCursor guarda, opaco, dónde terminó la página: el valor de orden y el id del último.
func EncodeCursor(c store.Cursor, sort string) string {
	raw, _ := json.Marshal(cursorData{Sort: sort, Value: c.Value, ID: c.ID})
	return base64.RawURLEncoding.EncodeToString(raw)
}

// DecodeCursor lee un cursor de EncodeCursor; uno de otro orden o alterado no vale.
func DecodeCursor(raw, sort string) (store.Cursor, bool) {
	if len(raw) > 200 {
		return store.Cursor{}, false
	}
	bytes, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return store.Cursor{}, false
	}
	var c cursorData
	if json.Unmarshal(bytes, &c) != nil || c.Sort != sort || !uuidPattern.MatchString(c.ID) {
		return store.Cursor{}, false
	}
	return store.Cursor{Value: c.Value, ID: c.ID}, true
}
