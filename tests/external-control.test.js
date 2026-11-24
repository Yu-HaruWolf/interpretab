import test from "node:test";
import assert from "node:assert/strict";
import {
  filterExternalPatch,
  isExternalOriginAllowed,
  parseAllowedPorts,
  publicExternalSettings,
} from "../lib/external-control.js";

test("parseAllowedPorts returns null when blank and parses valid ports otherwise", () => {
  assert.equal(parseAllowedPorts(""), null);
  assert.equal(parseAllowedPorts("   "), null);
  assert.deepEqual([...parseAllowedPorts("3000, 5173; 8080")].sort(), ["3000", "5173", "8080"]);
  assert.deepEqual([...parseAllowedPorts("0, 65536, abc, 4000")], ["4000"]);
});

test("isExternalOriginAllowed enforces toggle, loopback host, http scheme, and ports", () => {
  assert.equal(
    isExternalOriginAllowed("http://localhost:3000", { externalControlEnabled: false, externalControlPorts: "" }),
    false
  );
  assert.equal(
    isExternalOriginAllowed("http://localhost:3000", { externalControlEnabled: true, externalControlPorts: "" }),
    true
  );
  assert.equal(
    isExternalOriginAllowed("http://127.0.0.1:5173", { externalControlEnabled: true, externalControlPorts: "3000, 5173" }),
    true
  );
  assert.equal(
    isExternalOriginAllowed("http://127.0.0.1:4000", { externalControlEnabled: true, externalControlPorts: "3000, 5173" }),
    false
  );
  assert.equal(
    isExternalOriginAllowed("http://localhost", { externalControlEnabled: true, externalControlPorts: "80" }),
    true
  );
  assert.equal(
    isExternalOriginAllowed("https://localhost:3000", { externalControlEnabled: true, externalControlPorts: "" }),
    false
  );
  assert.equal(
    isExternalOriginAllowed("http://example.com:3000", { externalControlEnabled: true, externalControlPorts: "" }),
    false
  );
});

test("filterExternalPatch drops sensitive keys and flags restart-requiring settings", () => {
  const liveOnly = filterExternalPatch({
    micMuted: true,
    soundMuted: false,
    apiKey: "secret",
    externalControlEnabled: true,
  });
  assert.deepEqual(liveOnly.cleanPatch, { micMuted: true, soundMuted: false });
  assert.equal(liveOnly.needsRestart, false);

  const needsRestart = filterExternalPatch({
    micSource: "ja",
    micTarget: "en",
    micInput: "device-123",
    simulInstruction: "DevFest Tokyo context",
  });
  assert.deepEqual(needsRestart.cleanPatch, {
    micSource: "ja",
    micTarget: "en",
    micInput: "device-123",
    simulInstruction: "DevFest Tokyo context",
  });
  assert.equal(needsRestart.needsRestart, true);
});

test("publicExternalSettings omits apiKey and internal control settings", () => {
  const pub = publicExternalSettings({
    apiKey: "AIza-secret",
    externalControlEnabled: true,
    micTarget: "ja",
    micInput: "mic-1",
    micMuted: false,
    simulInstruction: "DevFest Tokyo context",
  });
  assert.equal("apiKey" in pub, false);
  assert.equal("externalControlEnabled" in pub, false);
  assert.deepEqual(pub, {
    micTarget: "ja",
    micInput: "mic-1",
    micMuted: false,
    simulInstruction: "DevFest Tokyo context",
  });
});
