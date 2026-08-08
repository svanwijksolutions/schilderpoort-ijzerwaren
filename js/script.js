/* Schilperoort IJzerwaren — site script
   Bevat: header/footer laden, hamburgermenu, taalswitcher met vertalingen,
   tellers, scroll-header, veilig scroll-reveal, cookiemelding, contactformulier. */

(function () {
  'use strict';

  var SUPPORTED = ['nl', 'en'];
  var DEFAULT_LANG = 'nl';
  var dictionaries = {};
  var currentLang = DEFAULT_LANG;

  /* ---------- helpers ---------- */

  function lookup(dict, key) {
    var parts = key.split('.');
    var value = dict;
    for (var i = 0; i < parts.length; i++) {
      if (value === null || typeof value !== 'object') return null;
      value = value[parts[i]];
    }
    return typeof value === 'string' ? value : null;
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* privacymodus */ }
  }

  function pickInitialLang() {
    var saved = storageGet('si-lang');
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (nav.indexOf('nl') === 0) return 'nl';
    if (nav.indexOf('en') === 0) return 'en';
    return DEFAULT_LANG;
  }

  function loadDictionary(lang) {
    if (dictionaries[lang]) return Promise.resolve(dictionaries[lang]);
    return fetch('i18n/' + lang + '.json')
      .then(function (res) { return res.ok ? res.json() : {}; })
      .then(function (json) { dictionaries[lang] = json; return json; })
      .catch(function () { dictionaries[lang] = {}; return dictionaries[lang]; });
  }

  /* ---------- vertalingen toepassen ---------- */

  var ATTR_MAP = [
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-title', 'title'],
    ['data-i18n-alt', 'alt']
  ];

  function translateTree(root, dict) {
    if (!root) return;
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      var text = lookup(dict, key);
      if (text === null) continue;
      var kept = nodes[i].querySelector('svg');
      nodes[i].textContent = text;
      if (kept) nodes[i].appendChild(kept);
    }
    for (var a = 0; a < ATTR_MAP.length; a++) {
      var sel = '[' + ATTR_MAP[a][0] + ']';
      var attrNodes = root.querySelectorAll(sel);
      for (var j = 0; j < attrNodes.length; j++) {
        var attrKey = attrNodes[j].getAttribute(ATTR_MAP[a][0]);
        var attrText = lookup(dict, attrKey);
        if (attrText !== null) attrNodes[j].setAttribute(ATTR_MAP[a][1], attrText);
      }
    }
  }

  function applyMeta(dict) {
    var page = document.body.getAttribute('data-page');
    if (!page) return;
    var title = lookup(dict, 'meta.' + page + '.title');
    var desc = lookup(dict, 'meta.' + page + '.description');
    if (title) document.title = title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (desc && metaDesc) metaDesc.setAttribute('content', desc);
  }

  function syncLangControls() {
    var codeNodes = document.querySelectorAll('[data-lang-code]');
    for (var i = 0; i < codeNodes.length; i++) {
      codeNodes[i].textContent = currentLang.toUpperCase();
    }
    var options = document.querySelectorAll('.lang-option[data-set-lang]');
    for (var j = 0; j < options.length; j++) {
      options[j].setAttribute('aria-selected', options[j].getAttribute('data-set-lang') === currentLang ? 'true' : 'false');
    }
    var mobileBtns = document.querySelectorAll('.mobile-lang-btn[data-set-lang]');
    for (var k = 0; k < mobileBtns.length; k++) {
      mobileBtns[k].setAttribute('aria-pressed', mobileBtns[k].getAttribute('data-set-lang') === currentLang ? 'true' : 'false');
    }
  }

  function setLanguage(lang, persist) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    return loadDictionary(lang).then(function (dict) {
      currentLang = lang;
      document.documentElement.setAttribute('lang', lang);
      translateTree(document.body, dict);
      applyMeta(dict);
      syncLangControls();
      if (persist) storageSet('si-lang', lang);
      return dict;
    });
  }

  /* ---------- header en footer inladen ---------- */

  function injectPartials() {
    var targets = [
      { id: 'header-placeholder', file: 'components/header.html' },
      { id: 'footer-placeholder', file: 'components/footer.html' }
    ];
    var jobs = targets.map(function (target) {
      var host = document.getElementById(target.id);
      if (!host) return Promise.resolve();
      return fetch(target.file)
        .then(function (res) { return res.ok ? res.text() : ''; })
        .then(function (html) { host.innerHTML = html; })
        .catch(function () { /* laat de pagina gewoon staan */ });
    });
    return Promise.all(jobs);
  }

  /* ---------- navigatie ---------- */

  function markActiveNav() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    var current = path.replace('.html', '');
    if (!current) current = 'index';
    var links = document.querySelectorAll('.nav-link[data-nav]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-nav') === current) {
        links[i].classList.add('is-active');
        links[i].setAttribute('aria-current', 'page');
      }
    }
  }

  function initMenu() {
    var toggle = document.querySelector('.menu-toggle');
    var menu = document.querySelector('.mobile-menu');
    if (!toggle || !menu) return;

    function openMenu() {
      menu.classList.add('open');
      document.body.classList.add('menu-open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      menu.classList.remove('open');
      document.body.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      if (menu.classList.contains('open')) { closeMenu(); } else { openMenu(); }
    });

    var links = menu.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', closeMenu);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  function initLangSwitch() {
    var wrap = document.querySelector('[data-lang-switch]');
    if (wrap) {
      var toggle = wrap.querySelector('.lang-toggle');
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = wrap.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) {
          wrap.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          wrap.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    var buttons = document.querySelectorAll('[data-set-lang]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var lang = e.currentTarget.getAttribute('data-set-lang');
        setLanguage(lang, true);
        if (wrap) {
          wrap.classList.remove('open');
          wrap.querySelector('.lang-toggle').setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  /* ---------- header bij scrollen ---------- */

  function initScrollHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var ticking = false;
    function update() {
      if (window.scrollY > 24) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ---------- tellers ---------- */

  function initCounters() {
    var nodes = document.querySelectorAll('[data-count]');
    if (!nodes.length) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (var i = 0; i < nodes.length; i++) {
      (function (node) {
        var target = parseInt(node.getAttribute('data-count'), 10) || 0;
        if (reduced) { node.textContent = String(target); return; }
        var duration = 1400;
        var start = null;
        node.textContent = '0';
        function step(timestamp) {
          if (start === null) start = timestamp;
          var progress = Math.min((timestamp - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          node.textContent = String(Math.round(eased * target));
          if (progress < 1) window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
      })(nodes[i]);
    }
  }

  /* ---------- veilig scroll-reveal ---------- */

  function initReveal() {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var items = document.querySelectorAll('.reveal');
    if (!items.length || reduced || !('IntersectionObserver' in window)) return;

    document.body.classList.add('js-motion');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

    for (var i = 0; i < items.length; i++) observer.observe(items[i]);

    /* vangnet: alles zichtbaar maken, ook als de observer niet vuurt */
    window.setTimeout(function () {
      var missed = document.querySelectorAll('.reveal:not(.in-view)');
      for (var j = 0; j < missed.length; j++) missed[j].classList.add('in-view');
    }, 3500);
  }

  /* ---------- cookiemelding ---------- */

  function initCookieBanner() {
    var banner = document.querySelector('.cookie-banner');
    if (!banner) return;
    if (storageGet('si-cookie') === 'ok') return;
    window.setTimeout(function () { banner.classList.add('visible'); }, 900);
    var accept = banner.querySelector('[data-cookie-accept]');
    if (accept) {
      accept.addEventListener('click', function () {
        storageSet('si-cookie', 'ok');
        banner.classList.remove('visible');
      });
    }
  }

  /* ---------- contactformulier ---------- */

  function initForm() {
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;
    var status = document.querySelector('.form-status');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var honey = form.querySelector('[name="bedrijfsnaam"]');
      if (honey && honey.value) return;

      var data = new FormData(form);
      var branch = data.get('filiaal') === 'herenstraat'
        ? 'herenstraat@schilperoort-ijzerwaren.nl'
        : 'bogaard@schilperoort-ijzerwaren.nl';

      var dict = dictionaries[currentLang] || {};
      var subjectLabel = lookup(dict, 'contact.mailSubject') || 'Vraag via de website';
      var lines = [
        (lookup(dict, 'contact.fields.name') || 'Naam') + ': ' + (data.get('naam') || ''),
        (lookup(dict, 'contact.fields.email') || 'E-mailadres') + ': ' + (data.get('email') || ''),
        (lookup(dict, 'contact.fields.phone') || 'Telefoonnummer') + ': ' + (data.get('telefoon') || ''),
        '',
        (data.get('bericht') || '')
      ];

      var href = 'mailto:' + branch +
        '?subject=' + encodeURIComponent(subjectLabel) +
        '&body=' + encodeURIComponent(lines.join('\n'));

      if (status) {
        status.classList.add('visible');
      }

      window.location.href = href;
    });
  }

  /* ---------- jaartal ---------- */

  function initYear() {
    var nodes = document.querySelectorAll('[data-current-year]');
    var year = String(new Date().getFullYear());
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = year;
  }

  /* ---------- start ---------- */

  function init() {
    currentLang = pickInitialLang();
    injectPartials().then(function () {
      markActiveNav();
      initMenu();
      initLangSwitch();
      initScrollHeader();
      initYear();
      return setLanguage(currentLang, false);
    }).then(function () {
      initCounters();
      initReveal();
      initCookieBanner();
      initForm();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
