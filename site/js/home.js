/* ══════════════════════════════════════════════════
   OmniVora — Motion layer (premium tier)
   GSAP · ScrollTrigger · Lenis
   Masked reveals · page-transition wipes · scroll-velocity
   skew · image scale-on-scroll · magnetic · momentum cursor.
   ══════════════════════════════════════════════════ */

// Honor the OS/browser "reduce motion" setting by default. Append ?motion=on to
// the URL to force the full-motion experience for previewing, or ?motion=off to
// preview the reduced experience.
const FORCE_MOTION = /[?&]motion=on\b/.test(location.search);
const FORCE_REDUCED = /[?&]motion=off\b/.test(location.search);
const OS_REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const REDUCED = FORCE_REDUCED || (OS_REDUCED && !FORCE_MOTION);
if (FORCE_MOTION) document.documentElement.classList.add('force-motion');
if (REDUCED) document.documentElement.classList.add('reduce-motion');
const TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches;
const HAS_GSAP = typeof window.gsap !== 'undefined';

// When the home preloader is active it drives the hero intro from its own
// master timeline, so heroReveal() must not also fire the standalone intro.
let heroOwnedByPreloader = false;

// Resolve once the page is genuinely ready to reveal: fonts + full load, with a
// min on-screen beat (never an instant flash) and a hard cap (never hangs).
function whenReady() {
  const load = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((r) => addEventListener('load', r, { once: true }));
  const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  const floor = new Promise((r) => setTimeout(r, 1300));
  const cap = new Promise((r) => setTimeout(r, 2600));
  return Promise.race([Promise.all([load, fonts, floor]), cap]);
}

if (!HAS_GSAP) document.documentElement.classList.add('no-gsap');
if (HAS_GSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ═══════ helpers ═══════ */
// Split an element's text into per-word masks, preserving <em> and <br>.
function splitMask(el) {
  const nodes = Array.from(el.childNodes);
  const words = [];
  el.innerHTML = '';
  const addWord = (text, italic, accent) => {
    const mask = document.createElement('span'); mask.className = 'mask';
    const inner = document.createElement('span');
    inner.className = 'mask__i' + (italic ? ' i' : '') + (accent ? ' accent' : '');
    inner.textContent = text;
    mask.appendChild(inner); el.appendChild(mask); words.push(inner);
  };
  nodes.forEach((node) => {
    if (node.nodeType === 3) {
      node.textContent.split(/(\s+)/).forEach((tok) => {
        if (tok === '') return;
        if (/^\s+$/.test(tok)) el.appendChild(document.createTextNode(tok));
        else addWord(tok, false, false);
      });
    } else if (node.nodeName === 'BR') {
      el.appendChild(document.createElement('br'));
    } else {
      const italic = node.nodeName === 'EM';
      const accent = node.classList && node.classList.contains('accent');
      node.textContent.split(/(\s+)/).forEach((tok) => {
        if (tok === '') return;
        if (/^\s+$/.test(tok)) el.appendChild(document.createTextNode(tok));
        else addWord(tok, italic, accent);
      });
    }
  });
  return words;
}

// Wrap the hero's existing .w spans in masks (keeps <em>/accent styling intact).
function maskHero() {
  document.querySelectorAll('.hero__title .w').forEach((w) => {
    const mask = document.createElement('span'); mask.className = 'mask';
    w.parentNode.insertBefore(mask, w); mask.appendChild(w);
  });
}

/* ═══════ Lenis ═══════ */
let lenis;
function initLenis() {
  const anchor = () => document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const t = id.length > 1 && document.querySelector(id);
      if (t) { e.preventDefault(); lenis ? lenis.scrollTo(t, { duration: 1.2 }) : t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
  // Native scrolling: no smooth-scroll layer between the wheel/touch and the page.
  anchor();
}

/* ═══════ magnetic interactives ═══════ */
function initMagnetic() {
  if (TOUCH || !HAS_GSAP || REDUCED) return;
  document.querySelectorAll('[data-magnetic], .proj__link, .switch button, .nav__brand, .cblock a, .hero__cue, .btn, .nav__cta').forEach((el) => {
    const s = 0.34;
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * s, y: (e.clientY - (r.top + r.height / 2)) * s, duration: 0.6, ease: 'power3.out' });
    });
    el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' }));
  });
}

