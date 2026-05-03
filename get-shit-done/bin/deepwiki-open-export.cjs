#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_API_BASE = 'http://localhost:8001';
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

const IGNORE_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.idea',
  '.vscode',
  '__pycache__',
  'node_modules',
  'dist',
  'build',
  'target',
  '.venv',
  'venv',
]);

function usage() {
  return `Usage:
  deepwiki-open-export --repo <path-or-url> --output-md <file> [--output-json <file>]

Exports DeepWiki cache for a repository, or generates it through a running
deepwiki-open API server when the cache is missing.

Options:
  --repo <path-or-url>       Repository local path or Git URL. Required.
  --output-md <file>         Markdown export path. Required.
  --output-json <file>       JSON export path.
  --api-base <url>           deepwiki-open API base URL. Default: ${DEFAULT_API_BASE}
  --deepwiki-root <path>     Local deepwiki-open checkout path, used for hints.
  --language <lang>          Cache/generation language. Default: ${DEFAULT_LANGUAGE}
  --provider <provider>      DeepWiki model provider override.
  --model <model>            DeepWiki model override.
  --token <token>            Access token for private remote repos.
  --excluded-dirs <list>     Newline/comma-separated dirs passed to DeepWiki.
  --excluded-files <list>    Newline/comma-separated file patterns.
  --included-dirs <list>     Newline/comma-separated dirs for inclusion mode.
  --included-files <list>    Newline/comma-separated file patterns.
  --comprehensive            Ask DeepWiki for a larger page set.
  --cache-only               Do not generate; fail if cache is missing.
  --force-generate           Ignore cache and regenerate through the API.
  --timeout-ms <number>      Overall timeout for API calls.
  --check                    Print environment status and exit.
  --list-caches              List known DeepWiki cache files and exit.
  -h, --help                 Show this help.

Environment:
  DEEPWIKI_API_BASE_URL      Default API base URL.
  DEEPWIKI_OPEN_ROOT         Local deepwiki-open checkout.
  DEEPWIKI_LANGUAGE          Default language.
`;
}

function parseArgs(argv) {
  const args = {
    apiBase: process.env.DEEPWIKI_API_BASE_URL || DEFAULT_API_BASE,
    deepwikiRoot: process.env.DEEPWIKI_OPEN_ROOT || null,
    language: process.env.DEEPWIKI_LANGUAGE || DEFAULT_LANGUAGE,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    comprehensive: false,
    cacheOnly: false,
    forceGenerate: false,
    check: false,
    listCaches: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`);
      i += 1;
      return argv[i];
    };

    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '--repo') args.repo = next();
    else if (arg === '--output-md' || arg === '--output-markdown') args.outputMd = next();
    else if (arg === '--output-json') args.outputJson = next();
    else if (arg === '--api-base') args.apiBase = next();
    else if (arg === '--deepwiki-root') args.deepwikiRoot = next();
    else if (arg === '--language') args.language = next();
    else if (arg === '--provider') args.provider = next();
    else if (arg === '--model') args.model = next();
    else if (arg === '--token') args.token = next();
    else if (arg === '--excluded-dirs') args.excludedDirs = normalizeList(next());
    else if (arg === '--excluded-files') args.excludedFiles = normalizeList(next());
    else if (arg === '--included-dirs') args.includedDirs = normalizeList(next());
    else if (arg === '--included-files') args.includedFiles = normalizeList(next());
    else if (arg === '--timeout-ms') args.timeoutMs = Number(next());
    else if (arg === '--comprehensive') args.comprehensive = true;
    else if (arg === '--cache-only' || arg === '--no-generate') args.cacheOnly = true;
    else if (arg === '--force-generate') args.forceGenerate = true;
    else if (arg === '--check') args.check = true;
    else if (arg === '--list-caches') args.listCaches = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }
  return args;
}

function normalizeList(value) {
  return String(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n');
}

function adalflowRoot() {
  return process.env.ADALFLOW_ROOT || path.join(os.homedir(), '.adalflow');
}

function wikiCacheDir() {
  return path.join(adalflowRoot(), 'wikicache');
}

function findDeepWikiRoot(explicitRoot) {
  const candidates = [];
  if (explicitRoot) candidates.push(explicitRoot);
  candidates.push(path.join(process.cwd(), 'deepwiki-open'));
  candidates.push(path.resolve(__dirname, '../../..', 'deepwiki-open'));
  candidates.push(path.resolve(__dirname, '../../../..', 'deepwiki-open'));

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(expandHome(candidate));
    if (fs.existsSync(path.join(resolved, 'api', 'main.py')) && fs.existsSync(path.join(resolved, 'package.json'))) {
      return resolved;
    }
  }
  return explicitRoot ? path.resolve(expandHome(explicitRoot)) : null;
}

function expandHome(value) {
  if (!value) return value;
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function repoInfoFromInput(input) {
  if (!input) throw new Error('--repo is required');
  const raw = expandHome(input.trim());
  const resolved = path.resolve(raw);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return {
      owner: 'local',
      repo: path.basename(resolved) || 'local-repo',
      type: 'local',
      repoUrl: resolved,
      localPath: resolved,
      display: resolved,
    };
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Repository is not an existing local directory or valid URL: ${input}`);
  }

  const parts = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length < 2) throw new Error(`Could not infer owner/repo from URL: ${input}`);
  const repo = parts[parts.length - 1];
  const owner = parts[parts.length - 2];
  const hostname = url.hostname.toLowerCase();
  let type = 'web';
  if (hostname.includes('github.com')) type = 'github';
  else if (hostname.includes('gitlab')) type = 'gitlab';
  else if (hostname.includes('bitbucket')) type = 'bitbucket';

  return {
    owner,
    repo,
    type,
    repoUrl: raw.replace(/\.git$/, ''),
    display: raw,
  };
}

