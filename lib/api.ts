const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

export interface Project {
  name: string;
  path: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

function headers(): HeadersInit {
  return {
    "X-API-Key": API_KEY,
  };
}

function jsonHeaders(): HeadersInit {
  return {
    ...headers(),
    "Content-Type": "application/json",
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_URL}/api/projects`, { headers: headers() });
  return handleResponse<Project[]>(res);
}

export async function createProject(name: string): Promise<Project> {
  const res = await fetch(`${API_URL}/api/projects`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ name }),
  });
  return handleResponse<Project>(res);
}

export async function deleteProject(name: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/projects/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

export async function getFiles(projectName: string): Promise<FileNode[]> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(projectName)}/files`,
    { headers: headers() }
  );
  return handleResponse<FileNode[]>(res);
}

export async function getFileContent(
  projectName: string,
  filePath: string
): Promise<{ url: string; isText: boolean; content?: string }> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(projectName)}/files/${filePath}`,
    { headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch file: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const isText =
    contentType.includes("text") ||
    contentType.includes("json") ||
    contentType.includes("javascript") ||
    contentType.includes("xml") ||
    contentType.includes("yaml") ||
    contentType.includes("markdown");

  if (isText) {
    const content = await res.text();
    return { url: "", isText: true, content };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { url, isText: false };
}

export async function uploadFile(
  projectName: string,
  file: File,
  dirPath: string
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", dirPath);

  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(projectName)}/upload`,
    {
      method: "POST",
      headers: { "X-API-Key": API_KEY },
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Upload failed: ${text}`);
  }
}

export async function downloadFile(
  projectName: string,
  filePath: string,
  fileName: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(projectName)}/files/${filePath}`,
    { headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function deleteFile(
  projectName: string,
  filePath: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(projectName)}/files/${filePath}`,
    {
      method: "DELETE",
      headers: headers(),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Delete failed: ${text}`);
  }
}

export interface ServerStats {
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
}

export async function getServerStats(): Promise<ServerStats> {
  const res = await fetch(`${API_URL}/api/stats`, { headers: headers() });
  return handleResponse<ServerStats>(res);
}

export function getTerminalWsUrl(projectName: string): string {
  const wsBase = API_URL.replace(/^http/, "ws");
  return `${wsBase}/terminal?project=${encodeURIComponent(projectName)}&apiKey=${encodeURIComponent(API_KEY)}`;
}
