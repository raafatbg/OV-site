# Generates the OmniVora static pages (site/*.html) from shared templates: head, nav,
# footer and page content. Run after editing copy or the shared layout:
#   python execution/build_site.py
# The output is plain HTML, committed to site/. Case-study pages are re-wrapped from
# their current site/case-*.html content.
import os, re, hashlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
SITE = 'https://omnivora.dev/'
WA = 'https://wa.me/96170374702'
WA_MSG_EN = WA + "?text=Hello%20OmniVora,%20I'd%20like%20to%20discuss%20a%20project."
INK = '#262626'  # line colour for 3D scenes on cream

def _ver(rel):
    # content hash → cache-busting query, so browsers never pair new HTML with stale CSS/JS
    with open(os.path.join(ROOT, rel), 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


VER = {'css': _ver('css/home.css'), 'home': _ver('js/home.js'), 'scene': _ver('js/scene3d.js')}

NAV = [('work', 'Work'), ('services', 'Services'), ('industries', 'Industries'), ('studio', 'Studio'), ('contact', 'Contact')]


def head(title, desc, path, B='', og_desc=None, jsonld=''):
    url = SITE + ('' if path == 'index.html' else path)
    og_desc = og_desc or desc
    return f"""<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <meta name="description" content="{desc}" />
  <link rel="icon" type="image/svg+xml" href="{B}assets/favicon.svg" />
  <link rel="canonical" href="{url}" />
  <meta name="theme-color" content="#1c1c1c" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="{url}" />
  <meta property="og:site_name" content="OmniVora" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{og_desc}" />
  <meta property="og:image" content="{SITE}assets/og-preview.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{og_desc}" />
  <meta name="twitter:image" content="{SITE}assets/og-preview.jpg" />{jsonld}

  <!-- Fonts: Fraunces (display) + Inter (UI/body) + IBM Plex Sans Arabic (Arabic names)
       + Archivo Expanded ExtraBold, subset to the logotype letters (OMNIVORA / OMVI) -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Inter:wght@300;400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,800&text=OMNIVRA&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="{B}css/home.css?v={VER['css']}" />
</head>"""


JSONLD = """
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"ProfessionalService","name":"OmniVora","url":"https://omnivora.dev/","logo":"https://omnivora.dev/assets/favicon.svg","image":"https://omnivora.dev/assets/og-preview.jpg","description":"Software engineering studio in Beirut building offline-first POS systems, mobile and web applications, and operational dashboards.","email":"hello@omnivora.dev","telephone":"+961 70 374 702","address":{"@type":"PostalAddress","addressLocality":"Beirut","addressCountry":"LB"},"areaServed":"LB","knowsLanguage":["en","ar"]}
  </script>"""


def nav(page, B=''):
    home = '#top' if page == 'home' else B + 'index.html'
    items = '\n'.join(f'      <a href="{B}{k}.html" class="nav__link">{v}</a>' for k, v in NAV)
    over = '\n'.join(f'    <a href="{B}{k}.html">{v}</a>' for k, v in NAV)
    return f"""  <a class="skip-link" href="#top">Skip to content</a>

  <header class="nav" id="nav">
    <a href="{home}" class="nav__brand" aria-label="OmniVora home">OMNIVORA<sup>•</sup></a>
    <nav class="nav__links" aria-label="Primary">
{items}
    </nav>
    <div class="nav__end">
      <a href="{B}contact.html" class="nav__cta">Start a project <i>→</i></a>
      <button class="nav__menu" id="menuBtn" aria-label="Menu" aria-expanded="false" aria-controls="overlay">Menu</button>
    </div>
  </header>

  <nav class="overlay" id="overlay" aria-label="Menu">
    <a href="{B}index.html">Home</a>
{over}
    <div class="overlay__meta">Beirut, Lebanon — +961 70 374 702</div>
  </nav>
"""


def footer(B=''):
    return f"""  <footer class="footer">
    <div class="footer__top">
      <div class="footer__brand">
        <p class="footer__word">Built to keep business <em>moving.</em></p>
        <p class="footer__blurb">OmniVora is a software engineering studio in Beirut, building offline-first POS systems, mobile &amp; web applications, and operational dashboards.</p>
      </div>
      <nav class="footer__col" aria-label="Footer">
        <h4>Studio</h4>
        {''.join(f'<a href="{B}{k}.html">{v}</a>' for k, v in NAV)}
      </nav>
      <div class="footer__col">
        <h4>Get in touch</h4>
        <a href="{WA}" target="_blank" rel="noopener">WhatsApp +961 70 374 702</a>
        <a href="mailto:hello@omnivora.dev">hello@omnivora.dev</a>
        <span>Beirut, Lebanon</span>
      </div>
    </div>
    <div class="footer__bottom">
      <span>© 2026 OmniVora. All rights reserved.</span>
      <span>33.8938°N, 35.5018°E</span>
    </div>
    <div class="footer__mark" aria-hidden="true"><span>OMNIVORA</span></div>
  </footer>"""


def scripts(B=''):
    return f"""
  <script src="{B}vendor/gsap.min.js"></script>
  <script src="{B}vendor/ScrollTrigger.min.js"></script>
  <script src="{B}js/home.js?v={VER['home']}"></script>
  <script src="{B}js/scene3d.js?v={VER['scene']}"></script>
</body>
</html>
"""


def cta(kicker, title_html):
    return f"""    <section class="contact" id="contact">
      <p class="contact__kicker" data-anim="rise">{kicker}</p>
      <h2 class="contact__title" data-anim="rise">{title_html}</h2>
      <div class="switch" role="tablist" aria-label="Contact method">
        <button data-tab="whatsapp" class="is-active" role="tab">WhatsApp</button>
        <button data-tab="email" role="tab">Email</button>
      </div>
      <div class="contact__reveal">
        <a class="contact__line is-shown" id="waLine" href="{WA_MSG_EN}" target="_blank" rel="noopener">wa.me / +961 70 374 702 <i>→</i></a>
        <a class="contact__line" id="emLine" href="mailto:hello@omnivora.dev">hello@omnivora.dev <i>→</i></a>
      </div>
    </section>"""


def phd(index, title_html, lede, kind, extra='', canvas_attrs=''):
    return f"""    <header class="phd">
      <canvas class="phd__3d" data-3d="{kind}" data-color="{INK}"{canvas_attrs} aria-hidden="true"></canvas>
      {extra}<p class="phd__index" data-anim="rise">{index}</p>
      <h1 class="phd__title" data-anim="rise">{title_html}</h1>
      <p class="phd__lede" data-anim="rise">{lede}</p>
    </header>"""


def sec_head(kicker, title_html, link=None, cls=''):
    l = f'\n        <a class="sec-head__link" href="{link[0]}">{link[1]}</a>' if link else ''
    return f"""      <div class="sec-head{cls}">
        <div>
          <p class="sec-head__kicker" data-anim="rise">{kicker}</p>
          <h2 class="sec-head__title">{title_html}</h2>
        </div>{l}
      </div>"""


def cards3(items, cls=''):
    cards = '\n'.join(f"""        <article class="card"><span class="card__n">{n}</span><h3 class="card__t">{t}</h3><p class="card__d">{d}</p></article>""" for n, t, d in items)
    return f"""      <div class="cards3{cls}">
{cards}
      </div>"""


def page(name, head_html, body_attrs, nav_html, main_html, foot_html, B='', pre=''):
    html = f"""{head_html}
<body{body_attrs}>
{pre}{nav_html}
  <main id="top">
{main_html}
  </main>

{foot_html}
{scripts(B)}"""
    open(os.path.join(ROOT, name), 'w', encoding='utf-8', newline='\n').write(html)
    print('wrote', name)


# ══════════════════════════ SHARED CONTENT ══════════════════════════
SERVICES = [
    ('pos', 'pos', '01', 'Point-of-sale systems', 'Offline-resilient tills, back-office and dual-currency reconciliation for retail and hospitality.'),
    ('apps', 'phone', '02', 'Mobile &amp; web apps', 'Flutter and web products that stay fast on patchy networks and feel native in Arabic and English.'),
    ('dashboards', 'bars', '03', 'Operational dashboards', 'Live revenue, stock and staff metrics across every branch — the numbers you need, when you need them.'),
    ('automation', 'neural', '04', 'AI &amp; automation', 'Catalogue indexing, smarter search and automated pipelines that take the busywork out of daily operations.'),
    ('payments', 'rails', '05', 'Payments &amp; integrations', 'Whish Pay, regional gateways, fiscal hardware, scanners, printers and the ERPs you already run.'),
    ('saas', 'stack', '06', 'Multi-tenant SaaS', 'Cloud platforms that serve many businesses from one product, each with isolated data and its own configuration.'),
]
def svcgrid(items, head_html, more):
    cards = '\n'.join(f'''        <a class="scard" href="services.html#{sid}">
          <canvas class="scard__3d" data-3d="{kind}" data-color="{INK}" data-scale="1.15" aria-hidden="true"></canvas>
          <span class="scard__n">{n}</span>
          <h3 class="scard__t">{t}</h3>
          <p class="scard__d">{d}</p>
          <span class="scard__more">{more}</span>
        </a>''' for sid, kind, n, t, d in items)
    return f'''    <section class="svcgrid" id="services">
{head_html}
      <div class="svcgrid__grid">
{cards}
      </div>
    </section>'''


PROJECTS = [
    ('left', 'VoraPOS — Terminal', 'assets/work-vorapos.jpg', 'VoraPOS dual-screen terminal inventory and sales dashboard', 'VoraPOS', '01',
     'Engineered for counter velocity', 'A high-speed desktop POS built for heavy-inventory retail: sub-second parts lookup, local transactional integrity and instant barcode processing.',
     ['Intelligent Parts Indexing', 'Offline-first', 'SQL Server', 'Desktop WPF'], 'case-vorapos.html'),
    ('right', 'Zaytouna — Hospitality Terminal', 'assets/work-zaytouna.jpg', 'Zaytouna Park touch POS ordering terminal with Lebanese restaurant menu', 'Zaytouna Park', '02',
     'Real-time venue &amp; kitchen orchestration', 'A synchronized hospitality POS connecting table orders, cashier terminals and kitchen displays with sub-second real-time state.',
     ['Flutter', 'Supabase', 'Realtime Sync', 'Kitchen Display'], 'case-zaytouna.html'),
    ('left', 'سلس — Multi-tenant', 'assets/work-sils.jpg', 'Sils multi-tenant cloud POS interface', 'Sils <span class="ar" dir="rtl">سلس</span>', '03',
     'Scalable multi-tenant retail SaaS', 'A cloud-native POS platform delivering isolated tenant environments, live analytics and Arabic-first workflows for retailers across Lebanon.',
     ['Multi-tenant', 'Flutter', 'Supabase', 'Arabic-first'], 'case-sils.html'),
]


def projects(items, link_label):
    out = []
    for side, tag, img, alt, name, idx, title, desc, tags, href in items:
        tagdir = ' dir="rtl"' if tag.startswith('سلس') else ''
        out.append(f'''      <article class="proj proj--{side}">
        <a class="proj__media" href="{href}" tabindex="-1" aria-hidden="true">
          <span class="proj__media-inner">
            <span class="proj__ph">
              <span class="proj__tag-media"{tagdir}>{tag}</span>
              <img src="{img}" alt="{alt}" loading="lazy" />
            </span>
          </span>
        </a>
        <div class="proj__content">
          <div class="proj__name"><span>{name}</span><span class="idx">{idx}</span></div>
          <h3 class="proj__title">{title}</h3>
          <p class="proj__desc">{desc}</p>
          <p class="proj__tags">{' <span>—</span> '.join(tags)}</p>
          <a href="{href}" class="proj__link">{link_label}</a>
        </div>
      </article>''')
    return '\n\n'.join(out)


def sync_section(kicker, title_html, steps):
    st = '\n'.join(f'''          <div class="sync__step{' is-active' if i == 0 else ''}">
            <span class="sync__n">{n}</span>
            <h3>{h}</h3>
            <p>{p}</p>
          </div>''' for i, (n, h, p) in enumerate(steps))
    return f'''    <section class="sync" id="offline">
      <div class="sync__pin">
        <div class="sync__copy">
          <p class="sync__kicker">{kicker}</p>
          <h2 class="sync__title">{title_html}</h2>
          <div class="sync__steps">
{st}
          </div>
          <div class="sync__bar" aria-hidden="true"><i></i></div>
        </div>
        <canvas class="sync__3d" data-3d="sync" data-progress="0" aria-hidden="true"></canvas>
      </div>
    </section>'''


# ══════════════════════════ HOME ══════════════════════════
home_main = f'''    <!-- ══════════ HERO (also the loader: the point-cloud OMVI prints while the page loads) ══════════ -->
    <section class="hero hero--brand" id="hero">
      <div class="hero__stage" aria-hidden="true">
        <canvas class="hero__3d" data-3d="eco" data-color="--hero-ink" data-glow="--hero-glow-3d" data-fit="hero" data-wait></canvas>
      </div>
      <canvas class="hero__omvi" data-3d="omvi" data-color="--hero-ink" data-glow="--hero-glow-3d" aria-hidden="true"></canvas>
      <div class="omvi-wrap">
        <h1 class="omvi">
          <span class="sr-only">OmniVora — software engineering studio in Beirut</span>
          <span class="omvi__inner" aria-hidden="true"><span class="omvi__word">OMVI<span class="omvi__dot"></span></span></span>
        </h1>
      </div>
      <div class="hero__scroll" aria-hidden="true"></div>
      <div class="loader" aria-hidden="true">
        <div class="loader__id">
          <span class="loader__brand">OMNIVORA<sup>•</sup></span>
          <span class="loader__tag">Software engineering studio — Beirut</span>
        </div>
        <div class="loader__count"><span class="loader__num">000</span><span class="loader__pct">%</span></div>
        <div class="loader__bar"><i></i></div>
      </div>
    </section>

    <!-- ══════════ INTRO ══════════ -->
    <section class="intro" id="intro">
      <div class="intro__grid">
        <div class="intro__copy">
          <span class="hero__eyebrow" data-anim="rise"><i></i>Accepting new projects — Beirut, Lebanon</span>
          <h2 class="intro__title">Software that keeps business <em class="accent">moving.</em></h2>
          <p class="hero__sub" data-anim="rise">We engineer POS systems, mobile apps and operational dashboards that keep trading through power cuts and peak-hour rushes — in Arabic and English, in dollars and lira.</p>
          <div class="hero__cta" data-anim="rise">
            <a href="contact.html" class="btn btn--primary">Start a project <i>→</i></a>
            <a href="work.html" class="btn btn--ghost">See our work</a>
          </div>
          <div class="hero__proof" data-anim="rise">
            <span>In production at</span>
            <ul>
              <li>VoraPOS</li>
              <li>Zaytouna Park</li>
              <li>Sils <span class="ar" dir="rtl">سلس</span></li>
            </ul>
          </div>
        </div>
        <div class="intro__visual" data-anim="rise">
          <canvas data-3d="globe" data-home="33.89,35.5" data-scale="1.02" aria-hidden="true"></canvas>
          <div class="hero__status" data-online="Online · in sync" data-offline="Offline · still trading" data-syncing="Back online · syncing" data-queued="queued" aria-hidden="true">
            <div class="hero__status-head"><span>Till 02 · Main branch</span><span class="hero__status-live">Live</span></div>
            <div class="hero__status-state"><i></i><span data-status-label>Online · in sync</span></div>
            <div class="hero__status-meta"><span>Sales queue</span><span data-status-queue>0 queued</span></div>
            <div class="hero__status-bar"><i></i></div>
          </div>
        </div>
      </div>
      <div class="hero__metrics">
        <div data-anim="rise"><b><span data-count="3" data-pad="2">03</span></b><span>Systems in production</span></div>
        <div data-anim="rise"><b>Offline-first</b><span>Sales never wait on Wi-Fi</span></div>
        <div data-anim="rise"><b>USD / LBP</b><span>Dual-currency native</span></div>
        <div data-anim="rise"><b>AR / EN</b><span>Right-to-left by design</span></div>
      </div>
    </section>

    <!-- ══════════ STATEMENT ══════════ -->
    <section class="statement">
      <p class="statement__line">When the connection drops, most systems stop. <em class="accent">Ours keep trading.</em></p>
    </section>

    <!-- ══════════ MARQUEE ══════════ -->
    <section class="marquee" aria-hidden="true">
      <div class="marquee__track">
        <span class="marquee__group">Offline-First Architecture <i>·</i> Real-Time Sync <i>·</i> Dual-Currency Pricing <i>·</i> Arabic-Native RTL <i>·</i> Omnichannel Commerce <i>·</i> Point-of-Sale <i>·</i> Web &amp; Mobile <i>·</i> Operations Dashboards <i>·</i></span>
        <span class="marquee__group">Offline-First Architecture <i>·</i> Real-Time Sync <i>·</i> Dual-Currency Pricing <i>·</i> Arabic-Native RTL <i>·</i> Omnichannel Commerce <i>·</i> Point-of-Sale <i>·</i> Web &amp; Mobile <i>·</i> Operations Dashboards <i>·</i></span>
      </div>
    </section>

    <!-- ══════════ WORK ══════════ -->
    <section class="work" id="work">
      <div class="work__head">
        <span class="work__kicker" data-anim="rise">Selected work</span>
        <span class="work__count" data-anim="rise">03 — in active production</span>
      </div>

{projects(PROJECTS, 'Read the case study <i>→</i>')}
    </section>

    <!-- ══════════ OFFLINE-FIRST STORY (pinned 3D) ══════════ -->
{sync_section('Offline-first, by design', 'What happens when the <em>internet drops?</em>', [
    ('01 — Online', 'Every sale syncs live', 'Terminals stream transactions to the cloud the moment they happen, so stock and revenue are always current — at every branch.'),
    ('02 — Connection lost', 'The till keeps trading', 'Sales, returns and stock moves commit locally and queue on the device. The cashier never sees a spinner; the customer never waits.'),
    ('03 — Back online', 'The queue flushes itself', 'When the line returns, queued transactions sync in order and the books reconcile automatically — no double entries, no paper logs.'),
])}

    <!-- ══════════ SERVICES ══════════ -->
{svcgrid(SERVICES, sec_head('Capabilities', 'What we <em>build</em>', ('services.html', 'All services →')), 'Explore <i>→</i>')}

    <!-- ══════════ WHY CLIENTS CALL (horizontal pin) ══════════ -->
    <section class="why" id="why">
      <span class="why__label">Problems we solve</span>
      <div class="why__track">
        <div class="hpanel"><p class="hpanel__line">Power cuts and network drops send your staff back to <b>paper logs</b></p></div>
        <div class="hpanel"><p class="hpanel__line">WhatsApp and delivery orders bypass the till and become <b>untracked revenue</b></p></div>
        <div class="hpanel"><p class="hpanel__line">Your Arabic interface is a broken translation, not a <b>native workflow</b></p></div>
        <div class="hpanel"><p class="hpanel__line">Your last vendor shipped brittle code and offered <b>zero accountability</b></p></div>
      </div>
    </section>

    <!-- ══════════ APPROACH ══════════ -->
    <section class="approach">
      <span class="approach__kicker" data-anim="rise">How we work</span>
      <p class="approach__copy">We start on your counter, not in a meeting room — learning how cash, stock and orders actually move. Then we engineer for that reality: <em>offline-first</em> so nothing stops, <em>omnichannel</em> so every WhatsApp and counter sale is captured, and <em>Arabic-native</em> so your team works at full speed.</p>
    </section>

    <!-- ══════════ CONTACT ══════════ -->
{cta('Start a project', "Let's talk about<br /><em>your build.</em>")}'''

page('index.html',
     head('OmniVora — Software Engineering Studio · Beirut',
          'OmniVora engineers offline-first POS systems, mobile &amp; web applications and operational dashboards for businesses in Lebanon — built for power cuts, dual currency and native Arabic workflows.',
          'index.html', og_desc='Offline-first POS systems, mobile &amp; web apps and operational dashboards — engineered in Beirut for real-world resilience.', jsonld=JSONLD),
     '', nav('home'), home_main, footer())


# ══════════════════════════ WORK ══════════════════════════
work_main = f'''{phd('(02) — Selected work', 'Case <em>studies</em>',
     'Production systems running across retail, hospitality and SaaS — engineered for offline resilience, dual-currency accounting and native Arabic workflows. Hover a project to preview it, or open one to read the full build.', 'knot')}

    <section class="wlist" id="work" aria-label="Selected work">
      <a class="witem" href="case-vorapos.html" data-img="assets/work-vorapos.jpg">
        <span class="witem__idx">01</span>
        <span class="witem__title">VoraPOS</span>
        <span class="witem__meta">Retail · Desktop WPF · Offline-first</span>
        <span class="witem__arrow">→</span>
      </a>
      <a class="witem" href="case-zaytouna.html" data-img="assets/work-zaytouna.jpg">
        <span class="witem__idx">02</span>
        <span class="witem__title">Zaytouna Park</span>
        <span class="witem__meta">Hospitality · Flutter · Realtime</span>
        <span class="witem__arrow">→</span>
      </a>
      <a class="witem" href="case-sils.html" data-img="assets/work-sils.jpg">
        <span class="witem__idx">03</span>
        <span class="witem__title">Sils <span class="ar" dir="rtl">سلس</span></span>
        <span class="witem__meta">SaaS · Multi-tenant · Supabase</span>
        <span class="witem__arrow">→</span>
      </a>
      <div class="wpreview" aria-hidden="true"><img alt="" /></div>
    </section>

    <section class="block">
{sec_head('What every build shares', 'Engineered for <em>here</em>')}
{cards3([
    ('A', 'Offline-first', 'Every system commits locally first and syncs when it can — power cuts and dropped lines never stop a sale.'),
    ('B', 'Dual-currency', 'USD and LBP pricing, change, exchange-rate updates and reconciliation are built into the data model, not bolted on.'),
    ('C', 'Arabic-native', 'Right-to-left layouts, bilingual receipts and Arabic search designed from the first wireframe.'),
])}
    </section>

{cta('Start a project', 'Have a project<br /><em>in mind?</em>')}'''

page('work.html',
     head('Work &amp; Case Studies — OmniVora',
          'Production systems engineered by OmniVora: VoraPOS, Zaytouna Park and Sils — offline-first POS, real-time hospitality and multi-tenant retail SaaS.', 'work.html'),
     ' data-page="work"', nav('work'), work_main, footer())


# ══════════════════════════ SERVICES ══════════════════════════
SERVICE_DETAIL = [
    ('pos', 'pos', '01 — Point-of-sale', 'POS that <em>never stops trading</em>',
     'Desktop and touch terminals engineered for counter speed: sub-second search, instant barcode scanning and local transactional integrity — so a power cut or dropped line never freezes the till.',
     ['Offline-first sales, returns and stock movements', 'USD / LBP pricing, change and end-of-day reconciliation', 'Receipt printers, barcode scanners and cash drawers', 'Back-office for stock, suppliers, users and permissions'],
     'C# / WPF — Flutter — SQL Server — Supabase', ('case-vorapos.html', 'See VoraPOS')),
    ('apps', 'phone', '02 — Mobile &amp; web', 'Apps that feel <em>native in both languages</em>',
     'Flutter and web applications for customers, staff and field teams — fast on mid-range phones, resilient on patchy networks and designed right-to-left from the first wireframe.',
     ['iOS, Android and web from one Flutter codebase', 'Offline caching with background sync', 'Arabic and English interfaces with proper RTL layouts', 'Ordering, loyalty, booking and staff tools'],
     'Flutter — Dart — Supabase — Web', ('case-zaytouna.html', 'See Zaytouna Park')),
    ('dashboards', 'bars', '03 — Dashboards', 'Numbers you can <em>act on</em>',
     'Real-time views of revenue, stock and staff performance across every branch, built on the same data your tills write — no exports, no spreadsheets, no waiting for month-end.',
     ['Live sales by branch, category, cashier and currency', 'Stock levels, movement and low-stock alerts', 'Shift, cash-drawer and reconciliation reports', 'Role-based access for owners, managers and accountants'],
     'Supabase — PostgreSQL — Realtime — Web', ('case-sils.html', 'See Sils')),
    ('automation', 'neural', '04 — AI &amp; automation', 'Less busywork, <em>more selling</em>',
     'Practical automation that earns its keep: intelligent catalogue indexing, smarter search and data pipelines that remove repetitive work from daily operations.',
     ['Intelligent parts and catalogue indexing', 'Typo-tolerant, bilingual product search', 'Automated imports, price updates and data clean-up', 'Assistants and workflows wired into your existing tools'],
     'AI agents — Data pipelines — Search', None),
    ('payments', 'rails', '05 — Payments &amp; integrations', 'Wired into <em>how Lebanon pays</em>',
     'Direct integrations with Whish Pay and regional gateways, fiscal hardware and the ERPs you already rely on — so money and data move without double entry.',
     ['Whish Pay and regional payment gateways', 'Fiscal printers and counter hardware', 'Third-party ERP and accounting sync', 'Webhooks and APIs for your own systems'],
     'Whish Pay — Gateways — ERP — APIs', None),
    ('saas', 'stack', '06 — Multi-tenant SaaS', 'One platform, <em>many businesses</em>',
     'Cloud platforms that serve many clients from one product: isolated tenant data, per-business configuration and live analytics — engineered to scale without rebuilding for every customer.',
     ['Tenant isolation enforced at the data layer', 'Per-tenant branding, settings and roles', 'Self-serve onboarding for new businesses', 'Operator analytics across every tenant'],
     'Multi-tenant — Flutter — Supabase — PostgreSQL', ('case-sils.html', 'See Sils')),
]


def sdetail(i, sid, kind, n, t, d, body_html, tags, link):
    flip = ' sdetail--flip' if i % 2 else ''
    l = f'\n          <a class="sdetail__link" href="{link[0]}">{link[1]} <i>→</i></a>' if link else ''
    tg = f'\n          <p class="sdetail__tags">{tags}</p>' if tags else ''
    return f'''    <section class="sdetail{flip}" id="{sid}">
      <div class="sdetail__media"><canvas data-3d="{kind}" data-color="{INK}" data-scale="1.35" aria-hidden="true"></canvas></div>
      <div class="sdetail__body">
        <span class="sdetail__n">{n}</span>
        <h2 class="sdetail__t">{t}</h2>
        <p class="sdetail__d">{d}</p>
{body_html}{tg}{l}
      </div>
    </section>'''


def ul(items, cls='sdetail__list'):
    return f'        <ul class="{cls}">\n' + '\n'.join(f'          <li>{x}</li>' for x in items) + '\n        </ul>'


services_main = phd('(03) — Services', 'What we <em>build</em>',
                    "Full-lifecycle product engineering for businesses that can't afford downtime — from the till on your counter to the dashboard on your phone. Senior engineers, end-to-end accountability.", 'geo') + '\n\n'
services_main += '\n\n'.join(sdetail(i, sid, kind, n, t, d, ul(lst), tags, link) for i, (sid, kind, n, t, d, lst, tags, link) in enumerate(SERVICE_DETAIL))
services_main += f'''

    <section class="proc">
{sec_head('Our process', 'Four <em>phases</em>', cls=' sec-head--flush')}
      <div class="proc__row"><span class="proc__s">01</span><h3 class="proc__n">Discovery &amp; scoping</h3><p class="proc__d">We map your operation — counter flow, stock movement, cash and reconciliation — and define the architecture before a line of code is written.</p></div>
      <div class="proc__row"><span class="proc__s">02</span><h3 class="proc__n">Design &amp; architecture</h3><p class="proc__d">Right-to-left interfaces, fast cashier workflows and fault-tolerant data models, validated with the people who will use them every day.</p></div>
      <div class="proc__row"><span class="proc__s">03</span><h3 class="proc__n">Engineering</h3><p class="proc__d">Senior engineers build in clear milestones with Flutter, C#/WPF and modern backends — offline sync designed in from the foundation, not patched on.</p></div>
      <div class="proc__row"><span class="proc__s">04</span><h3 class="proc__n">Launch &amp; support</h3><p class="proc__d">On-site setup, staff onboarding and active monitoring after go-live, so the system stays fast and stable long after launch day.</p></div>
    </section>

    <section class="block">
{sec_head('Ways to work with us', 'Engagement <em>models</em>')}
{cards3([
    ('01', 'Fixed-scope build', 'A defined product with a clear scope and milestone plan, agreed up front after discovery. Best when you know what you need.'),
    ('02', 'Product partnership', 'A senior team shipping continuously alongside you — for products that keep evolving with your business.'),
    ('03', 'Care &amp; support', 'Monitoring, updates and priority fixes for systems already in production — ones we built, or ones you inherited.'),
])}
    </section>

{cta('Start a project', "Let's scope<br /><em>your build.</em>")}'''

page('services.html',
     head('Services — POS, Apps, Dashboards &amp; Integrations — OmniVora',
          'OmniVora services: offline-first POS systems, mobile &amp; web apps, operational dashboards, AI automation, payment integrations and multi-tenant SaaS platforms.', 'services.html'),
     ' data-page="services"', nav('services'), services_main, footer())


# ══════════════════════════ INDUSTRIES ══════════════════════════
INDUSTRIES = [
    ('retail', 'pos', '01 — Retail &amp; spare parts', 'Heavy catalogues, <em>fast counters</em>',
     'Parts stores, hardware and specialist retail live and die by how fast the counter moves. We build tills that find any item in under a second and keep selling when the power goes.',
     ['Thousands of SKUs and part numbers', 'Queues at the counter during rush hour', 'Power and network drops mid-sale'],
     ['Sub-second parts and barcode lookup', 'Offline-first tills with local integrity', 'Dual-currency pricing and reconciliation'], ('case-vorapos.html', 'See VoraPOS')),
    ('hospitality', 'neural', '02 — Restaurants, cafés &amp; venues', 'Floor, till and kitchen <em>in sync</em>',
     'A busy service depends on timing. We connect tables, cashiers and kitchen screens so every order lands in the right place, the moment it is taken.',
     ['Orders lost between table and kitchen', 'WhatsApp and delivery orders off the books', 'Peak-hour pressure on a small team'],
     ['Table ordering and cashier terminals', 'Real-time kitchen display routing', 'Every channel captured in one system'], ('case-zaytouna.html', 'See Zaytouna Park')),
    ('chains', 'globe', '03 — Multi-branch &amp; chains', 'Every branch, <em>one picture</em>',
     'Growing past one location multiplies the blind spots. We give owners one live view of stock, cash and performance across every branch.',
     ['Stock and cash scattered across locations', 'Pricing that drifts between branches', 'Reports that arrive weeks too late'],
     ['Central back-office with per-branch control', 'Live dashboards across every location', 'Branch-level permissions and audit trails'], ('services.html#dashboards', 'Operational dashboards')),
    ('saas', 'stack', '04 — SaaS &amp; platform operators', 'Your product, <em>many tenants</em>',
     'If you sell software to other businesses, we engineer the platform underneath: one product, cleanly isolated per customer, ready to onboard the next.',
     ["Serving many clients without custom builds", "Keeping each client's data strictly apart", 'Onboarding new businesses quickly'],
     ['Multi-tenant architecture with isolation', 'Per-tenant configuration and branding', 'Operator analytics across tenants'], ('case-sils.html', 'See Sils')),
    ('memberships', 'phone', '05 — Gyms, clubs &amp; services', 'Members, bookings, <em>renewals</em>',
     'Membership businesses run on recurring relationships. We replace paper cards and notebook bookings with systems that track every member and every renewal.',
     ['Manual check-ins and paper membership cards', 'Missed renewals and unpaid subscriptions', 'Bookings split across WhatsApp and notebooks'],
     ['Membership, check-in and subscription tracking', 'Booking and scheduling apps', 'Renewal reminders in Arabic and English'], ('contact.html', 'Talk to us')),
]


def ind_cols(challenge, build):
    return f'''        <div class="ind__cols">
          <div><h4 class="ind__h">The challenge</h4>
{ul(challenge, 'sdetail__list')}
          </div>
          <div><h4 class="ind__h">What we build</h4>
{ul(build, 'sdetail__list sdetail__list--accent')}
          </div>
        </div>'''


industries_main = phd('(04) — Industries', 'Built for <em>how you trade</em>',
                      'Every sector runs on a different rhythm. We design around yours — from a spare-parts counter at rush hour to a restaurant floor on a Saturday night.', 'stack') + '\n\n'
industries_main += '\n\n'.join(sdetail(i, sid, kind, n, t, d, ind_cols(ch, bu), '', link) for i, (sid, kind, n, t, d, ch, bu, link) in enumerate(INDUSTRIES))
industries_main += f'''

    <section class="block">
{sec_head('Whatever the sector', 'Built for <em>Lebanon</em>')}
{cards3([
    ('A', 'Power cuts? Keep selling.', 'Offline-first by default. Every transaction commits locally and syncs the moment the connection returns.'),
    ('B', 'Two currencies, one ledger.', 'USD and LBP handled natively — pricing, change, exchange-rate updates and end-of-day reconciliation.'),
    ('C', 'Arabic, not translated.', 'Interfaces designed right-to-left from the start, with bilingual receipts your customers can read.'),
])}
    </section>

{cta("Don't see your sector?", "Let's talk about<br /><em>your operation.</em>")}'''

page('industries.html',
     head('Industries — Retail, Hospitality, Chains &amp; SaaS — OmniVora',
          'OmniVora builds software for retail and spare-parts stores, restaurants and venues, multi-branch chains, SaaS operators and membership businesses in Lebanon.', 'industries.html'),
     ' data-page="industries"', nav('industries'), industries_main, footer())


# ══════════════════════════ STUDIO ══════════════════════════
studio_main = f'''{phd('(05) — Studio', 'Built for <em>here.</em>',
     'A software engineering studio based in Beirut. We build high-reliability products for the operational realities of our region — and we stay accountable for them long after launch.', 'globe', canvas_attrs=' data-home="33.89,35.5" data-scale="1.1"')}

    <section class="manifesto">
      <p class="manifesto__idx" data-anim="rise">Our philosophy</p>
      <p class="manifesto__copy" data-anim="rise">Off-the-shelf software assumes one currency, stable power and a fast connection. We engineer for the real world: <em>dual-currency accounting</em>, native Arabic workflows, intermittent connectivity and local payment rails are core requirements — never afterthoughts.</p>
    </section>

    <section class="regd">
      <div class="regd__head">
        <p class="regd__kicker" data-anim="rise">Regional expertise</p>
        <h2 class="regd__h" data-anim="rise">Why it <em>matters</em></h2>
      </div>
      <div class="regd__grid">
        <article class="regd__card"><span class="regd__n">A</span><h3 class="regd__t">Offline-first architecture</h3><p class="regd__d">Transactions, stock records and orders queue locally through network or power drops, then synchronise automatically the instant the connection returns.</p></article>
        <article class="regd__card"><span class="regd__n">B</span><h3 class="regd__t">Arabic-native &amp; RTL</h3><p class="regd__d">Interfaces designed right-to-left from the ground up — natural typography, bilingual receipts and cashier workflows that stay fast in either language.</p></article>
        <article class="regd__card"><span class="regd__n">C</span><h3 class="regd__t">Dual-currency &amp; local rails</h3><p class="regd__d">USD/LBP handling with live exchange-rate updates, plus direct integration with Whish Pay and local settlement rails.</p></article>
        <article class="regd__card"><span class="regd__n">D</span><h3 class="regd__t">High-throughput performance</h3><p class="regd__d">Lean architectures built for continuous operation that run smoothly on standard POS hardware — no slowdowns at peak hour.</p></article>
      </div>
    </section>

    <section class="block">
{sec_head('How we operate', 'Our <em>principles</em>')}
{cards3([
    ('01', 'Senior-led, end to end', 'The engineers who scope your project are the ones who build it. No hand-offs, no lost context.'),
    ('02', 'On your counter first', 'We spend time where the work happens — the till, the floor, the back office — before we design a single screen.'),
    ('03', 'Accountable after launch', 'We monitor, fix and improve what we ship. Your system going live is the start of the relationship, not the end.'),
])}
    </section>

{cta('Start a project', 'Partner with<br /><em>the studio.</em>')}'''

page('studio.html',
     head('Studio — OmniVora · Software Engineering in Beirut',
          'OmniVora is a software engineering studio in Beirut. Regional expertise in offline resilience, Arabic-native UI, dual-currency pricing and high-uptime systems.', 'studio.html'),
     ' data-page="studio"', nav('studio'), studio_main, footer())


# ══════════════════════════ CONTACT ══════════════════════════
FAQ = [
    ('Can the system really keep working without internet?', 'Yes. Our POS and apps are offline-first: every sale, return and stock movement is saved on the device first and synced when the connection returns. Staff keep working through power cuts and network drops, and nothing is lost or double-counted.'),
    ('Do you support USD and LBP together?', 'Yes. Dual-currency pricing, change calculation, exchange-rate updates and end-of-day reconciliation are built into the data model from the start.'),
    ('Is the interface fully in Arabic?', 'Our interfaces are designed right-to-left from the first wireframe, not translated afterwards. Staff can work in Arabic or English, and receipts can be bilingual.'),
    ('Can you integrate with our hardware and payment providers?', 'We integrate with Whish Pay and regional payment gateways, receipt and fiscal printers, barcode scanners, cash drawers and third-party ERP or accounting systems.'),
    ('How long does a project take?', 'It depends on scope. After a short discovery phase you receive a clear scope and milestone plan, so you know what will be delivered and when before the build begins.'),
    ('What happens after launch?', 'We handle on-site setup and staff onboarding, then monitor and support the system in production. You deal with the same engineers who built it.'),
]
faq_html = '\n'.join(f'''        <div class="faq__item">
          <h3><button class="faq__q" id="faq-q{i}" aria-controls="faq-a{i}" aria-expanded="false">{q}<i aria-hidden="true"></i></button></h3>
          <div class="faq__a" id="faq-a{i}" role="region" aria-labelledby="faq-q{i}"><p>{a}</p></div>
        </div>''' for i, (q, a) in enumerate(FAQ))

NEEDS = ['POS system', 'Mobile / web app', 'Dashboard', 'Integration', 'SaaS platform', 'Not sure yet']
chips = '\n'.join(f'              <label class="chip"><input type="checkbox" name="need" value="{n}" /><span>{n}</span></label>' for n in NEEDS)

contact_main = f'''{phd('(06) — Contact', 'Start a <em>project.</em>',
     "Tell us what you're building. We reply within 24–48 hours, in English or Arabic.", 'geo')}

    <section class="brief" id="brief-section">
      <form class="brief__form" id="brief" novalidate>
        <p class="sec-head__kicker">Project brief</p>
        <div class="field--row">
          <div class="field"><label for="b-name">Your name</label><input id="b-name" name="name" type="text" autocomplete="name" required /></div>
          <div class="field"><label for="b-biz">Business</label><input id="b-biz" name="business" type="text" autocomplete="organization" /></div>
        </div>
        <fieldset class="field">
          <legend>What do you need?</legend>
          <div class="chips">
{chips}
          </div>
        </fieldset>
        <div class="field"><label for="b-msg">Tell us about it</label><textarea id="b-msg" name="message" rows="4" placeholder="A few lines about your business and what you'd like to build."></textarea></div>
        <p class="brief__error" role="alert" hidden>Please add your name so we know who to reply to.</p>
        <div class="brief__actions">
          <button class="btn btn--primary" type="submit" value="whatsapp">Send via WhatsApp <i>→</i></button>
          <button class="btn btn--line" type="submit" value="email">Send via email</button>
        </div>
        <p class="brief__note">Your brief opens in WhatsApp or your email app, ready to send — nothing is stored on this site.</p>
      </form>

      <aside class="brief__aside">
        <div class="cblock"><h4>WhatsApp</h4><a href="{WA_MSG_EN}" target="_blank" rel="noopener">+961 70 374 702</a></div>
        <div class="cblock"><h4>Email</h4><a href="mailto:hello@omnivora.dev">hello@omnivora.dev</a></div>
        <div class="cblock"><h4>Studio</h4><p>Beirut, Lebanon</p></div>
        <div class="cblock"><h4>Availability</h4><p>Accepting new projects</p></div>
        <div class="cblock"><h4>Languages</h4><p>English &amp; <span lang="ar">العربية</span></p></div>
      </aside>
    </section>

    <section class="block">
{sec_head('What happens next', 'Three <em>steps</em>')}
{cards3([
    ('01', 'Tell us about it', 'Send a short brief by WhatsApp or email. A few lines is enough to start the conversation.'),
    ('02', 'Discovery call', 'We talk through your operation, constraints and goals — and visit on-site when it helps.'),
    ('03', 'Scope &amp; plan', 'You receive a clear scope, milestone plan and timeline before any build begins.'),
])}
    </section>

    <section class="faq">
      <div>
        <p class="sec-head__kicker" data-anim="rise">FAQ</p>
        <h2 class="sec-head__title">Common <em>questions</em></h2>
      </div>
      <div class="faq__list">
{faq_html}
      </div>
    </section>'''

page('contact.html',
     head('Contact — Start a Project — OmniVora',
          'Start a project with OmniVora, a software engineering studio in Beirut. WhatsApp +961 70 374 702 or email hello@omnivora.dev — replies within 24–48 hours.', 'contact.html'),
     ' data-page="contact"', nav('contact'), contact_main, footer())


# ══════════════════════════ CASE STUDIES (re-wrapped) ══════════════════════════
CASES = {
    'case-vorapos.html': ('VoraPOS — Case Study — OmniVora', 'VoraPOS: a resilient desktop POS engineered for heavy-inventory retail, built for offline-first transactional integrity and sub-second parts lookup.'),
    'case-zaytouna.html': ('Zaytouna Park — Case Study — OmniVora', 'Zaytouna Park: a synchronized hospitality POS connecting table orders, cashier terminals and kitchen displays in real time. Built with Flutter and Supabase.'),
    'case-sils.html': ('Sils — Case Study — OmniVora', 'Sils (سلس): a cloud-native, multi-tenant retail POS platform with isolated tenant environments, live analytics and Arabic-first workflows.'),
}
for fname, (title, desc) in CASES.items():
    src = open(os.path.join(ROOT, fname), encoding='utf-8').read()
    main = re.search(r'<main id="top">\n(.*?)\n\s*</main>', src, re.S).group(1)
    # case footer CTA: use the shared contact block; keep everything else
    main = re.sub(r'<section class="contact" id="contact">.*?</section>', cta('Start a project', 'Start a<br /><em>similar build.</em>').strip(), main, flags=re.S)
    main = main.replace('<section class="tech">', '<section class="tech tech--case">')
    main = main.replace('data-color="#333333"', f'data-color="{INK}"')
    page(fname, head(title, desc, fname), ' data-page="work"', nav('work'), main, footer())


# ══════════════════════════ 404 ══════════════════════════
nf_main = '''    <section class="nf">
      <canvas class="nf__3d" data-3d="geo" data-scale="1.3" aria-hidden="true"></canvas>
      <div class="nf__inner">
        <p class="nf__code">404</p>
        <h1 class="nf__title">This page went <em>offline.</em></h1>
        <p class="nf__text">Unlike our tills, this one didn't make it. The page may have moved, or the link may be mistyped.</p>
        <div class="hero__cta">
          <a href="/index.html" class="btn btn--primary">Back to home <i>→</i></a>
          <a href="/contact.html" class="btn btn--ghost">Contact us</a>
        </div>
      </div>
    </section>'''
page('404.html',
     head('Page not found — OmniVora', 'The page you were looking for could not be found.', '404.html', B='/'),
     '', nav('404', B='/'), nf_main, footer(B='/'), B='/')
# the 404 page should never be indexed
nf_path = os.path.join(ROOT, '404.html')
NL = chr(10)
nf_html = open(nf_path, encoding='utf-8').read().replace('  <meta name="theme-color"', '  <meta name="robots" content="noindex" />' + NL + '  <meta name="theme-color"', 1)
open(nf_path, 'w', encoding='utf-8', newline=NL).write(nf_html)
