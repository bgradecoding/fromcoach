# WebMCP Browser API Notes (researched 2026-09-03)

Sources: webmachinelearning/webmcp explainer + proposal, developer.chrome.com/docs/ai/webmcp/*
(imperative-api, declarative-api, build-tools, evals), webmcp.devpost.com, learn.chatgpt.com/docs/webmcp,
WebMCP-org/npm-packages, sdras/webmcp-tools (now mirrored at GoogleChromeLabs/webmcp-tools),
GoogleChrome/modern-web-guidance webmcp guide. All sources were reachable.

## 1. Entry point

**`document.modelContext`** is current — used consistently by the explainer, Chrome docs, the Devpost
challenge, and OpenAI's ChatGPT guide. Older articles/polyfills used `navigator.modelContext`; treat it
only as a legacy fallback. ChatGPT's guide recommends feature-detecting:
`typeof document.modelContext?.registerTool === "function"`.

## 2. registerTool signature

```js
await document.modelContext.registerTool({
  name: "add-todo",                       // required, unique id
  title: "Add todo",                      // optional display name
  description: "Add an item to the todo list",  // required, natural language
  inputSchema: {                          // JSON Schema (type:"object", properties, required)
    type: "object",
    properties: { text: { type: "string", description: "Todo text" } },
    required: ["text"],
  },
  annotations: { readOnlyHint: true },    // optional
  async execute(input, client) { ... },   // required
}, { signal: controller.signal });        // options: { signal, exposedTo }
```

- Descriptor fields confirmed: `name`, `title` (optional), `description`, `inputSchema`,
  `annotations`, `execute`. Options bag: `signal` (AbortSignal), `exposedTo` (origins array for
  cross-origin iframe exposure).
- Also on `modelContext`: `getTools(options?)`, `executeTool(tool, inputJSON, options?)`, and a
  `"toolchange"` event.

## 3. Unregistration

Via **AbortSignal only**: pass `{ signal }` at registration, call `controller.abort()` to unregister.
There is **no `unregisterTool(name)`** (Google's guidance explicitly says "Do not use `unregisterTool`")
and no returned handle. Chrome docs recommend always registering with a signal and aborting on page/SPA
route transitions.

## 4. execute() return format and errors

- `execute(input, client)` — `input` is the parsed arguments object; `client` carries `signal`
  (cancellation) and `requestUserInteraction` (see #6).
- Return: the explainer's canonical form is MCP-style
  `{ content: [{ type: "text", text: "..." }] }`. Plain objects (e.g. `{ office: "Building 4" }`) and
  plain strings are also accepted and serialized for the model. ChatGPT's guide just says "return
  enough structured data to confirm the operation".
- Errors: no `isError` field is documented in the browser API. Practice in Chrome docs/demos is to
  **return a descriptive text result for expected failures** ("No flight search results found. Search
  for flights first.") and let thrown exceptions surface as tool-call errors for unexpected ones.

## 5. annotations.readOnlyHint

Yes. `annotations: { readOnlyHint: true }` appears in Chrome's imperative-api docs and OpenAI's
ChatGPT guide (recommended for non-mutating tools). Chrome docs also mention `untrustedContentHint`.

## 6. client.requestUserInteraction

Exists. `execute`'s second argument is a `ModelContextClient` whose (currently only) method is
`requestUserInteraction()` — pauses tool execution to ask the human for input/confirmation; callable
multiple times per execution. Treat as newest/least-supported surface; guard with
`client?.requestUserInteraction`.

## 7. Declarative form API

Attributes (confirmed exact names, Chrome declarative-api docs):
- `<form toolname="..." tooldescription="...">` — both required to expose a form as a tool.
- `toolautosubmit` (optional, on the form) — agent invocation auto-submits and navigates.
- `toolparamdescription` — on individual fields, maps to the JSON Schema property description.
  (Not `tooldescription` on fields.)

Submission detection: **`SubmitEvent.agentInvoked`** (boolean, exact name confirmed) is true when an
agent triggered the submit; `SubmitEvent.respondWith(promise)` lets the page return a result the
browser serializes back to the model. Extras: window events `"toolactivated"` / `"toolcancel"` (with
`toolName`), CSS pseudo-classes `:tool-form-active`, `:tool-submit-active`.

## 8. Testing APIs

Confirmed to exist:
- Flag: `chrome://flags/#enable-webmcp-testing` (or launch with
  `--enable-features=WebMCPTesting,DevToolsWebMCPSupport`). Needs Chromium ≥ 146.0.7672.0; origin
  trial runs from Chrome 149. HTTPS/secure context required (localhost OK).
- The flag exposes **`navigator.modelContextTesting`** (note: navigator, not document) with
  **`getTools()`** and **`executeTool(name, input)`** for driving tools without a live agent.
  (The Model Context Tool Inspector extension uses this interface.)
- Pages can also self-test with `document.modelContext.executeTool(...)`.
- GoogleChromeLabs/webmcp-tools has an evals CLI, polyfill, and the Inspector Chrome extension.

## 9. ChatGPT in-app browser ("site tools")

- Works **out of the box** — no flag, allowlist, meta tag, manifest, or developer mode. Tools are
  discovered automatically on page load via the same `document.modelContext.registerTool()` API.
- Users see registered tools under **"Site tools"** in the browser's address bar; recent calls show in
  a Sources panel.
- OpenAI guidance: feature-detect before registering, set `annotations.readOnlyHint` on read-only
  tools, validate inputs in `execute`, rely on the site's own auth (tools run with the user's session).
  Each invocation gets a safety review before execution. Guide: learn.chatgpt.com/docs/webmcp.

## Working assumptions for FormCoach

1. **Entry point**: `const mc = document.modelContext ?? navigator.modelContext;` — bail out silently
   (no-op) if neither exists. Feature-detect `typeof mc?.registerTool === "function"`.
2. **Registration**: one `AbortController` per registration scope;
   `mc.registerTool(def, { signal: controller.signal })`; unregister on SPA route change/teardown via
   `controller.abort()`. Never call `unregisterTool` (doesn't exist). Wrap `registerTool` in
   try/catch in case an older impl rejects unknown options; retry without the options bag.
3. **Descriptor**: use `name` (snake_case), `title`, `description`, JSON-Schema `inputSchema`
   (`type:"object"` at the root), `annotations: { readOnlyHint }` where applicable.
4. **Return format**: always MCP-style `{ content: [{ type: "text", text }] }` (stringify JSON payloads
   into `text`) — the most widely accepted shape across Chrome and ChatGPT. Expected/business failures
   return a descriptive text result; only throw for genuine bugs.
5. **Declarative layer**: annotate key forms with `toolname` + `tooldescription`, field-level
   `toolparamdescription`; in submit handlers branch on `event.agentInvoked === true` and use
   `respondWith` when returning data without navigation. Skip `toolautosubmit` unless navigation is
   desired.
6. **Testing**: develop with `chrome://flags/#enable-webmcp-testing`; automate via
   `navigator.modelContextTesting.getTools()` / `.executeTool(name, input)`; verify end-to-end in the
   ChatGPT in-app browser (no setup needed).
