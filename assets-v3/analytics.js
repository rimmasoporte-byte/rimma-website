(() => {
  'use strict';

  const MEASUREMENT_ID = 'G-FGHBHZH9XS';
  const STORAGE_KEY = 'rimma_analytics_consent_v1';
  const GRANTED = 'granted';
  const DENIED = 'denied';
  let loaded = false;

  const getChoice = () => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  };

  const setChoice = (value) => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch {}
  };

  const deleteAnalyticsCookies = () => {
    const names = document.cookie
      .split(';')
      .map((item) => item.split('=')[0].trim())
      .filter((name) => name === '_ga' || name.startsWith('_ga_'));
    for (const name of names) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.rimmaapp.com; SameSite=Lax`;
    }
  };

  const loadAnalytics = () => {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  };

  const disableAnalytics = () => {
    window[`ga-disable-${MEASUREMENT_ID}`] = true;
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
    deleteAnalyticsCookies();
  };

  const enableAnalytics = () => {
    window[`ga-disable-${MEASUREMENT_ID}`] = false;
    if (!loaded) {
      loadAnalytics();
      return;
    }
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  };

  const ensureStyles = () => {
    if (document.getElementById('rimma-cookie-style')) return;
    const style = document.createElement('style');
    style.id = 'rimma-cookie-style';
    style.textContent = `
      .rimma-cookie{position:fixed;left:18px;right:18px;bottom:18px;z-index:9999;max-width:760px;margin:auto;padding:18px 20px;background:#fffdf8;border:1px solid #cdb78d;box-shadow:0 16px 46px #1f241d2b;font:13px/1.55 Arial,sans-serif;color:#35372f}
      .rimma-cookie[hidden]{display:none}.rimma-cookie strong{font-size:15px}.rimma-cookie p{margin:7px 0 14px}.rimma-cookie-actions{display:flex;gap:10px;flex-wrap:wrap}
      .rimma-cookie button{border:1px solid #b99861;background:#2f3229;color:#fff;padding:10px 14px;cursor:pointer;font-weight:700}.rimma-cookie button.secondary{background:#fffdf8;color:#2f3229}.rimma-cookie a{color:#806437}
      .rimma-cookie-settings{position:fixed;left:12px;bottom:12px;z-index:9998;border:1px solid #d8c7a7;background:#fffdf8;color:#5b513f;padding:7px 10px;font:600 11px Arial,sans-serif;cursor:pointer}
      @media(max-width:640px){.rimma-cookie{left:10px;right:10px;bottom:10px}.rimma-cookie-settings{left:8px;bottom:8px}}
    `;
    document.head.appendChild(style);
  };

  const renderBanner = () => {
    ensureStyles();
    let banner = document.getElementById('rimma-cookie-consent');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'rimma-cookie-consent';
      banner.className = 'rimma-cookie';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-label', 'Preferencias de cookies');
      banner.innerHTML = `
        <strong>Tu privacidad en RIMMA</strong>
        <p>Usamos Google Analytics solo si lo aceptas para conocer visitas, países y fuentes de tráfico. No usamos estos datos para publicidad personalizada. <a href="/legal/privacy/">Más información</a>.</p>
        <div class="rimma-cookie-actions">
          <button type="button" data-rimma-consent="accept">Aceptar analíticas</button>
          <button type="button" class="secondary" data-rimma-consent="reject">Solo necesarias</button>
        </div>
      `;
      document.body.appendChild(banner);

      banner.querySelector('[data-rimma-consent="accept"]').addEventListener('click', () => {
        setChoice(GRANTED);
        enableAnalytics();
        banner.hidden = true;
      });
      banner.querySelector('[data-rimma-consent="reject"]').addEventListener('click', () => {
        setChoice(DENIED);
        disableAnalytics();
        banner.hidden = true;
      });
    }
    banner.hidden = false;
  };

  const renderSettingsButton = () => {
    if (document.getElementById('rimma-cookie-settings')) return;
    ensureStyles();
    const button = document.createElement('button');
    button.id = 'rimma-cookie-settings';
    button.className = 'rimma-cookie-settings';
    button.type = 'button';
    button.textContent = 'Cookies';
    button.addEventListener('click', renderBanner);
    document.body.appendChild(button);
  };

  const trackCtas = () => {
    document.addEventListener('click', (event) => {
      if (getChoice() !== GRANTED || typeof window.gtag !== 'function') return;
      const link = event.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      let action = '';
      if (href.includes('/register.html')) action = 'begin_signup';
      else if (href.includes('/demo/')) action = 'open_demo';
      else if (href.includes('app.rimmaapp.com/app/')) action = 'login_click';
      else if (href.startsWith('mailto:')) action = 'contact_click';
      if (action) window.gtag('event', action);
    }, { passive: true });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const choice = getChoice();
    renderSettingsButton();
    trackCtas();
    if (choice === GRANTED) enableAnalytics();
    else if (choice === DENIED) disableAnalytics();
    else renderBanner();
  });
})();