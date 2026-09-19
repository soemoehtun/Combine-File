package processor

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
)

type SplitProcessor struct{}

func (p *SplitProcessor) Process(inputPath string, outputDir string, rowsPerFile int, delimiter rune, includeHeader bool) ([]string, error) {
	f, err := os.Open(inputPath)
	if err != nil {
		return nil, fmt.Errorf("open input: %w", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = delimiter
	r.ReuseRecord = true

	headers, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	var result []string
	partNumber := 1
	currentRowCount := 0

	var outFile *os.File
	var writer *csv.Writer

	createNewPart := func() error {
		if outFile != nil {
			writer.Flush()
			outFile.Close()
		}
		filename := fmt.Sprintf("part_%03d.csv", partNumber)
		path := filepath.Join(outputDir, filename)
		outFile, err = os.Create(path)
		if err != nil {
			return err
		}
		writer = csv.NewWriter(outFile)
		writer.Comma = delimiter
		if includeHeader {
			writer.Write(headers)
		}
		partNumber++
		currentRowCount = 0
		result = append(result, path)
		return nil
	}

	if err := createNewPart(); err != nil {
		return nil, err
	}

	for {
		record, err := r.Read()
		if err != nil {
			if outFile != nil {
				writer.Flush()
				outFile.Close()
			}
			return result, nil
		}

		writer.Write(record)
		currentRowCount++

		if rowsPerFile > 0 && currentRowCount >= rowsPerFile {
			writer.Flush()
			outFile.Close()
			currentRowCount = 0
			if err := createNewPart(); err != nil {
				return result, err
			}
		}
	}

	return result, nil
}
