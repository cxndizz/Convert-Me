'use client';

import { useState } from 'react';
import { 
  ColumnProfile, 
  ColumnType, 
  ColumnConfig, 
  MissingStrategy,
  ValidationRule
} from '@/types';
import { 
  guessColumnType, 
  getTypeDescription, 
  formatPercentage, 
  getSeverityLevel,
  getSeverityColor
} from '@/lib/utils';
import { 
  FiEdit2, 
  FiCheck, 
  FiX, 
  FiChevronDown, 
  FiChevronUp,
  FiCalendar,
  FiHash,
  FiType,
  FiAlertCircle,
  FiFilter,
  FiCheck
} from 'react-icons/fi';

interface ColumnConfigPanelProps {
  column: ColumnProfile;
  config: ColumnConfig | null;
  onConfigChange: (columnName: string, config: ColumnConfig) => void;
}

export default function ColumnConfigPanel({ 
  column, 
  config, 
  onConfigChange 
}: ColumnConfigPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [localConfig, setLocalConfig] = useState<ColumnConfig>(
    config || {
      type: guessColumnType(column),
      null_tokens: ['NULL', 'null', 'N/A', ''],
      standardize: {
        trim: true,
        case: 'none',
      },
    }
  );

  // Handle type change
  const handleTypeChange = (type: ColumnType) => {
    const updatedConfig = { ...localConfig, type };
    setLocalConfig(updatedConfig);
    onConfigChange(column.name, updatedConfig);
  };

  // Handle missing strategy change
  const handleMissingStrategyChange = (strategy: MissingStrategy) => {
    const updatedConfig = { 
      ...localConfig, 
      missing_strategy: strategy 
    };
    setLocalConfig(updatedConfig);
    onConfigChange(column.name, updatedConfig);
  };

  // Handle standardize options change
  const handleStandardizeChange = (key: string, value: any) => {
    const updatedConfig = { 
      ...localConfig, 
      standardize: { 
        ...localConfig.standardize, 
        [key]: value 
      } 
    };
    setLocalConfig(updatedConfig);
    onConfigChange(column.name, updatedConfig);
  };

  // Handle validation rule change
  const handleValidationChange = (rule: ValidationRule) => {
    const updatedConfig = { ...localConfig, validate: rule };
    setLocalConfig(updatedConfig);
    onConfigChange(column.name, updatedConfig);
  };

  // Get severity level based on null percentage
  const nullSeverity = getSeverityLevel(column.null_pct);
  const nullSeverityClass = getSeverityColor(nullSeverity);

  return (
    <div className="border rounded-md mb-4 overflow-hidden shadow-sm">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <div className="mr-3">
            {localConfig.type === 'STRING' && <FiType className="text-blue-500" />}
            {localConfig.type === 'INT64' && <FiHash className="text-green-500" />}
            {localConfig.type === 'DECIMAL' && <FiHash className="text-green-500" />}
            {localConfig.type === 'FLOAT' && <FiHash className="text-green-500" />}
            {localConfig.type === 'DATE' && <FiCalendar className="text-purple-500" />}
            {localConfig.type === 'TIMESTAMP' && <FiCalendar className="text-purple-500" />}
          </div>
          <div>
            <h3 className="font-medium">{column.name}</h3>
            <div className="flex items-center text-sm text-gray-500">
              <span className="mr-2">{getTypeDescription(localConfig.type)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${nullSeverityClass}`}>
                {formatPercentage(column.null_pct)} NULL
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          {column.issues && column.issues.length > 0 && (
            <div className="mr-3">
              <FiAlertCircle className="text-red-500" />
            </div>
          )}
          {expanded ? <FiChevronUp /> : <FiChevronDown />}
        </div>
      </div>

      {/* Configuration panel */}
      {expanded && (
        <div className="p-4 border-t">
          {/* Type selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Type
            </label>
            <select 
              className="input-field"
              value={localConfig.type}
              onChange={(e) => handleTypeChange(e.target.value as ColumnType)}
            >
              <option value="STRING">String</option>
              <option value="INT64">Integer</option>
              <option value="DECIMAL">Decimal</option>
              <option value="FLOAT">Float</option>
              <option value="BOOLEAN">Boolean</option>
              <option value="DATE">Date</option>
              <option value="TIMESTAMP">Timestamp</option>
              <option value="JSON">JSON</option>
            </select>
          </div>

          {/* Date format (only for date types) */}
          {(localConfig.type === 'DATE' || localConfig.type === 'TIMESTAMP') && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Format(s)
              </label>
              <input 
                type="text"
                className="input-field"
                placeholder="e.g., %Y-%m-%d, %d/%m/%Y"
                value={localConfig.format?.join(', ') || ''}
                onChange={(e) => {
                  const formats = e.target.value.split(',').map(f => f.trim()).filter(Boolean);
                  setLocalConfig({ ...localConfig, format: formats });
                  onConfigChange(column.name, { ...localConfig, format: formats });
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list of formats to try
              </p>
            </div>
          )}

          {/* Null tokens */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NULL Tokens
            </label>
            <input 
              type="text"
              className="input-field"
              placeholder="e.g., NULL, null, N/A"
              value={localConfig.null_tokens?.join(', ') || ''}
              onChange={(e) => {
                const tokens = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                setLocalConfig({ ...localConfig, null_tokens: tokens });
                onConfigChange(column.name, { ...localConfig, null_tokens: tokens });
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Values to be interpreted as NULL
            </p>
          </div>

          {/* Missing value strategy */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Missing Value Strategy
            </label>
            <select 
              className="input-field mb-2"
              value={localConfig.missing_strategy?.type || 'null'}
              onChange={(e) => {
                const type = e.target.value as 'constant' | 'mean' | 'median' | 'mode' | 'null';
                handleMissingStrategyChange({ type });
              }}
            >
              <option value="null">Leave as NULL</option>
              <option value="constant">Fill with constant</option>
              {['INT64', 'DECIMAL', 'FLOAT'].includes(localConfig.type) && (
                <>
                  <option value="mean">Fill with mean</option>
                  <option value="median">Fill with median</option>
                </>
              )}
              <option value="mode">Fill with mode (most common)</option>
            </select>

            {localConfig.missing_strategy?.type === 'constant' && (
              <input 
                type="text"
                className="input-field"
                placeholder="Replacement value"
                value={localConfig.missing_strategy.value || ''}
                onChange={(e) => {
                  handleMissingStrategyChange({ 
                    type: 'constant', 
                    value: e.target.value 
                  });
                }}
              />
            )}
          </div>

          {/* Standardization options */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Standardization
            </label>
            
            <div className="flex items-center mb-2">
              <input 
                type="checkbox"
                id={`trim-${column.name}`}
                checked={localConfig.standardize?.trim || false}
                onChange={(e) => handleStandardizeChange('trim', e.target.checked)}
                className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label 
                htmlFor={`trim-${column.name}`}
                className="ml-2 text-sm text-gray-700"
              >
                Trim whitespace
              </label>
            </div>

            {localConfig.type === 'STRING' && (
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Case conversion
                </label>
                <select
                  className="input-field"
                  value={localConfig.standardize?.case || 'none'}
                  onChange={(e) => handleStandardizeChange('case', e.target.value)}
                >
                  <option value="none">No change</option>
                  <option value="lower">Lowercase</option>
                  <option value="upper">Uppercase</option>
                </select>
              </div>
            )}
          </div>

          {/* Validation rules */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Validation
            </label>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Rule Type
                </label>
                <select
                  className="input-field"
                  value={localConfig.validate?.type || ''}
                  onChange={(e) => {
                    const type = e.target.value as 'regex' | 'range' | 'custom' | '';
                    if (!type) {
                      // Remove validation
                      const { validate, ...rest } = localConfig;
                      setLocalConfig(rest);
                      onConfigChange(column.name, rest);
                    } else {
                      // Set validation type
                      handleValidationChange({ 
                        type, 
                        on_fail: localConfig.validate?.on_fail || 'flag' 
                      });
                    }
                  }}
                >
                  <option value="">No validation</option>
                  <option value="regex">Regular Expression</option>
                  {['INT64', 'DECIMAL', 'FLOAT'].includes(localConfig.type) && (
                    <option value="range">Numeric Range</option>
                  )}
                </select>
              </div>

              {localConfig.validate?.type === 'regex' && (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Regex Pattern
                  </label>
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="e.g., ^[A-Za-z0-9]+$"
                    value={localConfig.validate.pattern || ''}
                    onChange={(e) => {
                      handleValidationChange({ 
                        ...localConfig.validate!, 
                        pattern: e.target.value 
                      });
                    }}
                  />
                </div>
              )}

              {localConfig.validate?.type === 'range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Min Value
                    </label>
                    <input 
                      type="number"
                      className="input-field"
                      placeholder="Minimum"
                      value={localConfig.validate.min || ''}
                      onChange={(e) => {
                        handleValidationChange({ 
                          ...localConfig.validate!, 
                          min: e.target.value ? Number(e.target.value) : undefined 
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Max Value
                    </label>
                    <input 
                      type="number"
                      className="input-field"
                      placeholder="Maximum"
                      value={localConfig.validate.max || ''}
                      onChange={(e) => {
                        handleValidationChange({ 
                          ...localConfig.validate!, 
                          max: e.target.value ? Number(e.target.value) : undefined 
                        });
                      }}
                    />
                  </div>
                </div>
              )}

              {localConfig.validate && (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    On Validation Failure
                  </label>
                  <select
                    className="input-field"
                    value={localConfig.validate.on_fail}
                    onChange={(e) => {
                      handleValidationChange({ 
                        ...localConfig.validate!, 
                        on_fail: e.target.value as 'flag' | 'replace' | 'drop' 
                      });
                    }}
                  >
                    <option value="flag">Flag (warning only)</option>
                    <option value="replace">Replace with value</option>
                    <option value="drop">Drop row</option>
                  </select>
                </div>
              )}

              {localConfig.validate?.on_fail === 'replace' && (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Replacement Value
                  </label>
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="Value to use on failure"
                    value={localConfig.validate.replacement || ''}
                    onChange={(e) => {
                      handleValidationChange({ 
                        ...localConfig.validate!, 
                        replacement: e.target.value 
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sample values */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Sample Values</h4>
            <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-600 max-h-32 overflow-y-auto">
              {column.samples.map((sample, index) => (
                <div key={index} className="mb-1 last:mb-0">
                  {sample !== null ? String(sample) : '<NULL>'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}