function cachePathFor(repo, language) {
  return path.join(wikiCacheDir(), `deepwiki_cache_${repo.type}_${repo.owner}_${repo.repo}_${language}.json`);
}

async function fetchJson(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { ok: response.ok, status: response.status, data, text };
  } finally {
    clearTimeout(timer);
  }
}

async function apiHealth(apiBase, timeoutMs) {
  try {
    const result = await fetchJson(`${apiBase.replace(/\/$/, '')}/health`, {}, Math.min(timeoutMs, 5000));
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

async function readCacheFromApi(apiBase, repo, language, timeoutMs) {
  const params = new URLSearchParams({
    owner: repo.owner,
    repo: repo.repo,
    repo_type: repo.type,
    language,
  });
  const url = `${apiBase.replace(/\/$/, '')}/api/wiki_cache?${params.toString()}`;
  const result = await fetchJson(url, { headers: { Accept: 'application/json' } }, Math.min(timeoutMs, 30000));
  if (!result.ok) return null;
  return result.data || null;
}

function readCacheFromDisk(repo, language) {
  const file = cachePathFor(repo, language);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pageListFromCache(cache) {
  if (!cache || !cache.wiki_structure) throw new Error('DeepWiki cache is missing wiki_structure');
  const generated = cache.generated_pages || {};
  const pages = cache.wiki_structure.pages || [];
  const pageList = pages.map((page) => {
    const generatedPage = generated[page.id] || {};
    return {
      id: String(page.id || generatedPage.id || ''),
      title: String(page.title || generatedPage.title || 'Untitled'),
      content: String(generatedPage.content || page.content || ''),
      filePaths: Array.isArray(page.filePaths) ? page.filePaths : Array.isArray(generatedPage.filePaths) ? generatedPage.filePaths : [],
      importance: String(page.importance || generatedPage.importance || 'medium'),
      relatedPages: Array.isArray(page.relatedPages) ? page.relatedPages : Array.isArray(generatedPage.relatedPages) ? generatedPage.relatedPages : [],
    };
  });
  const missing = pageList.filter((page) => !page.content || page.content === 'Loading...');
  if (missing.length > 0) {
    throw new Error(`DeepWiki cache has pages without generated content: ${missing.map((page) => page.id || page.title).join(', ')}`);
  }
  return pageList;
}

function generateMarkdownExport(repoUrl, pages) {
  let markdown = `# Wiki Documentation for ${repoUrl}\n\n`;
  markdown += `Generated on: ${new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')}\n\n`;
  markdown += '## Table of Contents\n\n';
  for (const page of pages) markdown += `- [${page.title}](#${page.id})\n`;
  markdown += '\n';
  for (const page of pages) {
    markdown += `<a id='${page.id}'></a>\n\n`;
    markdown += `## ${page.title}\n\n`;
    if (page.relatedPages && page.relatedPages.length > 0) {
      const related = page.relatedPages
        .map((id) => pages.find((candidate) => candidate.id === id))
        .filter(Boolean)
        .map((relatedPage) => `[${relatedPage.title}](#${relatedPage.id})`);
      if (related.length > 0) markdown += `### Related Pages\n\nRelated topics: ${related.join(', ')}\n\n`;
    }
    markdown += `${page.content}\n\n---\n\n`;
  }
  return markdown;
}

function generateJsonExport(repoUrl, pages) {
  return JSON.stringify({
    metadata: {
      repository: repoUrl,
      generated_at: new Date().toISOString(),
      page_count: pages.length,
    },
    pages,
  }, null, 2);
}

function ensureParent(file) {
  if (!file) return;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
}

function writeExports(repo, cache, outputMd, outputJson) {
  const pages = pageListFromCache(cache);
  const repoUrl = cache.repo?.repoUrl || cache.repo_url || repo.repoUrl || repo.display;
  if (outputMd) {
    ensureParent(outputMd);
    fs.writeFileSync(outputMd, generateMarkdownExport(repoUrl, pages), 'utf8');
  }
  if (outputJson) {
    ensureParent(outputJson);
    fs.writeFileSync(outputJson, generateJsonExport(repoUrl, pages), 'utf8');
  }
  return { pageCount: pages.length, repoUrl };
}

function languageName(language) {
  return ({
    en: 'English',
    ja: 'Japanese (日本語)',
    zh: 'Mandarin Chinese (中文)',
    'zh-tw': 'Traditional Chinese (繁體中文)',
    es: 'Spanish (Español)',
    kr: 'Korean (한국어)',
    vi: 'Vietnamese (Tiếng Việt)',
    'pt-br': 'Brazilian Portuguese (Português Brasileiro)',
    fr: 'Français (French)',
    ru: 'Русский (Russian)',
  })[language] || 'English';
}

function walkFiles(root) {
  const output = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) walk(absolute);
      } else if (entry.isFile()) {
        if (entry.name === '.DS_Store' || entry.name === '__init__.py') continue;
        output.push(path.relative(root, absolute));
      }
    }
  }
  walk(root);
  return output.sort();
}

