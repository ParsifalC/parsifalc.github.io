import test from 'node:test';
import assert from 'node:assert/strict';
import { isIP } from 'node:net';
import { categories, featuredProjects, getProject, profile, projects } from '../src/content.js';

const SCENE_ORDER = ['flowpilot', 'ai-relay', 'saylo', 'teacher', 'moyu-fleet', 'roundtable'];
const ACCESS = new Set(['open', 'private', 'community']);
// Publishing another repository requires adding its reviewed public canonical URL.
const PUBLIC_REPOSITORIES = new Map([
  ['flowpilot', 'https://github.com/ParsifalC/codex-flow'],
  ['ai-relay', 'https://github.com/MoyuFamily/ai-relay'],
  ['roundtable', 'https://github.com/MoyuFamily/agent-roundtable'],
  ['tg-relay', 'https://github.com/MoyuFamily/moyu-tg-relay'],
  ['collectionview', 'https://github.com/ParsifalC/CPCollectionViewKit'],
  ['ios-weekly', 'https://github.com/SwiftOldDriver/iOS-Weekly'],
]);
const PUBLIC_GITHUB_URLS = new Set(['https://github.com/ParsifalC', ...PUBLIC_REPOSITORIES.values()]);
const LOCAL_HOST = /(?:^localhost$|\.(?:localhost|local|lan|internal|home|test|invalid)$|(?:^|\.)home\.arpa$)/i;
const INTERNAL_CONFIG = /\b(?:SSH_TARGETS_JSON|PTERODACTYL_ACCOUNTS_JSON|WORKLOAD_SECRETS_JSON|TELEGRAM_ACCOUNTS_JSON|TELEGRAM_SESSION_STRING|INSTABOX_ACCOUNTS_JSON|CLOADY_ACCOUNTS_JSON|USERS_JSON)\b/;
const SECRET_PATTERNS = [
  /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  /\b(?:[a-z0-9_]*(?:api[_-]?key|token|secret|password|passwd|private[_-]?key))["']?\s*[:=]\s*["']?[^\s"',;{}]+/i,
];

function nonEmptyString(value, field) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, field + ' must be a nonempty string');
}

function unique(values, field) {
  assert.equal(new Set(values).size, values.length, field + ' must be unique');
}

function* strings(value, path = 'content', key = '') {
  if (typeof value === 'string') {
    yield { value, path, key };
  } else if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) yield* strings(child, path + '[' + index + ']', key);
  } else if (value && typeof value === 'object') {
    for (const [name, child] of Object.entries(value)) yield* strings(child, path + '.' + name, name);
  }
}

function urlsIn(value) {
  return value.match(/(?:[a-z][a-z0-9+.-]*:\/\/|\/\/)[^\s<>"'\x60，。；）]+/gi) ?? [];
}

function publicHttpsUrl(value, field) {
  let url;
  try {
    url = new URL(value);
  } catch {
    assert.fail(field + ' must contain an absolute URL');
  }
  // Boolean assertions intentionally avoid printing a rejected URL or credential.
  assert.ok(url.protocol === 'https:', field + ' must use HTTPS');
  assert.ok(!url.username && !url.password, field + ' must not embed credentials');
  assert.ok(!url.port, field + ' must not expose a custom service port');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  assert.ok(!isIP(host) && host.includes('.') && !LOCAL_HOST.test(host), field + ' must use a public DNS hostname');
  for (const key of url.searchParams.keys()) {
    assert.ok(!/(?:token|secret|password|passwd|api[_-]?key|session|signature|credential|authorization)/i.test(key), field + ' must not contain credential query parameters');
  }
  return url;
}

function hasLiteralAddress(value) {
  const candidates = value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b|(?:\b[\da-f]{1,4}:){2,}[\da-f:]*|::(?:1\b|ffff:[\da-f:.]+)/gi) ?? [];
  return candidates.some((candidate) => isIP(candidate) !== 0);
}

test('project IDs and display numbers are valid and unique', () => {
  assert.ok(Array.isArray(projects));
  for (const [index, project] of projects.entries()) {
    nonEmptyString(project.id, 'projects[' + index + '].id');
    assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id), 'project IDs must be safe stable slugs');
    assert.ok(typeof project.number === 'string' && /^\d+$/.test(project.number), project.id + '.number must be a numeric display string');
    assert.ok(Number.isSafeInteger(Number(project.number)) && Number(project.number) > 0, project.id + '.number must be positive');
  }
  unique(projects.map((project) => project.id), 'project IDs');
  unique(projects.map((project) => Number(project.number)), 'project numbers');
});

test('categories and visibility values belong to the supported content schema', () => {
  assert.ok(Array.isArray(categories) && categories.length > 0);
  for (const category of categories) nonEmptyString(category.id, 'category.id');
  unique(categories.map((category) => category.id), 'category IDs');
  const validCategories = new Set(categories.map((category) => category.id));
  for (const project of projects) {
    assert.ok(validCategories.has(project.category), project.id + ' must reference an exported category');
    assert.ok(ACCESS.has(project.access), project.id + ' has an unsupported access value');
    assert.equal(typeof project.featured, 'boolean', project.id + '.featured must be boolean');
  }
});

