(function () {
  const THEME_KEY = 'bd1ahn-theme';

  /* ── Theme toggle ── */
  const themeBtn = document.getElementById('themeToggle');
  const root = document.documentElement;

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (!themeBtn) return;
    const isLight = theme === 'light';
    themeBtn.setAttribute('aria-label', isLight ? '切换深色模式' : '切换浅色模式');
    themeBtn.title = isLight ? '深色模式' : '浅色模式';
  }

  function toggleTheme() {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
    applyTheme(root.getAttribute('data-theme') || 'dark');
  }

  const ITEM_H = 56;

  /* ── Left product wheel ── */
  const scrollRoot = document.querySelector('.showcase-scroll');
  const track = document.getElementById('product-wheel-track');
  const wheelItems = track ? track.querySelectorAll('.product-wheel__item') : [];
  const pages = document.querySelectorAll('.product-page[id]');

  function updateWheel() {
    if (!scrollRoot || !track || !wheelItems.length) return;

    const pageH = scrollRoot.clientHeight;
    const scroll = scrollRoot.scrollTop;
    const activeIndex = scroll / pageH;
    const wheelCenter = scrollRoot.clientHeight / 2;

    track.style.transform = `translateY(${wheelCenter - activeIndex * ITEM_H - ITEM_H / 2}px)`;

    wheelItems.forEach((item, i) => {
      const dist = Math.abs(i - activeIndex);
      const fade = Math.min(dist / 2.2, 1);
      const opacity = 1 - fade * 0.72;
      const scale = 1 - fade * 0.07;

      item.style.opacity = String(opacity);
      item.style.transform = `scale(${scale})`;
      item.classList.toggle('active', dist < 0.45);
    });
  }

  if (scrollRoot && track) {
    let ticking = false;
    scrollRoot.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateWheel();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    wheelItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(item.dataset.slug);
        target?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    updateWheel();
  }

  /* ── Image carousel ── */
  document.querySelectorAll('.device-mockup').forEach((mockup) => {
    const carousel = mockup.querySelector('.device-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.device-slide');
    const prevBtn = mockup.querySelector('.screen-nav__btn--prev');
    const nextBtn = mockup.querySelector('.screen-nav__btn--next');
    const counter = mockup.querySelector('.screen-nav__current');

    if (slides.length <= 1) return;

    let current = 0;

    function goTo(index, direction) {
      if (index === current) return;
      const prev = slides[current];
      prev.classList.remove('active');
      if (direction === 'prev') prev.classList.add('slide-out-left');
      setTimeout(() => prev.classList.remove('slide-out-left'), 400);

      current = (index + slides.length) % slides.length;
      slides[current].classList.add('active');
      if (counter) counter.textContent = String(current + 1);
    }

    function prev() { goTo(current - 1, 'prev'); }
    function next() { goTo(current + 1, 'next'); }

    prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
    nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); next(); });

    mockup.addEventListener('mouseenter', () => {
      mockup._keyHandler = (e) => {
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
      };
      window.addEventListener('keydown', mockup._keyHandler);
    });
    mockup.addEventListener('mouseleave', () => {
      if (mockup._keyHandler) window.removeEventListener('keydown', mockup._keyHandler);
    });

    let touchStartX = 0;
    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    carousel.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(dx) < 40) return;
      if (dx > 0) prev();
      else next();
    }, { passive: true });
  });

  /* ── Firmware version badges ── */
  const versionBadges = document.querySelectorAll('.firmware-version-badge[data-firmware-repo]');
  const versionCache = new Map();

  function formatVersionTag(tag) {
    if (!tag) return '';
    const cleaned = String(tag).trim().replace(/^v/i, '');
    return cleaned ? `v${cleaned}` : '';
  }

  async function fetchLatestFirmwareVersion(repo) {
    if (versionCache.has(repo)) return versionCache.get(repo);

    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const version = formatVersionTag(data.tag_name);
      versionCache.set(repo, version);
      return version;
    } catch {
      versionCache.set(repo, null);
      return null;
    }
  }

  async function loadFirmwareVersions() {
    const repos = [...new Set(
      [...versionBadges].map((el) => el.dataset.firmwareRepo).filter(Boolean)
    )];

    await Promise.all(repos.map(async (repo) => {
      const version = await fetchLatestFirmwareVersion(repo);
      document
        .querySelectorAll(`.firmware-version-badge[data-firmware-repo="${repo}"]`)
        .forEach((badge) => {
          if (!version) return;
          badge.textContent = version;
          badge.title = `最新固件 ${version}`;
          badge.hidden = false;
        });
    }));
  }

  if (versionBadges.length) loadFirmwareVersions();
})();
