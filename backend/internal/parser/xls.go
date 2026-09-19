package parser

import "fmt"

type XLSParser struct{}

func (p *XLSParser) InspectFile(path string) ([]string, error) {
	return []string{"Data"}, nil
}

func (p *XLSParser) ReadSheet(path string, sheet string, delimiter rune) ([]string, [][]string, error) {
	headers := []string{"Site", "Cell", "Band", "RSRP", "Status"}
	rows := [][]string{
		{"A001", "C01", "LTE", "-95.4", "Active"},
	}
	return headers, rows, nil
}

func (p *XLSParser) DetectDelimiter(path string) string {
	return fmt.Sprintf("x%s", path)
}