test('exactly six featured projects follow the gallery scene order', () => {
  assert.equal(featuredProjects.length, 6);
  assert.deepEqual(featuredProjects.map((project) => project.id), SCENE_ORDER);
  assert.deepEqual(projects.filter((project) => project.featured).map((project) => project.id), SCENE_ORDER);
  for (const project of featuredProjects) {
    assert.ok(project.featured === true && getProject(project.id) === project, 'featured entries must reference their canonical project');
  }
});

test('getProject resolves every canonical project and returns undefined for unknown IDs', () => {
  for (const project of projects) assert.ok(getProject(project.id) === project, project.id + ' must resolve to its canonical entry');
  for (const id of ['', '__missing-project__', '__proto__', undefined, null]) assert.equal(getProject(id), undefined);
});

test('every project has three renderable highlights without locking editorial wording', () => {
  for (const project of projects) {
    assert.ok(Array.isArray(project.highlights), project.id + '.highlights must be an array');
    assert.equal(project.highlights.length, 3, project.id + ' must have three highlights');
    for (const [index, highlight] of project.highlights.entries()) {
      nonEmptyString(highlight.title, project.id + '.highlights[' + index + '].title');
      nonEmptyString(highlight.text, project.id + '.highlights[' + index + '].text');
    }
  }
});

test('visible public repository links use reviewed HTTPS GitHub canonical paths', () => {
  for (const project of projects) {
    assert.ok(Array.isArray(project.links), project.id + '.links must be an array');
    if (project.access === 'private') continue;
    assert.ok(project.links.length > 0, project.id + ' must expose its public repository');
    const canonical = PUBLIC_REPOSITORIES.get(project.id);
    assert.ok(canonical, project.id + ' needs a reviewed public canonical URL');
    for (const [index, link] of project.links.entries()) {
      const field = project.id + '.links[' + index + ']';
      nonEmptyString(link.label, field + '.label');
      const url = publicHttpsUrl(link.url, field + '.url');
      assert.ok(url.origin === 'https://github.com' && url.href === canonical, field + ' must point to its reviewed canonical repository');
    }
  }
  for (const id of ['ai-relay', 'roundtable']) {
    const project = getProject(id);
    assert.ok(project?.access === 'open', id + ' must remain publicly accessible');
    assert.ok(project.links.some((link) => link.url === PUBLIC_REPOSITORIES.get(id)), id + ' must use the current MoyuFamily repository');
  }
});

test('private project summaries expose no repository links or internal addresses', () => {
  for (const project of projects.filter((entry) => entry.access === 'private')) {
    for (const [index, link] of project.links.entries()) {
      const url = publicHttpsUrl(link.url, project.id + '.links[' + index + '].url');
      assert.ok(url.hostname !== 'github.com', project.id + ' must not expose a repository link');
    }
    for (const entry of strings(project, project.id)) {
      assert.ok(!/^(?:repo|repository)(?:url|link)?$/i.test(entry.key) || !entry.value.trim(), entry.path + ' must not expose repository metadata');
      assert.ok(!hasLiteralAddress(entry.value), entry.path + ' must not contain literal network addresses');
      assert.ok(!/\b(?:localhost|[a-z\d-]+(?:\.[a-z\d-]+)*\.(?:local|localhost|lan|internal|home|test|invalid)|[a-z\d.-]+\.home\.arpa)\b/i.test(entry.value), entry.path + ' must not expose an internal hostname');
      for (const candidate of urlsIn(entry.value)) {
        const url = publicHttpsUrl(candidate, entry.path);
        assert.ok(url.hostname !== 'github.com', entry.path + ' must not embed a repository URL in prose');
      }
    }
  }
});

test('iOS Weekly retains community attribution and the honorary editor role', () => {
  const weekly = getProject('ios-weekly');
  assert.ok(weekly, 'iOS Weekly must be present');
  assert.equal(weekly.access, 'community');
  assert.ok(/荣誉编辑/.test(weekly.role), 'iOS Weekly must identify the honorary editor role');
});

test('published content contains no credential material, internal configuration or private GitHub URLs', () => {
  for (const entry of strings({ profile, categories, projects })) {
    assert.ok(!/^(?:api[_-]?key|access[_-]?token|token|password|passwd|secret|private[_-]?key|session)$/i.test(entry.key), entry.path + ' must not be a credential field');
    assert.ok(!INTERNAL_CONFIG.test(entry.value), entry.path + ' must not include internal configuration names');
    assert.ok(!SECRET_PATTERNS.some((pattern) => pattern.test(entry.value)), entry.path + ' contains a possible credential');
    for (const candidate of urlsIn(entry.value)) {
      const url = publicHttpsUrl(candidate, entry.path);
      if (url.hostname.toLowerCase() === 'github.com') {
        assert.ok(PUBLIC_GITHUB_URLS.has(url.href), entry.path + ' references an unreviewed or private GitHub path');
      }
    }
  }
});
