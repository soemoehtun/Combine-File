# Excel Files Data Combiner & Splitter

A professional, high-performance web application for combining and splitting large tabular datasets.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Go / Golang with streaming I/O and job-based processing

## Supported Formats

- **Input**: `.csv`, `.txt`, `.xlsx`, `.xls`
- **Output**: Always `.csv`

## Tools

### Combine Files
Merge multiple CSV, TXT, or Excel files into a single CSV file with header validation, delimiter selection, and column name matching.

### Split File
Split a single CSV, TXT, or Excel file into multiple CSV files by row count, file count, or maximum file size.

## Technology

- React 19 + TypeScript
- Vite build system
- Tailwind CSS styling
- Go HTTP server with buffered processing
- Streaming CSV parser and writer
- Real-time job progress via simulated backend events

## Running the Backend (Go)

```bash
cd backend/cmd/server
 go run main.go
```

## Features

- Drag-and-drop file upload
- Real-time processing progress
- Header validation and column matching
- Sheet selection for Excel files
- Job cancellation
- Automatic temporary file cleanup
- No arbitrary file size limits
