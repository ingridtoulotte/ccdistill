'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

/**
 * Resolve the Claude Code data directory.
 * Precedence: explicit override > CLAUDE_CONFIG_DIR > ~/.claude
 */
function claudeDir(override) {
  if (override) return path.resolve(override);
  if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR;
  return path.join(os.homedir(), '.claude');
}

/**
 * Claude Code maps a project cwd to a folder name under ~/.claude/projects
 * by replacing every character outside [A-Za-z0-9] with '-'.
 * e.g. "D:\proj\alpha" -> "D--proj-alpha", "/home/me/app" -> "-home-me-app"
 */
function encodeProjectPath(p) {
  return String(p).replace(/[^A-Za-z0-9]/g, '-');
}

function projectsRoot(dir) {
  return path.join(dir, 'projects');
}

/**
 * List project folders that contain at least one transcript.
 * Returns [{ name, path, transcripts: [absolute .jsonl paths] }]
 */
function listProjects(dir) {
  const root = projectsRoot(dir);
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const projects = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = path.join(root, e.name);
    const transcripts = listTranscripts(full);
    if (transcripts.length === 0) continue;
    projects.push({ name: e.name, path: full, transcripts });
  }
  return projects;
}

function listTranscripts(projectPath) {
  let files;
  try {
    files = fs.readdirSync(projectPath);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(projectPath, f));
}

module.exports = {
  claudeDir,
  encodeProjectPath,
  projectsRoot,
  listProjects,
  listTranscripts,
};
