/**
 * @fileoverview LaTeX PDF Viewer Widget
 * 
 * Displays compiled PDF documents with zoom controls, download functionality,
 * and error highlighting. Shows compilation status and provides interactive
 * PDF viewing experience within ChatGPT.
 */

import React, { useState } from "react";
import { useWidget } from "mcp-use/react";

/**
 * Props passed from latex_compile tool
 */
interface LatexPdfViewerProps {
  projectName: string;
  mainFile: string;
  success: boolean;
  pdfBase64?: string;
  errors: Array<{
    line: number;
    message: string;
    file?: string;
    type: string;
  }>;
  warnings: Array<{
    line?: number;
    message: string;
    type: string;
  }>;
  duration: number;
  engine: string;
}

const LatexPdfViewer: React.FC = () => {
  const { props, isPending, theme } = useWidget<LatexPdfViewerProps>();
  const [zoom, setZoom] = useState(100);

  // Widget renders before tool completes
  if (isPending) {
    return (
      <div className={`p-6 rounded-lg ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
        <p className={`mt-4 text-center ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Compiling LaTeX document...
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

  const handleDownload = () => {
    if (!props.pdfBase64) return;
    
    const byteCharacters = atob(props.pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${props.projectName}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${bgColor} ${textColor} rounded-lg border ${borderColor} shadow-sm`}>
      {/* Header */}
      <div className="p-4 border-b ${borderColor}">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{props.projectName}</h3>
            <p className={`text-sm ${secondaryText}`}>
              {props.mainFile} • {props.engine} • {(props.duration / 1000).toFixed(2)}s
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            props.success ? `${successBg} text-green-700` : `${errorBg} text-red-700`
          }`}>
            {props.success ? "✓ Success" : "✗ Failed"}
          </div>
        </div>
      </div>

      {/* PDF Viewer or Error Display */}
      {props.success && props.pdfBase64 ? (
        <div className="p-4">
          {/* Controls */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 25))}
                className={`px-3 py-1 rounded ${isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"}`}
              >
                −
              </button>
              <span className="text-sm font-medium">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className={`px-3 py-1 rounded ${isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"}`}
              >
                +
              </button>
            </div>
            <button
              onClick={handleDownload}
              className={`px-4 py-1 rounded font-medium ${isDark ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600"} text-white`}
            >
              Download PDF
            </button>
          </div>

          {/* PDF Preview */}
          <div className="border ${borderColor} rounded overflow-hidden">
            <iframe
              src={`data:application/pdf;base64,${props.pdfBase64}`}
              className="w-full"
              style={{ height: "600px", transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
              title="PDF Preview"
            />
          </div>

          {/* Warnings */}
          {props.warnings.length > 0 && (
            <div className={`mt-4 p-4 rounded-lg ${warningBg}`}>
              <h4 className="font-semibold text-yellow-700 mb-2">
                ⚠ {props.warnings.length} Warning{props.warnings.length > 1 ? "s" : ""}
              </h4>
              <ul className="space-y-1 text-sm">
                {props.warnings.slice(0, 5).map((warning, idx) => (
                  <li key={idx} className="text-yellow-800">
                    {warning.line ? `Line ${warning.line}: ` : ""}{warning.message}
                  </li>
                ))}
                {props.warnings.length > 5 && (
                  <li className="text-yellow-700 font-medium">
                    ...and {props.warnings.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6">
          {/* Errors */}
          <div className={`p-4 rounded-lg ${errorBg}`}>
            <h4 className="font-semibold text-red-700 mb-3">
              ✗ {props.errors.length} Error{props.errors.length > 1 ? "s" : ""}
            </h4>
            <ul className="space-y-2">
              {props.errors.map((error, idx) => (
                <li key={idx} className={`p-3 rounded ${isDark ? "bg-red-950" : "bg-white"}`}>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-sm text-red-600">
                      {error.file ? `${error.file}:` : ""}{error.line > 0 ? error.line : "?"}
                    </span>
                    <span className="text-sm text-red-800">{error.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Warnings if any */}
          {props.warnings.length > 0 && (
            <div className={`mt-4 p-4 rounded-lg ${warningBg}`}>
              <h4 className="font-semibold text-yellow-700 mb-2">
                ⚠ {props.warnings.length} Warning{props.warnings.length > 1 ? "s" : ""}
              </h4>
              <ul className="space-y-1 text-sm">
                {props.warnings.slice(0, 3).map((warning, idx) => (
                  <li key={idx} className="text-yellow-800">
                    {warning.line ? `Line ${warning.line}: ` : ""}{warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LatexPdfViewer;
