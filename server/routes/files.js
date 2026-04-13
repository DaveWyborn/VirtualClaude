const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const mime = require('mime-types');
const multer = require('multer');

const router = express.Router();

const VALID_NAME = /^[a-zA-Z0-9-]+$/;
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.next']);

function getProjectsDir() {
  return process.env.PROJECTS_DIR || '/home/writer/projects';
}

function safePath(projectsDir, projectName, relativePath) {
  const base = path.resolve(projectsDir, projectName);
  const full = relativePath
    ? path.resolve(base, relativePath)
    : base;

  if (!full.startsWith(base + path.sep) && full !== base) {
    return null;
  }
  return full;
}

// Build recursive file tree
async function buildTree(dirPath, baseDir) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, baseDir);
      result.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children
      });
    } else if (entry.isFile()) {
      result.push({
        name: entry.name,
        path: relativePath,
        type: 'file'
      });
    }
    // Skip symlinks and other special entries
  }

  // Sort: directories first, then alphabetical
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

// Configure multer for file uploads — store in temp, move on request
const upload = multer({ dest: '/tmp/claude-workspace-uploads' });

// GET /api/projects/:name/files — recursive file tree
router.get('/:name/files', async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!VALID_NAME.test(name)) {
      return res.status(400).json({ error: 'Invalid project name' });
    }

    const projectsDir = getProjectsDir();
    const projectPath = safePath(projectsDir, name);
    if (!projectPath) return res.status(403).json({ error: 'Path traversal denied' });

    try {
      await fs.access(projectPath);
    } catch {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tree = await buildTree(projectPath, projectPath);
    res.json(tree);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:name/files/* — read a file
router.get('/:name/files/*', async (req, res, next) => {
  try {
    const { name } = req.params;
    // Express puts the wildcard part in params[0]
    const filePath = req.params[0];

    if (!VALID_NAME.test(name)) {
      return res.status(400).json({ error: 'Invalid project name' });
    }
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }

    const projectsDir = getProjectsDir();
    const fullPath = safePath(projectsDir, name, filePath);
    if (!fullPath) return res.status(403).json({ error: 'Path traversal denied' });

    // Check it's a file (not directory, not symlink outside)
    let stat;
    try {
      stat = await fs.lstat(fullPath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Not a file' });
    }

    // Check symlink doesn't escape
    if (stat.isSymbolicLink()) {
      const realPath = await fs.realpath(fullPath);
      const projectRoot = path.resolve(projectsDir, name);
      if (!realPath.startsWith(projectRoot + path.sep) && realPath !== projectRoot) {
        return res.status(403).json({ error: 'Symlink escapes project directory' });
      }
    }

    const contentType = mime.lookup(fullPath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    const content = await fs.readFile(fullPath);
    res.send(content);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:name/upload — multipart file upload
router.post('/:name/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!VALID_NAME.test(name)) {
      return res.status(400).json({ error: 'Invalid project name' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const projectsDir = getProjectsDir();
    const relativeDirPath = req.body.path || '';
    const targetDir = safePath(projectsDir, name, relativeDirPath);
    if (!targetDir) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: 'Path traversal denied' });
    }

    await fs.mkdir(targetDir, { recursive: true });

    const destPath = path.join(targetDir, req.file.originalname);
    // Verify final path is still safe
    const resolvedDest = path.resolve(destPath);
    const projectRoot = path.resolve(projectsDir, name);
    if (!resolvedDest.startsWith(projectRoot + path.sep)) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: 'Path traversal denied' });
    }

    await fs.rename(req.file.path, destPath);
    res.status(201).json({
      ok: true,
      path: path.relative(projectRoot, destPath)
    });
  } catch (err) {
    // Clean up temp file on error
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    next(err);
  }
});

// DELETE /api/projects/:name/files/* — delete a file
router.delete('/:name/files/*', async (req, res, next) => {
  try {
    const { name } = req.params;
    const filePath = req.params[0];

    if (!VALID_NAME.test(name)) {
      return res.status(400).json({ error: 'Invalid project name' });
    }
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }

    const projectsDir = getProjectsDir();
    const fullPath = safePath(projectsDir, name, filePath);
    if (!fullPath) return res.status(403).json({ error: 'Path traversal denied' });

    await fs.rm(fullPath, { recursive: true });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

module.exports = router;
