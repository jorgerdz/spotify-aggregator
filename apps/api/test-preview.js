fetch("http://localhost:8787/api/tracks", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer test"
  },
  body: JSON.stringify({
    playlistIds: ["37i9dQZF1DXcBWIGoYBM5M"] // Today's Top Hits public playlist
  })
}).then(res => res.json()).then(console.log).catch(console.error);
