const params = new URLSearchParams(location.search);
const direction = params.get("direction") || "tab";
const size = Number(params.get("size") || 48);
const hold = Number(params.get("hold") || 8);
document.documentElement.style.setProperty("--font-size", `${Math.max(12, Math.min(160, size || 48))}px`);
const lifetime = Math.max(1, Math.min(60, hold || 8)) * 1000;
let captions = {};

function render() {
  for (const name of ["tab", "mic"]) {
    const entry = captions[name];
    document.getElementById(name).textContent =
      (direction === "both" || direction === name) && entry &&
      Date.now() - entry.updatedAt < lifetime ? entry.text : "";
  }
}

const source = new EventSource("/events");
source.onmessage = (event) => {
  try { captions = JSON.parse(event.data); render(); } catch { /* Keep the last valid snapshot. */ }
};
source.onerror = () => { captions = {}; render(); };
setInterval(render, 250);
