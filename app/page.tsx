"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <FileBrowser
            projectName={selectedProject}
            files={files}
            onRefresh={handleRefreshFiles}
          />
          <Terminal projectName={selectedProject} />
        </>
      )}
    </div>
  );
}
