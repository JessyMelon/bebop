/**
 * CodeWiki selection and status queries.
 *
 * SDK-only handlers used by CodeWiki lifecycle workflows. They select the
 * CodeWiki namespace or multi-repo set matching the current Git checkout and
 * report freshness without mutating project files.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { normalizePhaseName } from './helpers.js';
import type { QueryHandler } from './utils.js';

const CODER_LLM_WIKI_TEMPLATE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../get-shit-done/templates/codewiki/coder-llm-wiki',
);

const CODER_LLM_WIKI_RUNTIME_FILES = new Set([
  '00-meta/progress.json',
  '00-meta/task-queue.json',
  '00-meta/status-dashboard.md',
]);

type JsonObject = Record<string, unknown>;
type CodeWikiState =
  | 'current'
  | 'dirty-current'
  | 'stale'
  | 'missing'
  | 'frozen'
  | 'set-current'
  | 'set-partial'
  | 'set-stale';

interface GitIdentity {
  requested_path: string;
  is_git_repo: boolean;
  root: string | null;
  branch: string | null;
  commit: string | null;
  short_commit: string | null;
  dirty: boolean;
  error: string | null;
}

interface CodeWikiMember {
  repo_id: string;
  role: string | null;
  required: boolean;
  source_repo: string | null;
  repo_root: string | null;
  branch: string | null;
  current_commit: string | null;
  current_short_commit: string | null;
  expected_commit: string | null;
  manifest_commit: string | null;
  dirty: boolean;
  state: CodeWikiState;
  version_id: string | null;
  manifest_path: string | null;
  wiki_path: string | null;
  status_dashboard_path: string | null;
  git_error: string | null;
}

interface CodeWikiSelection {
  mode: 'repo' | 'set';
  state: CodeWikiState;
  codewiki_root: string;
  index_path: string;
  set_id: string | null;
  set_manifest_path: string | null;
  set_status: string | null;
  tuple_id: string | null;
  members: CodeWikiMember[];
  selected: CodeWikiMember | null;
  next_action: string;
  reason: string | null;
  workspace_drift: WorkspaceDriftReport;
  warnings: string[];
}

interface WorkspaceDriftSource {
  name: string;
  repos: string[];
}

interface WorkspaceDriftIssue {
  source: string;
  missing_from_source: string[];
  extra_in_source: string[];
}

interface WorkspaceDriftReport {
  checked: boolean;
  consistent: boolean;
  canonical_source: string | null;
  sources: WorkspaceDriftSource[];
  issues: WorkspaceDriftIssue[];
  warnings: string[];
}

interface QueryOptions {
  setId: string | null;
}

interface InitOptions {
  setId: string | null;
  repoId: string | null;
  repos: string[];
}

interface UpdateOptions {
  setId: string | null;
  base: string | null;
  head: string | null;
  phase: string | null;
  milestone: string | null;
  prepareOnly: boolean;
  promoteOnly: boolean;
}

interface FreezeOptions {
  version: string | null;
  setId: string | null;
  requireVerified: boolean;
  allowUnverified: boolean;
}

interface ProjectOptions {
  setId: string | null;
}

interface IndexOptions {
  setId: string | null;
}

interface VerifyOptions {
  setId: string | null;
  base: string | null;
  head: string | null;
  phase: string | null;
  milestone: string | null;
  maintenanceOnly: boolean;
}

interface ContractOptions {
  setId: string | null;
  name: string | null;
  producer: string | null;
  consumers: string[];
}

interface FlowOptions {
  setId: string | null;
  name: string | null;
  repos: string[];
}

type RepomixStyle = 'xml' | 'markdown' | 'json' | 'plain';

interface PackOptions {
  setId: string | null;
  repoIds: string[];
  force: boolean;
  dryRun: boolean;
  style: RepomixStyle | null;
  styleError: string | null;
  include: string | null;
  ignore: string | null;
  compress: boolean;
  repomixBin: string | null;
}

interface DeepWikiExportOptions {
  setId: string | null;
  repoIds: string[];
  force: boolean;
  dryRun: boolean;
  registerExisting: boolean;
  command: string | null;
  timeoutMs: number;
  timeoutError: string | null;
}

interface InitMember {
  repo_id: string;
  source_repo: string;
  role: string;
  required: boolean;
  git: GitIdentity;
  ref_type: 'branch' | 'commit';
  ref_name: string;
  ref_namespace: string;
  version_id: string;
  manifest_path: string;
  manifest_rel: string;
  wiki_path: string;
  wiki_rel: string;
  latest_snapshot: string;
  latest_snapshot_rel: string;
}

interface UpdateMember {
  repo_id: string;
  repo_root: string;
  manifest_path: string;
  wiki_path: string;
  base_commit: string | null;
  head_commit: string;
  short_head: string;
  dirty: boolean;
  changed_files: Array<{ status: string; path: string; classification: string }>;
  seed_sources: SeedSource[];
  maintenance_plan_path: string;
  maintenance_plan: JsonObject;
  snapshot_path: string;
  manifest_promoted: boolean;
  range_source: string;
  range_reason: string | null;
}

interface UpdateMutationMode {
  writeMaintenancePlan: boolean;
  writeSnapshots: boolean;
  promoteManifests: boolean;
  requireExistingPlan: boolean;
}

interface ResolvedUpdateRange {
  base: string | null;
  head: string;
  source: string;
  reason: string | null;
  skip: boolean;
}

interface VerifyMemberOptions {
  requirePlan: boolean;
}

interface SeedSource {
  kind: 'deepwiki' | 'repomix';
  path: string;
  relative_path: string;
  size_bytes: number;
  updated_at: string;
  evidence: false;
}

interface ContextEntry {
  value: JsonObject | unknown[];
  indent: number;
  parent: ContextEntry | null;
  parentKey: string | null;
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return defaultValue;
}

function stripYamlComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

function splitInlineArray(body: string): unknown[] {
  const items: unknown[] = [];
  let current = '';
  let quote: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ',') {
      const trimmed = current.trim();
      if (trimmed) items.push(parseScalar(trimmed));
      current = '';
      continue;
    }
    current += ch;
  }
  const trimmed = current.trim();
  if (trimmed) items.push(parseScalar(trimmed));
  return items;
}

function parseScalar(raw: string): unknown {
  const value = stripYamlComment(raw).trim();
  if (value === '') return '';
  if (value === '[]') return [];
  if (value === '{}') return {};
  if (value.startsWith('[') && value.endsWith(']')) {
    return splitInlineArray(value.slice(1, -1));
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  return value;
}

function parseYamlDocument(content: string): JsonObject {
  const root: JsonObject = {};
  const stack: ContextEntry[] = [{ value: root, indent: -1, parent: null, parentKey: null }];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripYamlComment(rawLine);
    if (line.trim() === '') continue;

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    let current = stack[stack.length - 1];
    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      let list: unknown[] | null = Array.isArray(current.value) ? current.value : null;
      if (!list && isObject(current.value) && Object.keys(current.value).length === 0 && current.parent && current.parentKey) {
        list = [];
        (current.parent.value as JsonObject)[current.parentKey] = list;
        current.value = list;
      }
      if (!list) continue;

      const afterDash = trimmed.slice(2).trim();
      const itemMatch = afterDash.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (itemMatch) {
        const item: JsonObject = { [itemMatch[1]]: parseScalar(itemMatch[2]) };
        list.push(item);
        stack.push({ value: item, indent, parent: current, parentKey: null });
      } else {
        list.push(parseScalar(afterDash));
      }
      continue;
    }

    const keyMatch = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyMatch || !isObject(current.value)) continue;

    const key = keyMatch[1];
    const rawValue = keyMatch[2].trim();
    if (rawValue === '') {
      const nested: JsonObject = {};
      current.value[key] = nested;
      stack.push({ value: nested, indent, parent: current, parentKey: key });
    } else {
      current.value[key] = parseScalar(rawValue);
    }
  }

  return root;
}

function readJson(filePath: string): JsonObject {
  try {
    if (!existsSync(filePath)) return {};
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readYaml(filePath: string): JsonObject | null {
  try {
    if (!existsSync(filePath)) return null;
    return parseYamlDocument(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function expandHome(rawPath: string): string {
  if (rawPath === '~') return homedir();
  if (rawPath.startsWith('~/')) return join(homedir(), rawPath.slice(2));
  return rawPath;
}

function resolvePathFrom(baseDir: string, rawPath: string): string {
  const expanded = expandHome(rawPath);
  return normalize(isAbsolute(expanded) ? expanded : resolve(baseDir, expanded));
}

function resolveFirstExisting(rawPath: string | null, bases: string[]): string | null {
  if (!rawPath) return null;
  const expanded = expandHome(rawPath);
  if (isAbsolute(expanded)) return normalize(expanded);
  for (const base of bases) {
    const candidate = normalize(resolve(base, expanded));
    if (existsSync(candidate)) return candidate;
  }
  return normalize(resolve(bases[0], expanded));
}

function resolveRepoPath(projectDir: string, codewikiRootPath: string, rawPath: string): string {
  return resolveFirstExisting(rawPath, [projectDir, dirname(codewikiRootPath), codewikiRootPath]) ??
    resolvePathFrom(projectDir, rawPath);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];
}

function packageDependencyNames(pkg: JsonObject): Set<string> {
  const names = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[field];
    if (!isObject(deps)) continue;
    for (const name of Object.keys(deps)) names.add(name);
  }
  return names;
}

function hasDependency(deps: Set<string>, names: string[]): boolean {
  return names.some(name => deps.has(name));
}

function hasRoleToken(text: string, tokens: string[]): boolean {
  const padded = `-${text}-`;
  return tokens.some(token => padded.includes(`-${sanitizeId(token)}-`));
}

function repoMarkerExists(repoRoot: string | null, candidates: string[]): boolean {
  if (!repoRoot) return false;
  return candidates.some(candidate => existsSync(join(repoRoot, candidate)));
}

function hasPackageEntrypoint(pkg: JsonObject): boolean {
  return Boolean(
    asString(pkg.main) ||
    asString(pkg.module) ||
    asString(pkg.types) ||
    pkg.exports !== undefined ||
    pkg.bin !== undefined
  );
}

function inferRepoRole(gitInfo: GitIdentity): string {
  const repoRoot = gitInfo.root;
  const pkg = repoRoot ? readJson(join(repoRoot, 'package.json')) : {};
  const repoName = sanitizeId(basename(repoRoot ?? gitInfo.requested_path));
  const pkgName = sanitizeId(asString(pkg.name) ?? '');
  const roleText = [repoName, pkgName].filter(Boolean).join('-');
  const deps = packageDependencyNames(pkg);

  const frontendDeps = [
    '@angular/core',
    '@vitejs/plugin-react',
    'astro',
    'next',
    'nuxt',
    'react',
    'remix',
    'svelte',
    'vite',
    'vue',
  ];
  const backendDeps = [
    '@nestjs/core',
    '@prisma/client',
    'apollo-server',
    'express',
    'fastify',
    'graphql-yoga',
    'hapi',
    'koa',
    'prisma',
    'sequelize',
    'typeorm',
  ];
  const workerDeps = ['agenda', 'bee-queue', 'bull', 'bullmq'];

  if (hasRoleToken(roleText, ['docs', 'documentation', 'handbook'])) return 'docs';
  if (hasRoleToken(roleText, ['worker', 'workers', 'job', 'jobs', 'queue', 'consumer', 'cron']) || hasDependency(deps, workerDeps)) {
    return 'worker';
  }
  if (
    hasRoleToken(roleText, ['web', 'frontend', 'front-end', 'ui', 'client']) ||
    hasDependency(deps, frontendDeps) ||
    repoMarkerExists(repoRoot, [
      'vite.config.js',
      'vite.config.mjs',
      'vite.config.ts',
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
      'nuxt.config.js',
      'nuxt.config.ts',
      'src/App.jsx',
      'src/App.tsx',
      'src/main.jsx',
      'src/main.tsx',
    ])
  ) {
    return 'frontend';
  }
  if (
    hasRoleToken(roleText, ['api', 'backend', 'back-end', 'server', 'service']) ||
    hasDependency(deps, backendDeps) ||
    repoMarkerExists(repoRoot, [
      'go.mod',
      'Cargo.toml',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
      'server.js',
      'server.ts',
      'src/server.js',
      'src/server.ts',
      'src/app.js',
      'src/app.ts',
    ])
  ) {
    return 'backend';
  }
  if (
    hasRoleToken(roleText, ['shared', 'common', 'lib', 'library', 'sdk', 'types', 'contracts', 'schema']) ||
    (hasPackageEntrypoint(pkg) && !hasDependency(deps, [...frontendDeps, ...backendDeps, ...workerDeps]))
  ) {
    return 'shared-library';
  }
  return 'service';
}

function pathKey(pathValue: string | null): string | null {
  if (!pathValue) return null;
  try {
    const resolved = resolvePathFrom('/', pathValue);
    return existsSync(resolved) ? realpathSync.native(resolved) : normalize(resolved);
  } catch {
    return normalize(pathValue);
  }
}

function samePath(a: string | null, b: string | null): boolean {
  const ak = pathKey(a);
  const bk = pathKey(b);
  return ak !== null && bk !== null && ak === bk;
}

function parseOptions(args: string[]): QueryOptions {
  const setIdx = args.indexOf('--set');
  return {
    setId: setIdx !== -1 ? (args[setIdx + 1] ?? null) : null,
  };
}

function readConfig(projectDir: string): JsonObject {
  return readJson(join(projectDir, '.planning', 'config.json'));
}

function codeWikiConfig(config: JsonObject): JsonObject {
  return isObject(config.codewiki) ? config.codewiki : {};
}

function codeWikiRoot(projectDir: string, config: JsonObject): string {
  const rootValue = asString(codeWikiConfig(config).root) ?? 'code-wiki';
  return resolvePathFrom(projectDir, rootValue);
}

function activeSetId(options: QueryOptions, config: JsonObject): string | null {
  return options.setId ?? asString(codeWikiConfig(config).active_set);
}

function emptyWorkspaceDrift(): WorkspaceDriftReport {
  return {
    checked: false,
    consistent: true,
    canonical_source: null,
    sources: [],
    issues: [],
    warnings: [],
  };
}

function optionValue(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  const value = args[idx + 1];
  return value && !value.startsWith('--') ? value : null;
}

function parseInitOptions(args: string[]): InitOptions {
  const reposRaw = optionValue(args, '--repos');
  return {
    setId: optionValue(args, '--set'),
    repoId: optionValue(args, '--repo-id'),
    repos: reposRaw
      ? reposRaw.split(',').map(repo => repo.trim()).filter(Boolean)
      : [],
  };
}

function parseUpdateOptions(args: string[]): UpdateOptions {
  return {
    setId: optionValue(args, '--set'),
    base: optionValue(args, '--base'),
    head: optionValue(args, '--head'),
    phase: optionValue(args, '--phase'),
    milestone: optionValue(args, '--milestone'),
    prepareOnly: args.includes('--prepare-only'),
    promoteOnly: args.includes('--promote-only'),
  };
}

function parseFreezeOptions(args: string[]): FreezeOptions {
  const flagsWithValues = new Set(['--set']);
  let version: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flagsWithValues.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith('--')) continue;
    version = arg;
    break;
  }
  return {
    version,
    setId: optionValue(args, '--set'),
    requireVerified: args.includes('--require-verified'),
    allowUnverified: args.includes('--allow-unverified'),
  };
}

function parseProjectOptions(args: string[]): ProjectOptions {
  return { setId: optionValue(args, '--set') };
}

function parseIndexOptions(args: string[]): IndexOptions {
  return { setId: optionValue(args, '--set') };
}

function parseVerifyOptions(args: string[]): VerifyOptions {
  return {
    setId: optionValue(args, '--set'),
    base: optionValue(args, '--base'),
    head: optionValue(args, '--head'),
    phase: optionValue(args, '--phase'),
    milestone: optionValue(args, '--milestone'),
    maintenanceOnly: args.includes('--maintenance-only') || args.includes('--pre-promotion'),
  };
}

function firstPositional(args: string[], flagsWithValues: Set<string>): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flagsWithValues.has(arg)) {
      i++;
      continue;
    }
    if (!arg.startsWith('--')) return arg;
  }
  return null;
}

function commaList(value: string | null): string[] {
  return value
    ? value.split(',').map(item => item.trim()).filter(Boolean)
    : [];
}

function parseContractOptions(args: string[]): ContractOptions {
  const flagsWithValues = new Set(['--set', '--name', '--producer', '--consumers']);
  return {
    setId: optionValue(args, '--set'),
    name: optionValue(args, '--name') ?? firstPositional(args, flagsWithValues),
    producer: optionValue(args, '--producer'),
    consumers: commaList(optionValue(args, '--consumers')),
  };
}

function parseFlowOptions(args: string[]): FlowOptions {
  const flagsWithValues = new Set(['--set', '--name', '--repos']);
  return {
    setId: optionValue(args, '--set'),
    name: optionValue(args, '--name') ?? firstPositional(args, flagsWithValues),
    repos: commaList(optionValue(args, '--repos')),
  };
}

function parseRepoIdFilters(args: string[]): string[] {
  return uniqueStrings([
    ...commaList(optionValue(args, '--repos')),
    ...commaList(optionValue(args, '--repo')),
  ]);
}

function parseRepomixStyle(raw: string | null): { style: RepomixStyle | null; error: string | null } {
  if (!raw) return { style: 'xml', error: null };
  if (raw === 'xml' || raw === 'markdown' || raw === 'json' || raw === 'plain') {
    return { style: raw, error: null };
  }
  return {
    style: null,
    error: `invalid --style ${raw}; expected xml, markdown, json, or plain`,
  };
}

function parsePackOptions(args: string[]): PackOptions {
  const parsedStyle = parseRepomixStyle(optionValue(args, '--style'));
  return {
    setId: optionValue(args, '--set'),
    repoIds: parseRepoIdFilters(args),
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
    style: parsedStyle.style,
    styleError: parsedStyle.error,
    include: optionValue(args, '--include'),
    ignore: optionValue(args, '--ignore'),
    compress: args.includes('--compress'),
    repomixBin: optionValue(args, '--repomix-bin'),
  };
}

function parseTimeoutMs(raw: string | null, defaultValue: number): { timeoutMs: number; error: string | null } {
  if (!raw) return { timeoutMs: defaultValue, error: null };
  if (!/^\d+$/.test(raw)) return { timeoutMs: defaultValue, error: `invalid --timeout-ms ${raw}; expected a positive integer` };
  const timeoutMs = Number(raw);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    return { timeoutMs: defaultValue, error: `invalid --timeout-ms ${raw}; expected a positive integer` };
  }
  return { timeoutMs, error: null };
}

function parseDeepWikiExportOptions(args: string[]): DeepWikiExportOptions {
  const parsedTimeout = parseTimeoutMs(optionValue(args, '--timeout-ms'), 30 * 60 * 1000);
  return {
    setId: optionValue(args, '--set'),
    repoIds: parseRepoIdFilters(args),
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
    registerExisting: args.includes('--register-existing'),
    command: optionValue(args, '--command'),
    timeoutMs: parsedTimeout.timeoutMs,
    timeoutError: parsedTimeout.error,
  };
}

function git(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  try {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return {
      ok: result.status === 0,
      stdout: (result.stdout ?? '').trim(),
      stderr: (result.stderr ?? '').trim(),
    };
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'git command failed',
    };
  }
}

function gitIdentity(repoPath: string): GitIdentity {
  const requestedPath = normalize(repoPath);
  if (!existsSync(requestedPath)) {
    return {
      requested_path: requestedPath,
      is_git_repo: false,
      root: null,
      branch: null,
      commit: null,
      short_commit: null,
      dirty: false,
      error: 'repo path does not exist',
    };
  }

  const root = git(requestedPath, ['rev-parse', '--show-toplevel']);
  if (!root.ok) {
    return {
      requested_path: requestedPath,
      is_git_repo: false,
      root: null,
      branch: null,
      commit: null,
      short_commit: null,
      dirty: false,
      error: root.stderr || 'not a git repository',
    };
  }

  const branch = git(requestedPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const commit = git(requestedPath, ['rev-parse', 'HEAD']);
  const shortCommit = git(requestedPath, ['rev-parse', '--short', 'HEAD']);
  const status = git(requestedPath, ['status', '--short']);

  return {
    requested_path: requestedPath,
    is_git_repo: true,
    root: root.stdout,
    branch: branch.ok ? branch.stdout : null,
    commit: commit.ok ? commit.stdout : null,
    short_commit: shortCommit.ok ? shortCommit.stdout : null,
    dirty: status.ok && status.stdout.length > 0,
    error: null,
  };
}

function sanitizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'repo';
}

function shortSha(commit: string | null): string {
  return commit ? commit.slice(0, 12) : 'unknown';
}

function timestamp(): string {
  return new Date().toISOString();
}

function dateStamp(): string {
  return timestamp().split('T')[0];
}

function relFromCodeWikiRoot(codewikiRootPath: string, filePath: string): string {
  return relative(codewikiRootPath, filePath).split('\\').join('/');
}

function relFromSetDir(setDir: string, filePath: string): string {
  return relative(setDir, filePath).split('\\').join('/');
}

function yamlScalar(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return 'null';
  const str = String(value);
  if (str === '') return '""';
  if (/^(true|false|null|~|\[\]|\{\})$/.test(str)) return JSON.stringify(str);
  if (/[:#,[\]{}]|^\s|\s$/.test(str)) return JSON.stringify(str);
  return str;
}

function yamlLines(value: unknown, indent = 0): string[] {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`];
    const lines: string[] = [];
    for (const item of value) {
      if (isObject(item)) {
        const entries = Object.entries(item);
        if (entries.length === 0) {
          lines.push(`${pad}- {}`);
          continue;
        }
        const [firstKey, firstValue] = entries[0];
        if (isObject(firstValue) || Array.isArray(firstValue)) {
          lines.push(`${pad}- ${firstKey}:`);
          lines.push(...yamlLines(firstValue, indent + 4));
        } else {
          lines.push(`${pad}- ${firstKey}: ${yamlScalar(firstValue)}`);
        }
        for (const [key, nestedValue] of entries.slice(1)) {
          if (isObject(nestedValue) || Array.isArray(nestedValue)) {
            lines.push(`${pad}  ${key}:`);
            lines.push(...yamlLines(nestedValue, indent + 4));
          } else {
            lines.push(`${pad}  ${key}: ${yamlScalar(nestedValue)}`);
          }
        }
      } else {
        lines.push(`${pad}- ${yamlScalar(item)}`);
      }
    }
    return lines;
  }

  if (isObject(value)) {
    const lines: string[] = [];
    for (const [key, nestedValue] of Object.entries(value)) {
      if (isObject(nestedValue) || Array.isArray(nestedValue)) {
        lines.push(`${pad}${key}:`);
        lines.push(...yamlLines(nestedValue, indent + 2));
      } else {
        lines.push(`${pad}${key}: ${yamlScalar(nestedValue)}`);
      }
    }
    return lines;
  }

  return [`${pad}${yamlScalar(value)}`];
}

function toYaml(value: JsonObject): string {
  return `${yamlLines(value).join('\n')}\n`;
}

function ensureDir(dirPath: string, created: string[]): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    created.push(dirPath);
  }
}

function writeIfMissing(filePath: string, content: string, created: string[], reused: string[]): void {
  if (existsSync(filePath)) {
    reused.push(filePath);
    return;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
  created.push(filePath);
}

function writeIfChanged(filePath: string, content: string, created: string[], updated: string[], reused: string[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  if (!existsSync(filePath)) {
    writeFileSync(filePath, content, 'utf-8');
    created.push(filePath);
    return;
  }
  const current = readFileSync(filePath, 'utf-8');
  if (current === content) {
    reused.push(filePath);
    return;
  }
  writeFileSync(filePath, content, 'utf-8');
  updated.push(filePath);
}

function statusDashboardPath(wikiPath: string | null): string | null {
  if (!wikiPath) return null;
  const candidate = join(wikiPath, '00-meta', 'status-dashboard.md');
  return existsSync(candidate) ? candidate : null;
}

function manifestCommit(manifest: JsonObject | null, fallback: string | null): string | null {
  if (!manifest) return fallback;
  const freshness = isObject(manifest.freshness) ? manifest.freshness : {};
  return asString(freshness.valid_for_commit) ?? asString(manifest.commit_sha) ?? fallback;
}

function memberState(gitInfo: GitIdentity, manifest: JsonObject | null, expectedCommit: string | null): CodeWikiState {
  if (!gitInfo.is_git_repo || !gitInfo.commit) return 'missing';
  if (asString(manifest?.status) === 'frozen') return 'frozen';
  const expected = expectedCommit ?? manifestCommit(manifest, null);
  if (expected && gitInfo.commit !== expected) return 'stale';
  return gitInfo.dirty ? 'dirty-current' : 'current';
}

function nextAction(selection: CodeWikiSelection): string {
  if (selection.state === 'missing') return '/gsd-codewiki-init';
  if (selection.state === 'stale' || selection.state === 'dirty-current') return '/gsd-codewiki-update';
  if (selection.state === 'set-stale' || selection.state === 'set-partial') {
    return selection.set_id ? `/gsd-codewiki-update --set ${selection.set_id}` : '/gsd-codewiki-update';
  }
  if (selection.state === 'frozen') return 'No write action: selected CodeWiki is frozen.';
  return 'Use selected CodeWiki.';
}

function repoEntries(index: JsonObject): Array<{ repoId: string; repo: JsonObject }> {
  if (Array.isArray(index.repos)) {
    return index.repos
      .filter(isObject)
      .map((repo, idx) => ({ repoId: asString(repo.repo_id) ?? `repo-${idx + 1}`, repo }));
  }
  if (!isObject(index.repos)) return [];
  return Object.entries(index.repos)
    .filter(([, repo]) => isObject(repo))
    .map(([repoId, repo]) => ({ repoId, repo: repo as JsonObject }));
}

function versionEntries(repo: JsonObject): JsonObject[] {
  return Array.isArray(repo.versions) ? repo.versions.filter(isObject) : [];
}

function repoPathMatches(
  projectDir: string,
  codewikiRootPath: string,
  gitInfo: GitIdentity,
  repo: JsonObject,
  version: JsonObject,
): boolean {
  const currentRoot = gitInfo.root;
  const sourceRepo = asString(repo.source_repo) ?? asString(version.source_repo);
  const codeWorktree = asString(version.code_worktree);
  const sourcePath = sourceRepo ? resolveRepoPath(projectDir, codewikiRootPath, sourceRepo) : null;
  const worktreePath = codeWorktree ? resolveRepoPath(projectDir, codewikiRootPath, codeWorktree) : null;
  return samePath(currentRoot, sourcePath) || samePath(currentRoot, worktreePath);
}

function buildMemberFromVersion(
  projectDir: string,
  codewikiRootPath: string,
  indexPath: string,
  repoId: string,
  repo: JsonObject,
  version: JsonObject,
  gitInfo: GitIdentity,
): CodeWikiMember {
  const bases = [projectDir, codewikiRootPath, dirname(indexPath)];
  const manifestPath = resolveFirstExisting(asString(version.manifest), bases);
  const manifest = manifestPath ? readYaml(manifestPath) : null;
  const wikiPath = resolveFirstExisting(asString(version.wiki_path), bases);
  const expectedCommit = asString(version.commit_sha);
  const state = memberState(gitInfo, manifest, expectedCommit);

  return {
    repo_id: asString(repo.repo_id) ?? repoId,
    role: asString(version.role),
    required: true,
    source_repo: asString(repo.source_repo) ?? asString(version.source_repo),
    repo_root: gitInfo.root,
    branch: gitInfo.branch,
    current_commit: gitInfo.commit,
    current_short_commit: gitInfo.short_commit,
    expected_commit: expectedCommit,
    manifest_commit: manifestCommit(manifest, expectedCommit),
    dirty: gitInfo.dirty,
    state,
    version_id: asString(version.version_id),
    manifest_path: manifestPath,
    wiki_path: wikiPath,
    status_dashboard_path: statusDashboardPath(wikiPath),
    git_error: gitInfo.error,
  };
}

function selectRepo(projectDir: string, config: JsonObject, index: JsonObject, indexPath: string): CodeWikiSelection {
  const codewikiRootPath = codeWikiRoot(projectDir, config);
  const gitInfo = gitIdentity(projectDir);
  if (!gitInfo.is_git_repo) {
    const selection: CodeWikiSelection = {
      mode: 'repo',
      state: 'missing',
      codewiki_root: codewikiRootPath,
      index_path: indexPath,
      set_id: null,
      set_manifest_path: null,
      set_status: null,
      tuple_id: null,
      members: [],
      selected: null,
      next_action: '',
      reason: gitInfo.error ?? 'not a git repository',
      workspace_drift: emptyWorkspaceDrift(),
      warnings: [],
    };
    selection.next_action = nextAction(selection);
    return selection;
  }

  let best: { repoId: string; repo: JsonObject; version: JsonObject; score: number } | null = null;
  for (const { repoId, repo } of repoEntries(index)) {
    for (const version of versionEntries(repo)) {
      if (!repoPathMatches(projectDir, codewikiRootPath, gitInfo, repo, version)) continue;
      let score = 1;
      if (asString(version.commit_sha) && asString(version.commit_sha) === gitInfo.commit) score = 3;
      else if (asString(version.ref_name) && asString(version.ref_name) === gitInfo.branch) score = 2;
      if (!best || score > best.score) best = { repoId, repo, version, score };
    }
  }

  if (!best) {
    const selection: CodeWikiSelection = {
      mode: 'repo',
      state: 'missing',
      codewiki_root: codewikiRootPath,
      index_path: indexPath,
      set_id: null,
      set_manifest_path: null,
      set_status: null,
      tuple_id: null,
      members: [],
      selected: null,
      next_action: '',
      reason: 'no matching CodeWiki namespace in wiki-index.yaml',
      workspace_drift: emptyWorkspaceDrift(),
      warnings: [],
    };
    selection.next_action = nextAction(selection);
    return selection;
  }

  const member = buildMemberFromVersion(
    projectDir,
    codewikiRootPath,
    indexPath,
    best.repoId,
    best.repo,
    best.version,
    gitInfo,
  );

  const selection: CodeWikiSelection = {
    mode: 'repo',
    state: member.state,
    codewiki_root: codewikiRootPath,
    index_path: indexPath,
    set_id: null,
    set_manifest_path: null,
    set_status: null,
    tuple_id: null,
    members: [member],
    selected: member,
    next_action: '',
    reason: null,
    workspace_drift: emptyWorkspaceDrift(),
    warnings: [],
  };
  selection.next_action = nextAction(selection);
  return selection;
}

function setManifestPath(
  projectDir: string,
  codewikiRootPath: string,
  index: JsonObject,
  setId: string,
): string {
  const sets = isObject(index.sets) ? index.sets : {};
  const setRecord = isObject(sets[setId]) ? sets[setId] as JsonObject : {};
  const fromIndex = asString(setRecord.manifest);
  return resolveFirstExisting(fromIndex ?? join('sets', setId, 'wiki-set.yaml'), [projectDir, codewikiRootPath]) ??
    join(codewikiRootPath, 'sets', setId, 'wiki-set.yaml');
}

function buildMemberFromSet(
  projectDir: string,
  codewikiRootPath: string,
  setDir: string,
  rawMember: JsonObject,
): CodeWikiMember {
  const sourceRepo = asString(rawMember.source_repo);
  const repoPath = sourceRepo ? resolveRepoPath(projectDir, codewikiRootPath, sourceRepo) : projectDir;
  const gitInfo = gitIdentity(repoPath);
  const manifestPath = resolveFirstExisting(asString(rawMember.manifest), [setDir, projectDir, codewikiRootPath]);
  const manifest = manifestPath ? readYaml(manifestPath) : null;
  const wikiPath = resolveFirstExisting(asString(rawMember.wiki_path), [setDir, projectDir, codewikiRootPath]);
  const expectedCommit = asString(rawMember.commit_sha);
  const state = memberState(gitInfo, manifest, expectedCommit);

  return {
    repo_id: asString(rawMember.repo_id) ?? 'unknown',
    role: asString(rawMember.role),
    required: asBoolean(rawMember.required, true),
    source_repo: sourceRepo,
    repo_root: gitInfo.root,
    branch: gitInfo.branch,
    current_commit: gitInfo.commit,
    current_short_commit: gitInfo.short_commit,
    expected_commit: expectedCommit,
    manifest_commit: manifestCommit(manifest, expectedCommit),
    dirty: gitInfo.dirty,
    state,
    version_id: asString(rawMember.version_id),
    manifest_path: manifestPath,
    wiki_path: wikiPath,
    status_dashboard_path: statusDashboardPath(wikiPath),
    git_error: gitInfo.error,
  };
}

function aggregateSetState(setManifest: JsonObject, members: CodeWikiMember[]): CodeWikiState {
  if (asString(setManifest.status) === 'frozen') return 'frozen';
  const required = members.filter(member => member.required);
  const optional = members.filter(member => !member.required);
  const requiredNotCurrent = required.some(member => member.state !== 'current');
  if (requiredNotCurrent) return 'set-stale';
  const optionalNotCurrent = optional.some(member => member.state !== 'current');
  return optionalNotCurrent ? 'set-partial' : 'set-current';
}

function selectSet(
  projectDir: string,
  config: JsonObject,
  index: JsonObject,
  indexPath: string,
  setId: string,
): CodeWikiSelection {
  const codewikiRootPath = codeWikiRoot(projectDir, config);
  const manifestPath = setManifestPath(projectDir, codewikiRootPath, index, setId);
  const setManifest = readYaml(manifestPath);
  if (!setManifest) {
    const selection: CodeWikiSelection = {
      mode: 'set',
      state: 'missing',
      codewiki_root: codewikiRootPath,
      index_path: indexPath,
      set_id: setId,
      set_manifest_path: manifestPath,
      set_status: null,
      tuple_id: null,
      members: [],
      selected: null,
      next_action: '',
      reason: 'set manifest not found',
      workspace_drift: emptyWorkspaceDrift(),
      warnings: [],
    };
    selection.next_action = nextAction(selection);
    return selection;
  }

  const setDir = dirname(manifestPath);
  const rawMembers = Array.isArray(setManifest.members) ? setManifest.members.filter(isObject) : [];
  const members = rawMembers.map(member => buildMemberFromSet(projectDir, codewikiRootPath, setDir, member));
  const state = aggregateSetState(setManifest, members);
  const compatibility = isObject(setManifest.compatibility) ? setManifest.compatibility : {};
  const selection: CodeWikiSelection = {
    mode: 'set',
    state,
    codewiki_root: codewikiRootPath,
    index_path: indexPath,
    set_id: setId,
    set_manifest_path: manifestPath,
    set_status: asString(setManifest.status),
    tuple_id: asString(compatibility.tuple_id),
    members,
    selected: null,
    next_action: '',
    reason: null,
    workspace_drift: emptyWorkspaceDrift(),
    warnings: [],
  };
  selection.next_action = nextAction(selection);
  return selection;
}

function buildSelection(args: string[], projectDir: string): CodeWikiSelection {
  const options = parseOptions(args);
  const config = readConfig(projectDir);
  const codewikiRootPath = codeWikiRoot(projectDir, config);
  const indexPath = join(codewikiRootPath, 'wiki-index.yaml');
  const index = readYaml(indexPath);
  if (!index) {
    const setId = activeSetId(options, config);
    const selection: CodeWikiSelection = {
      mode: setId ? 'set' : 'repo',
      state: 'missing',
      codewiki_root: codewikiRootPath,
      index_path: indexPath,
      set_id: setId,
      set_manifest_path: null,
      set_status: null,
      tuple_id: null,
      members: [],
      selected: null,
      next_action: '',
      reason: 'wiki-index.yaml not found',
      workspace_drift: emptyWorkspaceDrift(),
      warnings: [],
    };
    selection.next_action = nextAction(selection);
    return attachWorkspaceDrift(selection, projectDir, config, null);
  }

  const setId = activeSetId(options, config);
  if (setId) return attachWorkspaceDrift(selectSet(projectDir, config, index, indexPath, setId), projectDir, config, index);
  return attachWorkspaceDrift(selectRepo(projectDir, config, index, indexPath), projectDir, config, index);
}

function latestSnapshotFromWiki(wikiPath: string | null): string | null {
  if (!wikiPath) return null;
  const snapshotDir = join(wikiPath, '10-snapshots');
  try {
    if (!existsSync(snapshotDir)) return null;
    const files = readdirSync(snapshotDir)
      .filter(file => file.endsWith('.md'))
      .map(file => join(snapshotDir, file))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    return files[0] ?? null;
  } catch {
    return null;
  }
}

function latestSnapshotForMember(member: CodeWikiMember): string | null {
  if (member.manifest_path) {
    const manifest = readYaml(member.manifest_path);
    const paths = isObject(manifest?.paths) ? manifest.paths : {};
    const fromManifest = resolveFirstExisting(asString(paths.latest_snapshot), [dirname(member.manifest_path)]);
    if (fromManifest && existsSync(fromManifest)) return fromManifest;
  }
  return latestSnapshotFromWiki(member.wiki_path);
}

function latestSetSnapshot(selection: CodeWikiSelection): string | null {
  if (!selection.set_manifest_path) return null;
  const setManifest = readYaml(selection.set_manifest_path);
  const paths = isObject(setManifest?.paths) ? setManifest.paths : {};
  const fromManifest = resolveFirstExisting(asString(paths.latest_snapshot), [dirname(selection.set_manifest_path)]);
  if (fromManifest && existsSync(fromManifest)) return fromManifest;

  const snapshotDir = join(dirname(selection.set_manifest_path), 'snapshots');
  try {
    if (!existsSync(snapshotDir)) return null;
    const files = readdirSync(snapshotDir)
      .filter(file => file.endsWith('.md'))
      .map(file => join(snapshotDir, file))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    return files[0] ?? null;
  } catch {
    return null;
  }
}

function crossRepoEntries(selection: CodeWikiSelection): JsonObject {
  if (!selection.set_manifest_path) return { contracts: [], flows: [] };
  const setManifest = readYaml(selection.set_manifest_path);
  const crossRepo = isObject(setManifest?.cross_repo) ? setManifest.cross_repo : {};
  return {
    contracts: Array.isArray(crossRepo.contracts) ? crossRepo.contracts.filter(isObject) : [],
    flows: Array.isArray(crossRepo.flows) ? crossRepo.flows.filter(isObject) : [],
  };
}

function readOpenQuestions(wikiPath: string | null): { path: string | null; questions: string[] } {
  if (!wikiPath) return { path: null, questions: [] };
  const openQuestionsPath = join(wikiPath, '09-review', 'open-questions.md');
  try {
    if (!existsSync(openQuestionsPath)) return { path: openQuestionsPath, questions: [] };
    const lines = readFileSync(openQuestionsPath, 'utf-8').split(/\r?\n/);
    const questions = lines
      .map(line => line.trim())
      .filter(line => /^[-*]\s+/.test(line))
      .map(line => line.replace(/^[-*]\s+/, '').trim())
      .filter(line => line.length > 0 && line.toLowerCase() !== 'none');
    return { path: openQuestionsPath, questions };
  } catch {
    return { path: openQuestionsPath, questions: [] };
  }
}

function planningCodebaseStatus(projectDir: string, latestSnapshots: Array<string | null>): JsonObject {
  const codebasePath = join(projectDir, '.planning', 'codebase');
  if (!existsSync(codebasePath)) {
    return { path: codebasePath, exists: false, older_than_latest_snapshot: null };
  }
  let codebaseMtime = 0;
  try {
    codebaseMtime = statSync(codebasePath).mtimeMs;
  } catch {
    return { path: codebasePath, exists: true, older_than_latest_snapshot: null };
  }
  const newestSnapshotMtime = latestSnapshots
    .filter((path): path is string => typeof path === 'string')
    .filter(path => existsSync(path))
    .map(path => statSync(path).mtimeMs)
    .reduce((max, value) => Math.max(max, value), 0);
  return {
    path: codebasePath,
    exists: true,
    older_than_latest_snapshot: newestSnapshotMtime > 0 ? codebaseMtime < newestSnapshotMtime : null,
  };
}

function markdownCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim() || '-';
}

function commitCell(value: string | null): string {
  return value ? shortSha(value) : '-';
}

function readTextIfPresent(filePath: string | null): string | null {
  try {
    if (!filePath || !existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function excerptMarkdown(filePath: string | null, maxChars = 2800): string | null {
  const content = readTextIfPresent(filePath);
  if (!content) return null;
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}\n\n[truncated]`;
}

function projectionOutputPath(projectDir: string): string {
  return join(projectDir, '.planning', 'codebase', 'codewiki-summary.md');
}

function projectionWarnings(selection: CodeWikiSelection): string[] {
  const warnings: string[] = [];
  if (selection.state === 'stale' || selection.state === 'set-stale' || selection.state === 'dirty-current' || selection.state === 'set-partial') {
    warnings.push(`Selected CodeWiki state is ${selection.state}; projection may describe an older or dirty code state.`);
  }
  if (selection.state === 'frozen') {
    warnings.push('Selected CodeWiki is frozen; projection is release/static context.');
  }
  warnings.push(...selection.workspace_drift.warnings);
  return warnings;
}

function renderProjection(selection: CodeWikiSelection, projectDir: string): string {
  const now = timestamp();
  const setSnapshot = latestSetSnapshot(selection);
  const warnings = projectionWarnings(selection);
  const frontmatter = toYaml({
    generated_by: 'gsd-codewiki-project',
    generated_at: now,
    mode: selection.mode,
    state: selection.state,
    set_id: selection.set_id,
    tuple_id: selection.tuple_id,
    codewiki_root: selection.codewiki_root,
  }).trimEnd();

  const lines: string[] = [
    '---',
    frontmatter,
    '---',
    '',
    '# CodeWiki 投影',
    '',
    '本文件是从 CodeWiki 生成的一次性规划投影。权威来源仍是 CodeWiki manifest、Git commit 和源码证据。',
    '',
    '## 选择结果',
    '',
    `- 模式：${selection.mode}`,
    `- 状态：${selection.state}`,
    `- Set：${selection.set_id ?? 'none'}`,
    `- Tuple：${selection.tuple_id ?? 'none'}`,
    `- CodeWiki root：${selection.codewiki_root}`,
    `- 建议下一步：${selection.next_action}`,
    '',
  ];

  if (warnings.length > 0) {
    lines.push('## 警告', '');
    for (const warning of warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  lines.push(
    '## 成员仓库',
    '',
    '| Repo | 状态 | 当前 Commit | Manifest Commit | Dirty | Wiki |',
    '|------|-------|---------|----------|-------|------|',
  );
  for (const member of selection.members) {
    lines.push([
      markdownCell(member.repo_id),
      markdownCell(member.state),
      markdownCell(commitCell(member.current_commit)),
      markdownCell(commitCell(member.manifest_commit)),
      markdownCell(member.dirty ? 'yes' : 'no'),
      markdownCell(member.wiki_path),
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  lines.push('');

  if (setSnapshot) {
    lines.push('## Set 快照', '', `来源：${setSnapshot}`, '');
    const excerpt = excerptMarkdown(setSnapshot, 3600);
    lines.push(excerpt ?? '_没有可用的 set snapshot 内容。_', '');
  }

  for (const member of selection.members) {
    const latestSnapshot = latestSnapshotForMember(member);
    const status = member.status_dashboard_path;
    const readme = member.wiki_path ? join(member.wiki_path, 'README.md') : null;
    const questions = readOpenQuestions(member.wiki_path);

    lines.push(`## 仓库：${member.repo_id}`, '');
    lines.push(`- 状态：${member.state}`);
    lines.push(`- 源仓库：${member.source_repo ?? member.repo_root ?? 'unknown'}`);
    lines.push(`- 当前 commit：${member.current_commit ?? 'unknown'}`);
    lines.push(`- Manifest commit：${member.manifest_commit ?? 'unknown'}`);
    lines.push(`- 最新 snapshot：${latestSnapshot ?? 'none'}`);
    lines.push(`- 状态面板：${status ?? 'none'}`);
    lines.push('');

    if (questions.questions.length > 0) {
      lines.push('### 开放问题', '');
      for (const question of questions.questions) lines.push(`- ${question}`);
      lines.push('');
    }

    const readmeExcerpt = excerptMarkdown(readme, 1800);
    if (readmeExcerpt) {
      lines.push('### Wiki README 摘录', '', readmeExcerpt, '');
    }

    const statusExcerpt = excerptMarkdown(status, 2200);
    if (statusExcerpt) {
      lines.push('### 状态面板摘录', '', statusExcerpt, '');
    }

    const snapshotExcerpt = excerptMarkdown(latestSnapshot, 3600);
    if (snapshotExcerpt) {
      lines.push('### 最新 Snapshot 摘录', '', snapshotExcerpt, '');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function intelEnabled(config: JsonObject): boolean {
  return isObject(config.intel) && config.intel.enabled === true;
}

function codewikiIntelPath(projectDir: string): string {
  return join(projectDir, '.planning', 'intel', 'codewiki.json');
}

function buildCodeWikiIntel(selection: CodeWikiSelection): JsonObject {
  const now = timestamp();
  const setSnapshot = latestSetSnapshot(selection);
  const records: JsonObject[] = [];

    if (selection.set_id) {
      records.push({
        kind: 'codewiki-set',
        set_id: selection.set_id,
        state: selection.state,
        status: selection.set_status,
        tuple_id: selection.tuple_id,
        manifest_path: selection.set_manifest_path,
        latest_snapshot: setSnapshot,
        member_repos: selection.members.map(member => member.repo_id),
        cross_repo: crossRepoEntries(selection),
        recommended_next_action: selection.next_action,
      });
    }

  for (const member of selection.members) {
    const latestSnapshot = latestSnapshotForMember(member);
    const questions = readOpenQuestions(member.wiki_path);
    records.push({
      kind: 'codewiki-repo',
      repo_id: member.repo_id,
      role: member.role,
      required: member.required,
      state: member.state,
      source_repo: member.source_repo,
      repo_root: member.repo_root,
      branch: member.branch,
      current_commit: member.current_commit,
      manifest_commit: member.manifest_commit,
      dirty: member.dirty,
      manifest_path: member.manifest_path,
      wiki_path: member.wiki_path,
      status_dashboard_path: member.status_dashboard_path,
      latest_snapshot: latestSnapshot,
      open_questions: questions.questions,
    });
  }

  const entries: JsonObject = {};
  for (const record of records) {
    const kind = asString(record.kind) ?? 'record';
    const key =
      kind === 'codewiki-set'
        ? `set:${asString(record.set_id) ?? 'unknown'}`
        : `repo:${asString(record.repo_id) ?? 'unknown'}`;
    entries[key] = record;
  }

  return {
    _meta: {
      updated_at: now,
      version: 1,
      source: 'codewiki',
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      tuple_id: selection.tuple_id,
      codewiki_root: selection.codewiki_root,
    },
    records,
    entries,
  };
}

function readWorkspaceManifestRepos(projectDir: string): string[] {
  const manifestPath = join(projectDir, 'WORKSPACE.md');
  try {
    if (!existsSync(manifestPath)) return [];
    const repos: string[] = [];
    for (const line of readFileSync(manifestPath, 'utf-8').split(/\r?\n/)) {
      const match = line.match(/^\|\s*([^|\s]+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|$/);
      if (!match) continue;
      const repoName = match[1].trim();
      if (repoName === 'Repo' || repoName.includes('---')) continue;
      repos.push(repoName);
    }
    return repos;
  } catch {
    return [];
  }
}

function detectChildGitRepos(projectDir: string): string[] {
  try {
    return readdirSync(projectDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => !name.startsWith('.') && name !== 'node_modules' && name !== 'code-wiki')
      .filter(name => existsSync(join(projectDir, name, '.git')))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function repoNamesFromPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map(repoPath => basename(repoPath)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function normalizedRepoList(repos: string[]): string[] {
  return Array.from(new Set(repos.map(repo => repo.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function addDriftSource(sources: WorkspaceDriftSource[], name: string, repos: string[]): void {
  const normalized = normalizedRepoList(repos);
  if (normalized.length === 0) return;
  sources.push({ name, repos: normalized });
}

function configRepoSources(config: JsonObject): WorkspaceDriftSource[] {
  const sources: WorkspaceDriftSource[] = [];
  addDriftSource(sources, 'codewiki.member_repos', stringArray(codeWikiConfig(config).member_repos));
  addDriftSource(sources, 'sub_repos', stringArray(config.sub_repos));
  const planning = isObject(config.planning) ? config.planning : {};
  addDriftSource(sources, 'planning.sub_repos', stringArray(planning.sub_repos));
  return sources;
}

function indexSetMemberRepos(index: JsonObject | null, setId: string | null): string[] {
  if (!index || !setId) return [];
  const sets = isObject(index.sets) ? index.sets : {};
  const setRecord = isObject(sets[setId]) ? sets[setId] as JsonObject : {};
  const members = Array.isArray(setRecord.members) ? setRecord.members.filter(isObject) : [];
  return members.map(member => asString(member.repo_id)).filter((repo): repo is string => Boolean(repo));
}

function driftIssue(source: WorkspaceDriftSource, canonical: WorkspaceDriftSource): WorkspaceDriftIssue | null {
  const sourceRepos = new Set(source.repos);
  const canonicalRepos = new Set(canonical.repos);
  const missing = canonical.repos.filter(repo => !sourceRepos.has(repo));
  const extra = source.repos.filter(repo => !canonicalRepos.has(repo));
  if (missing.length === 0 && extra.length === 0) return null;
  return {
    source: source.name,
    missing_from_source: missing,
    extra_in_source: extra,
  };
}

function driftWarning(issue: WorkspaceDriftIssue, canonicalSource: string): string {
  const parts: string[] = [];
  if (issue.missing_from_source.length > 0) {
    parts.push(`missing ${issue.missing_from_source.join(', ')}`);
  }
  if (issue.extra_in_source.length > 0) {
    parts.push(`extra ${issue.extra_in_source.join(', ')}`);
  }
  return `Workspace repo drift: ${issue.source} differs from ${canonicalSource} (${parts.join('; ')}).`;
}

function buildWorkspaceDrift(
  selection: CodeWikiSelection,
  projectDir: string,
  config: JsonObject,
  index: JsonObject | null,
): WorkspaceDriftReport {
  const sources = configRepoSources(config);
  addDriftSource(sources, 'wiki-index.set.members', indexSetMemberRepos(index, selection.set_id));
  if (selection.mode === 'set' && selection.members.length > 0) {
    addDriftSource(sources, 'wiki-set.members', selection.members.map(member => member.repo_id));
  }
  addDriftSource(sources, 'child_git_repos', detectChildGitRepos(projectDir));

  if (sources.length < 2) {
    return {
      ...emptyWorkspaceDrift(),
      sources,
    };
  }

  const canonical =
    sources.find(source => source.name === 'wiki-set.members') ??
    sources.find(source => source.name === 'wiki-index.set.members') ??
    sources.find(source => source.name === 'child_git_repos') ??
    sources[0];
  const issues = sources
    .filter(source => source.name !== canonical.name)
    .map(source => driftIssue(source, canonical))
    .filter((issue): issue is WorkspaceDriftIssue => Boolean(issue));

  return {
    checked: true,
    consistent: issues.length === 0,
    canonical_source: canonical.name,
    sources,
    issues,
    warnings: issues.map(issue => driftWarning(issue, canonical.name)),
  };
}

function attachWorkspaceDrift(
  selection: CodeWikiSelection,
  projectDir: string,
  config: JsonObject,
  index: JsonObject | null,
): CodeWikiSelection {
  const workspaceDrift = buildWorkspaceDrift(selection, projectDir, config, index);
  return {
    ...selection,
    workspace_drift: workspaceDrift,
    warnings: workspaceDrift.warnings,
  };
}

function initWorkspaceDriftWarnings(projectDir: string, selectedRepoPaths: string[], options: InitOptions): string[] {
  if (!options.setId || options.repos.length > 0) return [];
  const childRepos = detectChildGitRepos(projectDir);
  if (childRepos.length === 0) return [];
  const selectedRepos = repoNamesFromPaths(selectedRepoPaths);
  const selected = new Set(selectedRepos);
  const child = new Set(childRepos);
  const missing = childRepos.filter(repo => !selected.has(repo));
  const extra = selectedRepos.filter(repo => !child.has(repo));
  const warnings: string[] = [];
  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing child Git repos: ${missing.join(', ')}`);
    if (extra.length > 0) parts.push(`configured entries without child Git repo: ${extra.join(', ')}`);
    warnings.push(`Workspace repo drift before CodeWiki init: selected member repos differ from child Git repos (${parts.join('; ')}).`);
  }
  return warnings;
}

function memberRepoPaths(projectDir: string, codewikiRootPath: string, config: JsonObject, options: InitOptions): string[] {
  if (options.repos.length > 0) {
    return options.repos.map(repo => resolveRepoPath(projectDir, codewikiRootPath, repo));
  }

  const codewikiRepos = stringArray(codeWikiConfig(config).member_repos);
  if (codewikiRepos.length > 0) {
    return codewikiRepos.map(repo => resolveRepoPath(projectDir, codewikiRootPath, repo));
  }

  const topLevelSubRepos = stringArray(config.sub_repos);
  if (topLevelSubRepos.length > 0) {
    return topLevelSubRepos.map(repo => resolveRepoPath(projectDir, codewikiRootPath, repo));
  }

  const planning = isObject(config.planning) ? config.planning : {};
  const planningSubRepos = stringArray(planning.sub_repos);
  if (planningSubRepos.length > 0) {
    return planningSubRepos.map(repo => resolveRepoPath(projectDir, codewikiRootPath, repo));
  }

  const workspaceManifestRepos = readWorkspaceManifestRepos(projectDir);
  if (workspaceManifestRepos.length > 0) {
    return workspaceManifestRepos.map(repo => resolveRepoPath(projectDir, codewikiRootPath, repo));
  }

  if (options.setId) {
    const childGitRepos = detectChildGitRepos(projectDir);
    if (childGitRepos.length > 0) {
      return childGitRepos.map(repo => resolveRepoPath(projectDir, codewikiRootPath, repo));
    }
  }

  return [projectDir];
}

function buildInitMember(
  projectDir: string,
  codewikiRootPath: string,
  gitInfo: GitIdentity,
  repoId: string,
): InitMember {
  const branch = gitInfo.branch && gitInfo.branch !== 'HEAD' ? gitInfo.branch : null;
  const refType: 'branch' | 'commit' = branch ? 'branch' : 'commit';
  const refName = branch ?? shortSha(gitInfo.commit);
  const refNamespace = `${sanitizeId(refName)}-${shortSha(gitInfo.commit)}`;
  const versionId = `${repoId}__${refNamespace}`;
  const namespaceDir = join(codewikiRootPath, repoId, refNamespace);
  const manifestPath = join(namespaceDir, 'manifest.yaml');
  const wikiPath = join(namespaceDir, 'coder-llm-wiki');
  const latestSnapshot = join(wikiPath, '10-snapshots', `${dateStamp()}-${repoId}-${shortSha(gitInfo.commit)}.md`);

  return {
    repo_id: repoId,
    source_repo: gitInfo.root ?? gitInfo.requested_path,
    role: inferRepoRole(gitInfo),
    required: true,
    git: gitInfo,
    ref_type: refType,
    ref_name: refName,
    ref_namespace: refNamespace,
    version_id: versionId,
    manifest_path: manifestPath,
    manifest_rel: relFromCodeWikiRoot(codewikiRootPath, manifestPath),
    wiki_path: wikiPath,
    wiki_rel: relFromCodeWikiRoot(codewikiRootPath, wikiPath),
    latest_snapshot: latestSnapshot,
    latest_snapshot_rel: relFromCodeWikiRoot(codewikiRootPath, latestSnapshot),
  };
}

function uniqueRepoId(preferred: string, used: Map<string, number>): string {
  const base = sanitizeId(preferred);
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function discoverInitMembers(
  projectDir: string,
  codewikiRootPath: string,
  config: JsonObject,
  options: InitOptions,
): { members: InitMember[]; warnings: string[] } {
  const repoPaths = memberRepoPaths(projectDir, codewikiRootPath, config, options);
  const warnings: string[] = initWorkspaceDriftWarnings(projectDir, repoPaths, options);
  const seenRoots = new Set<string>();
  const usedIds = new Map<string, number>();
  const members: InitMember[] = [];

  for (const repoPath of repoPaths) {
    const gitInfo = gitIdentity(repoPath);
    if (!gitInfo.is_git_repo || !gitInfo.root || !gitInfo.commit) {
      warnings.push(`${repoPath}: ${gitInfo.error ?? 'not a git repository'}`);
      continue;
    }
    const rootKey = pathKey(gitInfo.root) ?? gitInfo.root;
    if (seenRoots.has(rootKey)) continue;
    seenRoots.add(rootKey);

    const preferredId =
      options.repoId && repoPaths.length === 1
        ? options.repoId
        : basename(gitInfo.root);
    members.push(buildInitMember(projectDir, codewikiRootPath, gitInfo, uniqueRepoId(preferredId, usedIds)));
  }

  if (options.setId && options.repos.length === 0 && members.length === 1) {
    warnings.push('No --repos, codewiki.member_repos, sub_repos, planning.sub_repos, WORKSPACE.md repos, or child Git repos found; initialized a one-member CodeWiki set.');
  }

  return { members, warnings };
}

function repoManifestContent(member: InitMember): string {
  const now = timestamp();
  return toYaml({
    repo_id: member.repo_id,
    source_repo: member.source_repo,
    ref_type: member.ref_type,
    ref_name: member.ref_name,
    commit_sha: member.git.commit,
    base_ref: '',
    base_commit_sha: '',
    wiki_version_id: member.version_id,
    created_at: now,
    updated_at: now,
    status: 'active',
    paths: {
      wiki_root: 'coder-llm-wiki/',
      deepwiki_export: 'deepwiki-export/deepwiki.md',
      latest_snapshot: relative(dirname(member.manifest_path), member.latest_snapshot).split('\\').join('/'),
    },
    source_policy: {
      final_truth: 'git_commit',
      seed_sources_allowed: true,
      seed_sources_are_evidence: false,
      evidence_required: true,
    },
    freshness: {
      valid_for_commit: member.git.commit,
      stale_if_commit_differs: true,
      dirty_at_last_update: member.git.dirty,
    },
  });
}

function repoSnapshotContent(member: InitMember): string {
  return [
    `# Snapshot：bootstrap`,
    '',
    '## Snapshot 元信息',
    `- 时间戳：${timestamp()}`,
    '- Batch ID：bootstrap',
    '- 当前 Phase：initialize',
    '- 操作者：gsd-codewiki-init',
    '- 触发原因：初始 CodeWiki namespace 创建',
    '',
    '## 当前状态',
    `- 仓库：${member.source_repo}`,
    `- Ref：${member.ref_type}:${member.ref_name}`,
    `- Commit：${member.git.commit}`,
    `- 初始化时 dirty：${member.git.dirty ? 'true' : 'false'}`,
    '- 进度：已初始化；bootstrap 分析尚未运行',
    '- 队列：inventory-core 和 index-core 处于 pending',
    '- 覆盖：inventory 0%，index 0%，modules 0/0，flows 0/0',
    '',
    '## 本批次完成内容',
    '',
    '- 已基于 Git identity 创建 CodeWiki namespace。',
    '',
    '## 写入产物',
    '',
    '- `manifest.yaml`',
    '- `coder-llm-wiki/` starter 契约和状态文件',
    '',
    '## Review 状态',
    '',
    '- Passed：无',
    '- Pass With Questions：无',
    '- Failed：无',
    '- Review-needed：bootstrap 分析尚未运行',
    '',
    '## 当前阻塞',
    '',
    member.git.dirty
      ? '- 初始化时 worktree 为 dirty；仅当本地改动应被纳入文档时才使用 `--allow-dirty`。'
      : '- 无',
    '',
    '## 开放问题',
    '',
    '- 无',
    '',
    '## 建议下一步',
    '',
    '1. 运行 `/gsd-codewiki-bootstrap <repo-id>`，执行 `/wiki-init`、inventory、index、module/flow 分析、review 和 snapshot。',
    '2. 运行 `/gsd-codewiki-status`，确认 freshness 和 bootstrap 状态。',
    '',
    '## 恢复说明',
    '',
    '- 先读取这些文件：',
    '  - `coder-llm-wiki/README.md`',
    '  - `coder-llm-wiki/00-meta/progress.json`',
    '  - `coder-llm-wiki/00-meta/task-queue.json`',
    '  - `coder-llm-wiki/00-meta/status-dashboard.md`',
    '- 从 `/gsd-codewiki-bootstrap` 恢复',
    '',
  ].join('\n');
}

function copyCoderLlmWikiTemplates(wikiPath: string, created: string[], reused: string[]): void {
  if (!existsSync(CODER_LLM_WIKI_TEMPLATE_DIR) || !statSync(CODER_LLM_WIKI_TEMPLATE_DIR).isDirectory()) return;

  const visit = (sourceDir: string): void => {
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      const sourcePath = join(sourceDir, entry.name);
      const relPath = relative(CODER_LLM_WIKI_TEMPLATE_DIR, sourcePath).split('\\').join('/');
      const targetPath = join(wikiPath, relPath);
      if (entry.isDirectory()) {
        ensureDir(targetPath, created);
        visit(sourcePath);
        continue;
      }
      if (!entry.isFile() || CODER_LLM_WIKI_RUNTIME_FILES.has(relPath)) continue;
      writeIfMissing(targetPath, readFileSync(sourcePath, 'utf-8'), created, reused);
    }
  };

  visit(CODER_LLM_WIKI_TEMPLATE_DIR);
}

function repoStarterProgress(member: InitMember): string {
  return `${JSON.stringify({
    repo_id: member.repo_id,
    phase: 'initialize',
    current_batch_id: 'bootstrap',
    execution: {
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
    },
    updated_at: timestamp(),
    last_snapshot: relative(member.wiki_path, member.latest_snapshot).split('\\').join('/'),
    phases: {
      initialize: 'pending',
      inventory: 'pending',
      index: 'pending',
      prepare_module_queue: 'pending',
      module_analysis: 'pending',
      lightweight_review: 'pending',
      flow_planning: 'pending',
      flow_analysis: 'pending',
      review: 'pending',
      snapshot: 'pending',
      incremental_updates: 'pending',
    },
    coverage: {
      inventory: 0,
      index: 0,
      modules_total: 0,
      modules_done: 0,
      flows_total: 0,
      flows_done: 0,
    },
    blockers: member.git.dirty
      ? ['CodeWiki 初始化时 worktree 为 dirty；bootstrap 在记录本地改动前应要求 --allow-dirty。']
      : [],
    last_diff_base: member.git.commit ?? '',
    notes: ['已由 gsd-codewiki-init 使用 coder-llm-wiki 契约初始化。'],
    completed_tasks: [],
  }, null, 2)}\n`;
}

function repoStarterTaskQueue(member: InitMember): string {
  const now = timestamp();
  return `${JSON.stringify({
    tasks: [
      {
        id: 'inventory-core',
        type: 'inventory',
        scope: ['repository root'],
        status: 'pending',
        owner: 'gsd-codewiki-maintainer',
        priority: 'high',
        attempts: 0,
        depends_on: [],
        inputs: [
          'README.md',
          '顶层配置文件',
          '仓库根目录结构',
        ],
        outputs: [
          'coder-llm-wiki/01-inventory/repo-map.md',
          'coder-llm-wiki/01-inventory/tech-stack.md',
          'coder-llm-wiki/01-inventory/entrypoints.md',
          'coder-llm-wiki/01-inventory/module-candidates.json',
        ],
        review_result: 'not_reviewed',
        notes: [`${member.repo_id} 的 bootstrap 队列。`],
        last_updated_at: now,
      },
      {
        id: 'index-core',
        type: 'index',
        scope: ['entrypoints', 'core symbols', 'tests'],
        status: 'pending',
        owner: 'gsd-codewiki-maintainer',
        priority: 'high',
        attempts: 0,
        depends_on: ['inventory-core'],
        inputs: [
          'coder-llm-wiki/01-inventory/entrypoints.md',
          '真实入口文件',
          '核心测试目录',
        ],
        outputs: [
          'coder-llm-wiki/02-index/routes.md',
          'coder-llm-wiki/02-index/symbols.md',
          'coder-llm-wiki/02-index/test-map.md',
        ],
        review_result: 'not_reviewed',
        notes: [`${member.repo_id} 的 bootstrap 队列。`],
        last_updated_at: now,
      },
    ],
    updated_at: now,
  }, null, 2)}\n`;
}

function repoStarterStatusDashboard(member: InitMember): string {
  return [
    '# 状态面板',
    '',
    '## 当前运行',
    '',
    '- 当前 phase：initialize',
    '- 当前 batch id：bootstrap',
    '- 执行模式：deferred-review',
    '- 是否请求确认：false',
    '- 是否阻塞于人工 review：false',
    '- 最大自动步数：8',
    '- Agent seed：auto / none / quick / not_run',
    '- 源码范围：默认全仓；排除路径 0；排除证据 false',
    `- 最后更新：${timestamp()}`,
    `- 最新 snapshot：${relative(member.wiki_path, member.latest_snapshot).split('\\').join('/')}`,
    `- Diff base：${member.git.commit ?? ''}`,
    '',
    '## 覆盖摘要',
    '',
    '- Inventory：`0% / 100%`',
    '- Index：`0% / 100%`',
    '- Modules：`0 / 0 done`',
    '- Flows：`0 / 0 done`',
    '',
    '## 当前优先级',
    '',
    '1. 运行 `/gsd-codewiki-bootstrap`，执行 `/wiki-init`、`/wiki-inventory` 和 `/wiki-index`。',
    '2. 基于真实入口点补齐高价值 module 和 flow 任务。',
    '3. 在把 wiki 作为规划上下文使用前，先完成 review 和 snapshot。',
    '',
    '## 当前阻塞',
    '',
    member.git.dirty
      ? '- 初始化时 worktree 为 dirty；bootstrap 在记录本地改动前应要求 `--allow-dirty`。'
      : '- 无',
    '',
    '## 最近完成',
    '',
    '- `codewiki-init` - 已创建 repo CodeWiki namespace 和 starter 契约文件',
    '',
    '## Review 队列',
    '',
    '- `review-needed`: 0',
    '- `blocked`: 0',
    '- `out-of-scope`: 0',
    '- `pending high-priority`: 2',
    '',
    '## 高风险缺口',
    '',
    '- Inventory 和 index 尚未完成。',
    '- 尚无通过源码验证的 module 或 flow 页面。',
    '',
    '## 需要人工 Review',
    '',
    '- 无',
    '',
    '## 建议下一步',
    '',
    '1. `/gsd-codewiki-bootstrap <repo-id>`',
    '2. `/gsd-codewiki-status`',
    '3. bootstrap 产生源码证据支撑的产物后，再运行 `/gsd-codewiki-project`',
    '',
  ].join('\n');
}

function ensureRepoNamespace(member: InitMember, created: string[], reused: string[]): void {
  const wikiDirs = [
    join(dirname(member.manifest_path), 'deepwiki-export'),
    member.wiki_path,
    join(member.wiki_path, '00-meta'),
    join(member.wiki_path, '01-inventory'),
    join(member.wiki_path, '02-index'),
    join(member.wiki_path, '03-modules'),
    join(member.wiki_path, '04-flows'),
    join(member.wiki_path, '05-data'),
    join(member.wiki_path, '06-ops'),
    join(member.wiki_path, '07-risks'),
    join(member.wiki_path, '08-evidence'),
    join(member.wiki_path, '09-review'),
    join(member.wiki_path, '10-snapshots'),
    join(member.wiki_path, '11-agent-seeds'),
  ];
  for (const dir of wikiDirs) ensureDir(dir, created);

  writeIfMissing(member.manifest_path, repoManifestContent(member), created, reused);
  copyCoderLlmWikiTemplates(member.wiki_path, created, reused);
  writeIfMissing(
    join(member.wiki_path, '00-meta', 'status-dashboard.md'),
    repoStarterStatusDashboard(member),
    created,
    reused,
  );
  writeIfMissing(
    join(member.wiki_path, '00-meta', 'progress.json'),
    repoStarterProgress(member),
    created,
    reused,
  );
  writeIfMissing(
    join(member.wiki_path, '00-meta', 'task-queue.json'),
    repoStarterTaskQueue(member),
    created,
    reused,
  );
  writeIfMissing(join(member.wiki_path, '09-review', 'open-questions.md'), '# 开放问题\n\n- 无\n', created, reused);
  writeIfMissing(join(member.wiki_path, '09-review', 'human-review.md'), '# 人工 Review\n\n- 无\n', created, reused);
  writeIfMissing(member.latest_snapshot, repoSnapshotContent(member), created, reused);
}

function normalizedIndex(existing: JsonObject | null): JsonObject {
  const index = existing ? { ...existing } : {};
  if (!isObject(index.repos)) index.repos = {};
  if (!isObject(index.sets)) index.sets = {};
  return {
    repos: index.repos,
    sets: index.sets,
  };
}

function upsertRepoInIndex(index: JsonObject, member: InitMember): void {
  const repos = index.repos as JsonObject;
  const repo = isObject(repos[member.repo_id])
    ? { ...(repos[member.repo_id] as JsonObject) }
    : {};
  repo.source_repo = member.source_repo;
  const versions = Array.isArray(repo.versions) ? repo.versions.filter(isObject) as JsonObject[] : [];
  const version: JsonObject = {
    version_id: member.version_id,
    role: member.role,
    ref_type: member.ref_type,
    ref_name: member.ref_name,
    commit_sha: member.git.commit,
    code_worktree: member.source_repo,
    wiki_path: member.wiki_rel,
    manifest: member.manifest_rel,
    status: 'active',
  };
  const existingIdx = versions.findIndex(item =>
    asString(item.version_id) === member.version_id ||
    asString(item.commit_sha) === member.git.commit,
  );
  if (existingIdx === -1) versions.push(version);
  else versions[existingIdx] = { ...versions[existingIdx], ...version };
  repo.versions = versions;
  repos[member.repo_id] = repo;
}

function setSnapshotPath(codewikiRootPath: string, setId: string, members: InitMember[]): string {
  const tuple = members.map(member => shortSha(member.git.commit)).join('_') || 'empty';
  return join(codewikiRootPath, 'sets', setId, 'snapshots', `${dateStamp()}-${sanitizeId(setId)}-${tuple}.md`);
}

function setManifestContent(existing: JsonObject | null, codewikiRootPath: string, setId: string, members: InitMember[], snapshotPath: string): string {
  const now = timestamp();
  const setDir = join(codewikiRootPath, 'sets', setId);
  const compatibility = isObject(existing?.compatibility) ? existing.compatibility : {};
  const crossRepo = isObject(existing?.cross_repo) ? existing.cross_repo : { contracts: [], flows: [] };
  const tupleId = `${setId}__${members.map(member => shortSha(member.git.commit)).join('_') || 'empty'}`;
  return toYaml({
    set_id: setId,
    name: asString(existing?.name) ?? setId,
    scope: asString(existing?.scope) ?? 'workspace',
    description: asString(existing?.description) ?? '',
    created_at: asString(existing?.created_at) ?? now,
    updated_at: now,
    status: asString(existing?.status) ?? 'active',
    members: members.map(member => ({
      repo_id: member.repo_id,
      role: member.role,
      required: member.required,
      source_repo: member.source_repo,
      ref_type: member.ref_type,
      ref_name: member.ref_name,
      commit_sha: member.git.commit,
      manifest: relFromSetDir(setDir, member.manifest_path),
      wiki_path: relFromSetDir(setDir, member.wiki_path),
    })),
    compatibility: {
      tuple_id: tupleId,
      stale_if_any_member_differs: asBoolean(compatibility.stale_if_any_member_differs, true),
      allow_optional_missing: asBoolean(compatibility.allow_optional_missing, false),
    },
    cross_repo: crossRepo,
    paths: {
      latest_snapshot: relFromSetDir(setDir, snapshotPath),
    },
  });
}

function setSnapshotContent(setId: string, members: InitMember[]): string {
  return [
    `# ${setId} CodeWiki Set 快照`,
    '',
    `创建时间：${timestamp()}`,
    '',
    '## 成员',
    '',
    ...members.map(member => `- ${member.repo_id}: ${shortSha(member.git.commit)} (${member.ref_name})`),
    '',
    '## 证据',
    '',
    '- 初始 CodeWiki set 基于成员仓库 Git identity 创建。',
    '',
    '## 开放问题',
    '',
    '- 无',
    '',
  ].join('\n');
}

function upsertSetInIndex(index: JsonObject, codewikiRootPath: string, setId: string, members: InitMember[]): string {
  const sets = index.sets as JsonObject;
  const manifestPath = join(codewikiRootPath, 'sets', setId, 'wiki-set.yaml');
  sets[setId] = {
    manifest: relFromCodeWikiRoot(codewikiRootPath, manifestPath),
    status: 'active',
    members: members.map(member => ({
      repo_id: member.repo_id,
      version_id: member.version_id,
    })),
  };
  return manifestPath;
}

function ensureSetNamespace(
  codewikiRootPath: string,
  setId: string,
  members: InitMember[],
  index: JsonObject,
  created: string[],
  updated: string[],
  reused: string[],
): string {
  const setDir = join(codewikiRootPath, 'sets', setId);
  ensureDir(setDir, created);
  ensureDir(join(setDir, 'snapshots'), created);
  ensureDir(join(setDir, 'cross-repo', 'contracts'), created);
  ensureDir(join(setDir, 'cross-repo', 'flows'), created);

  const setManifestPath = upsertSetInIndex(index, codewikiRootPath, setId, members);
  const snapshotPath = setSnapshotPath(codewikiRootPath, setId, members);
  const existing = readYaml(setManifestPath);
  writeIfChanged(
    setManifestPath,
    setManifestContent(existing, codewikiRootPath, setId, members, snapshotPath),
    created,
    updated,
    reused,
  );
  writeIfMissing(snapshotPath, setSnapshotContent(setId, members), created, reused);
  return setManifestPath;
}

function gitDiffNameStatus(repoRoot: string, baseCommit: string | null, headCommit: string, warnings: string[]): Array<{ status: string; path: string; classification: string }> {
  if (!baseCommit || baseCommit === headCommit) return [];
  const diff = git(repoRoot, ['diff', '--name-status', `${baseCommit}..${headCommit}`]);
  if (!diff.ok) {
    warnings.push(`${repoRoot}: could not read diff ${baseCommit}..${headCommit}: ${diff.stderr || diff.stdout}`);
    return [];
  }
  return diff.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\t+/);
      const status = parts[0] ?? '';
      const filePath = parts[parts.length - 1] ?? '';
      return {
        status,
        path: filePath,
        classification: classifyChange(status, filePath),
      };
    });
}

function classifyChange(status: string, filePath: string): string {
  const lower = filePath.toLowerCase();
  const name = basename(lower);
  if (status.startsWith('R')) return 'rename-or-move';
  if (status.startsWith('D')) return 'deletion';
  if (/(^|\/)(test|tests|spec|specs|__tests__)\//.test(lower) || /\.(test|spec)\.[a-z0-9]+$/.test(lower)) {
    return 'test-change';
  }
  if (
    name.startsWith('package.') ||
    name.endsWith('config.js') ||
    name.endsWith('config.ts') ||
    ['dockerfile', 'compose.yaml', 'docker-compose.yml', 'tsconfig.json', 'pyproject.toml', 'cargo.toml'].includes(name) ||
    lower.includes('/config/')
  ) {
    return 'config-change';
  }
  if (/(api|route|routes|controller|controllers|proto|openapi|graphql|schema)/.test(lower)) {
    return 'interface-change';
  }
  if (/(^|\/)(main|index|app|server|cli)\.[a-z0-9]+$/.test(lower)) {
    return 'entrypoint-change';
  }
  if (/(flow|workflow|orchestrat|pipeline|state-machine)/.test(lower)) {
    return 'flow-change';
  }
  return 'module-internal';
}

function phaseSearchTokens(phase: string): string[] {
  const normalized = normalizePhaseName(phase);
  const unpadded = normalized.replace(/^0+(?=\d)/, '');
  return uniqueStrings([phase, normalized, unpadded, `phase-${phase}`, `phase-${normalized}`, `phase-${unpadded}`]);
}

function commitSubjectMatchesPhase(subject: string, phase: string): boolean {
  const normalized = normalizePhaseName(phase);
  const unpadded = normalized.replace(/^0+(?=\d)/, '');
  const escaped = uniqueStrings([normalized, unpadded])
    .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return escaped.some(value => {
    const scopePattern = new RegExp(`\\((?:phase[-_ ])?0*${value}(?:[-_.)]|$)`, 'i');
    const prosePattern = new RegExp(`\\bphase\\s+0*${value}\\b`, 'i');
    return scopePattern.test(subject) || prosePattern.test(subject);
  });
}

function commitSubjectMatchesMilestone(subject: string, milestone: string): boolean {
  const escaped = milestone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9._-])${escaped}($|[^A-Za-z0-9._-])`, 'i').test(subject);
}

function matchingCommitRange(
  repoRoot: string,
  matchesSubject: (subject: string) => boolean,
  source: string,
  warnings: string[],
): ResolvedUpdateRange | null {
  const log = git(repoRoot, ['log', '--format=%H%x1f%s', 'HEAD']);
  if (!log.ok) {
    warnings.push(`${repoRoot}: could not inspect git log for ${source}: ${log.stderr || log.stdout}`);
    return null;
  }
  const commits = log.stdout
    .split(/\r?\n/)
    .map(line => {
      const [hash, subject = ''] = line.split('\x1f');
      return { hash, subject };
    })
    .filter(commit => commit.hash && matchesSubject(commit.subject));
  if (commits.length === 0) return null;
  const head = commits[0].hash;
  const oldest = commits[commits.length - 1].hash;
  const parent = git(repoRoot, ['rev-parse', `${oldest}^`]);
  return {
    base: parent.ok && parent.stdout ? parent.stdout : oldest,
    head,
    source,
    reason: `${commits.length} matching commit(s)`,
    skip: false,
  };
}

function previousTagCommit(repoRoot: string, headCommit: string): string | null {
  const previousTag = git(repoRoot, ['describe', '--tags', '--abbrev=0', `${headCommit}^`]);
  if (!previousTag.ok || !previousTag.stdout) return null;
  const previousCommit = git(repoRoot, ['rev-list', '-n', '1', previousTag.stdout]);
  return previousCommit.ok && previousCommit.stdout ? previousCommit.stdout : null;
}

function resolveMemberUpdateRange(
  repoRoot: string,
  currentHead: string,
  member: CodeWikiMember,
  options: UpdateOptions,
  selectionMode: 'repo' | 'set',
  warnings: string[],
): ResolvedUpdateRange {
  if (selectionMode === 'repo' && (options.base || options.head)) {
    return {
      base: options.base ?? (member.manifest_commit ?? member.expected_commit),
      head: options.head ?? currentHead,
      source: 'explicit',
      reason: '--base/--head',
      skip: false,
    };
  }

  if (options.phase) {
    const range = matchingCommitRange(
      repoRoot,
      subject => commitSubjectMatchesPhase(subject, options.phase as string),
      `phase:${normalizePhaseName(options.phase)}`,
      warnings,
    );
    if (range) return range;
    return {
      base: null,
      head: currentHead,
      source: `phase:${normalizePhaseName(options.phase)}`,
      reason: `no commits found for phase tokens: ${phaseSearchTokens(options.phase).join(', ')}`,
      skip: true,
    };
  }

  if (options.milestone) {
    const tagCommit = git(repoRoot, ['rev-list', '-n', '1', options.milestone]);
    if (tagCommit.ok && tagCommit.stdout) {
      return {
        base: previousTagCommit(repoRoot, tagCommit.stdout) ?? (member.manifest_commit ?? member.expected_commit),
        head: tagCommit.stdout,
        source: `milestone-tag:${options.milestone}`,
        reason: `tag ${options.milestone}`,
        skip: false,
      };
    }
    const range = matchingCommitRange(
      repoRoot,
      subject => commitSubjectMatchesMilestone(subject, options.milestone as string),
      `milestone:${options.milestone}`,
      warnings,
    );
    if (range) return range;
    return {
      base: null,
      head: currentHead,
      source: `milestone:${options.milestone}`,
      reason: `no tag or commits found for milestone ${options.milestone}`,
      skip: true,
    };
  }

  return {
    base: member.manifest_commit ?? member.expected_commit,
    head: currentHead,
    source: 'manifest-to-head',
    reason: null,
    skip: false,
  };
}

function updateOptionsFromVerifyOptions(options: VerifyOptions): UpdateOptions {
  return {
    setId: options.setId,
    base: options.base,
    head: options.head,
    phase: options.phase,
    milestone: options.milestone,
    prepareOnly: false,
    promoteOnly: false,
  };
}

function membersAffectedByUpdateRange(
  selection: CodeWikiSelection,
  options: UpdateOptions,
  warnings: string[],
): CodeWikiMember[] {
  const members = selection.members.filter(member => member.state !== 'missing');
  if (!options.phase && !options.milestone) return members;

  const affected: CodeWikiMember[] = [];
  for (const member of members) {
    const repoRoot = member.repo_root ?? (member.source_repo ? normalize(member.source_repo) : null);
    if (!repoRoot) {
      warnings.push(`${member.repo_id}: missing repo root`);
      continue;
    }
    const gitInfo = gitIdentity(repoRoot);
    if (!gitInfo.is_git_repo || !gitInfo.commit) {
      warnings.push(`${member.repo_id}: ${gitInfo.error ?? 'not a git repository'}`);
      continue;
    }
    const range = resolveMemberUpdateRange(gitInfo.root ?? repoRoot, gitInfo.commit, member, options, selection.mode, warnings);
    if (range.skip) {
      warnings.push(`${member.repo_id}: skipped ${range.source} update range (${range.reason})`);
      continue;
    }
    affected.push(member);
  }
  return affected;
}

function repoUpdateSnapshotPath(member: CodeWikiMember, headCommit: string): string {
  const wikiPath = member.wiki_path ?? dirname(member.manifest_path ?? '');
  return join(wikiPath, '10-snapshots', `${dateStamp()}-${member.repo_id}-${shortSha(headCommit)}-update.md`);
}

function repoMaintenancePlanPath(member: CodeWikiMember): string {
  const wikiPath = member.wiki_path ?? dirname(member.manifest_path ?? '');
  return join(wikiPath, '00-meta', 'maintenance-plan.json');
}

function uniqueExistingPaths(paths: Array<string | null>): string[] {
  const seen = new Set<string>();
  const existing: string[] = [];
  for (const filePath of paths) {
    if (!filePath || !existsSync(filePath)) continue;
    const key = pathKey(filePath) ?? normalize(filePath);
    if (seen.has(key)) continue;
    seen.add(key);
    existing.push(filePath);
  }
  return existing;
}

function seedSourceRecord(kind: SeedSource['kind'], filePath: string, baseDir: string): SeedSource | null {
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) return null;
    return {
      kind,
      path: filePath,
      relative_path: relative(baseDir, filePath).split('\\').join('/'),
      size_bytes: stats.size,
      updated_at: stats.mtime.toISOString(),
      evidence: false,
    };
  } catch {
    return null;
  }
}

function discoverSeedSources(member: CodeWikiMember): SeedSource[] {
  if (!member.manifest_path) return [];
  const namespaceDir = dirname(member.manifest_path);
  const manifest = readYaml(member.manifest_path);
  const paths = isObject(manifest?.paths) ? manifest.paths : {};
  const deepwikiPath = resolveFirstExisting(asString(paths.deepwiki_export), [namespaceDir]);
  const repomixPath = resolveFirstExisting(asString(paths.repomix_bundle), [namespaceDir]);
  const deepwikiCandidates = uniqueExistingPaths([
    deepwikiPath,
    join(namespaceDir, 'deepwiki-export', 'deepwiki.md'),
    join(namespaceDir, 'deepwiki-export', 'README.md'),
  ]);
  const repomixCandidates = uniqueExistingPaths([
    repomixPath,
    join(namespaceDir, 'repomix-output.xml'),
    join(namespaceDir, 'repomix-output.md'),
    join(namespaceDir, 'repomix-output.txt'),
    join(namespaceDir, 'repomix-output.json'),
    join(namespaceDir, 'repomix-bundle.xml'),
    join(namespaceDir, 'repomix-bundle.md'),
    join(namespaceDir, 'repomix', 'repomix-output.xml'),
    join(namespaceDir, 'repomix', 'repomix-output.md'),
    join(namespaceDir, 'repomix', 'repomix-output.txt'),
    join(namespaceDir, 'repomix', 'repomix-output.json'),
  ]);
  return [
    ...deepwikiCandidates.map(filePath => seedSourceRecord('deepwiki', filePath, namespaceDir)),
    ...repomixCandidates.map(filePath => seedSourceRecord('repomix', filePath, namespaceDir)),
  ].filter((source): source is SeedSource => Boolean(source));
}

function trimProcessOutput(value: string, maxChars = 4000): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}\n[truncated]`;
}

function configuredRepomixBin(config: JsonObject, options: PackOptions): string {
  return options.repomixBin ??
    asString(codeWikiConfig(config).repomix_bin) ??
    process.env.GSD_REPOMIX_BIN ??
    'repomix';
}

function deepWikiExportConfig(config: JsonObject): JsonObject {
  const value = codeWikiConfig(config).deepwiki_export;
  return isObject(value) ? value : {};
}

function configuredDeepWikiCommand(config: JsonObject, options: DeepWikiExportOptions): string | null {
  return options.command ??
    asString(deepWikiExportConfig(config).command) ??
    asString(codeWikiConfig(config).deepwiki_export_command) ??
    process.env.GSD_DEEPWIKI_EXPORT_CMD ??
    null;
}

function selectedSeedMembers(
  selection: CodeWikiSelection,
  repoIds: string[],
): { members: CodeWikiMember[]; error: JsonObject | null } {
  if (repoIds.length === 0) return { members: selection.members, error: null };
  const known = new Set(selection.members.map(member => member.repo_id));
  const unknown = repoIds.filter(repoId => !known.has(repoId));
  if (unknown.length > 0) {
    return {
      members: [],
      error: {
        error: `Unknown CodeWiki member repo_id: ${unknown.join(', ')}`,
        known_members: selection.members.map(member => member.repo_id),
      },
    };
  }
  const wanted = new Set(repoIds);
  return {
    members: selection.members.filter(member => wanted.has(member.repo_id)),
    error: null,
  };
}

function seedSelectionWarnings(selection: CodeWikiSelection): string[] {
  const warnings = [...selection.warnings];
  if (selection.state === 'stale' || selection.state === 'set-stale' || selection.state === 'dirty-current' || selection.state === 'set-partial') {
    warnings.push(`Selected CodeWiki state is ${selection.state}; generated seed may describe a dirty or stale source state.`);
  }
  if (selection.state === 'frozen') {
    warnings.push('Selected CodeWiki is frozen; generated seed is release/static context.');
  }
  return warnings;
}

function namespaceDirForMember(member: CodeWikiMember): string | null {
  if (member.manifest_path) return dirname(member.manifest_path);
  if (member.wiki_path) return dirname(member.wiki_path);
  return null;
}

function relFromNamespace(namespaceDir: string, filePath: string): string {
  return relative(namespaceDir, filePath).split('\\').join('/');
}

function repomixOutputFileName(style: RepomixStyle): string {
  if (style === 'markdown') return 'repomix-output.md';
  if (style === 'json') return 'repomix-output.json';
  if (style === 'plain') return 'repomix-output.txt';
  return 'repomix-output.xml';
}

function updateManifestSeedSource(
  member: CodeWikiMember,
  kind: 'repomix' | 'deepwiki',
  pathUpdates: JsonObject,
  sourceRecord: JsonObject,
  created: string[],
  updated: string[],
  reused: string[],
): void {
  if (!member.manifest_path) return;
  const existing = readYaml(member.manifest_path) ?? {};
  const paths = isObject(existing.paths) ? { ...existing.paths } : {};
  const seedSources = isObject(existing.seed_sources) ? { ...existing.seed_sources } : {};
  const manifest: JsonObject = {
    ...existing,
    updated_at: timestamp(),
    paths: {
      ...paths,
      ...pathUpdates,
    },
    seed_sources: {
      ...seedSources,
      [kind]: sourceRecord,
    },
    source_policy: {
      ...(isObject(existing.source_policy) ? existing.source_policy : {}),
      seed_sources_allowed: true,
      seed_sources_are_evidence: false,
      evidence_required: true,
    },
  };
  writeIfChanged(member.manifest_path, toYaml(manifest), created, updated, reused);
}

function writeSeedMetadata(
  filePath: string,
  metadata: JsonObject,
  created: string[],
  updated: string[],
  reused: string[],
): void {
  writeIfChanged(filePath, `${JSON.stringify(metadata, null, 2)}\n`, created, updated, reused);
}

function fileSizeOrNull(filePath: string): number | null {
  try {
    return existsSync(filePath) ? statSync(filePath).size : null;
  } catch {
    return null;
  }
}

function repomixCommandArgs(member: CodeWikiMember, outputPath: string, options: PackOptions): string[] {
  const repoRoot = member.repo_root ?? member.source_repo ?? '';
  const args = [repoRoot, '--output', outputPath, '--style', options.style ?? 'xml', '--quiet', '--parsable-style', '--truncate-base64'];
  if (options.compress) args.push('--compress');
  if (options.include) args.push('--include', options.include);
  if (options.ignore) args.push('--ignore', options.ignore);
  return args;
}

function packSeedForMember(
  member: CodeWikiMember,
  options: PackOptions,
  repomixBin: string,
  created: string[],
  updated: string[],
  reused: string[],
  warnings: string[],
): JsonObject {
  const namespaceDir = namespaceDirForMember(member);
  const repoRoot = member.repo_root ?? member.source_repo;
  const style = options.style ?? 'xml';
  if (!namespaceDir || !member.manifest_path) {
    return { repo_id: member.repo_id, status: 'failed', error: 'missing CodeWiki manifest path' };
  }
  if (!repoRoot) {
    return { repo_id: member.repo_id, status: 'failed', error: 'missing source repo path' };
  }
  const outputPath = join(namespaceDir, repomixOutputFileName(style));
  const metaPath = join(namespaceDir, 'repomix-output.meta.json');
  const args = repomixCommandArgs(member, outputPath, options);
  const command = [repomixBin, ...args];

  if (options.dryRun) {
    return {
      repo_id: member.repo_id,
      status: 'planned',
      repo_root: repoRoot,
      output_path: outputPath,
      meta_path: metaPath,
      command,
    };
  }

  if (existsSync(outputPath) && !options.force) {
    reused.push(outputPath);
    if (existsSync(metaPath)) reused.push(metaPath);
    return {
      repo_id: member.repo_id,
      status: 'reused',
      repo_root: repoRoot,
      output_path: outputPath,
      meta_path: metaPath,
      size_bytes: fileSizeOrNull(outputPath),
      command,
    };
  }

  mkdirSync(namespaceDir, { recursive: true });
  const result = spawnSync(repomixBin, args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = trimProcessOutput(result.stdout ?? '');
  const stderr = trimProcessOutput(result.stderr ?? '');
  if (result.error || result.status !== 0) {
    return {
      repo_id: member.repo_id,
      status: 'failed',
      repo_root: repoRoot,
      output_path: outputPath,
      command,
      exit_code: result.status,
      error: result.error instanceof Error ? result.error.message : (stderr || stdout || 'repomix failed'),
      stdout,
      stderr,
    };
  }
  if (!existsSync(outputPath)) {
    return {
      repo_id: member.repo_id,
      status: 'failed',
      repo_root: repoRoot,
      output_path: outputPath,
      command,
      exit_code: result.status,
      error: 'repomix completed but output file was not created',
      stdout,
      stderr,
    };
  }

  const generatedAt = timestamp();
  const relOutput = relFromNamespace(namespaceDir, outputPath);
  const relMeta = relFromNamespace(namespaceDir, metaPath);
  const metadata: JsonObject = {
    kind: 'repomix',
    tool: 'repomix',
    generated_at: generatedAt,
    source_repo: repoRoot,
    source_commit: member.current_commit,
    source_dirty: member.dirty,
    output_file: relOutput,
    style,
    command,
    seed_policy: {
      evidence: false,
      instruction: 'Repomix output is packed context only; verify every final CodeWiki claim against source files or Git diff.',
    },
  };
  writeSeedMetadata(metaPath, metadata, created, updated, reused);
  updateManifestSeedSource(
    member,
    'repomix',
    {
      repomix_bundle: relOutput,
      repomix_meta: relMeta,
    },
    {
      path: relOutput,
      meta: relMeta,
      generated_at: generatedAt,
      source_commit: member.current_commit,
      evidence: false,
    },
    created,
    updated,
    reused,
  );

  warnings.push(...(stderr ? [`${member.repo_id}: repomix stderr: ${stderr}`] : []));
  return {
    repo_id: member.repo_id,
    status: 'packed',
    repo_root: repoRoot,
    output_path: outputPath,
    meta_path: metaPath,
    size_bytes: fileSizeOrNull(outputPath),
    command,
    stdout,
    stderr,
  };
}

function splitCommandLine(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (const ch of input) {
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (escaping) current += '\\';
  if (current) args.push(current);
  return args;
}

function renderCommandTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => values[key] ?? match);
}

function deepWikiOutputPaths(member: CodeWikiMember): { outputDir: string; outputMd: string; outputJson: string; metaPath: string } | null {
  const namespaceDir = namespaceDirForMember(member);
  if (!namespaceDir) return null;
  const outputDir = join(namespaceDir, 'deepwiki-export');
  return {
    outputDir,
    outputMd: join(outputDir, 'deepwiki.md'),
    outputJson: join(outputDir, 'deepwiki.json'),
    metaPath: join(outputDir, 'manifest.json'),
  };
}

function writeDeepWikiRegistration(
  member: CodeWikiMember,
  renderedCommand: string | null,
  outputDir: string,
  outputMd: string,
  outputJson: string,
  metaPath: string,
  created: string[],
  updated: string[],
  reused: string[],
): JsonObject {
  const namespaceDir = namespaceDirForMember(member) ?? dirname(outputDir);
  const generatedAt = timestamp();
  const repoRoot = member.repo_root ?? member.source_repo ?? '';
  const relMd = relFromNamespace(namespaceDir, outputMd);
  const relJson = relFromNamespace(namespaceDir, outputJson);
  const relMeta = relFromNamespace(namespaceDir, metaPath);
  const hasJson = existsSync(outputJson);
  const metadata: JsonObject = {
    kind: 'deepwiki',
    tool: 'deepwiki-open',
    generated_at: generatedAt,
    source_repo: repoRoot,
    source_commit: member.current_commit,
    source_dirty: member.dirty,
    output_markdown: relMd,
    output_json: hasJson ? relJson : null,
    command: renderedCommand,
    seed_policy: {
      evidence: false,
      instruction: 'DeepWiki output is seed material only; verify every final CodeWiki claim against source files or Git diff.',
    },
  };
  writeSeedMetadata(metaPath, metadata, created, updated, reused);
  updateManifestSeedSource(
    member,
    'deepwiki',
    {
      deepwiki_export: relMd,
      ...(hasJson ? { deepwiki_json: relJson } : {}),
      deepwiki_meta: relMeta,
    },
    {
      path: relMd,
      ...(hasJson ? { json: relJson } : {}),
      meta: relMeta,
      generated_at: generatedAt,
      source_commit: member.current_commit,
      evidence: false,
    },
    created,
    updated,
    reused,
  );
  return metadata;
}

function deepWikiSeedForMember(
  member: CodeWikiMember,
  options: DeepWikiExportOptions,
  commandTemplate: string | null,
  created: string[],
  updated: string[],
  reused: string[],
  warnings: string[],
): JsonObject {
  const paths = deepWikiOutputPaths(member);
  const repoRoot = member.repo_root ?? member.source_repo;
  if (!paths || !member.manifest_path) {
    return { repo_id: member.repo_id, status: 'failed', error: 'missing CodeWiki manifest path' };
  }
  if (!repoRoot) {
    return { repo_id: member.repo_id, status: 'failed', error: 'missing source repo path' };
  }
  const values = {
    repo: repoRoot,
    repo_id: member.repo_id,
    branch: member.branch ?? '',
    commit: member.current_commit ?? '',
    output_dir: paths.outputDir,
    output_md: paths.outputMd,
    output_json: paths.outputJson,
  };
  const renderedCommand = commandTemplate ? renderCommandTemplate(commandTemplate, values) : null;

  if (options.dryRun) {
    return {
      repo_id: member.repo_id,
      status: 'planned',
      repo_root: repoRoot,
      output_dir: paths.outputDir,
      output_markdown: paths.outputMd,
      output_json: paths.outputJson,
      manifest_json: paths.metaPath,
      command: renderedCommand,
    };
  }

  if (existsSync(paths.outputMd) && !options.force && !options.registerExisting) {
    reused.push(paths.outputMd);
    if (existsSync(paths.outputJson)) reused.push(paths.outputJson);
    if (existsSync(paths.metaPath)) reused.push(paths.metaPath);
    return {
      repo_id: member.repo_id,
      status: 'reused',
      repo_root: repoRoot,
      output_dir: paths.outputDir,
      output_markdown: paths.outputMd,
      output_json: existsSync(paths.outputJson) ? paths.outputJson : null,
      manifest_json: paths.metaPath,
      size_bytes: fileSizeOrNull(paths.outputMd),
      command: renderedCommand,
    };
  }

  if (options.registerExisting) {
    if (!existsSync(paths.outputMd)) {
      return {
        repo_id: member.repo_id,
        status: 'failed',
        repo_root: repoRoot,
        output_markdown: paths.outputMd,
        error: '--register-existing requires deepwiki-export/deepwiki.md to exist',
      };
    }
    const metadata = writeDeepWikiRegistration(member, renderedCommand, paths.outputDir, paths.outputMd, paths.outputJson, paths.metaPath, created, updated, reused);
    if (!existsSync(paths.outputJson)) warnings.push(`${member.repo_id}: deepwiki-export/deepwiki.json not found; registered markdown only.`);
    return {
      repo_id: member.repo_id,
      status: 'registered',
      repo_root: repoRoot,
      output_dir: paths.outputDir,
      output_markdown: paths.outputMd,
      output_json: existsSync(paths.outputJson) ? paths.outputJson : null,
      manifest_json: paths.metaPath,
      size_bytes: fileSizeOrNull(paths.outputMd),
      metadata,
    };
  }

  if (!renderedCommand) {
    return {
      repo_id: member.repo_id,
      status: 'failed',
      repo_root: repoRoot,
      output_dir: paths.outputDir,
      output_markdown: paths.outputMd,
      output_json: paths.outputJson,
      error: 'DeepWiki export command is not configured. Pass --command or set codewiki.deepwiki_export.command / GSD_DEEPWIKI_EXPORT_CMD.',
    };
  }

  mkdirSync(paths.outputDir, { recursive: true });
  const argv = splitCommandLine(renderedCommand);
  if (argv.length === 0) {
    return {
      repo_id: member.repo_id,
      status: 'failed',
      repo_root: repoRoot,
      output_dir: paths.outputDir,
      error: 'DeepWiki export command rendered to an empty command.',
    };
  }
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeoutMs,
  });
  const stdout = trimProcessOutput(result.stdout ?? '');
  const stderr = trimProcessOutput(result.stderr ?? '');
  if (result.error || result.status !== 0) {
    return {
      repo_id: member.repo_id,
      status: 'failed',
      repo_root: repoRoot,
      output_dir: paths.outputDir,
      output_markdown: paths.outputMd,
      output_json: paths.outputJson,
      command: renderedCommand,
      exit_code: result.status,
      error: result.error instanceof Error ? result.error.message : (stderr || stdout || 'DeepWiki export command failed'),
      stdout,
      stderr,
    };
  }
  if (!existsSync(paths.outputMd)) {
    return {
      repo_id: member.repo_id,
      status: 'failed',
      repo_root: repoRoot,
      output_dir: paths.outputDir,
      output_markdown: paths.outputMd,
      output_json: paths.outputJson,
      command: renderedCommand,
      exit_code: result.status,
      error: 'DeepWiki export command completed but deepwiki.md was not created.',
      stdout,
      stderr,
    };
  }

  const metadata = writeDeepWikiRegistration(member, renderedCommand, paths.outputDir, paths.outputMd, paths.outputJson, paths.metaPath, created, updated, reused);
  if (!existsSync(paths.outputJson)) warnings.push(`${member.repo_id}: deepwiki-export/deepwiki.json not found; registered markdown only.`);
  return {
    repo_id: member.repo_id,
    status: 'exported',
    repo_root: repoRoot,
    output_dir: paths.outputDir,
    output_markdown: paths.outputMd,
    output_json: existsSync(paths.outputJson) ? paths.outputJson : null,
    manifest_json: paths.metaPath,
    size_bytes: fileSizeOrNull(paths.outputMd),
    command: renderedCommand,
    stdout,
    stderr,
    metadata,
  };
}

function uniqueClassifications(update: UpdateMember): string[] {
  return Array.from(new Set(update.changed_files.map(file => file.classification))).sort();
}

function changedPathsForClass(update: UpdateMember, classifications: string[]): string[] {
  const wanted = new Set(classifications);
  return update.changed_files
    .filter(file => wanted.has(file.classification))
    .map(file => file.path);
}

function repoMaintenanceTargets(update: UpdateMember): JsonObject[] {
  const targets: JsonObject[] = [];
  const addTarget = (path: string, reason: string, classifications: string[]): void => {
    const sourceFiles = changedPathsForClass(update, classifications);
    if (sourceFiles.length === 0) return;
    targets.push({
      path,
      reason,
      classifications,
      source_files: sourceFiles,
    });
  };
  addTarget('coder-llm-wiki/03-modules/', 'Module behavior changed; update impacted module docs.', ['module-internal', 'entrypoint-change']);
  addTarget('coder-llm-wiki/04-flows/', 'Flow or entrypoint behavior changed; update impacted flow docs.', ['flow-change', 'entrypoint-change']);
  addTarget('coder-llm-wiki/02-index/', 'Interface, config, rename, or deletion changed discoverability; update wiki indexes.', ['interface-change', 'config-change', 'rename-or-move', 'deletion']);
  addTarget('coder-llm-wiki/06-ops/', 'Configuration or runtime behavior changed; update operational configuration docs.', ['config-change']);
  addTarget('coder-llm-wiki/08-evidence/', 'Changed conclusions need source-backed evidence entries.', ['module-internal', 'interface-change', 'entrypoint-change', 'flow-change', 'config-change', 'test-change', 'rename-or-move', 'deletion']);
  addTarget('coder-llm-wiki/09-review/', 'Risky changes need review notes or open questions.', ['interface-change', 'config-change', 'rename-or-move', 'deletion']);
  return targets;
}

function setMaintenanceTargets(update: UpdateMember, selectionMode: 'repo' | 'set'): JsonObject[] {
  if (selectionMode !== 'set') return [];
  const targets: JsonObject[] = [];
  const addTarget = (path: string, reason: string, classifications: string[]): void => {
    const sourceFiles = changedPathsForClass(update, classifications);
    if (sourceFiles.length === 0) return;
    targets.push({
      path,
      reason,
      classifications,
      source_files: sourceFiles,
    });
  };
  addTarget('cross-repo/contracts/', 'Interface changes may affect producer/consumer contracts.', ['interface-change']);
  addTarget('cross-repo/flows/', 'Flow and entrypoint changes may affect integration flows.', ['flow-change', 'entrypoint-change']);
  addTarget('wiki-set.yaml', 'Config, rename, or deletion changes may affect set compatibility notes.', ['config-change', 'rename-or-move', 'deletion']);
  return targets;
}

function maintenanceTasks(update: UpdateMember, repoTargets: JsonObject[], setTargets: JsonObject[]): JsonObject[] {
  const seedSources = update.seed_sources.map(source => ({
    kind: source.kind,
    path: source.relative_path,
    evidence: false,
  }));
  return [
    ...repoTargets.map((target, idx) => ({
      id: `repo-${idx + 1}-${sanitizeId(asString(target.path) ?? 'target')}`,
      status: 'pending',
      scope: 'repo',
      target_path: asString(target.path) ?? 'unknown',
      reason: asString(target.reason) ?? 'Review impacted repo docs.',
      classifications: stringArray(target.classifications),
      source_files: stringArray(target.source_files),
      seed_sources: seedSources,
      required_evidence: ['git_diff', 'source_files'],
      completion_writes: [
        'coder-llm-wiki/00-meta/progress.json',
        'coder-llm-wiki/00-meta/task-queue.json',
      ],
    })),
    ...setTargets.map((target, idx) => ({
      id: `set-${idx + 1}-${sanitizeId(asString(target.path) ?? 'target')}`,
      status: 'pending',
      scope: 'set',
      target_path: asString(target.path) ?? 'unknown',
      reason: asString(target.reason) ?? 'Review impacted set docs.',
      classifications: stringArray(target.classifications),
      source_files: stringArray(target.source_files),
      seed_sources: seedSources,
      required_evidence: ['git_diff', 'source_files', 'cross_repo_evidence'],
      completion_writes: [
        'coder-llm-wiki/00-meta/progress.json',
        'coder-llm-wiki/00-meta/task-queue.json',
        'code-wiki/sets/<set-id>/cross-repo/',
      ],
    })),
  ];
}

function buildMaintenancePlan(member: CodeWikiMember, update: UpdateMember, selectionMode: 'repo' | 'set'): JsonObject {
  const classifications = uniqueClassifications(update);
  const repoTargets = repoMaintenanceTargets(update);
  const setTargets = setMaintenanceTargets(update, selectionMode);
  return {
    generated_at: timestamp(),
    repo_id: update.repo_id,
    mode: selectionMode,
    role: member.role,
    base_commit: update.base_commit,
    head_commit: update.head_commit,
    git_diff_range: `${update.base_commit ?? 'unknown'}..${update.head_commit}`,
    classifications,
    changed_files: update.changed_files,
    seed_sources: update.seed_sources,
    seed_policy: {
      seed_sources_allowed: true,
      seed_sources_are_evidence: false,
      instruction: 'Use DeepWiki and Repomix only for navigation/context; verify every claim against source files or Git diff before writing it as fact.',
    },
    repo_targets: repoTargets,
    set_targets: setTargets,
    tasks: maintenanceTasks(update, repoTargets, setTargets),
    required_evidence: [
      {
        kind: 'git_diff',
        range: `${update.base_commit ?? 'unknown'}..${update.head_commit}`,
      },
      {
        kind: 'source_files',
        paths: update.changed_files.map(file => file.path),
      },
    ],
    quality_gates: [
      'Every changed conclusion cites source files or Git diff.',
      'Seed-source claims are revalidated before use.',
      'Open questions are recorded when evidence is incomplete.',
      'Cross-repo claims cite every affected repo.',
    ],
  };
}

function targetSummaryLines(targets: unknown): string[] {
  if (!Array.isArray(targets) || targets.length === 0) return ['- none'];
  return targets
    .filter(isObject)
    .map(target => `- ${asString(target.path) ?? 'unknown'} - ${asString(target.reason) ?? 'review impacted docs'}`);
}

function taskSummaryLines(tasks: unknown): string[] {
  if (!Array.isArray(tasks) || tasks.length === 0) return ['- none'];
  return tasks
    .filter(isObject)
    .map(task => `- ${asString(task.id) ?? 'task'} [${asString(task.status) ?? 'pending'}] ${asString(task.target_path) ?? 'unknown'}`);
}

function repoMetaPath(member: CodeWikiMember, fileName: string): string | null {
  return member.wiki_path ? join(member.wiki_path, '00-meta', fileName) : null;
}

function taskRecordId(record: JsonObject): string | null {
  return asString(record.task_id) ?? asString(record.id);
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
  if (Array.isArray(value)) return value.flatMap(item => collectStringValues(item));
  if (!isObject(value)) return [];
  const out: string[] = [];
  for (const key of ['path', 'file', 'source', 'source_file', 'evidence_path', 'updated_file']) {
    out.push(...collectStringValues(value[key]));
  }
  return out;
}

function recordStringFields(record: JsonObject, fields: string[]): string[] {
  return uniqueStrings(fields.flatMap(field => collectStringValues(record[field])));
}

function taskRecordsFromJson(doc: JsonObject, fields: string[]): JsonObject[] {
  const records: JsonObject[] = [];
  for (const field of fields) {
    const value = doc[field];
    if (Array.isArray(value)) records.push(...value.filter(isObject));
  }
  if (taskRecordId(doc)) records.push(doc);
  return records;
}

function completedTaskRecords(progress: JsonObject): JsonObject[] {
  return taskRecordsFromJson(progress, ['tasks', 'completed_tasks', 'task_updates', 'updates'])
    .filter(record => {
      if (!taskRecordId(record)) return false;
      const status = asString(record.status)?.toLowerCase();
      return !status || ['complete', 'completed', 'done', 'updated', 'current'].includes(status);
    });
}

function blockedTaskRecords(queue: JsonObject): JsonObject[] {
  return taskRecordsFromJson(queue, ['tasks', 'blocked_tasks', 'queue', 'items'])
    .filter(record => {
      if (!taskRecordId(record)) return false;
      const status = asString(record.status)?.toLowerCase();
      return status === 'blocked' || (!status && Boolean(asString(record.reason)));
    });
}

function outOfScopeTaskRecords(queue: JsonObject): JsonObject[] {
  return taskRecordsFromJson(queue, ['tasks', 'out_of_scope_tasks', 'queue', 'items'])
    .filter(record => {
      if (!taskRecordId(record)) return false;
      const status = asString(record.status)?.toLowerCase();
      return status === 'out-of-scope' || status === 'out_of_scope' || status === 'excluded';
    });
}

function cleanEvidenceRef(raw: string): string {
  let value = raw.trim().replace(/^[-*]\s+/, '');
  const backtick = value.match(/`([^`]+)`/);
  if (backtick) value = backtick[1];
  else value = value.split(/\s+-\s+/)[0].trim();
  return value.trim();
}

function stripLineSuffix(raw: string): string {
  return raw.replace(/(?::\d+(?:-\d+)?){1,2}$/, '');
}

function repoPrefixedEvidence(raw: string, selection: CodeWikiSelection): { repo_id: string; path: string } | null {
  const value = cleanEvidenceRef(raw);
  const colon = value.indexOf(':');
  if (colon === -1) return null;
  const repoId = value.slice(0, colon);
  if (!selection.members.some(member => member.repo_id === repoId)) return null;
  const evidencePath = stripLineSuffix(value.slice(colon + 1));
  return evidencePath ? { repo_id: repoId, path: evidencePath } : null;
}

function normalizedEvidencePath(raw: string, selection: CodeWikiSelection | null = null): string {
  const prefixed = selection ? repoPrefixedEvidence(raw, selection) : null;
  return (prefixed?.path ?? stripLineSuffix(cleanEvidenceRef(raw))).split('\\').join('/').replace(/^\.\//, '');
}

function isSeedEvidence(raw: string): boolean {
  const value = cleanEvidenceRef(raw).toLowerCase();
  return value.includes('deepwiki-export/') || value.includes('repomix');
}

function taskSourceFiles(task: JsonObject): string[] {
  return stringArray(task.source_files).map(file => file.split('\\').join('/'));
}

function evidenceMatchesTaskSource(raw: string, task: JsonObject, selection: CodeWikiSelection | null = null): boolean {
  const evidencePath = normalizedEvidencePath(raw, selection);
  return taskSourceFiles(task).some(source =>
    evidencePath === source ||
    evidencePath.endsWith(`/${source}`) ||
    source.endsWith(`/${evidencePath}`),
  );
}

function evidenceCandidateBases(member: CodeWikiMember, selection: CodeWikiSelection): string[] {
  return [
    member.repo_root,
    member.wiki_path,
    member.wiki_path ? dirname(member.wiki_path) : null,
    member.manifest_path ? dirname(member.manifest_path) : null,
    selection.codewiki_root,
    dirname(selection.codewiki_root),
  ].filter((item): item is string => Boolean(item));
}

function existingResolvedPath(rawPath: string, bases: string[]): string | null {
  const expanded = expandHome(rawPath);
  if (isAbsolute(expanded)) return existsSync(expanded) ? normalize(expanded) : null;
  for (const base of bases) {
    const candidate = normalize(resolve(base, expanded));
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function evidencePathExists(raw: string, member: CodeWikiMember, selection: CodeWikiSelection): boolean {
  const prefixed = repoPrefixedEvidence(raw, selection);
  if (prefixed) {
    const repoMember = selection.members.find(candidate => candidate.repo_id === prefixed.repo_id);
    return Boolean(repoMember?.repo_root && existingResolvedPath(prefixed.path, [repoMember.repo_root]));
  }
  return Boolean(existingResolvedPath(stripLineSuffix(cleanEvidenceRef(raw)), evidenceCandidateBases(member, selection)));
}

function updatedFileExists(raw: string, member: CodeWikiMember, selection: CodeWikiSelection): boolean {
  return Boolean(existingResolvedPath(stripLineSuffix(cleanEvidenceRef(raw)), evidenceCandidateBases(member, selection)));
}

function evidenceRepoIds(raw: string, task: JsonObject, member: CodeWikiMember, selection: CodeWikiSelection): string[] {
  const prefixed = repoPrefixedEvidence(raw, selection);
  if (prefixed) return [prefixed.repo_id];
  const cleaned = stripLineSuffix(cleanEvidenceRef(raw));
  const existing = existingResolvedPath(cleaned, evidenceCandidateBases(member, selection));
  if (existing) {
    return selection.members
      .filter(candidate => candidate.repo_root && existing.startsWith(candidate.repo_root))
      .map(candidate => candidate.repo_id);
  }
  return evidenceMatchesTaskSource(raw, task, selection) ? [member.repo_id] : [];
}

function verifyTaskResolution(
  task: JsonObject,
  completed: JsonObject[],
  blocked: JsonObject[],
  outOfScope: JsonObject[],
  member: CodeWikiMember,
  selection: CodeWikiSelection,
): JsonObject {
  const taskId = taskRecordId(task) ?? 'unknown';
  const completedForTask = completed.filter(record => taskRecordId(record) === taskId);
  const blockedForTask = blocked.filter(record => taskRecordId(record) === taskId);
  const outOfScopeForTask = outOfScope.filter(record => taskRecordId(record) === taskId);
  const evidencePaths = uniqueStrings(completedForTask.flatMap(record =>
    recordStringFields(record, ['evidence_paths', 'evidence', 'source_files']),
  ));
  const updatedFiles = uniqueStrings(completedForTask.flatMap(record =>
    recordStringFields(record, ['updated_files', 'files']),
  ));
  const issues: string[] = [];
  let resolution = 'unresolved';

  if (completedForTask.length > 0) resolution = 'completed';
  if (blockedForTask.length > 0) resolution = completedForTask.length > 0 ? 'conflict' : 'blocked';
  if (outOfScopeForTask.length > 0) {
    resolution = completedForTask.length > 0 || blockedForTask.length > 0 ? 'conflict' : 'out-of-scope';
  }

  if (completedForTask.length === 0 && blockedForTask.length === 0 && outOfScopeForTask.length === 0) {
    issues.push('task has no completed, blocked, or out-of-scope record');
  }
  if (
    [completedForTask.length > 0, blockedForTask.length > 0, outOfScopeForTask.length > 0]
      .filter(Boolean).length > 1
  ) {
    issues.push('task is recorded with conflicting resolution records');
  }
  for (const record of blockedForTask) {
    if (!asString(record.reason)) issues.push('blocked task is missing reason');
  }
  for (const record of outOfScopeForTask) {
    if (!asString(record.reason)) issues.push('out-of-scope task is missing reason');
  }
  if (completedForTask.length > 0) {
    if (evidencePaths.length === 0) issues.push('completed task is missing evidence_paths');
    if (updatedFiles.length === 0) issues.push('completed task is missing updated_files');
    for (const evidencePath of evidencePaths) {
      if (isSeedEvidence(evidencePath)) {
        issues.push(`seed source cannot be final evidence: ${evidencePath}`);
      } else if (!evidencePathExists(evidencePath, member, selection) && !evidenceMatchesTaskSource(evidencePath, task, selection)) {
        issues.push(`evidence path does not resolve to source or task diff path: ${evidencePath}`);
      }
    }
    for (const updatedFile of updatedFiles) {
      if (!updatedFileExists(updatedFile, member, selection)) {
        issues.push(`updated file does not exist: ${updatedFile}`);
      }
    }
    if (stringArray(task.required_evidence).includes('cross_repo_evidence') && selection.members.length > 1) {
      const repoIds = new Set(evidencePaths.flatMap(evidencePath => evidenceRepoIds(evidencePath, task, member, selection)));
      if (repoIds.size < 2) issues.push('cross_repo_evidence requires evidence from at least two set members');
    }
  }

  return {
    task_id: taskId,
    target_path: asString(task.target_path) ?? asString(task.path) ?? 'unknown',
    resolution,
    valid: (resolution === 'completed' || resolution === 'out-of-scope') && issues.length === 0,
    issues,
    evidence_paths: evidencePaths,
    updated_files: updatedFiles,
    blocked_reasons: blockedForTask.map(record => asString(record.reason)).filter((item): item is string => Boolean(item)),
    out_of_scope_reasons: outOfScopeForTask.map(record => asString(record.reason)).filter((item): item is string => Boolean(item)),
  };
}

function verifyMemberMaintenance(
  member: CodeWikiMember,
  selection: CodeWikiSelection,
  options: VerifyMemberOptions = { requirePlan: false },
): JsonObject {
  const maintenancePlanPath = repoMetaPath(member, 'maintenance-plan.json');
  const progressPath = repoMetaPath(member, 'progress.json');
  const taskQueuePath = repoMetaPath(member, 'task-queue.json');
  const warnings: string[] = [];
  if (!maintenancePlanPath || !progressPath || !taskQueuePath) {
    return {
      repo_id: member.repo_id,
      verified: false,
      maintenance_plan_path: maintenancePlanPath,
      progress_path: progressPath,
      task_queue_path: taskQueuePath,
      error: 'CodeWiki meta paths are missing',
      tasks: [],
      totals: { tasks: 0, completed: 0, blocked: 0, out_of_scope: 0, unresolved: 0, invalid: 1 },
      warnings,
    };
  }
  if (!existsSync(maintenancePlanPath)) {
    if (options.requirePlan) {
      return {
        repo_id: member.repo_id,
        verified: false,
        no_plan: true,
        maintenance_plan_path: maintenancePlanPath,
        progress_path: progressPath,
        task_queue_path: taskQueuePath,
        error: 'maintenance-plan.json is missing; run codewiki.update --prepare-only before verification',
        tasks: [],
        totals: { tasks: 0, completed: 0, blocked: 0, out_of_scope: 0, unresolved: 0, invalid: 1 },
        warnings,
      };
    }
    return {
      repo_id: member.repo_id,
      verified: true,
      no_plan: true,
      maintenance_plan_path: maintenancePlanPath,
      progress_path: progressPath,
      task_queue_path: taskQueuePath,
      tasks: [],
      totals: { tasks: 0, completed: 0, blocked: 0, out_of_scope: 0, unresolved: 0, invalid: 0 },
      warnings: ['maintenance-plan.json is missing; no maintenance tasks were available to verify'],
    };
  }
  if (!existsSync(progressPath)) warnings.push('progress.json is missing; no completed task records can be verified');
  if (!existsSync(taskQueuePath)) warnings.push('task-queue.json is missing; blocked task records cannot be verified');

  const plan = readJson(maintenancePlanPath);
  const progress = readJson(progressPath);
  const taskQueue = readJson(taskQueuePath);
  const tasks = Array.isArray(plan.tasks) ? plan.tasks.filter(isObject) : [];
  const completed = completedTaskRecords(progress);
  const blocked = blockedTaskRecords(taskQueue);
  const outOfScope = outOfScopeTaskRecords(taskQueue);
  const taskResults = tasks.map(task => verifyTaskResolution(task, completed, blocked, outOfScope, member, selection));
  const completedCount = taskResults.filter(task => asString(task.resolution) === 'completed' && task.valid === true).length;
  const blockedCount = taskResults.filter(task => asString(task.resolution) === 'blocked').length;
  const outOfScopeCount = taskResults.filter(task => asString(task.resolution) === 'out-of-scope' && task.valid === true).length;
  const unresolvedCount = taskResults.filter(task => asString(task.resolution) === 'unresolved').length;
  const invalidCount = taskResults.filter(task => Array.isArray(task.issues) && task.issues.length > 0).length;

  return {
    repo_id: member.repo_id,
    verified: blockedCount === 0 && unresolvedCount === 0 && invalidCount === 0,
    maintenance_plan_path: maintenancePlanPath,
    progress_path: progressPath,
    task_queue_path: taskQueuePath,
    tasks: taskResults,
    totals: {
      tasks: tasks.length,
      completed: completedCount,
      blocked: blockedCount,
      out_of_scope: outOfScopeCount,
      unresolved: unresolvedCount,
      invalid: invalidCount,
    },
    warnings,
  };
}

function aggregateVerifyTotals(members: JsonObject[]): JsonObject {
  const totals = { tasks: 0, completed: 0, blocked: 0, out_of_scope: 0, unresolved: 0, invalid: 0 };
  for (const member of members) {
    const memberTotals = isObject(member.totals) ? member.totals : {};
    totals.tasks += Number(memberTotals.tasks ?? 0);
    totals.completed += Number(memberTotals.completed ?? 0);
    totals.blocked += Number(memberTotals.blocked ?? 0);
    totals.out_of_scope += Number(memberTotals.out_of_scope ?? 0);
    totals.unresolved += Number(memberTotals.unresolved ?? 0);
    totals.invalid += Number(memberTotals.invalid ?? 0);
  }
  return totals;
}

const BASELINE_PHASES = [
  'inventory',
  'index',
  'prepare_module_queue',
  'module_analysis',
  'lightweight_review',
  'flow_planning',
  'flow_analysis',
  'review',
  'snapshot',
];

function normalizedStatus(value: unknown, fallback = 'pending'): string {
  if (typeof value === 'boolean') return value ? 'done' : 'pending';
  return asString(value)?.toLowerCase() ?? fallback;
}

function isResolvedBaselineStatus(status: string): boolean {
  return [
    'done',
    'complete',
    'completed',
    'current',
    'passed',
    'verified',
    'skipped',
    'not-applicable',
    'not_applicable',
    'n/a',
    'out-of-scope',
    'out_of_scope',
    'excluded',
  ].includes(status);
}

function baselineTaskRecords(queue: JsonObject): JsonObject[] {
  return taskRecordsFromJson(queue, ['tasks', 'queue', 'items', 'blocked_tasks', 'out_of_scope_tasks'])
    .filter(record => Boolean(taskRecordId(record)));
}

function baselineTaskSummary(record: JsonObject): JsonObject {
  return {
    task_id: taskRecordId(record),
    status: normalizedStatus(record.status),
    target_path: asString(record.target_path) ?? asString(record.path) ?? null,
    reason: asString(record.reason),
  };
}

function verifyMemberBaseline(member: CodeWikiMember): JsonObject {
  const progressPath = repoMetaPath(member, 'progress.json');
  const taskQueuePath = repoMetaPath(member, 'task-queue.json');
  const warnings: string[] = [];
  if (!progressPath || !taskQueuePath) {
    return {
      verified: false,
      progress_path: progressPath,
      task_queue_path: taskQueuePath,
      pending_queue: [],
      incomplete_phases: [],
      warnings: ['CodeWiki baseline meta paths are missing'],
    };
  }
  if (!existsSync(progressPath)) warnings.push('progress.json is missing; baseline completeness cannot be verified');
  if (!existsSync(taskQueuePath)) warnings.push('task-queue.json is missing; starter or bootstrap queue cannot be verified');

  const progress = readJson(progressPath);
  const taskQueue = readJson(taskQueuePath);
  const queued = baselineTaskRecords(taskQueue);
  const pendingQueue = queued
    .filter(record => !isResolvedBaselineStatus(normalizedStatus(record.status)))
    .map(baselineTaskSummary);
  const phases = isObject(progress.phases) ? progress.phases : {};
  const incompletePhases = BASELINE_PHASES
    .map(phase => ({ phase, status: normalizedStatus(phases[phase], '') }))
    .filter(item => item.status && !isResolvedBaselineStatus(item.status));
  const verified = warnings.length === 0 && pendingQueue.length === 0 && incompletePhases.length === 0;

  return {
    verified,
    progress_path: progressPath,
    task_queue_path: taskQueuePath,
    pending_queue: pendingQueue,
    incomplete_phases: incompletePhases,
    warnings,
  };
}

function updateSnapshotContent(
  member: CodeWikiMember,
  update: UpdateMember,
  options: UpdateOptions,
): string {
  const context: string[] = [];
  if (options.phase) context.push(`Phase：${options.phase}`);
  if (options.milestone) context.push(`Milestone：${options.milestone}`);
  const changedLines = update.changed_files.length > 0
    ? update.changed_files.map(file => `- ${file.status} ${file.path} (${file.classification})`)
    : ['- 无'];
  const seedLines = update.seed_sources.length > 0
    ? update.seed_sources.map(source => `- ${source.kind}: ${source.relative_path} (${source.size_bytes} bytes，更新时间 ${source.updated_at}，seed-only)`)
    : ['- 无'];
  return [
    `# ${member.repo_id} CodeWiki 更新快照`,
    '',
    `创建时间：${timestamp()}`,
    `仓库：${update.repo_root}`,
    `Base：${update.base_commit ?? 'unknown'}`,
    `Head：${update.head_commit}`,
    `更新时 dirty：${update.dirty ? 'true' : 'false'}`,
    ...context,
    '',
    '## 变更文件',
    '',
    ...changedLines,
    '',
    '## 维护计划',
    '',
    `计划：${relative(dirname(update.snapshot_path), update.maintenance_plan_path).split('\\').join('/')}`,
    '',
    '仓库目标：',
    '',
    ...targetSummaryLines(update.maintenance_plan.repo_targets),
    '',
    'Set 目标：',
    '',
    ...targetSummaryLines(update.maintenance_plan.set_targets),
    '',
    '任务：',
    '',
    ...taskSummaryLines(update.maintenance_plan.tasks),
    '',
    '## Seed 来源',
    '',
    'Seed 来源仅作为上下文。它们不是最终证据，也不能替代 Git diff 或源码文件引用。',
    '',
    ...seedLines,
    '',
    '## 证据',
    '',
    `- Git diff range: ${update.base_commit ?? 'unknown'}..${update.head_commit}`,
    '',
    '## 开放问题',
    '',
    '- 无',
    '',
  ].join('\n');
}

function updateManifestForMember(member: CodeWikiMember, update: UpdateMember, created: string[], updated: string[], reused: string[]): void {
  if (!member.manifest_path) return;
  const existing = readYaml(member.manifest_path) ?? {};
  const paths = isObject(existing.paths) ? { ...existing.paths } : {};
  const freshness = isObject(existing.freshness) ? { ...existing.freshness } : {};
  const gitInfo = gitIdentity(update.repo_root);
  const manifest: JsonObject = {
    ...existing,
    repo_id: member.repo_id,
    source_repo: update.repo_root,
    ref_type: gitInfo.branch && gitInfo.branch !== 'HEAD' ? 'branch' : 'commit',
    ref_name: gitInfo.branch && gitInfo.branch !== 'HEAD' ? gitInfo.branch : shortSha(update.head_commit),
    commit_sha: update.head_commit,
    updated_at: timestamp(),
    status: 'active',
    paths: {
      ...paths,
      wiki_root: asString(paths.wiki_root) ?? 'coder-llm-wiki/',
      latest_snapshot: relative(dirname(member.manifest_path), update.snapshot_path).split('\\').join('/'),
    },
    freshness: {
      ...freshness,
      valid_for_commit: update.head_commit,
      stale_if_commit_differs: true,
      dirty_at_last_update: update.dirty,
    },
  };
  writeIfChanged(member.manifest_path, toYaml(manifest), created, updated, reused);
  update.manifest_promoted = true;
}

function updateRepoIndexForMember(index: JsonObject, codewikiRootPath: string, member: CodeWikiMember, update: UpdateMember): void {
  const repos = index.repos as JsonObject;
  const repoId = member.repo_id;
  const repo = isObject(repos[repoId]) ? { ...(repos[repoId] as JsonObject) } : {};
  repo.source_repo = update.repo_root;
  const versions = Array.isArray(repo.versions) ? repo.versions.filter(isObject) as JsonObject[] : [];
  const versionId = member.version_id ?? `${repoId}__${shortSha(update.head_commit)}`;
  const version: JsonObject = {
    version_id: versionId,
    ref_type: member.branch && member.branch !== 'HEAD' ? 'branch' : 'commit',
    ref_name: member.branch && member.branch !== 'HEAD' ? member.branch : shortSha(update.head_commit),
    commit_sha: update.head_commit,
    code_worktree: update.repo_root,
    wiki_path: member.wiki_path ? relFromCodeWikiRoot(codewikiRootPath, member.wiki_path) : null,
    manifest: member.manifest_path ? relFromCodeWikiRoot(codewikiRootPath, member.manifest_path) : null,
    status: 'active',
  };
  const idx = versions.findIndex(item =>
    asString(item.version_id) === versionId ||
    asString(item.manifest) === version.manifest,
  );
  if (idx === -1) versions.push(version);
  else versions[idx] = { ...versions[idx], ...version };
  repo.versions = versions;
  repos[repoId] = repo;
}

function updateMemberFromSelection(
  member: CodeWikiMember,
  options: UpdateOptions,
  selectionMode: 'repo' | 'set',
  mode: UpdateMutationMode,
  created: string[],
  updated: string[],
  reused: string[],
  warnings: string[],
): UpdateMember | null {
  if (!member.manifest_path || !member.wiki_path) {
    warnings.push(`${member.repo_id}: missing manifest_path or wiki_path`);
    return null;
  }
  if (member.state === 'frozen') {
    warnings.push(`${member.repo_id}: manifest is frozen`);
    return null;
  }
  const repoRoot = member.repo_root ?? (member.source_repo ? normalize(member.source_repo) : null);
  if (!repoRoot) {
    warnings.push(`${member.repo_id}: missing repo root`);
    return null;
  }
  const gitInfo = gitIdentity(repoRoot);
  if (!gitInfo.is_git_repo || !gitInfo.commit) {
    warnings.push(`${member.repo_id}: ${gitInfo.error ?? 'not a git repository'}`);
    return null;
  }
  const range = resolveMemberUpdateRange(gitInfo.root ?? repoRoot, gitInfo.commit, member, options, selectionMode, warnings);
  if (range.skip) {
    warnings.push(`${member.repo_id}: skipped ${range.source} update range (${range.reason})`);
    return null;
  }
  const headCommit = range.head;
  const baseCommit = range.base;
  const snapshotPath = repoUpdateSnapshotPath(member, headCommit);
  const maintenancePlanPath = repoMaintenancePlanPath(member);
  const update: UpdateMember = {
    repo_id: member.repo_id,
    repo_root: gitInfo.root ?? repoRoot,
    manifest_path: member.manifest_path,
    wiki_path: member.wiki_path,
    base_commit: baseCommit,
    head_commit: headCommit,
    short_head: shortSha(headCommit),
    dirty: gitInfo.dirty,
    changed_files: gitDiffNameStatus(gitInfo.root ?? repoRoot, baseCommit, headCommit, warnings),
    seed_sources: discoverSeedSources(member),
    maintenance_plan_path: maintenancePlanPath,
    maintenance_plan: {},
    snapshot_path: snapshotPath,
    manifest_promoted: false,
    range_source: range.source,
    range_reason: range.reason,
  };
  if (mode.writeMaintenancePlan) {
    update.maintenance_plan = buildMaintenancePlan(member, update, selectionMode);
    writeIfChanged(maintenancePlanPath, `${JSON.stringify(update.maintenance_plan, null, 2)}\n`, created, updated, reused);
  } else if (existsSync(maintenancePlanPath)) {
    update.maintenance_plan = readJson(maintenancePlanPath);
  } else if (mode.requireExistingPlan) {
    warnings.push(`${member.repo_id}: maintenance-plan.json is missing; run codewiki.update --prepare-only first`);
    return null;
  } else {
    update.maintenance_plan = buildMaintenancePlan(member, update, selectionMode);
  }
  if (mode.writeSnapshots) {
    writeIfMissing(snapshotPath, updateSnapshotContent(member, update, options), created, reused);
  }
  if (mode.promoteManifests) {
    updateManifestForMember(member, update, created, updated, reused);
  }
  return update;
}

function setUpdateSnapshotContent(setId: string, updates: UpdateMember[], options: UpdateOptions): string {
  const context: string[] = [];
  if (options.phase) context.push(`Phase：${options.phase}`);
  if (options.milestone) context.push(`Milestone：${options.milestone}`);
  return [
    `# ${setId} CodeWiki Set 更新快照`,
    '',
    `创建时间：${timestamp()}`,
    ...context,
    '',
    '## 成员',
    '',
    ...updates.map(update => `- ${update.repo_id}: ${shortSha(update.base_commit)}..${update.short_head} (${update.changed_files.length} files)`),
    '',
    '## 维护计划',
    '',
    ...updates.map(update => `- ${update.repo_id}: ${update.maintenance_plan_path}`),
    '',
    '## 证据',
    '',
    ...updates.map(update => `- ${update.repo_id}: ${update.base_commit ?? 'unknown'}..${update.head_commit}`),
    '',
    '## Seed 来源',
    '',
    'Seed 来源仅作为上下文，不是最终证据。',
    '',
    ...(
      updates.some(update => update.seed_sources.length > 0)
        ? updates.flatMap(update => update.seed_sources.map(source => `- ${update.repo_id}: ${source.kind} ${source.relative_path} (seed-only)`))
        : ['- 无']
    ),
    '',
    '## 开放问题',
    '',
    '- 无',
    '',
  ].join('\n');
}

function updateSetManifestForUpdates(
  selection: CodeWikiSelection,
  updates: UpdateMember[],
  options: UpdateOptions,
  created: string[],
  updated: string[],
  reused: string[],
): string | null {
  if (!selection.set_id || !selection.set_manifest_path) return null;
  const existing = readYaml(selection.set_manifest_path);
  if (!existing) return null;
  const setDir = dirname(selection.set_manifest_path);
  const updateByRepo = new Map(updates.map(update => [update.repo_id, update]));
  const rawMembers = Array.isArray(existing.members) ? existing.members.filter(isObject) : [];
  const members = rawMembers.map(member => {
    const repoId = asString(member.repo_id) ?? 'unknown';
    const update = updateByRepo.get(repoId);
    return update
      ? {
        ...member,
        commit_sha: update.head_commit,
        manifest: relFromSetDir(setDir, update.manifest_path),
        wiki_path: relFromSetDir(setDir, update.wiki_path),
      }
      : member;
  });
  const tupleId = `${selection.set_id}__${members.map(member => shortSha(asString(member.commit_sha))).join('_') || 'empty'}`;
  const snapshotPath = join(setDir, 'snapshots', `${dateStamp()}-${sanitizeId(selection.set_id)}-${tupleId.replace(`${selection.set_id}__`, '')}-update.md`);
  const compatibility = isObject(existing.compatibility) ? { ...existing.compatibility } : {};
  const paths = isObject(existing.paths) ? { ...existing.paths } : {};
  const manifest: JsonObject = {
    ...existing,
    updated_at: timestamp(),
    members,
    compatibility: {
      ...compatibility,
      tuple_id: tupleId,
      stale_if_any_member_differs: asBoolean(compatibility.stale_if_any_member_differs, true),
      allow_optional_missing: asBoolean(compatibility.allow_optional_missing, false),
    },
    paths: {
      ...paths,
      latest_snapshot: relFromSetDir(setDir, snapshotPath),
    },
  };
  writeIfChanged(selection.set_manifest_path, toYaml(manifest), created, updated, reused);
  writeIfMissing(snapshotPath, setUpdateSnapshotContent(selection.set_id, updates, options), created, reused);
  return snapshotPath;
}

function selectionArgsFromSetId(setId: string | null): string[] {
  return setId ? ['--set', setId] : [];
}

function setMutationError(selection: CodeWikiSelection, action: string): JsonObject | null {
  if (selection.state === 'missing') {
    return {
      [action]: false,
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      error: selection.reason ?? 'CodeWiki set not found',
      next_action: selection.next_action,
    };
  }
  if (selection.mode !== 'set') {
    return {
      [action]: false,
      mode: selection.mode,
      state: selection.state,
      error: `${action} requires a CodeWiki set. Pass --set <set-id> or configure codewiki.active_set.`,
      next_action: '/gsd-codewiki-init --set <set-id> --repos <paths>',
    };
  }
  if (selection.state === 'frozen' || selection.set_status === 'frozen') {
    return {
      [action]: false,
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      error: 'Selected CodeWiki set is frozen.',
      next_action: 'Create a new set before changing cross-repo docs.',
    };
  }
  return null;
}

function invalidMemberIds(selection: CodeWikiSelection, ids: string[]): string[] {
  const known = new Set(selection.members.map(member => member.repo_id));
  return ids.filter(id => !known.has(id));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function upsertCrossRepoEntry(crossRepo: JsonObject, kind: 'contracts' | 'flows', entry: JsonObject): JsonObject {
  const next = { ...crossRepo };
  const entries = Array.isArray(next[kind])
    ? next[kind].filter(isObject).map(item => ({ ...item }))
    : [];
  const entryName = asString(entry.name);
  const idx = entries.findIndex(item => asString(item.name) === entryName);
  if (idx === -1) {
    entries.push(entry);
  } else {
    const existing = entries[idx];
    entries[idx] = {
      ...existing,
      ...entry,
      docs: uniqueStrings([...stringArray(existing.docs), ...stringArray(entry.docs)]),
    };
  }
  next[kind] = entries;
  return next;
}

function writeCrossRepoManifestEntry(
  selection: CodeWikiSelection,
  kind: 'contracts' | 'flows',
  entry: JsonObject,
  created: string[],
  updated: string[],
  reused: string[],
  warnings: string[],
): boolean {
  if (!selection.set_manifest_path) {
    warnings.push('Missing set manifest path.');
    return false;
  }
  const existing = readYaml(selection.set_manifest_path);
  if (!existing) {
    warnings.push('Set manifest not found.');
    return false;
  }
  const crossRepo = isObject(existing.cross_repo) ? existing.cross_repo : {};
  const manifest: JsonObject = {
    ...existing,
    updated_at: timestamp(),
    cross_repo: upsertCrossRepoEntry(crossRepo, kind, entry),
  };
  writeIfChanged(selection.set_manifest_path, toYaml(manifest), created, updated, reused);
  return true;
}

function crossRepoWarnings(selection: CodeWikiSelection): string[] {
  const warnings: string[] = [];
  if (selection.state === 'set-stale' || selection.state === 'set-partial') {
    warnings.push(`Selected set is ${selection.state}; confirm member freshness before marking cross-repo docs current.`);
  }
  return warnings;
}

function contractDocContent(selection: CodeWikiSelection, options: ContractOptions): string {
  const consumers = options.consumers.length > 0
    ? options.consumers.flatMap(repoId => [
      `- Repo: \`${repoId}\``,
      '  - 使用方式：[消费方如何依赖这个契约]',
      '  - 文件：`path/to/file.ext`',
    ])
    : ['- Repo: `[consumer-repo]`', '  - 使用方式：[消费方如何依赖这个契约]', '  - 文件：`path/to/file.ext`'];
  return [
    `# 跨仓库契约：${options.name}`,
    '',
    `**Set:** ${selection.set_id}`,
    '**状态:** blocked',
    `**最后 Review:** ${dateStamp()}`,
    '',
    '## 生产方',
    '',
    `- Repo: \`${options.producer}\``,
    '- 暴露面：`[API/module/event/package]`',
    '- 文件：`path/to/file.ext`',
    '',
    '## 消费方',
    '',
    ...consumers,
    '',
    '## 契约面',
    '',
    '[描述请求/响应结构、导出符号、事件载荷、CLI 契约、包 API 或集成边界。]',
    '',
    '## 兼容性规则',
    '',
    `- 生产方和消费方必须基于 CodeWiki set tuple \`${selection.tuple_id ?? 'unknown'}\` 验证。`,
    '',
    '## 失败模式',
    '',
    '- [生产方和消费方发生偏移时会破坏什么]',
    '',
    '## 证据',
    '',
    `- 生产方：\`${options.producer}:path/to/file.ext:line-range\` - [为什么支撑该契约]`,
    ...options.consumers.map(repoId => `- 消费方：\`${repoId}:path/to/file.ext:line-range\` - [为什么证明该使用方式]`),
    '',
    '## 开放问题',
    '',
    '- 在把该契约视为 current 前，需要用精确源码路径和行号范围替换占位文件。',
    '',
  ].join('\n');
}

function flowDocContent(selection: CodeWikiSelection, options: FlowOptions): string {
  const repoRows = options.repos.length > 0
    ? options.repos.map(repoId => {
      const member = selection.members.find(candidate => candidate.repo_id === repoId);
      return `| \`${repoId}\` | ${member?.role ?? 'service'} | \`path/to/file.ext\` |`;
    })
    : ['| `[repo-id]` | [role] | `path/to/file.ext` |'];
  return [
    `# 跨仓库流程：${options.name}`,
    '',
    `**Set:** ${selection.set_id}`,
    '**状态:** blocked',
    `**最后 Review:** ${dateStamp()}`,
    '',
    '## 触发条件',
    '',
    '[说明这个流程由什么触发。]',
    '',
    '## 参与仓库',
    '',
    '| Repo | 角色 | 入口点 |',
    '|------|------|--------------|',
    ...repoRows,
    '',
    '## 主路径',
    '',
    '1. [带仓库和文件证据的步骤]',
    '',
    '## 失败路径',
    '',
    '- [失败条件及其处理位置]',
    '',
    '## 状态变化',
    '',
    '- [跨仓库的状态、存储、事件或外部系统变化]',
    '',
    '## 外部调用',
    '',
    '- [外部服务、API、队列、数据库或包边界]',
    '',
    '## 证据',
    '',
    ...options.repos.map(repoId => `- \`${repoId}\`: \`path/to/file.ext:line-range\` - [为什么重要]`),
    '',
    '## 开放问题',
    '',
    '- 在把该流程视为 current 前，需要用精确源码路径和行号范围替换占位文件。',
    '',
  ].join('\n');
}

function crossRepoDocPath(selection: CodeWikiSelection, kind: 'contracts' | 'flows', name: string): string | null {
  if (!selection.set_manifest_path) return null;
  return join(dirname(selection.set_manifest_path), 'cross-repo', kind, `${sanitizeId(name)}.md`);
}

function versionTagStatus(repoRoot: string, version: string, commit: string | null): JsonObject {
  if (!commit) {
    return { version, exists: false, points_at_head: false, tag_commit: null };
  }
  const tagCommit = git(repoRoot, ['rev-list', '-n', '1', version]);
  if (!tagCommit.ok || !tagCommit.stdout) {
    return { version, exists: false, points_at_head: false, tag_commit: null };
  }
  return {
    version,
    exists: true,
    points_at_head: tagCommit.stdout === commit,
    tag_commit: tagCommit.stdout,
  };
}

function freezeSnapshotPath(member: CodeWikiMember, version: string): string | null {
  if (!member.wiki_path) return null;
  return join(member.wiki_path, '10-snapshots', `${dateStamp()}-${member.repo_id}-${sanitizeId(version)}-freeze.md`);
}

function freezeRepoSnapshotContent(member: CodeWikiMember, version: string, tagStatus: JsonObject): string {
  return [
    `# ${member.repo_id} CodeWiki 冻结快照`,
    '',
    `创建时间：${timestamp()}`,
    `版本：${version}`,
    `仓库：${member.repo_root ?? member.source_repo ?? 'unknown'}`,
    `Commit：${member.current_commit ?? member.manifest_commit ?? member.expected_commit ?? 'unknown'}`,
    `Tag 存在：${tagStatus.exists === true ? 'true' : 'false'}`,
    `Tag 指向当前 commit：${tagStatus.points_at_head === true ? 'true' : 'false'}`,
    '',
    '## 证据',
    '',
    '- CodeWiki manifest 已针对发布版本冻结。',
    '',
    '## 开放问题',
    '',
    '- 无',
    '',
  ].join('\n');
}

function freezeRepoManifest(
  member: CodeWikiMember,
  version: string,
  snapshotPath: string | null,
  created: string[],
  updated: string[],
  reused: string[],
  warnings: string[],
): boolean {
  if (!member.manifest_path) {
    warnings.push(`${member.repo_id}: missing manifest path`);
    return false;
  }
  const existing = readYaml(member.manifest_path);
  if (!existing) {
    warnings.push(`${member.repo_id}: manifest not found`);
    return false;
  }
  const alreadyVersion = asString(existing.frozen_for_version);
  if (alreadyVersion && alreadyVersion !== version) {
    warnings.push(`${member.repo_id}: already frozen for ${alreadyVersion}; keeping original frozen version.`);
  }
  const paths = isObject(existing.paths) ? { ...existing.paths } : {};
  const manifest: JsonObject = {
    ...existing,
    status: 'frozen',
    frozen_at: asString(existing.frozen_at) ?? timestamp(),
    frozen_for_version: alreadyVersion ?? version,
    updated_at: asString(existing.updated_at) ?? timestamp(),
    paths: snapshotPath
      ? {
        ...paths,
        latest_snapshot: relative(dirname(member.manifest_path), snapshotPath).split('\\').join('/'),
      }
      : paths,
  };
  writeIfChanged(member.manifest_path, toYaml(manifest), created, updated, reused);
  return true;
}

function freezeRepoIndexEntry(index: JsonObject, codewikiRootPath: string, member: CodeWikiMember): void {
  const repos = index.repos as JsonObject;
  const repo = isObject(repos[member.repo_id]) ? { ...(repos[member.repo_id] as JsonObject) } : null;
  if (!repo) return;
  const manifestRel = member.manifest_path ? relFromCodeWikiRoot(codewikiRootPath, member.manifest_path) : null;
  const versions = Array.isArray(repo.versions) ? repo.versions.filter(isObject) as JsonObject[] : [];
  repo.versions = versions.map(version => {
    if (
      (member.version_id && asString(version.version_id) === member.version_id) ||
      (manifestRel && asString(version.manifest) === manifestRel) ||
      (member.manifest_path && samePath(resolveFirstExisting(asString(version.manifest), [codewikiRootPath]), member.manifest_path))
    ) {
      return { ...version, status: 'frozen' };
    }
    return version;
  });
  repos[member.repo_id] = repo;
}

function freezeSetSnapshotPath(selection: CodeWikiSelection, version: string): string | null {
  if (!selection.set_manifest_path || !selection.set_id) return null;
  return join(dirname(selection.set_manifest_path), 'snapshots', `${dateStamp()}-${sanitizeId(selection.set_id)}-${sanitizeId(version)}-freeze.md`);
}

function freezeSetSnapshotContent(selection: CodeWikiSelection, version: string, tagStatuses: Array<{ repo_id: string; tag: JsonObject }>): string {
  return [
    `# ${selection.set_id} CodeWiki Set 冻结快照`,
    '',
    `创建时间：${timestamp()}`,
    `版本：${version}`,
    `Tuple：${selection.tuple_id ?? 'unknown'}`,
    '',
    '## 成员',
    '',
    ...selection.members.map(member => `- ${member.repo_id}: ${shortSha(member.expected_commit ?? member.manifest_commit ?? member.current_commit)}`),
    '',
    '## Tags',
    '',
    ...tagStatuses.map(item => `- ${item.repo_id}: exists=${item.tag.exists === true ? 'true' : 'false'} points_at_head=${item.tag.points_at_head === true ? 'true' : 'false'}`),
    '',
    '## 证据',
    '',
    '- CodeWiki set manifest 已针对发布版本冻结。',
    '',
    '## 开放问题',
    '',
    '- 无',
    '',
  ].join('\n');
}

function freezeSetManifest(
  selection: CodeWikiSelection,
  version: string,
  snapshotPath: string | null,
  created: string[],
  updated: string[],
  reused: string[],
  warnings: string[],
): boolean {
  if (!selection.set_manifest_path) return false;
  const existing = readYaml(selection.set_manifest_path);
  if (!existing) {
    warnings.push('set manifest not found');
    return false;
  }
  const alreadyVersion = asString(existing.frozen_for_version);
  if (alreadyVersion && alreadyVersion !== version) {
    warnings.push(`${selection.set_id}: already frozen for ${alreadyVersion}; keeping original frozen version.`);
  }
  const paths = isObject(existing.paths) ? { ...existing.paths } : {};
  const manifest: JsonObject = {
    ...existing,
    status: 'frozen',
    frozen_at: asString(existing.frozen_at) ?? timestamp(),
    frozen_for_version: alreadyVersion ?? version,
    updated_at: asString(existing.updated_at) ?? timestamp(),
    paths: snapshotPath
      ? {
        ...paths,
        latest_snapshot: relFromSetDir(dirname(selection.set_manifest_path), snapshotPath),
      }
      : paths,
  };
  writeIfChanged(selection.set_manifest_path, toYaml(manifest), created, updated, reused);
  return true;
}

function shouldBlockStaleFreeze(selection: CodeWikiSelection, config: JsonObject): boolean {
  const requireFresh = asBoolean(codeWikiConfig(config).require_fresh_before_milestone_close, true);
  if (!requireFresh) return false;
  return selection.state === 'stale' || selection.state === 'set-stale';
}

function verifySelectionForFreeze(selection: CodeWikiSelection): JsonObject {
  if (selection.state === 'missing') {
    return {
      verified: false,
      freshness_verified: false,
      tasks_verified: false,
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      error: selection.reason ?? 'CodeWiki namespace or set not found',
      members: [],
      totals: { tasks: 0, completed: 0, blocked: 0, out_of_scope: 0, unresolved: 0, invalid: 1 },
      warnings: [],
    };
  }
  const freshnessVerified = selection.mode === 'set'
    ? selection.state === 'set-current'
    : selection.state === 'current';
  const warnings = freshnessVerified
    ? []
    : [`Selected CodeWiki state is ${selection.state}; maintenance tasks may not describe the current source state.`];
  warnings.push(...selection.warnings);
  const memberReports: JsonObject[] = selection.members
    .filter(member => member.state !== 'missing')
    .map(member => {
      const maintenance = verifyMemberMaintenance(member, selection);
      const baseline = verifyMemberBaseline(member);
      if (baseline.verified !== true) {
        warnings.push(`${member.repo_id}: CodeWiki baseline is incomplete; run /gsd-codewiki-bootstrap or /gsd-codewiki-enrich before verified freeze.`);
      }
      return {
        ...maintenance,
        baseline_verified: baseline.verified === true,
        baseline,
      };
    });
  const totals = aggregateVerifyTotals(memberReports);
  const tasksVerified = memberReports.length > 0 && memberReports.every(report => report.verified === true);
  const baselineVerified = memberReports.length > 0 && memberReports.every(report => report.baseline_verified === true);
  return {
    verified: freshnessVerified && tasksVerified && baselineVerified,
    freshness_verified: freshnessVerified,
    tasks_verified: tasksVerified,
    baseline_verified: baselineVerified,
    mode: selection.mode,
    state: selection.state,
    set_id: selection.set_id,
    tuple_id: selection.tuple_id,
    members: memberReports,
    totals,
    warnings,
  };
}

function verifySelectionMaintenanceOnly(selection: CodeWikiSelection, options: VerifyOptions): JsonObject {
  if (selection.state === 'missing') {
    return {
      verified: false,
      freshness_checked: false,
      tasks_verified: false,
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      error: selection.reason ?? 'CodeWiki namespace or set not found',
      members: [],
      totals: { tasks: 0, completed: 0, blocked: 0, out_of_scope: 0, unresolved: 0, invalid: 1 },
      warnings: [],
    };
  }

  const warnings = [...selection.warnings];
  const members = membersAffectedByUpdateRange(selection, updateOptionsFromVerifyOptions(options), warnings);
  const memberReports = members.map(member => verifyMemberMaintenance(member, selection, { requirePlan: true }));
  const totals = aggregateVerifyTotals(memberReports);
  const tasksVerified = memberReports.length > 0 && memberReports.every(report => report.verified === true);
  return {
    verified: tasksVerified,
    freshness_checked: false,
    tasks_verified: tasksVerified,
    mode: selection.mode,
    state: selection.state,
    set_id: selection.set_id,
    tuple_id: selection.tuple_id,
    members: memberReports,
    totals,
    warnings,
  };
}

export const codewikiPack: QueryHandler = async (args, projectDir) => {
  const options = parsePackOptions(args);
  if (options.styleError || !options.style) {
    return {
      data: {
        packed: false,
        error: options.styleError ?? 'invalid --style',
        usage: 'codewiki.pack [--set <set-id>] [--repo <repo-id>|--repos <repo-id,repo-id>] [--style xml|markdown|json|plain] [--force] [--dry-run]',
      },
    };
  }

  const config = readConfig(projectDir);
  const selection = buildSelection(selectionArgsFromSetId(options.setId), projectDir);
  if (selection.state === 'missing') {
    return {
      data: {
        packed: false,
        mode: selection.mode,
        state: selection.state,
        set_id: selection.set_id,
        error: selection.reason ?? 'CodeWiki namespace or set not found',
        next_action: selection.next_action,
      },
    };
  }

  const selected = selectedSeedMembers(selection, options.repoIds);
  if (selected.error) {
    return {
      data: {
        packed: false,
        mode: selection.mode,
        set_id: selection.set_id,
        ...selected.error,
      },
    };
  }

  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const warnings = seedSelectionWarnings(selection);
  const repomixBin = configuredRepomixBin(config, options);
  const members = selected.members.map(member =>
    packSeedForMember(member, options, repomixBin, created, updated, reused, warnings),
  );
  const failed = members.filter(member => asString(member.status) === 'failed');
  const packedCount = members.filter(member => asString(member.status) === 'packed').length;
  const reusedCount = members.filter(member => asString(member.status) === 'reused').length;

  return {
    data: {
      packed: !options.dryRun && failed.length === 0,
      dry_run: options.dryRun,
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      tuple_id: selection.tuple_id,
      repomix_bin: repomixBin,
      style: options.style,
      members,
      counts: {
        selected: members.length,
        packed: packedCount,
        reused: reusedCount,
        failed: failed.length,
      },
      created,
      updated_files: updated,
      reused,
      warnings,
      next_action: selection.set_id
        ? `/gsd-codewiki-deepwiki-export --set ${selection.set_id}`
        : '/gsd-codewiki-deepwiki-export',
    },
  };
};

export const codewikiDeepWikiExport: QueryHandler = async (args, projectDir) => {
  const options = parseDeepWikiExportOptions(args);
  if (options.timeoutError) {
    return {
      data: {
        exported: false,
        error: options.timeoutError,
        usage: 'codewiki.deepwiki-export [--set <set-id>] [--repo <repo-id>|--repos <repo-id,repo-id>] [--command <template>] [--register-existing] [--force] [--dry-run]',
      },
    };
  }

  const config = readConfig(projectDir);
  const selection = buildSelection(selectionArgsFromSetId(options.setId), projectDir);
  if (selection.state === 'missing') {
    return {
      data: {
        exported: false,
        mode: selection.mode,
        state: selection.state,
        set_id: selection.set_id,
        error: selection.reason ?? 'CodeWiki namespace or set not found',
        next_action: selection.next_action,
      },
    };
  }

  const selected = selectedSeedMembers(selection, options.repoIds);
  if (selected.error) {
    return {
      data: {
        exported: false,
        mode: selection.mode,
        set_id: selection.set_id,
        ...selected.error,
      },
    };
  }

  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const warnings = seedSelectionWarnings(selection);
  const commandTemplate = configuredDeepWikiCommand(config, options);
  const members = selected.members.map(member =>
    deepWikiSeedForMember(member, options, commandTemplate, created, updated, reused, warnings),
  );
  const failed = members.filter(member => asString(member.status) === 'failed');
  const exportedCount = members.filter(member => asString(member.status) === 'exported').length;
  const registeredCount = members.filter(member => asString(member.status) === 'registered').length;
  const reusedCount = members.filter(member => asString(member.status) === 'reused').length;

  return {
    data: {
      exported: !options.dryRun && failed.length === 0,
      dry_run: options.dryRun,
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      tuple_id: selection.tuple_id,
      command_configured: Boolean(commandTemplate),
      command_template: commandTemplate,
      members,
      counts: {
        selected: members.length,
        exported: exportedCount,
        registered: registeredCount,
        reused: reusedCount,
        failed: failed.length,
      },
      created,
      updated_files: updated,
      reused,
      warnings,
      next_action: selection.set_id
        ? `/gsd-codewiki-enrich <repo-id> --set ${selection.set_id}`
        : '/gsd-codewiki-enrich <repo-id>',
    },
  };
};

export const codewikiFreeze: QueryHandler = async (args, projectDir) => {
  const options = parseFreezeOptions(args);
  if (!options.version) {
    return {
      data: {
        frozen: false,
        error: 'version required',
        usage: 'codewiki.freeze <version> [--set <set-id>]',
      },
    };
  }

  const selectionArgs = options.setId ? ['--set', options.setId] : [];
  const selection = buildSelection(selectionArgs, projectDir);
  const config = readConfig(projectDir);
  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const warnings: string[] = [];

  if (selection.state === 'missing') {
    return {
      data: {
        frozen: false,
        error: selection.reason ?? 'CodeWiki namespace not found',
        next_action: '/gsd-codewiki-init',
      },
    };
  }
  if (shouldBlockStaleFreeze(selection, config)) {
    return {
      data: {
        frozen: false,
        error: 'Selected CodeWiki is stale; update before freezing.',
        state: selection.state,
        next_action: selection.set_id ? `/gsd-codewiki-update --set ${selection.set_id}` : '/gsd-codewiki-update',
      },
    };
  }
  if (options.requireVerified && !options.allowUnverified) {
    const verification = verifySelectionForFreeze(selection);
    if (verification.verified !== true) {
      return {
        data: {
          frozen: false,
          error: 'CodeWiki maintenance verification failed; resolve tasks or pass --allow-unverified with explicit acknowledgement.',
          verification,
          next_action: selection.set_id ? `/gsd-codewiki-verify --set ${selection.set_id}` : '/gsd-codewiki-verify',
        },
      };
    }
  }
  if (selection.state === 'dirty-current') {
    warnings.push('Freezing a dirty-current repo; uncommitted changes are not represented by the frozen commit.');
  }
  if (options.requireVerified && options.allowUnverified) {
    warnings.push('Freezing without verified CodeWiki maintenance because --allow-unverified was passed.');
  }

  const tagStatuses: Array<{ repo_id: string; tag: JsonObject }> = [];
  const frozenMembers: Array<{ repo_id: string; manifest_path: string | null; snapshot_path: string | null; tag: JsonObject }> = [];
  for (const member of selection.members) {
    const repoRoot = member.repo_root ?? (member.source_repo ? normalize(member.source_repo) : null);
    const commit = member.current_commit ?? member.manifest_commit ?? member.expected_commit;
    const tag = repoRoot ? versionTagStatus(repoRoot, options.version, commit) : { version: options.version, exists: false, points_at_head: false, tag_commit: null };
    tagStatuses.push({ repo_id: member.repo_id, tag });
    if (tag.exists !== true) warnings.push(`${member.repo_id}: tag ${options.version} not found`);
    else if (tag.points_at_head !== true) warnings.push(`${member.repo_id}: tag ${options.version} does not point at selected commit`);

    const snapshotPath = freezeSnapshotPath(member, options.version);
    if (snapshotPath) writeIfMissing(snapshotPath, freezeRepoSnapshotContent(member, options.version, tag), created, reused);
    freezeRepoManifest(member, options.version, snapshotPath, created, updated, reused, warnings);
    frozenMembers.push({
      repo_id: member.repo_id,
      manifest_path: member.manifest_path,
      snapshot_path: snapshotPath,
      tag,
    });
  }

  let setSnapshot: string | null = null;
  if (selection.mode === 'set') {
    setSnapshot = freezeSetSnapshotPath(selection, options.version);
    if (setSnapshot) writeIfMissing(setSnapshot, freezeSetSnapshotContent(selection, options.version, tagStatuses), created, reused);
    freezeSetManifest(selection, options.version, setSnapshot, created, updated, reused, warnings);
  }

  const index = normalizedIndex(readYaml(selection.index_path));
  for (const member of selection.members) {
    freezeRepoIndexEntry(index, selection.codewiki_root, member);
  }
  if (selection.mode === 'set' && selection.set_id) {
    const sets = index.sets as JsonObject;
    const existingSet = isObject(sets[selection.set_id]) ? sets[selection.set_id] as JsonObject : {};
    sets[selection.set_id] = {
      ...existingSet,
      manifest: selection.set_manifest_path ? relFromCodeWikiRoot(selection.codewiki_root, selection.set_manifest_path) : existingSet.manifest,
      status: 'frozen',
      frozen_for_version: options.version,
    };
  }
  writeIfChanged(selection.index_path, toYaml(index), created, updated, reused);

  return {
    data: {
      frozen: true,
      version: options.version,
      mode: selection.mode,
      set_id: selection.set_id,
      members: frozenMembers,
      set_manifest_path: selection.set_manifest_path,
      set_snapshot: setSnapshot,
      created,
      updated_files: updated,
      reused,
      warnings,
      next_action: selection.set_id ? `/gsd-codewiki-status --set ${selection.set_id}` : '/gsd-codewiki-status',
    },
  };
};

export const codewikiUpdate: QueryHandler = async (args, projectDir) => {
  const options = parseUpdateOptions(args);
  const selection = buildSelection(args, projectDir);
  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const warnings: string[] = [];

  if (options.prepareOnly && options.promoteOnly) {
    return {
      data: {
        updated: false,
        prepared: false,
        promoted: false,
        error: '--prepare-only and --promote-only cannot be used together',
      },
    };
  }
  if (selection.state === 'missing') {
    return {
      data: {
        updated: false,
        prepared: false,
        promoted: false,
        error: selection.reason ?? 'CodeWiki namespace not found',
        next_action: '/gsd-codewiki-init',
      },
    };
  }
  if (selection.state === 'frozen' || selection.set_status === 'frozen') {
    return {
      data: {
        updated: false,
        prepared: false,
        promoted: false,
        error: 'Selected CodeWiki manifest or set is frozen',
        next_action: 'Create a new namespace or set before updating.',
      },
    };
  }
  if (selection.mode === 'set' && (options.base || options.head)) {
    warnings.push('--base/--head are ignored for multi-repo sets; each member updates from manifest commit to its HEAD.');
  }

  const membersToUpdate = options.promoteOnly
    ? membersAffectedByUpdateRange(selection, options, warnings)
    : selection.members.filter(member => member.state !== 'missing');
  if (options.promoteOnly) {
    const missingPlans = membersToUpdate
      .map(member => ({ repo_id: member.repo_id, path: repoMaintenancePlanPath(member) }))
      .filter(plan => !existsSync(plan.path));
    if (missingPlans.length > 0) {
      return {
        data: {
          updated: false,
          prepared: false,
          promoted: false,
          mode: selection.mode,
          state_before: selection.state,
          set_id: selection.set_id,
          error: 'maintenance-plan.json missing; run codewiki.update --prepare-only before promotion',
          missing_plans: missingPlans,
          warnings,
          next_action: selection.set_id
            ? `/gsd-codewiki-update --set ${selection.set_id} --prepare-only`
            : '/gsd-codewiki-update --prepare-only',
        },
      };
    }
    const verificationMembers = membersToUpdate.map(member => verifyMemberMaintenance(member, selection, { requirePlan: true }));
    const verification = {
      verified: verificationMembers.every(member => member.verified === true),
      members: verificationMembers,
      totals: aggregateVerifyTotals(verificationMembers),
    };
    if (!verification.verified) {
      return {
        data: {
          updated: false,
          prepared: false,
          promoted: false,
          mode: selection.mode,
          state_before: selection.state,
          set_id: selection.set_id,
          error: 'maintenance verification failed; resolve pending, blocked, or invalid tasks before promotion',
          verification,
          warnings,
          next_action: selection.set_id ? `/gsd-codewiki-verify --set ${selection.set_id}` : '/gsd-codewiki-verify',
        },
      };
    }
  }
  const mutationMode: UpdateMutationMode = {
    writeMaintenancePlan: !options.promoteOnly,
    writeSnapshots: !options.prepareOnly,
    promoteManifests: !options.prepareOnly,
    requireExistingPlan: options.promoteOnly,
  };
  const updates = membersToUpdate
    .map(member => updateMemberFromSelection(member, options, selection.mode, mutationMode, created, updated, reused, warnings))
    .filter((member): member is UpdateMember => Boolean(member));

  if (updates.length === 0) {
    return {
      data: {
        updated: false,
        prepared: false,
        promoted: false,
        error: 'No updateable CodeWiki members found',
        selection,
        warnings,
      },
    };
  }

  const memberResults = updates.map(update => ({
    repo_id: update.repo_id,
    base_commit: update.base_commit,
    head_commit: update.head_commit,
    dirty: update.dirty,
    changed_files: update.changed_files,
    seed_sources: update.seed_sources,
    maintenance_plan_path: update.maintenance_plan_path,
    maintenance_plan: update.maintenance_plan,
    manifest_path: update.manifest_path,
    snapshot_path: update.snapshot_path,
    manifest_promoted: update.manifest_promoted,
    range_source: update.range_source,
    range_reason: update.range_reason,
  }));

  if (options.prepareOnly) {
    return {
      data: {
        updated: true,
        prepared: true,
        promoted: false,
        mode: selection.mode,
        state_before: selection.state,
        set_id: selection.set_id,
        members: memberResults,
        set_snapshot: null,
        created,
        updated_files: updated,
        reused,
        warnings,
        handoff: 'Run gsd-codewiki-maintainer against maintenance-plan.json before verification and promotion.',
        next_action: selection.set_id
          ? `/gsd-codewiki-verify --set ${selection.set_id} --maintenance-only`
          : '/gsd-codewiki-verify --maintenance-only',
      },
    };
  }

  const index = normalizedIndex(readYaml(selection.index_path));
  for (const memberUpdate of updates) {
    const member = selection.members.find(candidate => candidate.repo_id === memberUpdate.repo_id);
    if (member) updateRepoIndexForMember(index, selection.codewiki_root, member, memberUpdate);
  }

  let set_snapshot: string | null = null;
  if (selection.mode === 'set') {
    const requiredMissing = selection.members.filter(member => member.required && member.state === 'missing');
    if (requiredMissing.length > 0) {
      warnings.push(`Required set members missing: ${requiredMissing.map(member => member.repo_id).join(', ')}`);
    } else {
      set_snapshot = updateSetManifestForUpdates(selection, updates, options, created, updated, reused);
      if (selection.set_id) {
        const sets = index.sets as JsonObject;
        sets[selection.set_id] = {
          manifest: selection.set_manifest_path ? relFromCodeWikiRoot(selection.codewiki_root, selection.set_manifest_path) : null,
          status: 'active',
          members: selection.members.map(member => {
            const memberUpdate = updates.find(update => update.repo_id === member.repo_id);
            return {
              repo_id: member.repo_id,
              version_id: member.version_id,
              commit_sha: memberUpdate?.head_commit ?? member.expected_commit,
            };
          }),
        };
      }
    }
  }

  writeIfChanged(selection.index_path, toYaml(index), created, updated, reused);

  return {
    data: {
      updated: true,
      prepared: !options.promoteOnly,
      promoted: true,
      mode: selection.mode,
      state_before: selection.state,
      set_id: selection.set_id,
      members: memberResults,
      set_snapshot,
      created,
      updated_files: updated,
      reused,
      warnings,
      next_action: selection.set_id ? `/gsd-codewiki-status --set ${selection.set_id}` : '/gsd-codewiki-status',
    },
  };
};

export const codewikiContract: QueryHandler = async (args, projectDir) => {
  const options = parseContractOptions(args);
  if (!options.name) {
    return {
      data: {
        contract: false,
        error: 'contract name required',
        usage: 'codewiki.contract <name> --set <set-id> --producer <repo-id> --consumers <repo-id,repo-id>',
      },
    };
  }
  if (!options.producer || options.consumers.length === 0) {
    return {
      data: {
        contract: false,
        name: options.name,
        error: '--producer and --consumers are required',
        usage: 'codewiki.contract <name> --set <set-id> --producer <repo-id> --consumers <repo-id,repo-id>',
      },
    };
  }

  const selection = buildSelection(selectionArgsFromSetId(options.setId), projectDir);
  const setError = setMutationError(selection, 'contract');
  if (setError) return { data: setError };

  const invalid = invalidMemberIds(selection, [options.producer, ...options.consumers]);
  if (invalid.length > 0) {
    return {
      data: {
        contract: false,
        set_id: selection.set_id,
        name: options.name,
        error: `Unknown set member repo_id: ${invalid.join(', ')}`,
        known_members: selection.members.map(member => member.repo_id),
      },
    };
  }

  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const warnings = crossRepoWarnings(selection);
  const docPath = crossRepoDocPath(selection, 'contracts', options.name);
  if (!docPath || !selection.set_manifest_path) {
    return {
      data: {
        contract: false,
        set_id: selection.set_id,
        name: options.name,
        error: 'set manifest path missing',
      },
    };
  }
  const setDir = dirname(selection.set_manifest_path);
  const docRel = relFromSetDir(setDir, docPath);
  writeIfMissing(docPath, contractDocContent(selection, options), created, reused);
  writeCrossRepoManifestEntry(
    selection,
    'contracts',
    {
      name: options.name,
      producer_repo: options.producer,
      consumer_repos: options.consumers,
      docs: [docRel],
      status: 'blocked',
      updated_at: timestamp(),
    },
    created,
    updated,
    reused,
    warnings,
  );

  return {
    data: {
      contract: true,
      set_id: selection.set_id,
      name: options.name,
      producer_repo: options.producer,
      consumer_repos: options.consumers,
      path: docPath,
      manifest_path: selection.set_manifest_path,
      created,
      updated_files: updated,
      reused,
      warnings,
      next_action: selection.set_id ? `/gsd-codewiki-status --set ${selection.set_id}` : '/gsd-codewiki-status',
    },
  };
};

export const codewikiFlow: QueryHandler = async (args, projectDir) => {
  const options = parseFlowOptions(args);
  if (!options.name) {
    return {
      data: {
        flow: false,
        error: 'flow name required',
        usage: 'codewiki.flow <name> --set <set-id> --repos <repo-id,repo-id>',
      },
    };
  }
  if (options.repos.length === 0) {
    return {
      data: {
        flow: false,
        name: options.name,
        error: '--repos is required',
        usage: 'codewiki.flow <name> --set <set-id> --repos <repo-id,repo-id>',
      },
    };
  }

  const selection = buildSelection(selectionArgsFromSetId(options.setId), projectDir);
  const setError = setMutationError(selection, 'flow');
  if (setError) return { data: setError };

  const invalid = invalidMemberIds(selection, options.repos);
  if (invalid.length > 0) {
    return {
      data: {
        flow: false,
        set_id: selection.set_id,
        name: options.name,
        error: `Unknown set member repo_id: ${invalid.join(', ')}`,
        known_members: selection.members.map(member => member.repo_id),
      },
    };
  }

  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const warnings = crossRepoWarnings(selection);
  const docPath = crossRepoDocPath(selection, 'flows', options.name);
  if (!docPath || !selection.set_manifest_path) {
    return {
      data: {
        flow: false,
        set_id: selection.set_id,
        name: options.name,
        error: 'set manifest path missing',
      },
    };
  }
  const setDir = dirname(selection.set_manifest_path);
  const docRel = relFromSetDir(setDir, docPath);
  writeIfMissing(docPath, flowDocContent(selection, options), created, reused);
  writeCrossRepoManifestEntry(
    selection,
    'flows',
    {
      name: options.name,
      repos: options.repos,
      docs: [docRel],
      status: 'blocked',
      updated_at: timestamp(),
    },
    created,
    updated,
    reused,
    warnings,
  );

  return {
    data: {
      flow: true,
      set_id: selection.set_id,
      name: options.name,
      repos: options.repos,
      path: docPath,
      manifest_path: selection.set_manifest_path,
      created,
      updated_files: updated,
      reused,
      warnings,
      next_action: selection.set_id ? `/gsd-codewiki-status --set ${selection.set_id}` : '/gsd-codewiki-status',
    },
  };
};

export const codewikiInit: QueryHandler = async (args, projectDir) => {
  const options = parseInitOptions(args);
  const config = readConfig(projectDir);
  const codewikiRootPath = codeWikiRoot(projectDir, config);
  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const { members, warnings } = discoverInitMembers(projectDir, codewikiRootPath, config, options);

  if (members.length === 0) {
    return {
      data: {
        initialized: false,
        error: 'No Git repo found. Run this command inside a repo or pass --repos <paths>.',
        warnings,
      },
    };
  }

  ensureDir(codewikiRootPath, created);
  const indexPath = join(codewikiRootPath, 'wiki-index.yaml');
  const index = normalizedIndex(readYaml(indexPath));

  for (const member of members) {
    ensureRepoNamespace(member, created, reused);
    upsertRepoInIndex(index, member);
  }

  let setManifestPathValue: string | null = null;
  if (options.setId) {
    setManifestPathValue = ensureSetNamespace(
      codewikiRootPath,
      options.setId,
      members,
      index,
      created,
      updated,
      reused,
    );
  }

  writeIfChanged(indexPath, toYaml(index), created, updated, reused);

  return {
    data: {
      initialized: true,
      mode: options.setId ? 'set' : 'repo',
      codewiki_root: codewikiRootPath,
      index_path: indexPath,
      set_id: options.setId,
      set_manifest_path: setManifestPathValue,
      members: members.map(member => ({
        repo_id: member.repo_id,
        role: member.role,
        source_repo: member.source_repo,
        ref_type: member.ref_type,
        ref_name: member.ref_name,
        commit_sha: member.git.commit,
        dirty: member.git.dirty,
        manifest_path: member.manifest_path,
        wiki_path: member.wiki_path,
        version_id: member.version_id,
      })),
      created,
      updated,
      reused,
      warnings,
      next_action: options.setId ? `/gsd-codewiki-status --set ${options.setId}` : '/gsd-codewiki-status',
    },
  };
};

export const codewikiSelect: QueryHandler = async (args, projectDir) => {
  return { data: buildSelection(args, projectDir) };
};

export const codewikiStatus: QueryHandler = async (args, projectDir) => {
  const selection = buildSelection(args, projectDir);
  const snapshots = selection.members.map(member => ({
    repo_id: member.repo_id,
    path: latestSnapshotForMember(member),
  }));
  const openQuestions = selection.members.map(member => ({
    repo_id: member.repo_id,
    ...readOpenQuestions(member.wiki_path),
  }));
  const setSnapshot = latestSetSnapshot(selection);
  const crossRepo = crossRepoEntries(selection);

  return {
    data: {
      selection,
      repositories: selection.members.map(member => ({
        repo_id: member.repo_id,
        state: member.state,
        current_commit: member.current_commit,
        expected_commit: member.expected_commit,
        manifest_commit: member.manifest_commit,
        dirty: member.dirty,
        manifest_path: member.manifest_path,
        wiki_path: member.wiki_path,
        status_dashboard_path: member.status_dashboard_path,
      })),
      snapshots,
      set_snapshot: setSnapshot,
      cross_repo: crossRepo,
      open_questions: openQuestions,
      workspace_drift: selection.workspace_drift,
      warnings: selection.warnings,
      planning_codebase: planningCodebaseStatus(
        projectDir,
        [...snapshots.map(snapshot => snapshot.path), setSnapshot],
      ),
      recommended_next_action: selection.next_action,
    },
  };
};

export const codewikiVerify: QueryHandler = async (args, projectDir) => {
  const options = parseVerifyOptions(args);
  const selectionArgs = options.setId ? ['--set', options.setId] : [];
  const selection = buildSelection(selectionArgs, projectDir);

  if (selection.state === 'missing') {
    return {
      data: {
        verified: false,
        mode: selection.mode,
        state: selection.state,
        set_id: selection.set_id,
        error: selection.reason ?? 'CodeWiki namespace or set not found',
        next_action: selection.next_action,
      },
    };
  }

  const verification = options.maintenanceOnly
    ? verifySelectionMaintenanceOnly(selection, options)
    : verifySelectionForFreeze(selection);
  const verified = verification.verified === true;
  const baselineVerified = verification.baseline_verified;
  const needsBaseline = !options.maintenanceOnly && baselineVerified === false;

  return {
    data: {
      verified,
      freshness_verified: verification.freshness_verified,
      freshness_checked: verification.freshness_checked,
      tasks_verified: verification.tasks_verified,
      baseline_verified: baselineVerified,
      maintenance_only: options.maintenanceOnly,
      mode: verification.mode,
      state: verification.state,
      set_id: verification.set_id,
      tuple_id: verification.tuple_id,
      members: verification.members,
      totals: verification.totals,
      warnings: verification.warnings,
      next_action: verified
        ? (options.maintenanceOnly
          ? (selection.set_id ? `/gsd-codewiki-update --set ${selection.set_id} --promote-only` : '/gsd-codewiki-update --promote-only')
          : (selection.set_id ? `/gsd-codewiki-freeze <version> --set ${selection.set_id}` : '/gsd-codewiki-freeze <version>'))
        : (needsBaseline
          ? (selection.set_id ? `/gsd-codewiki-bootstrap <repo-id> --set ${selection.set_id}` : '/gsd-codewiki-bootstrap <repo-id>')
          : (selection.set_id ? `/gsd-codewiki-update --set ${selection.set_id}` : '/gsd-codewiki-update')),
    },
  };
};

export const codewikiProject: QueryHandler = async (args, projectDir) => {
  const options = parseProjectOptions(args);
  const selectionArgs = options.setId ? ['--set', options.setId] : [];
  const selection = buildSelection(selectionArgs, projectDir);

  if (selection.state === 'missing') {
    return {
      data: {
        projected: false,
        mode: selection.mode,
        state: selection.state,
        set_id: selection.set_id,
        error: selection.reason ?? 'CodeWiki namespace or set not found',
        next_action: selection.next_action,
      },
    };
  }

  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const outputPath = projectionOutputPath(projectDir);
  const content = renderProjection(selection, projectDir);
  writeIfChanged(outputPath, content, created, updated, reused);

  const snapshots = selection.members.map(member => ({
    repo_id: member.repo_id,
    path: latestSnapshotForMember(member),
  }));
  const setSnapshot = latestSetSnapshot(selection);

  return {
    data: {
      projected: true,
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      tuple_id: selection.tuple_id,
      output_path: outputPath,
      members: selection.members.map(member => ({
        repo_id: member.repo_id,
        state: member.state,
        current_commit: member.current_commit,
        manifest_commit: member.manifest_commit,
        wiki_path: member.wiki_path,
      })),
      snapshots,
      set_snapshot: setSnapshot,
      planning_codebase: planningCodebaseStatus(
        projectDir,
        [...snapshots.map(snapshot => snapshot.path), setSnapshot],
      ),
      warnings: projectionWarnings(selection),
      created,
      updated_files: updated,
      reused,
      next_action: '/gsd-plan-phase',
    },
  };
};

export const codewikiIndex: QueryHandler = async (args, projectDir) => {
  const options = parseIndexOptions(args);
  const config = readConfig(projectDir);

  if (!intelEnabled(config)) {
    return {
      data: {
        indexed: false,
        disabled: true,
        message: 'Intel system disabled. Set intel.enabled=true in config.json to activate CodeWiki indexing.',
        next_action: 'gsd-sdk query config-set intel.enabled true',
      },
    };
  }

  const selectionArgs = options.setId ? ['--set', options.setId] : [];
  const selection = buildSelection(selectionArgs, projectDir);
  if (selection.state === 'missing') {
    return {
      data: {
        indexed: false,
        mode: selection.mode,
        state: selection.state,
        set_id: selection.set_id,
        error: selection.reason ?? 'CodeWiki namespace or set not found',
        next_action: selection.next_action,
      },
    };
  }

  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];
  const outputPath = codewikiIntelPath(projectDir);
  writeIfChanged(outputPath, `${JSON.stringify(buildCodeWikiIntel(selection), null, 2)}\n`, created, updated, reused);

  return {
    data: {
      indexed: true,
      mode: selection.mode,
      state: selection.state,
      set_id: selection.set_id,
      tuple_id: selection.tuple_id,
      output_path: outputPath,
      records: selection.members.length + (selection.set_id ? 1 : 0),
      members: selection.members.map(member => ({
        repo_id: member.repo_id,
        state: member.state,
        current_commit: member.current_commit,
        manifest_commit: member.manifest_commit,
      })),
      created,
      updated_files: updated,
      reused,
      warnings: projectionWarnings(selection),
      next_action: '/gsd-intel query <term>',
    },
  };
};
