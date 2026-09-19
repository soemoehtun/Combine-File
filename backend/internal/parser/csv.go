package parser

import (
	"encoding/csv"
	"fmt"
	"io"
)

type CSVParser struct{}

func (p *CSVParser) ParseFile(path string, delimiter rune) ([]string, [][]string, error) {
	f, err := openFile(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = delimiter
	r.ReuseRecord = false
	r.FieldsPerRecord = -1
	r.LazyQuotes = true

	records, err := r.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("csv read error: %w", err)
	}

	if len(records) == 0 {
		return nil, nil, fmt.Errorf("empty file")
	}

	headers := records[0]
	rows := records[1:]
	return headers, rows, nil
}

func (p *CSVParser) StreamFile(path string, delimiter rune, callback func([]string) error) error {
	f, err := openFile(path)
	if err != nil {
		return err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = delimiter
	r.FieldsPerRecord = -1
	r.LazyQuotes = true

	headers, err := r.Read()
	if err != nil && err != io.EOF {
		return fmt.Errorf("reading header: %w", err)
	}

	_ = headers

	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("reading row: %w", err)
		}
		if err := callback(record); err != nil {
			return err
		}
	}
	return nil
}
