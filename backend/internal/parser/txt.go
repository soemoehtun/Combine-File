package parser

import (
	"fmt"
	"io"
	"strings"
)

type TXTParser struct{}

func (p *TXTParser) ParseFile(path string, delimiter string) ([]string, [][]string, error) {
	delim := parseDelimiter(delimiter)

	content, err := readFileString(path)
	if err != nil {
		return nil, nil, err
	}

	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		return nil, nil, fmt.Errorf("empty file")
	}

	var headers []string
	var rows [][]string

	first := true
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, delimiter)
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}
		if first {
			headers = parts
			first = false
		} else {
			rows = append(rows, parts)
		}
	}

	return headers, rows, nil
}

func parseDelimiter(d string) string {
	switch d {
	case "tab":
		return "\t"
	case "pipe":
		return "|"
	default:
		return d
	}
}

func readFileString(path string) (string, error) {
	b, err := io.ReadAll(openFile(path))
	return string(b), err
}
