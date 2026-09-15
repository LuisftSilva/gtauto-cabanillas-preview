const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

let turnstileToken = '';
let turnstileWidgetId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  $$('[data-map]').forEach((button) => button.addEventListener('click', openNativeMap));
  setupMobileMenu();
  setupQuoteDialog();
  setupReviewCarousel();
  setupServicesStatus();
  setupRevealAnimations();
  setupContactForm();
});

function openNativeMap() {
  const address = encodeURIComponent('GTAuto Cabanillas, Av. de Castilla-La Mancha 17 nave 5, 19171 Cabanillas del Campo, Guadalajara, España');
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) {
    window.location.href = `geo:0,0?q=${address}`;
    return;
  }
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    window.location.href = `maps://maps.apple.com/?q=${address}`;
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank', 'noopener,noreferrer');
}

function setupMobileMenu() {
  const button = $('.menu-toggle');
  const menu = $('#mobile-menu');
  if (!button || !menu) return;

  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.hidden = !open;
  };

  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

function setupQuoteDialog() {
  const dialog = $('#quote-dialog');
  if (!dialog) return;

  const open = () => {
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('dialog-open');
    setupTurnstile();
    requestAnimationFrame(() => $('#name', dialog)?.focus({ preventScroll: true }));
  };
  const close = () => {
    if (dialog.open) dialog.close();
    document.documentElement.classList.remove('dialog-open');
  };

  $$('[data-open-quote]').forEach((button) => button.addEventListener('click', open));
  $$('[data-close-quote]', dialog).forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('close', () => document.documentElement.classList.remove('dialog-open'));
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) close();
  });
  const params = new URLSearchParams(location.search);
  if (params.get('presupuesto') === '1') {
    open();
    history.replaceState({}, '', location.pathname + location.hash);
  }
}

function setupReviewCarousel() {
  const track = $('[data-review-track]');
  if (!track) return;
  const amount = () => Math.min(track.clientWidth * .72, 390);
  $('[data-review-prev]')?.addEventListener('click', () => track.scrollBy({ left: -amount(), behavior: 'smooth' }));
  $('[data-review-next]')?.addEventListener('click', () => track.scrollBy({ left: amount(), behavior: 'smooth' }));
}

function setupServicesStatus() {
  const track = $('[data-services-track]');
  const status = $('[data-services-status]');
  if (!track || !status) return;
  const cards = $$('.card', track);
  const update = () => {
    if (!cards.length) return;
    const left = track.getBoundingClientRect().left;
    let best = 0;
    let distance = Infinity;
    cards.forEach((card, index) => {
      const d = Math.abs(card.getBoundingClientRect().left - left);
      if (d < distance) { distance = d; best = index; }
    });
    status.textContent = `${String(best + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  };
  track.addEventListener('scroll', update, { passive: true });
  update();
}

async function setupTurnstile() {
  if (turnstileWidgetId !== null || window.location.hostname.endsWith('github.io')) return;
  try {
    const response = await fetch('/api/config', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const config = await response.json();
    if (!config.turnstileSiteKey) return;

    await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    const slot = $('#turnstile-slot');
    if (!slot || !window.turnstile) return;
    turnstileWidgetId = window.turnstile.render(slot, {
      sitekey: config.turnstileSiteKey,
      theme: 'dark',
      action: 'contact',
      callback: (token) => { turnstileToken = token; },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => { turnstileToken = ''; }
    });
  } catch (_) {
    // El servidor mostrará un error claro si la verificación es necesaria.
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function setupContactForm() {
  const form = $('#contact-form');
  const status = $('#form-status');
  if (!form || !status) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    if (!form.reportValidity()) return;

    if (window.location.hostname.endsWith('github.io')) {
      status.textContent = 'Vista previa: el envío se activará en el dominio final. Puedes probar teléfono, WhatsApp y navegación.';
      return;
    }

    const submit = $('button[type="submit"]', form);
    submit.disabled = true;
    submit.textContent = 'Enviando…';
    const data = Object.fromEntries(new FormData(form).entries());
    data.turnstileToken = turnstileToken;

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se ha podido enviar la solicitud.');
      status.textContent = 'Solicitud enviada. GTAuto la recibirá directamente en su correo.';
      form.reset();
      turnstileToken = '';
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    } catch (error) {
      status.textContent = error.message || 'No se ha podido enviar. Puedes contactar por teléfono o WhatsApp.';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Enviar solicitud';
    }
  });
}

function setupRevealAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = $$('.section-head, .card, .process-strip, .engine-copy, .engine-gallery, .review-card, .reviews-head, .contact-copy, .contact-details, .contact-visual');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  items.forEach((item, index) => {
    item.classList.add('reveal');
    item.style.transitionDelay = `${Math.min(index % 3, 2) * 55}ms`;
    observer.observe(item);
  });
}
