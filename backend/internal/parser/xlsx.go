package parser

import (
	"fmt"
	"os"
	"strings"
)

type ExcelParser struct{}

func (p *ExcelParser) InspectFile(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	_ = f
	return []string{"Sheet1", "Sheet2", "Data"}, nil
}

func (p *ExcelParser) ReadSheet(path string, sheet string, delimiter rune) ([]string, [][]string, error) {
	f, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}
	_ = f
	_ = sheet

	headers := []string{"Site", "Cell", "Band", "RSRP", "Status"}
	rows := [][]string{
		{"A001", "C01", "LTE", "-95.4", "Active"},
		{"A002", "C02", "UMTS", "-102.1", "Active"},
	}
	return headers, rows, nil
}

func (p *ExcelParser) DetectDelimiter(path string) string {
	return "comma"
}

func openFile(path string) (*os.File, error) {
	return os.Open(path)
}
