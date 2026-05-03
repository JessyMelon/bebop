/**
 * Tests for CodeWiki selection/status query handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';

import { createRegistry } from './index.js';
import {
  codewikiContract, codewikiDeepWikiExport, codewikiFlow, codewikiFreeze, codewikiIndex, codewikiInit,
  codewikiPack,
  codewikiProject, codewikiSelect, codewikiStatus, codewikiUpdate, codewikiVerify,
} from './codewiki.js';
import { intelQuery } from './intel.js';

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

async function createRepo(workspace: string, name: string, wikiRoot: string): Promise<{ repo: string; commit: string; branch: string }> {
  const repo = join(workspace, name);
  await mkdir(repo, { recursive: true });
  git(repo, ['init']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'Test User']);
  await mkdir(join(repo, '.planning'), { recursive: true });
  await writeFile(
    join(repo, '.planning', 'config.json'),
    JSON.stringify({ codewiki: { root: relative(repo, wikiRoot) } }, null, 2),
  );
  await writeFile(join(repo, 'README.md'), `# ${name}\n`);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', 'initial']);
  return {
    repo,
    commit: git(repo, ['rev-parse', 'HEAD']),
    branch: git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']),
  };
}

async function addPackageJson(repo: string, pkg: Record<string, unknown>): Promise<void> {
  await writeFile(join(repo, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  git(repo, ['add', 'package.json']);
  git(repo, ['commit', '-m', 'add package metadata']);
}

async function writeRepoWiki(
  wikiRoot: string,
  repoId: string,
  repoPath: string,
  branch: string,
  commit: string,
  status = 'active',
): Promise<{ manifest: string; wikiPath: string; snapshot: string }> {
  const manifestDir = join(wikiRoot, repoId, branch, 'latest');
  const wikiPath = join(manifestDir, 'coder-llm-wiki');
  const snapshot = join(wikiPath, '10-snapshots', 'snapshot.md');
  await mkdir(join(wikiPath, '00-meta'), { recursive: true });
  await mkdir(join(wikiPath, '09-review'), { recursive: true });
  await mkdir(join(wikiPath, '10-snapshots'), { recursive: true });
  await writeFile(join(wikiPath, '00-meta', 'status-dashboard.md'), '# Status\n');
  await writeFile(join(wikiPath, '09-review', 'open-questions.md'), '- Should API docs mention retry behavior?\n');
  await writeFile(snapshot, '# Snapshot\n');

  const manifest = join(manifestDir, 'manifest.yaml');
  await writeFile(
    manifest,
    [
      `repo_id: ${repoId}`,
      `source_repo: ${repoPath}`,
      `ref_type: branch`,
      `ref_name: ${branch}`,
      `commit_sha: ${commit}`,
      `status: ${status}`,
      `paths:`,
      `  wiki_root: coder-llm-wiki`,
      `  latest_snapshot: coder-llm-wiki/10-snapshots/snapshot.md`,
      `freshness:`,
      `  valid_for_commit: ${commit}`,
      `  stale_if_commit_differs: true`,
      '',
    ].join('\n'),
  );
  return { manifest, wikiPath, snapshot };
}

async function writeRepoIndex(
  wikiRoot: string,
  repoId: string,
  repoPath: string,
  branch: string,
  commit: string,
): Promise<void> {
  await mkdir(wikiRoot, { recursive: true });
  await writeFile(
    join(wikiRoot, 'wiki-index.yaml'),
    [
      'repos:',
      `  ${repoId}:`,
      `    source_repo: ${repoPath}`,
      '    versions:',
      `      - version_id: ${repoId}__${branch}`,
      '        ref_type: branch',
      `        ref_name: ${branch}`,
      `        commit_sha: ${commit}`,
      `        code_worktree: ${repoPath}`,
      `        wiki_path: ${repoId}/${branch}/latest/coder-llm-wiki`,
      `        manifest: ${repoId}/${branch}/latest/manifest.yaml`,
      '        status: active',
      '',
    ].join('\n'),
  );
}

async function writeSet(
  wikiRoot: string,
  setId: string,
  members: Array<{ repoId: string; repoPath: string; branch: string; commit: string; required?: boolean }>,
): Promise<void> {
  const setDir = join(wikiRoot, 'sets', setId);
  await mkdir(join(setDir, 'snapshots'), { recursive: true });
  await writeFile(join(setDir, 'snapshots', 'set.md'), '# Set Snapshot\n');
  await writeFile(
    join(setDir, 'wiki-set.yaml'),
    [
      `set_id: ${setId}`,
      `name: ${setId}`,
      `status: active`,
      `members:`,
      ...members.flatMap(member => [
        `  - repo_id: ${member.repoId}`,
        `    role: service`,
        `    required: ${member.required ?? true}`,
        `    source_repo: ${member.repoPath}`,
        `    ref_type: branch`,
        `    ref_name: ${member.branch}`,
        `    commit_sha: ${member.commit}`,
        `    manifest: ../../${member.repoId}/${member.branch}/latest/manifest.yaml`,
        `    wiki_path: ../../${member.repoId}/${member.branch}/latest/coder-llm-wiki`,
      ]),
      `compatibility:`,
      `  tuple_id: ${setId}__tuple`,
      `paths:`,
      `  latest_snapshot: snapshots/set.md`,
      '',
    ].join('\n'),
  );
  await writeFile(
    join(wikiRoot, 'wiki-index.yaml'),
    [
      'sets:',
      `  ${setId}:`,
      `    manifest: sets/${setId}/wiki-set.yaml`,
      '    status: active',
      '',
    ].join('\n'),
  );
}

describe('codewikiSelect', () => {
  let workspace: string;
  let wikiRoot: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'gsd-codewiki-'));
    wikiRoot = join(workspace, 'code-wiki');
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('initializes a repo namespace and index', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);

    const init = await codewikiInit(['--repo-id', 'app'], app.repo);
    const initData = init.data as Record<string, unknown>;
    const members = initData.members as Array<Record<string, unknown>>;
    const manifestPath = members[0].manifest_path as string;

    expect(initData.initialized).toBe(true);
    expect(await readFile(join(wikiRoot, 'wiki-index.yaml'), 'utf-8')).toContain('repos:');
    expect(await readFile(manifestPath, 'utf-8')).toContain(app.commit);

    const selected = (await codewikiSelect([], app.repo)).data as Record<string, unknown>;
    expect(selected.state).toBe('current');
  });

  it('scaffolds the full coder-llm-wiki contract and starter queue on init', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);

    const init = await codewikiInit(['--repo-id', 'app'], app.repo);
    const initData = init.data as Record<string, unknown>;
    const members = initData.members as Array<Record<string, unknown>>;
    const wikiPath = members[0].wiki_path as string;

    for (const relPath of [
      'README.md',
      '00-meta/project-charter.md',
      '00-meta/workflow-contract.md',
      '00-meta/quality-gates.md',
      '00-meta/command-contract.md',
      '00-meta/review-rubric.md',
      '00-meta/snapshot-format.md',
      '00-meta/agent-seeds.json',
      '00-meta/source-scope.json',
      '00-meta/opencode-dispatch-checklist.md',
      '03-modules/_template.md',
      '04-flows/_template.md',
      '05-data/_template.md',
      '06-ops/_template.md',
      '07-risks/_template.md',
      '08-evidence/_template.md',
      '11-agent-seeds/README.md',
    ]) {
      await expect(readFile(join(wikiPath, relPath), 'utf-8')).resolves.toBeTruthy();
    }

    const progress = JSON.parse(await readFile(join(wikiPath, '00-meta', 'progress.json'), 'utf-8')) as Record<string, unknown>;
    const execution = progress.execution as Record<string, unknown>;
    expect(progress.phase).toBe('initialize');
    expect(progress.current_batch_id).toBe('bootstrap');
    expect(execution).toMatchObject({
      mode: 'deferred-review',
      ask_for_confirmation: false,
      block_on_human_review: false,
      max_auto_steps: 8,
      agent_seed: {
        enabled: true,
        requested_provider: 'auto',
        depth: 'quick',
        resolved_provider: 'none',
        status: 'not_run',
        seed_paths: [],
      },
      source_scope: {
        exclude_paths: [],
        exclude_file: 'coder-llm-wiki/00-meta/source-scope.json',
        allow_excluded_evidence: false,
      },
    });
    expect(Array.isArray(progress.completed_tasks)).toBe(true);

    const queue = JSON.parse(await readFile(join(wikiPath, '00-meta', 'task-queue.json'), 'utf-8')) as Record<string, unknown>;
    const tasks = queue.tasks as Array<Record<string, unknown>>;
    expect(tasks.map(task => task.id)).toEqual(['inventory-core', 'index-core']);
    expect(tasks.map(task => task.status)).toEqual(['pending', 'pending']);

    const dashboard = await readFile(join(wikiPath, '00-meta', 'status-dashboard.md'), 'utf-8');
    expect(dashboard).toContain('/gsd-codewiki-bootstrap');
    expect(dashboard).toContain('Agent seed：auto / none / quick / not_run');
    expect(dashboard).toContain('源码范围');
  });

  it('does not treat an init-only starter wiki as verified baseline', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);

    const verified = (await codewikiVerify([], app.repo)).data as Record<string, unknown>;
    const members = verified.members as Array<Record<string, unknown>>;
    const baseline = members[0].baseline as Record<string, unknown>;

    expect(verified.verified).toBe(false);
    expect(verified.baseline_verified).toBe(false);
    expect(verified.next_action).toBe('/gsd-codewiki-bootstrap <repo-id>');
    expect(baseline.pending_queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ task_id: 'inventory-core', status: 'pending' }),
      expect.objectContaining({ task_id: 'index-core', status: 'pending' }),
    ]));
  });

  it('does not overwrite an existing repo manifest on repeated init', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    const first = await codewikiInit(['--repo-id', 'app'], app.repo);
    const firstData = first.data as Record<string, unknown>;
    const members = firstData.members as Array<Record<string, unknown>>;
    const manifestPath = members[0].manifest_path as string;
    const original = await readFile(manifestPath, 'utf-8');
    await writeFile(manifestPath, `${original}# preserved local note\n`);

    const second = await codewikiInit(['--repo-id', 'app'], app.repo);
    const secondData = second.data as Record<string, unknown>;
    const reused = secondData.reused as string[];

    expect(await readFile(manifestPath, 'utf-8')).toContain('# preserved local note');
    expect(reused).toContain(manifestPath);
  });

  it('initializes a multi-repo set and can select it', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);

    const init = await codewikiInit(['--set', 'checkout', '--repos', `${web.repo},${api.repo}`], web.repo);
    const initData = init.data as Record<string, unknown>;

    expect(initData.initialized).toBe(true);
    expect(await readFile(join(wikiRoot, 'sets', 'checkout', 'wiki-set.yaml'), 'utf-8')).toContain('members:');

    const selected = (await codewikiSelect(['--set', 'checkout'], web.repo)).data as Record<string, unknown>;
    expect(selected.state).toBe('set-current');
  });

  it('infers member roles for frontend, backend, and shared library repos', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    const sdk = await createRepo(workspace, 'payment-sdk', wikiRoot);
    await addPackageJson(web.repo, { dependencies: { react: '^18.0.0', vite: '^5.0.0' } });
    await addPackageJson(api.repo, { dependencies: { express: '^4.0.0' } });
    await addPackageJson(sdk.repo, { name: '@acme/payment-sdk', main: 'dist/index.js', types: 'dist/index.d.ts' });

    const init = await codewikiInit(['--set', 'checkout', '--repos', `${web.repo},${api.repo},${sdk.repo}`], web.repo);
    const initData = init.data as Record<string, unknown>;
    const members = initData.members as Array<Record<string, unknown>>;
    const roleByRepo = Object.fromEntries(members.map(member => [member.repo_id, member.role]));
    const setContent = await readFile(join(wikiRoot, 'sets', 'checkout', 'wiki-set.yaml'), 'utf-8');
    const indexContent = await readFile(join(wikiRoot, 'wiki-index.yaml'), 'utf-8');

    expect(roleByRepo).toMatchObject({
      web: 'frontend',
      api: 'backend',
      'payment-sdk': 'shared-library',
    });
    expect(setContent).toContain('role: frontend');
    expect(setContent).toContain('role: backend');
    expect(setContent).toContain('role: shared-library');
    expect(indexContent).toContain('role: frontend');
  });

  it('initializes a set from existing sub_repos workspace metadata', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ codewiki: { root: 'code-wiki' }, sub_repos: ['web', 'api'] }, null, 2),
    );
    await createRepo(workspace, 'web', wikiRoot);
    await createRepo(workspace, 'api', wikiRoot);

    const init = await codewikiInit(['--set', 'checkout'], workspace);
    const initData = init.data as Record<string, unknown>;
    const members = initData.members as Array<Record<string, unknown>>;

    expect(members.map(member => member.repo_id).sort()).toEqual(['api', 'web']);
    expect(initData.warnings).toEqual([]);
    expect((await codewikiSelect(['--set', 'checkout'], workspace)).data).toMatchObject({ state: 'set-current' });
  });

  it('warns when configured CodeWiki members omit child Git repos during set init', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ codewiki: { root: 'code-wiki', member_repos: ['web'] } }, null, 2),
    );
    await createRepo(workspace, 'web', wikiRoot);
    await createRepo(workspace, 'api', wikiRoot);

    const init = await codewikiInit(['--set', 'checkout'], workspace);
    const initData = init.data as Record<string, unknown>;
    const warnings = initData.warnings as string[];

    expect(warnings.some(warning => warning.includes('Workspace repo drift before CodeWiki init'))).toBe(true);
    expect(warnings.some(warning => warning.includes('api'))).toBe(true);
  });

  it('initializes a set from a GSD WORKSPACE.md manifest when config repos are absent', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ codewiki: { root: 'code-wiki' } }, null, 2),
    );
    await writeFile(
      join(workspace, 'WORKSPACE.md'),
      [
        '# Workspace: checkout',
        '',
        '## Member Repos',
        '',
        '| Repo | Source | Branch | Strategy |',
        '|------|--------|--------|----------|',
        '| web | /source/web | workspace/checkout | worktree |',
        '| api | /source/api | workspace/checkout | worktree |',
        '',
      ].join('\n'),
    );
    await createRepo(workspace, 'web', wikiRoot);
    await createRepo(workspace, 'api', wikiRoot);

    const init = await codewikiInit(['--set', 'checkout'], workspace);
    const initData = init.data as Record<string, unknown>;
    const members = initData.members as Array<Record<string, unknown>>;

    expect(members.map(member => member.repo_id).sort()).toEqual(['api', 'web']);
    expect((await codewikiSelect(['--set', 'checkout'], workspace)).data).toMatchObject({ state: 'set-current' });
  });

  it('reports workspace repo drift across config, set, and child Git sources', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({
        codewiki: {
          root: 'code-wiki',
          active_set: 'checkout',
          member_repos: ['web'],
        },
        sub_repos: ['web', 'api'],
        planning: {
          sub_repos: ['web'],
        },
      }, null, 2),
    );
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await writeRepoWiki(wikiRoot, 'web', web.repo, web.branch, web.commit);
    await writeRepoWiki(wikiRoot, 'api', api.repo, api.branch, api.commit);
    await writeSet(wikiRoot, 'checkout', [
      { repoId: 'web', repoPath: web.repo, branch: web.branch, commit: web.commit },
      { repoId: 'api', repoPath: api.repo, branch: api.branch, commit: api.commit },
    ]);

    const selected = (await codewikiSelect(['--set', 'checkout'], workspace)).data as Record<string, unknown>;
    const drift = selected.workspace_drift as Record<string, unknown>;
    const issues = drift.issues as Array<Record<string, unknown>>;

    expect(selected.state).toBe('set-current');
    expect(drift.checked).toBe(true);
    expect(drift.consistent).toBe(false);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'codewiki.member_repos',
        missing_from_source: ['api'],
      }),
      expect.objectContaining({
        source: 'planning.sub_repos',
        missing_from_source: ['api'],
      }),
    ]));
    expect(selected.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Workspace repo drift'),
    ]));
  });

  it('updates a stale repo manifest and writes an update snapshot', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    const init = await codewikiInit(['--repo-id', 'app'], app.repo);
    const initData = init.data as Record<string, unknown>;
    const initMembers = initData.members as Array<Record<string, unknown>>;
    const namespaceDir = dirname(initMembers[0].manifest_path as string);
    await writeFile(join(namespaceDir, 'deepwiki-export', 'deepwiki.md'), '# DeepWiki seed\n');
    await writeFile(join(namespaceDir, 'repomix-output.xml'), '<repomix>seed</repomix>\n');
    await writeFile(join(app.repo, 'feature.txt'), 'new behavior\n');
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'feature']);
    const head = git(app.repo, ['rev-parse', 'HEAD']);

    const update = await codewikiUpdate([], app.repo);
    const updateData = update.data as Record<string, unknown>;
    const members = updateData.members as Array<Record<string, unknown>>;
    const manifestPath = members[0].manifest_path as string;
    const snapshotPath = members[0].snapshot_path as string;
    const seedSources = members[0].seed_sources as Array<Record<string, unknown>>;
    const maintenancePlanPath = members[0].maintenance_plan_path as string;
    const maintenancePlan = JSON.parse(await readFile(maintenancePlanPath, 'utf-8')) as Record<string, unknown>;
    const snapshotContent = await readFile(snapshotPath, 'utf-8');

    expect(updateData.updated).toBe(true);
    expect(await readFile(manifestPath, 'utf-8')).toContain(head);
    expect(snapshotContent).toContain('feature.txt');
    expect(snapshotContent).toContain('## 维护计划');
    expect(snapshotContent).toContain('仓库目标：');
    expect(snapshotContent).toContain('任务：');
    expect(snapshotContent).toContain('## Seed 来源');
    expect(snapshotContent).toContain('Seed 来源仅作为上下文');
    expect(snapshotContent).toContain('deepwiki-export/deepwiki.md');
    expect(snapshotContent).toContain('repomix-output.xml');
    expect(seedSources.map(source => source.kind).sort()).toEqual(['deepwiki', 'repomix']);
    expect(seedSources.every(source => source.evidence === false)).toBe(true);
    expect(maintenancePlan).toMatchObject({
      repo_id: 'app',
      seed_policy: {
        seed_sources_are_evidence: false,
      },
    });
    expect(maintenancePlan.changed_files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'feature.txt', classification: 'module-internal' }),
    ]));
    expect(maintenancePlan.repo_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'coder-llm-wiki/03-modules/' }),
      expect.objectContaining({ path: 'coder-llm-wiki/08-evidence/' }),
    ]));
    expect(maintenancePlan.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'pending',
        scope: 'repo',
        target_path: 'coder-llm-wiki/03-modules/',
        required_evidence: ['git_diff', 'source_files'],
      }),
    ]));

    const pendingVerify = (await codewikiVerify([], app.repo)).data as Record<string, unknown>;
    const pendingTotals = pendingVerify.totals as Record<string, unknown>;
    expect(pendingVerify.verified).toBe(false);
    expect(pendingTotals.unresolved as number).toBeGreaterThan(0);

    const tasks = (maintenancePlan.tasks as Array<Record<string, unknown>>).map(({ id, ...task }) => ({
      ...task,
      task_id: id,
    }));
    await writeFile(
      maintenancePlanPath,
      JSON.stringify({ ...maintenancePlan, tasks }, null, 2),
    );
    const updatedFileForTask = (task: Record<string, unknown>) =>
      (task.target_path as string).includes('08-evidence')
        ? 'coder-llm-wiki/08-evidence/feature.refs.md'
        : 'coder-llm-wiki/03-modules/feature.md';
    await writeFile(join(namespaceDir, 'coder-llm-wiki', '03-modules', 'feature.md'), '# Feature\n\n- Evidence: `feature.txt`\n');
    await writeFile(join(namespaceDir, 'coder-llm-wiki', '08-evidence', 'feature.refs.md'), '# Feature Evidence\n\n- `feature.txt`\n');
    await writeFile(
      join(namespaceDir, 'coder-llm-wiki', '00-meta', 'progress.json'),
      JSON.stringify({
        completed_tasks: tasks.map(task => ({
          task_id: task.task_id,
          status: 'completed',
          target_path: task.target_path,
          evidence_paths: ['feature.txt'],
          updated_files: [updatedFileForTask(task)],
        })),
      }, null, 2),
    );
    await writeFile(
      join(namespaceDir, 'coder-llm-wiki', '00-meta', 'task-queue.json'),
      JSON.stringify({ tasks: [] }, null, 2),
    );
    const verified = (await codewikiVerify([], app.repo)).data as Record<string, unknown>;
    const verifiedTotals = verified.totals as Record<string, unknown>;
    expect(verified.verified).toBe(true);
    expect(verifiedTotals.completed).toBe(tasks.length);
    expect((await codewikiSelect([], app.repo)).data).toMatchObject({ state: 'current' });
  });

  it('adds canonical durable ops targets for config changes', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);
    await writeFile(join(app.repo, 'package.json'), `${JSON.stringify({ scripts: { start: 'node server.js' } }, null, 2)}\n`);
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'config update']);

    const prepare = await codewikiUpdate(['--prepare-only'], app.repo);
    const prepareData = prepare.data as Record<string, unknown>;
    const members = prepareData.members as Array<Record<string, unknown>>;
    const maintenancePlanPath = members[0].maintenance_plan_path as string;
    const maintenancePlan = JSON.parse(await readFile(maintenancePlanPath, 'utf-8')) as Record<string, unknown>;
    const targetPaths = (maintenancePlan.repo_targets as Array<Record<string, unknown>>).map(target => target.path);

    expect(maintenancePlan.changed_files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'package.json', classification: 'config-change' }),
    ]));
    expect(targetPaths).toEqual(expect.arrayContaining([
      'coder-llm-wiki/02-index/',
      'coder-llm-wiki/06-ops/',
      'coder-llm-wiki/08-evidence/',
      'coder-llm-wiki/09-review/',
    ]));
  });

  it('prepares maintenance tasks before gated manifest promotion', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    const init = await codewikiInit(['--repo-id', 'app'], app.repo);
    const initData = init.data as Record<string, unknown>;
    const initMembers = initData.members as Array<Record<string, unknown>>;
    const namespaceDir = dirname(initMembers[0].manifest_path as string);
    const manifestPath = initMembers[0].manifest_path as string;
    await writeFile(join(app.repo, 'feature.txt'), 'new behavior\n');
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'feature']);
    const head = git(app.repo, ['rev-parse', 'HEAD']);

    const prepare = await codewikiUpdate(['--prepare-only'], app.repo);
    const prepareData = prepare.data as Record<string, unknown>;
    const prepareMembers = prepareData.members as Array<Record<string, unknown>>;
    const maintenancePlanPath = prepareMembers[0].maintenance_plan_path as string;
    const maintenancePlan = JSON.parse(await readFile(maintenancePlanPath, 'utf-8')) as Record<string, unknown>;

    expect(prepareData.updated).toBe(true);
    expect(prepareData.prepared).toBe(true);
    expect(prepareData.promoted).toBe(false);
    expect(prepareMembers[0].manifest_promoted).toBe(false);
    expect(await readFile(manifestPath, 'utf-8')).not.toContain(head);
    expect((await codewikiSelect([], app.repo)).data).toMatchObject({ state: 'stale' });
    expect(maintenancePlan.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'pending',
        target_path: 'coder-llm-wiki/03-modules/',
      }),
    ]));

    const blocked = await codewikiUpdate(['--promote-only'], app.repo);
    const blockedData = blocked.data as Record<string, unknown>;
    expect(blockedData.updated).toBe(false);
    expect(blockedData.promoted).toBe(false);
    expect(blockedData.error).toContain('maintenance verification failed');
    expect(await readFile(manifestPath, 'utf-8')).not.toContain(head);

    const tasks = (maintenancePlan.tasks as Array<Record<string, unknown>>).map(({ id, ...task }) => ({
      ...task,
      task_id: id,
    }));
    await writeFile(maintenancePlanPath, JSON.stringify({ ...maintenancePlan, tasks }, null, 2));
    await writeFile(join(namespaceDir, 'coder-llm-wiki', '03-modules', 'feature.md'), '# Feature\n\n- Evidence: `feature.txt`\n');
    await writeFile(join(namespaceDir, 'coder-llm-wiki', '08-evidence', 'feature.refs.md'), '# Feature Evidence\n\n- `feature.txt`\n');
    await writeFile(
      join(namespaceDir, 'coder-llm-wiki', '00-meta', 'progress.json'),
      JSON.stringify({
        completed_tasks: tasks.map(task => ({
          task_id: task.task_id,
          status: 'completed',
          target_path: task.target_path,
          evidence_paths: ['feature.txt'],
          updated_files: [
            (task.target_path as string).includes('08-evidence')
              ? 'coder-llm-wiki/08-evidence/feature.refs.md'
              : 'coder-llm-wiki/03-modules/feature.md',
          ],
        })),
      }, null, 2),
    );
    await writeFile(
      join(namespaceDir, 'coder-llm-wiki', '00-meta', 'task-queue.json'),
      JSON.stringify({ tasks: [] }, null, 2),
    );
    const fullVerifyBeforePromote = (await codewikiVerify([], app.repo)).data as Record<string, unknown>;
    expect(fullVerifyBeforePromote.verified).toBe(false);
    expect(fullVerifyBeforePromote.freshness_verified).toBe(false);
    expect(fullVerifyBeforePromote.tasks_verified).toBe(true);
    const maintenanceVerify = (await codewikiVerify(['--maintenance-only'], app.repo)).data as Record<string, unknown>;
    const maintenanceTotals = maintenanceVerify.totals as Record<string, unknown>;
    expect(maintenanceVerify.verified).toBe(true);
    expect(maintenanceVerify.maintenance_only).toBe(true);
    expect(maintenanceVerify.freshness_checked).toBe(false);
    expect(maintenanceVerify.state).toBe('stale');
    expect(maintenanceTotals.completed).toBe(tasks.length);
    const planBeforePromote = await readFile(maintenancePlanPath, 'utf-8');

    const promote = await codewikiUpdate(['--promote-only'], app.repo);
    const promoteData = promote.data as Record<string, unknown>;
    const promoteMembers = promoteData.members as Array<Record<string, unknown>>;
    const snapshotPath = promoteMembers[0].snapshot_path as string;

    expect(promoteData.updated).toBe(true);
    expect(promoteData.prepared).toBe(false);
    expect(promoteData.promoted).toBe(true);
    expect(promoteMembers[0].manifest_promoted).toBe(true);
    expect(await readFile(manifestPath, 'utf-8')).toContain(head);
    expect(await readFile(maintenancePlanPath, 'utf-8')).toBe(planBeforePromote);
    expect(await readFile(snapshotPath, 'utf-8')).toContain('feature.txt');
    expect((await codewikiSelect([], app.repo)).data).toMatchObject({ state: 'current' });
  });

  it('uses phase commit scope instead of manifest-to-head when --phase is provided', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);
    await writeFile(join(app.repo, 'phase-feature.txt'), 'phase behavior\n');
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'feat(03-01): add phase behavior']);
    const phaseHead = git(app.repo, ['rev-parse', 'HEAD']);
    await writeFile(join(app.repo, 'later-feature.txt'), 'later behavior\n');
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'feat(99-01): add unrelated later behavior']);

    const update = await codewikiUpdate(['--phase', '3', '--prepare-only'], app.repo);
    const data = update.data as Record<string, unknown>;
    const members = data.members as Array<Record<string, unknown>>;
    const paths = (members[0].changed_files as Array<Record<string, unknown>>).map(file => file.path);

    expect(data.updated).toBe(true);
    expect(members[0]).toMatchObject({
      head_commit: phaseHead,
      range_source: 'phase:03',
    });
    expect(paths).toContain('phase-feature.txt');
    expect(paths).not.toContain('later-feature.txt');
  });

  it('uses milestone tag range instead of current HEAD when --milestone is provided', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);
    await writeFile(join(app.repo, 'release-feature.txt'), 'release behavior\n');
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'feat: add release behavior']);
    const releaseHead = git(app.repo, ['rev-parse', 'HEAD']);
    git(app.repo, ['tag', 'v1.0']);
    await writeFile(join(app.repo, 'later-feature.txt'), 'later behavior\n');
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'feat: add post-release behavior']);

    const update = await codewikiUpdate(['--milestone', 'v1.0', '--prepare-only'], app.repo);
    const data = update.data as Record<string, unknown>;
    const members = data.members as Array<Record<string, unknown>>;
    const paths = (members[0].changed_files as Array<Record<string, unknown>>).map(file => file.path);

    expect(data.updated).toBe(true);
    expect(members[0]).toMatchObject({
      head_commit: releaseHead,
      range_source: 'milestone-tag:v1.0',
    });
    expect(paths).toContain('release-feature.txt');
    expect(paths).not.toContain('later-feature.txt');
  });

  it('promotes a phase-scoped set update without requiring plans for unchanged members', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await codewikiInit(['--set', 'checkout', '--repos', `${web.repo},${api.repo}`], web.repo);
    await mkdir(join(api.repo, 'src'), { recursive: true });
    await writeFile(join(api.repo, 'src', 'module.ts'), 'export const phase = true;\n');
    git(api.repo, ['add', '.']);
    git(api.repo, ['commit', '-m', 'feat(03-01): update api module']);
    const apiHead = git(api.repo, ['rev-parse', 'HEAD']);

    const prepare = await codewikiUpdate(['--set', 'checkout', '--phase', '3', '--prepare-only'], web.repo);
    const prepareData = prepare.data as Record<string, unknown>;
    const prepareMembers = prepareData.members as Array<Record<string, unknown>>;
    const apiPrepare = prepareMembers.find(member => member.repo_id === 'api') as Record<string, unknown>;
    const maintenancePlanPath = apiPrepare.maintenance_plan_path as string;
    const apiWikiPath = dirname(dirname(maintenancePlanPath));
    const maintenancePlan = JSON.parse(await readFile(maintenancePlanPath, 'utf-8')) as Record<string, unknown>;
    const tasks = (maintenancePlan.tasks as Array<Record<string, unknown>>).map(({ id, ...task }) => ({
      ...task,
      task_id: id,
    }));

    expect(prepareData.updated).toBe(true);
    expect(prepareMembers.map(member => member.repo_id)).toEqual(['api']);

    await writeFile(join(apiWikiPath, '03-modules', 'phase.md'), '# Phase Module\n\n- Evidence: `src/module.ts`\n');
    await writeFile(join(apiWikiPath, '08-evidence', 'phase.refs.md'), '# Phase Evidence\n\n- `src/module.ts`\n');
    await writeFile(
      join(apiWikiPath, '00-meta', 'progress.json'),
      JSON.stringify({
        completed_tasks: tasks.map(task => ({
          task_id: task.task_id,
          status: 'completed',
          target_path: task.target_path,
          evidence_paths: ['src/module.ts'],
          updated_files: [
            (task.target_path as string).includes('08-evidence')
              ? 'coder-llm-wiki/08-evidence/phase.refs.md'
              : 'coder-llm-wiki/03-modules/phase.md',
          ],
        })),
      }, null, 2),
    );
    await writeFile(join(apiWikiPath, '00-meta', 'task-queue.json'), JSON.stringify({ tasks: [] }, null, 2));

    const maintenanceVerify = (await codewikiVerify(['--set', 'checkout', '--phase', '3', '--maintenance-only'], web.repo)).data as Record<string, unknown>;
    const verifyMembers = maintenanceVerify.members as Array<Record<string, unknown>>;
    expect(maintenanceVerify.verified).toBe(true);
    expect(verifyMembers.map(member => member.repo_id)).toEqual(['api']);

    const promote = await codewikiUpdate(['--set', 'checkout', '--phase', '3', '--promote-only'], web.repo);
    const promoteData = promote.data as Record<string, unknown>;
    const promoteMembers = promoteData.members as Array<Record<string, unknown>>;
    const setContent = await readFile(join(wikiRoot, 'sets', 'checkout', 'wiki-set.yaml'), 'utf-8');

    expect(promoteData.promoted).toBe(true);
    expect(promoteMembers.map(member => member.repo_id)).toEqual(['api']);
    expect(setContent).toContain(apiHead);
    expect(setContent).toContain(web.commit);
    expect((await codewikiSelect(['--set', 'checkout'], web.repo)).data).toMatchObject({ state: 'set-current' });
  });

  it('treats out-of-scope maintenance tasks as resolved review queue items', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    const init = await codewikiInit(['--repo-id', 'app'], app.repo);
    const initData = init.data as Record<string, unknown>;
    const members = initData.members as Array<Record<string, unknown>>;
    const namespaceDir = dirname(members[0].manifest_path as string);
    const wikiPath = members[0].wiki_path as string;
    const taskId = 'legacy-cross-repo-scope-cleanup';
    const targetPath = 'coder-llm-wiki/04-flows/legacy-supply-chain.md';

    await writeFile(
      join(wikiPath, '00-meta', 'maintenance-plan.json'),
      JSON.stringify({
        repo_id: 'app',
        tasks: [
          {
            task_id: taskId,
            status: 'out-of-scope',
            target_path: targetPath,
            source_files: ['coder-llm-wiki/00-meta/source-scope.json'],
          },
        ],
      }, null, 2),
    );
    await writeFile(
      join(wikiPath, '00-meta', 'progress.json'),
      JSON.stringify({ completed_tasks: [] }, null, 2),
    );
    await writeFile(
      join(wikiPath, '00-meta', 'task-queue.json'),
      JSON.stringify({
        tasks: [
          {
            task_id: taskId,
            status: 'out-of-scope',
            target_path: targetPath,
            source_files: ['coder-llm-wiki/00-meta/source-scope.json'],
            reason: 'legacy/** is excluded by the effective source scope',
          },
        ],
      }, null, 2),
    );

    const verified = (await codewikiVerify([], app.repo)).data as Record<string, unknown>;
    const totals = verified.totals as Record<string, unknown>;
    const reports = verified.members as Array<Record<string, unknown>>;
    const tasks = reports[0].tasks as Array<Record<string, unknown>>;

    expect(namespaceDir).toBeTruthy();
    expect(verified.verified).toBe(true);
    expect(totals).toMatchObject({
      tasks: 1,
      completed: 0,
      blocked: 0,
      out_of_scope: 1,
      unresolved: 0,
      invalid: 0,
    });
    expect(tasks[0]).toMatchObject({
      task_id: taskId,
      resolution: 'out-of-scope',
      valid: true,
      out_of_scope_reasons: ['legacy/** is excluded by the effective source scope'],
    });
  });

  it('updates a stale multi-repo set tuple', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await codewikiInit(['--set', 'checkout', '--repos', `${web.repo},${api.repo}`], web.repo);
    await mkdir(join(api.repo, 'src', 'routes'), { recursive: true });
    await mkdir(join(api.repo, 'src', 'flows'), { recursive: true });
    await writeFile(join(api.repo, 'src', 'routes', 'session.ts'), 'export const route = "/session";\n');
    await writeFile(join(api.repo, 'src', 'flows', 'create-session.ts'), 'export function createSessionFlow() {}\n');
    git(api.repo, ['add', '.']);
    git(api.repo, ['commit', '-m', 'api feature']);
    const apiHead = git(api.repo, ['rev-parse', 'HEAD']);

    const update = await codewikiUpdate(['--set', 'checkout'], web.repo);
    const updateData = update.data as Record<string, unknown>;
    const updateMembers = updateData.members as Array<Record<string, unknown>>;
    const apiUpdate = updateMembers.find(member => member.repo_id === 'api') as Record<string, unknown>;
    const apiPlan = apiUpdate.maintenance_plan as Record<string, unknown>;

    expect(updateData.updated).toBe(true);
    expect(await readFile(join(wikiRoot, 'sets', 'checkout', 'wiki-set.yaml'), 'utf-8')).toContain(apiHead);
    expect(apiPlan.set_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'cross-repo/contracts/' }),
      expect.objectContaining({ path: 'cross-repo/flows/' }),
    ]));
    expect(apiPlan.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'set',
        target_path: 'cross-repo/contracts/',
        required_evidence: ['git_diff', 'source_files', 'cross_repo_evidence'],
      }),
      expect.objectContaining({
        scope: 'set',
        target_path: 'cross-repo/flows/',
      }),
    ]));
    expect((await codewikiSelect(['--set', 'checkout'], web.repo)).data).toMatchObject({ state: 'set-current' });
  });

  it('projects a repo CodeWiki into .planning/codebase', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);

    const projection = await codewikiProject([], app.repo);
    const data = projection.data as Record<string, unknown>;
    const outputPath = data.output_path as string;
    const content = await readFile(outputPath, 'utf-8');

    expect(data.projected).toBe(true);
    expect(outputPath).toBe(join(app.repo, '.planning', 'codebase', 'codewiki-summary.md'));
    expect(content).toContain('# CodeWiki 投影');
    expect(content).toContain('## 成员仓库');
    expect(content).toContain('app');
  });

  it('projects a multi-repo CodeWiki set into .planning/codebase', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await codewikiInit(['--set', 'checkout', '--repos', `${web.repo},${api.repo}`], web.repo);

    const projection = await codewikiProject(['--set', 'checkout'], web.repo);
    const data = projection.data as Record<string, unknown>;
    const outputPath = data.output_path as string;
    const content = await readFile(outputPath, 'utf-8');

    expect(data.projected).toBe(true);
    expect(data.state).toBe('set-current');
    expect(content).toContain('set_id: checkout');
    expect(content).toContain('## Set 快照');
    expect(content).toContain('| web |');
    expect(content).toContain('| api |');
  });

  it('indexes selected CodeWiki records into .planning/intel when intel is enabled', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await writeFile(
      join(app.repo, '.planning', 'config.json'),
      JSON.stringify({ codewiki: { root: relative(app.repo, wikiRoot) }, intel: { enabled: true } }, null, 2),
    );
    await codewikiInit(['--repo-id', 'app'], app.repo);

    const index = await codewikiIndex([], app.repo);
    const data = index.data as Record<string, unknown>;
    const outputPath = data.output_path as string;
    const content = JSON.parse(await readFile(outputPath, 'utf-8')) as Record<string, unknown>;
    const query = await intelQuery(['app'], app.repo);
    const queryData = query.data as Record<string, unknown>;

    expect(data.indexed).toBe(true);
    expect(outputPath).toBe(join(app.repo, '.planning', 'intel', 'codewiki.json'));
    expect(content).toHaveProperty('records');
    expect(queryData.total).toBeGreaterThan(0);
  });

  it('plans Repomix seed generation for each set member without writing in dry-run mode', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await codewikiInit(['--set', 'checkout', '--repos', `${web.repo},${api.repo}`], web.repo);

    const pack = await codewikiPack(['--set', 'checkout', '--dry-run', '--style', 'markdown', '--compress'], web.repo);
    const data = pack.data as Record<string, unknown>;
    const members = data.members as Array<Record<string, unknown>>;

    expect(data.dry_run).toBe(true);
    expect(data.packed).toBe(false);
    expect(members).toHaveLength(2);
    expect(members.map(member => member.status)).toEqual(['planned', 'planned']);
    expect(members.every(member => String(member.output_path).endsWith('repomix-output.md'))).toBe(true);
    expect(data.updated_files).toEqual([]);
  });

  it('registers existing DeepWiki exports as seed-only manifest paths', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    const init = await codewikiInit(['--repo-id', 'app'], app.repo);
    const initData = init.data as Record<string, unknown>;
    const members = initData.members as Array<Record<string, unknown>>;
    const manifestPath = members[0].manifest_path as string;
    const namespaceDir = dirname(manifestPath);
    await mkdir(join(namespaceDir, 'deepwiki-export'), { recursive: true });
    await writeFile(join(namespaceDir, 'deepwiki-export', 'deepwiki.md'), '# DeepWiki seed\n');
    await writeFile(join(namespaceDir, 'deepwiki-export', 'deepwiki.json'), '{"pages":[]}\n');

    const exported = await codewikiDeepWikiExport(['--register-existing'], app.repo);
    const data = exported.data as Record<string, unknown>;
    const exportMembers = data.members as Array<Record<string, unknown>>;
    const manifest = await readFile(manifestPath, 'utf-8');
    const meta = JSON.parse(await readFile(join(namespaceDir, 'deepwiki-export', 'manifest.json'), 'utf-8')) as Record<string, unknown>;

    expect(data.exported).toBe(true);
    expect(exportMembers[0].status).toBe('registered');
    expect(manifest).toContain('deepwiki_export: deepwiki-export/deepwiki.md');
    expect(manifest).toContain('seed_sources:');
    expect(manifest).toContain('evidence: false');
    expect(meta.seed_policy).toMatchObject({ evidence: false });
  });

  it('creates and registers cross-repo contract and flow helper docs', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await codewikiInit(['--set', 'checkout', '--repos', `${web.repo},${api.repo}`], web.repo);

    const contract = await codewikiContract(['checkout-session-api', '--set', 'checkout', '--producer', 'api', '--consumers', 'web'], web.repo);
    const contractData = contract.data as Record<string, unknown>;
    const contractPath = contractData.path as string;
    const flow = await codewikiFlow(['create-checkout-session', '--set', 'checkout', '--repos', 'web,api'], web.repo);
    const flowData = flow.data as Record<string, unknown>;
    const flowPath = flowData.path as string;
    const setContent = await readFile(join(wikiRoot, 'sets', 'checkout', 'wiki-set.yaml'), 'utf-8');
    const status = await codewikiStatus(['--set', 'checkout'], web.repo);
    const statusData = status.data as Record<string, unknown>;
    const crossRepo = statusData.cross_repo as Record<string, unknown>;

    expect(contractData.contract).toBe(true);
    expect(flowData.flow).toBe(true);
    expect(await readFile(contractPath, 'utf-8')).toContain('# 跨仓库契约：checkout-session-api');
    expect(await readFile(flowPath, 'utf-8')).toContain('# 跨仓库流程：create-checkout-session');
    expect(setContent).toContain('contracts:');
    expect(setContent).toContain('producer_repo: api');
    expect(setContent).toContain('consumer_repos:');
    expect(setContent).toContain('flows:');
    expect(setContent).toContain('cross-repo/flows/create-checkout-session.md');
    expect(crossRepo.contracts).toHaveLength(1);
    expect(crossRepo.flows).toHaveLength(1);
  });

  it('does not index CodeWiki when intel is disabled', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);

    const index = await codewikiIndex([], app.repo);
    const data = index.data as Record<string, unknown>;

    expect(data.indexed).toBe(false);
    expect(data.disabled).toBe(true);
  });

  it('freezes a repo namespace and keeps repeated freezes idempotent', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);

    const first = await codewikiFreeze(['v1.0'], app.repo);
    const firstData = first.data as Record<string, unknown>;
    const firstMembers = firstData.members as Array<Record<string, unknown>>;
    const manifestPath = firstMembers[0].manifest_path as string;

    expect(firstData.frozen).toBe(true);
    expect(await readFile(manifestPath, 'utf-8')).toContain('status: frozen');
    expect(await readFile(manifestPath, 'utf-8')).toContain('frozen_for_version: v1.0');
    expect((await codewikiSelect([], app.repo)).data).toMatchObject({ state: 'frozen' });

    const second = await codewikiFreeze(['v1.0'], app.repo);
    const secondData = second.data as Record<string, unknown>;
    expect(secondData.frozen).toBe(true);
    expect(secondData.updated_files).toEqual([]);
  });

  it('blocks require-verified freeze for init-only starter queues', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);

    const blocked = await codewikiFreeze(['v1.0', '--require-verified'], app.repo);
    const blockedData = blocked.data as Record<string, unknown>;
    const verification = blockedData.verification as Record<string, unknown>;

    expect(blockedData.frozen).toBe(false);
    expect(verification.verified).toBe(false);
    expect(verification.baseline_verified).toBe(false);
    expect((verification.warnings as string[]).join('\n')).toContain('baseline is incomplete');
  });

  it('freezes a multi-repo set', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await codewikiInit(['--set', 'checkout', '--repos', `${web.repo},${api.repo}`], web.repo);

    const freeze = await codewikiFreeze(['v1.0', '--set', 'checkout'], web.repo);
    const data = freeze.data as Record<string, unknown>;

    expect(data.frozen).toBe(true);
    expect(await readFile(join(wikiRoot, 'sets', 'checkout', 'wiki-set.yaml'), 'utf-8')).toContain('status: frozen');
    expect((await codewikiSelect(['--set', 'checkout'], web.repo)).data).toMatchObject({ state: 'frozen' });
  });

  it('blocks verified freeze when maintenance tasks are unresolved unless explicitly acknowledged', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await codewikiInit(['--repo-id', 'app'], app.repo);
    await writeFile(join(app.repo, 'feature.txt'), 'new behavior\n');
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'feature']);
    await codewikiUpdate([], app.repo);

    const blocked = await codewikiFreeze(['v1.0', '--require-verified'], app.repo);
    const blockedData = blocked.data as Record<string, unknown>;
    const verification = blockedData.verification as Record<string, unknown>;
    expect(blockedData.frozen).toBe(false);
    expect(blockedData.error).toContain('maintenance verification failed');
    expect(verification.verified).toBe(false);

    const acknowledged = await codewikiFreeze(['v1.0', '--require-verified', '--allow-unverified'], app.repo);
    const acknowledgedData = acknowledged.data as Record<string, unknown>;
    const warnings = acknowledgedData.warnings as string[];
    expect(acknowledgedData.frozen).toBe(true);
    expect(warnings.join('\n')).toContain('--allow-unverified');
  });

  it('returns init next action when freezing a missing namespace', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);

    const freeze = await codewikiFreeze(['v1.0'], app.repo);
    const data = freeze.data as Record<string, unknown>;

    expect(data.frozen).toBe(false);
    expect(data.next_action).toBe('/gsd-codewiki-init');
  });

  it('returns missing when wiki-index.yaml does not exist', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);

    const result = await codewikiSelect([], app.repo);
    const data = result.data as Record<string, unknown>;

    expect(data.state).toBe('missing');
    expect(data.reason).toBe('wiki-index.yaml not found');
    expect(data.next_action).toBe('/gsd-codewiki-init');
  });

  it('selects the current repo namespace through the registry', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await writeRepoWiki(wikiRoot, 'app', app.repo, app.branch, app.commit);
    await writeRepoIndex(wikiRoot, 'app', app.repo, app.branch, app.commit);

    const result = await createRegistry().dispatch('codewiki.select', [], app.repo);
    const data = result.data as Record<string, unknown>;
    const selected = data.selected as Record<string, unknown>;

    expect(data.state).toBe('current');
    expect(selected.repo_id).toBe('app');
    expect(selected.current_commit).toBe(app.commit);
  });

  it('reports stale when the repo commit moved past the manifest commit', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await writeRepoWiki(wikiRoot, 'app', app.repo, app.branch, app.commit);
    await writeRepoIndex(wikiRoot, 'app', app.repo, app.branch, app.commit);
    await writeFile(join(app.repo, 'feature.txt'), 'new behavior\n');
    git(app.repo, ['add', '.']);
    git(app.repo, ['commit', '-m', 'feature']);

    const result = await codewikiSelect([], app.repo);
    const data = result.data as Record<string, unknown>;

    expect(data.state).toBe('stale');
    expect(data.next_action).toBe('/gsd-codewiki-update');
  });

  it('reports frozen when the matching repo manifest is frozen', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    await writeRepoWiki(wikiRoot, 'app', app.repo, app.branch, app.commit, 'frozen');
    await writeRepoIndex(wikiRoot, 'app', app.repo, app.branch, app.commit);

    const result = await codewikiSelect([], app.repo);
    const data = result.data as Record<string, unknown>;

    expect(data.state).toBe('frozen');
    expect(data.next_action).toContain('frozen');
  });

  it('selects a current multi-repo set', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await writeRepoWiki(wikiRoot, 'web', web.repo, web.branch, web.commit);
    await writeRepoWiki(wikiRoot, 'api', api.repo, api.branch, api.commit);
    await writeSet(wikiRoot, 'checkout', [
      { repoId: 'web', repoPath: web.repo, branch: web.branch, commit: web.commit },
      { repoId: 'api', repoPath: api.repo, branch: api.branch, commit: api.commit },
    ]);

    const result = await codewikiSelect(['--set', 'checkout'], web.repo);
    const data = result.data as Record<string, unknown>;
    const members = data.members as Array<Record<string, unknown>>;

    expect(data.state).toBe('set-current');
    expect(data.tuple_id).toBe('checkout__tuple');
    expect(members.map(member => member.repo_id).sort()).toEqual(['api', 'web']);
  });

  it('resolves workspace-relative source_repo paths in a multi-repo set', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await writeRepoWiki(wikiRoot, 'web', web.repo, web.branch, web.commit);
    await writeRepoWiki(wikiRoot, 'api', api.repo, api.branch, api.commit);
    await writeSet(wikiRoot, 'relative-checkout', [
      { repoId: 'web', repoPath: 'web', branch: web.branch, commit: web.commit },
      { repoId: 'api', repoPath: 'api', branch: api.branch, commit: api.commit },
    ]);

    const result = await codewikiSelect(['--set', 'relative-checkout'], web.repo);
    const data = result.data as Record<string, unknown>;

    expect(data.state).toBe('set-current');
  });

  it('reports set-stale when a required member commit differs', async () => {
    const web = await createRepo(workspace, 'web', wikiRoot);
    const api = await createRepo(workspace, 'api', wikiRoot);
    await writeRepoWiki(wikiRoot, 'web', web.repo, web.branch, web.commit);
    await writeRepoWiki(wikiRoot, 'api', api.repo, api.branch, api.commit);
    await writeSet(wikiRoot, 'checkout', [
      { repoId: 'web', repoPath: web.repo, branch: web.branch, commit: web.commit },
      { repoId: 'api', repoPath: api.repo, branch: api.branch, commit: api.commit },
    ]);
    await writeFile(join(api.repo, 'feature.txt'), 'new api behavior\n');
    git(api.repo, ['add', '.']);
    git(api.repo, ['commit', '-m', 'api feature']);

    const result = await codewikiSelect(['--set', 'checkout'], web.repo);
    const data = result.data as Record<string, unknown>;
    const members = data.members as Array<Record<string, unknown>>;
    const apiMember = members.find(member => member.repo_id === 'api');

    expect(data.state).toBe('set-stale');
    expect(apiMember?.state).toBe('stale');
    expect(data.next_action).toBe('/gsd-codewiki-update --set checkout');
  });
});

describe('codewikiStatus', () => {
  let workspace: string;
  let wikiRoot: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'gsd-codewiki-'));
    wikiRoot = join(workspace, 'code-wiki');
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('includes snapshots and open questions for the selected repo', async () => {
    const app = await createRepo(workspace, 'app', wikiRoot);
    const wiki = await writeRepoWiki(wikiRoot, 'app', app.repo, app.branch, app.commit);
    await writeRepoIndex(wikiRoot, 'app', app.repo, app.branch, app.commit);

    const result = await codewikiStatus([], app.repo);
    const data = result.data as Record<string, unknown>;
    const snapshots = data.snapshots as Array<Record<string, unknown>>;
    const questions = data.open_questions as Array<Record<string, unknown>>;

    expect((data.selection as Record<string, unknown>).state).toBe('current');
    expect(snapshots[0].path).toBe(wiki.snapshot);
    expect(questions[0].questions).toEqual(['Should API docs mention retry behavior?']);
  });
});
