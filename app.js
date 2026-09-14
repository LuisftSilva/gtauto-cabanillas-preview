const $ = (s) => document.querySelector(s);

document.addEventListener('DOMContentLoaded', async () => {
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll('[data-map]').forEach((button) => {
    button.addEventListener('click', openNativeMap);
  });

  if (location.hostname.endsWith("github.io")) {
    setupPreviewForm();
  } else {
    await setupTurnstile();
    setupContactForm();
  }
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

let turnstileToken = '';
let turnstileWidgetId = null;

async function setupTurnstile() {
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
      callback: (token) => { turnstileToken = token; },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => { turnstileToken = ''; }
    });
  } catch (_) {
    // El formulario seguirá mostrando un error claro si la verificación es obligatoria en servidor.
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

    const submit = form.querySelector('button[type="submit"]');
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

function setupPreviewForm() {
  const form = document.querySelector('#contact-form');
  const status = document.querySelector('#form-status');
  if (!form || !status) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = 'Vista previa: el envío de presupuestos se activará en el dominio definitivo.';
  });
}