/* ═══════ page-transition wipes ═══════ */
function initTransitions() {
  const tp = document.createElement('div');
  tp.className = 'transition';
  tp.innerHTML = '<span class="transition__label">OmniVora</span>';
  document.body.appendChild(tp);
  const label = tp.querySelector('.transition__label');

  if (!HAS_GSAP || REDUCED) { tp.style.display = 'none'; return; }

  // On the home page the preloader owns the intro, so skip the reveal-in here to
  // avoid two stacked curtains. Outbound nav wipes (below) still run everywhere.
  if (document.querySelector('.preloader')) {
    gsap.set(tp, { scaleY: 0 });
    tp.style.pointerEvents = 'none';
  } else {
    // reveal current page (wipe up & away)
    gsap.set(tp, { scaleY: 1, transformOrigin: 'top' });
    gsap.set(label, { opacity: 0.85 });
    gsap.timeline()
      .to(label, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0.15)
      .to(tp, { scaleY: 0, transformOrigin: 'top', duration: 0.9, ease: 'power4.inOut', onComplete: () => { tp.style.pointerEvents = 'none'; } }, 0.1);
  }

  // intercept internal page links → wipe down, then navigate
  document.querySelectorAll('a[href$=".html"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const url = a.getAttribute('href');
      if (!url || url.startsWith('http')) return;
      e.preventDefault();
      // Carry the ?motion=on preview flag across navigations so the transition
      // (and all motion) stays on for every page, not just the first.
      const dest = (FORCE_MOTION && !/[?&]motion=on\b/.test(url))
        ? url + (url.includes('?') ? '&' : '?') + 'motion=on'
        : url;
      tp.style.pointerEvents = 'auto';
      gsap.set(tp, { scaleY: 0, transformOrigin: 'bottom' });
      gsap.timeline({ onComplete: () => { location.href = dest; } })
        .to(tp, { scaleY: 1, transformOrigin: 'bottom', duration: 0.7, ease: 'power4.inOut' })
        .to(label, { opacity: 0.85, duration: 0.4, ease: 'power2.out' }, 0.2);
    });
  });

  // restore on bfcache back/forward
  addEventListener('pageshow', (e) => { if (e.persisted) { gsap.set(tp, { scaleY: 0 }); tp.style.pointerEvents = 'none'; } });
}

