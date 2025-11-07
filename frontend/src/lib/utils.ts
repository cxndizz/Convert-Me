// Path: /frontend/src/lib/utils.ts

import { ColumnProfile, ColumnType } from '../types';

// Function to guess the best column type based on profile
export const guessColumnType = (profile: ColumnProfile): ColumnType => {
  const { inferred_type, null_pct } = profile;
  
  // If mostly null, default to STRING
  if (null_pct > 80) {
    return 'STRING';
  }
  
  // Otherwise use the inferred type
  switch (inferred_type.toUpperCase()) {
    case 'INTEGER':
      return 'INT64';
    case 'DECIMAL':
    case 'NUMERIC':
      return 'DECIMAL';
    case 'FLOAT':
    case 'REAL':
    case 'DOUBLE':
      return 'FLOAT';
    case 'BOOLEAN':
      return 'BOOLEAN';
    case 'DATE':
      return 'DATE';
    case 'TIMESTAMP':
    case 'DATETIME':
      return 'TIMESTAMP';
    case 'JSON':
    case 'OBJECT':
      return 'JSON';
    case 'STRING':
    case 'TEXT':
    case 'VARCHAR':
    default:
      return 'STRING';
  }
};

// Format file size in human-readable format
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// Format percentage with fixed decimal places
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// Get the severity level based on the percentage (for null, duplicates, etc.)
export const getSeverityLevel = (
  percentage: number, 
  thresholds = { low: 5, medium: 20, high: 50 }
): 'low' | 'medium' | 'high' | 'critical' => {
  if (percentage <= thresholds.low) return 'low';
  if (percentage <= thresholds.medium) return 'medium';
  if (percentage <= thresholds.high) return 'high';
  return 'critical';
};

// Get color based on severity
export const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical'): string => {
  switch (severity) {
    case 'low':
      return 'text-green-600 bg-green-50';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'high':
      return 'text-orange-600 bg-orange-50';
    case 'critical':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

// Helper to safely stringify objects for display
export const safeStringify = (value: any): string => {
  if (value === null) return 'NULL';
  if (value === undefined) return 'UNDEFINED';
  
  try {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  } catch (error) {
    return 'ERROR';
  }
};

// Get a human-readable description of the column type
export const getTypeDescription = (type: ColumnType): string => {
  switch (type) {
    case 'STRING':
      return 'Text';
    case 'INT64':
      return 'Integer';
    case 'DECIMAL':
      return 'Decimal';
    case 'FLOAT':
      return 'Float';
    case 'BOOLEAN':
      return 'Boolean';
    case 'DATE':
      return 'Date';
    case 'TIMESTAMP':
      return 'Timestamp';
    case 'JSON':
      return 'JSON';
    default:
      return 'Unknown';
  }
};