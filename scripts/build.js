const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_SRC = path.join(ROOT, 'products');
const ASSETS_OUT = path.join(ROOT, 'assets', 'products');

function loadConfig() {
  const configPath = path.join(ROOT, 'site.config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return { basePath: '' };
}

const config = loadConfig();
const BASE = (process.env.BASE_PATH !== undefined ? process.env.BASE_PATH : config.basePath || '').replace(/\/$/, '');

function url(...parts) {
  const joined = parts.filter(Boolean).join('/');
  return BASE ? `${BASE}/${joined}` : joined;
}

marked.setOptions({ breaks: true, gfm: true });

marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${String(title).replace(/"/g, '&quot;')}"` : '';
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

function parseProductMd(raw) {
  return matter(raw, {
    engines: {
      yaml: {
        parse: (src) => yaml.load(src, { schema: yaml.JSON_SCHEMA }),
      },
    },
  });
}

/** 将 date 格式化为页面展示文本，支持 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss */
function formatDisplayDate(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    const h = value.getUTCHours();
    const min = value.getUTCMinutes();
    const s = value.getUTCSeconds();
    if (h === 0 && min === 0 && s === 0) return `${y}-${m}-${d}`;
    return `${y}-${m}-${d} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return String(value).trim();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-').replace(/^-|-$/g, '');
}

function findProductMd(folder) {
  const candidates = ['product.md', 'index.md', 'README.md'];
  for (const name of candidates) {
    const p = path.join(folder, name);
    if (fs.existsSync(p)) return p;
  }
  const md = fs.readdirSync(folder).find((f) => f.endsWith('.md'));
  return md ? path.join(folder, md) : null;
}

function collectImages(folder, orderList) {
  const imagesDir = path.join(folder, 'images');
  if (!fs.existsSync(imagesDir)) return [];
  const exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
  // 保持文件夹读取顺序，不做额外排序
  const all = fs
    .readdirSync(imagesDir)
    .filter((f) => exts.includes(path.extname(f).toLowerCase()));

  const hasOrder = Array.isArray(orderList) && orderList.some((n) => String(n).trim());

  if (hasOrder) {
    const ordered = orderList
      .map((name) => String(name).trim())
      .filter(Boolean)
      .filter((name) => {
        if (all.includes(name)) return true;
        console.warn(`⚠ ${path.basename(folder)}：images 列表中未找到文件: ${name}`);
        return false;
      });
    const rest = all.filter((f) => !ordered.includes(f));
    return [...ordered, ...rest];
  }

  return all;
}

function scanProducts() {
  if (!fs.existsSync(PRODUCTS_SRC)) return [];

  return fs
    .readdirSync(PRODUCTS_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => {
      const folder = path.join(PRODUCTS_SRC, d.name);
      const mdPath = findProductMd(folder);
      if (!mdPath) {
        console.warn(`⚠ 跳过 ${d.name}：未找到 .md 文件`);
        return null;
      }

      const raw = fs.readFileSync(mdPath, 'utf-8');
      const { data, content } = parseProductMd(raw);
      const images = collectImages(folder, data.images);
      const slug = data.slug || slugify(d.name);

      if (!data.title) {
        console.warn(`⚠ 跳过 ${d.name}：缺少 title`);
        return null;
      }

      const VALID_DEVICES = ['phone', 'pc', 'walkie'];
      const deviceRaw = (data.device || 'phone').toLowerCase();
      const device = VALID_DEVICES.includes(deviceRaw) ? deviceRaw : 'phone';

      if (!VALID_DEVICES.includes(deviceRaw)) {
        console.warn(`⚠ ${d.name}：device 应为 phone / pc / walkie，已回退为 phone`);
      }

      const deviceLabel = data.device_label || data.model || '';

      return {
        slug,
        folderName: d.name,
        title: data.title,
        device,
        deviceLabel: String(deviceLabel).trim(),
        description: data.description || '',
        order: data.order ?? 999,
        date: formatDisplayDate(data.date),
        tags: data.tags || [],
        content: marked.parse(content),
        images,
        srcFolder: folder,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function copyProductAssets(products) {
  if (fs.existsSync(ASSETS_OUT)) {
    fs.rmSync(ASSETS_OUT, { recursive: true, force: true });
  }
  ensureDir(ASSETS_OUT);

  for (const p of products) {
    const dest = path.join(ASSETS_OUT, p.slug);
    ensureDir(dest);
    const srcImages = path.join(p.srcFolder, 'images');
    if (fs.existsSync(srcImages)) {
      for (const img of fs.readdirSync(srcImages)) {
        const ext = path.extname(img).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) continue;
        fs.copyFileSync(path.join(srcImages, img), path.join(dest, img));
      }
    }
    p.imageUrls = p.images.map((img) => url(`assets/products/${p.slug}/${img}`));
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCarousel(product) {
  const images = product.imageUrls;
  const slides = images.length
    ? images
        .map(
          (src, i) =>
            `<div class="device-slide${i === 0 ? ' active' : ''}" data-index="${i}">
          <img src="${src}" alt="${escapeHtml(product.title)} - ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">
        </div>`
        )
        .join('')
    : `<div class="device-slide active placeholder"><span>暂无图片</span></div>`;

  const nav =
    images.length > 1
      ? `<div class="screen-nav">
      <button type="button" class="screen-nav__btn screen-nav__btn--prev" aria-label="上一张">‹</button>
      <button type="button" class="screen-nav__btn screen-nav__btn--next" aria-label="下一张">›</button>
      <span class="screen-nav__count"><span class="screen-nav__current">1</span> / ${images.length}</span>
    </div>`
      : '';

  return `<div class="device-carousel">${slides}</div>${nav}`;
}

function deviceFrameFile(device) {
  if (device === 'walkie') return 'walkie-body.svg';
  if (device === 'pc') return 'pc-body.svg';
  return 'phone-body.svg';
}

function renderDevice(product) {
  const carousel = renderCarousel(product);
  const frameUrl = url(`assets/images/devices/${deviceFrameFile(product.device)}`);

  if (product.device === 'walkie') {
    const brand = product.deviceLabel
      ? `<span class="device-mockup__brand">${escapeHtml(product.deviceLabel)}</span>`
      : '';
    return `
    <div class="device-mockup device-mockup--walkie" data-device="walkie">
      <div class="device-mockup__screen device-mockup__screen--walkie">
        ${carousel}
      </div>
      <img class="device-mockup__frame" src="${frameUrl}" alt="" draggable="false">
      ${brand}
    </div>`;
  }

  if (product.device === 'pc') {
    return `
    <div class="device-mockup device-mockup--pc" data-device="pc">
      <div class="device-mockup__screen device-mockup__screen--pc">
        ${carousel}
      </div>
      <img class="device-mockup__frame" src="${frameUrl}" alt="" draggable="false">
    </div>`;
  }

  return `
  <div class="device-mockup device-mockup--phone" data-device="phone">
    <div class="device-mockup__screen device-mockup__screen--phone">
      ${carousel}
    </div>
    <img class="device-mockup__frame" src="${frameUrl}" alt="" draggable="false">
  </div>`;
}

function deviceBadgeText(product) {
  if (product.device === 'walkie') {
    return product.deviceLabel ? `${product.deviceLabel} 对讲机` : '对讲机';
  }
  if (product.device === 'pc') {
    return product.deviceLabel || 'PC';
  }
  return product.deviceLabel || 'Phone';
}

function renderProductSection(product, { id = product.slug } = {}) {
  const tags = product.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  return `
  <section class="product-page" id="${escapeHtml(id)}" data-device="${product.device}">
    <div class="product-detail">
      <div class="product-showcase">
        ${renderDevice(product)}
      </div>
      <div class="product-info">
        <p class="product-meta">
          <span class="device-badge device-badge--${product.device}">${escapeHtml(deviceBadgeText(product))}</span>
          ${product.date ? `<time>${escapeHtml(product.date)}</time>` : ''}
        </p>
        <h1>${escapeHtml(product.title)}</h1>
        ${product.description ? `<p class="product-lead">${escapeHtml(product.description)}</p>` : ''}
        ${tags ? `<div class="product-tags">${tags}</div>` : ''}
        <div class="product-content prose">
          ${product.content}
        </div>
      </div>
    </div>
  </section>`;
}

function renderSiteHeader() {
  return `<header class="site-header">
    <div class="site-header__brand">
      <a href="${url('index.html')}" class="logo">
        <span class="logo__brand">BD1AHN</span>
        <span class="logo__tagline">开发作品展示</span>
      </a>
      <p class="visitor-stat" aria-live="polite">
        共有 <span id="busuanzi_site_uv"><i class="visitor-stat__loading" aria-hidden="true"></i></span> Ham参观
      </p>
    </div>
    <button type="button" class="coffee-btn" id="coffeeBtn" title="点击打开页面进行打赏" aria-label="请他喝杯咖啡">
      <span class="coffee-text">请他喝杯咖啡</span>
    </button>
  </header>`;
}

function renderDonationModal() {
  return `<div id="coffeeModal" class="coffee-modal coffee-modal--donation" hidden aria-hidden="true">
    <div class="coffee-modal__backdrop" data-coffee-dismiss tabindex="-1" aria-hidden="true"></div>
    <div class="coffee-modal__panel" role="dialog" aria-modal="true" aria-labelledby="coffeeModalTitle">
      <h2 id="coffeeModalTitle" class="coffee-modal__title">☕ 请作者喝杯咖啡</h2>
      <div class="coffee-modal__body">
        <div class="coffee-modal__left">
          <div class="coffee-modal__content">
            <p class="coffee-modal__text">感谢您关注 BD1AHN 的开发作品！维护网站与项目需要时间和精力。</p>
            <p class="coffee-modal__text">如果这个项目对您有帮助，欢迎打赏支持！<strong>打赏时请备注您的呼号</strong>，方便我感谢您的支持！</p>
            <div class="coffee-modal__qrcodes">
              <div class="coffee-modal__qrcode-item">
                <img src="${url('assets/images/wechat_pay.jpg')}" alt="微信收款码" class="coffee-modal__qrcode-img">
                <span class="coffee-modal__qrcode-label">微信支付</span>
              </div>
              <div class="coffee-modal__qrcode-item">
                <img src="${url('assets/images/ali_pay.jpg')}" alt="支付宝收款码" class="coffee-modal__qrcode-img">
                <span class="coffee-modal__qrcode-label">支付宝</span>
              </div>
            </div>
          </div>
        </div>
        <div class="coffee-modal__right">
          <div class="donation-board">
            <div class="donation-board__header">打赏榜单</div>
            <div class="donation-board__scroll">
              <table class="donation-board__table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>昵称</th>
                    <th>金额</th>
                    <th>留言</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody id="donationTableBody">
                  <tr><td colspan="5" class="donation-loading">加载中...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="coffee-modal__footer">
        <p class="coffee-modal__notice">量力而行，心意至上，拒绝攀比，自愿为主。</p>
        <button type="button" class="coffee-modal__btn" id="coffeeModalCloseBtn">退出</button>
      </div>
    </div>
  </div>`;
}

function pageScripts(slugs = []) {
  return `<script>window.__BASE__ = ${JSON.stringify(BASE)}; window.__PRODUCTS__ = ${JSON.stringify(slugs)};</script>
  <script src="${url('assets/js/main.js')}"></script>
  <script src="${url('assets/js/donation.js')}"></script>`;
}

function pageHead(title) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="BD1AHN 开发作品展示">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${url('assets/css/main.css')}">
  <link rel="stylesheet" href="${url('assets/css/donation.css')}">
  <script src="//cdn.busuanzi.cc/busuanzi/3.6.9/busuanzi.min.js" defer></script>
</head>`;
}

function layout({ title, bodyClass = '', content, showFooter = true }) {
  return `${pageHead(`${escapeHtml(title)} · BD1AHN`)}
<body class="${bodyClass}">
  <div class="grain" aria-hidden="true"></div>
  ${renderSiteHeader()}
  <main>
    ${content}
  </main>
  ${showFooter ? `<footer class="site-footer"><p>© ${new Date().getFullYear()} BD1AHN</p></footer>` : ''}
  ${renderDonationModal()}
  ${pageScripts([])}
</body>
</html>`;
}

function layoutHome(products, content) {
  const slugs = products.map((p) => ({ slug: p.slug, title: p.title }));
  return `${pageHead('作品 · BD1AHN')}
<body class="page-home">
  <div class="grain" aria-hidden="true"></div>
  ${renderSiteHeader()}
  <aside class="product-wheel" aria-label="产品导航">
    <div class="product-wheel__viewport">
      <div class="product-wheel__track" id="product-wheel-track">
        ${products.map((p) => `<a href="#${p.slug}" class="product-wheel__item" data-slug="${p.slug}"><span>${escapeHtml(p.title)}</span></a>`).join('')}
      </div>
    </div>
  </aside>
  <main class="showcase-scroll">
    ${content}
  </main>
  ${renderDonationModal()}
  ${pageScripts(slugs)}
</body>
</html>`;
}

function renderIndex(products) {
  const sections = products.length
    ? products.map((p) => renderProductSection(p)).join('')
    : '<section class="product-page empty-state-page"><p class="empty-state">暂无产品，请在 <code>products/</code> 文件夹中添加。</p></section>';

  fs.writeFileSync(path.join(ROOT, 'index.html'), layoutHome(products, sections));
}

function renderProductPage(product) {
  const content = renderProductSection(product);

  const outDir = path.join(ROOT, 'p');
  ensureDir(outDir);
  const slugs = [{ slug: product.slug, title: product.title }];
  const html = `${pageHead(`${escapeHtml(product.title)} · BD1AHN`)}
<body class="page-product page-product--${product.device}">
  <div class="grain" aria-hidden="true"></div>
  ${renderSiteHeader()}
  <main class="showcase-scroll showcase-scroll--single">
    ${content}
  </main>
  ${renderDonationModal()}
  ${pageScripts(slugs)}
</body>
</html>`;

  fs.writeFileSync(path.join(outDir, `${product.slug}.html`), html);
}

function main() {
  console.log('🔨 构建产品展示站…');
  const products = scanProducts();
  copyProductAssets(products);
  renderIndex(products);
  for (const p of products) renderProductPage(p);
  console.log(`✅ 已生成 ${products.length} 个产品页面`);
}

main();
