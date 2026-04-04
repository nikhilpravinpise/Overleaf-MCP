/**
 * @fileoverview Compilation Status Widget
 * 
 * Displays LaTeX compilation log analysis with errors, warnings, and statistics.
 * Provides detailed error messages with line numbers and categories for easy debugging.
 */

import React, { useState } from "react";
import { useWidget } from "mcp-use/react";

/**
 * Props passed from latex_analyze_log tool
 */
interface CompileStatusProps {
  projectName: string;
  success: boolean;
  errors: Array<{
    line: number;
    message: string;
    file?: string;
    type: "syntax" | "undefined" | "missing" | "other";
  }>;
  warnings: Array<{
    line?: number;
    message: string;
    type: "reference" | "font" | "package" | "other";
  }>;
  summary: string;
  rawLog?: string;
}

const CompileStatus: React.FC = () => {
  const { props, isPending, theme } = useWidget<CompileStatusProps>();
  const [showRawLog, setShowRawLog] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "syntax" | "undefined" | "missing">("all");

  // Widget renders before tool completes
  if (isPending) {
    return (
      <div className={`p-6 rounded-lg ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
        <p className={`mt-4 text-center ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Analyzing compilation log...
        </p>
      </div>
    );
  }

  const isDark = theme === "dark";
  const bgColor = isDark ? "bg-gray-900" : "bg-white";
  const textColor = isDark ? "text-white" : "text-gray-900";
  const secondaryText = isDark ? "text-gray-400" : "text-gray-600";
  const borderColor = isDark ? "border-gray-700" : "border-gray-200";
  const errorBg = isDark ? "bg-red-900/30" : "bg-red-50";
  const warningBg = isDark ? "bg-yellow-900/30" : "bg-yellow-50";
  const successBg = isDark ? "bg-green-900/30" : "bg-green-50";
  const codeBg = isDark ? "bg-gray-800" : "bg-gray-100";

  const filteredErrors = filterType === "all" 
    ? props.errors 
    : props.errors.filter(e => e.type === filterType);

  const errorsByType = props.errors.reduce((acc, err) => {
    acc[err.type] = (acc[err.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const warningsByType = props.warnings.reduce((acc, warn) => {
    acc[warn.type] = (acc[warn.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getErrorIcon = (type: string) => {
    switch (type) {
      case "syntax": return "⚠️";
      case "undefined": return "❓";
      case "missing": return "🔍";
      default: return "❌";
    }
  };

  return (
    <div className={`${bgColor} ${textColor} rounded-lg border ${borderColor} shadow-sm`}>
      {/* Header */}
      <div className="p-4 border-b ${borderColor}">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Compilation Log Analysis</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            props.success ? `${successBg} text-green-700` : `${errorBg} text-red-700`
          }`}>
            {props.success ? "✓ Success" : "✗ Failed"}
          </div>
        </div>
        <p className={`mt-1 text-sm ${secondaryText}`}>{props.projectName}</p>
      </div>

      {/* Summary */}
      <div className="p-4 border-b ${borderColor}">
        <p className="text-sm">{props.summary}</p>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className={`p-3 rounded-lg ${errorBg}`}>
            <div className="text-2xl font-bold text-red-700">{props.errors.length}</div>
            <div className="text-xs text-red-600">Errors</div>
            {Object.keys(errorsByType).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(errorsByType).map(([type, count]) => (
                  <div key={type} className="text-xs text-red-700">
                    {type}: {count}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${warningBg}`}>
            <div className="text-2xl font-bold text-yellow-700">{props.warnings.length}</div>
            <div className="text-xs text-yellow-600">Warnings</div>
            {Object.keys(warningsByType).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(warningsByType).map(([type, count]) => (
                  <div key={type} className="text-xs text-yellow-700">
                    {type}: {count}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Errors Section */}
      {props.errors.length > 0 && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Errors</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType("all")}
                className={`px-2 py-1 text-xs rounded ${
                  filterType === "all" ? (isDark ? "bg-blue-600" : "bg-blue-500 text-white") : codeBg
                }`}
              >
                All
              </button>
              {Object.keys(errorsByType).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type as any)}
                  className={`px-2 py-1 text-xs rounded capitalize ${
                    filterType === type ? (isDark ? "bg-blue-600" : "bg-blue-500 text-white") : codeBg
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredErrors.map((error, idx) => (
              <div key={idx} className={`p-3 rounded-lg ${errorBg} border-l-4 border-red-600`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{getErrorIcon(error.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-red-700">
                        {error.file ? `${error.file}:` : ""}{error.line > 0 ? `Line ${error.line}` : "Unknown line"}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${codeBg} text-red-700 capitalize`}>
                        {error.type}
                      </span>
                    </div>
                    <p className="text-sm text-red-800">{error.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings Section */}
      {props.warnings.length > 0 && (
        <div className="p-4 border-t ${borderColor}">
          <h4 className="font-semibold mb-3">Warnings</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {props.warnings.slice(0, 10).map((warning, idx) => (
              <div key={idx} className={`p-3 rounded-lg ${warningBg}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {warning.line && (
                        <span className="font-mono text-sm font-semibold text-yellow-700">
                          Line {warning.line}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded ${codeBg} text-yellow-700 capitalize`}>
                        {warning.type}
                      </span>
                    </div>
                    <p className="text-sm text-yellow-800">{warning.message}</p>
                  </div>
                </div>
              </div>
            ))}
            {props.warnings.length > 10 && (
              <p className={`text-sm ${secondaryText} text-center`}>
                ...and {props.warnings.length - 10} more warnings
              </p>
            )}
          </div>
        </div>
      )}

      {/* Raw Log Toggle */}
      {props.rawLog && (
        <div className="p-4 border-t ${borderColor}">
          <button
            onClick={() => setShowRawLog(!showRawLog)}
            className={`w-full px-4 py-2 rounded font-medium ${isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"}`}
          >
            {showRawLog ? "Hide" : "Show"} Raw Log
          </button>
          {showRawLog && (
            <div className={`mt-3 p-3 rounded ${codeBg} max-h-96 overflow-auto`}>
              <pre className="text-xs font-mono whitespace-pre-wrap">{props.rawLog}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompileStatus;
