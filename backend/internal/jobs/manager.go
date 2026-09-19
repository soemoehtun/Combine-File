package jobs

import (
	"sync"
	"time"
)

type JobStatus string

const (
	StatusQueued      JobStatus = "queued"
	StatusUploading   JobStatus = "uploading"
	StatusProcessing  JobStatus = "processing"
	StatusCompleted   JobStatus = "completed"
	StatusFailed      JobStatus = "failed"
	StatusCancelled   JobStatus = "cancelled"
)

type Job struct {
	ID            string       `json:"jobId"`
	Status        JobStatus   `json:"status"`
	ProcessedRows int64        `json:"processedRows"`
	ProcessedBytes int64      `json:"processedBytes"`
	Speed         int64        `json:"speed"`
	Percent       int          `json:"percent"`
	Files         int          `json:"files"`
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
	ResultPath    string       `json:"resultPath"`
}

type Manager struct {
	mu    sync.RWMutex
	jobs  map[string]*Job
}

func NewManager() *Manager {
	return &Manager{
		jobs: make(map[string]*Job),
	}
}

func (m *Manager) Create(id string) *Job {
	j := &Job{
		ID: id,
		Status: StatusQueued,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	m.mu.Lock()
	m.jobs[id] = j
	m.mu.Unlock()
	return j
}

func (m *Manager) Get(id string) *Job {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.jobs[id]
}

func (m *Manager) UpdateStatus(id string, status JobStatus) {
	m.mu.Lock()
	defer m.mu.Unlock()
	j, ok := m.jobs[id]
	if !ok {
		return
	}
	j.Status = status
	j.UpdatedAt = time.Now()
}

func (m *Manager) UpdateProgress(id string, rows, bytes, speed int64, percent int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	j, ok := m.jobs[id]
	if !ok {
		return
	}
	j.ProcessedRows = rows
	j.ProcessedBytes = bytes
	j.Speed = speed
	j.Percent = percent
	j.UpdatedAt = time.Now()
}
