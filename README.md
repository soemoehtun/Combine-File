# Excel Data Combiner Tool

A browser-based tool to import, validate, and combine Excel/CSV/TXT files into a single output sheet — no server required.

## Features

- **Drag & drop import** — supports `.xlsx`, `.xls`, `.csv`, `.txt`
- **Multi-file combine** — merge data from any number of files
- **Sheet selector** — choose which sheet to read (populated from imported files)
- **Start Row options** — include/skip heading or enter a custom start row
- **Header comparison** — live check across all selected files, highlights mismatches with column details
- **Single-file HTML** — open from `file://` protocol, no install needed

## How to use

1. Open `index.html` in any modern browser
2. Drag & drop files onto the import zone (or click to browse)
3. Choose the **Start Row** mode and **Sheet**
4. Review the **Header Check** status — green means all headers match
5. Click **Combine Files** to download `Combined_Data.xlsx`

