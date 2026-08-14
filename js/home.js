/* ══════════════════════════════════════════════════
   OmniVora — Motion layer (premium tier)
   GSAP · ScrollTrigger · Lenis
   Masked reveals · page-transition wipes · scroll-velocity
   skew · image scale-on-scroll · magnetic · momentum cursor.
   ══════════════════════════════════════════════════ */

// Honor the OS/browser "reduce motion" setting by default. Append ?motion=on to
// the URL to force the full-motion experience for previewing, regardless of the
// system setting (does not change the default, accessible behavior).
const FORCE_MOTION = /[?&]motion=on\b/.test(location.search);
const REDUCED = !FORCE_MOTION && matchMedia('(prefers-reduced-motion: reduce)').matches;
// In preview mode, also lift the CSS reduce-motion suppressions (e.g. the hidden
// preloader) which the JS flag alone can't reach — see :root.force-motion rules.
if (FORCE_MOTION) document.documentElement.classList.add('force-motion');
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
  if (REDUCED || typeof Lenis === 'undefined') { anchor(); return; }
  lenis = new Lenis({ duration: 1.5, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.6 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  anchor();
}

/* ═══════ momentum cursor (ring 2.5x + invert) ═══════ */
function initCursor() {
  if (TOUCH || !HAS_GSAP) return;
  const cur = document.getElementById('cursor');
  const ring = document.getElementById('cursorRing');
  if (!cur) return;
  let mx = innerWidth / 2, my = innerHeight / 2, x = mx, y = my;
  addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
  gsap.ticker.add(() => { x += (mx - x) * 0.18; y += (my - y) * 0.18; ring.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`; });
  const hot = 'a, button, [data-cursor], .proj__media, .switch button';
  document.querySelectorAll(hot).forEach((el) => {
    el.addEventListener('mouseenter', () => cur.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => cur.classList.remove('is-hover'));
  });
}

/* ═══════ magnetic interactives ═══════ */
function initMagnetic() {
  if (TOUCH || !HAS_GSAP) return;
  document.querySelectorAll('[data-magnetic], .proj__link, .switch button, .nav__brand, .cblock a, .hero__cue').forEach((el) => {
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

// Standalone hero intro (used when no preloader owns the hand-off).
function heroIntro() {
  const words = document.querySelectorAll('.hero__title .w');
  gsap.set(words, { yPercent: 110, autoAlpha: 1, filter: 'blur(6px)' });
  gsap.to(words, { yPercent: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', stagger: 0.09 });
  gsap.fromTo('.hero__eyebrow, .hero__sub, .hero__foot-item, .hero__cue',
    { y: 22, autoAlpha: 0, filter: 'blur(6px)' },
    { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.45 });
}

function heroReveal() {
  if (!HAS_GSAP) return;
  heroParallax();
  if (heroOwnedByPreloader) return; // preloader's master timeline runs the intro
  heroIntro();
}

/* ═══════ PRELOADER → HERO master timeline (home only) ═══════ */
// Everything lives on one timeline so the hand-off into the hero is exact,
// not guessed via delay: values that drift out of sync. Runs only on the home
// page (the .preloader element exists) and only with motion enabled.
function initPreloader() {
  const pre = document.querySelector('.preloader');
  if (!pre) return; // not the home page
  const digit = pre.querySelector('.preloader-digit');
  const fill = pre.querySelector('.preloader-bar-fill');
  const markI = pre.querySelector('.preloader-mark__i');
  const mark = pre.querySelector('.preloader-mark');
  const tag = pre.querySelector('.preloader-tag');

  const lock = () => { document.body.style.overflow = 'hidden'; if (lenis) lenis.stop(); };
  const unlock = () => { document.body.style.overflow = ''; if (lenis) lenis.start(); };

  // No-motion / no-GSAP: never trap the viewer behind an opaque panel.
  if (!HAS_GSAP || REDUCED) { pre.remove(); unlock(); return; }

  heroOwnedByPreloader = true; // heroReveal() will skip its standalone intro
  lock();

  // Prep the hero to its hidden start-state now, while the panel still covers it.
  gsap.set('.hero__title .w', { yPercent: 110, autoAlpha: 1, filter: 'blur(6px)' });
  gsap.set('.hero__eyebrow, .hero__sub, .hero__foot-item, .hero__cue', { y: 22, autoAlpha: 0, filter: 'blur(6px)' });
  const statEl = document.querySelector('.hero__foot-item b'); // the "03" stat
  if (statEl) statEl.textContent = '00';

  // Explicit start clip so the exit wipe interpolates the bottom inset (not from `none`).
  gsap.set(pre, { clipPath: 'inset(0 0 0% 0)' });

  // Wordmark rises immediately — big, deliberate masked rise (hero language).
  gsap.set(markI, { yPercent: 100 });
  gsap.to(markI, { yPercent: 0, duration: 1.0, ease: 'expo.out' });
  // Tagline breathes in just after the wordmark lands.
  if (tag) { gsap.set(tag, { autoAlpha: 0, y: 10 });
    gsap.to(tag, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.55 }); }

  // Counter + bar are real progress: creep toward 92 while assets load, then the
  // master timeline below finishes them to 100 the moment the page is ready.
  // Counter is zero-padded to three digits (000 → 100) for an editorial readout.
  const prog = { v: 0 };
  const paint = () => { if (digit) digit.textContent = String(Math.floor(prog.v)).padStart(3, '0'); if (fill) fill.style.width = prog.v + '%'; };
  gsap.to(prog, { v: 92, duration: 2.4, ease: 'power1.out', onUpdate: paint });

  whenReady().then(() => {
    gsap.killTweensOf(prog);
    const stat = { v: 0 };

    const master = gsap.timeline({ onComplete: () => { pre.remove(); unlock(); } });

    // 1. Finish the count + bar to 100 from wherever the creep reached.
    master.to(prog, { v: 100, duration: 0.6, ease: 'power2.out', onUpdate: paint });
    // 2. A held beat of stillness at 100 — a deliberate pause, not an instant cut.
    master.to({}, { duration: 0.45 });
    // 3. Readouts (wordmark, tagline, count, bar) collapse up together.
    master.to([mark, tag, '.preloader-count', '.preloader-bar-track'].filter(Boolean),
      { autoAlpha: 0, yPercent: -20, duration: 0.5, ease: 'power3.in', stagger: 0.05 });
    // 4. Panel wipes up via clip-path (same wipe vocabulary as the Work reveals).
    master.to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 1.0, ease: 'power4.inOut' }, '-=0.2');
    // 5. Critical: refresh once the panel is clearing, before pin/scrub math matters.
    master.add(() => { if (window.ScrollTrigger) ScrollTrigger.refresh(); }, '-=0.55');
    // 6. Hero headline words, overlapping the tail of the wipe.
    //    expo.out = fmrg's signature "fast start, very slow finish" settle.
    master.to('.hero__title .w', { yPercent: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', stagger: 0.09 }, '-=0.45');
    // 7. Eyebrow / sub / foot / cue follow.
    master.to('.hero__eyebrow, .hero__sub, .hero__foot-item, .hero__cue',
      { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 1, ease: 'power3.out', stagger: 0.1 }, '-=0.75');
    // 8. The "03" stat counts up last, zero-padded to keep the editorial framing.
    if (statEl) master.to(stat, { v: 3, duration: 0.9, ease: 'power2.out', snap: { v: 1 },
      onUpdate: () => { statEl.textContent = String(Math.round(stat.v)).padStart(2, '0'); } }, '-=0.5');
  });
}

/* ═══════ masked heading reveals ═══════ */
function initHeadings() {
  if (!HAS_GSAP || !window.ScrollTrigger) return;
  document.querySelectorAll('.phd__title, .contact__title, .regd__h, .statement__line').forEach((el) => {
    const words = splitMask(el);
    gsap.set(el, { autoAlpha: 1 });
    gsap.set(words, { yPercent: 110 });
    gsap.to(words, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.07,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  document.querySelectorAll('.sig__num').forEach((el) => {
    const words = splitMask(el);
    gsap.set(el, { autoAlpha: 1 });
    gsap.set(words, { yPercent: 110 });
    gsap.to(words, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.05,
      scrollTrigger: { trigger: '.signal', start: 'top 80%', once: true } });
  });
}

/* ═══════ SIGNAL labels rise ═══════ */
function initSignal() {
  if (!HAS_GSAP || !window.ScrollTrigger) return;
  gsap.utils.toArray('.sig__label').forEach((el, i) => {
    gsap.fromTo(el, { y: 24, autoAlpha: 0, filter: 'blur(6px)' },
      { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out', delay: 0.1 + i * 0.08,
        scrollTrigger: { trigger: '.signal', start: 'top 78%', once: true } });
  });
}

/* ═══════ WORK: clip wipe + image scale + masked title + content stagger ═══════ */
function initWork() {
  if (!HAS_GSAP || !window.ScrollTrigger) return;
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
    gsap.fromTo(line, { y: 46, autoAlpha: 0, filter: 'blur(9px)' },
      { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: p, containerAnimation: hTween, start: 'left 68%', once: true } });
  });
}

/* ═══════ generic rise ═══════ */
function initGeneric() {
  if (!HAS_GSAP || !window.ScrollTrigger) return;
  gsap.utils.toArray('[data-anim="rise"]').forEach((el) => {
    gsap.to(el, { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
}

/* ═══════ tech strip: letter-spacing breathe-in ═══════ */
// Tracking expands from tight (0.02em) to the CSS-final wide value as it enters.
function initTech() {
  if (!HAS_GSAP || !window.ScrollTrigger) return;
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
  if (!HAS_GSAP || !window.ScrollTrigger) return;
  const copy = document.querySelector('.approach__copy');
  if (!copy) return;
  const words = splitMask(copy);
  gsap.set(copy, { autoAlpha: 1 });
  gsap.set(words, { yPercent: 110 });
  gsap.to(words, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.025,
    scrollTrigger: { trigger: copy, start: 'top 82%', once: true } });
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
    btns.forEach((b) => b.classList.toggle('is-active', b.dataset.tab === key));
    Object.entries(lines).forEach(([k, el]) => el && el.classList.toggle('is-shown', k === key));
    place(Array.from(btns).find((b) => b.dataset.tab === key));
  };
  btns.forEach((b) => b.addEventListener('click', () => select(b.dataset.tab)));
  select('whatsapp');

  // Re-measure once fonts settle (button widths shift) and on resize.
  const recompute = () => { placed = false; place(sw.querySelector('button.is-active')); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(recompute);
  addEventListener('resize', recompute);
}

/* ═══════ INIT ═══════ */
function injectGrain() { const g = document.createElement('div'); g.className = 'grain'; document.body.appendChild(g); }

addEventListener('DOMContentLoaded', () => {
  injectGrain();
  initLenis();
  initTransitions();
  initNav();
  initActiveNav();
  initCursor();
  initMagnetic();
  initContact();

  if (HAS_GSAP) maskHero();
  initPreloader(); // home only; sets heroOwnedByPreloader + locks scroll before reveals build

  const start = () => {
    heroReveal(); initHeroVideo(); initHeadings(); initSignal(); initMarquee(); initWork(); initWhy(); initApproach(); initGeneric(); initTech(); initSkew();
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
