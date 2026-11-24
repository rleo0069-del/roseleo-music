#!/usr/bin/env python3
"""Build static share pages for every song on Odyssey of Music.

For each song in data/songs.json (ads excluded) this writes:
  song/<slug>/index.html     standalone dark player page + Open Graph / X card meta
  song/<slug>/oembed.json    oEmbed (rich/video) pointing at the embed page
  embed/<slug>/index.html    minimal iframe player (mp3 <audio> or YouTube)
  assets/share/<slug>.jpg    1200x630 share image built from the cover
and refreshes sitemap.xml + robots.txt.

Slugs match app.js (slugify + addSlugs over the full songs.json order), so
https://odysseyofmusic.com/song/<slug>/  <->  https://odysseyofmusic.com/#song-<slug>

Usage:  python3 tools/build-song-pages.py          # build / update
        python3 tools/build-song-pages.py --check  # exit 1 if anything is out of date
Needs Python 3 + Pillow (share images). Re-run after every songs.json change
(the pre-commit hook in tools/git-hooks does it automatically).
"""
import hashlib, html, io, json, os, re, shutil, sys, unicodedata, urllib.request
from datetime import date

SITE = 'https://odysseyofmusic.com'
SITE_NAME = 'Odyssey of Music'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN_VERSION = '2'          # bump to force every share image to rebuild
# X only renders twitter:card=player for allowlisted domains; for others it falls
# back to a SMALL link card. summary_large_image gives the best real result, so
# the player card is off unless the domain gets approved by X.
USE_X_PLAYER_CARD = False
EMBED_AUDIO_W, EMBED_AUDIO_H = 480, 152
EMBED_VIDEO_W, EMBED_VIDEO_H = 560, 315
SECTION_LABEL = {'music': 'Music', 'books': 'Books and things', 'children': "Children's Music", 'games': 'Games / Extras'}
CACHE = os.path.join(ROOT, '.cache', 'share-src')
MANIFEST = os.path.join(ROOT, 'tools', 'share-manifest.json')
FONT_DIRS = ['/usr/share/fonts/truetype/sand-box/google', '/usr/share/fonts', os.path.expanduser('~/.fonts')]

# ---------- data helpers (mirror app.js) ----------
def slugify(t):
    t = unicodedata.normalize('NFKD', str(t or '').lower())
    t = ''.join(c for c in t if not ('\u0300' <= c <= '\u036f'))
    t = re.sub(r"['\u2019]", '', t)
    t = re.sub(r'[^a-z0-9]+', '-', t).strip('-')
    return t or 'song'

def add_slugs(songs):
    used = set()
    for s in songs:
        preset = (s.get('slug') or '').strip()
        base = sl = preset or slugify(s.get('title')); n = 2
        while sl in used:
            sl = f'{base}-{n}'; n += 1
        used.add(sl); s['slug'] = sl

def yt_id(u):
    if not u: return ''
    m = re.search(r'(?:v=|youtu\.be/|embed/|shorts/)([\w-]{11})', str(u))
    if m: return m.group(1)
    return u if re.fullmatch(r'[\w-]{11}', str(u)) else ''

def mode(s):
    return 'audio' if s.get('audio') else ('youtube' if yt_id(s.get('youtube')) else 'link')

def is_ad(s): return s.get('section') == 'ads' or s.get('genre') == 'Free ads'
def section(s): return s.get('section') if s.get('section') in SECTION_LABEL else 'music'
def plain_title(s): return (s.get('titlePlain') or s.get('title') or '').strip()

def absu(u):
    if not u: return ''
    if re.match(r'^(https?:)?//', u, re.I): return ('https:' + u) if u.startswith('//') else u
    return SITE + '/' + u.lstrip('/')

def local_path(u):
    if not u or re.match(r'^(https?:|data:|//)', u, re.I): return None
    p = os.path.join(ROOT, u.split('?')[0].lstrip('/'))
    return p if os.path.exists(p) else None

def secs(d):
    if not d: return 0
    try:
        parts = [int(x) for x in str(d).split(':')]
    except ValueError:
        return 0
    t = 0
    for p in parts: t = t * 60 + p
    return t

def iso_dur(n):
    return f'PT{n // 60}M{n % 60}S' if n else ''

