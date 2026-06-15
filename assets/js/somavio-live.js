/* SomaVio live/demo data layer
   - Keeps the safety alert consistent across pages.
   - Uses a browser-safe public forecast API for demo weather.
   - Falls back gracefully if the API is unavailable.
*/
(function () {
  'use strict';

  const SOMAVIO_LOCATION = {
    name: 'Canmore',
    latitude: 51.0892,
    longitude: -115.359,
    timezone: 'America/Edmonton'
  };



  const SUPPORTED_LANGUAGES = ['en', 'pt', 'es', 'fr', 'ja', 'ko'];
  const LANGUAGE_LABELS = {
    en: 'EN',
    pt: 'PT',
    es: 'ES',
    fr: 'FR',
    ja: 'JA',
    ko: 'KO'
  };

  // Unit policy for the demo:
  // - PT/ES/FR/JA/KO: metric + Celsius only.
  // - EN: dual display because English-speaking visitors may expect either Canadian metric or US imperial.
  const LANGUAGE_UNIT_POLICY = {
    en: 'dual',
    pt: 'metric',
    es: 'metric',
    fr: 'metric',
    ja: 'metric',
    ko: 'metric'
  };

  function unitPolicyForLanguage(lang) {
    return LANGUAGE_UNIT_POLICY[normalizeLanguageCode(lang)] || 'metric';
  }

  function roundTo(value, decimals) {
    const factor = Math.pow(10, decimals || 0);
    return Math.round(Number(value) * factor) / factor;
  }

  function formatNumber(value, decimals) {
    const rounded = roundTo(value, decimals);
    return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(decimals));
  }

  function celsiusToFahrenheit(celsius) {
    return Math.round((Number(celsius) * 9 / 5) + 32);
  }

  function kmToMiles(km) {
    return Number(km) * 0.621371;
  }

  function metresToFeet(metres) {
    return Number(metres) * 3.28084;
  }

  function kmhToMph(kmh) {
    return Number(kmh) * 0.621371;
  }

  function formatTemperature(celsius, lang) {
    if (celsius === null || celsius === undefined || !Number.isFinite(Number(celsius))) return 'available';
    const c = Math.round(Number(celsius));
    if (unitPolicyForLanguage(lang) === 'dual') return `${c}°C / ${celsiusToFahrenheit(c)}°F`;
    return `${c}°C`;
  }

  function formatWind(kmh, lang) {
    if (kmh === null || kmh === undefined || !Number.isFinite(Number(kmh))) return '';
    const metric = `${Math.round(Number(kmh))} km/h`;
    if (unitPolicyForLanguage(lang) === 'dual') return `${metric} / ${Math.round(kmhToMph(kmh))} mph`;
    return metric;
  }

  function formatDistance(value, unit, lang, hasPlus) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return `${value} ${unit}`;
    const plus = hasPlus ? '+' : '';
    const normalizedUnit = String(unit).toLowerCase();

    if (normalizedUnit === 'km') {
      const decimals = numeric < 10 && !Number.isInteger(numeric) ? 1 : 0;
      const metric = `${formatNumber(numeric, decimals)}${plus} km`;
      if (unitPolicyForLanguage(lang) === 'dual') {
        const miles = kmToMiles(numeric);
        const miDecimals = miles < 10 && !Number.isInteger(roundTo(miles, 1)) ? 1 : (miles < 10 ? 1 : 0);
        return `${metric} / ${formatNumber(miles, miDecimals)}${plus} mi`;
      }
      return metric;
    }

    if (normalizedUnit === 'metres' || normalizedUnit === 'meters' || normalizedUnit === 'metre' || normalizedUnit === 'meter') {
      const metricLabel = numeric === 1 ? 'metre' : 'metres';
      const metric = `${formatNumber(numeric, 0)}${plus} ${metricLabel}`;
      if (unitPolicyForLanguage(lang) === 'dual') {
        const feet = metresToFeet(numeric);
        return `${metric} / ${formatNumber(feet, 0)}${plus} ft`;
      }
      return metric;
    }

    return `${value} ${unit}`;
  }

  function normalizeLanguageCode(value) {
    if (!value) return 'en';
    const raw = String(value).toLowerCase();
    const base = raw.split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
    return 'en';
  }

  function getBrowserLanguage() {
    const candidates = [];
    if (navigator.languages && navigator.languages.length) candidates.push(...navigator.languages);
    if (navigator.language) candidates.push(navigator.language);
    if (navigator.userLanguage) candidates.push(navigator.userLanguage);

    for (const candidate of candidates) {
      const normalized = normalizeLanguageCode(candidate);
      if (SUPPORTED_LANGUAGES.includes(normalized) && normalized !== 'en') return normalized;
    }
    return 'en';
  }

  function getUrlLanguage() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (!params.has('lang')) return null;
      const raw = params.get('lang');
      const lang = normalizeLanguageCode(raw);
      return raw && SUPPORTED_LANGUAGES.includes(lang) ? lang : null;
    } catch (_) {
      return null;
    }
  }

  function resolveInitialLanguage() {
    const urlLang = getUrlLanguage();
    const savedLang = normalizeLanguageCode(localStorage.getItem('sv_lang'));
    const hasSaved = localStorage.getItem('sv_lang') && SUPPORTED_LANGUAGES.includes(savedLang);
    const detectedLang = getBrowserLanguage();
    const resolved = urlLang || (hasSaved ? savedLang : detectedLang) || 'en';

    try {
      localStorage.setItem('sv_lang', resolved);
      if (!localStorage.getItem('sv_lang_source')) {
        localStorage.setItem('sv_lang_source', urlLang ? 'url' : (hasSaved ? 'saved' : 'browser'));
      }
    } catch (_) {}
    return resolved;
  }

  const INITIAL_LANGUAGE = resolveInitialLanguage();

  function updateLanguageControls(lang) {
    const activeLang = normalizeLanguageCode(lang || localStorage.getItem('sv_lang') || INITIAL_LANGUAGE);
    document.documentElement.lang = activeLang;

    document.querySelectorAll('.lang-option, .drawer-lang-btn').forEach(btn => {
      const btnLang = normalizeLanguageCode(btn.getAttribute('data-lang'));
      btn.classList.toggle('active', btnLang === activeLang);
    });

    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.innerHTML = `${LANGUAGE_LABELS[activeLang] || activeLang.toUpperCase()} <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
    }

    const chatLang = document.getElementById('chat-lang');
    if (chatLang && Array.from(chatLang.options).some(option => option.value === activeLang)) {
      chatLang.value = activeLang;
      if (typeof window.changeChatLang === 'function') window.changeChatLang(activeLang);
    }
  }

  function applyPageLanguage(lang) {
    const activeLang = normalizeLanguageCode(lang);
    try { localStorage.setItem('sv_lang', activeLang); } catch (_) {}
    updateLanguageControls(activeLang);

    // index.html currently contains the full demo translation dictionary.
    // Other pages keep the selected/detected language state ready for future i18n keys.
    if (typeof window.applyLang === 'function') {
      window.applyLang(activeLang);
      updateLanguageControls(activeLang);
    }

    applyUnitPreferences(activeLang);
    if (window.SomaVioWeatherSummary) {
      updateTripWeather(window.SomaVioWeatherSummary);
      updateSafetyWeatherCard(window.SomaVioWeatherSummary);
    }
    if (typeof applyLocalRulesTranslations === 'function') {
      applyLocalRulesTranslations(activeLang);
    }
  }

  function hydrateLanguageDetection() {
    applyPageLanguage(localStorage.getItem('sv_lang') || INITIAL_LANGUAGE);

    const langToggle = document.getElementById('lang-toggle');
    const langDropdown = document.getElementById('lang-dropdown');
    const pageNameForLangMenu = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (pageNameForLangMenu === 'local-rules.html' && langToggle && langDropdown && !langToggle.dataset.svLangBound) {
      langToggle.dataset.svLangBound = 'true';
      langToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        langDropdown.classList.toggle('open');
        langToggle.setAttribute('aria-expanded', langDropdown.classList.contains('open'));
      });
      document.addEventListener('click', function () {
        langDropdown.classList.remove('open');
        langToggle.setAttribute('aria-expanded', 'false');
      });
    }

    document.querySelectorAll('.lang-option, .drawer-lang-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const chosen = normalizeLanguageCode(this.getAttribute('data-lang'));
        try {
          localStorage.setItem('sv_lang', chosen);
          localStorage.setItem('sv_lang_source', 'manual');
        } catch (_) {}
        window.setTimeout(() => applyPageLanguage(chosen), 0);
      });
    });
  }

  window.SomaVioLanguage = {
    supported: SUPPORTED_LANGUAGES.slice(),
    detected: getBrowserLanguage(),
    current: function () { return normalizeLanguageCode(localStorage.getItem('sv_lang') || INITIAL_LANGUAGE); },
    units: function () { return unitPolicyForLanguage(localStorage.getItem('sv_lang') || INITIAL_LANGUAGE); },
    apply: applyPageLanguage
  };

  const CACHE_KEY = 'somavio_weather_canmore_v1';
  const CACHE_TTL_MS = 15 * 60 * 1000;

  const SHARED_ALERT = {
    state: 'warning',
    label: '⚠ Wildlife Alert',
    title: 'Grizzly bear activity reported',
    text: 'Grizzly activity reported near Grassi Lakes Trail. Check before heading out.',
    area: 'Grassi Lakes Trail area',
    source: 'Source: Parks Canada — demo scenario',
    sourceUrl: 'https://parks.canada.ca/pn-np/ab/banff/securite-safety/ours-bears',
    action: 'What to do →',
    updated: 'Demo alert synced across SomaVio pages'
  };


  const IMAGE_FALLBACKS = {
    outdoor: 'assets/img/somavio-fallback-outdoor.svg',
    lake: 'assets/img/somavio-fallback-lake.svg',
    cafe: 'assets/img/somavio-fallback-cafe.svg',
    restaurant: 'assets/img/somavio-fallback-restaurant.svg',
    wellness: 'assets/img/somavio-fallback-wellness.svg',
    rental: 'assets/img/somavio-fallback-rental.svg',
    guide: 'assets/img/somavio-fallback-guide.svg',
    indoor: 'assets/img/somavio-fallback-indoor.svg',
    retail: 'assets/img/somavio-fallback-retail.svg',
    shuttle: 'assets/img/somavio-fallback-shuttle.svg',
    museum: 'assets/img/somavio-fallback-museum.svg',
    music: 'assets/img/somavio-fallback-music.svg',
    safety: 'assets/img/somavio-fallback-safety.svg'
  };

  function inferImageFallback(img) {
    const declared = img.getAttribute('data-sv-image');
    if (declared && IMAGE_FALLBACKS[declared]) return declared;

    const text = `${img.getAttribute('alt') || ''} ${img.getAttribute('src') || ''}`.toLowerCase();
    if (/cafe|café|coffee|grind/.test(text)) return 'cafe';
    if (/restaurant|grizzly|dining|food|brewery/.test(text)) return 'restaurant';
    if (/spa|wellness|massage|sauna|pool|thermal|hot spring/.test(text)) return 'wellness';
    if (/rental|rentals|gear|equipment|bike|nordic|snowshoe/.test(text)) return 'rental';
    if (/guide|guided|hiking group|peak/.test(text)) return 'guide';
    if (/climb|climbing|ferrata|rock/.test(text)) return 'indoor';
    if (/retail|makers|souvenir|shop/.test(text)) return 'retail';
    if (/shuttle|transport|coach|bus/.test(text)) return 'shuttle';
    if (/museum|culture|history/.test(text)) return 'museum';
    if (/music|performance|concert/.test(text)) return 'music';
    if (/safety|alert|warning/.test(text)) return 'safety';
    if (/lake|lakes|kayak|kananaskis|mountain|trail|vista|canmore|banff/.test(text)) return 'outdoor';
    return 'outdoor';
  }

  function protectRemoteImages() {
    const images = Array.from(document.querySelectorAll('img'));
    images.forEach(img => {
      img.decoding = img.decoding || 'async';
      if (!img.getAttribute('referrerpolicy')) img.setAttribute('referrerpolicy', 'no-referrer');
      img.addEventListener('error', function () {
        if (img.dataset.svFallbackApplied === 'true') return;
        const key = inferImageFallback(img);
        img.dataset.svFallbackApplied = 'true';
        img.src = IMAGE_FALLBACKS[key] || IMAGE_FALLBACKS.outdoor;
        img.classList.add('sv-image-fallback-active');
      }, { once: true });
    });
  }

  const UNIT_TEXT_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'TEXTAREA', 'INPUT']);

  function applyUnitPreferences(lang) {
    const activeLang = normalizeLanguageCode(lang || localStorage.getItem('sv_lang') || INITIAL_LANGUAGE);
    document.documentElement.setAttribute('data-units', unitPolicyForLanguage(activeLang));

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || UNIT_TEXT_SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-sv-no-unit-convert]')) return NodeFilter.FILTER_REJECT;
        const text = node.__svOriginalUnitText || node.nodeValue || '';
        if (!/(\d+(?:\.\d+)?\+?\s*(km|metres?|meters?)\b)/i.test(text)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      if (!node.__svOriginalUnitText) node.__svOriginalUnitText = node.nodeValue;
      let text = node.__svOriginalUnitText;

      text = text.replace(/(\d+(?:\.\d+)?)(\+?)\s*km\b(?!\s*\/)/gi, function (_, value, plus) {
        return formatDistance(value, 'km', activeLang, plus === '+');
      });

      text = text.replace(/(\d+(?:\.\d+)?)(\+?)\s*(metres?|meters?)\b(?!\s*\/)/gi, function (_, value, plus, unit) {
        return formatDistance(value, unit, activeLang, plus === '+');
      });

      node.nodeValue = text;
    });
  }

  window.SomaVioUnits = {
    policy: unitPolicyForLanguage,
    temperature: formatTemperature,
    distance: formatDistance,
    wind: formatWind,
    apply: applyUnitPreferences
  };

  const WEATHER_CODES = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };

  function formatClock(hour, minute) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
  }

  function formatLocalTime(value) {
    if (!value) return 'time unavailable';

    // Open-Meteo returns local timestamps without an offset when a timezone is supplied.
    // For those values, display the clock exactly as returned instead of converting it.
    if (typeof value === 'string') {
      const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
      if (match) return formatClock(Number(match[1]), Number(match[2]));
    }

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return 'time unavailable';
    return new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: SOMAVIO_LOCATION.timezone
    }).format(date);
  }

  function formatLocalDateTime(value) {
    if (!value) return 'time unavailable';
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return 'time unavailable';
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: SOMAVIO_LOCATION.timezone
    }).format(date);
  }

  function injectLiveStyles() {
    if (document.getElementById('somavio-live-styles')) return;
    const style = document.createElement('style');
    style.id = 'somavio-live-styles';
    style.textContent = `
      .sv-live-note{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(13,148,136,.08);border:1px solid rgba(13,148,136,.18);font-size:12px;line-height:1.45;color:#4A5568;}
      .sv-live-note strong{color:#2C2C2A;}
      .sv-live-pill{display:inline-flex;align-items:center;gap:6px;margin-left:6px;padding:3px 8px;border-radius:999px;background:rgba(13,148,136,.10);color:#0D9488;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;vertical-align:middle;}
      .sv-live-dot{width:6px;height:6px;border-radius:999px;background:#0D9488;display:inline-block;}
      .sv-weather-loading{opacity:.75;}

      .sv-image-fallback-active{background:#1A2B3C;object-fit:cover;}
    `;
    document.head.appendChild(style);
  }

  function warningIconSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  }

  function applySharedSafetyAlert() {
    const bar = document.getElementById('safety-bar');
    if (!bar) return;

    bar.classList.remove('state-info', 'state-warning', 'state-emergency');
    bar.classList.add('state-warning');

    const inner = bar.querySelector('.safety-bar-inner') || bar;
    const hasModal = typeof window.openWildlifeModal === 'function';
    const actionHtml = hasModal
      ? `<button class="safety-action-btn" onclick="openWildlifeModal()" aria-haspopup="dialog">${warningIconSvg()}<span>${SHARED_ALERT.action}</span></button>`
      : `<a href="safety.html" class="safety-link">${SHARED_ALERT.action}</a>`;

    inner.innerHTML = `
      <span class="safety-icon" aria-hidden="true">${warningIconSvg()}</span>
      <span class="safety-text-wrap">
        <span class="safety-bar-label">${SHARED_ALERT.label}</span>
        <span class="safety-text">${SHARED_ALERT.text}</span>
        <span class="safety-source">${SHARED_ALERT.source}</span>
      </span>
      ${actionHtml}
    `;

    const modalTitle = document.getElementById('wm-title');
    if (modalTitle) modalTitle.textContent = SHARED_ALERT.title;

    const modalMeta = document.querySelector('.wm-meta');
    if (modalMeta) {
      modalMeta.innerHTML = `
        <span>${SHARED_ALERT.area}</span>
        <span class="wm-meta-dot"></span>
        <span>${SHARED_ALERT.updated}</span>
        <span class="wm-meta-dot"></span>
        <a class="wm-source" href="${SHARED_ALERT.sourceUrl}" target="_blank" rel="noopener">${SHARED_ALERT.source}</a>
      `;
    }

    const modalBadge = document.querySelector('.wm-alert-badge');
    if (modalBadge) {
      modalBadge.innerHTML = `${warningIconSvg()} Wildlife Alert Active`;
    }

    // Keep the Safety page demo switcher visually aligned with the shared warning state.
    document.querySelectorAll('.state-btn').forEach(btn => {
      const isWarning = /Attention/i.test(btn.textContent || '');
      btn.classList.toggle('active', isWarning);
    });
  }

  function weatherUrl() {
    const params = new URLSearchParams({
      latitude: String(SOMAVIO_LOCATION.latitude),
      longitude: String(SOMAVIO_LOCATION.longitude),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,is_day',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset',
      forecast_days: '3',
      timezone: SOMAVIO_LOCATION.timezone
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  }

  function readWeatherCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !cached.fetchedAt || !cached.data) return null;
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
      return cached.data;
    } catch (_) {
      return null;
    }
  }

  function writeWeatherCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
    } catch (_) {}
  }

  async function fetchWeather() {
    const cached = readWeatherCache();
    if (cached) return { data: cached, cached: true };

    const response = await fetch(weatherUrl(), { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Open-Meteo request failed: ${response.status}`);
    const data = await response.json();
    writeWeatherCache(data);
    return { data, cached: false };
  }

  function getWeatherSummary(data) {
    const current = data && data.current ? data.current : {};
    const daily = data && data.daily ? data.daily : {};
    const code = Number(current.weather_code);
    const condition = WEATHER_CODES[code] || 'Current conditions available';
    const temp = Math.round(Number(current.temperature_2m));
    const feels = Math.round(Number(current.apparent_temperature));
    const wind = Math.round(Number(current.wind_speed_10m));
    const gust = Math.round(Number(current.wind_gusts_10m));
    const humidity = Math.round(Number(current.relative_humidity_2m));
    const high = daily.temperature_2m_max && daily.temperature_2m_max.length ? Math.round(Number(daily.temperature_2m_max[0])) : null;
    const low = daily.temperature_2m_min && daily.temperature_2m_min.length ? Math.round(Number(daily.temperature_2m_min[0])) : null;
    const precip = daily.precipitation_probability_max && daily.precipitation_probability_max.length ? Math.round(Number(daily.precipitation_probability_max[0])) : null;
    const uv = daily.uv_index_max && daily.uv_index_max.length ? Math.round(Number(daily.uv_index_max[0])) : null;
    const sunrise = daily.sunrise && daily.sunrise.length ? formatLocalTime(daily.sunrise[0]) : null;
    const dataTime = current.time ? formatLocalTime(current.time) : 'time unavailable';
    const refreshTime = formatLocalTime(new Date());

    return {
      condition,
      temp: Number.isFinite(temp) ? temp : null,
      feels: Number.isFinite(feels) ? feels : null,
      wind: Number.isFinite(wind) ? wind : null,
      gust: Number.isFinite(gust) ? gust : null,
      humidity: Number.isFinite(humidity) ? humidity : null,
      high,
      low,
      precip,
      uv,
      sunrise,
      dataTime,
      refreshTime
    };
  }

  function updateTripWeather(summary) {
    const tempEl = document.querySelector('.weather-temp');
    const condEl = document.querySelector('.weather-cond');
    const detailEl = document.querySelector('.weather-detail');
    const sourceEl = document.querySelector('.weather-source');
    if (!tempEl && !condEl && !detailEl && !sourceEl) return;

    const lang = normalizeLanguageCode(localStorage.getItem('sv_lang') || INITIAL_LANGUAGE);
    if (tempEl && summary.temp !== null) tempEl.textContent = formatTemperature(summary.temp, lang);
    if (condEl) {
      const range = summary.high !== null && summary.low !== null
        ? ` · H ${formatTemperature(summary.high, lang)} / L ${formatTemperature(summary.low, lang)}`
        : '';
      condEl.textContent = `${summary.condition}${range}`;
    }
    if (detailEl) {
      const pieces = [];
      if (summary.wind !== null) pieces.push(`Wind: ${formatWind(summary.wind, lang)}`);
      if (summary.humidity !== null) pieces.push(`Humidity: ${summary.humidity}%`);
      if (summary.uv !== null) pieces.push(`UV max: ${summary.uv}`);
      if (summary.precip !== null) pieces.push(`Precip: ${summary.precip}%`);
      if (summary.sunrise) pieces.push(`Sunrise: ${summary.sunrise}`);
      detailEl.innerHTML = pieces.map(item => `<span>${item}</span>`).join('');
    }
    if (sourceEl) {
      const unitLabel = unitPolicyForLanguage(lang) === 'dual' ? 'Units: metric + imperial' : 'Units: metric';
      sourceEl.innerHTML = `Source: Open-Meteo Forecast API · ${unitLabel} · Weather data: ${summary.dataTime} · Page updated: ${summary.refreshTime}<span class="sv-live-pill"><span class="sv-live-dot"></span>Live</span>`;
    }
  }

  function updateSafetyWeatherCard(summary) {
    const cards = Array.from(document.querySelectorAll('.check-card'));
    const card = cards.find(el => /Weather\s*&\s*Roads/i.test(el.textContent || ''));
    if (!card) return;

    const lang = normalizeLanguageCode(localStorage.getItem('sv_lang') || INITIAL_LANGUAGE);
    let note = card.querySelector('.sv-live-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'sv-live-note';
      card.appendChild(note);
    }
    const range = summary.high !== null && summary.low !== null
      ? ` H ${formatTemperature(summary.high, lang)} / L ${formatTemperature(summary.low, lang)}`
      : '';
    const wind = summary.wind !== null ? ` · Wind ${formatWind(summary.wind, lang)}` : '';
    const temp = summary.temp !== null ? formatTemperature(summary.temp, lang) : 'available';
    const unitLabel = unitPolicyForLanguage(lang) === 'dual' ? 'metric + imperial' : 'metric';
    note.innerHTML = `<strong>Live Canmore forecast:</strong> ${temp} · ${summary.condition}${range}${wind}<br>Updated: ${summary.refreshTime} · Units: ${unitLabel} · Source: Open-Meteo Forecast API`;
  }

  function applyWeatherFallback(message) {
    const sourceEl = document.querySelector('.weather-source');
    if (sourceEl) {
      sourceEl.textContent = `Weather source temporarily unavailable · ${message}`;
    }
    const cards = Array.from(document.querySelectorAll('.check-card'));
    const card = cards.find(el => /Weather\s*&\s*Roads/i.test(el.textContent || ''));
    if (card && !card.querySelector('.sv-live-note')) {
      const note = document.createElement('div');
      note.className = 'sv-live-note';
      note.innerHTML = '<strong>Live forecast unavailable:</strong> please check the official weather source before departure.';
      card.appendChild(note);
    }
  }

  async function hydrateWeather() {
    const hasWeatherUI = document.querySelector('.weather-temp, .weather-cond, .weather-detail, .weather-source, .check-card');
    if (!hasWeatherUI) return;

    document.body.classList.add('sv-weather-loading');
    try {
      const result = await fetchWeather();
      const summary = getWeatherSummary(result.data);
      window.SomaVioWeatherSummary = summary;
      updateTripWeather(summary);
      updateSafetyWeatherCard(summary);
      applyUnitPreferences(localStorage.getItem('sv_lang') || INITIAL_LANGUAGE);
    } catch (error) {
      applyWeatherFallback('showing saved or static demo values if available');
      if (window.console && console.warn) console.warn('[SomaVio] Weather update failed:', error);
    } finally {
      document.body.classList.remove('sv-weather-loading');
    }
  }



  function injectLocalRulesStyles() {
    if (document.getElementById('sv-local-rules-styles')) return;
    const style = document.createElement('style');
    style.id = 'sv-local-rules-styles';
    style.textContent = `
      .sv-rules-strip{padding:18px 0;background:var(--mist, #F4F1EC);border-top:1px solid rgba(44,44,42,.06);border-bottom:1px solid rgba(44,44,42,.06)}
      .sv-rules-strip-inner{max-width:1280px;margin:0 auto;padding:0 40px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .sv-rule-card{background:var(--white,#fff);border:1px solid rgba(44,44,42,.08);border-left:3px solid var(--amber,#C8923A);border-radius:var(--r-card,8px);box-shadow:var(--shadow-1,0 1px 3px rgba(44,44,42,.08));padding:14px 16px;color:var(--stone,#2C2C2A)}
      .sv-rule-card.sv-risk-red{border-left-color:#A7422C;background:linear-gradient(0deg,rgba(167,66,44,.045),rgba(167,66,44,.045)),var(--white,#fff)}
      .sv-rule-card.sv-risk-amber{border-left-color:var(--amber,#C8923A)}
      .sv-rule-card.sv-risk-blue{border-left-color:var(--sage,#6B7F6E)}
      .sv-rule-eyebrow{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--sage,#6B7F6E);margin-bottom:6px}
      .sv-risk-red .sv-rule-eyebrow{color:#A7422C}.sv-risk-amber .sv-rule-eyebrow{color:var(--amber,#C8923A)}
      .sv-rule-title{font-size:14px;font-weight:800;line-height:1.3;margin-bottom:5px;color:var(--stone,#2C2C2A)}
      .sv-rule-text{font-size:12px;line-height:1.55;color:var(--slate,#4A5568)}
      .sv-rule-link{display:inline-flex;margin-top:9px;font-size:12px;font-weight:700;color:var(--sage,#6B7F6E)}
      .sv-rule-stack{display:flex;flex-direction:column;gap:12px}
      .sv-rule-inline-section{padding:46px 0;background:var(--white,#fff)}
      .sv-rule-section-head{max-width:1280px;margin:0 auto 18px;padding:0 40px;display:flex;align-items:end;justify-content:space-between;gap:16px}
      .sv-rule-section-title{font-family:var(--font-display,Georgia,serif);font-size:28px;font-weight:400;color:var(--stone,#2C2C2A)}
      .sv-rule-section-sub{font-size:14px;color:var(--slate,#4A5568);max-width:640px;line-height:1.6;margin-top:6px}
      .sv-rule-grid{max-width:1280px;margin:0 auto;padding:0 40px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .sv-rule-minor{margin-top:12px;padding-top:12px;border-top:1px solid rgba(44,44,42,.08);font-size:11px;color:var(--slate,#4A5568);line-height:1.45}
      .sv-local-link-pill{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border:1px solid rgba(107,127,110,.28);border-radius:100px;font-size:12px;font-weight:700;color:var(--sage,#6B7F6E);background:rgba(107,127,110,.06)}
      .sv-sidebar-card{background:var(--white,#fff);border-radius:var(--r-card,8px);box-shadow:var(--shadow-1,0 1px 3px rgba(44,44,42,.08));padding:18px;border-left:3px solid #A7422C}
      .sv-sidebar-title{font-size:13px;font-weight:800;color:var(--stone,#2C2C2A);margin-bottom:9px}.sv-sidebar-text{font-size:12px;line-height:1.55;color:var(--slate,#4A5568)}
      @media(max-width:900px){.sv-rules-strip-inner,.sv-rule-grid{grid-template-columns:1fr 1fr}.sv-rule-section-head{align-items:flex-start;flex-direction:column}.sv-rules-strip-inner,.sv-rule-grid,.sv-rule-section-head{padding-left:16px;padding-right:16px}}
      @media(max-width:640px){.sv-rules-strip-inner,.sv-rule-grid{grid-template-columns:1fr}.sv-rule-section-title{font-size:24px}}
    `;
    document.head.appendChild(style);
  }

  const LOCAL_RULES = {
    parkPass: {
      risk: 'amber',
      href: 'https://parks.canada.ca/pn-np/ab/banff/visit/passer-passes',
      copy: {
        en: { label: 'Park pass check', title: 'Banff National Park may require a valid pass', text: 'Check Parks Canada before entering Banff or Lake Louise. Free-admission periods and pass rules can change by date.' },
        pt: { label: 'Verifique o park pass', title: 'Banff National Park pode exigir um passe válido', text: 'Verifique a Parks Canada antes de entrar em Banff ou Lake Louise. Períodos de entrada gratuita e regras de passe podem mudar conforme a data.' },
        es: { label: 'Verifica el pase del parque', title: 'Banff National Park puede exigir un pase válido', text: 'Consulta Parks Canada antes de entrar a Banff o Lake Louise. Los periodos de entrada gratuita y las reglas del pase pueden cambiar según la fecha.' },
        fr: { label: 'Vérifiez le laissez-passer', title: 'Banff National Park peut exiger un laissez-passer valide', text: 'Vérifiez Parks Canada avant d’entrer à Banff ou Lake Louise. Les périodes d’entrée gratuite et les règles de laissez-passer peuvent changer selon la date.' },
        ja: { label: 'パークパス確認', title: 'Banff National Park では有効なパスが必要な場合があります', text: 'Banff または Lake Louise に入る前に Parks Canada を確認してください。無料入場期間やパスの規則は日付によって変わる場合があります。' },
        ko: { label: '공원 패스 확인', title: 'Banff National Park 입장에는 유효한 패스가 필요할 수 있습니다', text: 'Banff 또는 Lake Louise에 들어가기 전에 Parks Canada를 확인하세요. 무료 입장 기간과 패스 규정은 날짜에 따라 달라질 수 있습니다.' }
      }
    },
    drone: {
      risk: 'red',
      href: 'https://parks.canada.ca/pn-np/ab/banff/info/permis-permit/drone',
      copy: {
        en: { label: 'Fine risk', title: 'Recreational drones are not allowed in Banff National Park', text: 'Flying without authorization can lead to enforcement action and fines up to CAD $25,000.' },
        pt: { label: 'Risco de multa', title: 'Drones recreativos não são permitidos em Banff National Park', text: 'Voar sem autorização pode gerar ação de fiscalização e multas de até CAD $25.000.' },
        es: { label: 'Riesgo de multa', title: 'Los drones recreativos no están permitidos en Banff National Park', text: 'Volar sin autorización puede causar medidas de fiscalización y multas de hasta CAD $25.000.' },
        fr: { label: 'Risque d’amende', title: 'Les drones récréatifs ne sont pas autorisés dans Banff National Park', text: 'Voler sans autorisation peut entraîner des mesures d’application de la loi et des amendes pouvant atteindre 25 000 $ CAD.' },
        ja: { label: '罰金リスク', title: 'Banff National Park ではレクリエーション用ドローンは禁止されています', text: '許可なく飛行すると、取り締まりや最大 CAD $25,000 の罰金につながる可能性があります。' },
        ko: { label: '벌금 위험', title: 'Banff National Park에서는 레크리에이션용 드론이 허용되지 않습니다', text: '허가 없이 비행하면 단속 조치와 최대 CAD $25,000의 벌금이 부과될 수 있습니다.' }
      }
    },
    wildlife: {
      risk: 'red',
      href: 'https://parks.canada.ca/pn-np/ab/banff/visit/faune-wildlife/nourriture-food',
      copy: {
        en: { label: 'Fine risk', title: 'Do not feed, approach or disturb wildlife', text: 'Feeding, enticing or disturbing wildlife in a national park is illegal and can lead to court and fines up to CAD $25,000.' },
        pt: { label: 'Risco de multa', title: 'Não alimente, aproxime-se ou perturbe animais selvagens', text: 'Alimentar, atrair ou perturbar animais selvagens em um parque nacional é ilegal e pode levar a comparecimento à corte e multas de até CAD $25.000.' },
        es: { label: 'Riesgo de multa', title: 'No alimentes, te acerques ni molestes a la fauna silvestre', text: 'Alimentar, atraer o molestar a la fauna silvestre en un parque nacional es ilegal y puede llevar a una comparecencia judicial y multas de hasta CAD $25.000.' },
        fr: { label: 'Risque d’amende', title: 'Ne nourrissez pas, n’approchez pas et ne dérangez pas les animaux sauvages', text: 'Nourrir, attirer ou déranger la faune dans un parc national est illégal et peut entraîner une comparution au tribunal et des amendes pouvant atteindre 25 000 $ CAD.' },
        ja: { label: '罰金リスク', title: '野生動物に餌を与えたり、近づいたり、邪魔したりしないでください', text: '国立公園で野生動物に餌を与える、誘う、または邪魔する行為は違法で、裁判所への出頭や最大 CAD $25,000 の罰金につながる可能性があります。' },
        ko: { label: '벌금 위험', title: '야생동물에게 먹이를 주거나 접근하거나 방해하지 마세요', text: '국립공원에서 야생동물에게 먹이를 주거나 유인하거나 방해하는 것은 불법이며 법원 출석 및 최대 CAD $25,000의 벌금으로 이어질 수 있습니다.' }
      }
    },
    adultRules: {
      risk: 'amber', href: 'local-rules.html#age-restricted',
      copy: {
        en: { label: '18+ local law', title: 'Alcohol and cannabis rules vary by exact place', text: 'Do not assume public use is allowed. Follow town, campground, hotel and Parks Canada rules. This is legal-awareness information only.' },
        pt: { label: 'Lei local 18+', title: 'Regras sobre álcool e cannabis variam conforme o local exato', text: 'Não presuma que o uso em público é permitido. Siga as regras da cidade, campground, hotel e Parks Canada. Esta informação é apenas orientação legal básica.' },
        es: { label: 'Ley local 18+', title: 'Las reglas sobre alcohol y cannabis varían según el lugar exacto', text: 'No asumas que el uso público está permitido. Sigue las reglas de la ciudad, campground, hotel y Parks Canada. Esta información es solo de orientación legal básica.' },
        fr: { label: 'Loi locale 18+', title: 'Les règles sur l’alcool et le cannabis varient selon l’endroit exact', text: 'Ne présumez pas que l’usage public est permis. Suivez les règles de la ville, du camping, de l’hôtel et de Parks Canada. Ces informations servent uniquement à comprendre les règles locales.' },
        ja: { label: '18歳以上の地域ルール', title: 'アルコールと cannabis の規則は場所によって異なります', text: '公共の場での使用が許可されているとは限りません。町、キャンプ場、ホテル、Parks Canada の規則に従ってください。これは法律面の注意喚起のみです。' },
        ko: { label: '18세 이상 현지 법규', title: '알코올과 cannabis 규정은 정확한 장소에 따라 다릅니다', text: '공공장소 사용이 허용된다고 가정하지 마세요. 도시, 캠프장, 호텔, Parks Canada 규정을 따르세요. 이 정보는 법적 인식을 위한 안내일 뿐입니다.' }
      }
    },
    tipping: {
      risk: 'blue', href: 'local-rules.html#restaurants',
      copy: {
        en: { label: 'Local culture', title: 'Tipping is common in sit-down restaurants', text: 'Many visitors leave a tip when service is good. Counter-service tips are usually optional and payment screens may offer preset choices.' },
        pt: { label: 'Cultura local', title: 'Gorjeta é comum em restaurantes com serviço à mesa', text: 'Muitos visitantes deixam gorjeta quando o serviço é bom. Em atendimento no balcão, a gorjeta geralmente é opcional, mesmo quando a tela de pagamento oferece opções prontas.' },
        es: { label: 'Cultura local', title: 'La propina es común en restaurantes con servicio de mesa', text: 'Muchos visitantes dejan propina cuando el servicio es bueno. En atención de mostrador, la propina suele ser opcional aunque la pantalla de pago muestre opciones predeterminadas.' },
        fr: { label: 'Culture locale', title: 'Le pourboire est courant dans les restaurants avec service à table', text: 'Beaucoup de visiteurs laissent un pourboire lorsque le service est bon. Au comptoir, le pourboire est généralement facultatif, même si l’écran de paiement propose des options.' },
        ja: { label: '地域文化', title: 'テーブルサービスのレストランではチップが一般的です', text: 'サービスが良い場合、多くの人がチップを残します。カウンターサービスでは、支払い画面に選択肢が表示されても通常は任意です。' },
        ko: { label: '현지 문화', title: '테이블 서비스 레스토랑에서는 팁이 일반적입니다', text: '서비스가 좋을 때 많은 방문객이 팁을 남깁니다. 카운터 서비스 팁은 보통 선택 사항이며 결제 화면에 미리 설정된 옵션이 표시될 수 있습니다.' }
      }
    },
    tax: {
      risk: 'blue', href: 'local-rules.html#restaurants',
      copy: {
        en: { label: 'Local basics', title: 'Listed prices may not include tax', text: 'The final checkout amount can be higher than the shelf, menu or service price shown.' },
        pt: { label: 'Básico local', title: 'Os preços exibidos podem não incluir impostos', text: 'O valor final no pagamento pode ser maior do que o preço mostrado no menu, prateleira ou serviço.' },
        es: { label: 'Básico local', title: 'Los precios mostrados pueden no incluir impuestos', text: 'El total final puede ser más alto que el precio del menú, estante o servicio mostrado.' },
        fr: { label: 'Notion locale', title: 'Les prix affichés peuvent ne pas inclure les taxes', text: 'Le montant final au paiement peut être plus élevé que le prix affiché au menu, en rayon ou pour le service.' },
        ja: { label: '地域の基本', title: '表示価格に税金が含まれていない場合があります', text: '会計時の合計金額は、メニュー、棚、サービスに表示された価格より高くなる場合があります。' },
        ko: { label: '현지 기본 정보', title: '표시 가격에 세금이 포함되지 않을 수 있습니다', text: '최종 결제 금액은 메뉴, 진열대 또는 서비스에 표시된 가격보다 높을 수 있습니다.' }
      }
    },
    parking: {
      risk: 'amber', href: 'local-rules.html#transport',
      copy: {
        en: { label: 'Check first', title: 'Parking can fill early in Banff and Lake Louise', text: 'Check official parking or transit options before leaving, especially on weekends and holidays.' },
        pt: { label: 'Verifique antes', title: 'Estacionamentos podem lotar cedo em Banff e Lake Louise', text: 'Confira opções oficiais de estacionamento ou transporte antes de sair, especialmente em fins de semana e feriados.' },
        es: { label: 'Verifica antes', title: 'El estacionamiento puede llenarse temprano en Banff y Lake Louise', text: 'Consulta opciones oficiales de estacionamiento o transporte antes de salir, especialmente en fines de semana y feriados.' },
        fr: { label: 'Vérifiez d’abord', title: 'Le stationnement peut se remplir tôt à Banff et Lake Louise', text: 'Vérifiez les options officielles de stationnement ou de transport avant de partir, surtout les fins de semaine et les jours fériés.' },
        ja: { label: '事前確認', title: 'Banff と Lake Louise の駐車場は早い時間に満車になることがあります', text: '出発前に、特に週末や祝日は公式の駐車場情報や公共交通機関を確認してください。' },
        ko: { label: '먼저 확인', title: 'Banff와 Lake Louise 주차장은 일찍 만차가 될 수 있습니다', text: '특히 주말과 공휴일에는 출발 전에 공식 주차 또는 대중교통 옵션을 확인하세요.' }
      }
    },
    rental: {
      risk: 'blue', href: 'local-rules.html#rentals',
      copy: {
        en: { label: 'Before you go', title: 'Rentals may require ID, credit card or deposit', text: 'Check pickup time, return time and deposit requirements before arriving.' },
        pt: { label: 'Antes de ir', title: 'Aluguéis podem exigir documento, cartão de crédito ou depósito', text: 'Verifique horário de retirada, devolução e exigências de depósito antes de chegar.' },
        es: { label: 'Antes de ir', title: 'Los alquileres pueden exigir identificación, tarjeta de crédito o depósito', text: 'Verifica horario de retiro, devolución y requisitos de depósito antes de llegar.' },
        fr: { label: 'Avant de partir', title: 'Les locations peuvent exiger une pièce d’identité, une carte de crédit ou un dépôt', text: 'Vérifiez l’heure de prise en charge, l’heure de retour et les exigences de dépôt avant d’arriver.' },
        ja: { label: '出発前に', title: 'レンタルには身分証明書、クレジットカード、またはデポジットが必要な場合があります', text: '到着前に受け取り時間、返却時間、デポジット条件を確認してください。' },
        ko: { label: '가기 전에', title: '렌털에는 신분증, 신용카드 또는 보증금이 필요할 수 있습니다', text: '도착 전에 픽업 시간, 반납 시간, 보증금 요건을 확인하세요.' }
      }
    },
    shuttle: {
      risk: 'blue', href: 'local-rules.html#transport',
      copy: {
        en: { label: 'Before pickup', title: 'Arrive early for shuttles and tours', text: 'Mountain transport schedules can be strict. Confirm pickup point, time and cancellation rules before departure.' },
        pt: { label: 'Antes do embarque', title: 'Chegue cedo para shuttles e tours', text: 'Horários de transporte nas montanhas podem ser rígidos. Confirme ponto de embarque, horário e regras de cancelamento antes de sair.' },
        es: { label: 'Antes del pickup', title: 'Llega temprano para shuttles y tours', text: 'Los horarios de transporte de montaña pueden ser estrictos. Confirma punto de recogida, hora y reglas de cancelación antes de salir.' },
        fr: { label: 'Avant la prise en charge', title: 'Arrivez tôt pour les navettes et les tours', text: 'Les horaires de transport en montagne peuvent être stricts. Confirmez le point de prise en charge, l’heure et les règles d’annulation avant de partir.' },
        ja: { label: 'ピックアップ前', title: 'シャトルやツアーには早めに到着してください', text: '山岳地域の交通スケジュールは厳密な場合があります。出発前に集合場所、時間、キャンセル規則を確認してください。' },
        ko: { label: '픽업 전', title: '셔틀과 투어에는 일찍 도착하세요', text: '산악 지역 교통 일정은 엄격할 수 있습니다. 출발 전에 픽업 장소, 시간, 취소 규정을 확인하세요.' }
      }
    },
    wellness: {
      risk: 'blue', href: 'local-rules.html#wellness',
      copy: {
        en: { label: 'Local etiquette', title: 'Wellness spaces are usually quiet', text: 'Keep voices low and check phone, photo and cancellation policies before your appointment.' },
        pt: { label: 'Etiqueta local', title: 'Espaços de wellness costumam ser silenciosos', text: 'Fale baixo e confira regras de celular, fotos e cancelamento antes do horário marcado.' },
        es: { label: 'Etiqueta local', title: 'Los espacios de wellness suelen ser silenciosos', text: 'Habla bajo y revisa reglas sobre teléfono, fotos y cancelación antes de tu cita.' },
        fr: { label: 'Étiquette locale', title: 'Les espaces bien-être sont généralement calmes', text: 'Parlez doucement et vérifiez les règles sur le téléphone, les photos et l’annulation avant votre rendez-vous.' },
        ja: { label: '地域のマナー', title: 'ウェルネス施設は静かな空間であることが一般的です', text: '声を控えめにし、予約前に携帯電話、写真、キャンセルポリシーを確認してください。' },
        ko: { label: '현지 에티켓', title: '웰니스 공간은 보통 조용한 환경입니다', text: '목소리를 낮추고 예약 전에 휴대폰, 사진, 취소 정책을 확인하세요.' }
      }
    }
  };

  const LOCAL_RULE_UI = {
    en: {
      viewRule: 'View rule →', openRules: 'Open Local Rules →', reviewRules: 'Review Local Rules →', moreRules: 'More local rules →', officialSource: 'Official source →',
      sectionTitle: 'Local rules that can prevent fines', sectionSub: 'Quick checks for common visitor mistakes: passes, drones, wildlife, public-use rules and other local restrictions. Always follow the official source.',
      sidebarTitle: 'Fine-risk checks before leaving', sidebarText: 'Park pass, drone, wildlife and public-use rules can affect today’s plan.',
      beforeGo: 'Before you go', partnerText: 'Useful local context for this experience.'
    },
    pt: {
      viewRule: 'Ver regra →', openRules: 'Abrir regras locais →', reviewRules: 'Revisar regras locais →', moreRules: 'Mais regras locais →', officialSource: 'Fonte oficial →',
      sectionTitle: 'Regras locais que podem evitar multas', sectionSub: 'Verificações rápidas para erros comuns de visitantes: passes, drones, vida selvagem, uso em espaços públicos e outras restrições locais. Sempre siga a fonte oficial.',
      sidebarTitle: 'Riscos de multa antes de sair', sidebarText: 'Park pass, drone, vida selvagem e regras de uso público podem afetar o plano de hoje.',
      beforeGo: 'Antes de ir', partnerText: 'Contexto local útil para esta experiência.'
    },
    es: {
      viewRule: 'Ver regla →', openRules: 'Abrir reglas locales →', reviewRules: 'Revisar reglas locales →', moreRules: 'Más reglas locales →', officialSource: 'Fuente oficial →',
      sectionTitle: 'Reglas locales que pueden evitar multas', sectionSub: 'Verificaciones rápidas para errores comunes de visitantes: pases, drones, fauna silvestre, uso en espacios públicos y otras restricciones locales. Sigue siempre la fuente oficial.',
      sidebarTitle: 'Riesgos de multa antes de salir', sidebarText: 'El pase del parque, drones, fauna silvestre y reglas de uso público pueden afectar el plan de hoy.',
      beforeGo: 'Antes de ir', partnerText: 'Contexto local útil para esta experiencia.'
    },
    fr: {
      viewRule: 'Voir la règle →', openRules: 'Ouvrir les règles locales →', reviewRules: 'Vérifier les règles locales →', moreRules: 'Plus de règles locales →', officialSource: 'Source officielle →',
      sectionTitle: 'Règles locales qui peuvent éviter des amendes', sectionSub: 'Vérifications rapides pour les erreurs courantes des visiteurs : laissez-passer, drones, faune, usage dans les espaces publics et autres restrictions locales. Suivez toujours la source officielle.',
      sidebarTitle: 'Risques d’amende avant de partir', sidebarText: 'Le laissez-passer, les drones, la faune et les règles d’usage public peuvent affecter le plan du jour.',
      beforeGo: 'Avant de partir', partnerText: 'Contexte local utile pour cette expérience.'
    },
    ja: {
      viewRule: '規則を見る →', openRules: '地域ルールを開く →', reviewRules: '地域ルールを確認 →', moreRules: 'その他の地域ルール →', officialSource: '公式情報 →',
      sectionTitle: '罰金を防ぐための地域ルール', sectionSub: '訪問者が間違えやすいポイントを簡単に確認できます：パークパス、ドローン、野生動物、公共スペースでの利用ルール、その他の地域制限。必ず公式情報に従ってください。',
      sidebarTitle: '出発前の罰金リスク確認', sidebarText: 'パークパス、ドローン、野生動物、公共スペースのルールは今日の予定に影響する場合があります。',
      beforeGo: '出発前に', partnerText: 'この体験に役立つ地域情報です。'
    },
    ko: {
      viewRule: '규정 보기 →', openRules: '현지 규정 열기 →', reviewRules: '현지 규정 확인 →', moreRules: '더 많은 현지 규정 →', officialSource: '공식 출처 →',
      sectionTitle: '벌금을 예방할 수 있는 현지 규정', sectionSub: '방문객이 자주 실수하는 항목을 빠르게 확인하세요: 공원 패스, 드론, 야생동물, 공공장소 이용 규정 및 기타 현지 제한. 항상 공식 출처를 따르세요.',
      sidebarTitle: '출발 전 벌금 위험 확인', sidebarText: '공원 패스, 드론, 야생동물, 공공장소 이용 규정이 오늘의 계획에 영향을 줄 수 있습니다.',
      beforeGo: '가기 전에', partnerText: '이 경험에 유용한 현지 정보입니다.'
    }
  };

  const LOCAL_RULE_PAGE_COPY = {
    en: {
      docTitle: 'SomaVio | Local Rules & Fine Risks', metaDescription: 'Local rules, fine risks and cultural basics for visitors in Canmore, Banff and Kananaskis.',
      context: 'Canmore · Banff · Kananaskis · Local Rules', navExplore: 'Explore', navCategories: 'Categories', navTrip: 'Plan Your Day', navSafety: 'Safety', navLocalRules: 'Local Rules',
      heroKicker: 'Know before you go', heroTitle: 'Local rules that can prevent fines, confusion and avoidable problems.', heroSub: 'A practical visitor layer for park passes, drones, wildlife, parking, local etiquette and age-restricted laws. SomaVio links back to official sources and does not replace posted signs or public authorities.', heroNote: 'Fine amounts are shown only when a public official source states them clearly.',
      fineTitle: 'High-priority fine risks', fineSub: 'These are common visitor mistakes that can create real problems in Banff National Park, Canmore or Kananaskis.',
      ageTitle: 'Age-restricted local laws — 18+', ageSub: 'This section is for legal-awareness only. SomaVio does not promote alcohol or cannabis and does not provide purchasing guidance.', alcoholLabel: 'Restricted local law', alcoholTitle: 'Public alcohol or cannabis use', alcoholText: 'Rules vary by exact place: town, hotel, campground, trail, event area or national park land. Do not assume public use is allowed. Follow posted signs and official local rules.', drivingLabel: 'Safety rule', drivingTitle: 'Driving and public spaces', drivingText: 'Never drive after alcohol or cannabis use. Hotels, shuttles, campgrounds and public areas may have stricter rules than visitors expect.',
      restaurantsTitle: 'Restaurants, cafés and shops', reservationsLabel: 'Before you go', reservationsTitle: 'Reservations and timing', reservationsText: 'Popular restaurants can fill early on weekends and holidays. Kitchens in mountain towns may close earlier than visitors expect.',
      transportTitle: 'Transport, parking and timed activities', wellnessTitle: 'Wellness and private spaces', wellnessNote: 'Spas, hotel services and private businesses may have quiet-space expectations, photo/phone rules and cancellation policies. SomaVio should show these as gentle microtips after the visitor has clicked the main CTA.',
      footerVisitors: 'For Visitors', footerPartners: 'For Partners', footerLegal: 'Legal', footerTagline: 'Local guidance for Alberta.', footerExplore: 'Explore', footerCategories: 'Categories', footerTrip: 'Plan Your Day', footerSafety: 'Safety', footerLocalRules: 'Local Rules', footerHotels: 'For Hotels', footerBusinesses: 'For Local Businesses', footerOrganizations: 'For Organizations', footerStudio: 'Partner Studio', footerMessage: 'SomaVio complements existing systems. It does not replace PMS, OTA or emergency procedures.', footerPrivacy: 'Privacy Policy', footerTerms: 'Terms of Use', footerContact: 'Contact'
    },
    pt: {
      docTitle: 'SomaVio | Regras locais e riscos de multa', metaDescription: 'Regras locais, riscos de multa e noções culturais para visitantes em Canmore, Banff e Kananaskis.',
      context: 'Canmore · Banff · Kananaskis · Regras locais', navExplore: 'Explorar', navCategories: 'Categorias', navTrip: 'Planejar o dia', navSafety: 'Segurança', navLocalRules: 'Regras locais',
      heroKicker: 'Saiba antes de ir', heroTitle: 'Regras locais que podem evitar multas, confusão e problemas desnecessários.', heroSub: 'Uma camada prática para visitantes sobre park passes, drones, vida selvagem, estacionamento, etiqueta local e leis para maiores de 18 anos. O SomaVio aponta para fontes oficiais e não substitui placas, avisos ou autoridades públicas.', heroNote: 'Valores de multa só são exibidos quando uma fonte pública oficial informa claramente.',
      fineTitle: 'Riscos de multa de alta prioridade', fineSub: 'Erros comuns de visitantes que podem gerar problemas reais em Banff National Park, Canmore ou Kananaskis.',
      ageTitle: 'Leis locais para maiores de 18 anos', ageSub: 'Esta seção é apenas para conscientização legal. O SomaVio não promove álcool ou cannabis e não fornece orientação de compra.', alcoholLabel: 'Lei local restrita', alcoholTitle: 'Uso público de álcool ou cannabis', alcoholText: 'As regras variam conforme o local exato: cidade, hotel, campground, trilha, área de evento ou área de parque nacional. Não presuma que o uso público é permitido. Siga placas e regras oficiais locais.', drivingLabel: 'Regra de segurança', drivingTitle: 'Direção e espaços públicos', drivingText: 'Nunca dirija após usar álcool ou cannabis. Hotéis, shuttles, campgrounds e áreas públicas podem ter regras mais rígidas do que visitantes esperam.',
      restaurantsTitle: 'Restaurantes, cafés e lojas', reservationsLabel: 'Antes de ir', reservationsTitle: 'Reservas e horários', reservationsText: 'Restaurantes populares podem lotar cedo em fins de semana e feriados. Cozinhas em cidades de montanha podem fechar mais cedo do que visitantes esperam.',
      transportTitle: 'Transporte, estacionamento e atividades com horário', wellnessTitle: 'Wellness e espaços privados', wellnessNote: 'Spas, serviços de hotel e negócios privados podem ter expectativas de silêncio, regras de telefone/foto e políticas de cancelamento. O SomaVio deve mostrar isso como microdicas gentis depois que o visitante clicar no CTA principal.',
      footerVisitors: 'Para visitantes', footerPartners: 'Para parceiros', footerLegal: 'Legal', footerTagline: 'Orientação local para Alberta.', footerExplore: 'Explorar', footerCategories: 'Categorias', footerTrip: 'Planejar o dia', footerSafety: 'Segurança', footerLocalRules: 'Regras locais', footerHotels: 'Para hotéis', footerBusinesses: 'Para negócios locais', footerOrganizations: 'Para organizações', footerStudio: 'Partner Studio', footerMessage: 'O SomaVio complementa sistemas existentes. Não substitui PMS, OTA ou procedimentos de emergência.', footerPrivacy: 'Política de privacidade', footerTerms: 'Termos de uso', footerContact: 'Contato'
    },
    es: {
      docTitle: 'SomaVio | Reglas locales y riesgos de multa', metaDescription: 'Reglas locales, riesgos de multa y nociones culturales para visitantes en Canmore, Banff y Kananaskis.',
      context: 'Canmore · Banff · Kananaskis · Reglas locales', navExplore: 'Explorar', navCategories: 'Categorías', navTrip: 'Planificar el día', navSafety: 'Seguridad', navLocalRules: 'Reglas locales',
      heroKicker: 'Infórmate antes de salir', heroTitle: 'Reglas locales que pueden evitar multas, confusión y problemas innecesarios.', heroSub: 'Una capa práctica para visitantes sobre pases del parque, drones, fauna silvestre, estacionamiento, etiqueta local y leyes para mayores de 18 años. SomaVio enlaza a fuentes oficiales y no reemplaza señales, avisos ni autoridades públicas.', heroNote: 'Los valores de multa solo se muestran cuando una fuente pública oficial los indica claramente.',
      fineTitle: 'Riesgos de multa de alta prioridad', fineSub: 'Errores comunes de visitantes que pueden crear problemas reales en Banff National Park, Canmore o Kananaskis.',
      ageTitle: 'Leyes locales para mayores de 18 años', ageSub: 'Esta sección es solo de concientización legal. SomaVio no promueve alcohol ni cannabis y no ofrece orientación de compra.', alcoholLabel: 'Ley local restringida', alcoholTitle: 'Uso público de alcohol o cannabis', alcoholText: 'Las reglas varían según el lugar exacto: ciudad, hotel, campground, sendero, área de evento o terreno de parque nacional. No asumas que el uso público está permitido. Sigue las señales y reglas oficiales locales.', drivingLabel: 'Regla de seguridad', drivingTitle: 'Conducción y espacios públicos', drivingText: 'Nunca conduzcas después de usar alcohol o cannabis. Hoteles, shuttles, campgrounds y áreas públicas pueden tener reglas más estrictas de lo esperado.',
      restaurantsTitle: 'Restaurantes, cafés y tiendas', reservationsLabel: 'Antes de ir', reservationsTitle: 'Reservas y horarios', reservationsText: 'Los restaurantes populares pueden llenarse temprano en fines de semana y feriados. Las cocinas en pueblos de montaña pueden cerrar antes de lo esperado.',
      transportTitle: 'Transporte, estacionamiento y actividades con horario', wellnessTitle: 'Wellness y espacios privados', wellnessNote: 'Spas, servicios de hotel y negocios privados pueden tener expectativas de silencio, reglas de teléfono/fotos y políticas de cancelación. SomaVio debe mostrar esto como microconsejos suaves después de que el visitante haga clic en el CTA principal.',
      footerVisitors: 'Para visitantes', footerPartners: 'Para socios', footerLegal: 'Legal', footerTagline: 'Orientación local para Alberta.', footerExplore: 'Explorar', footerCategories: 'Categorías', footerTrip: 'Planificar el día', footerSafety: 'Seguridad', footerLocalRules: 'Reglas locales', footerHotels: 'Para hoteles', footerBusinesses: 'Para negocios locales', footerOrganizations: 'Para organizaciones', footerStudio: 'Partner Studio', footerMessage: 'SomaVio complementa los sistemas existentes. No reemplaza PMS, OTA ni procedimientos de emergencia.', footerPrivacy: 'Política de privacidad', footerTerms: 'Términos de uso', footerContact: 'Contacto'
    },
    fr: {
      docTitle: 'SomaVio | Règles locales et risques d’amende', metaDescription: 'Règles locales, risques d’amende et notions culturelles pour les visiteurs à Canmore, Banff et Kananaskis.',
      context: 'Canmore · Banff · Kananaskis · Règles locales', navExplore: 'Explorer', navCategories: 'Catégories', navTrip: 'Planifier la journée', navSafety: 'Sécurité', navLocalRules: 'Règles locales',
      heroKicker: 'À savoir avant de partir', heroTitle: 'Des règles locales qui peuvent éviter des amendes, de la confusion et des problèmes évitables.', heroSub: 'Une couche pratique pour les visiteurs sur les laissez-passer, les drones, la faune, le stationnement, l’étiquette locale et les lois réservées aux adultes. SomaVio renvoie aux sources officielles et ne remplace pas les panneaux, les avis ni les autorités publiques.', heroNote: 'Les montants d’amende ne sont affichés que lorsqu’une source publique officielle les indique clairement.',
      fineTitle: 'Risques d’amende prioritaires', fineSub: 'Des erreurs courantes de visiteurs qui peuvent créer de vrais problèmes à Banff National Park, Canmore ou Kananaskis.',
      ageTitle: 'Lois locales réservées aux adultes — 18+', ageSub: 'Cette section sert uniquement à comprendre les règles locales. SomaVio ne fait pas la promotion de l’alcool ou du cannabis et ne fournit pas de conseils d’achat.', alcoholLabel: 'Loi locale restreinte', alcoholTitle: 'Usage public d’alcool ou de cannabis', alcoholText: 'Les règles varient selon l’endroit exact : ville, hôtel, camping, sentier, zone d’événement ou terrain de parc national. Ne présumez pas que l’usage public est autorisé. Suivez les panneaux et les règles officielles locales.', drivingLabel: 'Règle de sécurité', drivingTitle: 'Conduite et espaces publics', drivingText: 'Ne conduisez jamais après avoir consommé de l’alcool ou du cannabis. Les hôtels, navettes, campings et espaces publics peuvent avoir des règles plus strictes que prévu.',
      restaurantsTitle: 'Restaurants, cafés et boutiques', reservationsLabel: 'Avant de partir', reservationsTitle: 'Réservations et horaires', reservationsText: 'Les restaurants populaires peuvent se remplir tôt les fins de semaine et les jours fériés. Les cuisines dans les villes de montagne peuvent fermer plus tôt que prévu.',
      transportTitle: 'Transport, stationnement et activités à horaire fixe', wellnessTitle: 'Bien-être et espaces privés', wellnessNote: 'Les spas, services d’hôtel et entreprises privées peuvent avoir des attentes de calme, des règles sur les téléphones/photos et des politiques d’annulation. SomaVio devrait les présenter comme des microconseils discrets après le clic sur le CTA principal.',
      footerVisitors: 'Pour les visiteurs', footerPartners: 'Pour les partenaires', footerLegal: 'Légal', footerTagline: 'Orientation locale pour l’Alberta.', footerExplore: 'Explorer', footerCategories: 'Catégories', footerTrip: 'Planifier la journée', footerSafety: 'Sécurité', footerLocalRules: 'Règles locales', footerHotels: 'Pour les hôtels', footerBusinesses: 'Pour les entreprises locales', footerOrganizations: 'Pour les organisations', footerStudio: 'Partner Studio', footerMessage: 'SomaVio complète les systèmes existants. Il ne remplace pas les PMS, OTA ni les procédures d’urgence.', footerPrivacy: 'Politique de confidentialité', footerTerms: 'Conditions d’utilisation', footerContact: 'Contact'
    },
    ja: {
      docTitle: 'SomaVio | 地域ルールと罰金リスク', metaDescription: 'Canmore、Banff、Kananaskis を訪れる人のための地域ルール、罰金リスク、文化的な基本情報。',
      context: 'Canmore · Banff · Kananaskis · 地域ルール', navExplore: '探す', navCategories: 'カテゴリ', navTrip: '今日の計画', navSafety: '安全情報', navLocalRules: '地域ルール',
      heroKicker: '出発前に知る', heroTitle: '罰金、混乱、避けられるトラブルを防ぐための地域ルール。', heroSub: 'パークパス、ドローン、野生動物、駐車、地域マナー、18歳以上に関する法律をわかりやすく整理した訪問者向けの情報です。SomaVio は公式情報へリンクし、掲示、標識、公的機関の案内を置き換えるものではありません。', heroNote: '罰金額は、公的な公式情報で明確に示されている場合のみ表示します。',
      fineTitle: '優先度の高い罰金リスク', fineSub: 'Banff National Park、Canmore、Kananaskis で実際の問題につながりやすい訪問者の一般的なミスです。',
      ageTitle: '18歳以上の地域ルール', ageSub: 'このセクションは法律面の注意喚起のみです。SomaVio はアルコールや cannabis を促進せず、購入案内も行いません。', alcoholLabel: '制限のある地域ルール', alcoholTitle: '公共の場でのアルコールまたは cannabis の使用', alcoholText: '規則は町、ホテル、キャンプ場、トレイル、イベントエリア、国立公園の土地など、正確な場所によって異なります。公共の場で許可されているとは考えず、掲示と公式の地域ルールに従ってください。', drivingLabel: '安全ルール', drivingTitle: '運転と公共スペース', drivingText: 'アルコールまたは cannabis 使用後は絶対に運転しないでください。ホテル、シャトル、キャンプ場、公共エリアには、想像より厳しい規則がある場合があります。',
      restaurantsTitle: 'レストラン、カフェ、ショップ', reservationsLabel: '出発前に', reservationsTitle: '予約と営業時間', reservationsText: '週末や祝日は人気レストランが早く満席になることがあります。山岳エリアの町では、キッチンが予想より早く閉まる場合があります。',
      transportTitle: '交通、駐車、時間指定のアクティビティ', wellnessTitle: 'ウェルネスとプライベート空間', wellnessNote: 'スパ、ホテルサービス、民間施設では、静かな環境、写真・携帯電話のルール、キャンセルポリシーがある場合があります。SomaVio では、訪問者がメインCTAをクリックした後に、控えめなマイクロヒントとして表示するのが適切です。',
      footerVisitors: '訪問者向け', footerPartners: 'パートナー向け', footerLegal: '法務', footerTagline: 'Alberta のための地域ガイダンス。', footerExplore: '探す', footerCategories: 'カテゴリ', footerTrip: '今日の計画', footerSafety: '安全情報', footerLocalRules: '地域ルール', footerHotels: 'ホテル向け', footerBusinesses: '地域ビジネス向け', footerOrganizations: '組織向け', footerStudio: 'Partner Studio', footerMessage: 'SomaVio は既存システムを補完します。PMS、OTA、緊急時の手順を置き換えるものではありません。', footerPrivacy: 'プライバシーポリシー', footerTerms: '利用規約', footerContact: '問い合わせ'
    },
    ko: {
      docTitle: 'SomaVio | 현지 규정과 벌금 위험', metaDescription: 'Canmore, Banff, Kananaskis 방문객을 위한 현지 규정, 벌금 위험, 문화 기본 정보.',
      context: 'Canmore · Banff · Kananaskis · 현지 규정', navExplore: '탐색', navCategories: '카테고리', navTrip: '하루 계획', navSafety: '안전', navLocalRules: '현지 규정',
      heroKicker: '가기 전에 알아두기', heroTitle: '벌금, 혼란, 피할 수 있는 문제를 줄이는 현지 규정.', heroSub: '공원 패스, 드론, 야생동물, 주차, 현지 에티켓, 18세 이상 관련 법규를 방문객에게 실용적으로 안내합니다. SomaVio는 공식 출처로 연결하며 게시된 표지판이나 공공기관 안내를 대체하지 않습니다.', heroNote: '벌금 금액은 공공 공식 출처가 명확하게 제시한 경우에만 표시됩니다.',
      fineTitle: '우선순위가 높은 벌금 위험', fineSub: 'Banff National Park, Canmore 또는 Kananaskis에서 실제 문제로 이어질 수 있는 방문객의 흔한 실수입니다.',
      ageTitle: '18세 이상 현지 법규', ageSub: '이 섹션은 법적 인식 안내만을 위한 것입니다. SomaVio는 알코올 또는 cannabis를 홍보하지 않으며 구매 안내를 제공하지 않습니다.', alcoholLabel: '제한된 현지 법규', alcoholTitle: '공공장소에서 알코올 또는 cannabis 사용', alcoholText: '규정은 도시, 호텔, 캠프장, 트레일, 행사 구역 또는 국립공원 토지 등 정확한 장소에 따라 다릅니다. 공공 사용이 허용된다고 가정하지 말고 표지판과 공식 현지 규정을 따르세요.', drivingLabel: '안전 규정', drivingTitle: '운전과 공공장소', drivingText: '알코올 또는 cannabis 사용 후에는 절대 운전하지 마세요. 호텔, 셔틀, 캠프장, 공공장소에는 방문객이 예상하는 것보다 더 엄격한 규정이 있을 수 있습니다.',
      restaurantsTitle: '레스토랑, 카페, 상점', reservationsLabel: '가기 전에', reservationsTitle: '예약과 시간', reservationsText: '주말과 공휴일에는 인기 레스토랑이 일찍 만석이 될 수 있습니다. 산악 지역 마을의 주방은 예상보다 일찍 닫을 수 있습니다.',
      transportTitle: '교통, 주차, 정해진 시간의 활동', wellnessTitle: '웰니스와 사적인 공간', wellnessNote: '스파, 호텔 서비스, 민간 업소에는 조용한 환경, 사진/휴대폰 규정, 취소 정책이 있을 수 있습니다. SomaVio는 방문객이 주요 CTA를 클릭한 뒤 부드러운 마이크로팁으로 표시하는 것이 좋습니다.',
      footerVisitors: '방문객용', footerPartners: '파트너용', footerLegal: '법률', footerTagline: 'Alberta를 위한 현지 안내.', footerExplore: '탐색', footerCategories: '카테고리', footerTrip: '하루 계획', footerSafety: '안전', footerLocalRules: '현지 규정', footerHotels: '호텔용', footerBusinesses: '지역 비즈니스용', footerOrganizations: '기관용', footerStudio: 'Partner Studio', footerMessage: 'SomaVio는 기존 시스템을 보완합니다. PMS, OTA 또는 비상 절차를 대체하지 않습니다.', footerPrivacy: '개인정보 처리방침', footerTerms: '이용 약관', footerContact: '문의'
    }
  };

  function localRuleLang(lang) { return normalizeLanguageCode(lang || localStorage.getItem('sv_lang') || INITIAL_LANGUAGE); }
  function localRuleUi(key, lang) { const l = localRuleLang(lang); return (LOCAL_RULE_UI[l] && LOCAL_RULE_UI[l][key]) || LOCAL_RULE_UI.en[key] || key; }
  function localRuleCopy(key, lang) {
    const rule = LOCAL_RULES[key] || LOCAL_RULES.parkPass;
    const l = localRuleLang(lang);
    const copy = (rule.copy && (rule.copy[l] || rule.copy.en)) || {};
    return Object.assign({ risk: rule.risk || 'blue', href: rule.href || 'local-rules.html', key }, copy);
  }

  function updateRuleCard(card, key, compact) {
    const rule = localRuleCopy(key);
    card.className = `sv-rule-card sv-risk-${rule.risk || 'blue'}`;
    card.setAttribute('data-sv-rule-key', key);
    card.innerHTML = `<div class="sv-rule-eyebrow" data-sv-rule-field="label">${rule.label || localRuleUi('beforeGo')}</div><div class="sv-rule-title" data-sv-rule-field="title">${rule.title}</div><div class="sv-rule-text" data-sv-rule-field="text">${rule.text}</div>${compact ? '' : `<a class="sv-rule-link" href="${rule.href || 'local-rules.html'}" ${/^https?:/.test(rule.href || '') ? 'target="_blank" rel="noopener"' : ''}>${localRuleUi('viewRule')}</a>`}`;
  }

  function buildRuleCard(ruleKey, compact) {
    const card = document.createElement('article');
    updateRuleCard(card, ruleKey, compact);
    return card;
  }

  function applyLocalRulesTranslations(lang) {
    localRuleLang(lang);
    document.querySelectorAll('[data-sv-rule-key]').forEach(card => {
      const key = card.getAttribute('data-sv-rule-key');
      const compact = !card.querySelector('.sv-rule-link');
      updateRuleCard(card, key, compact);
    });
    document.querySelectorAll('[data-sv-ui-key]').forEach(el => {
      const key = el.getAttribute('data-sv-ui-key');
      const value = localRuleUi(key, lang);
      if (value) el.textContent = value;
    });
    applyLocalRulesPageTranslations(lang);
  }

  function applyLocalRulesPageTranslations(lang) {
    const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (path !== 'local-rules.html') return;
    const l = localRuleLang(lang);
    const copy = LOCAL_RULE_PAGE_COPY[l] || LOCAL_RULE_PAGE_COPY.en;
    document.title = copy.docTitle || LOCAL_RULE_PAGE_COPY.en.docTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && copy.metaDescription) meta.setAttribute('content', copy.metaDescription);
    document.querySelectorAll('[data-lr-key]').forEach(el => {
      const key = el.getAttribute('data-lr-key');
      const value = copy[key];
      if (value) el.textContent = value;
    });
    const pageRules = {
      pageDrone: 'drone', pageWildlife: 'wildlife', pageParkPass: 'parkPass', pageTipping: 'tipping', pageTax: 'tax', pageParking: 'parking', pageShuttle: 'shuttle', pageRental: 'rental'
    };
    Object.entries(pageRules).forEach(([prefix, ruleKey]) => {
      const rule = localRuleCopy(ruleKey, l);
      const label = document.querySelector(`[data-lr-key="${prefix}Label"]`);
      const title = document.querySelector(`[data-lr-key="${prefix}Title"]`);
      const text = document.querySelector(`[data-lr-key="${prefix}Text"]`);
      if (label) label.textContent = rule.label;
      if (title) title.textContent = rule.title;
      if (text) text.textContent = rule.text;
    });
    document.querySelectorAll('[data-lr-source]').forEach(el => { el.textContent = localRuleUi('officialSource', l); });
  }

  function insertAfter(el, node) { if (el && el.parentNode) el.parentNode.insertBefore(node, el.nextSibling); }

  function makeRulesStrip(ruleKeys) {
    const wrap = document.createElement('div');
    wrap.className = 'sv-rules-strip';
    const inner = document.createElement('div');
    inner.className = 'sv-rules-strip-inner';
    ruleKeys.forEach(ruleKey => inner.appendChild(buildRuleCard(ruleKey)));
    wrap.appendChild(inner);
    return wrap;
  }

  function makeRulesSection(ruleKeys) {
    const section = document.createElement('section');
    section.className = 'sv-rule-inline-section';
    section.innerHTML = `<div class="sv-rule-section-head"><div><h2 class="sv-rule-section-title" data-sv-ui-key="sectionTitle">${localRuleUi('sectionTitle')}</h2><p class="sv-rule-section-sub" data-sv-ui-key="sectionSub">${localRuleUi('sectionSub')}</p></div><a href="local-rules.html" class="sv-local-link-pill" data-sv-ui-key="openRules">${localRuleUi('openRules')}</a></div>`;
    const grid = document.createElement('div');
    grid.className = 'sv-rule-grid';
    ruleKeys.forEach(ruleKey => grid.appendChild(buildRuleCard(ruleKey)));
    section.appendChild(grid);
    return section;
  }

  function applyLocalRulesLayer() {
    injectLocalRulesStyles();
    const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (path === 'local-rules.html') {
      applyLocalRulesPageTranslations(localStorage.getItem('sv_lang') || INITIAL_LANGUAGE);
      return;
    }

    if (path === 'index.html' || path === '') {
      const safety = document.getElementById('safety-bar');
      if (safety && !document.querySelector('.sv-rules-strip')) insertAfter(safety, makeRulesStrip(['parkPass', 'drone', 'wildlife']));
      return;
    }

    if (path === 'safety.html') {
      const official = document.querySelector('.checks-grid');
      const section = official && official.closest('section');
      if (section && !document.querySelector('.sv-rule-inline-section')) insertAfter(section, makeRulesSection(['parkPass', 'drone', 'wildlife', 'adultRules']));
      return;
    }

    if (path === 'trip.html') {
      const sidebar = document.querySelector('.trip-sidebar');
      if (sidebar && !sidebar.querySelector('.sv-sidebar-card')) {
        const card = document.createElement('div');
        card.className = 'sv-sidebar-card';
        card.innerHTML = `<div class="sv-sidebar-title" data-sv-ui-key="sidebarTitle">${localRuleUi('sidebarTitle')}</div><div class="sv-sidebar-text" data-sv-ui-key="sidebarText">${localRuleUi('sidebarText')}</div><div class="sv-rule-stack" style="margin-top:12px"></div><a class="sv-rule-link" href="local-rules.html" data-sv-ui-key="reviewRules">${localRuleUi('reviewRules')}</a>`;
        const stack = card.querySelector('.sv-rule-stack');
        ['parkPass', 'drone', 'wildlife'].forEach(ruleKey => stack.appendChild(buildRuleCard(ruleKey, true)));
        const checks = Array.from(sidebar.querySelectorAll('.sidebar-card')).find(c => /check before you go/i.test(c.textContent || ''));
        if (checks) insertAfter(checks, card); else sidebar.prepend(card);
      }
      return;
    }

    if (path === 'hotel.html') {
      const bar = document.getElementById('safety-bar');
      if (bar && !document.querySelector('.sv-rules-strip')) insertAfter(bar, makeRulesStrip(['parkPass', 'parking', 'adultRules']));
      return;
    }

    if (path === 'category.html') {
      const reminder = document.querySelector('.safety-reminder');
      if (reminder && !document.querySelector('.sv-rules-strip')) insertAfter(reminder, makeRulesStrip(['parkPass', 'drone', 'wildlife']));
      return;
    }

    if (path.startsWith('partner-')) {
      const sidebar = document.querySelector('.partner-sidebar');
      if (!sidebar || sidebar.querySelector('.sv-sidebar-card')) return;
      const map = {
        'partner-cafe.html': ['tipping', 'tax'],
        'partner-guide.html': ['wildlife', 'drone', 'parkPass'],
        'partner-indoor.html': ['tax', 'adultRules'],
        'partner-rental.html': ['rental', 'wildlife'],
        'partner-retail.html': ['tax'],
        'partner-shuttle.html': ['shuttle', 'parkPass', 'parking'],
        'partner-wellness.html': ['wellness', 'tax']
      };
      const ruleKeys = map[path] || ['parkPass'];
      const card = document.createElement('div');
      card.className = 'sv-sidebar-card';
      card.innerHTML = `<div class="sv-sidebar-title" data-sv-ui-key="beforeGo">${localRuleUi('beforeGo')}</div><div class="sv-sidebar-text" data-sv-ui-key="partnerText">${localRuleUi('partnerText')}</div><div class="sv-rule-stack" style="margin-top:12px"></div><a class="sv-rule-link" href="local-rules.html" data-sv-ui-key="moreRules">${localRuleUi('moreRules')}</a>`;
      const stack = card.querySelector('.sv-rule-stack');
      ruleKeys.forEach(ruleKey => stack.appendChild(buildRuleCard(ruleKey, true)));
      const first = sidebar.querySelector('.s-card');
      if (first) insertAfter(first, card); else sidebar.prepend(card);
      return;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectLiveStyles();
    protectRemoteImages();
    hydrateLanguageDetection();
    applySharedSafetyAlert();
    applyUnitPreferences(localStorage.getItem('sv_lang') || INITIAL_LANGUAGE);
    hydrateWeather();
    applyLocalRulesLayer();
  });
})();

  /* ─────────────────────────────────────────────
     EXTERNAL DATA APIS — 511 Alberta · Avalanche Canada · AQHI · Sunrise/Sunset
     ───────────────────────────────────────────── */

  // ── Timestamp helper ──────────────────────────
  function formatAlertTimestamp(date) {
    const d = date instanceof Date ? date : new Date();
    return new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric', minute: '2-digit',
      timeZone: SOMAVIO_LOCATION.timezone
    }).format(d);
  }

  function buildTimestampHtml(source) {
    const time = formatAlertTimestamp(new Date());
    return `<span class="sv-alert-timestamp">Updated today, ${time} · Source: ${source}</span>`;
  }

  // ── Inject API card styles ─────────────────────
  function injectApiCardStyles() {
    if (document.getElementById('sv-api-card-styles')) return;
    const style = document.createElement('style');
    style.id = 'sv-api-card-styles';
    style.textContent = `
      .sv-before-you-go { padding: 0 0 8px; }
      .sv-byg-label { font-size: 11px; font-weight: 800; text-transform: uppercase;
        letter-spacing: .1em; color: var(--sage, #6B7F6E); margin-bottom: 10px; }
      .sv-byg-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .sv-byg-card { background: #fff; border: 1px solid rgba(44,44,42,.09);
        border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column;
        gap: 4px; box-shadow: 0 1px 3px rgba(44,44,42,.06); }
      .sv-byg-card.sv-byg-warn { border-left: 3px solid #C8923A; background: #fffbf4; }
      .sv-byg-card.sv-byg-danger { border-left: 3px solid #A7422C; background: #fff8f7; }
      .sv-byg-card.sv-byg-ok { border-left: 3px solid #6B7F6E; }
      .sv-byg-icon { font-size: 18px; line-height: 1; margin-bottom: 2px; }
      .sv-byg-title { font-size: 12px; font-weight: 700; color: #2C2C2A; line-height: 1.3; }
      .sv-byg-value { font-size: 13px; font-weight: 800; color: #2C2C2A; }
      .sv-byg-sub { font-size: 11px; color: #6b7280; line-height: 1.4; }
      .sv-byg-link { font-size: 11px; font-weight: 700; color: #6B7F6E;
        text-decoration: none; margin-top: 2px; }
      .sv-alert-timestamp { display: block; font-size: 10px; color: #9ca3af;
        margin-top: 4px; font-style: normal; }
      .sv-badge-rule { display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 700;
        background: rgba(200,146,58,.12); color: #a07428; margin-top: 4px;
        white-space: nowrap; }
      .sv-badge-rule.sv-badge-red { background: rgba(167,66,44,.1); color: #a7422c; }
      @media (max-width: 768px) { .sv-byg-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 480px) { .sv-byg-grid { grid-template-columns: 1fr 1fr; gap: 8px; } }
    `;
    document.head.appendChild(style);
  }

  // ── Sunrise/Sunset from existing Open-Meteo payload ───
  function getSunriseSunset() {
    const summary = window.SomaVioWeatherSummary;
    if (!summary) return { sunrise: null, sunset: null };
    const daily = window._svWeatherRawDaily;
    const sunrise = summary.sunrise || null;
    let sunset = null;
    if (daily && daily.sunset && daily.sunset.length) {
      sunset = formatLocalTime(daily.sunset[0]);
    }
    return { sunrise, sunset };
  }

  // Patch getWeatherSummary to also store sunset and raw daily
  const _origFetchWeather = fetchWeather;
  async function fetchWeatherPatched() {
    const result = await _origFetchWeather();
    if (result && result.data && result.data.daily) {
      window._svWeatherRawDaily = result.data.daily;
    }
    return result;
  }

  // ── 511 Alberta Road Conditions ───────────────
  const ROAD_511_CACHE_KEY = 'sv_511_v1';
  const ROAD_511_TTL = 10 * 60 * 1000; // 10 min

  async function fetch511Alberta() {
    try {
      const cached = JSON.parse(localStorage.getItem(ROAD_511_CACHE_KEY) || 'null');
      if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < ROAD_511_TTL) {
        return cached.data;
      }
    } catch(_) {}

    try {
      // 511 Alberta open data — events endpoint filtered to Bow Valley / Canmore area
      const url = 'https://511.alberta.ca/api/v2/get/event?format=json&lang=en';
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error('511 non-OK');
      const json = await response.json();

      // Filter to Hwy 1, 1A, 40, 742 in the Bow Valley corridor
      const relevant = (json.Events || json.events || []).filter(ev => {
        const area = (ev.Area || ev.area || ev.RoadName || ev.roadName || '').toLowerCase();
        const hwy = (ev.Highway || ev.highway || '').toString();
        return (
          area.includes('canmore') || area.includes('banff') ||
          area.includes('bow valley') || area.includes('kananaskis') ||
          hwy === '1' || hwy === '1a' || hwy === '40' || hwy === '742'
        );
      }).slice(0, 3);

      const data = { events: relevant, fetchedAt: Date.now() };
      try { localStorage.setItem(ROAD_511_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data })); } catch(_) {}
      return data;
    } catch(err) {
      console.warn('[SomaVio] 511 Alberta unavailable:', err.message);
      return null;
    }
  }

  // ── Avalanche Canada ───────────────────────────
  const AVAL_CACHE_KEY = 'sv_avalanche_v1';
  const AVAL_TTL = 60 * 60 * 1000; // 1 hour

  const AVAL_DANGER_LABELS = {
    1: 'Low', 2: 'Moderate', 3: 'Considerable', 4: 'High', 5: 'Extreme'
  };

  async function fetchAvalanche() {
    try {
      const cached = JSON.parse(localStorage.getItem(AVAL_CACHE_KEY) || 'null');
      if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < AVAL_TTL) {
        return cached.data;
      }
    } catch(_) {}

    try {
      // Avalanche Canada public forecast API — Kananaskis / Bow Valley region
      const url = 'https://api.avalanche.ca/forecasts/en/forecasts/kananaskis.json';
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Avalanche Canada non-OK');
      const json = await response.json();

      const danger = json.dangerRatings || [];
      const todayDanger = danger.find(d => d.date === (danger[0] || {}).date) || danger[0] || {};
      const maxDanger = Math.max(
        Number(todayDanger.alpine || 0),
        Number(todayDanger.treeline || 0),
        Number(todayDanger.belowTreeline || 0)
      );

      const data = {
        danger: maxDanger,
        label: AVAL_DANGER_LABELS[maxDanger] || 'See forecast',
        area: 'Kananaskis / Bow Valley',
        url: 'https://avalanche.ca/en/forecasts/kananaskis',
        fetchedAt: Date.now()
      };
      try { localStorage.setItem(AVAL_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data })); } catch(_) {}
      return data;
    } catch(err) {
      console.warn('[SomaVio] Avalanche Canada unavailable:', err.message);
      return null;
    }
  }

  // ── AQHI Canada — Air Quality ──────────────────
  const AQHI_CACHE_KEY = 'sv_aqhi_v1';
  const AQHI_TTL = 30 * 60 * 1000; // 30 min

  async function fetchAQHI() {
    try {
      const cached = JSON.parse(localStorage.getItem(AQHI_CACHE_KEY) || 'null');
      if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < AQHI_TTL) {
        return cached.data;
      }
    } catch(_) {}

    try {
      // Environment Canada GeoMet — AQHI observation closest to Canmore
      const url = 'https://api.weather.gc.ca/collections/aqhi-observations-realtime/items?lang=en&limit=1&f=json&sortby=-obs_datetime_local_str&location-name=Canmore';
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('AQHI non-OK');
      const json = await response.json();

      const feature = (json.features || [])[0];
      const props = (feature && feature.properties) || {};
      const aqhi = Number(props.aqhi || props.air_quality_health_index || 0);
      const label = aqhi <= 3 ? 'Low' : aqhi <= 6 ? 'Moderate' : aqhi <= 10 ? 'High' : 'Very High';

      const data = { aqhi, label, fetchedAt: Date.now() };
      try { localStorage.setItem(AQHI_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data })); } catch(_) {}
      return data;
    } catch(err) {
      console.warn('[SomaVio] AQHI unavailable:', err.message);
      return null;
    }
  }

  // ── Before You Go grid renderer ───────────────
  function buildBygCard({ icon, title, value, sub, linkText, linkHref, status }) {
    const statusClass = status === 'danger' ? 'sv-byg-danger' : status === 'warn' ? 'sv-byg-warn' : 'sv-byg-ok';
    const link = linkHref ? `<a class="sv-byg-link" href="${linkHref}" target="_blank" rel="noopener">${linkText || 'View →'}</a>` : '';
    return `
      <div class="sv-byg-card ${statusClass}">
        <div class="sv-byg-icon">${icon}</div>
        <div class="sv-byg-title">${title}</div>
        <div class="sv-byg-value">${value}</div>
        ${sub ? `<div class="sv-byg-sub">${sub}</div>` : ''}
        ${link}
      </div>`;
  }

  async function injectBeforeYouGo() {
    const target = document.getElementById('sv-before-you-go');
    if (!target) return;

    injectApiCardStyles();
    target.innerHTML = '<div class="sv-byg-label">Before you go today</div><div class="sv-byg-grid sv-byg-loading"></div>';
    const grid = target.querySelector('.sv-byg-grid');

    // 1. Pass card (static rule — always show)
    grid.insertAdjacentHTML('beforeend', buildBygCard({
      icon: '🎫',
      title: 'Park pass',
      value: 'May be required',
      sub: 'Banff NP & Kananaskis',
      linkText: 'Check Parks Canada →',
      linkHref: 'https://parks.canada.ca/pn-np/ab/banff/visit/passer-passes',
      status: 'warn'
    }));

    // 2. Sunrise / Sunset — from Open-Meteo (already loaded)
    function applySunCard() {
      const { sunrise, sunset } = getSunriseSunset();
      const value = sunrise && sunset ? `↑ ${sunrise} · ↓ ${sunset}` : sunrise ? `↑ ${sunrise}` : 'See forecast';
      grid.insertAdjacentHTML('beforeend', buildBygCard({
        icon: '🌄',
        title: 'Sunrise / Sunset',
        value,
        sub: 'Canmore today',
        status: 'ok'
      }));
    }

    if (window.SomaVioWeatherSummary) {
      applySunCard();
    } else {
      // Wait up to 5s for weather to load then apply
      let waited = 0;
      const check = setInterval(() => {
        waited += 200;
        if (window.SomaVioWeatherSummary || waited >= 5000) {
          clearInterval(check);
          applySunCard();
        }
      }, 200);
    }

    // 3. Road conditions — 511 Alberta
    const roads = await fetch511Alberta();
    if (roads && roads.events && roads.events.length > 0) {
      const ev = roads.events[0];
      const desc = ev.Description || ev.description || ev.EventType || 'Active event';
      grid.insertAdjacentHTML('beforeend', buildBygCard({
        icon: '🛣️',
        title: 'Road conditions',
        value: 'Active events',
        sub: String(desc).substring(0, 60) + (desc.length > 60 ? '…' : ''),
        linkText: 'Check 511 →',
        linkHref: 'https://511.alberta.ca',
        status: 'warn'
      }));
    } else {
      grid.insertAdjacentHTML('beforeend', buildBygCard({
        icon: '🛣️',
        title: 'Road conditions',
        value: 'No active alerts',
        sub: 'Hwy 1, 1A, 40, 742',
        linkText: 'View 511 →',
        linkHref: 'https://511.alberta.ca',
        status: 'ok'
      }));
    }

    // 4. Avalanche — only show if Considerable (3) or above
    const aval = await fetchAvalanche();
    if (aval && aval.danger >= 3) {
      grid.insertAdjacentHTML('beforeend', buildBygCard({
        icon: '🏔️',
        title: 'Avalanche danger',
        value: aval.label,
        sub: aval.area,
        linkText: 'Avalanche Canada →',
        linkHref: aval.url,
        status: aval.danger >= 4 ? 'danger' : 'warn'
      }));
    }
    // If danger < 3: no card shown (no noise on good days)

    // 5. AQHI — only show if Moderate (4) or above
    const aqhi = await fetchAQHI();
    if (aqhi && aqhi.aqhi >= 4) {
      grid.insertAdjacentHTML('beforeend', buildBygCard({
        icon: '💨',
        title: 'Air quality',
        value: `AQHI ${aqhi.aqhi} — ${aqhi.label}`,
        sub: 'Health Canada',
        linkText: 'View forecast →',
        linkHref: 'https://weather.gc.ca/airquality/pages/provincial_summary/ab_e.html',
        status: aqhi.aqhi >= 7 ? 'danger' : 'warn'
      }));
    }
    // If AQHI < 4: no card (good air = no noise)

    grid.classList.remove('sv-byg-loading');
  }

  // ── Inject timestamp into safety alert bar ─────
  function injectAlertTimestamp() {
    const bar = document.getElementById('safety-bar');
    if (!bar) return;
    // Remove existing timestamp if any
    bar.querySelectorAll('.sv-alert-timestamp').forEach(el => el.remove());
    const sourceEl = bar.querySelector('.safety-source');
    if (sourceEl) {
      const time = formatAlertTimestamp(new Date());
      const ts = document.createElement('span');
      ts.className = 'sv-alert-timestamp';
      ts.textContent = `Updated today, ${time} · Source: Parks Canada`;
      sourceEl.replaceWith(ts);
    }
  }

  // ── Hook into DOMContentLoaded ─────────────────
  const _origDCL = document.addEventListener.bind(document);
  document.addEventListener('DOMContentLoaded', function () {
    injectApiCardStyles();
    injectAlertTimestamp();
    injectBeforeYouGo();
  });

