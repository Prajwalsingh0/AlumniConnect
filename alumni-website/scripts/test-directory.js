/**
 * test-directory.js - Alumni Directory API test suite
 *
 * Run against a live server (default http://localhost:3000):
 *   npm run test:directory
 *
 * Covers auth, pagination, search (case-insensitive + unique-token
 * deterministic), filters, private-field leakage and legacy /search.
 * user1 carries a unique per-run company token so assertions stay
 * deterministic even when the database holds many accumulated test users.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name} :: ${detail}`);
    console.log(`FAIL  ${name}  :: ${detail}`);
  }
}

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function main() {
  const stamp = Date.now();
  const password = 'Directory@123';
  const uniqueCompany = `E2E Verify Labs ${stamp}`;

  // ── Setup: two fresh users with rich profiles ─────────────────────────────
  const r1 = await api('POST', '/api/auth/register', {
    firstName: 'Ishaan', lastName: 'Malhotra',
    email: `dir.ishaan.${stamp}@alumni.dev`, password,
    graduationYear: '2015', degree: 'B.Tech', major: 'Computer Science & Engineering',
    currentPosition: 'Senior Software Engineer', company: uniqueCompany, location: 'Bengaluru, Karnataka'
  });
  check('setup: register user1', r1.status === 201, `got ${r1.status}`);
  const t1 = r1.data.token;

  const r2 = await api('POST', '/api/auth/register', {
    firstName: 'Priya', lastName: 'Nair',
    email: `dir.priya.${stamp}@alumni.dev`, password,
    graduationYear: '2020', degree: 'MBA', major: 'Business Administration',
    currentPosition: 'Product Manager', company: 'Zomato', location: 'Gurugram, Haryana'
  });
  check('setup: register user2', r2.status === 201, `got ${r2.status}`);
  const t2 = r2.data.token;

  // Enrich user1 via profile update so search/filter fields are populated
  const upd = await api('PUT', '/api/users/profile', {
    title: 'Senior Software Engineer',
    skills: [{ name: 'Java', level: 'Expert' }, { name: 'React', level: 'Intermediate' }]
  }, t1);
  check('setup: enrich user1 profile', upd.status === 200, `got ${upd.status}`);

  // ── Unauthenticated access ─────────────────────────────────────────────────
  const noAuth = await api('GET', '/api/users/directory');
  check('directory without token -> 401', noAuth.status === 401, `got ${noAuth.status}`);
  const noAuthFacets = await api('GET', '/api/users/directory/facets');
  check('facets without token -> 401', noAuthFacets.status === 401, `got ${noAuthFacets.status}`);

  // ── Directory loads ────────────────────────────────────────────────────────
  const dir = await api('GET', '/api/users/directory?limit=12&page=1', null, t1);
  check('directory loads -> 200', dir.status === 200, `got ${dir.status}`);
  check('directory returns users array', Array.isArray(dir.data.users), 'no users array');
  check('directory returns pagination', dir.data.pagination
    && Number.isInteger(dir.data.pagination.page)
    && Number.isInteger(dir.data.pagination.limit)
    && Number.isInteger(dir.data.pagination.total)
    && Number.isInteger(dir.data.pagination.pages), JSON.stringify(dir.data.pagination));
  check('directory default limit respected', dir.data.users.length <= 12, `got ${dir.data.users.length}`);

  // ── Private fields must not leak ───────────────────────────────────────────
  const sample = dir.data.users[0];
  const serialized = JSON.stringify(dir.data);
  check('directory has no password field', !serialized.includes('"password"'), 'password leaked');
  check('directory has no emailVerificationToken', !serialized.includes('emailVerificationToken'), 'token leaked');
  check('directory has no passwordResetToken', !serialized.includes('passwordResetToken'), 'token leaked');
  check('directory has no email field', !serialized.includes('"email"'), 'email leaked');
  check('directory user has _id and name', sample && sample._id && sample.name, 'missing basics');

  // ── Search ─────────────────────────────────────────────────────────────────
  // Case-insensitivity: lowercase query against title-case stored data.
  // The unique per-run company token keeps the result set deterministic even
  // when the database holds many accumulated test users.
  const byUniqueLower = await api('GET', `/api/users/directory?q=${encodeURIComponent(`e2e verify labs ${stamp}`)}`, null, t1);
  check('search (case-insensitive, unique token) finds exactly user1', byUniqueLower.status === 200
    && byUniqueLower.data.pagination.total === 1
    && byUniqueLower.data.users.some(u => u.name === 'Ishaan Malhotra'), `total ${byUniqueLower.data.pagination.total}`);

  const byPartial = await api('GET', '/api/users/directory?q=Malh', null, t1);
  check('partial search "Malh" matches users', byPartial.status === 200
    && byPartial.data.pagination.total >= 1, `total ${byPartial.data.pagination.total}`);

  const bySkill = await api('GET', '/api/users/directory?q=java', null, t1);
  check('skill search "java" returns skill matches', bySkill.status === 200
    && bySkill.data.pagination.total >= 1
    && bySkill.data.users.every(u => (u.profile.skills || []).some(s => /java/i.test(s.name || ''))),
    `total ${bySkill.data.pagination.total}`);

  const byTitle = await api('GET', '/api/users/directory?q=Software%20Engineer', null, t2);
  check('title search "Software Engineer" returns title matches', byTitle.status === 200
    && byTitle.data.pagination.total >= 1
    && byTitle.data.users.every(u => /engineer/i.test((u.profile || {}).title || '')),
    `total ${byTitle.data.pagination.total}`);

  // ── Filters ────────────────────────────────────────────────────────────────
  const byYear = await api('GET', '/api/users/directory?graduationYear=2015', null, t1);
  check('filter graduationYear=2015 returns matching users', byYear.status === 200
    && byYear.data.pagination.total >= 1
    && byYear.data.users.every(u => u.profile.graduationYear === 2015), `total ${byYear.data.pagination.total}`);

  const byDept = await api('GET', '/api/users/directory?department=Computer%20Science%20%26%20Engineering', null, t1);
  check('department filter returns only matching department', byDept.status === 200
    && byDept.data.pagination.total >= 1
    && byDept.data.users.every(u => (u.profile.department || '').toLowerCase() === 'computer science & engineering'),
    `total ${byDept.data.pagination.total}`);

  const byDeptUnique = await api('GET', `/api/users/directory?department=Computer%20Science%20%26%20Engineering&q=${encodeURIComponent(uniqueCompany)}`, null, t1);
  check('department filter + unique search finds exactly user1', byDeptUnique.status === 200
    && byDeptUnique.data.pagination.total === 1
    && byDeptUnique.data.users[0].name === 'Ishaan Malhotra', `total ${byDeptUnique.data.pagination.total}`);

  const byDegree = await api('GET', '/api/users/directory?degree=MBA', null, t1);
  check('filter degree=MBA excludes user1, includes user2', byDegree.status === 200
    && !byDegree.data.users.some(u => u.name === 'Ishaan Malhotra')
    && byDegree.data.users.some(u => u.name === 'Priya Nair'), `total ${byDegree.data.pagination.total}`);

  // Combined: search + filters work together (unique token -> deterministic)
  const combined = await api('GET', `/api/users/directory?q=${encodeURIComponent(uniqueCompany)}&graduationYear=2015&department=Computer%20Science%20%26%20Engineering`, null, t1);
  check('combined search+filters finds exactly user1', combined.status === 200
    && combined.data.pagination.total === 1
    && combined.data.users[0].name === 'Ishaan Malhotra', `total ${combined.data.pagination.total}`);

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortedAsc = await api('GET', '/api/users/directory?sort=name_asc&limit=48', null, t1);
  const namesAsc = sortedAsc.data.users.map(u => u.name);
  check('sort name_asc is ordered', sortedAsc.status === 200
    && namesAsc.every((n, i) => i === 0 || namesAsc[i - 1].localeCompare(n) <= 0), namesAsc.slice(0, 3).join(', '));
  const sortedDesc = await api('GET', '/api/users/directory?sort=name_desc&limit=48', null, t1);
  const namesDesc = sortedDesc.data.users.map(u => u.name);
  check('sort name_desc is reverse ordered', sortedDesc.status === 200
    && namesDesc.every((n, i) => i === 0 || namesDesc[i - 1].localeCompare(n) >= 0), namesDesc.slice(0, 3).join(', '));
  const sortedNewest = await api('GET', '/api/users/directory?sort=newest&limit=1', null, t1);
  check('sort newest returns 200', sortedNewest.status === 200, `got ${sortedNewest.status}`);
  const sortedYear = await api('GET', '/api/users/directory?sort=grad_year&limit=48', null, t1);
  const years = sortedYear.data.users.map(u => u.profile.graduationYear).filter(y => y);
  check('sort grad_year is descending', sortedYear.status === 200
    && years.every((y, i) => i === 0 || years[i - 1] >= y), years.slice(0, 5).join(','));

  // ── Pagination behavior ────────────────────────────────────────────────────
  const page1 = await api('GET', '/api/users/directory?limit=2&page=1', null, t1);
  const page2 = await api('GET', '/api/users/directory?limit=2&page=2', null, t1);
  check('pagination returns distinct pages', page1.status === 200 && page2.status === 200
    && page1.data.users[0]._id !== page2.data.users[0]._id, 'same first user on both pages');
  check('pagination meta correct', page2.data.pagination.page === 2
    && page2.data.pagination.limit === 2
    && page2.data.pagination.total === page1.data.pagination.total, JSON.stringify(page2.data.pagination));

  // ── Invalid parameters -> 4xx ──────────────────────────────────────────────
  const badPage = await api('GET', '/api/users/directory?page=zero', null, t1);
  check('non-numeric page -> 400', badPage.status === 400, `got ${badPage.status}`);
  const negPage = await api('GET', '/api/users/directory?page=-1', null, t1);
  check('negative page -> 400', negPage.status === 400, `got ${negPage.status}`);
  const bigLimit = await api('GET', '/api/users/directory?limit=500', null, t1);
  check('limit above max -> 400', bigLimit.status === 400, `got ${bigLimit.status}`);
  const zeroLimit = await api('GET', '/api/users/directory?limit=0', null, t1);
  check('limit 0 -> 400', zeroLimit.status === 400, `got ${zeroLimit.status}`);
  const badSort = await api('GET', '/api/users/directory?sort=popularity', null, t1);
  check('unknown sort -> 400', badSort.status === 400, `got ${badSort.status}`);
  const badYear = await api('GET', '/api/users/directory?graduationYear=abcd', null, t1);
  check('non-numeric graduationYear -> 400', badYear.status === 400, `got ${badYear.status}`);
  const weirdYear = await api('GET', '/api/users/directory?graduationYear=1899', null, t1);
  check('graduationYear below 1900 -> 400', weirdYear.status === 400, `got ${weirdYear.status}`);

  // ── Regex safety: metacharacters must not cause 500 ────────────────────────
  const regexAbuse = await api('GET', '/api/users/directory?q=' + encodeURIComponent('.*('), null, t1);
  check('regex metacharacters in search -> safe', regexAbuse.status === 200, `got ${regexAbuse.status}`);
  const regexFilter = await api('GET', '/api/users/directory?department=' + encodeURIComponent('CSE$^|'), null, t1);
  check('regex metacharacters in filter -> safe', regexFilter.status === 200 || regexFilter.status === 400, `got ${regexFilter.status}`);

  // ── Facets ─────────────────────────────────────────────────────────────────
  const facets = await api('GET', '/api/users/directory/facets', null, t1);
  check('facets loads -> 200', facets.status === 200, `got ${facets.status}`);
  check('facets include department of user1', facets.status === 200
    && facets.data.departments.includes('Computer Science & Engineering'), JSON.stringify(facets.data.departments));
  check('facets graduationYears are sorted desc', facets.status === 200
    && facets.data.graduationYears.every((y, i) => i === 0 || facets.data.graduationYears[i - 1] >= y),
    facets.data.graduationYears.slice(0, 5).join(','));

  // ── Empty results handled correctly ────────────────────────────────────────
  const empty = await api('GET', '/api/users/directory?q=zzznomatchzzz', null, t1);
  check('no-match search -> 200 with empty users', empty.status === 200
    && empty.data.users.length === 0 && empty.data.pagination.total === 0, JSON.stringify(empty.data.pagination));

  // ── Legacy /search still works ─────────────────────────────────────────────
  const legacy = await api('GET', '/api/users/search?query=Malh', null, t1);
  check('legacy /search matches users', legacy.status === 200
    && legacy.data.users.length >= 1, `total ${legacy.data.users.length}`);
  const legacyEscaped = await api('GET', '/api/users/search?query=' + encodeURIComponent('('), null, t1);
  check('legacy /search with metachar -> safe', legacyEscaped.status === 200, `got ${legacyEscaped.status}`);

  console.log('\n=========================================');
  console.log(`DIRECTORY RESULTS: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(` - ${f}`));
  }
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error('SUITE ERROR:', e.message);
  process.exit(1);
});