function findReadme(root) {
  const direct = fs.readdirSync(root).find((name) => name.toLowerCase() === 'readme.md');
  if (!direct) return '';
  try {
    return fs.readFileSync(path.join(root, direct), 'utf8');
  } catch {
    return '';
  }
}

function buildStructurePrompt(repo, fileTree, readme, language, comprehensive) {
  return `Analyze this GitHub repository ${repo.owner}/${repo.repo} and create a wiki structure for it.

1. The complete file tree of the project:
<file_tree>
${fileTree}
</file_tree>

2. The README file of the project:
<readme>
${readme}
</readme>

I want to create a wiki for this repository. Determine the most logical structure for a wiki based on the repository's content.

IMPORTANT: The wiki content will be generated in ${languageName(language)} language.

When designing the wiki structure, include pages that would benefit from visual diagrams, such as:
- Architecture overviews
- Data flow descriptions
- Component relationships
- Process workflows
- State machines
- Class hierarchies

${comprehensive ? `Create a structured wiki with the following main sections:
- Overview (general information about the project)
- System Architecture (how the system is designed)
- Core Features (key functionality)
- Data Management/Flow
- Frontend Components
- Backend Systems
- Model Integration
- Deployment/Infrastructure
- Extensibility and Customization

Each section should contain relevant pages.

Return your analysis in the following XML format:

<wiki_structure>
  <title>[Overall title for the wiki]</title>
  <description>[Brief description of the repository]</description>
  <sections>
    <section id="section-1">
      <title>[Section title]</title>
      <pages>
        <page_ref>page-1</page_ref>
      </pages>
    </section>
  </sections>
  <pages>
    <page id="page-1">
      <title>[Page title]</title>
      <description>[Brief description of what this page will cover]</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>[Path to a relevant file]</file_path>
      </relevant_files>
      <related_pages>
        <related>page-2</related>
      </related_pages>
      <parent_section>section-1</parent_section>
    </page>
  </pages>
</wiki_structure>` : `Return your analysis in the following XML format:

<wiki_structure>
  <title>[Overall title for the wiki]</title>
  <description>[Brief description of the repository]</description>
  <pages>
    <page id="page-1">
      <title>[Page title]</title>
      <description>[Brief description of what this page will cover]</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>[Path to a relevant file]</file_path>
      </relevant_files>
      <related_pages>
        <related>page-2</related>
      </related_pages>
    </page>
  </pages>
</wiki_structure>`}

IMPORTANT FORMATTING INSTRUCTIONS:
- Return ONLY the valid XML structure specified above
- DO NOT wrap the XML in markdown code blocks
- DO NOT include explanation text before or after the XML
- Start directly with <wiki_structure> and end with </wiki_structure>

IMPORTANT:
1. Create ${comprehensive ? '8-12' : '4-6'} pages that would make a ${comprehensive ? 'comprehensive' : 'concise'} wiki for this repository
2. Each page should focus on a specific aspect of the codebase
3. The relevant_files should be actual files from the repository
4. Return ONLY valid XML with the structure specified above`;
}

