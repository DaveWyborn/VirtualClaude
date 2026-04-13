"use client";

import { useState, useCallback, useRef } from "react";
import { FileNode, uploadFile, deleteFile, getFiles } from "@/lib/api";
import FilePreview from "./FilePreview";

interface FileBrowserProps {
  projectName: string;
  files: FileNode[];
  onRefresh: () => void;
}

function FileTreeItem({
  node,
  depth,
  projectName,
  onDelete,
  onPreview,
}: {
  node: FileNode;
  depth: number;
  projectName: string;
  onDelete: (path: string) => void;
  onPreview: (path: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  const isDir = node.type === "directory";
  const paddingLeft = 12 + depth * 16;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 py-1 pr-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
        style={{ paddingLeft }}
        onClick={() => {
          if (isDir) {
            setExpanded(!expanded);
          } else {
            onPreview(node.path, node.name);
          }
        }}
      >
        {isDir && (
          <span
            className={`text-[10px] text-gray-400 transition-transform w-3 text-center ${
              expanded ? "rotate-90" : ""
            }`}
          >
            {"\u25B6"}
          </span>
        )}
        {!isDir && <span className="w-3" />}

        <span className="text-sm shrink-0">
          {isDir ? "\uD83D\uDCC1" : "\uD83D\uDCC4"}
        </span>

        <span className="text-sm text-gray-700 truncate flex-1">
          {node.name}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.path);
          }}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all text-xs shrink-0"
          title="Delete"
        >
          {"\u2715"}
        </button>
      </div>

      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              projectName={projectName}
              onDelete={onDelete}
              onPreview={onPreview}
            />
          ))}
          {node.children.length === 0 && (
            <p
              className="text-xs text-gray-400 italic py-1"
              style={{ paddingLeft: paddingLeft + 16 }}
            >
              Empty folder
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function FileBrowser({
  projectName,
  files,
  onRefresh,
}: FileBrowserProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (fileList: FileList) => {
      setUploading(true);
      const total = fileList.length;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress(`Uploading ${i + 1}/${total}: ${file.name}`);
        try {
          await uploadFile(projectName, file, "");
        } catch (err) {
          console.error("Upload failed:", err);
          alert(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      setUploading(false);
      setUploadProgress(null);
      onRefresh();
    },
    [projectName, onRefresh]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  const handleDeleteFile = useCallback(
    async (filePath: string) => {
      if (!window.confirm(`Delete "${filePath}"?`)) return;
      try {
        await deleteFile(projectName, filePath);
        onRefresh();
      } catch (err) {
        alert(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    },
    [projectName, onRefresh]
  );

  return (
    <div className="flex-1 min-w-[300px] flex flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Files</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded hover:bg-gray-100"
            title="Refresh files"
          >
            {"\u21BB"} Refresh
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors"
          >
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleUpload(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {files.length === 0 && !uploading && (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">
            No files yet. Upload files or use the terminal to create them.
          </p>
        )}

        {files.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            depth={0}
            projectName={projectName}
            onDelete={handleDeleteFile}
            onPreview={(path, name) => setPreview({ path, name })}
          />
        ))}
      </div>

      {/* Upload progress */}
      {uploading && uploadProgress && (
        <div className="px-4 py-2 border-t border-gray-200 bg-blue-50">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-xs text-blue-700 truncate">{uploadProgress}</p>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`mx-3 mb-3 border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-200 hover:border-gray-300"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <p className="text-xs text-gray-400">
          {dragOver ? "Drop files here" : "Drag and drop files to upload"}
        </p>
      </div>

      {/* File preview modal */}
      {preview && (
        <FilePreview
          projectName={projectName}
          filePath={preview.path}
          fileName={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
