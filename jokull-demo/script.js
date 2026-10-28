// FAQ accordion
document.querySelectorAll('.faq-q').forEach((btn) => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const answer = btn.nextElementSibling;
    btn.setAttribute('aria-expanded', String(!expanded));
    answer.style.maxHeight = expanded ? '0px' : answer.scrollHeight + 'px';
  });
});

// Mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    mainNav.classList.toggle('open');
  });
  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navToggle.setAttribute('aria-expanded', 'false');
      mainNav.classList.remove('open');
    });
  });
}

// Count-up stats, triggered once when scrolled into view
const statRow = document.getElementById('stat-row');
if (statRow) {
  const counters = statRow.querySelectorAll('[data-count]');
  let animated = false;

  const animate = () => {
    if (animated) return;
    animated = true;
    counters.forEach((el) => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const duration = 900;
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) animate();
    });
  }, { threshold: 0.4 });
  observer.observe(statRow);
}

// Demo booking form — no backend, just a friendly confirmation
const bookForm = document.getElementById('book-form');
const formNote = document.getElementById('form-note');
if (bookForm && formNote) {
  bookForm.addEventListener('submit', (e) => {
    e.preventDefault();
    formNote.hidden = false;
    bookForm.reset();
  });
}
