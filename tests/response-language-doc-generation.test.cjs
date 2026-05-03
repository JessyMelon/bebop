/**
 * Response language propagation for durable generated docs.
 *
 * These guards ensure codebase maps and CodeWiki pages honor the existing
 * response_language config instead of defaulting to English prose.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('response_language for codebase and CodeWiki docs', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init map-codebase emits response_language from config', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      response_language: 'Simplified Chinese'
    }, null, 2));

    const result = runGsdTools('init map-codebase', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init map-codebase should succeed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.response_language, 'Simplified Chinese');
  });

  test('map-codebase workflow passes response_language into mapper prompts', () => {
    const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'map-codebase.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('response_language'), 'workflow should extract response_language');
    assert.ok(content.includes('Response language: {response_language}'), 'mapper prompts should carry response_language');
    assert.ok(content.includes('Target repos: {target_repos}'), 'mapper prompts should carry repo scope');
    assert.ok(content.includes('preserve existing content'), 'workflow should preserve existing content in repo scope');
    assert.ok(
      content.includes('write all generated Markdown documents'),
      'workflow should require generated Markdown to use the configured language'
    );
  });

  test('codebase mapper and CodeWiki maintainer honor response_language', () => {
    const mapperPath = path.join(__dirname, '..', 'agents', 'gsd-codebase-mapper.md');
    const maintainerPath = path.join(__dirname, '..', 'agents', 'gsd-codewiki-maintainer.md');
    const updateWorkflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'codewiki-update.md');

    const mapper = fs.readFileSync(mapperPath, 'utf8');
    const maintainer = fs.readFileSync(maintainerPath, 'utf8');
    const updateWorkflow = fs.readFileSync(updateWorkflowPath, 'utf8');

    assert.ok(mapper.includes('Document language'), 'mapper should document language behavior');
    assert.ok(mapper.includes('Response language:'), 'mapper should detect prompt language');
    assert.ok(maintainer.includes('response_language'), 'maintainer should read or receive response_language');
    assert.ok(maintainer.includes('.planning/config.json'), 'maintainer should read project config when present');
    assert.ok(updateWorkflow.includes('response_language'), 'CodeWiki update workflow should propagate response_language');
  });

  test('CodeWiki enrich workflow writes generated docs in response_language', () => {
    const enrichWorkflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'codewiki-enrich.md');
    const content = fs.readFileSync(enrichWorkflowPath, 'utf8');

    assert.ok(content.includes('response_language'), 'enrich workflow should read response_language');
    assert.ok(
      content.includes('all generated CodeWiki Markdown'),
      'enrich workflow should require generated CodeWiki Markdown to use response_language'
    );
    assert.ok(
      content.includes('Keep code, commands, file paths'),
      'enrich workflow should keep technical identifiers unchanged'
    );
  });

  test('CodeWiki review workflow writes review questions in response_language', () => {
    const reviewWorkflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'codewiki-review.md');
    const content = fs.readFileSync(reviewWorkflowPath, 'utf8');

    assert.ok(content.includes('response_language'), 'review workflow should read response_language');
    assert.ok(
      content.includes('all generated review questions'),
      'review workflow should require generated review questions to use response_language'
    );
    assert.ok(
      content.includes('Keep code, commands, file paths'),
      'review workflow should keep technical identifiers unchanged'
    );
  });

  test('CodeWiki apply-review workflow writes applied review prose in response_language', () => {
    const applyWorkflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'codewiki-apply-review.md');
    const content = fs.readFileSync(applyWorkflowPath, 'utf8');

    assert.ok(content.includes('response_language'), 'apply-review workflow should read response_language');
    assert.ok(
      content.includes('all generated CodeWiki prose'),
      'apply-review workflow should require generated CodeWiki prose to use response_language'
    );
    assert.ok(
      content.includes('Keep code, commands, file paths'),
      'apply-review workflow should keep technical identifiers unchanged'
    );
  });
});
