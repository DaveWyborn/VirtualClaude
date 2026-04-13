"use client";

import { Project } from "@/lib/api";

interface SidebarProps {
  projects: Project[];
  selectedProject: string | null;
  onSelect: (name: string) => void;
  onCreate: () => void;
  onDelete: (name: string) => void;
}

export default function Sidebar({
  projects,
  selectedProject,
  onSelect,
  onCreate,
  onDelete,
}: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Projects
        </h2>
        <button
          onClick={onCreate}
          className="w-7 h-7 flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-lg leading-none"
          title="New project"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            No projects yet. Click + to create one.
          </p>
        )}

        {projects.map((project) => (
          <div
            key={project.name}
            className={`group flex items-center gap-2 px-3 py-2 mx-1 rounded-md cursor-pointer transition-colors ${
              selectedProject === project.name
                ? "bg-blue-100 text-blue-900"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => onSelect(project.name)}
          >
            <span className="text-base shrink-0" role="img" aria-label="folder">
              {"\uD83D\uDCC1"}
            </span>
            <span className="text-sm font-medium truncate flex-1">
              {project.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project.name);
              }}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all text-xs"
              title="Delete project"
            >
              {"\u2715"}
            </button>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-200">
        <p className="text-xs text-gray-400">Claude Workspace</p>
      </div>
    </aside>
  );
}
