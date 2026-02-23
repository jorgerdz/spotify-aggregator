# Original Code Reference

The original CLI-based implementation for reference during porting. This code works but has limitations that the web app addresses.

## Files

### `src/spotify-superset.js` — Pagination & Bulk Operations

```javascript
const { sequence } = require("./utils");
const { split } = require("./utils");
let s = require('./spotify_wrapper').client;

let MAX_LIMIT_PAGINATE = 50;
let MAX_LIMIT_POST = 100;

async function runner(method, param) {
    let promises = await allPagesBuilder(method, param);
    let responses = await sequence(promises)
    let items = responses
        .map((result) => result.body)
        .reduce((prev, curr) => prev.concat(curr.items), []);
    return items;
}

async function allPagesBuilder(method, params) {
    let firstPage = await builder(method, params, {limit: MAX_LIMIT_PAGINATE, offset: 0})();
    let promises = [() => firstPage];
    let total = firstPage.body.total;
    for (let i = MAX_LIMIT_PAGINATE; i < total; i += MAX_LIMIT_PAGINATE) {
        let buildPromise = builder(method, params, {limit: MAX_LIMIT_PAGINATE, offset: i});
        promises.push(buildPromise);
    }
    return promises;
}

function builder(method, params, config = {}) {
    return () => {
        console.log(method, params, config)
        return s[method](...params, config);
    }
}

async function bulkRunner(method, target, items) {
    let itemChunks = split(items, MAX_LIMIT_POST);
    let builders = itemChunks.map(i => {
        return builder(method, [target, i])
    })
    let responses = await sequence(builders);
}

exports.runner = runner;
exports.bulkRunner = bulkRunner;
```

### `src/spotify_wrapper.js` — Auth & Client Setup

```javascript
let SpotifyWebApi = require("spotify-web-api-node");
let fs = require("fs");
let open = require("open");

let options = {
    clientId: "39e538b4a8ec4f5084739f1fde45b860",
    clientSecret: "c9d99ee2ad59415cab780f2a58d24fcb",
    redirectUri: "http://spotify-wrapper.com"
}

const SCOPES = [
    'playlist-read-private',
    'user-library-modify',
    'playlist-modify-private',
    'playlist-modify-public'
]

let spotify = new SpotifyWebApi(options);

let promiseResolve, promiseReject;
let authPromise = new Promise(function(resolve, reject){
    promiseResolve = resolve;
    promiseReject = reject;
});

async function setCode(code) {
    let data = await spotify.authorizationCodeGrant(code)
    setToken(data.body.access_token)
}

function setToken(token) {
    spotify.setAccessToken(token);
    fs.writeFileSync("token", token);
    promiseResolve();
}

function getStoredToken() {
    try {
        let storedToken = fs.readFileSync('token')
        return storedToken;
    } catch {
        return;
    }
}

async function getClient() {
    let token = getStoredToken();
    if (token) {
        setToken(token);
    } else {
        requestToken();
    }
    await authPromise;
    return spotify;
}

function requestToken() {
    let authorizeURL = spotify.createAuthorizeURL(SCOPES, 'authorizing');
    open(authorizeURL);
    return;
}

exports.getClient = getClient;
exports.setCode = setCode;
exports.client = spotify;
```

### `src/utils.js` — Helpers

```javascript
async function sequence(promiseFactories) {
    let responses = [];
    for (let job of promiseFactories) {
        responses.push(await job());
    }
    return responses;
}

function split(array, chunk) {
    var i, j, results = [];
    for (i = 0, j = array.length; i < j; i += chunk) {
        results.push(array.slice(i, i + chunk));
    }
    return results;
}

exports.sequence = sequence;
exports.split = split;
```

### `index.js` — Main Entry Point

```javascript
let fs = require("fs");
let spotify = require('./src/spotify_wrapper');
let express = require("express");
let helpers = require('./src/spotify-superset')

let app = express()
let port = 80;

app.get('/', function (req, res) {
    spotify.setCode(req.query.code);
    res.send("check your terminal")
})

app.listen(port, async () => {
    console.log(`Spotify server listening at http://localhost:${port}`)
    run();
})

async function run() {
    await spotify.getClient();

    console.log('getting playlists')
    let playlists = await helpers.runner('getUserPlaylists', ['dolmenrage'])
    let pid = playlists.map(p => p.name)
    console.log(pid)

    console.log('filtering playlists')
    playlists = playlists.filter((p) => p.name.match(/(?!Wilco).*\d+\/\d+/))

    let tracks;
    let allTracks = [];

    console.log('getting tracks')
    for (p in playlists) {
        let tracks = await helpers.runner('getPlaylistTracks', [playlists[p].id]);
        tracks.map(t => {
            delete t.track.available_markets;
            delete t.track.album.available_markets;
        })
        playlists[p].tracks = tracks;
        allTracks = [...allTracks, ...tracks];
    }

    fs.writeFileSync("playlists.json", JSON.stringify(playlists));
    fs.writeFileSync("tracks.json", JSON.stringify(allTracks));

    console.log('publishing tracks')
    let trackUris = allTracks
        .map(result => result.track.uri)
        .filter(t => t.indexOf('spotify:local') === -1);

    await helpers.bulkRunner(
        'addTracksToPlaylist',
        '2I3vfsrZbwr7kg0x2p6e3t',
        trackUris
    )
    console.log('finished')
}
```

## What Carries Over

| Concept              | Original                             | Web App                              |
| -------------------- | ------------------------------------ | ------------------------------------ |
| Pagination           | `allPagesBuilder` + `runner`         | Same pattern, `fetch`-based          |
| Bulk writes          | `bulkRunner` (100 per chunk)         | Same pattern                         |
| Sequential execution | `sequence(promiseFactories)`         | Same utility                         |
| Array chunking       | `split(array, chunk)`                | Same utility                         |
| Regex filtering      | Hardcoded in `run()`                 | User-configurable via UI             |
| Local track filter   | `.filter(t => !t.includes(...))` | Same, surfaced in UI as "skipped"    |
| Target playlist      | Hardcoded playlist ID                | User selects or creates              |

## Known Issues in Original Code

1. **Hardcoded credentials** — client ID and secret are in source code
2. **File-based token storage** — tokens stored in plain text file, no refresh
3. **Hardcoded username** — `'dolmenrage'` is hardcoded in `getUserPlaylists` call
4. **Hardcoded target playlist** — `'2I3vfsrZbwr7kg0x2p6e3t'` is hardcoded
5. **No error handling** — any Spotify API failure crashes the process
6. **`for..in` on array** — `for (p in playlists)` iterates keys, not values (works but is a bug-prone pattern)
7. **Missing template literal backtick** — `console.log` in `app.listen` is broken syntax
