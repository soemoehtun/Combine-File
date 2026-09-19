export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  file?: File;
  preview?: string[];
  sheetName?: string;
  sheets?: string[];
  header?: string[];
}

export interface JobStatus {
  jobId: string;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  processedRows: number;
  processedBytes: number;
  speed: number;
  percent: number;
  files: number;
  message?: string;
}

export type HeaderMode = 'first' | 'validate' | 'match-name' | 'match-position';
export type Delimiter = ',' | ';' | '\t' | '|' | 'custom';

export interface SplitOptions {
  method: 'rows' | 'count' | 'size';
  rowsPerFile: number;
  fileCount: number;
  maxSizeMB: number;
  includeHeader: boolean;
  delimiter: Delimiter;
}

export interface AdvancedOptions {
  trimWhitespace: boolean;
  removeBlankRows: boolean;
  removeDuplicateRows: boolean;
  validateColumnCount: boolean;
  skipEmptyFiles: boolean;
  normalizeLineEndings: boolean;
}
