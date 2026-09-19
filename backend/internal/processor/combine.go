package processor

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
)

type CombineProcessor struct{}

func (p *CombineProcessor) Process(files []string, outputPath string, delimiter rune) error {
	f, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	defer f.Close()

	w := csv.NewWriter(f)
	w.UseCRLF = false
	w.Comma = delimiter

	var headerWritten bool
	for _, file := range files {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			continue
		}

		input, err := os.Open(file)
		if err != nil {
			continue
		}

		r := csv.NewReader(input)
		r.Comma = delimiter

		records, err := r.ReadAll()
		input.Close()
		if err != nil || len(records) == 0 {
			continue
		}

		if !headerWritten {
			w.Write(records[0])
			headerWritten = true
		}

		for _, row := range records[1:] {
			w.Write(row)
		}
	}
	w.Flush()
	return w.Error()
}

func (p *CombineProcessor) CombineToTemp(files []string, delimiter rune) (string, error) {
	tmpDir := os.TempDir()
	outFile := filepath.Join(tmpDir, fmt.Sprintf("combined_%d.csv", len(files)))
	return outFile, p.Process(files, outFile, delimiter)
}
