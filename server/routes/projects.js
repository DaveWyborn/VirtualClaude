const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const router = express.Router();

const VALID_NAME = /^[a-zA-Z0-9-]+$/;

const STARTER_CLAUDE_MD = (name) => `# Project: ${name}

## Working style
- Be concise and direct
- Explain what you're doing and why
- When working with files in this project, read them before editing

## File context
When asked about uploaded files (images, screenshots, PDFs), read them using your Read tool and incorporate them into your work.
`;

function getProjectsDir() {
  return process.env.PROJECTS_DIR || '/home/writer/projects';
}

// List all projects
router.get('/', async (req, res, next) => {
  try {
    const projectsDir = getProjectsDir();
    await fs.mkdir(projectsDir, { recursive: true });
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    const projects = entries
      .filter(e => e.isDirectory())
      .map(e => ({ name: e.name }));
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// Create a project
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !VALID_NAME.test(name)) {
      return res.status(400).json({ error: 'Invalid project name. Use alphanumeric characters and hyphens only.' });
    }
    const projectsDir = getProjectsDir();
    const projectPath = path.join(projectsDir, name);

    // Check it doesn't already exist
    try {
      await fs.access(projectPath);
      return res.status(409).json({ error: 'Project already exists' });
    } catch {
      // Good — doesn't exist
    }

    await fs.mkdir(projectPath, { recursive: true });
    await fs.writeFile(path.join(projectPath, 'CLAUDE.md'), STARTER_CLAUDE_MD(name));

    res.status(201).json({ name, path: projectPath });
  } catch (err) {
    next(err);
  }
});

// Delete a project
router.delete('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!VALID_NAME.test(name)) {
      return res.status(400).json({ error: 'Invalid project name' });
    }
    const projectsDir = getProjectsDir();
    const projectPath = path.join(projectsDir, name);

    // Verify it's within PROJECTS_DIR
    const resolved = path.resolve(projectPath);
    if (!resolved.startsWith(path.resolve(projectsDir) + path.sep)) {
      return res.status(403).json({ error: 'Path traversal denied' });
    }

    await fs.rm(projectPath, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
