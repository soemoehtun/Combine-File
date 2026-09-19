package handlers

import (
	"encoding/json"
	"net/http"
)

type CombineHandler struct{}

func (h *CombineHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"jobId": "job_" + r.URL.Query().Get("id"),
		"status": "processing",
		"message": "Combining files via Go backend",
	})
}
