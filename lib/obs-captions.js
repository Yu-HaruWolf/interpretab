// Optional, local-only subtitle output. No audio, API keys, or input transcripts.
export const OBS_ENDPOINT = "http://127.0.0.1:8765/captions";
export const OBS_ORIGIN = "http://127.0.0.1/*";

export class ObsCaptions {
  constructor(send = (events) => fetch(OBS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Interpretab": "captions" },
    body: JSON.stringify(events),
    signal: AbortSignal.timeout(1000),
  })) {
    this.send = send;
    this.pending = new Map();
    this.busy = false;
    this.enabled = false;
  }

  configure(enabled) {
    if (this.enabled === enabled) return;
    if (this.enabled) this.post({ type: "state", running: false });
    this.enabled = enabled;
  }

  post(event) {
    if (!this.enabled) return;
    if (event.type === "state") {
      this.pending.clear();
      this.pending.set("state", { type: "clear" });
    } else if (event.type === "transcript" && event.side === "output" &&
      ["tab", "mic"].includes(event.direction)) {
      this.pending.set(event.direction, {
        type: "caption", direction: event.direction, text: event.text,
      });
    } else return;
    void this.flush();
  }

  async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.pending.size) {
        const batch = [...this.pending.values()];
        this.pending.clear();
        try { await this.send(batch); } catch { /* OBS must never stop translation. */ }
      }
    } finally {
      this.busy = false;
    }
  }
}
