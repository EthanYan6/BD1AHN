(function () {
  const coffeeBtn = document.getElementById('coffeeBtn');
  const coffeeModal = document.getElementById('coffeeModal');
  const coffeeModalCloseBtn = document.getElementById('coffeeModalCloseBtn');
  if (!coffeeBtn || !coffeeModal || !coffeeModalCloseBtn) return;

  const coffeeBackdrop = coffeeModal.querySelector('.coffee-modal__backdrop');
  let donationDataLoaded = false;

  function parseDonationCSV(csvText) {
    const tbody = document.getElementById('donationTableBody');
    if (!tbody) return false;
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) {
      tbody.innerHTML = '<tr><td colspan="5" class="donation-loading">暂无打赏记录</td></tr>';
      return false;
    }
    const dataLines = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 5) dataLines.push(cols);
    }
    dataLines.reverse();
    let html = '';
    for (const c of dataLines) {
      html += `<tr><td>${c[0]}</td><td>${c[1]}</td><td>${c[2]}</td><td>${c[3] || ''}</td><td>${c[4]}</td></tr>`;
    }
    tbody.innerHTML = html;
    return true;
  }

  function loadDonationData() {
    if (donationDataLoaded) return;
    const bust = `?t=${Date.now()}`;
    const urls = [
      `https://ethanyan6.github.io/Dondji/data/donations.csv${bust}`,
      `https://raw.githubusercontent.com/EthanYan6/Dondji/motorola_r7/docs/data/donations.csv${bust}`,
    ];
    let i = 0;
    function fail() {
      const tbody = document.getElementById('donationTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="donation-loading">榜单加载失败</td></tr>';
    }
    function tryNext() {
      if (i >= urls.length) { fail(); return; }
      fetch(urls[i++])
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .then((text) => {
          if (parseDonationCSV(text)) donationDataLoaded = true;
          else tryNext();
        })
        .catch(tryNext);
    }
    tryNext();
  }

  function pageOverflow() {
    return document.body.classList.contains('page-home') || document.body.classList.contains('page-product')
      ? 'hidden'
      : '';
  }

  function openCoffeeModal() {
    coffeeModal.hidden = false;
    coffeeModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    loadDonationData();
  }

  function closeCoffeeModal() {
    coffeeModal.hidden = true;
    coffeeModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = pageOverflow();
  }

  coffeeBtn.addEventListener('click', openCoffeeModal);
  coffeeModalCloseBtn.addEventListener('click', closeCoffeeModal);
  coffeeBackdrop?.addEventListener('click', closeCoffeeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !coffeeModal.hidden) closeCoffeeModal();
  });
})();
