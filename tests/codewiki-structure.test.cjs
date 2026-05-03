/**
 * CodeWiki lifecycle structural tests.
 *
 * These tests lock the Phase 1 command/workflow/agent/template surface.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const commands = [
  'codewiki-init',
  'codewiki-select',
  'codewiki-status',
  'codewiki-project',
  'codewiki-bootstrap',
  'codewiki-enrich',
  'codewiki-review',
  'codewiki-apply-review',
  'codewiki-index',
  'codewiki-pack',
  'codewiki-deepwiki-export',
  'codewiki-contract',
  'codewiki-flow',
  'codewiki-verify',
  'codewiki-update',
  'codewiki-freeze',
];

const workflows = [
  'codewiki-init',
  'codewiki-select',
  'codewiki-status',
  'codewiki-project',
  'codewiki-bootstrap',
  'codewiki-enrich',
  'codewiki-review',
  'codewiki-apply-review',
  'codewiki-index',
  'codewiki-pack',
  'codewiki-deepwiki-export',
  'codewiki-contract',
  'codewiki-flow',
  'codewiki-verify',
  'codewiki-update',
  'codewiki-freeze',
];

const templates = [
  'repo-manifest.yaml',
  'wiki-set.yaml',
  'set-snapshot.md',
  'cross-repo-contract.md',
  'cross-repo-flow.md',
];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

describe('CodeWiki command files', () => {
  for (const name of commands) {
    const relPath = path.join('commands', 'gsd', `${name}.md`);

    test(`${relPath} exists`, () => {
      assert.ok(exists(relPath), `${relPath} should exist`);
    });

    test(`${relPath} has frontmatter name`, () => {
      const content = read(relPath);
      assert.match(content, new RegExp(`^name:\\s*gsd:${name}$`, 'm'));
    });

    test(`${relPath} references matching workflow`, () => {
      const content = read(relPath);
      assert.ok(
        content.includes(`@~/.claude/get-shit-done/workflows/${name}.md`),
        `${relPath} should reference matching workflow`,
      );
    });
  }

  test('read-only commands do not request write tools', () => {
    for (const name of ['codewiki-select', 'codewiki-status', 'codewiki-verify']) {
      const content = read(path.join('commands', 'gsd', `${name}.md`));
      assert.doesNotMatch(content, /^\s+- Write$/m, `${name} should not request Write`);
      assert.doesNotMatch(content, /^\s+- Edit$/m, `${name} should not request Edit`);
    }
  });
});

describe('CodeWiki zh-CN command surface', () => {
  for (const name of commands) {
    const relPath = path.join('commands', 'zh-CN', 'gsd', `${name}.md`);

    test(`${relPath} exists`, () => {
      assert.ok(exists(relPath), `${relPath} should exist`);
    });
  }

  test('docs/zh-CN/COMMANDS.md lists all CodeWiki commands', () => {
    const content = read(path.join('docs', 'zh-CN', 'COMMANDS.md'));
    for (const name of commands) {
      assert.ok(content.includes(`/gsd-${name}`), `zh-CN COMMANDS should mention /gsd-${name}`);
    }
  });
});

describe('CodeWiki workflow files', () => {
  for (const name of workflows) {
    const relPath = path.join('get-shit-done', 'workflows', `${name}.md`);

    test(`${relPath} exists`, () => {
      assert.ok(exists(relPath), `${relPath} should exist`);
    });
  }

  test('select workflow defines all freshness states', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-select.md'));
    for (const state of [
      'current',
      'dirty-current',
      'stale',
      'missing',
      'frozen',
      'set-current',
      'set-partial',
      'set-stale',
    ]) {
      assert.ok(content.includes(state), `select workflow should mention ${state}`);
    }
  });

  test('read-only workflows prefer SDK codewiki queries', () => {
    const select = read(path.join('get-shit-done', 'workflows', 'codewiki-select.md'));
    const status = read(path.join('get-shit-done', 'workflows', 'codewiki-status.md'));
    assert.ok(select.includes('gsd-sdk query codewiki.select'), 'select workflow should call codewiki.select');
    assert.ok(status.includes('gsd-sdk query codewiki.status'), 'status workflow should call codewiki.status');
  });

  test('init workflow prefers SDK codewiki init query', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-init.md'));
    assert.ok(content.includes('gsd-sdk query codewiki.init'), 'init workflow should call codewiki.init');
    assert.ok(content.includes('sub_repos'), 'init workflow should mention existing multi-repo workspace metadata');
    assert.ok(content.includes('WORKSPACE.md'), 'init workflow should mention workspace manifest discovery');
    assert.ok(content.includes('frontend') && content.includes('shared-library'), 'init workflow should mention role inference');
  });

  test('project workflow writes disposable planning projection', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-project.md'));
    assert.ok(content.includes('gsd-sdk query codewiki.project'), 'project workflow should call codewiki.project');
    assert.ok(content.includes('.planning/codebase/codewiki-summary.md'), 'project workflow should target codewiki-summary.md');
    assert.ok(content.includes('disposable'), 'project workflow should make projection authority clear');
  });

  test('enrich workflow fills source-backed baseline pages from codebase maps', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-enrich.md'));
    assert.ok(content.includes('baseline'), 'enrich workflow should describe baseline enrichment');
    assert.ok(content.includes('.planning/codebase'), 'enrich workflow should read codebase maps');
    assert.ok(content.includes('gsd-sdk query codewiki.status'), 'enrich workflow should select via codewiki.status');
    assert.ok(content.includes('source-backed'), 'enrich workflow should require source-backed claims');
    assert.ok(content.includes('response_language'), 'enrich workflow should honor response_language');
    assert.ok(content.includes('gsd-sdk query codewiki.verify'), 'enrich workflow should verify task records');
    assert.ok(content.includes('gsd-sdk query codewiki.project'), 'enrich workflow should refresh projection');
    assert.ok(content.includes('coder-llm-wiki/06-ops/'), 'enrich workflow should use canonical ops taxonomy');
    for (const oldPath of ['01-architecture', '02-runtime', '03-config', '04-operations', '05-cross-repo']) {
      assert.ok(!content.includes(`coder-llm-wiki/${oldPath}/`), `enrich workflow should not use old taxonomy ${oldPath}`);
    }
  });

  test('bootstrap workflow runs full coder-llm-wiki contract flow', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-bootstrap.md'));
    assert.ok(content.includes('coder-llm-wiki'), 'bootstrap workflow should target coder-llm-wiki');
    assert.ok(content.includes('gsd-sdk query codewiki.status'), 'bootstrap workflow should select via codewiki.status');
    assert.ok(content.includes('Mode: coder-llm-wiki-bootstrap'), 'bootstrap workflow should dispatch maintainer bootstrap mode');
    assert.ok(content.includes('--agent-seed'), 'bootstrap workflow should expose optional code-agent seed arguments');
    assert.ok(content.includes('--agent-seed-depth'), 'bootstrap workflow should expose agent seed depth arguments');
    assert.ok(content.includes('--exclude-path'), 'bootstrap workflow should expose source exclusion arguments');
    assert.ok(content.includes('--exclude-file'), 'bootstrap workflow should expose source-scope file arguments');
    assert.ok(content.includes('agent-seeds.json'), 'bootstrap workflow should track agent seed registry');
    assert.ok(content.includes('candidate-modules.md'), 'bootstrap workflow should describe full seed outputs');
    assert.ok(content.includes('source-scope.json'), 'bootstrap workflow should track source scope');
    assert.ok(content.includes('11-agent-seeds'), 'bootstrap workflow should write seed-only agent output');
    assert.ok(content.includes('/wiki-init'), 'bootstrap workflow should run canonical wiki phases');
    assert.ok(content.includes('maintenance-plan.json'), 'bootstrap workflow should require maintainer task records');
    assert.ok(content.includes('gsd-sdk query codewiki.verify'), 'bootstrap workflow should verify task records');
    assert.ok(content.includes('gsd-sdk query codewiki.project'), 'bootstrap workflow should refresh planning projection');
  });

  test('review workflow produces human questions without rewriting wiki pages by default', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-review.md'));
    assert.ok(content.includes('human-confirmation'), 'review workflow should target human-confirmation questions');
    assert.ok(content.includes('response_language'), 'review workflow should honor response_language');
    assert.ok(content.includes('gsd-sdk query codewiki.status'), 'review workflow should select via codewiki.status');
    assert.ok(content.includes('Without `--write`, do not write files'), 'review workflow should be read-only by default');
    assert.ok(content.includes('Do not update baseline wiki pages'), 'review workflow should not rewrite baseline pages');
    assert.ok(content.includes('09-review/human-review.md'), 'review workflow should optionally write human review notes');
    assert.ok(content.includes('task-queue.json'), 'review workflow should optionally record blocked review tasks');
  });

  test('apply-review workflow applies confirmed answers without manifest promotion', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-apply-review.md'));
    assert.ok(content.includes('confirmed human review answers'), 'apply-review workflow should target confirmed human answers');
    assert.ok(content.includes('09-review/human-review.md'), 'apply-review workflow should read human-review.md');
    assert.ok(content.includes('01-*') && content.includes('08-*'), 'apply-review workflow should update durable wiki pages');
    assert.ok(content.includes('Human-confirmed'), 'apply-review workflow should mark human-confirmed content');
    assert.ok(content.includes('progress.json'), 'apply-review workflow should update progress records');
    assert.ok(content.includes('open-questions.md'), 'apply-review workflow should resolve applied questions');
    assert.ok(content.includes('Do not run `gsd-sdk query codewiki.update`'), 'apply-review workflow should not promote manifests');
    assert.ok(content.includes('no `manifest.yaml` or `wiki-set.yaml` changed'), 'apply-review workflow should protect manifests');
  });

  test('index workflow writes derived intel index', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-index.md'));
    assert.ok(content.includes('gsd-sdk query codewiki.index'), 'index workflow should call codewiki.index');
    assert.ok(content.includes('.planning/intel/codewiki.json'), 'index workflow should target codewiki.json');
    assert.ok(content.includes('intel.enabled=true'), 'index workflow should require intel.enabled');
    assert.ok(content.includes('derived JSON'), 'index workflow should make index authority clear');
  });

  test('seed workflows generate Repomix and DeepWiki seed-only context', () => {
    const pack = read(path.join('get-shit-done', 'workflows', 'codewiki-pack.md'));
    const deepwiki = read(path.join('get-shit-done', 'workflows', 'codewiki-deepwiki-export.md'));
    assert.ok(pack.includes('gsd-sdk query codewiki.pack'), 'pack workflow should call codewiki.pack');
    assert.ok(pack.includes('Repomix output is seed-only'), 'pack workflow should keep Repomix seed-only');
    assert.ok(pack.includes('repomix-output.meta.json'), 'pack workflow should document Repomix metadata');
    assert.ok(deepwiki.includes('gsd-sdk query codewiki.deepwiki-export'), 'deepwiki workflow should call codewiki.deepwiki-export');
    assert.ok(deepwiki.includes('DeepWiki output is seed-only'), 'deepwiki workflow should keep DeepWiki seed-only');
    assert.ok(deepwiki.includes('codewiki.deepwiki_export.command'), 'deepwiki workflow should document configured export command');
  });

  test('cross-repo helper workflows register set-level docs', () => {
    const contract = read(path.join('get-shit-done', 'workflows', 'codewiki-contract.md'));
    const flow = read(path.join('get-shit-done', 'workflows', 'codewiki-flow.md'));
    assert.ok(contract.includes('gsd-sdk query codewiki.contract'), 'contract workflow should call codewiki.contract');
    assert.ok(contract.includes('cross_repo.contracts'), 'contract workflow should register cross_repo.contracts');
    assert.ok(contract.includes('producer and consumer evidence'), 'contract workflow should require producer and consumer evidence');
    assert.ok(flow.includes('gsd-sdk query codewiki.flow'), 'flow workflow should call codewiki.flow');
    assert.ok(flow.includes('cross_repo.flows'), 'flow workflow should register cross_repo.flows');
    assert.ok(flow.includes('participating repo evidence'), 'flow workflow should require participating repo evidence');
  });

  test('verify workflow checks maintainer task records', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-verify.md'));
    assert.ok(content.includes('gsd-sdk query codewiki.verify'), 'verify workflow should call codewiki.verify');
    assert.ok(content.includes('maintenance-plan.json'), 'verify workflow should read maintenance plans');
    assert.ok(content.includes('progress.json'), 'verify workflow should read completed task records');
    assert.ok(content.includes('task-queue.json'), 'verify workflow should read blocked task records');
    assert.ok(content.includes('out-of-scope'), 'verify workflow should keep explicit source-scope exclusions as resolved review queue items');
    assert.ok(content.includes('cross-repo evidence'), 'verify workflow should check cross-repo evidence');
  });

  test('update workflow handles per-repo diff and set tuple promotion', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-update.md'));
    assert.ok(content.includes('git -C <repo> diff --name-status'), 'update workflow should read per-repo name-status diff');
    assert.ok(content.includes('git -C <repo> diff <base>..<head>'), 'update workflow should read per-repo diff');
    assert.ok(content.includes('gsd-sdk query codewiki.update'), 'update workflow should call codewiki.update');
    assert.ok(content.includes('maintenance-plan.json'), 'update workflow should write maintainer handoff plans');
    assert.ok(content.includes('deepwiki-export/deepwiki.md'), 'update workflow should discover DeepWiki seed sources');
    assert.ok(content.includes('Repomix seed sources are context only'), 'update workflow should keep Repomix seed-only');
    assert.ok(content.includes('set tuple'), 'update workflow should mention set tuple promotion');
    assert.ok(content.includes('all required member repo updates pass'), 'update workflow should gate set promotion on required members');
  });

  test('freeze workflow freezes repo and set manifests', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'codewiki-freeze.md'));
    assert.ok(content.includes('gsd-sdk query codewiki.freeze'), 'freeze workflow should call codewiki.freeze');
    assert.ok(content.includes('gsd-sdk query codewiki.verify'), 'freeze workflow should verify maintenance before freezing');
    assert.ok(content.includes('--require-verified'), 'freeze workflow should request SDK verification enforcement');
    assert.ok(content.includes('--allow-unverified'), 'freeze workflow should document explicit override');
    assert.ok(content.includes('Set each affected repo manifest'), 'freeze workflow should freeze repo manifests');
    assert.ok(content.includes('wiki-set.yaml'), 'freeze workflow should freeze set manifest');
  });
});

describe('CodeWiki lifecycle integration hooks', () => {
  test('plan-phase has opt-in CodeWiki freshness gate', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'plan-phase.md'));
    assert.ok(content.includes('CodeWiki Freshness Gate'), 'plan-phase should define a CodeWiki freshness gate');
    assert.ok(content.includes('codewiki.require_fresh_before_plan'), 'plan-phase should read require_fresh_before_plan');
    assert.ok(content.includes('gsd-sdk query codewiki.status'), 'plan-phase should call codewiki.status');
    assert.ok(content.includes('CodeWiki Projection'), 'plan-phase should define CodeWiki projection step');
    assert.ok(content.includes('codewiki.projection.update_planning_codebase'), 'plan-phase should read projection config');
    assert.ok(content.includes('gsd-sdk query codewiki.project'), 'plan-phase should call codewiki.project');
    assert.ok(content.includes('CodeWiki Intel Index'), 'plan-phase should define CodeWiki intel index step');
    assert.ok(content.includes('codewiki.projection.index_intel'), 'plan-phase should read intel index config');
    assert.ok(content.includes('gsd-sdk query codewiki.index'), 'plan-phase should call codewiki.index');
  });

  test('execute-phase has opt-in post-phase CodeWiki handoff', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'execute-phase.md'));
    assert.ok(content.includes('codewiki_post_phase_handoff'), 'execute-phase should define CodeWiki post-phase handoff');
    assert.ok(content.includes('codewiki.update_on_phase_verified'), 'execute-phase should read update_on_phase_verified');
    assert.ok(content.includes('/gsd-codewiki-update --phase'), 'execute-phase should hand off stale wiki to codewiki-update');
  });

  test('complete-milestone gates and freezes CodeWiki when enabled', () => {
    const content = read(path.join('get-shit-done', 'workflows', 'complete-milestone.md'));
    assert.ok(content.includes('codewiki_milestone_freshness_gate'), 'complete-milestone should define CodeWiki freshness gate');
    assert.ok(content.includes('codewiki.require_fresh_before_milestone_close'), 'complete-milestone should read milestone freshness config');
    assert.ok(content.includes('codewiki.require_verified_before_milestone_close'), 'complete-milestone should read milestone verification config');
    assert.ok(content.includes('gsd-sdk query codewiki.verify'), 'complete-milestone should verify CodeWiki maintenance');
    assert.ok(content.includes('gsd-sdk query codewiki.freeze'), 'complete-milestone should call codewiki.freeze');
    assert.ok(content.includes('--require-verified'), 'complete-milestone freeze should enforce verified maintenance when configured');
  });
});

describe('CodeWiki SDK registry policy docs', () => {
  test('query handler docs record SDK-only CodeWiki golden coverage', () => {
    const content = read(path.join('sdk', 'src', 'query', 'QUERY-HANDLERS.md'));
    assert.ok(content.includes('CodeWiki lifecycle (SDK-only)'), 'query docs should have CodeWiki SDK-only section');
    assert.ok(content.includes('golden-policy.ts'), 'query docs should mention golden policy exceptions');
    assert.ok(content.includes('WORKSPACE.md'), 'query docs should mention workspace manifest discovery');
  });

  test('golden policy has explicit CodeWiki SDK-only exceptions', () => {
    const content = read(path.join('sdk', 'src', 'golden', 'golden-policy.ts'));
    for (const command of ['codewiki.init', 'codewiki.update', 'codewiki.freeze', 'codewiki.project', 'codewiki.index', 'codewiki.pack', 'codewiki.deepwiki-export', 'codewiki.contract', 'codewiki.flow', 'codewiki.verify', 'codewiki.select', 'codewiki.status']) {
      assert.ok(content.includes(`'${command}'`), `golden policy should explicitly except ${command}`);
    }
  });
});

describe('CodeWiki maintainer agent', () => {
  const relPath = path.join('agents', 'gsd-codewiki-maintainer.md');

  test('agent file exists', () => {
    assert.ok(exists(relPath), `${relPath} should exist`);
  });

  test('agent contains source evidence rules', () => {
    const content = read(relPath);
    assert.ok(content.includes('Source files, config files, tests, scripts, and real Git diffs are evidence'));
    assert.ok(content.includes('DeepWiki output is seed material only, never final evidence'));
    assert.ok(content.includes('Repomix output is packed context only'));
    assert.ok(content.includes('Mode: coder-llm-wiki-bootstrap'), 'agent should support full bootstrap mode');
    assert.ok(content.includes('agent-seeds.json'), 'agent should support code-agent seed registry');
    assert.ok(content.includes('Agent seed depth: quick|full'), 'agent should support seed depth');
    assert.ok(content.includes('source-scope.json'), 'agent should support source exclusion scope');
    assert.ok(content.includes('status: out-of-scope'), 'agent should record excluded historical pages as out-of-scope');
    assert.ok(content.includes('seed_paths'), 'agent should separate seed provenance from evidence');
    assert.ok(content.includes('status-dashboard.md'), 'agent should refresh bootstrap dashboard state');
    assert.ok(content.includes('tasks[]'), 'agent should process maintenance-plan task items');
    assert.ok(content.includes('task-queue.json'), 'agent should write blocked tasks to task queue');
    assert.ok(content.includes('progress.json'), 'agent should record completed tasks in progress');
    for (const oldPath of ['01-architecture', '02-runtime', '03-config', '04-operations', '05-cross-repo']) {
      assert.ok(!content.includes(`coder-llm-wiki/${oldPath}/`), `agent should not advertise old taxonomy ${oldPath}`);
    }
  });

  test('agent handles set tuple and cross-repo evidence', () => {
    const content = read(relPath);
    assert.ok(content.includes('set tuple'), 'agent should mention set tuple promotion');
    assert.ok(content.includes('Cross-repo claims require evidence from every repo'), 'agent should require cross-repo evidence');
  });
});

describe('CodeWiki templates', () => {
  for (const name of templates) {
    const relPath = path.join('get-shit-done', 'templates', 'codewiki', name);

    test(`${relPath} exists`, () => {
      assert.ok(exists(relPath), `${relPath} should exist`);
    });
  }

  test('repo manifest template has required fields', () => {
    const content = read(path.join('get-shit-done', 'templates', 'codewiki', 'repo-manifest.yaml'));
    for (const field of ['repo_id:', 'commit_sha:', 'freshness:']) {
      assert.ok(content.includes(field), `repo manifest should include ${field}`);
    }
  });

  test('wiki set template has required fields', () => {
    const content = read(path.join('get-shit-done', 'templates', 'codewiki', 'wiki-set.yaml'));
    for (const field of ['set_id:', 'members:', 'compatibility:']) {
      assert.ok(content.includes(field), `wiki set should include ${field}`);
    }
  });

  test('markdown templates include Chinese evidence and open question sections', () => {
    for (const name of ['set-snapshot.md', 'cross-repo-contract.md', 'cross-repo-flow.md']) {
      const content = read(path.join('get-shit-done', 'templates', 'codewiki', name));
      assert.ok(content.includes('## 证据'), `${name} should include Chinese evidence heading`);
      assert.ok(content.includes('## 开放问题'), `${name} should include Chinese open questions heading`);
    }
  });

  test('coder-llm-wiki template bundle includes contract and analysis templates', () => {
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
      '03-modules/_template.md',
      '04-flows/_template.md',
      '05-data/_template.md',
      '06-ops/_template.md',
      '07-risks/_template.md',
      '11-agent-seeds/README.md',
    ]) {
      assert.ok(
        exists(path.join('get-shit-done', 'templates', 'codewiki', 'coder-llm-wiki', relPath)),
        `coder-llm-wiki template should include ${relPath}`,
      );
    }
  });
});