function buildPagePrompt(page, repo, language) {
  const files = page.filePaths || [];
  return `You are an expert technical writer and software architect.
Your task is to generate a comprehensive and accurate technical wiki page in Markdown format about a specific feature, system, or module within a given software project.

The page topic is: "${page.title}".

The relevant source files selected for this page are:
${files.map((file) => `- ${file}`).join('\n') || '- No specific files were selected; search the repository context for the most relevant files.'}

CRITICAL STARTING INSTRUCTION:
The very first thing on the page MUST be a <details> block listing ALL relevant source files you used.
Format it like this:
<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

${files.map((file) => `- [${file}]()`).join('\n')}
</details>

Immediately after the <details> block, the main title of the page should be a H1 Markdown heading: # ${page.title}.

Based ONLY on repository content:
1. Explain the purpose, scope, and high-level overview of "${page.title}" within ${repo.owner}/${repo.repo}.
2. Break the topic into logical H2 and H3 sections.
3. Use Mermaid diagrams when they clarify architecture, flows, relationships, or schemas.
4. Use Markdown tables for components, APIs, configuration, data models, or comparisons when useful.
5. Include short code snippets only when they directly illustrate implementation details.
6. Cite source files and line numbers for significant claims when possible.
7. Do not invent facts not supported by the repository.

IMPORTANT: Generate the content in ${languageName(language)} language.

Return only the Markdown page content.`;
}

function stripXmlFence(text) {
  return text.replace(/^```(?:xml)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function tagText(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function allTagText(xml, tag) {
  const values = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match;
  while ((match = re.exec(xml))) values.push(decodeXml(match[1].trim()));
  return values;
}

function attrText(xml, attr) {
  const match = xml.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseWikiStructure(responseText, comprehensive) {
  const cleaned = stripXmlFence(responseText).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  const match = cleaned.match(/<wiki_structure>[\s\S]*?<\/wiki_structure>/i);
  if (!match) throw new Error(`No <wiki_structure> XML found in DeepWiki response: ${cleaned.slice(0, 500)}`);
  const xml = match[0];
  const pages = [];
  const pageRe = /<page\b([^>]*)>([\s\S]*?)<\/page>/gi;
  let pageMatch;
  while ((pageMatch = pageRe.exec(xml))) {
    const body = pageMatch[2];
    const id = attrText(pageMatch[1], 'id') || `page-${pages.length + 1}`;
    pages.push({
      id,
      title: tagText(body, 'title') || id,
      content: '',
      filePaths: allTagText(body, 'file_path'),
      importance: ['high', 'medium', 'low'].includes(tagText(body, 'importance')) ? tagText(body, 'importance') : 'medium',
      relatedPages: allTagText(body, 'related'),
      parentId: tagText(body, 'parent_section') || undefined,
    });
  }
  if (pages.length === 0) throw new Error(`DeepWiki returned XML without pages: ${xml.slice(0, 500)}`);

  const sections = [];
  const rootSections = [];
  if (comprehensive) {
    const sectionRe = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
    let sectionMatch;
    while ((sectionMatch = sectionRe.exec(xml))) {
      const id = attrText(sectionMatch[1], 'id') || `section-${sections.length + 1}`;
      sections.push({
        id,
        title: tagText(sectionMatch[2], 'title') || id,
        pages: allTagText(sectionMatch[2], 'page_ref'),
      });
      rootSections.push(id);
    }
  }

  return {
    id: 'wiki',
    title: tagText(xml, 'title') || 'Repository Wiki',
    description: tagText(xml, 'description') || '',
    pages,
    sections,
    rootSections,
  };
}

async function streamChat(apiBase, request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`DeepWiki API error ${response.status}: ${errorText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function requestBase(repo, args) {
  const body = {
    repo_url: repo.repoUrl,
    type: repo.type,
    token: args.token,
    provider: args.provider,
    model: args.model,
    language: args.language,
    excluded_dirs: args.excludedDirs,
    excluded_files: args.excludedFiles,
    included_dirs: args.includedDirs,
    included_files: args.includedFiles,
  };
  for (const key of Object.keys(body)) {
    if (body[key] === undefined || body[key] === null || body[key] === '') delete body[key];
  }
  return body;
}

async function generateThroughApi(args, repo) {
  const health = await apiHealth(args.apiBase, args.timeoutMs);
  if (!health) {
    throw new Error(`deepwiki-open API is not reachable at ${args.apiBase}. Start it first, for example: cd ${findDeepWikiRoot(args.deepwikiRoot) || '<deepwiki-open>'} && docker compose up -d`);
  }

  let fileTree = '';
  let readme = '';
  if (repo.type === 'local') {
    fileTree = walkFiles(repo.localPath).join('\n');
    readme = findReadme(repo.localPath);
  } else {
    fileTree = `Remote repository: ${repo.repoUrl}`;
    readme = '';
  }

  process.stderr.write(`DeepWiki: generating structure for ${repo.display}\n`);
  const structureText = await streamChat(args.apiBase, {
    ...requestBase(repo, args),
    messages: [{ role: 'user', content: buildStructurePrompt(repo, fileTree, readme, args.language, args.comprehensive) }],
  }, args.timeoutMs);
  const wikiStructure = parseWikiStructure(structureText, args.comprehensive);
  const generatedPages = {};

  for (const page of wikiStructure.pages) {
    process.stderr.write(`DeepWiki: generating page ${page.id} (${page.title})\n`);
    const content = await streamChat(args.apiBase, {
      ...requestBase(repo, args),
      messages: [{ role: 'user', content: buildPagePrompt(page, repo, args.language) }],
    }, args.timeoutMs);
    generatedPages[page.id] = {
      ...page,
      content: content.replace(/^```markdown\s*/i, '').replace(/```\s*$/i, '').trim(),
    };
  }

  const cache = {
    wiki_structure: wikiStructure,
    generated_pages: generatedPages,
    repo,
    provider: args.provider || 'default',
    model: args.model || 'default',
  };

  await fetchJson(`${args.apiBase.replace(/\/$/, '')}/api/wiki_cache`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo,
      language: args.language,
      wiki_structure: wikiStructure,
      generated_pages: generatedPages,
      provider: args.provider || 'default',
      model: args.model || 'default',
    }),
  }, Math.min(args.timeoutMs, 30000)).catch(() => null);

  return cache;
}

