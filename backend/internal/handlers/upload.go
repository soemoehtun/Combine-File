package handlers

import (
	"encoding/json"
	"net/http"
)

type UploadHandler struct{}

func (h *UploadHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "upload_received",
		"message": "Files uploaded to Go server",
	})
}
