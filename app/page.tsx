"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import FileBrowser from "@/components/FileBrowser";
import {
  Project,
  FileNode,
  getProjects,
  createProject,
  deleteProject,
  getFiles,
} from "@/lib/api";

const Terminal = dynamic(() => import("@/components/Terminal"), { ssr: false });

const MIN_WIDTH = 180;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 320;

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filesWidth, setFilesWidth] = useState<number>(DEFAULT_WIDTH);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const draggingRef = useRef(false);

  // Restore persisted width/collapsed state
  useEffect(() => {
    const w = localStorage.getItem("filesWidth");
    const c = localStorage.getItem("filesCollapsed");
    if (w) setFilesWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(w, 10))));
    if (c === "true") setFilesCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("filesWidth", String(filesWidth));
  }, [filesWidth]);

  useEffect(() => {
    localStorage.setItem("filesCollapsed", String(filesCollapsed));
  }, [filesCollapsed]);

  // Drag handlers
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const sidebarWidth = 224; // w-56
      const newWidth = e.clientX - sidebarWidth;
      setFilesWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
    };
    const handleUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoadingProjects(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load projects"
      );
    } finally {
      setLoadingProjects(false);
    }
  };

  // Load files when project changes
  useEffect(() => {
    if (selectedProject) {
      loadFiles(selectedProject);
    } else {
      setFiles([]);
    }
  }, [selectedProject]);

  const loadFiles = async (projectName: string) => {
    setLoadingFiles(true);
    try {
      const data = await getFiles(projectName);
      setFiles(data);
    } catch (err) {
      console.error("Failed to load files:", err);
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleCreateProject = async () => {
    const name = window.prompt("Enter project name:");
    if (!name || !name.trim()) return;

    try {
      await createProject(name.trim());
      await loadProjects();
      setSelectedProject(name.trim());
    } catch (err) {
      alert(
        `Failed to create project: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  const handleDeleteProject = async (name: string) => {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`))
      return;

    try {
      await deleteProject(name);
      if (selectedProject === name) {
        setSelectedProject(null);
      }
      await loadProjects();
    } catch (err) {
      alert(
        `Failed to delete project: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  const handleRefreshFiles = useCallback(() => {
    if (selectedProject) {
      loadFiles(selectedProject);
    }
  }, [selectedProject]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelect={setSelectedProject}
        onCreate={handleCreateProject}
        onDelete={handleDeleteProject}
      />

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <button
              onClick={loadProjects}
              className="text-sm text-blue-600 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!error && !selectedProject && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">{"\uD83D\uDEE0\uFE0F"}</div>
            <h1 className="text-xl font-semibold text-gray-800 mb-2">
              Claude Workspace
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              {loadingProjects
                ? "Loading projects..."
                : projects.length === 0
                  ? "Create your first project to get started. Click the + button in the sidebar."
                  : "Select a project from the sidebar to view its files and open a terminal."}
            </p>
          </div>
        </div>
      )}

      {!error && selectedProject && (
        <>
          {!filesCollapsed && (
            <>
              <div style={{ width: filesWidth }} className="shrink-0 flex flex-col">
                <FileBrowser
                  projectName={selectedProject}
                  files={files}
                  onRefresh={handleRefreshFiles}
                  onCollapse={() => setFilesCollapsed(true)}
                />
              </div>
              <div
                onMouseDown={startDrag}
                className="w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors"
                title="Drag to resize"
              />
            </>
          )}
          {filesCollapsed && (
            <button
              onClick={() => setFilesCollapsed(false)}
              className="w-6 shrink-0 bg-gray-100 hover:bg-gray-200 border-r border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
              title="Show files"
            >
              {"\u25B6"}
            </button>
          )}
          <Terminal projectName={selectedProject} />
        </>
      )}
    </div>
  );
}
