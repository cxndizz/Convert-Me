// Path: /frontend/src/types/index.ts

// Types for session and file data
export interface Session {
  session_id: string;
  created_at: string;
  ttl_s: number;
}

export interface FileInfo {
  file_id: string;
  filename: string;
  size: number;
  detected_delimiter?: string;
  detected_encoding?: string;
  header_detected?: boolean;
}

export interface ColumnProfile {
  name: string;
  inferred_type: string;
  null_pct: number;
  null_count?: number;
  distinct_pct: number;
  distinct_count?: number;
  min?: any;
  max?: any;
  mean?: number;
  samples: any[];
  issues?: string[];
}

export interface DataProfile {
  rows: number;
  columns: number;
  columns_profile: ColumnProfile[];
  file_name?: string;
  file_extension?: string;
  encoding?: string;
  delimiter?: string;
  header_detected?: boolean;
}

export type ColumnType = 
  | 'STRING'
  | 'INT64'
  | 'DECIMAL'
  | 'FLOAT'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIMESTAMP'
  | 'JSON';

export interface MissingStrategy {
  type: 'constant' | 'mean' | 'median' | 'mode' | 'null';
  value?: any;
}

export interface ValidationRule {
  type: 'regex' | 'range' | 'custom';
  pattern?: string;
  min?: number;
  max?: number;
  custom_fn?: string;
  on_fail: 'flag' | 'replace' | 'drop';
  replacement?: any;
}

export interface ColumnConfig {
  type: ColumnType;
  format?: string[];
  null_tokens?: string[];
  missing_strategy?: MissingStrategy;
  standardize?: {
    trim?: boolean;
    case?: 'lower' | 'upper' | 'none';
  };
  validate?: ValidationRule;
}

export interface DataConfig {
  [columnName: string]: ColumnConfig;
}

export interface ValidationResult {
  rows_affected: number;
  warnings: string[];
  diff_sample: { before: any; after: any }[];
}

export type ExportFormat = 'csv' | 'xlsx' | 'parquet' | 'jsonl';

export interface SqlOptions {
  dialect: 'postgres';
  type: 'ddl' | 'dml' | 'ctas';
  table_name: string;
}