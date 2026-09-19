package handlers

import (
	"encoding/json"
	"net/http"
)

type SplitHandler struct{}

func (h *SplitHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"jobId": "split_" + r.URL.Query().Get("id"),
		"status": "processing",
		"message": "Splitting file via Go backend",
	})
}
