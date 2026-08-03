const CONFIG = {
  owner: 'anandkumarjha11110',
  repo: 'geopolis-site',
  branch: 'main',
  articleDir: 'content/articles',
  dissertationDir: 'content/dissertations',
  teamDir: 'content/team',
  eventsDir: 'content/events'
};

const ARTICLE_FORM_URL = 'submit-article.html';
const MEMBERSHIP_FORM_URL = 'membership.html';

function parseFrontmatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: normalized };
  const data = {};
  match[1].split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > -1) {
      const key = line.slice(0, idx).trim();
      data[key] = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    }
  });
  return { data, body: match[2].trim() };
}

function slugFromPath(path) { return path.split('/').pop().replace(/\.md$/i, ''); }
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'Undated';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
function readTime(body) {
  const words = body.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} min read`;
}

function escapeHtml(text = '') {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderMarkdown(md) {
  const escaped = escapeHtml(md)
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
    .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="width:100%; border-radius:12px; margin:20px 0;">')
.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  const lines = escaped.split('\n');
  let inList = false;
  const html = lines.map((line) => {
    if (/^\s*[-*]\s+/.test(line)) {
      const item = line.replace(/^\s*[-*]\s+/, '');
      if (!inList) { inList = true; return `<ul><li>${item}</li>`; }
      return `<li>${item}</li>`;
    }
    if (inList) { inList = false; return `</ul>${line.trim() ? `<p>${line}</p>` : ''}`; }
    if (!line.trim()) return '';
    if (/^<h\d|^<blockquote/.test(line)) return line;
    return `<p>${line}</p>`;
  }).join('');

  return inList ? `${html}</ul>` : html;
}

async function fetchMarkdownByUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.text();
}

async function getCollectionIndex(dir) {
  const api = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${dir}`;
  const response = await fetch(api, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) return [];
  const payload = await response.json();
  return payload.filter((item) => item.type === 'file' && item.name.endsWith('.md')).map((file) => ({
    slug: slugFromPath(file.path),
    path: file.path,
    url: file.download_url || `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${file.path}`
  }));
}

function syncFormLinks() {
  document.querySelectorAll('[data-submit-article-link]').forEach((link) => link.setAttribute('href', ARTICLE_FORM_URL));
  document.querySelectorAll('[data-membership-link]').forEach((link) => link.setAttribute('href', MEMBERSHIP_FORM_URL));
}

function setupNav() {
  const btn = document.getElementById('navToggle');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
}

function normalizePublicationType(value = '') {
  const map = {
    'Research Articles': 'Research Papers',
    'Research Article': 'Research Papers',
    'Essay': 'Essays',
    'Book Review': 'Book Reviews',
    'Policy': 'Policy Briefs',
    'IR': 'International Relations'
  };
  return map[value] || value || 'Research Papers';
}

function citeAPA(article) {
  const year = article.date ? new Date(article.date).getFullYear() : 'n.d.';
  return `${article.author} (${year}). ${article.title}. GEOPOLIS.`;
}
function citeMLA(article) {
  const date = article.date ? formatDate(article.date) : 'n.d.';
  return `${article.author}. "${article.title}." GEOPOLIS, ${date}.`;
}

