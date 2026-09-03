// URL parameters: ?debug=1&replay=<fixture|none>&speed=<n>
const params = new URLSearchParams(
  typeof location !== "undefined" ? location.search : "",
);

export const DEBUG = params.get("debug") === "1";
/** When the replay param is present (any value), the camera is never started. */
export const REPLAY_PARAM = params.get("replay");
export const REPLAY_SPEED = Number(params.get("speed") ?? "1") || 1;
export const USE_CAMERA = REPLAY_PARAM === null;
