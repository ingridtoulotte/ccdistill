'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { encodeProjectPath, claudeDir, listProjects } = require('../src/lib/paths');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'home', '.claude');

test('encodeProjectPath matches Claude Code folder naming', () => {
  assert.equal(encodeProjectPath('D:\\'), 'D--');
  assert.equal(encodeProjectPath('D:\\proj\\alpha'), 'D--proj-alpha');
  assert.equal(encodeProjectPath('/home/me/my app'), '-home-me-my-app');
  assert.equal(encodeProjectPath('C:\\Users\\x\\dev.project'), 'C--Users-x-dev-project');
});

test('claudeDir override wins', () => {
  assert.equal(claudeDir('D:\\custom'), path.resolve('D:\\custom'));
});

test('listProjects finds fixture projects with transcripts', () => {
  const projects = listProjects(FIXTURE_DIR);
  const names = projects.map((p) => p.name).sort();
  assert.deepEqual(names, ['D--proj-alpha', 'D--proj-beta']);
  assert.equal(projects[0].transcripts.length, 1);
});

test('listProjects on a missing dir returns empty, never throws', () => {
  assert.deepEqual(listProjects('Z:\\does\\not\\exist'), []);
});
