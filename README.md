# Rose Leo — Music

Static music portfolio site: https://rleo0069-del.github.io/roseleo-music/

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

## Bulk import
Keep a spreadsheet with the columns above, export CSV, and convert to JSON (e.g. any CSV→JSON tool, or `python3 -c "import csv,json,sys;print(json.dumps(list(csv.DictReader(open(sys.argv[1]))),indent=2))" songs.csv`). Put tags as a JSON array (or split them in the script).

Test locally: `python3 -m http.server` then open http://localhost:8000.
