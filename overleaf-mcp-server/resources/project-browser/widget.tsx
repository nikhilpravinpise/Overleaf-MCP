/**
 * @fileoverview Project Browser Widget
 * 
 * Displays LaTeX project files in an interactive tree view with file icons,
 * sizes, and the ability to view file contents. Shows project metadata and
 * provides file management interface.
 */

import React, { useState } from "react";
import { useWidget } from "mcp-use/react";

/**
 * Props passed from latex_project_status tool
 */
interface ProjectBrowserProps {
  projectName: string;
  path: string;
  createdAt: string;
  lastModified: string;
  mainFile: string | null;
  fileCount: number;
  files: Array<{
    path: string;
    name: string;
    extension: string;
    size: number;
    isDirectory: boolean;
  }>;
  texFiles: string[];
  hasImages: boolean;
  hasBibliography: boolean;
}

const ProjectBrowser: React.FC = () => {
  const { props, isPending, theme, callTool } = useWidget<ProjectBrowserProps>();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Widget renders before tool completes
  if (isPending) {
    return (
      <div className={`p-6 rounded-lg ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
        <p className={`mt-4 text-center ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Loading project...
        </p>
      </div>
    );
  }

  const isDark = theme === "dark";
  const bgColor = isDark ? "bg-gray-900" : "bg-white";
  const textColor = isDark ? "text-white" : "text-gray-900";
  const secondaryText = isDark ? "text-gray-400" : "text-gray-600";
  const borderColor = isDark ? "border-gray-700" : "border-gray-200";
  const hoverBg = isDark ? "hover:bg-gray-800" : "hover:bg-gray-50";

  const getFileIcon = (file: typeof props.files[0]) => {
    if (file.isDirectory) return "📁";
    if (file.extension === "tex") return "📄";
    if (file.extension === "pdf") return "📕";
    if (["png", "jpg", "jpeg", "svg"].includes(file.extension)) return "🖼️";
    if (file.extension === "bib") return "📚";
    return "📄";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileClick = async (file: typeof props.files[0]) => {
    if (file.isDirectory) {
      setExpandedDirs(prev => {
        const next = new Set(prev);
        if (next.has(file.path)) {
          next.delete(file.path);
        } else {
          next.add(file.path);
        }
        return next;
      });
    } else {
      setSelectedFile(file.path);
      setIsLoadingFile(true);
      try {
        const result = await callTool("latex_read_file", { 
          project: props.projectName, 
          file: file.path 
        });
        // Extract content from result
        if (result && typeof result === 'object' && 'content' in result) {
          const content = (result as any).content;
          if (Array.isArray(content) && content[0]?.text) {
            setFileContent(content[0].text);
          } else if (typeof content === 'string') {
            setFileContent(content);
          }
        }
      } catch (error) {
        console.error('Failed to load file:', error);
        setFileContent('Error loading file');
      } finally {
        setIsLoadingFile(false);
      }
    }
  };

  // Group files by directory
  const fileTree = props.files.reduce((acc, file) => {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts[0] : "/";
    if (!acc[dir]) acc[dir] = [];
    acc[dir].push(file);
    return acc;
  }, {} as Record<string, typeof props.files>);

  return (
    <div className={`${bgColor} ${textColor} rounded-lg border ${borderColor} shadow-sm`}>
      {/* Header */}
      <div className="p-4 border-b ${borderColor}">
        <h3 className="text-lg font-semibold">{props.projectName}</h3>
        <div className={`flex gap-4 mt-2 text-sm ${secondaryText}`}>
          <span>📁 {props.fileCount} files</span>
          {props.mainFile && <span>📄 Main: {props.mainFile}</span>}
          {props.hasImages && <span>🖼️ Images</span>}
          {props.hasBibliography && <span>📚 Bibliography</span>}
        </div>
        <p className={`mt-1 text-xs ${secondaryText}`}>
          Modified: {new Date(props.lastModified).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4">
        {/* File List */}
        <div className="space-y-1">
          <h4 className={`text-sm font-semibold ${secondaryText} mb-2`}>Files</h4>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {props.files.map((file, idx) => (
              <button
                key={idx}
                onClick={() => handleFileClick(file)}
                className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 ${hoverBg} ${
                  selectedFile === file.path ? (isDark ? "bg-blue-900" : "bg-blue-50") : ""
                }`}
              >
                <span>{getFileIcon(file)}</span>
                <span className="flex-1 truncate text-sm">{file.name}</span>
                {!file.isDirectory && (
                  <span className={`text-xs ${secondaryText}`}>{formatSize(file.size)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* File Content Preview */}
        <div>
          <h4 className={`text-sm font-semibold ${secondaryText} mb-2`}>Preview</h4>
          {isLoadingFile ? (
            <div className="animate-pulse space-y-2">
              <div className={`h-4 ${isDark ? "bg-gray-700" : "bg-gray-200"} rounded`}></div>
              <div className={`h-4 ${isDark ? "bg-gray-700" : "bg-gray-200"} rounded w-5/6`}></div>
              <div className={`h-4 ${isDark ? "bg-gray-700" : "bg-gray-200"} rounded w-4/6`}></div>
            </div>
          ) : selectedFile && fileContent ? (
            <div>
              <div className={`text-xs ${secondaryText} mb-2`}>{selectedFile}</div>
              <div className={`p-3 rounded border ${borderColor} max-h-80 overflow-auto`}>
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {fileContent}
                </pre>
              </div>
            </div>
          ) : (
            <div className={`p-8 text-center ${secondaryText} border ${borderColor} rounded`}>
              <p className="text-sm">Select a file to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className={`p-4 border-t ${borderColor} grid grid-cols-3 gap-4`}>
        <div className="text-center">
          <div className="text-2xl font-bold">{props.texFiles.length}</div>
          <div className={`text-xs ${secondaryText}`}>.tex files</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">
            {props.files.reduce((sum, f) => sum + f.size, 0) < 1024 * 1024
              ? `${(props.files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(0)}`
              : `${(props.files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(1)}`}
          </div>
          <div className={`text-xs ${secondaryText}`}>
            {props.files.reduce((sum, f) => sum + f.size, 0) < 1024 * 1024 ? "KB" : "MB"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{props.files.filter(f => f.isDirectory).length}</div>
          <div className={`text-xs ${secondaryText}`}>directories</div>
        </div>
      </div>
    </div>
  );
};

export default ProjectBrowser;