def cover_url(s):
    c = s.get('cover')
    if c: return absu(c)
    y = yt_id(s.get('youtube'))
    return f'https://i.ytimg.com/vi/{y}/hqdefault.jpg' if y else SITE + '/assets/og-music.jpg'

def label(s):
    sec = section(s)
    if sec == 'music': return s.get('genre') or 'Music'
    return SECTION_LABEL[sec]

def description(s):
    bits = [s.get('artist') or 'Rose Marie Leo', label(s)]
    if s.get('duration'): bits.append(s['duration'])
    tail = 'Read on Odyssey of Music' if mode(s) == 'link' else 'Listen on Odyssey of Music'
    standard = ' · '.join(bits) + ' · ' + tail
    # When a long title was shortened, the subtitle holds the rest / original name
    # and is used as the share-card description.
    if (s.get('subtitle') or '').strip():
        return s['subtitle'].strip()
    return standard

E = lambda x: html.escape(str(x or ''), quote=True)

# ---------- share images ----------
def find_font(names):
    for d in FONT_DIRS:
        for root, _, files in os.walk(d):
            for f in files:
                if f in names: return os.path.join(root, f)
    return None

_FONTS = {}
def font(kind, size):
    key = (kind, size)
    if key in _FONTS: return _FONTS[key]
    from PIL import ImageFont
    spec = {
        'serif': (['CormorantGaramond-VariableFont_wght.ttf', 'DejaVuSerif-Bold.ttf'], b'Bold'),
        'sans': (['Inter-VariableFont_opsz,wght.ttf', 'DejaVuSans.ttf'], b'Medium'),
        'sansb': (['Inter-VariableFont_opsz,wght.ttf', 'DejaVuSans-Bold.ttf'], b'Bold'),
        'mono': (['JetBrainsMono-VariableFont_wght.ttf', 'DejaVuSansMono.ttf'], b'Bold'),
    }[kind]
    p = find_font(spec[0])
    f = ImageFont.truetype(p, size) if p else ImageFont.load_default()
    try: f.set_variation_by_name(spec[1])
    except Exception: pass
    _FONTS[key] = f
    return f

def fetch(url):
    os.makedirs(CACHE, exist_ok=True)
    fn = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest())
    if os.path.exists(fn):
        return open(fn, 'rb').read()
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (odysseyofmusic share builder)'})
    data = urllib.request.urlopen(req, timeout=30).read()
    open(fn, 'wb').write(data)
    return data

def cover_bytes(s):
    p = local_path(s.get('cover'))
    if p: return open(p, 'rb').read()
    y = yt_id(s.get('youtube'))
    urls = [absu(s['cover'])] if s.get('cover') else []
    if y: urls += [f'https://i.ytimg.com/vi/{y}/maxresdefault.jpg', f'https://i.ytimg.com/vi/{y}/hqdefault.jpg']
    for u in urls:
        try:
            b = fetch(u)
            if len(b) > 2000: return b
        except Exception as e:
            print('  ! cover fetch failed', u, e, file=sys.stderr)
    return open(os.path.join(ROOT, 'assets', 'oom-logo.jpg'), 'rb').read()

def cover_identity(s):
    p = local_path(s.get('cover'))
    if p: return 'file:' + hashlib.sha1(open(p, 'rb').read()).hexdigest()
    return 'url:' + (s.get('cover') or 'yt:' + yt_id(s.get('youtube')))

def trim_bars(im):
    """Drop black letterbox bars (YouTube hqdefault)."""
    from PIL import ImageOps
    g = ImageOps.grayscale(im).point(lambda v: 255 if v > 18 else 0)
    box = g.getbbox()
    if box and (box[3] - box[1]) > im.height * 0.5 and (box[2] - box[0]) > im.width * 0.3:
        return im.crop(box)
    return im

def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    out = []
    for ln in lines:  # hard-split very long tokens
        while draw.textlength(ln, font=f) > width and len(ln) > 4:
            k = len(ln)
            while k > 1 and draw.textlength(ln[:k], font=f) > width: k -= 1
            out.append(ln[:k]); ln = ln[k:]
        out.append(ln)
    return out

