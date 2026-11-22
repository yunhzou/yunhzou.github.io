/* Self-driving lab widget + small page helpers. No dependencies. */
(function () {
  'use strict';

  /* ---------- theme toggle ---------- */
  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.dataset.theme ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ---------- publication filter ---------- */
  var filters = document.querySelectorAll('.filter');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.dataset.filter;
      filters.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      document.querySelectorAll('.pub').forEach(function (p) {
        p.hidden = mode === 'lead' && p.dataset.lead !== 'true';
      });
    });
  });

  /* ---------- robotic arm ---------- */
  var svg = document.getElementById('lab-svg');
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';
  var lab = svg.closest('.lab');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SHOULDER = { x: 110, y: 226 };
  var L1 = 170, L2 = 170;
  var HOME = { x: 200, y: 120 };
  var GRAB_Y = 212;   // wrist height when fingers wrap the vial neck
  var LIFT_Y = 140;   // carry height (vial clears the rack)
  var TRAY = { x: 430, y: 175 };
  var FINGER_OPEN = 17, FINGER_CLOSED = 14;

  var SAMPLES = [
    { id: 'research', label: 'research', target: '#research', name: 'Research', grad: 'liquid-a' },
    { id: 'papers', label: 'papers', target: '#publications', name: 'Publications', grad: 'liquid-b' },
    { id: 'career', label: 'career', target: '#experience', name: 'Experience', grad: 'liquid-c' },
    { id: 'contact', label: 'contact', target: '#contact', name: 'Contact', grad: 'liquid-d' }
  ];
  var X0 = 204, DX = 50;

  var el = function (tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  var vialsG = document.getElementById('vials');
  SAMPLES.forEach(function (s, i) {
    s.x = X0 + i * DX;
    var g = el('g', {
      class: 'vial', tabindex: '0', role: 'button',
      'aria-label': 'Fetch ' + s.name + ' (jumps to the ' + s.name + ' section)'
    }, vialsG);
    el('rect', { class: 'halo', x: s.x - 17, y: 214, width: 34, height: 78, rx: 8 }, g);
    var body = el('g', { class: 'vial-body' }, g);
    el('rect', { class: 'glass', x: s.x - 10, y: 228, width: 20, height: 34, rx: 4 }, body);
    el('rect', { x: s.x - 8, y: 240, width: 16, height: 20, rx: 3, fill: 'url(#' + s.grad + ')' }, body);
    el('rect', { class: 'cap', x: s.x - 9, y: 221, width: 18, height: 8, rx: 2 }, body);
    var t = el('text', { class: 'label', x: s.x, y: 284 }, g);
    t.textContent = s.label;
    s.g = g; s.body = body;
    g.addEventListener('click', function () { run(s); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(s); }
    });
  });

  var l1 = document.getElementById('arm-l1');
  var l2 = document.getElementById('arm-l2');
  var j1 = document.getElementById('arm-j1');
  var grip = document.getElementById('gripper');
  var fl = document.getElementById('finger-l');
  var fr = document.getElementById('finger-r');
  var screen = document.getElementById('tray-screen');
  var screenText = document.getElementById('tray-text');
  var consoleText = document.getElementById('console-text');

  var wrist = { x: HOME.x, y: HOME.y };
  var finger = FINGER_OPEN;
  var carrying = null, grabOrigin = null;

  // Two-link inverse kinematics, elbow-up (all targets sit right of the shoulder).
  function solve(t) {
    var dx = t.x - SHOULDER.x, dy = t.y - SHOULDER.y;
    var d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1), L1 + L2 - 0.5);
    var c2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    var q2 = Math.acos(Math.max(-1, Math.min(1, c2)));
    var q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    var e = { x: SHOULDER.x + L1 * Math.cos(q1), y: SHOULDER.y + L1 * Math.sin(q1) };
    var w = { x: e.x + L2 * Math.cos(q1 + q2), y: e.y + L2 * Math.sin(q1 + q2) };
    return { e: e, w: w };
  }

  function draw() {
    var k = solve(wrist);
    l1.setAttribute('x2', k.e.x); l1.setAttribute('y2', k.e.y);
    l2.setAttribute('x1', k.e.x); l2.setAttribute('y1', k.e.y);
    l2.setAttribute('x2', k.w.x); l2.setAttribute('y2', k.w.y);
    j1.setAttribute('cx', k.e.x); j1.setAttribute('cy', k.e.y);
    grip.setAttribute('transform', 'translate(' + k.w.x.toFixed(2) + ' ' + k.w.y.toFixed(2) + ')');
    fl.setAttribute('x', -finger);
    fr.setAttribute('x', finger - 4);
    if (carrying) {
      carrying.body.setAttribute('transform',
        'translate(' + (k.w.x - grabOrigin.x).toFixed(2) + ' ' + (k.w.y - grabOrigin.y).toFixed(2) + ')');
    }
  }

  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  function tween(to, ms, fingerTo) {
    var from = { x: wrist.x, y: wrist.y }, f0 = finger;
    var f1 = fingerTo == null ? finger : fingerTo;
    return new Promise(function (resolve) {
      var start = performance.now();
      function frame(now) {
        var p = Math.min(1, (now - start) / ms), e = ease(p);
        wrist.x = from.x + (to.x - from.x) * e;
        wrist.y = from.y + (to.y - from.y) * e;
        finger = f0 + (f1 - f0) * e;
        draw();
        if (p < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var say = function (msg) { consoleText.textContent = msg; };

  function deliver(s) {
    var target = document.querySelector(s.target);
    if (!target) return;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    target.classList.remove('delivered');
    void target.offsetWidth;
    target.classList.add('delivered');
    var h = target.querySelector('h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  var busy = false;
  async function run(s) {
    if (busy) return;
    if (reduceMotion) { say('fetched ' + s.label + ' → ' + s.name); deliver(s); return; }
    busy = true; lab.classList.add('busy');
    try {
      say('queued: fetch sample "' + s.label + '"');
      await tween({ x: s.x, y: LIFT_Y }, 650, FINGER_OPEN);
      await tween({ x: s.x, y: GRAB_Y }, 320);
      say('gripping ' + s.label + '…');
      await tween({ x: s.x, y: GRAB_Y }, 180, FINGER_CLOSED);
      carrying = s; grabOrigin = { x: s.x, y: GRAB_Y };
      await tween({ x: s.x, y: LIFT_Y }, 320);
      say('transferring to analyzer…');
      await tween({ x: TRAY.x, y: LIFT_Y }, 750);
      await tween({ x: TRAY.x, y: TRAY.y }, 300);
      await tween({ x: TRAY.x, y: TRAY.y }, 160, FINGER_OPEN);
      carrying = null;
      s.g.classList.add('away');
      screen.classList.add('on');
      screenText.textContent = s.label.toUpperCase().slice(0, 8);
      say('analysis complete → opening ' + s.name);
      await tween({ x: TRAY.x - 30, y: LIFT_Y }, 260);
      deliver(s);
      await tween(HOME, 600);
      await wait(700);
      s.body.removeAttribute('transform');
      s.g.classList.remove('away');
      screen.classList.remove('on');
      screenText.textContent = 'READY';
      say('idle — pick another sample.');
    } finally {
      busy = false; lab.classList.remove('busy');
    }
  }

  draw();
})();
