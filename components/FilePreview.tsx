"use client";

import { useEffect, useState } from "react";
import { getFileContent } from "@/lib/api";

interface FilePreviewProps {
  projectName: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

function isImageFile(name: string): boolean {
  return /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(name);
}

function isPdfFile(name: string): boolean {
  return /\.pdf$/i.test(name);
}

export default function FilePreview({
  projectName,
  filePath,
  fileName,
  onClose,
}: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getFileContent(projectName, filePath);
        if (cancelled) return;

        if (result.isText) {
          setContent(result.content || "");
          setBlobUrl(null);
        } else {
          setBlobUrl(result.url);
          setContent(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectName, filePath]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 truncate">
            {fileName}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
          >
            {"\u2715"}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-gray-500">Loading...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && isPdfFile(fileName) && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">{"\uD83D\uDCC4"}</p>
              <p className="text-gray-600 text-sm">PDF uploaded successfully</p>
              <p className="text-gray-400 text-xs mt-1">{fileName}</p>
            </div>
          )}

          {!loading && !error && isImageFile(fileName) && blobUrl && (
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={blobUrl}
                alt={fileName}
                className="max-w-full max-h-[65vh] object-contain rounded"
              />
            </div>
          )}

          {!loading &&
            !error &&
            !isImageFile(fileName) &&
            !isPdfFile(fileName) &&
            content !== null && (
              <pre className="text-sm text-gray-800 bg-gray-50 rounded-lg p-4 overflow-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
                {content}
              </pre>
            )}

          {!loading &&
            !error &&
            !isImageFile(fileName) &&
            !isPdfFile(fileName) &&
            blobUrl && (
              <div className="text-center py-12">
                <p className="text-gray-600 text-sm">
                  Binary file — preview not available
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