def make_share_image(s, out):
    from PIL import Image, ImageDraw, ImageFilter
    W, H = 1200, 630
    src = Image.open(io.BytesIO(cover_bytes(s))).convert('RGB')
    src = trim_bars(src)
    # blurred background
    bg = src.copy()
    sc = max(W / bg.width, H / bg.height)
    bg = bg.resize((int(bg.width * sc) + 1, int(bg.height * sc) + 1))
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    bg = bg.filter(ImageFilter.GaussianBlur(36))
    bg = Image.blend(bg, Image.new('RGB', (W, H), (0, 0, 0)), 0.72)
    d = ImageDraw.Draw(bg)
    # cover box (keeps aspect, max 500x500)
    maxw, maxh = 500, 500 if src.width <= src.height * 1.15 else 500
    r = min(maxw / src.width, maxh / src.height)
    cw, ch = int(src.width * r), int(src.height * r)
    cv = src.resize((cw, ch), Image.LANCZOS)
    cx, cy = 60, (H - ch) // 2
    mask = Image.new('L', (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), 22, fill=255)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((cx - 6, cy - 6, cx + cw + 6, cy + ch + 6), 26, fill=(212, 175, 55, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    bg = Image.alpha_composite(bg.convert('RGBA'), shadow).convert('RGB')
    bg.paste(cv, (cx, cy), mask)
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle((cx - 1, cy - 1, cx + cw, cy + ch), 22, outline=(212, 175, 55), width=3)
    # text column
    x = cx + cw + 56
    tw = W - x - 56
    gold, white, mu = (212, 175, 55), (255, 255, 255), (200, 200, 210)
    d.text((x, 70), 'ODYSSEY OF MUSIC', font=font('mono', 24), fill=gold)
    title = plain_title(s)
    for size in (76, 66, 58, 50, 44, 38):
        f = font('serif', size)
        lines = wrap(d, title, f, tw)
        if len(lines) <= 3: break
    if len(lines) > 4:
        lines = lines[:4]
        while d.textlength(lines[-1] + '…', font=f) > tw and len(lines[-1]) > 1: lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + '…'
    y = 118
    lh = int(size * 1.08)
    for ln in lines:
        d.text((x, y), ln, font=f, fill=white); y += lh
    y += 14
    d.text((x, y), s.get('artist') or 'Rose Marie Leo', font=font('sansb', 34), fill=white); y += 50
    meta = label(s) + (('  ·  ' + s['duration']) if s.get('duration') else '')
    d.text((x, y), meta, font=font('sans', 28), fill=mu)
    # play pill
    py = H - 150
    d.ellipse((x, py, x + 84, py + 84), fill=gold)
    if mode(s) == 'link':
        d.text((x + 42, py + 42), '↗', font=font('sansb', 40), fill=(0, 0, 0), anchor='mm')
        cta = 'Read now'
    else:
        d.polygon([(x + 32, py + 22), (x + 32, py + 62), (x + 64, py + 42)], fill=(0, 0, 0))
        cta = 'Play now'
    d.text((x + 104, py + 14), cta, font=font('sansb', 32), fill=white)
    d.text((x + 104, py + 54), 'odysseyofmusic.com', font=font('sans', 24), fill=mu)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bg.save(out, 'JPEG', quality=82, optimize=True, progressive=True)

# ---------- HTML ----------
CSS_PAGE = """
:root{--gold:#d4af37;--blue:#3b82f6;--tx:#fff;--mu:#bdbdbd;--ln:rgba(255,255,255,.22)}
*{box-sizing:border-box}html{background:#000}
body{margin:0;min-height:100vh;color:var(--tx);font-family:Inter,system-ui,sans-serif;background:#000;
background-image:radial-gradient(1px 1px at 10% 20%,#fff8,transparent),radial-gradient(1px 1px at 80% 10%,#fff6,transparent),radial-gradient(1.5px 1.5px at 30% 70%,#fff7,transparent),radial-gradient(1px 1px at 65% 55%,#fff5,transparent),radial-gradient(1px 1px at 90% 80%,#fff8,transparent),radial-gradient(1.5px 1.5px at 50% 35%,#fff4,transparent),radial-gradient(1px 1px at 20% 90%,#fff6,transparent);
background-size:420px 420px;display:flex;flex-direction:column;align-items:center}
a{color:inherit}
.top{width:100%;max-width:980px;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;gap:12px}
.top img{height:64px;width:auto;border-radius:10px;display:block}
.top .site{font-family:ui-monospace,'JetBrains Mono',monospace;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);text-decoration:none;border:1px solid var(--gold);border-radius:999px;padding:7px 12px}
.card{width:min(940px,calc(100% - 28px));margin:6px auto 28px;border:1px solid var(--gold);border-radius:20px;background:rgba(0,0,0,.82);box-shadow:0 0 38px rgba(212,175,55,.16);padding:22px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:26px;align-items:center}
.card.wide{grid-template-columns:1fr}
.art{position:relative;border-radius:16px;overflow:hidden;border:1px solid var(--ln);background:#111;aspect-ratio:1}
.card.wide .art{aspect-ratio:16/9;width:min(100%,720px);margin:0 auto}
.art img{width:100%;height:100%;object-fit:cover;display:block}
.art iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.art .ytgo{position:absolute;inset:0;border:0;background:rgba(0,0,0,.25);cursor:pointer;display:flex;align-items:center;justify-content:center}
.art .ytgo span{width:92px;height:92px;border-radius:50%;background:var(--gold);color:#000;font-size:2.4rem;display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(212,175,55,.5);padding-left:6px}
.kicker{font-family:ui-monospace,'JetBrains Mono',monospace;font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:0 0 10px}
h1{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:clamp(2rem,5vw,3.3rem);line-height:1.04;margin:0 0 8px;overflow-wrap:anywhere}
h1 s{opacity:.6}
.sub{color:var(--mu);margin:0 0 6px;font-style:italic}
.artist{font-weight:600;font-size:1.1rem;margin:4px 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.chip{border:1px solid var(--ln);border-radius:999px;padding:4px 11px;font-size:.82rem;color:var(--mu)}
.player{display:flex;align-items:center;gap:14px;margin:6px 0 16px}
.pp{flex:none;width:72px;height:72px;border-radius:50%;border:0;background:var(--gold);color:#000;font-size:1.9rem;cursor:pointer;box-shadow:0 0 26px rgba(212,175,55,.45);display:flex;align-items:center;justify-content:center}
.pp:focus-visible,.btn:focus-visible{outline:3px solid var(--blue);outline-offset:3px}
.bar{flex:1;min-width:0}
.bar input{width:100%;accent-color:var(--gold)}
.time{display:flex;justify-content:space-between;font-family:ui-monospace,monospace;font-size:.78rem;color:var(--mu)}
.btns{display:flex;flex-wrap:wrap;gap:10px}
.btn{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:10px 16px;font:600 .92rem Inter,system-ui,sans-serif;text-decoration:none;cursor:pointer;border:1px solid var(--ln);background:#000;color:#fff}
.btn.main{background:var(--blue);border-color:var(--blue)}
.btn.gold{background:var(--gold);border-color:var(--gold);color:#000}
details{margin-top:18px;border-top:1px solid var(--ln);padding-top:12px}
summary{cursor:pointer;color:var(--gold);font-weight:600}
details pre{white-space:pre-wrap;font:inherit;color:#ddd;line-height:1.55;max-height:360px;overflow:auto}
footer{color:#888;font-size:.78rem;padding:0 0 26px;text-align:center}
@media (max-width:720px){.card{grid-template-columns:1fr;padding:16px}.top img{height:48px}}
"""

PAGE_JS_AUDIO = """
(function(){var a=document.getElementById('au'),b=document.getElementById('pp'),sk=document.getElementById('sk'),c=document.getElementById('tc'),d=document.getElementById('td');
function f(t){return isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00'}
function ui(){var on=!a.paused;b.textContent=on?'\\u23F8':'\\u25B6';b.setAttribute('aria-label',on?'Pause':'Play')}
b.addEventListener('click',function(){a.paused?a.play():a.pause()});a.addEventListener('play',ui);a.addEventListener('pause',ui);a.addEventListener('ended',ui);
a.addEventListener('loadedmetadata',function(){d.textContent=f(a.duration)});
a.addEventListener('timeupdate',function(){c.textContent=f(a.currentTime);if(a.duration&&!sk.dragging)sk.value=a.currentTime/a.duration*1000});
sk.addEventListener('input',function(){if(a.duration)a.currentTime=sk.value/1000*a.duration});})();
"""
PAGE_JS_YT = """
(function(){var g=document.getElementById('ytgo');if(!g)return;g.addEventListener('click',function(){var f=document.createElement('iframe');f.src=g.dataset.src;f.title=g.dataset.title;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;g.parentNode.appendChild(f);g.remove();var p=document.getElementById('pp');if(p)p.remove()});
var p=document.getElementById('pp');if(p)p.addEventListener('click',function(){g.click()});})();
"""
PAGE_JS_COPY = """
(function(){var b=document.getElementById('cp');if(!b)return;b.addEventListener('click',function(){var u=b.dataset.url,done=function(){b.textContent='Copied \\u2713';setTimeout(function(){b.textContent='Copy link'},1500)};
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(done,function(){prompt('Copy this link',u)});else prompt('Copy this link',u)});})();
"""

def title_html(s):
    if s.get('titleStrike'):
        return f'<s>{E(s["titleStrike"])}</s> {E(plain_title(s))}'
    return E(s.get('title'))

def meta_block(s, share_img, img_v):
    slug = s['slug']; m = mode(s); y = yt_id(s.get('youtube'))
    url = f'{SITE}/song/{slug}/'
    title = plain_title(s)
    artist = s.get('artist') or 'Rose Marie Leo'
    desc = description(s)
    img = f'{SITE}/{share_img}?v={img_v}'
    alt = f'{title} by {artist}: cover art with a play button, Odyssey of Music'
    n = secs(s.get('duration'))
    og_type = 'music.song' if m == 'audio' else ('video.other' if m == 'youtube' else 'website')
    t = [
        f'<title>{E(title)} · {E(artist)} · {SITE_NAME}</title>',
        f'<meta name="description" content="{E(desc)}">',
        f'<link rel="canonical" href="{url}">',
        f'<meta property="og:site_name" content="{SITE_NAME}">',
        f'<meta property="og:type" content="{og_type}">',
        f'<meta property="og:title" content="{E(title)}">',
        f'<meta property="og:description" content="{E(desc)}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{img}">',
        f'<meta property="og:image:secure_url" content="{img}">',
        '<meta property="og:image:type" content="image/jpeg">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{E(alt)}">',
    ]
    if n and m != 'link': t.append(f'<meta property="music:duration" content="{n}">')
    if m == 'audio':
        au = absu(s['audio'])
        t += [f'<meta property="og:audio" content="{E(au)}">', f'<meta property="og:audio:secure_url" content="{E(au)}">',
              '<meta property="og:audio:type" content="audio/mpeg">']
    if m == 'youtube':
        v = f'https://www.youtube.com/embed/{y}'
        t += [f'<meta property="og:video" content="{v}">', f'<meta property="og:video:secure_url" content="{v}">',
              '<meta property="og:video:type" content="text/html">',
              '<meta property="og:video:width" content="1280">', '<meta property="og:video:height" content="720">']
    if USE_X_PLAYER_CARD and m != 'link':
        w, h = (EMBED_AUDIO_W, EMBED_AUDIO_H) if m == 'audio' else (EMBED_VIDEO_W, EMBED_VIDEO_H)
        t += ['<meta name="twitter:card" content="player">', f'<meta name="twitter:player" content="{SITE}/embed/{slug}/">',
              f'<meta name="twitter:player:width" content="{w}">', f'<meta name="twitter:player:height" content="{h}">']
        if m == 'audio':
            t += [f'<meta name="twitter:player:stream" content="{E(absu(s["audio"]))}">',
                  '<meta name="twitter:player:stream:content_type" content="audio/mpeg">']
    else:
        t.append('<meta name="twitter:card" content="summary_large_image">')
    t += [f'<meta name="twitter:title" content="{E(title)}">', f'<meta name="twitter:description" content="{E(desc)}">',
          f'<meta name="twitter:image" content="{img}">', f'<meta name="twitter:image:alt" content="{E(alt)}">',
          f'<link rel="alternate" type="application/json+oembed" href="{SITE}/song/{slug}/oembed.json" title="{E(title)}">']
    ld = {'@context': 'https://schema.org', '@type': 'MusicRecording' if m != 'link' else 'CreativeWork',
          'name': title, 'url': url, 'image': cover_url(s),
          'byArtist': {'@type': 'MusicGroup' if m != 'link' else 'Person', 'name': artist}}
    if m == 'link': ld = {**ld, 'author': ld.pop('byArtist')}
    if n and m != 'link': ld['duration'] = iso_dur(n)
    if m == 'audio': ld['audio'] = {'@type': 'AudioObject', 'contentUrl': absu(s['audio']), 'encodingFormat': 'audio/mpeg'}
    if m == 'youtube': ld['video'] = {'@type': 'VideoObject', 'name': title, 'embedUrl': f'https://www.youtube.com/embed/{y}',
                                      'thumbnailUrl': f'https://i.ytimg.com/vi/{y}/hqdefault.jpg', 'description': desc}
    t.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace('</', '<\\/') + '</script>')
    return '\n'.join(t)

def song_page(s, share_img, img_v, v):
    slug = s['slug']; m = mode(s); y = yt_id(s.get('youtube'))
    url = f'{SITE}/song/{slug}/'
    full = f'{SITE}/#song-{slug}'
    cover = cover_url(s)
    title = plain_title(s)
    artist = s.get('artist') or 'Rose Marie Leo'
    chips = [label(s)]
    if s.get('duration'): chips.append(s['duration'])
    if s.get('genre2'): chips.append('also ' + s['genre2'])
    wide = m == 'youtube' and not s.get('cover')
    if m == 'youtube':
        src = f'https://www.youtube-nocookie.com/embed/{y}?autoplay=1&rel=0&playsinline=1'
        art = (f'<div class="art"><img src="{E(cover)}" alt="Cover art for {E(title)}" width="1200" height="1200">'
               f'<button class="ytgo" id="ytgo" type="button" data-src="{src}" data-title="{E(title)}" aria-label="Play {E(title)}"><span>&#9654;</span></button></div>')
    else:
        art = f'<div class="art"><img src="{E(cover)}" alt="Cover art for {E(title)}" width="1200" height="1200"></div>'
    if m == 'audio':
        player = (f'<audio id="au" preload="metadata" src="{E(absu(s["audio"]))}"></audio>'
                  '<div class="player"><button class="pp" id="pp" type="button" aria-label="Play">&#9654;</button>'
                  '<div class="bar"><input id="sk" type="range" min="0" max="1000" value="0" aria-label="Seek">'
                  f'<div class="time"><span id="tc">0:00</span><span id="td">{E(s.get("duration") or "0:00")}</span></div></div></div>')
        js = PAGE_JS_AUDIO
    elif m == 'youtube':
        player = ('<div class="player"><button class="pp" id="pp" type="button" aria-label="Play">&#9654;</button>'
                  f'<div class="bar"><div class="time"><span>Plays right here</span><span>{E(s.get("duration") or "")}</span></div></div></div>')
        js = PAGE_JS_YT
    else:
        player = ''
        js = ''
    btns = []
    if m == 'link':
        tgt = absu(s.get('article') or s.get('source') or '')
        if tgt: btns.append(f'<a class="btn gold" href="{E(tgt)}" target="_blank" rel="noopener">Read it &#8599;</a>')
    btns.append(f'<a class="btn main" href="{E(full)}">Visit the full site &#8599;</a>')
    btns.append(f'<a class="btn" href="{SITE}/">More songs</a>')
    btns.append(f'<button class="btn" id="cp" type="button" data-url="{url}">Copy link</button>')
    lyr = ''
    if (s.get('lyrics') or '').strip():
        lyr = f'<details><summary>Lyrics</summary><pre>{E(s["lyrics"].strip())}</pre></details>'
    sub = f'<p class="sub">{E(s["subtitle"])}</p>' if s.get('subtitle') else ''
    blurb = f'<p class="sub">{E(s["blurb"])}</p>' if s.get('blurb') else ''
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
{meta_block(s, share_img, img_v)}
<meta name="theme-color" content="#000000">
<link rel="icon" href="/assets/oom-logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>{CSS_PAGE}</style></head><body>
<header class="top"><a href="{SITE}/" aria-label="Odyssey of Music home"><img src="/assets/oom-logo.jpg?v=20261122b" width="736" height="400" alt="Odyssey of Music"></a><a class="site" href="{E(full)}">Full site &#8599;</a></header>
<main class="card{' wide' if wide else ''}">
{art}
<section>
<p class="kicker">Odyssey of Music &middot; {E(SECTION_LABEL[section(s)])}</p>
<h1>{title_html(s)}</h1>{sub}{blurb}
<p class="artist">{E(artist)}</p>
<div class="chips">{''.join(f'<span class="chip">{E(c)}</span>' for c in chips)}</div>
{player}
<div class="btns">{''.join(btns)}</div>
{lyr}
</section></main>
<footer>&copy; Rose Marie Leo &middot; <a href="{SITE}/">odysseyofmusic.com</a></footer>
<script>{js}{PAGE_JS_COPY}</script>
</body></html>
'''

CSS_EMBED = """
*{box-sizing:border-box}html,body{margin:0;height:100%;background:#000;color:#fff;font-family:Inter,system-ui,sans-serif;overflow:hidden}
.e{height:100%;display:flex;align-items:center;gap:14px;padding:12px;border:1px solid #d4af37;border-radius:14px;background:#000}
.e img{height:100%;max-height:128px;aspect-ratio:1;object-fit:cover;border-radius:10px;flex:none}
.m{flex:1;min-width:0}
.t{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:1.35rem;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.a{color:#bdbdbd;font-size:.85rem;margin:2px 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r{display:flex;align-items:center;gap:10px}
.pp{flex:none;width:46px;height:46px;border-radius:50%;border:0;background:#d4af37;color:#000;font-size:1.2rem;cursor:pointer}
.r input{flex:1;min-width:0;accent-color:#d4af37}
.tm{font:.72rem ui-monospace,monospace;color:#bdbdbd;white-space:nowrap}
.o{display:inline-block;margin-top:6px;font:.7rem ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#d4af37;text-decoration:none}
.yt{position:fixed;inset:0;width:100%;height:100%;border:0}
"""
EMBED_JS = """
(function(){var a=document.getElementById('au'),b=document.getElementById('pp'),sk=document.getElementById('sk'),tm=document.getElementById('tm');
function f(t){return isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00'}
function ui(){var on=!a.paused;b.textContent=on?'\\u23F8':'\\u25B6';b.setAttribute('aria-label',on?'Pause':'Play')}
b.addEventListener('click',function(){a.paused?a.play():a.pause()});['play','pause','ended'].forEach(function(e){a.addEventListener(e,ui)});
a.addEventListener('timeupdate',function(){tm.textContent=f(a.currentTime)+' / '+f(a.duration||0);if(a.duration)sk.value=a.currentTime/a.duration*1000});
sk.addEventListener('input',function(){if(a.duration)a.currentTime=sk.value/1000*a.duration});})();
"""

def embed_page(s):
    slug = s['slug']; m = mode(s); y = yt_id(s.get('youtube'))
    title = plain_title(s); artist = s.get('artist') or 'Rose Marie Leo'
    url = f'{SITE}/song/{slug}/'
    head = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{E(title)} · {SITE_NAME} player</title><meta name="robots" content="noindex"><link rel="canonical" href="{url}">'
            f'<style>{CSS_EMBED}</style></head><body>')
    if m == 'youtube':
        return head + (f'<iframe class="yt" src="https://www.youtube-nocookie.com/embed/{y}?rel=0&playsinline=1" title="{E(title)}" '
                       'allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>\n')
    body = (f'<div class="e"><img src="{E(cover_url(s))}" alt=""><div class="m"><div class="t" title="{E(title)}">{E(title)}</div>'
            f'<div class="a">{E(artist)} · {E(label(s))}</div>')
    if m == 'audio':
        body += (f'<audio id="au" preload="none" src="{E(absu(s["audio"]))}"></audio><div class="r"><button class="pp" id="pp" type="button" aria-label="Play">&#9654;</button>'
                 f'<input id="sk" type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="tm" id="tm">0:00 / {E(s.get("duration") or "0:00")}</span></div>')
    body += f'<a class="o" href="{url}" target="_blank" rel="noopener">Odyssey of Music &#8599;</a></div></div>'
    return head + body + (f'<script>{EMBED_JS}</script>' if m == 'audio' else '') + '</body></html>\n'

def oembed(s, share_img, img_v):
    m = mode(s); slug = s['slug']
    w, h = (EMBED_VIDEO_W, EMBED_VIDEO_H) if m == 'youtube' else (EMBED_AUDIO_W, EMBED_AUDIO_H)
    t = plain_title(s)
    return {'version': '1.0', 'type': 'video' if m == 'youtube' else 'rich', 'title': t,
            'author_name': s.get('artist') or 'Rose Marie Leo', 'author_url': SITE + '/',
            'provider_name': SITE_NAME, 'provider_url': SITE + '/',
            'thumbnail_url': f'{SITE}/{share_img}?v={img_v}', 'thumbnail_width': 1200, 'thumbnail_height': 630,
            'width': w, 'height': h,
            'html': f'<iframe src="{SITE}/embed/{slug}/" width="{w}" height="{h}" title="{html.escape(t, quote=True)}" '
                    'style="border:0;border-radius:14px" allow="autoplay; encrypted-media; fullscreen" loading="lazy"></iframe>'}

# ---------- main ----------
def write_if_changed(path, content, changed, check):
    full = os.path.join(ROOT, path)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old == content: return
    changed.append(path)
    if check: return
    os.makedirs(os.path.dirname(full) or '.', exist_ok=True)
    open(full, 'w', encoding='utf-8').write(content)

def main():
    check = '--check' in sys.argv
    songs = json.load(open(os.path.join(ROOT, 'data', 'songs.json'), encoding='utf-8'))
    add_slugs(songs)
    live = [s for s in songs if not is_ad(s)]
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    new_manifest, changed = {}, []
    for s in live:
        slug = s['slug']
        share_img = f'assets/share/{slug}.jpg'
        key = hashlib.sha1(json.dumps([GEN_VERSION, cover_identity(s), plain_title(s), s.get('artist'), s.get('duration'),
                                       label(s), mode(s) == 'link'], ensure_ascii=False).encode()).hexdigest()[:10]
        new_manifest[slug] = key
        if manifest.get(slug) != key or not os.path.exists(os.path.join(ROOT, share_img)):
            changed.append(share_img)
            if not check:
                print('  image', share_img)
                make_share_image(s, os.path.join(ROOT, share_img))
        write_if_changed(f'song/{slug}/index.html', song_page(s, share_img, key, None), changed, check)
        write_if_changed(f'embed/{slug}/index.html', embed_page(s), changed, check)
        write_if_changed(f'song/{slug}/oembed.json', json.dumps(oembed(s, share_img, key), ensure_ascii=False, indent=1) + '\n', changed, check)
    # orphans (renamed/removed songs)
    keep = {s['slug'] for s in live}
    for d in ('song', 'embed'):
        base = os.path.join(ROOT, d)
        if os.path.isdir(base):
            for n in sorted(os.listdir(base)):
                if n not in keep and os.path.isdir(os.path.join(base, n)):
                    changed.append(f'{d}/{n} (removed)')
                    if not check: shutil.rmtree(os.path.join(base, n))
    sd = os.path.join(ROOT, 'assets', 'share')
    if os.path.isdir(sd):
        for n in sorted(os.listdir(sd)):
            if n.endswith('.jpg') and n[:-4] not in keep:
                changed.append(f'assets/share/{n} (removed)')
                if not check: os.remove(os.path.join(sd, n))
    # sitemap + robots
    today = date.today().isoformat()
    urls = [f'  <url><loc>{SITE}/</loc></url>'] + [
        f'  <url><loc>{SITE}/song/{s["slug"]}/</loc>' + (f'<lastmod>{s["date"]}</lastmod>' if re.fullmatch(r'\d{4}-\d{2}-\d{2}', s.get('date') or '') else '') + '</url>'
        for s in sorted(live, key=lambda s: plain_title(s).lower())]
    write_if_changed('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>\n', changed, check)
    write_if_changed('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n', changed, check)
    if not check:
        open(MANIFEST, 'w').write(json.dumps(new_manifest, indent=1, sort_keys=True) + '\n')
    print(f'{len(live)} songs · {len(changed)} file(s) {"out of date" if check else "updated"}')
    for c in changed[:50]: print('  ', c)
    if check and changed: sys.exit(1)

if __name__ == '__main__':
    main()
