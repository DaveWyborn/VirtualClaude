"use client";

import { useState, useEffect } from "react";
import { Project, ServerStats, getServerStats } from "@/lib/api";

interface SidebarProps {
  projects: Project[];
  selectedProject: string | null;
  onSelect: (name: string) => void;
  onCreate: () => void;
  onDelete: (name: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function StatBar({ label, value, max, unit }: { label: string; value: number; max: number; unit?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const colour = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
        <span>{label}</span>
        <span>{unit ? `${formatBytes(value)} / ${formatBytes(max)}` : `${pct}%`}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Sidebar({
  projects,
  selectedProject,
  onSelect,
  onCreate,
  onDelete,
}: SidebarProps) {
  const [stats, setStats] = useState<ServerStats | null>(null);

  useEffect(() => {
    let active = true;

    const fetchStats = async () => {
      try {
        const data = await getServerStats();
        if (active) setStats(data);
      } catch {
        // server might not be reachable yet
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => { active = false; clearInterval(interval); };
  }, []);

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

      {/* Server stats */}
      <div className="px-4 py-3 border-t border-gray-200 space-y-2">
        {stats ? (
          <>
            <StatBar label="CPU" value={stats.cpu} max={100} />
            <StatBar label="RAM" value={stats.ramUsed} max={stats.ramTotal} unit="bytes" />
            <StatBar label="Disk" value={stats.diskUsed} max={stats.diskTotal} unit="bytes" />
          </>
        ) : (
          <p className="text-[10px] text-gray-400 text-center">Connecting...</p>
        )}
      </div>
    </aside>
  );
}
