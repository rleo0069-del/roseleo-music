# Rose Leo — Music

Static music portfolio site: https://odysseyofmusic.com/

No build step. Edit `data/songs.json` and push; GitHub Pages redeploys automatically.

## Adding a song
Append an object to `data/songs.json`:

```json
{
  "id": "unique-slug",
  "title": "Song Title",
  "artist": "Rose Leo",
  "tags": ["space", "ballad"],
  "date": "2026-11-01",
  "duration": "3:45",
  "cover": "https://…/cover.jpg",
  "audio": "https://…/song.mp3",
  "youtube": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
  "source": "https://aimusicgen.ai/share/…",
  "lyrics": "Line one\nLine two"
}
```

All fields except `id` and `title` are optional.

Playback mode is chosen automatically:
1. `audio` (direct mp3) → HTML5 audio in the bottom player
2. `youtube` (URL or 11-char id) → small YouTube embed in the bottom player
3. neither → a "Listen ↗" button linking to `source`

Tip: for an aimusicgen share link, the mp3 and cover are at
`https://cdn1.aimusicgen.ai/result/music/<user>/<id>.mp3` and `…/music-cover/<user>/<id>.jpeg` (visible in the share page source).

## Share pages (song links on X and other apps)
Every song has a clean share URL with its own card (title, cover, artist, duration, play button):

    https://odysseyofmusic.com/song/<slug>/

`<slug>` is the same slug the main page uses for `#song-<slug>` (app.js `slugify`). The "Copy link" button on each card copies this URL.

**After adding or changing a song, run:**

    python3 tools/build-song-pages.py        # needs Python 3 + Pillow

It writes, for every song (ads excluded):
- `song/<slug>/index.html`: dark standalone player page with Open Graph + X card meta (bots read these; people get the player and a "Visit the full site" button to `/#song-<slug>`)
- `song/<slug>/oembed.json`: oEmbed, linked from the page
- `embed/<slug>/index.html`: small iframe player (mp3 or YouTube)
- `assets/share/<slug>.jpg`: 1200×630 share image made from the cover (rebuilt only when the cover, title, artist or duration changes; see `tools/share-manifest.json`)
- `sitemap.xml` and `robots.txt`

Removed or renamed songs have their old pages cleaned up. `python3 tools/build-song-pages.py --check` exits 1 if anything is out of date.
The pre-commit hook does this automatically when `data/songs.json` or a cover is committed. Turn it on once per clone with `git config core.hooksPath tools/git-hooks`.

Cards use `twitter:card=summary_large_image`. X only plays inline "player" cards for domains it has approved. If odysseyofmusic.com is ever approved, set `USE_X_PLAYER_CARD = True` in the builder and rebuild.

## Bulk import
Keep a spreadsheet with the columns above, export CSV, and convert to JSON (e.g. any CSV→JSON tool, or `python3 -c "import csv,json,sys;print(json.dumps(list(csv.DictReader(open(sys.argv[1]))),indent=2))" songs.csv`). Put tags as a JSON array (or split them in the script).

Test locally: `python3 -m http.server` then open http://localhost:8000.
