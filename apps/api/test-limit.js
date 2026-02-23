fetch("http://localhost:8787/api/tracks?debug=true", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer test"
  },
  body: JSON.stringify({
    playlistIds: Array(60).fill("37i9dQZF1DXcBWIGoYBM5M")
  })
}).then(res => res.json()).then(res => console.log(res.error, res.logs)).catch(console.error);