async function loadArticles() {
  const list = await getCollectionIndex(CONFIG.articleDir);
  const records = await Promise.all(list.map(async (item) => {
    const raw = await fetchMarkdownByUrl(item.url);
    const { data, body } = parseFrontmatter(raw);
    return {
      slug: item.slug,
      title: data.title || item.slug,
      author: data.author || 'GEOPOLIS Editorial Collective',
      date: data.date || '',
      category: normalizePublicationType(data.category || 'Research Papers'),
      abstract: data.abstract || body.replace(/[#>*_`\-]/g, '').slice(0, 220),
      discipline: data.discipline || data.topic || 'Humanities and Social Sciences',
      keywords: (data.keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      tags: (data.tags || '').split(',').map((k) => k.trim()).filter(Boolean),
      university: data.university || data.institution || 'Independent scholar',
      department: data.department || 'Not specified',
      orcid: data.orcid || '',
      country: data.country || 'Global',
      downloads: Number(data.downloads || 0),
      references: data.references || '',
      pdf: data.pdf || '',
      status: data.status || 'publish',
      image: data.image || '',
      body
    };
  }));

  return records.filter((a) => a.status !== 'draft').sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function loadDissertations() {
  const list = await getCollectionIndex(CONFIG.dissertationDir);
  const records = await Promise.all(list.map(async (item) => {
    const raw = await fetchMarkdownByUrl(item.url);
    const { data, body } = parseFrontmatter(raw);
    return {
      slug: item.slug,
      student: data.student || '',
      title: data.title || item.slug,
      supervisor: data.supervisor || '',
      batch: data.batch || '2024–26',
      topic: data.topic || 'General',
      abstract: data.abstract || body.slice(0, 200),
      pdf: data.pdf || ''
    };
  }));
  return records;
}

function updateAnalytics(key) {
  const all = JSON.parse(localStorage.getItem('geopolisAnalytics') || '{}');
  all[key] = (all[key] || 0) + 1;
  localStorage.setItem('geopolisAnalytics', JSON.stringify(all));
}

function renderFeaturedHome(articles) {
  const host = document.getElementById('featuredArticles');
  if (!host) return;
  const placeholders = [
    { category: 'Research Paper', title: 'Democracy, Public Reason, and Digital Civic Life', author: 'GEOPOLIS Editorial Desk', discipline: 'Political Science', abstract: 'A forthcoming publication exploring democratic participation, digital publics, and contemporary civic institutions.', date: '2026-08-01', slug: '' },
    { category: 'Essay', title: 'Reading Humanities in a Connected World', author: 'GEOPOLIS Editorial Desk', discipline: 'English', abstract: 'A forthcoming essay on interdisciplinary reading practices and the public value of humanities scholarship.', date: '2026-08-01', slug: '' },
    { category: 'Policy Brief', title: 'Open Knowledge and Equitable Research Access', author: 'GEOPOLIS Editorial Desk', discipline: 'Public Policy', abstract: 'A forthcoming brief examining open-access publishing and its role in widening scholarly participation.', date: '2026-08-01', slug: '' }
  ];
  const latest = [...articles.slice(0, 3), ...placeholders].slice(0, 3);
  host.innerHTML = latest.map((a) => {
    const href = a.slug ? `article.html?id=${encodeURIComponent(a.slug)}` : 'journal.html';
    return `
    <article class="article-card">
      <div class="meta"><span class="category-pill">${a.category}</span><span>${formatDate(a.date)}</span></div>
      <h3><a class="title-link" href="${href}">${a.title}</a></h3>
      <p><strong>Author:</strong> ${a.author}</p>
      <p><strong>Discipline:</strong> ${a.discipline}</p>
      <p>${escapeHtml(a.abstract).slice(0, 150)}...</p>
      <a class="btn btn--outline" href="${href}">Read More</a>
    </article>`;
  }).join('');
}

function renderJournal(articles, dissertations) {
  const host = document.getElementById('articlesGrid');
  if (!host) return;
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const cat = document.getElementById('categoryFilter')?.value || 'All';
  const discipline = document.getElementById('disciplineFilter')?.value || 'All';
  const year = document.getElementById('yearFilter')?.value || 'All';
  const university = (document.getElementById('universityFilter')?.value || '').toLowerCase();
  const country = (document.getElementById('countryFilter')?.value || '').toLowerCase();
  const keyword = (document.getElementById('keywordFilter')?.value || '').toLowerCase();
  const sort = document.getElementById('sortFilter')?.value || 'Newest';

  const filteredArticles = articles.filter((a) => {
    const publicationYear = a.date ? String(new Date(a.date).getFullYear()) : 'Undated';
    const text = `${a.title} ${a.author} ${a.abstract} ${a.discipline} ${a.university} ${a.country} ${a.keywords.join(' ')}`.toLowerCase();
    const byQ = !q || text.includes(q);
    const byCat = cat === 'All' || a.category === cat;
    const byDiscipline = discipline === 'All' || a.discipline === discipline;
    const byYear = year === 'All' || publicationYear === year;
    const byUniversity = !university || a.university.toLowerCase().includes(university);
    const byCountry = !country || a.country.toLowerCase().includes(country);
    const byKeyword = !keyword || a.keywords.join(' ').toLowerCase().includes(keyword) || a.tags.join(' ').toLowerCase().includes(keyword);
    return byQ && byCat && byDiscipline && byYear && byUniversity && byCountry && byKeyword;
  }).sort((a, b) => {
    if (sort === 'Oldest') return new Date(a.date) - new Date(b.date);
    if (sort === 'Most downloaded') return b.downloads - a.downloads;
    if (sort === 'Alphabetical') return a.title.localeCompare(b.title);
    return new Date(b.date) - new Date(a.date);
  });

  const filteredDissertations = dissertations.filter((d) => {
    const text = `${d.student} ${d.title} ${d.abstract} ${d.topic}`.toLowerCase();
    const byQ = !q || text.includes(q);
    const byCat = cat === 'All' || cat === 'Dissertations';
    const byDiscipline = discipline === 'All' || d.topic === discipline;
    return byQ && byCat && byDiscipline;
  });

  const articleHtml = filteredArticles.map((a) => `
    <article class="article-card">
      <div class="meta"><span class="category-pill">${a.category}</span><span>${formatDate(a.date)}</span></div>
      <h3><a class="title-link" href="article.html?id=${encodeURIComponent(a.slug)}">${a.title}</a></h3>
      <p><strong>${a.author}</strong> · ${a.university} · ${a.country}</p>
      <p><span class="tag-pill">${a.discipline}</span>${a.keywords.slice(0, 2).map((k) => `<span class="tag-pill">${k}</span>`).join('')}</p>
      <p>${escapeHtml(a.abstract).slice(0, 160)}...</p>
      <a class="btn btn--outline" href="article.html?id=${encodeURIComponent(a.slug)}">Open Publication</a>
    </article>
  `).join('');

  const disserHost = document.getElementById('dissertationGrid');
  if (disserHost) {
    disserHost.innerHTML = filteredDissertations.map((d) => `
      <article class="article-card">
        <div class="meta"><span class="category-pill">Dissertation ${d.batch}</span><span>${d.topic}</span></div>
        <h3>${d.title}</h3>
        <p><strong>${d.student || 'Author forthcoming'}</strong> · Supervisor: ${d.supervisor || 'Not specified'}</p>
        <p>${escapeHtml(d.abstract).slice(0, 160)}...</p>
        ${d.pdf ? `<a class="btn btn--ghost" href="${d.pdf}" target="_blank" rel="noopener">Download PDF</a>` : ''}
      </article>
    `).join('') || '<div class="empty-state">No dissertations match your current filters.</div>';
  }

  host.innerHTML = articleHtml || '<div class="empty-state">No publications match your current filters.</div>';
}

async function loadJournalPage() {
  const host = document.getElementById('articlesGrid');
  if (!host) return;
  host.innerHTML = '<p>Loading publications...</p>';
  const [articles, dissertations] = await Promise.all([loadArticles(), loadDissertations()]);
  const yearFilter = document.getElementById('yearFilter');
  if (yearFilter) {
    const years = [...new Set(articles.map((a) => a.date ? String(new Date(a.date).getFullYear()) : '').filter(Boolean))].sort((a, b) => b.localeCompare(a));
    yearFilter.innerHTML = '<option>All</option>' + years.map((y) => `<option>${y}</option>`).join('');
  }
  const render = () => renderJournal(articles, dissertations);
  ['searchInput', 'categoryFilter', 'disciplineFilter', 'yearFilter', 'universityFilter', 'countryFilter', 'keywordFilter', 'sortFilter'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', render);
    if (el) el.addEventListener('change', render);
  });
  render();
}

async function loadArticlePage() {
  const host = document.getElementById('articleContainer');
  if (!host) return;
  const slug = new URLSearchParams(window.location.search).get('id');
  if (!slug) {
    host.innerHTML = '<div class="empty-state">Missing publication ID.</div>';
    return;
  }

  const articles = await loadArticles();
  const article = articles.find((a) => a.slug === slug);
  if (!article) {
    host.innerHTML = '<div class="empty-state">Publication not found.</div>';
    return;
  }

  updateAnalytics(`publication:${slug}`);
  const related = articles.filter((a) => a.slug !== slug && (a.category === article.category || a.tags.some((t) => article.tags.includes(t)))).slice(0, 3);

  const citation = citeAPA(article);
  const renderedReferences = article.references ? renderMarkdown(article.references) : '<p>References are included in the publication text when supplied by the author.</p>';
  host.innerHTML = `
    <header class="article-header publication-header">
      <p class="kicker">${article.category}</p>
      <h1>${article.title}</h1>
      ${article.image ? `<img src="${article.image}" alt="" style="width:100%; border-radius:12px; margin:20px 0;">` : ''}
      <p class="meta">By ${article.author} · ${formatDate(article.date)} · ${readTime(article.body)}</p>
      <dl class="metadata-grid">
        <div><dt>University</dt><dd>${article.university}</dd></div>
        <div><dt>Department</dt><dd>${article.department}</dd></div>
        <div><dt>ORCID</dt><dd>${article.orcid ? `<a href="https://orcid.org/${article.orcid}" target="_blank" rel="noopener">${article.orcid}</a>` : 'Not provided'}</dd></div>
        <div><dt>Discipline</dt><dd>${article.discipline}</dd></div>
      </dl>
      <section class="abstract-box"><h2>Abstract</h2><p>${escapeHtml(article.abstract)}</p></section>
      <section><h2>Keywords</h2><p>${article.keywords.length ? article.keywords.map((k) => `<span class="tag-pill">${k}</span>`).join('') : '<span class="tag-pill">Humanities and Social Sciences</span>'}</p></section>
      <section class="citation-box"><h2>Citation</h2><p>${citation}</p></section>
      <div class="btn-row">
        ${article.pdf ? `<a class="btn btn--gold" href="${article.pdf}" target="_blank" rel="noopener">Download PDF</a>` : '<a class="btn btn--gold" href="#publication-text">Read Publication</a>'}
        ${article.pdf ? `<a class="btn btn--ghost" href="${article.pdf}" target="_blank" rel="noopener">PDF Link</a>` : ''}
        <button id="copyApa" class="btn btn--ghost" type="button">Copy APA</button>
        <button id="copyMla" class="btn btn--ghost" type="button">Copy MLA</button>
        <button id="readingMode" class="btn btn--outline" type="button">Reading Mode</button>
        <a class="btn btn--ghost" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}" target="_blank" rel="noopener">Share</a>
      </div>
      <small id="citeMsg"></small>
    </header>
    <article id="publication-text" class="article-body">${renderMarkdown(article.body)}</article>
    <section class="article-header references-box"><h2>References</h2>${renderedReferences}</section>
    <section class="section" style="padding-bottom:0.5rem;">
      <h3>Related Publications</h3>
      <div class="grid grid-3">${related.map((r) => `<a class="card" href="article.html?id=${encodeURIComponent(r.slug)}"><strong>${r.title}</strong><p>${r.author}</p></a>`).join('') || '<p>No related publications yet.</p>'}</div>
    </section>
  `;

  const msg = document.getElementById('citeMsg');
  const copy = async (text) => {
    await navigator.clipboard.writeText(text);
    msg.textContent = 'Citation copied.';
  };

  document.getElementById('copyApa')?.addEventListener('click', () => copy(citeAPA(article)));
  document.getElementById('copyMla')?.addEventListener('click', () => copy(citeMLA(article)));
  document.getElementById('readingMode')?.addEventListener('click', () => document.body.classList.toggle('article-reading'));
}

async function loadTeamPage() {
  const host = document.getElementById('teamGrid');
  if (!host) return;
  const list = await getCollectionIndex(CONFIG.teamDir);
  if (!list.length) {
    host.innerHTML = '<div class="empty-state">No team members added yet.</div>';
    return;
  }
  const members = await Promise.all(list.map(async (item) => {
    const raw = await fetchMarkdownByUrl(item.url);
    const { data, body } = parseFrontmatter(raw);
    return { ...data, body };
  }));
  members.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  host.innerHTML = members.map((m) => `
    <article class="card">
      ${(m.image || m.photo) ? `<img loading="lazy" src="${m.image || m.photo}" alt="${m.name}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;">` : `<div style="width:72px;height:72px;border-radius:50%;background:#dce4f5;display:grid;place-items:center;font-weight:700;">${(m.name || 'G').slice(0,1)}</div>`}
      <h3>${m.name}</h3>
      <p><strong>${m.role}</strong></p>
      <p>${m.course_year || ''}</p>
      <p>${m.research_interests || ''}</p>
      <p>${m.bio || m.body || ''}</p>
    </article>
  `).join('');
}

async function loadEventsPage() {
  const upcoming = document.getElementById('upcomingEvents');
  const past = document.getElementById('pastEvents');
  const slider = document.getElementById('eventSlider');
  if (!upcoming && !past && !slider) return;

  const list = await getCollectionIndex(CONFIG.eventsDir);
  if (!list.length) return;
  const records = await Promise.all(list.map(async (item) => {
    const raw = await fetchMarkdownByUrl(item.url);
    const { data, body } = parseFrontmatter(raw);
    return { ...data, body, when: new Date(data.date) };
  }));

  records.sort((a, b) => a.when - b.when);
  const now = new Date();
  const up = records.filter((e) => e.when >= now);
  const pa = records.filter((e) => e.when < now).reverse();
  const card = (e) => `
    <article class="card">
      ${e.poster ? `<img loading="lazy" class="event-poster" src="${e.poster}" alt="Poster for ${e.title}">` : ''}
      <h3>${e.title}</h3>
      <p><strong>${formatDate(e.date)}</strong> · ${e.speaker || 'GEOPOLIS'}</p>
      <p>${e.description || e.body || ''}</p>
    </article>`;

  if (upcoming) upcoming.innerHTML = up.map(card).join('') || '<div class="empty-state">No upcoming events.</div>';
  if (past) past.innerHTML = pa.map(card).join('') || '<div class="empty-state">No past events yet.</div>';
  if (slider) slider.innerHTML = up.slice(0, 5).map(card).join('') || '<div class="empty-state">Event updates coming soon.</div>';
}

function loadAnalytics() {
  const host = document.getElementById('analyticsDashboard');
  if (!host) return;
  const all = JSON.parse(localStorage.getItem('geopolisAnalytics') || '{}');
  const entries = Object.entries(all).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  host.innerHTML = `
    <div class="metric"><small>Total publication reads</small><strong>${total}</strong></div>
    ${entries.slice(0, 5).map(([k, v]) => `<div class="metric"><small>${k.replace('publication:', '').replace('article:', '')}</small><strong>${v}</strong></div>`).join('')}
  `;
}

async function initHome() {
  const featured = document.getElementById('featuredArticles');
  if (!featured) return;
  const articles = await loadArticles();
  renderFeaturedHome(articles);
  loadEventsPage();
}

document.addEventListener('DOMContentLoaded', async () => {
  syncFormLinks();
  setupNav();
  await Promise.allSettled([initHome(), loadJournalPage(), loadArticlePage(), loadTeamPage(), loadEventsPage()]);
  loadAnalytics();
});
