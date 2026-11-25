# Folio

A quiet, private home for your PDFs. Folio is a single-page library that stores your documents in the browser — no account, no server, no upload.

## Run it

```bash
npm start
```

Open <http://localhost:4173>. That's it — no install, no build step, no dependencies.

You can also open `index.html` directly, but a local server is recommended: some browsers restrict IndexedDB on `file://`, and the PDF preview worker is happier over HTTP.

## What it does

- **Add PDFs** by dropping them anywhere on the page or using the Add button. Add several at once.
- **Real covers** — the first page of each PDF is rendered as its cover. If a file can't be rendered, Folio designs a typographic cover instead.
- **Collections** for courses, projects, or clients. Add documents straight into the collection you're viewing.
- **Search** titles and file names, **sort** by date, title, size, or page count.
- **Favorites**, rename, move, download, and delete.
- **Read in place** in a full-screen viewer, or open the PDF in a new tab.
- **Grid or list** layout, light and dark themes, keyboard shortcuts, and a storage meter.
- Works on phones and tablets; the sidebar becomes a drawer.

## Keyboard

| Key | Action |
| --- | --- |
| `/` | Focus search |
| `Esc` | Close the reader, menu, or drawer; clear search |

## Where your files live

Everything is stored in **IndexedDB** in this browser, on this device. Nothing is sent anywhere.

That also means:

- Clearing site data for `localhost:4173` deletes the library.
- Private/incognito windows usually throw the data away when they close.
- The library is per browser and per device. It won't sync.
- Browsers cap storage per site (often several GB). The meter in the sidebar shows how much you're using.
- Keep your own backups of anything irreplaceable: use **Download** from a document's menu.

Folio asks the browser for persistent storage the first time you add a file, which makes it less likely to be evicted.

## Notes

- PDF previews use [pdf.js](https://mozilla.github.io/pdf.js/) from a CDN. If it can't load (offline, blocked), Folio still saves your files and uses designed covers.
- Type is set in **Bodoni Moda** and **Schibsted Grotesk**, loaded from Google Fonts with local fallbacks.
- Tested in current Chrome and Edge.

## Files

```
index.html   markup and icons
styles.css   the whole visual system
app.js       storage, rendering, interactions
server.js    zero-dependency static server
```