function listCaches() {
  const dir = wikiCacheDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.startsWith('deepwiki_cache_') && name.endsWith('.json'))
    .sort()
    .map((name) => path.join(dir, name));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }

  const deepwikiRoot = findDeepWikiRoot(args.deepwikiRoot);

  if (args.check) {
    const health = await apiHealth(args.apiBase, args.timeoutMs);
    process.stdout.write(JSON.stringify({
      ok: Boolean(health),
      api_base: args.apiBase,
      api_health: health,
      deepwiki_root: deepwikiRoot,
      cache_dir: wikiCacheDir(),
      cache_count: listCaches().length,
    }, null, 2) + '\n');
    return;
  }

  if (args.listCaches) {
    process.stdout.write(listCaches().join('\n') + '\n');
    return;
  }

  if (!args.repo || !args.outputMd) {
    throw new Error('--repo and --output-md are required. Use --help for usage.');
  }

  const repo = repoInfoFromInput(args.repo);
  let cache = null;
  let source = null;

  if (!args.forceGenerate) {
    cache = await readCacheFromApi(args.apiBase, repo, args.language, args.timeoutMs).catch(() => null);
    if (cache) source = 'api-cache';
    if (!cache) {
      cache = readCacheFromDisk(repo, args.language);
      if (cache) source = 'disk-cache';
    }
  }

  if (!cache) {
    if (args.cacheOnly) {
      throw new Error(`No DeepWiki cache found for ${repo.type}:${repo.owner}/${repo.repo}:${args.language}. Generate it in deepwiki-open first or rerun without --cache-only.`);
    }
    cache = await generateThroughApi(args, repo);
    source = 'generated';
  }

  const result = writeExports(repo, cache, args.outputMd, args.outputJson);
  process.stdout.write(JSON.stringify({
    exported: true,
    source,
    repo: repo.display,
    language: args.language,
    pages: result.pageCount,
    output_md: path.resolve(args.outputMd),
    output_json: args.outputJson ? path.resolve(args.outputJson) : null,
  }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(`deepwiki-open-export: ${error.message}\n`);
  process.exit(1);
});
