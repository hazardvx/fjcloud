(function () {
  'use strict';

  var WA_NUMERO = '50667008446';
  var WA_MENSAJE = 'Hola, quiero información sobre los servicios de FJcloud.app.';

  var header = document.getElementById('siteHeader');
  var burger = document.getElementById('burger');
  var panel = document.getElementById('navPanel');
  var toast = document.getElementById('toast');
  var toastTimer = null;

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 3200);
  }

  function onScroll() {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function closeMenu() {
    if (!burger || !panel) return;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menú de navegación');
    panel.classList.remove('open');
  }

  if (burger && panel) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      burger.setAttribute('aria-label', open ? 'Abrir menú de navegación' : 'Cerrar menú de navegación');
      panel.classList.toggle('open', !open);
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 980) closeMenu();
    });
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { revealObs.observe(el); });
  }

  var counters = document.querySelectorAll('.stat-value[data-count]');
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduceMotion) {
      el.textContent = prefix + target.toFixed(decimals) + suffix;
      return;
    }
    var dur = 1400;
    var start = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = prefix + val.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    var countObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          countObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { countObs.observe(el); });
  }

  var navLinks = document.querySelectorAll('.nav a[href^="#"]');
  var sections = [];
  navLinks.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var sec = document.getElementById(id);
    if (sec) sections.push({ id: id, el: sec, link: link });
  });
  if ('IntersectionObserver' in window && sections.length) {
    var navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          navLinks.forEach(function (l) { l.classList.remove('active'); l.removeAttribute('aria-current'); });
          var match = sections.find(function (s) { return s.el === entry.target; });
          if (match) {
            match.link.classList.add('active');
            match.link.setAttribute('aria-current', 'true');
          }
        }
      });
    }, { rootMargin: '-38% 0px -55% 0px', threshold: 0 });
    sections.forEach(function (s) { navObs.observe(s.el); });
  }

  document.querySelectorAll('.js-clientes').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      closeMenu();
      showToast('El Área de Clientes estará disponible próximamente.');
    });
  });

  document.querySelectorAll('.js-wa').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      if (WA_NUMERO) {
        window.open('https://wa.me/' + WA_NUMERO + '?text=' + encodeURIComponent(WA_MENSAJE), '_blank', 'noopener');
      } else {
        showToast('WhatsApp: configura el número en js/main.js (WA_NUMERO).');
      }
    });
  });

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
