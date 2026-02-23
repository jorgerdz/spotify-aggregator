fetch("http://localhost:8787/api/merge", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer test"
  },
  body: JSON.stringify({
    uris: ["spotify:track:11dFghVXANMlKmJXsNCbNl"],
    targetPlaylistConfig: { name: "Test Playlist" }
  })
}).then(res => res.json()).then(console.log).catch(console.error);