/* ═══════ HERO reveal (masked words + blur, then scrub drift) ═══════ */
// Continuous scrub drift — independent of the intro, so it runs even when the
// preloader owns the reveal hand-off. Retired if the scrubbed-video hero takes
// over (see initHeroVideo), since that pins the hero and drives its own motion.
let heroParallaxST = null;
function heroParallax() {
  if (!HAS_GSAP || REDUCED || !window.ScrollTrigger) return;
  const inner = document.querySelector('.hero__inner');
  if (!inner) return;
  const tw = gsap.to(inner, { yPercent: -7, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  heroParallaxST = tw.scrollTrigger;
}

/* ═══════ HERO: scroll-scrubbed video (pinned) ═══════ */
// Self-activating: the pin + currentTime scrub are built ONLY once a real video
// reports a finite duration. If assets/hero-pagoda.* is missing (404) the
// loadedmetadata event never fires with a duration, so the hero silently stays
// in its light, text-forward mode — no empty pinned scroll, no poster flash.
function initHeroVideo() {
  if (!HAS_GSAP || REDUCED || !window.ScrollTrigger) return;
  const video = document.getElementById('heroVideo');
  const hero = document.getElementById('hero');
  if (!video || !hero) return;

  video.muted = true;      // required for programmatic play() on load
  video.playsInline = true;

  let built = false;
  const build = () => {
    if (built) return;
    const dur = video.duration;
    if (!dur || !isFinite(dur)) return; // no real video — keep light-mode hero
    built = true;

    // Kick the decoder so seeking stays smooth, then hold on the first frame.
    video.play().then(() => video.pause()).catch(() => {});
    video.currentTime = 0;

    hero.classList.add('is-video'); // reveal video + scrim, flip text to light

    // The scrubbed video owns hero motion now — drop the light-mode content drift
    // so two triggers don't fight over the same section.
    if (heroParallaxST) {
      heroParallaxST.kill();
      heroParallaxST = null;
      gsap.set('.hero__inner', { clearProps: 'transform' });
    }

    // Video plays as you scroll through the hero (not autoplay): currentTime is
    // tied to scroll progress, pinned for 1.5× viewport of scroll distance.
    gsap.to(video, {
      currentTime: dur,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=150%',
        scrub: 1,              // 1s smoothing lag, not instant-tied
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    // A pin was just inserted above the other pinned section (.why); let
    // ScrollTrigger recompute every start/end and pin-spacing in DOM order.
    ScrollTrigger.refresh();
  };

  if (video.readyState >= 1 && video.duration) build();
  else video.addEventListener('loadedmetadata', build, { once: true });
}

// Supporting hero copy (eyebrow, sub, CTAs…) — optional; the brand hero has none.
const heroBits = () => document.querySelectorAll('#hero .hero__eyebrow, #hero .hero__sub, #hero .hero__cta, #hero .hero__proof, #hero .hero__metrics > div');

/* ═══════ HERO scroll: the 3D model lifts away (the point-cloud OMVI dissolves itself) ═══════ */
function initHeroScroll() {
  if (!HAS_GSAP || REDUCED || !window.ScrollTrigger || !document.querySelector('.hero--brand')) return;
  gsap.to('.hero--brand .hero__stage', { yPercent: -14, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

// Standalone hero intro (used when no loader owns the hand-off).
function heroIntro() {
  const words = document.querySelectorAll('.hero__title .w');
  if (words.length) {
    gsap.set(words, { yPercent: 110, autoAlpha: 1, filter: 'blur(6px)' });
    gsap.to(words, { yPercent: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', stagger: 0.09 });
  }
  const bits = heroBits();
  if (bits.length) gsap.fromTo(bits,
    { y: 22, autoAlpha: 0, filter: 'blur(6px)' },
    { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.45 });
}

function heroReveal() {
  if (!HAS_GSAP || REDUCED) return;
  heroParallax();
  if (heroOwnedByPreloader) return; // the loader's timeline runs the intro
  heroIntro();
  document.dispatchEvent(new Event('ov:hero')); // wake the 3D model (scene3d.js)
}

/* ═══════ LOADER: the hero builds itself (home only) ═══════ */
// There is no separate splash screen. While the page loads, scene3d.js prints the
// point-cloud OMVI bottom-up with a crimson beam in step with real progress
// (canvas data-print); once ready the readout clears, the word glides down into
// place (data-settle), the 3D model spins in and the nav drops down.
function initLoader() {
  const hud = document.querySelector('.loader');
  if (!hud) return; // not the home page
  const root = document.documentElement;
  const canvas = document.querySelector('canvas[data-3d="omvi"]');
  const num = hud.querySelector('.loader__num');
  const bar = hud.querySelector('.loader__bar i');
  const lock = () => { document.body.style.overflow = 'hidden'; if (lenis) lenis.stop(); };
  const unlock = () => { document.body.style.overflow = ''; if (lenis) lenis.start(); };
  const set = (key, v) => { if (canvas) canvas.dataset[key] = v.toFixed(4); };

  // No-motion / no-GSAP: skip the show and land on the finished hero.
  if (!HAS_GSAP || REDUCED) { hud.remove(); set('print', 1); set('settle', 1); return; }

  heroOwnedByPreloader = true; // heroReveal() skips its standalone intro
  root.classList.add('is-loading');
  lock();
  set('print', 0);
  set('settle', 0);

  const prog = { v: 0 };
  const paint = () => {
    set('print', prog.v);
    if (num) num.textContent = String(Math.round(prog.v * 100)).padStart(3, '0');
    if (bar) bar.style.transform = `scaleX(${prog.v.toFixed(4)})`;
  };
  gsap.fromTo(Array.from(hud.children), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.08 });
  // Real progress: creep toward 90% while assets load, finish once the page is ready.
  gsap.to(prog, { v: 0.9, duration: 2.8, ease: 'power1.out', onUpdate: paint });

  whenReady().then(() => {
    gsap.killTweensOf(prog);
    const settle = { v: 0 };
    const tl = gsap.timeline({ onComplete: () => { hud.remove(); unlock(); } });
    tl.to(prog, { v: 1, duration: 0.8, ease: 'power2.out', onUpdate: paint })
      .to({}, { duration: 0.35 }) // a held beat on the finished word
      .to(hud, { autoAlpha: 0, y: 14, duration: 0.5, ease: 'power2.in' })
      .add(() => {
        root.classList.remove('is-loading');
        document.dispatchEvent(new Event('ov:hero')); // the 3D model spins in (scene3d.js)
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      }, '<0.15')
      .to(settle, { v: 1, duration: 1.7, ease: 'expo.inOut', onUpdate: () => set('settle', settle.v) }, '<')
      .fromTo('#nav', { yPercent: -170 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', clearProps: 'transform' }, '<0.6');
  });
}

/* ═══════ masked heading reveals ═══════ */
function initHeadings() {
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED) return;
  document.querySelectorAll('.phd__title, .contact__title, .regd__h, .statement__line, .sec-head__title, .sync__title, .sdetail__t, .intro__title').forEach((el) => {
    const words = splitMask(el);
    gsap.set(el, { autoAlpha: 1 });
    gsap.set(words, { yPercent: 110 });
    gsap.to(words, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.07,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  // metric counters outside the signal strip count up as they scroll in
  document.querySelectorAll('.hero__metrics [data-count]').forEach((c) => {
    const target = +c.dataset.count, pad = +(c.dataset.pad || 0), o = { v: 0 };
    const paint = () => { c.textContent = String(Math.round(o.v)).padStart(pad, '0'); };
    paint();
    gsap.to(o, { v: target, duration: 1.6, ease: 'power3.out', onUpdate: paint, scrollTrigger: { trigger: c, start: 'top 95%', once: true } });
  });
  document.querySelectorAll('.sig__num').forEach((el) => {
    const counter = el.querySelector('[data-count]');
    if (counter) {
      // number stats flip up in 3D, then count from zero
      const target = +counter.dataset.count, pad = +(counter.dataset.pad || 0), o = { v: 0 };
      const paint = () => { counter.textContent = String(Math.round(o.v)).padStart(pad, '0'); };
      paint();
      gsap.set(el, { autoAlpha: 1 });
      const st = { trigger: '.signal', start: 'top 80%', once: true };
      gsap.fromTo(el, { rotationX: -95, transformPerspective: 700, transformOrigin: '50% 100%', autoAlpha: 0 },
        { rotationX: 0, autoAlpha: 1, duration: 1.3, ease: 'expo.out', scrollTrigger: st });
      gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: paint, scrollTrigger: st });
      return;
    }
    const words = splitMask(el);
    gsap.set(el, { autoAlpha: 1 });
    gsap.set(words, { yPercent: 110 });
    gsap.to(words, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.05,
      scrollTrigger: { trigger: '.signal', start: 'top 80%', once: true } });
  });
}

/* ═══════ SIGNAL labels rise ═══════ */
function initSignal() {
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED) return;
  gsap.utils.toArray('.sig__label').forEach((el, i) => {
    gsap.fromTo(el, { y: 24, autoAlpha: 0, filter: 'blur(6px)' },
      { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out', delay: 0.1 + i * 0.08,
        scrollTrigger: { trigger: '.signal', start: 'top 78%', once: true } });
  });
}

/* ═══════ WORK: clip wipe + image scale + masked title + content stagger ═══════ */
function initWork() {
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED) return;
  gsap.utils.toArray('.proj').forEach((proj) => {
    const media = proj.querySelector('.proj__media-inner');
    const ph = proj.querySelector('.proj__ph');
    const title = proj.querySelector('.proj__title');
    // Tags animate on their own fast stagger (below), so keep them out of the
    // general content group.
    const bits = proj.querySelectorAll('.proj__name, .proj__desc, .proj__link');
    const fromRight = proj.classList.contains('proj--right');

    // clip wipe
    gsap.set(media, { clipPath: fromRight ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' });
    gsap.to(media, { clipPath: 'inset(0 0% 0 0%)', duration: 1.15, ease: 'power4.inOut',
      scrollTrigger: { trigger: proj, start: 'top 74%', once: true } });
    // 3D swing-in: the card turns toward the viewer as the wipe opens
    const card = proj.querySelector('.proj__media');
    if (card) gsap.fromTo(card,
      { rotationY: fromRight ? -22 : 22, rotationX: 10, z: -120, transformPerspective: 1400, transformOrigin: fromRight ? '100% 50%' : '0% 50%' },
      { rotationY: 0, rotationX: 0, z: 0, duration: 1.6, ease: 'expo.out',
        scrollTrigger: { trigger: proj, start: 'top 74%', once: true } });
    // image scale settle behind the wipe (clamped to the 1.2s ceiling)
    if (ph) {
      gsap.fromTo(ph, { scale: 1.18 }, { scale: 1, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: proj, start: 'top 74%', once: true } });
      // continuous parallax
      gsap.fromTo(ph, { yPercent: -6 }, { yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: proj, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
    // masked title — expo.out for the slow editorial settle
    if (title) {
      const words = splitMask(title);
      gsap.set(title, { autoAlpha: 1 });
      gsap.set(words, { yPercent: 110 });
      gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06, delay: 0.12,
        scrollTrigger: { trigger: proj, start: 'top 74%', once: true } });
    }
    // content bits
    gsap.fromTo(bits, { y: 28, autoAlpha: 0, filter: 'blur(6px)' },
      { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.2,
        scrollTrigger: { trigger: proj, start: 'top 74%', once: true } });
    // tags: wrap each label in its own span, then a fast individual stagger —
    // reads like a typewriter tick (separator dashes are left in place).
    const tagP = proj.querySelector('.proj__tags');
    if (tagP) {
      Array.from(tagP.childNodes).forEach((node) => {
        if (node.nodeType === 3) {
          const label = node.textContent.trim();
          if (!label) { node.remove(); return; }
          const span = document.createElement('span');
          span.className = 'proj__tag';
          span.textContent = label;
          tagP.replaceChild(span, node);
        }
      });
      const tags = tagP.querySelectorAll('.proj__tag');
      gsap.set(tags, { autoAlpha: 0, y: 8 });
      gsap.to(tags, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', delay: 0.5,
        scrollTrigger: { trigger: proj, start: 'top 74%', once: true } });
    }
  });
}

/* ═══════ WHY: horizontal pin + line reveals ═══════ */
function initWhy() {
  const section = document.querySelector('.why');
  const track = document.querySelector('.why__track');
  if (!section || !track) return;
  const mobile = () => innerWidth <= 820;
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED || mobile()) { section.classList.add('is-stacked'); return; }

  const panels = gsap.utils.toArray('.hpanel');
  const distance = () => track.scrollWidth - innerWidth;
  const hTween = gsap.to(track, {
    x: () => -distance(), ease: 'none',
    scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
  });
  panels.forEach((p) => {
    const line = p.querySelector('.hpanel__line');
    gsap.fromTo(line, { rotationX: -70, y: 40, autoAlpha: 0, transformPerspective: 1200, transformOrigin: '50% 100%' },
      { rotationX: 0, y: 0, autoAlpha: 1, duration: 1.3, ease: 'expo.out',
        scrollTrigger: { trigger: p, containerAnimation: hTween, start: 'left 68%', once: true } });
  });
}

/* ═══════ generic rise ═══════ */
function initGeneric() {
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED) return;
  gsap.utils.toArray('[data-anim="rise"]').forEach((el) => {
    gsap.to(el, { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
}

/* ═══════ tech strip: letter-spacing breathe-in ═══════ */
// Tracking expands from tight (0.02em) to the CSS-final wide value as it enters.
function initTech() {
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED) return;
  const line = document.querySelector('.tech__line');
  if (!line) return;
  gsap.from(line, { opacity: 0, letterSpacing: '0.02em', duration: 1, ease: 'power2.out',
    scrollTrigger: { trigger: line, start: 'top 90%', once: true } });
}

/* ═══════ marquee: seamless keyword loop ═══════ */
// Two identical groups; translate the track by exactly one group width and loop.
// Continuous ambient motion (like the parallax/skew), paused under reduced-motion.
function initMarquee() {
  if (!HAS_GSAP || REDUCED) return;
  const track = document.querySelector('.marquee__track');
  if (!track) return;
  const loop = gsap.to(track, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
  // Nudge speed with scroll velocity for a live, reactive feel.
  if (lenis) lenis.on('scroll', (inst) => {
    const boost = 1 + Math.min(3, Math.abs((inst.velocity || 0) * 0.06));
    gsap.to(loop, { timeScale: boost, duration: 0.4, overwrite: true });
  });
}

/* ═══════ approach: masked word fill-in ═══════ */
function initApproach() {
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED) return;
  document.querySelectorAll('.approach__copy').forEach((copy) => {
    const words = splitMask(copy);
    gsap.set(copy, { autoAlpha: 1 });
    gsap.set(words, { yPercent: 110 });
    gsap.to(words, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.025,
      scrollTrigger: { trigger: copy, start: 'top 82%', once: true } });
  });
}

/* ═══════ scroll-velocity skew (the signature premium micro-motion) ═══════ */
function initSkew() {
  if (!HAS_GSAP || REDUCED || !lenis) return;
  const targets = gsap.utils.toArray('.proj, .sig__item, .svcd, .regd__card, .proc__row, .cdetails');
  if (!targets.length) return;
  const setters = targets.map((t) => gsap.quickTo(t, 'skewY', { duration: 0.5, ease: 'power3' }));
  lenis.on('scroll', (inst) => {
    const v = Math.max(-2.4, Math.min(2.4, (inst.velocity || 0) * 0.05));
    setters.forEach((fn) => fn(v));
  });
}

/* ═══════ nav hide + overlay ═══════ */
function initNav() {
  const nav = document.getElementById('nav');
  const menuBtn = document.getElementById('menuBtn');
  const overlay = document.getElementById('overlay');
  if (HAS_GSAP && window.ScrollTrigger && nav) {
    let last = 0;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 40);
      if (!overlay || !overlay.classList.contains('is-open')) {
        if (y > last && y > 500) nav.classList.add('is-hidden'); else nav.classList.remove('is-hidden');
      }
      last = y;
    }});
  }
  if (menuBtn && overlay) {
    const toggle = (open) => {
      overlay.classList.toggle('is-open', open);
      menuBtn.textContent = open ? 'Close' : 'Menu';
      menuBtn.setAttribute('aria-expanded', String(open));
      if (lenis) open ? lenis.stop() : lenis.start();
    };
    menuBtn.addEventListener('click', () => toggle(!overlay.classList.contains('is-open')));
    overlay.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggle(false)));
  }
}

function initActiveNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll('.nav__link').forEach((a) => { if (a.getAttribute('href') === page + '.html') a.classList.add('is-active'); });
}

/* ═══════ contact toggle (sliding underline) ═══════ */
function initContact() {
  const sw = document.querySelector('.switch');
  const btns = document.querySelectorAll('.switch button');
  const lines = { whatsapp: document.getElementById('waLine'), email: document.getElementById('emLine') };
  if (!btns.length) return;

  // With GSAP: one underline slides between tabs. Without it, the CSS per-button
  // ::after fallback stays in charge (see .switch button::after).
  let underline = null;
  if (HAS_GSAP && sw) {
    sw.classList.add('has-slider');
    underline = document.createElement('span');
    underline.className = 'toggle-underline';
    sw.appendChild(underline);
  }

  let placed = false; // first placement is instant; later switches slide
  const place = (btn) => {
    if (!underline || !btn) return;
    const b = btn.getBoundingClientRect();
    const p = btn.parentElement.getBoundingClientRect();
    const vars = { x: b.left - p.left, width: b.width };
    if (placed) gsap.to(underline, { ...vars, duration: 0.5, ease: 'power3.inOut' });
    else gsap.set(underline, vars);
    placed = true;
  };

  const select = (key) => {
    btns.forEach((b) => {
      b.classList.toggle('is-active', b.dataset.tab === key);
      b.setAttribute('aria-selected', String(b.dataset.tab === key));
    });
    Object.entries(lines).forEach(([k, el]) => el && el.classList.toggle('is-shown', k === key));
    place(Array.from(btns).find((b) => b.dataset.tab === key));
  };
  btns.forEach((b) => {
    const line = lines[b.dataset.tab];
    if (line) b.setAttribute('aria-controls', line.id);
    b.addEventListener('click', () => select(b.dataset.tab));
  });
  select('whatsapp');

  // Re-measure once fonts settle (button widths shift) and on resize.
  const recompute = () => { placed = false; place(sw.querySelector('button.is-active')); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(recompute);
  addEventListener('resize', recompute);
}

/* ═══════ WORK LIST (accordion rows, cursor-follow preview) ═══════ */
function initWorkList() {
  const list = document.querySelector('.wlist');
  if (!list) return;
  const preview = list.querySelector('.wpreview');
  const img = preview && preview.querySelector('img');
  const items = list.querySelectorAll('.witem');
  if (!preview || !img || TOUCH) return;

  let mx = 0, my = 0, x = 0, y = 0, active = false;
  addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
  if (HAS_GSAP) {
    gsap.ticker.add(() => {
      x += (mx - x) * 0.16; y += (my - y) * 0.16;
      preview.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${active ? 1 : 0.92})`;
    });
  }

  items.forEach((item) => {
    item.addEventListener('mouseenter', () => {
      active = true;
      img.src = item.dataset.img || '';
      if (HAS_GSAP) gsap.to(preview, { autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
      else preview.style.opacity = 1;
    });
    item.addEventListener('mouseleave', () => {
      active = false;
      if (HAS_GSAP) gsap.to(preview, { autoAlpha: 0, duration: 0.35, ease: 'power2.in' });
      else preview.style.opacity = 0;
    });
  });
}

/* ═══════ 3D flip-in rows (services, process, regional cards, contact details) ═══════ */
// Rows hinge down from their top edge like cards being dealt onto the table.
function initFlip3D() {
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED) return;
  const groups = [
    ['.svcd-list', '.svcd', { rotationX: -75, transformOrigin: '50% 0%' }],
    ['.proc', '.proc__row', { rotationX: -60, transformOrigin: '50% 0%' }],
    ['.regd__grid', '.regd__card', { rotationY: 35, z: -80, transformOrigin: '0% 50%' }],
    ['.cdetails', '.cblock', { rotationX: -50, transformOrigin: '50% 0%' }],
    ['.brief__aside', '.cblock', { rotationX: -50, transformOrigin: '50% 0%' }],
    ['.svcgrid__grid', '.scard', { rotationX: -55, z: -60, transformOrigin: '50% 0%' }],
    ['.cards3', '.card', { rotationY: 32, z: -90, transformOrigin: '0% 50%' }],
    ['.faq__list', '.faq__item', { rotationX: -60, transformOrigin: '50% 0%' }],
  ];
  groups.forEach(([parentSel, itemSel, from]) => {
    document.querySelectorAll(parentSel).forEach((parent) => {
      const items = parent.querySelectorAll(itemSel);
      if (!items.length) return;
      gsap.fromTo(items, { ...from, autoAlpha: 0, transformPerspective: 1100 },
        { rotationX: 0, rotationY: 0, z: 0, autoAlpha: 1, duration: 1.2, ease: 'expo.out', stagger: 0.09,
          scrollTrigger: { trigger: parent, start: 'top 82%', once: true } });
    });
  });
  // detail-row stages swing toward the reader, alternating sides
  document.querySelectorAll('.sdetail__media').forEach((el) => {
    const flip = el.closest('.sdetail--flip');
    gsap.fromTo(el, { rotationY: flip ? -24 : 24, rotationX: 8, z: -140, autoAlpha: 0, transformPerspective: 1400, transformOrigin: flip ? '100% 50%' : '0% 50%' },
      { rotationY: 0, rotationX: 0, z: 0, autoAlpha: 1, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });
  // case-study hero frame + signal cells rise out of depth
  document.querySelectorAll('.cs-hero__frame').forEach((el) => {
    gsap.fromTo(el, { rotationX: 24, z: -160, autoAlpha: 0, transformPerspective: 1600, transformOrigin: '50% 100%' },
      { rotationX: 0, z: 0, autoAlpha: 1, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
}

/* ═══════ 3D pointer tilt + glare on cards ═══════ */
function initTilt() {
  if (TOUCH || !HAS_GSAP || REDUCED) return;
  document.querySelectorAll('.proj__media, .regd__card, .cs-hero__frame, .card, .sdetail__media').forEach((el) => {
    const max = el.classList.contains('cs-hero__frame') ? 4 : el.classList.contains('sdetail__media') ? 6 : 9;
    el.classList.add('tilt');
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      gsap.to(el, { rotationY: (px - 0.5) * max * 2, rotationX: (0.5 - py) * max * 2, z: 24,
        transformPerspective: 1000, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
    });
    el.addEventListener('mouseleave', () => gsap.to(el, { rotationX: 0, rotationY: 0, z: 0, duration: 1.1, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' }));
  });
}

/* ═══════ OFFLINE-FIRST STORY: pinned scroll drives the 3D sync scene ═══════ */
function initSync() {
  const sec = document.querySelector('.sync');
  if (!sec) return;
  const canvas = sec.querySelector('canvas');
  const steps = sec.querySelectorAll('.sync__step');
  const bar = sec.querySelector('.sync__bar');
  const set = (p) => {
    if (canvas) canvas.dataset.progress = p.toFixed(4);
    const idx = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
    steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
    if (bar) bar.style.setProperty('--p', p.toFixed(4));
  };
  if (!HAS_GSAP || !window.ScrollTrigger || REDUCED) {
    // no pin: show all three steps and a single still frame mid-story
    sec.classList.add('is-static');
    set(0.5);
    document.dispatchEvent(new Event('ov:progress'));
    return;
  }
  set(0);
  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: '+=220%', pin: sec.querySelector('.sync__pin'), anticipatePin: 1,
    onUpdate: (self) => set(self.progress),
  });
}

/* ═══════ HERO status card: a till going offline, queueing, then syncing ═══════ */
function initHeroStatus() {
  const card = document.querySelector('.hero__status');
  if (!card) return;
  const label = card.querySelector('[data-status-label]');
  const queue = card.querySelector('[data-status-queue]');
  const bar = card.querySelector('.hero__status-bar i');
  const L = card.dataset;
  let tick = 0, queued = 0;
  const render = (state) => {
    card.classList.toggle('is-offline', state === 'offline');
    card.classList.toggle('is-syncing', state === 'syncing');
    label.textContent = L[state];
    queue.textContent = queued + ' ' + L.queued;
    bar.style.width = (state === 'online' ? 100 : state === 'offline' ? Math.min(100, queued * 9) : Math.max(4, 100 - queued * 9)) + '%';
  };
  render('online');
  if (REDUCED) return;
  setInterval(() => {
    tick = (tick + 1) % 13;
    let state;
    if (tick < 4) { state = 'online'; queued = 0; }
    else if (tick < 9) { state = 'offline'; queued += 1 + (tick % 2); }
    else { state = 'syncing'; queued = Math.max(0, queued - 3); }
    render(state);
  }, 1100);
}

/* ═══════ FAQ accordion ═══════ */
function initFaq() {
  const root = document.querySelector('.faq');
  if (!root) return;
  root.classList.add('js-faq');
  root.querySelectorAll('.faq__item').forEach((item) => {
    const q = item.querySelector('.faq__q'), a = item.querySelector('.faq__a');
    q.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      q.setAttribute('aria-expanded', String(open));
      a.style.height = open ? a.scrollHeight + 'px' : '0px';
    });
  });
  addEventListener('resize', () => root.querySelectorAll('.faq__item.is-open .faq__a').forEach((a) => { a.style.height = a.scrollHeight + 'px'; }));
}

/* ═══════ PROJECT BRIEF: compose a WhatsApp / email message (nothing is stored) ═══════ */
function initBrief() {
  const form = document.getElementById('brief');
  if (!form) return;
  const err = form.querySelector('.brief__error');
  const name = form.querySelector('[name="name"]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const who = (f.get('name') || '').trim();
    if (!who) {
      name.setAttribute('aria-invalid', 'true');
      if (err) err.hidden = false;
      name.focus();
      return;
    }
    name.removeAttribute('aria-invalid');
    if (err) err.hidden = true;
    const biz = (f.get('business') || '').trim();
    const needs = f.getAll('need');
    const msg = (f.get('message') || '').trim();
    const text = ['Hello OmniVora, I\'d like to discuss a project.', '',
      'Name: ' + who, biz ? 'Business: ' + biz : null, 'Interested in: ' + (needs.length ? needs.join(', ') : 'Not sure yet'),
      msg ? '\n' + msg : null].filter((line) => line !== null).join('\n');
    const via = e.submitter && e.submitter.value;
    if (via === 'email') {
      location.href = 'mailto:hello@omnivora.dev?subject=' + encodeURIComponent('Project inquiry — ' + (biz || who)) + '&body=' + encodeURIComponent(text);
    } else {
      window.open('https://wa.me/96170374702?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }
  });
}

/* ═══════ hovering a card spins its 3D model faster (scene3d reads data-hover) ═══════ */
function initMiniHover() {
  document.querySelectorAll('.scard, .sdetail').forEach((el) => {
    const c = el.querySelector('canvas[data-3d]');
    if (!c) return;
    el.addEventListener('mouseenter', () => { c.dataset.hover = '1'; });
    el.addEventListener('mouseleave', () => { c.dataset.hover = '0'; });
  });
}

/* ═══════ INIT ═══════ */
function initSpotlight() {
  if (TOUCH) return;
  document.querySelectorAll('.proj, .sig__item, .regd__card, .svcd').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

addEventListener('DOMContentLoaded', () => {
  initLenis();
  initTransitions();
  initNav();
  initActiveNav();
  initMagnetic();
  initContact();
  initSpotlight();
  initWorkList();
  initTilt();
  initHeroStatus();
  initFaq();
  initBrief();
  initMiniHover();

  if (HAS_GSAP) maskHero();
  initLoader(); // home only; sets heroOwnedByPreloader + locks scroll before reveals build

  const start = () => {
    heroReveal(); initHeroVideo(); initHeadings(); initSignal(); initMarquee(); initWork(); initSync(); initWhy(); initApproach(); initGeneric(); initTech(); initFlip3D(); initHeroScroll(); initSkew();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  };

  // gate reveals on fonts (with timeout guard) so masks measure correctly
  if (document.fonts && document.fonts.ready) {
    let done = false; const go = () => { if (done) return; done = true; start(); };
    document.fonts.ready.then(go); setTimeout(go, 1500);
  } else { start(); }

  addEventListener('load', () => HAS_GSAP && window.ScrollTrigger && ScrollTrigger.refresh());
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => HAS_GSAP && window.ScrollTrigger && ScrollTrigger.refresh(), 200); });
});
