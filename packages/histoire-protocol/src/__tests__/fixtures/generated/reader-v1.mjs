// packages/histoire-protocol/src/types/error.ts
var HISTOIRE_ERROR_CODES = [
  "INVALID_ARGUMENT",
  "RESULT_TOO_LARGE",
  "BROWSER_REQUIRED",
  "NOT_CONNECTED",
  "DISPOSED",
  "CAPABILITY_UNAVAILABLE",
  "PROTOCOL_MISMATCH",
  "ORIGIN_DENIED",
  "BOOK_UNAVAILABLE",
  "STORY_NOT_FOUND",
  "STORY_AMBIGUOUS",
  "VARIANT_NOT_FOUND",
  "SELECTION_REQUIRED",
  "PREVIEW_NOT_READY",
  "RUNTIME_IN_USE",
  "STALE_REVISION",
  "RUNTIME_CHANGED",
  "DOCS_NOT_FOUND",
  "SOURCE_UNAVAILABLE",
  "COLLECTION_FAILED",
  "QUEUE_FULL",
  "RATE_LIMITED",
  "DEPENDENCY_MISSING",
  "BROWSER_UNAVAILABLE",
  "CANCELLED",
  "TIMEOUT",
  "INTERNAL_ERROR"
];
var HistoireSdkError = class extends Error {
  /** Stable failure code. */
  code;
  /** Optional bounded projected diagnostic data. */
  details;
  /** Constructs failure without importing platform/framework modules. */
  constructor(code, message, details) {
    super(message);
    this.name = "HistoireSdkError";
    this.code = code;
    this.details = details;
  }
};

// packages/histoire-protocol/src/bridge/limits.ts
var HISTOIRE_WIRE_LIMITS = { metadata: 64 * 1024, request: 1024 * 1024, event: 64 * 1024, catalog: 8 * 1024 * 1024, state: 1024 * 1024, error: 16 * 1024, depth: 128, containers: 1e5, edges: 2e5 };
function getHistoireWireLimit(policy) {
  if (policy.kind === "error") return HISTOIRE_WIRE_LIMITS.error;
  if (policy.kind === "metadata") return HISTOIRE_WIRE_LIMITS.metadata;
  if (policy.kind === "descriptor" || policy.name === "view.sync" || policy.kind === "response" && ["catalog.list", "catalog.getStory", "catalog.search"].includes(policy.name) || policy.kind === "event" && policy.name === "catalog.changed") {
    return HISTOIRE_WIRE_LIMITS.catalog;
  }
  if (["channel.message", "channel.post", "plugin.message", "plugin.post"].includes(policy.name)) return HISTOIRE_WIRE_LIMITS.event;
  if (policy.kind === "event" && ["state.changed", "layout.changed"].includes(policy.name)) return HISTOIRE_WIRE_LIMITS.state;
  return policy.kind === "event" ? HISTOIRE_WIRE_LIMITS.event : HISTOIRE_WIRE_LIMITS.request;
}

// packages/histoire-protocol/src/bridge/string-size.ts
function countWireString(value2, json, limit) {
  let bytes = json ? 2 : 0;
  const length = value2.length;
  for (let index = 0; index < length && bytes <= limit; index++) {
    const code = value2.charCodeAt(index);
    if (code < 128) {
      if (!json || code >= 32 && code !== 34 && code !== 92) bytes += 1;
      else bytes += code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13 ? 2 : 6;
    } else if (code < 2048) {
      bytes += 2;
    } else if (code >= 55296 && code <= 56319 && index + 1 < length && isLowSurrogate(value2.charCodeAt(index + 1))) {
      bytes += 4;
      index++;
    } else {
      bytes += json && code >= 55296 && code <= 57343 ? 6 : 3;
    }
  }
  return bytes;
}
function isLowSurrogate(code) {
  return code >= 56320 && code <= 57343;
}

// packages/histoire-protocol/src/bridge/size.ts
var EXIT = -1;
function fail(code, message) {
  throw new HistoireSdkError(code, message);
}
function isPrototypeKey(key) {
  return key === "__proto__" || key === "prototype" || key === "constructor";
}
function readField(value2, key) {
  if (isPrototypeKey(key)) fail("INVALID_ARGUMENT", "Prototype-mutating keys are forbidden");
  const descriptor = Object.getOwnPropertyDescriptor(value2, key);
  if (!descriptor || !("value" in descriptor)) fail("INVALID_ARGUMENT", "Accessors are forbidden in wire values");
  return descriptor.value;
}
function jsonNumberLength(value2) {
  if (!Number.isSafeInteger(value2)) return String(value2).length;
  let length = value2 < 0 ? 2 : 1;
  for (let rest = Math.abs(value2); rest >= 10; rest = Math.floor(rest / 10)) length++;
  return length;
}
function checkBound(bound) {
  if (!Number.isSafeInteger(bound) || bound < 0) fail("INVALID_ARGUMENT", "Invalid wire budget");
}
function measureWireValue(value2, options = {}) {
  const json = options.mode !== "state";
  const maxBytes = options.maxBytes ?? HISTOIRE_WIRE_LIMITS.request;
  const maxDepth = options.maxDepth ?? HISTOIRE_WIRE_LIMITS.depth;
  const maxContainers = options.maxContainers ?? HISTOIRE_WIRE_LIMITS.containers;
  const maxEdges = options.maxEdges ?? HISTOIRE_WIRE_LIMITS.edges;
  checkBound(maxBytes);
  checkBound(maxDepth);
  checkBound(maxContainers);
  checkBound(maxEdges);
  let bytes = 0;
  let containers = 0;
  let edges = 0;
  const seen = /* @__PURE__ */ new Set();
  const values = [value2];
  const depths = [0];
  const fieldValues = [];
  const fieldEnumerable = [];
  const charge = (amount) => {
    bytes += amount;
    if (bytes > maxBytes) fail("RESULT_TOO_LARGE", "Wire byte limit exceeded");
  };
  const chargeEdges = (amount) => {
    edges += amount;
    if (edges > maxEdges) fail("RESULT_TOO_LARGE", "Wire edge limit exceeded");
    if (!json) charge(amount * 8);
  };
  const chargeString = (text, quoted) => {
    charge(countWireString(text, quoted, maxBytes - bytes));
  };
  while (values.length) {
    const current = values.pop();
    const depth = depths.pop();
    if (depth === EXIT) {
      seen.delete(current);
      continue;
    }
    if (depth > maxDepth) fail("RESULT_TOO_LARGE", "Wire depth limit exceeded");
    if (typeof current === "string") {
      chargeString(current, json);
      continue;
    }
    if (current === null) {
      charge(json ? 4 : 1);
      continue;
    }
    if (typeof current === "boolean") {
      charge(json ? current ? 4 : 5 : 1);
      continue;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) fail("INVALID_ARGUMENT", "Non-finite wire number");
      charge(json ? jsonNumberLength(current) : 8);
      continue;
    }
    if (current === void 0 && !json) {
      charge(1);
      continue;
    }
    if (typeof current === "bigint" && !json) {
      charge(8);
      const remaining = maxBytes - bytes;
      const magnitude = current < 0n ? -current : current;
      if (magnitude >> BigInt(remaining) * 8n !== 0n) fail("RESULT_TOO_LARGE", "Wire BigInt limit exceeded");
      charge(magnitude === 0n ? 0 : Math.ceil(magnitude.toString(16).length / 2));
      continue;
    }
    if (typeof current !== "object" || current === null) fail("INVALID_ARGUMENT", "Unsupported wire value");
    const array = Array.isArray(current);
    const prototype = Object.getPrototypeOf(current);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail("INVALID_ARGUMENT", "Wire values must be plain containers");
    if (seen.has(current)) {
      if (json) fail("INVALID_ARGUMENT", "Cycles are forbidden in JSON DTOs");
      continue;
    }
    if (++containers > maxContainers) fail("RESULT_TOO_LARGE", "Wire container limit exceeded");
    seen.add(current);
    if (array && current.length > maxEdges - edges) fail("RESULT_TOO_LARGE", "Wire edge limit exceeded");
    const keys2 = Object.getOwnPropertyNames(current);
    const names = keys2.length;
    if (names - (array ? 1 : 0) > maxEdges - edges) fail("RESULT_TOO_LARGE", "Wire edge limit exceeded");
    let indexCount = 0;
    for (let position = 0; position < names; position++) {
      const key = keys2[position];
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!("value" in descriptor)) fail("INVALID_ARGUMENT", "Accessors are forbidden in wire values");
      if (isPrototypeKey(key) || key === "toJSON" && typeof descriptor.value === "function") fail("INVALID_ARGUMENT", "Forbidden wire serialization key");
      if (array && key === "length") indexCount = position;
      fieldValues[position] = descriptor.value;
      fieldEnumerable[position] = descriptor.enumerable;
    }
    if (json) {
      values.push(current);
      depths.push(EXIT);
      charge(2);
    } else {
      charge(16);
    }
    const childDepth = depth + 1;
    if (array) {
      chargeEdges(current.length);
      if (json && current.length) charge(current.length - 1);
      if (json && indexCount < current.length) fail("INVALID_ARGUMENT", "Sparse arrays are forbidden in JSON DTOs");
      for (let position = indexCount - 1; position >= 0; position--) {
        values.push(fieldValues[position]);
        depths.push(childDepth);
      }
      for (let position = indexCount + 1; position < names; position++) {
        if (!fieldEnumerable[position]) continue;
        if (json) fail("INVALID_ARGUMENT", "Extra array fields are forbidden in JSON DTOs");
        chargeEdges(1);
        chargeString(keys2[position], false);
        values.push(fieldValues[position]);
        depths.push(childDepth);
      }
    } else {
      let first = true;
      for (let position = 0; position < names; position++) {
        if (!fieldEnumerable[position]) continue;
        chargeEdges(1);
        if (json) {
          charge(first ? 1 : 2);
          first = false;
        }
        chargeString(keys2[position], json);
        values.push(fieldValues[position]);
        depths.push(childDepth);
      }
    }
    if (Object.getOwnPropertySymbols(current).length) fail("INVALID_ARGUMENT", "Symbol keys are forbidden in wire values");
  }
  return bytes;
}
function validateWireValue(value2, policy) {
  const state = (policy.kind === "request" || policy.kind === "response" || policy.kind === "event") && (policy.name === "view.sync" || policy.name === "state.patch" || policy.name === "state.get" || policy.name === "state.reset" || policy.name === "state.changed");
  const bytes = measureWireValue(value2, { mode: state ? "state" : "json", maxBytes: getHistoireWireLimit(policy) });
  if (policy.name === "view.sync" && value2 && typeof value2 === "object") {
    const snapshot = value2;
    if (Object.hasOwn(snapshot, "catalog")) measureWireValue(readField(snapshot, "catalog"), { maxBytes: HISTOIRE_WIRE_LIMITS.catalog });
    if (Object.hasOwn(snapshot, "state")) measureWireValue(readField(snapshot, "state"), { mode: "state", maxBytes: HISTOIRE_WIRE_LIMITS.state });
  }
  return bytes;
}

// packages/histoire-protocol/src/bridge/validation.ts
function invalid(message) {
  throw new HistoireSdkError("INVALID_ARGUMENT", message);
}
function wireRecord(value2) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) return invalid("Expected wire object");
  const prototype = Object.getPrototypeOf(value2);
  if (prototype !== null && prototype !== Object.prototype) return invalid("Expected plain wire object");
  for (const key of Reflect.ownKeys(value2)) {
    if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) invalid("Forbidden wire key");
    if (!("value" in Object.getOwnPropertyDescriptor(value2, key))) invalid("Wire accessors are forbidden");
  }
  return value2;
}
function wireId(value2) {
  return typeof value2 === "string" && value2.length > 0 && value2.length <= 4096;
}
function validateHistoireTarget(value2, optionalVariant = false) {
  const input = wireRecord(value2);
  if (!wireId(input.storyId) || !(input.variantId === null || wireId(input.variantId) || optionalVariant && input.variantId === void 0)) invalid("Invalid story/variant target");
}
function validateEmbedOrigin(value2) {
  if (typeof value2 !== "string") return invalid("Expected HTTP(S) origin");
  let url;
  try {
    url = new URL(value2);
  } catch {
    return invalid("Invalid HTTP(S) origin");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.origin === "null" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || value2.includes("*") || value2 !== url.origin) {
    invalid("Expected exact scheme/host/port origin");
  }
  return url.origin;
}
function validateSettingsPatch(value2) {
  measureWireValue(value2);
  const input = wireRecord(value2);
  const allowed = ["responsiveWidth", "responsiveHeight", "rotate", "backgroundColor", "checkerboard", "checkerboardTheme", "textDirection", "colorScheme", "globals"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid("Unknown preview setting");
  for (const key of ["responsiveWidth", "responsiveHeight"]) {
    const item = input[key];
    if (item !== void 0 && !(key === "responsiveHeight" && item === null) && !(typeof item === "number" && Number.isFinite(item) && item > 0)) invalid("Invalid viewport size");
  }
  for (const key of ["rotate", "checkerboard"]) {
    if (input[key] !== void 0 && typeof input[key] !== "boolean") invalid("Expected boolean setting");
  }
  if (input.backgroundColor !== void 0 && typeof input.backgroundColor !== "string") invalid("Expected background string");
  if (input.checkerboardTheme !== void 0 && !["light", "dark"].includes(input.checkerboardTheme)) invalid("Invalid checkerboard theme");
  if (input.textDirection !== void 0 && !["ltr", "rtl"].includes(input.textDirection)) invalid("Invalid text direction");
  if (input.colorScheme !== void 0 && !["light", "dark", "auto"].includes(input.colorScheme)) invalid("Invalid color scheme");
  if (input.globals !== void 0) {
    const globals = wireRecord(input.globals);
    if (Object.keys(globals).length > 32) invalid("Too many globals");
    for (const [key, item] of Object.entries(globals)) {
      if (!/^[A-Z][\w-]{0,63}$/i.test(key)) invalid("Invalid global key");
      if (!(item === null || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item) || typeof item === "string")) invalid("Invalid global value");
      if (typeof item === "string" && measureWireValue(item, { mode: "state", maxBytes: 1024 }) > 1024) invalid("Global string too large");
    }
  }
  return input;
}

// packages/histoire-protocol/src/channels.ts
function validateHostChannelNames(value2) {
  if (!Array.isArray(value2) || value2.length > 100 || value2.some((name) => typeof name !== "string" || !/^[a-z][a-z0-9-]{0,31}$/.test(name))) invalid("Invalid host channel names");
  return [...new Set(value2)];
}
function validateHostChannelPayload(value2, attributed = false) {
  measureWireValue(value2, { maxBytes: 64 * 1024 });
  const input = wireRecord(value2);
  const fields2 = attributed ? ["name", "type", "data", "runtimeId", "target"] : ["name", "type", "data"];
  if (Object.keys(input).some((key) => !fields2.includes(key)) || !wireId(input.type) || !Object.hasOwn(input, "data")) invalid("Invalid host channel payload");
  validateHostChannelNames([input.name]);
  if (attributed) {
    if (!wireId(input.runtimeId)) invalid("Invalid host channel runtime");
    validateHistoireTarget(input.target);
    if (input.target.variantId === null) invalid("Host channel needs a variant");
  }
  return input;
}
function createHostChannelRateLimiter(now = Date.now) {
  const accepted = [];
  let dropped = 0;
  return {
    /** Count saturates, so hostile traffic cannot overflow portable integers. */
    get droppedCount() {
      return dropped;
    },
    /** Record local schema/callback failures as well as rate overflow. */
    drop() {
      dropped = Math.min(Number.MAX_SAFE_INTEGER, dropped + 1);
    },
    /** Admit at most 50 messages in any elapsed second across all names. */
    accept() {
      const time = now();
      while (accepted.length && accepted[0] <= time - 1e3) accepted.shift();
      if (accepted.length === 50) {
        this.drop();
        return false;
      }
      accepted.push(time);
      return true;
    },
    /** A replacement document never inherits pending messages or old rate tokens. */
    reset() {
      accepted.length = 0;
      dropped = 0;
    }
  };
}

// packages/histoire-protocol/src/helpers/matrix-numeric.ts
var HISTOIRE_MATRIX_NUMERIC_VALUES = Object.freeze([0, 1, 2, 5, 10]);
function getHistoireNumericMatrixValues(input) {
  if (!Array.isArray(input) || input.length > 64) return;
  const items = Array.from(input);
  if (items.some((value2) => typeof value2 !== "number" || !Number.isFinite(value2))) return;
  const values = [...new Set(items.map((value2) => value2 === 0 ? 0 : value2))];
  return values.length >= 2 ? values : void 0;
}
function decimal(value2) {
  const [mantissa, exponent = "0"] = String(value2).toLowerCase().split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return { coefficient: BigInt(mantissa.replace(".", "")), scale: fraction - Number(exponent) };
}
function getHistoireMatrixRangeValues(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const { min, max, step } = input;
  if ([min, max, step].some((value2) => typeof value2 !== "number" || !Number.isFinite(value2)) || min > max || step <= 0) return;
  const decimals = [min, max, step].map(decimal);
  const scale = Math.max(...decimals.map((value2) => value2.scale));
  const [start, end, interval] = decimals.map((value2) => value2.coefficient * 10n ** BigInt(scale - value2.scale));
  const count = (end - start) / interval + 1n;
  if (count > 64n) return;
  const values = Array.from({ length: Number(count) }, (_, index) => Number(`${start + BigInt(index) * interval}e${-scale}`));
  return [...new Set(values.map((value2) => value2 === 0 ? 0 : value2))];
}
function getHistoireMatrixRange(input) {
  if (!getHistoireNumericMatrixValues(input)) return;
  const decimals = input.slice(0, 2).map(decimal);
  const scale = Math.max(...decimals.map((value2) => value2.scale));
  const [first, second] = decimals.map((value2) => value2.coefficient * 10n ** BigInt(scale - value2.scale));
  const range = { min: input[0], max: input[input.length - 1], step: Number(`${second - first}e${-scale}`) };
  const values = getHistoireMatrixRangeValues(range);
  return values?.length === input.length && values.every((value2, index) => value2 === input[index]) ? range : void 0;
}

// packages/histoire-protocol/src/helpers/matrix.ts
function isHistoireMatrixPropName(name) {
  return Boolean(name) && !name.startsWith("_h") && !["__proto__", "prototype", "constructor"].includes(name);
}
function getHistoireMatrixValues(value2) {
  if (!Array.isArray(value2)) return;
  const values = value2.filter((item) => item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item)).map((item) => item === 0 ? 0 : item);
  return [...new Map(values.map((item) => [JSON.stringify([typeof item, item]), item])).values()].slice(0, 64);
}
function getHistoireFiniteMatrixValues(value2) {
  if (!Array.isArray(value2) || value2.length > 64 || value2.some((item) => getHistoireMatrixValues([item])?.length !== 1)) return;
  return getHistoireMatrixValues(value2);
}
function normalizeHistoireMatrixHint(value2) {
  if (!value2 || typeof value2 !== "object") return;
  const input = value2.axes;
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const axes = Object.fromEntries(Object.entries(input).filter(([name]) => isHistoireMatrixPropName(name)).map(([name, values]) => [name, Array.isArray(values) ? getHistoireMatrixValues(values) : getHistoireMatrixRangeValues(values)]).filter(([, values]) => Array.isArray(values) && values.length).slice(0, 32));
  if (!Object.keys(axes).length) return;
  for (const values of Object.values(axes)) Object.freeze(values);
  return Object.freeze({ axes: Object.freeze(axes) });
}

// packages/histoire-protocol/src/plugin-channels.ts
var HISTOIRE_PLUGIN_CHANNEL_MAX_BYTES = 64 * 1024;
var HISTOIRE_PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
var HISTOIRE_PLUGIN_NOTICE_PREFIX = "histoire:";
var HISTOIRE_PLUGIN_NOTICES = ["histoire:attached", "histoire:detached", "histoire:error"];
function isHistoirePluginNotice(type) {
  return type.startsWith(HISTOIRE_PLUGIN_NOTICE_PREFIX);
}
function isHistoirePluginId(value2) {
  return typeof value2 === "string" && value2.length <= 64 && value2 !== "builtin" && HISTOIRE_PLUGIN_ID_PATTERN.test(value2);
}
function validateNotice(type, data) {
  if (!HISTOIRE_PLUGIN_NOTICES.includes(type)) invalid("Unknown plugin notice");
  if (type !== "histoire:error") {
    if (data !== null) invalid("Plugin notice carries no data");
    return;
  }
  const error = wireRecord(data);
  if (Object.keys(error).some((key) => key !== "phase" && key !== "message") || typeof error.phase !== "string" || error.phase.length > 64 || typeof error.message !== "string" || error.message.length > 2e3) invalid("Invalid plugin failure notice");
}
function validatePluginChannelPayload(value2, attributed = false, notices = attributed) {
  measureWireValue(value2, { maxBytes: HISTOIRE_PLUGIN_CHANNEL_MAX_BYTES });
  const input = wireRecord(value2);
  const fields2 = attributed ? ["pluginId", "actorId", "type", "data", "target", "runtimeId"] : ["pluginId", "actorId", "type", "data"];
  if (Object.keys(input).some((key) => !fields2.includes(key)) || !Object.hasOwn(input, "data") || input.data === void 0) invalid("Invalid plugin channel payload");
  if (!isHistoirePluginId(input.pluginId) || !wireId(input.actorId) || !wireId(input.type)) invalid("Invalid plugin channel identity");
  if (isHistoirePluginNotice(input.type)) {
    if (!notices) invalid("Plugin message type is reserved");
    validateNotice(input.type, input.data);
  }
  if (attributed) {
    if (!wireId(input.runtimeId)) invalid("Invalid plugin channel runtime");
    validateHistoireTarget(input.target);
    if (input.target.variantId === null) invalid("Plugin channel needs a variant");
  }
  return input;
}
function validateFramePluginInventory(value2) {
  if (!Array.isArray(value2) || value2.length > 256) return invalid("Invalid frame plugin inventory");
  const seen = /* @__PURE__ */ new Set();
  for (const entry of value2) {
    const plugin = wireRecord(entry);
    if (Object.keys(plugin).some((key) => key !== "id" && key !== "apiVersion") || !isHistoirePluginId(plugin.id) || seen.has(plugin.id) || !Number.isSafeInteger(plugin.apiVersion) || plugin.apiVersion < 1) {
      invalid("Invalid frame plugin entry");
    }
    seen.add(plugin.id);
  }
  return value2;
}
function createPluginChannelLimiters(now = Date.now) {
  const plugins = /* @__PURE__ */ new Map();
  return {
    /** Limiter pair of one plugin, created on first use. */
    get(pluginId) {
      let limiters = plugins.get(pluginId);
      if (!limiters) {
        limiters = { incoming: createHostChannelRateLimiter(now), outgoing: createHostChannelRateLimiter(now) };
        plugins.set(pluginId, limiters);
      }
      return limiters;
    },
    /** Saturated drop count of one plugin across both directions. */
    droppedCount(pluginId) {
      const limiters = plugins.get(pluginId);
      return limiters ? Math.min(Number.MAX_SAFE_INTEGER, limiters.incoming.droppedCount + limiters.outgoing.droppedCount) : 0;
    },
    /** Replacement documents never inherit rate tokens or counts. */
    reset() {
      plugins.clear();
    }
  };
}

// packages/histoire-protocol/src/url/embed-origins.ts
function validateEmbedOrigins(value2) {
  if (!Array.isArray(value2)) invalid("Expected embed.allowedOrigins array");
  return [...new Set(value2.map(validateEmbedOrigin))];
}
function resolveEmbedOrigins(baked, override) {
  const configured = validateEmbedOrigins(baked);
  if (!override?.present) return configured;
  try {
    return validateEmbedOrigins(override.value);
  } catch {
    return [];
  }
}
function createEmbedFrameAncestors(allowedOrigins) {
  return ["frame-ancestors 'self'", ...validateEmbedOrigins(allowedOrigins)].join(" ");
}
function mergeEmbedFrameAncestors(existing, allowedOrigins) {
  const directive = createEmbedFrameAncestors(allowedOrigins);
  const merge = (policy) => [...policy.split(";").map((part) => part.trim()).filter((part) => part && !/^frame-ancestors(?:\s|$)/i.test(part)), directive].join("; ");
  return Array.isArray(existing) ? existing.map(merge) : merge(existing ?? "");
}

// packages/histoire-protocol/src/bridge/source-descriptor.ts
function validateSourceAssetReference(value2) {
  if (typeof value2 !== "string" || !value2 || /[\\\0?#:%]/.test(value2) || value2.startsWith("/") || value2.split("/").some((part) => !part || part === "." || part === "..")) invalid("Expected relative source asset reference");
  return value2;
}
function keys(input, allowed) {
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid("Unknown source descriptor field");
}
function validateSourceDescriptorFields(input) {
  if (input.framePlugins !== void 0) validateFramePluginInventory(input.framePlugins);
  if (input.embed !== void 0) {
    const policy = wireRecord(input.embed);
    keys(policy, ["allowedOrigins", "allowOpenInEditor", "allowServerTests"]);
    validateEmbedOrigins(policy.allowedOrigins);
    if (typeof policy.allowOpenInEditor !== "boolean" || typeof policy.allowServerTests !== "boolean") invalid("Invalid embed policy");
  }
  if (input.assets !== void 0) {
    const assets = wireRecord(input.assets);
    keys(assets, ["search", "content"]);
    validateSourceAssetReference(assets.search);
    if (!Array.isArray(assets.content)) invalid("Invalid source content inventory");
    const seen = /* @__PURE__ */ new Set();
    for (const value2 of assets.content) {
      const entry = wireRecord(value2);
      keys(entry, ["storyId", "docs", "rawSource"]);
      if (!wireId(entry.storyId) || seen.has(entry.storyId)) invalid("Invalid source content target");
      seen.add(entry.storyId);
      if (entry.docs !== void 0) validateSourceAssetReference(entry.docs);
      if (entry.rawSource !== void 0) validateSourceAssetReference(entry.rawSource);
    }
  }
  if (input.config !== void 0) {
    const config = wireRecord(input.config);
    keys(config, ["title", "routerMode", "matrix", "theme", "responsivePresets", "backgroundPresets", "autoApplyContrastColor", "storyCollectTimeout", "runTimeout", "testMaxWorkers", "globals", "textDirection"]);
    if (config.routerMode !== void 0 && !["history", "hash"].includes(config.routerMode)) invalid("Invalid source router mode");
    if (config.matrix !== void 0) {
      const matrix = wireRecord(config.matrix);
      keys(matrix, ["numericValues"]);
      if (!getHistoireNumericMatrixValues(matrix.numericValues)) invalid("Invalid matrix numeric values");
    }
    if (config.globals !== void 0) validateSettingsPatch({ globals: config.globals });
    if (config.textDirection !== void 0) validateSettingsPatch({ textDirection: config.textDirection });
    if (typeof config.title !== "string" || typeof config.autoApplyContrastColor !== "boolean") invalid("Invalid source config");
    for (const key of ["storyCollectTimeout", "runTimeout"]) {
      if (config[key] !== void 0 && (typeof config[key] !== "number" || !Number.isFinite(config[key]) || config[key] <= 0)) invalid("Invalid source deadline");
    }
    if (config.testMaxWorkers !== void 0 && (!Number.isSafeInteger(config.testMaxWorkers) || config.testMaxWorkers < 1)) invalid("Invalid source test worker limit");
    const theme = wireRecord(config.theme);
    keys(theme, ["defaultColorScheme", "darkClass", "hideColorSchemeSwitch", "colors"]);
    validateSettingsPatch({ colorScheme: theme.defaultColorScheme });
    if (typeof theme.darkClass !== "string" || theme.hideColorSchemeSwitch !== void 0 && typeof theme.hideColorSchemeSwitch !== "boolean") invalid("Invalid source theme");
    if (theme.colors !== void 0) {
      for (const shades of Object.values(wireRecord(theme.colors))) {
        if (Object.values(wireRecord(shades)).some((value2) => typeof value2 !== "string")) invalid("Invalid source colors");
      }
    }
    if (!Array.isArray(config.responsivePresets) || !Array.isArray(config.backgroundPresets)) invalid("Invalid source presets");
    for (const value2 of config.responsivePresets) {
      const preset = wireRecord(value2);
      keys(preset, ["label", "width", "height"]);
      if (typeof preset.label !== "string" || typeof preset.width !== "number" || !Number.isFinite(preset.width) || preset.width <= 0 || preset.height != null && (typeof preset.height !== "number" || !Number.isFinite(preset.height) || preset.height <= 0)) invalid("Invalid responsive preset");
    }
    for (const value2 of config.backgroundPresets) {
      const preset = wireRecord(value2);
      keys(preset, ["label", "color", "contrastColor"]);
      if (["label", "color"].some((key) => typeof preset[key] !== "string") || preset.contrastColor !== void 0 && typeof preset.contrastColor !== "string") invalid("Invalid background preset");
    }
  }
}

// packages/histoire-protocol/src/bridge/catalog.ts
var operations = ["catalog", "search", "docs", "rawSource", "dynamicSource", "state", "customControls", "previewTests", "serverTests", "openInEditor", "hostChannels"];
var optionalOperations = ["framePlugins"];
var surfaces = ["explorer", "preview", "tree", "search", "toolbar", "controls", "docs", "source", "events", "tests"];
function validateHistoireCapabilities(value2) {
  const input = wireRecord(value2);
  const views = wireRecord(input.surfaces);
  for (const [record, keys2] of [[input, operations], [views, surfaces]]) {
    for (const key of keys2) {
      const capability = wireRecord(record[key]);
      if (typeof capability.available !== "boolean" || capability.reason !== void 0 && typeof capability.reason !== "string") invalid("Invalid capability");
      if (capability.channels !== void 0) {
        if (key !== "hostChannels" || record !== input) invalid("Channel names require hostChannels capability");
        validateHostChannelNames(capability.channels);
      }
    }
  }
  if (input.framePlugins !== void 0) {
    const capability = wireRecord(input.framePlugins);
    if (Object.keys(capability).some((key) => key !== "available" && key !== "reason") || typeof capability.available !== "boolean" || capability.reason !== void 0 && typeof capability.reason !== "string") invalid("Invalid capability");
  }
  if (Object.keys(input).some((key) => key !== "surfaces" && !operations.includes(key) && !optionalOperations.includes(key)) || Object.keys(views).some((key) => !surfaces.includes(key))) invalid("Unknown capability");
}
function validateRelativeLabel(value2) {
  if (value2 !== void 0 && (typeof value2 !== "string" || /^(?:\/|[a-z]:[\\/]|\\\\|\0)/i.test(value2))) invalid("Expected relative file label");
}
function validateHistoireCatalogStory(value2) {
  const input = wireRecord(value2);
  if (!wireId(input.id) || typeof input.title !== "string" || typeof input.docsOnly !== "boolean") invalid("Invalid catalog story");
  if (!Array.isArray(input.path) || input.path.some((part) => typeof part !== "string")) invalid("Invalid story path");
  if (!Array.isArray(input.variants)) invalid("Expected variants");
  for (const value3 of input.variants) {
    const variant = wireRecord(value3);
    if (!wireId(variant.id) || typeof variant.title !== "string" || variant.hasTests !== void 0 && typeof variant.hasTests !== "boolean") invalid("Invalid catalog variant");
    if (variant.source !== void 0) {
      const source = wireRecord(variant.source);
      if (typeof source.raw !== "boolean" || typeof source.dynamic !== "boolean") invalid("Invalid source availability");
    }
  }
  const content = wireRecord(input.content);
  if (typeof content.docs !== "boolean" || typeof content.rawSource !== "boolean") invalid("Invalid content availability");
  for (const key of ["group", "icon", "iconColor", "supportPluginId"]) {
    if (input[key] !== void 0 && typeof input[key] !== "string") invalid("Invalid catalog metadata");
  }
  validateRelativeLabel(input.relativePath);
  if (input.fileOrigin !== void 0 && !["project", "generated", "external"].includes(input.fileOrigin)) invalid("Invalid story file origin");
  if (input.runtimeRevision !== void 0 && (typeof input.runtimeRevision !== "string" || !/^[a-f0-9]{64}$/.test(input.runtimeRevision))) invalid("Invalid story runtime revision");
  if (input.layoutExplicit !== void 0 && typeof input.layoutExplicit !== "boolean") invalid("Invalid layout provenance");
  if (input.hasCustomControls !== void 0 && typeof input.hasCustomControls !== "boolean") invalid("Invalid custom controls availability");
  if (input.layout !== void 0) {
    const layout = wireRecord(input.layout);
    if (!["single", "grid"].includes(layout.type)) invalid("Invalid story layout");
  }
  if (input.matrix !== void 0) {
    const axes = wireRecord(wireRecord(input.matrix).axes);
    if (Object.keys(axes).length > 32) invalid("Invalid matrix axes");
    for (const [name, values] of Object.entries(axes)) {
      const finite = getHistoireMatrixValues(values);
      if (!isHistoireMatrixPropName(name) || !Array.isArray(values) || !finite || !values.length || values.length > 64 || finite.length !== new Set(values).size) invalid("Invalid matrix values");
    }
  }
  return input;
}
function validateHistoireCatalog(value2) {
  measureWireValue(value2, { maxBytes: HISTOIRE_WIRE_LIMITS.catalog });
  const input = wireRecord(value2);
  if (!Array.isArray(input.stories) || !Array.isArray(input.tree) || !Array.isArray(input.diagnostics)) invalid("Invalid catalog");
  for (const story of input.stories) validateHistoireCatalogStory(story);
  const queue = [...input.tree];
  while (queue.length) {
    const node = wireRecord(queue.pop());
    if (typeof node.title !== "string") invalid("Invalid tree title");
    if (node.kind === "story") {
      if (!wireId(node.storyId)) invalid("Invalid tree story");
    } else if (node.kind === "folder" || node.kind === "group") {
      if (!Array.isArray(node.children) || node.id !== void 0 && !wireId(node.id)) invalid("Invalid tree folder");
      for (const child of node.children) queue.push(child);
    } else {
      invalid("Unknown catalog tree node");
    }
  }
  validateHistoireDiagnostics(input.diagnostics);
  return input;
}
function validateHistoireDiagnostics(value2) {
  measureWireValue(value2, { maxBytes: HISTOIRE_WIRE_LIMITS.catalog });
  if (!Array.isArray(value2)) invalid("Invalid diagnostics");
  for (const entry of value2) {
    const diagnostic = wireRecord(entry);
    if (!wireId(diagnostic.code) || typeof diagnostic.message !== "string" || !["warning", "error"].includes(diagnostic.severity)) invalid("Invalid diagnostic");
    if (diagnostic.storyId !== void 0 && !wireId(diagnostic.storyId)) invalid("Invalid diagnostic target");
    validateRelativeLabel(diagnostic.relativePath);
  }
}
function validateHistoireSourceDescriptor(value2) {
  measureWireValue(value2, { maxBytes: HISTOIRE_WIRE_LIMITS.catalog });
  const input = wireRecord(value2);
  if (input.descriptorVersion !== 1 || input.protocolVersion !== 1 || !wireId(input.sourceId) || !wireId(input.epoch) || !wireId(input.revision) || !["dev", "static"].includes(input.mode)) invalid("Invalid source descriptor");
  validateHistoireCapabilities(input.capabilities);
  validateHistoireCatalog(input.catalog);
  validateSourceDescriptorFields(input);
  return input;
}

// packages/histoire-protocol/src/bridge/snapshot.ts
function validateHistoireViewports(value2) {
  if (!Array.isArray(value2)) invalid("Expected runtime viewports");
  for (const entry of value2) {
    const viewport = wireRecord(entry);
    validateHistoireTarget(viewport.target);
    for (const key of ["x", "y", "width", "height", "scale"]) {
      if (typeof viewport[key] !== "number" || !Number.isFinite(viewport[key]) || ["width", "height", "scale"].includes(key) && viewport[key] <= 0) invalid("Invalid runtime geometry");
    }
    const clip = wireRecord(viewport.visibleRect);
    for (const key of ["x", "y", "width", "height"]) {
      if (typeof clip[key] !== "number" || !Number.isFinite(clip[key]) || ["width", "height"].includes(key) && clip[key] <= 0) invalid("Invalid visible clip");
    }
  }
}
function validateHistoireRuntimeSnapshot(value2) {
  const input = wireRecord(value2);
  if (!["absent", "mounting", "ready", "failed", "stale"].includes(input.status)) invalid("Invalid runtime status");
  for (const key of ["mountId", "runtimeId"]) {
    if (!(input[key] === null || wireId(input[key]))) invalid("Invalid runtime owner");
  }
  validateHistoireViewports(input.viewports);
  if (input.viewport !== null) validateHistoireViewports([input.viewport]);
  if (input.status === "ready" && (!wireId(input.mountId) || !wireId(input.runtimeId))) invalid("Ready runtime requires owner");
  return input;
}
function validateHistoireStateSnapshot(value2, measured = false) {
  if (!measured) validateWireValue(value2, { kind: "event", name: "state.changed" });
  const input = wireRecord(value2);
  validateHistoireTarget(input.target);
  if (!wireId(input.runtimeId) || !input.value || typeof input.value !== "object") invalid("Invalid state snapshot");
  return input;
}
function validateHistoireEvent(value2, measured = false) {
  const input = wireRecord(value2);
  validateHistoireTarget(input.target);
  if (!wireId(input.runtimeId) || !Number.isSafeInteger(input.sequence) || input.sequence < 0 || typeof input.timestamp !== "number" || !Number.isFinite(input.timestamp) || !Object.hasOwn(input, "payload")) invalid("Invalid story event");
  if (!measured) measureWireValue(input.payload);
  return input;
}
function validateHistoireSnapshot(value2, measured = false) {
  if (!measured) validateWireValue(value2, { kind: "request", name: "view.sync" });
  const input = wireRecord(value2);
  if (!["idle", "connecting", "ready", "restarting", "disconnected", "failed", "disposed"].includes(input.status) || typeof input.stale !== "boolean") invalid("Invalid session lifecycle");
  if (input.source !== null) {
    const source = wireRecord(input.source);
    if (!wireId(source.sourceId) || !wireId(source.epoch) || !wireId(source.revision) || typeof source.url !== "string" || !["dev", "static"].includes(source.mode)) invalid("Invalid source identity");
    let url;
    try {
      url = new URL(source.url);
    } catch {
      return invalid("Invalid source URL");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) invalid("Invalid source URL");
  }
  validateHistoireCatalog(input.catalog);
  validateHistoireDiagnostics(input.diagnostics);
  const diagnostics = wireRecord(input.catalog).diagnostics;
  if (!Array.isArray(input.diagnostics) || input.diagnostics.length !== diagnostics.length) invalid("Invalid snapshot diagnostics");
  if (input.selection !== null) validateHistoireTarget(input.selection);
  validateHistoireRuntimeSnapshot(input.runtime);
  if (input.state !== null) validateHistoireStateSnapshot(input.state, measured);
  const settings = validateSettingsPatch(input.settings);
  for (const key of ["responsiveWidth", "responsiveHeight", "rotate", "backgroundColor", "checkerboard", "textDirection", "colorScheme", "globals"]) {
    if (!Object.hasOwn(settings, key)) invalid("Incomplete session settings");
  }
  validateHistoireCapabilities(input.capabilities);
  const events = wireRecord(input.events);
  if (!Array.isArray(events.items) || events.items.length > 1e3 || !Number.isSafeInteger(events.droppedCount) || events.droppedCount < 0) invalid("Invalid event history");
  for (const event of events.items) validateHistoireEvent(event);
  return input;
}

// packages/histoire-protocol/src/bridge/test-execution.ts
function validateHistoireTestExecution(value2) {
  const input = wireRecord(value2);
  if (Object.keys(input).some((key) => !["runId", "mode", "target", "sourceId", "epoch", "revision", "runtimeId"].includes(key))) invalid("Invalid test execution fields");
  if (!wireId(input.runId) || !["preview", "server"].includes(input.mode)) invalid("Invalid test execution identity");
  if (input.target !== void 0) validateHistoireTarget(input.target);
  const target = input.target;
  const source = ["sourceId", "epoch", "revision"].filter((key) => input[key] !== void 0);
  if (source.length && source.length !== 3) invalid("Incomplete test source identity");
  for (const key of source) {
    if (!wireId(input[key])) invalid("Invalid test source identity");
  }
  if (input.mode === "preview" ? !wireId(input.runtimeId) || !target?.variantId || source.length !== 3 : input.runtimeId !== void 0) invalid("Invalid test runtime identity");
}

// packages/histoire-protocol/src/bridge/results.ts
function validateHistoireErrorData(value2) {
  validateWireValue(value2, { kind: "error", name: "" });
  const input = wireRecord(value2);
  if (!HISTOIRE_ERROR_CODES.includes(input.code) || typeof input.message !== "string") invalid("Invalid bridge error");
}
function validateTestError(value2) {
  if (typeof value2 === "string") return;
  const input = wireRecord(value2);
  if (typeof input.message !== "string") invalid("Invalid test error");
  for (const key of ["name", "stack", "diff"]) {
    if (input[key] !== void 0 && typeof input[key] !== "string") invalid("Invalid test error field");
  }
}
function validateHistoireTestResult(value2, summary) {
  const input = wireRecord(value2);
  if (input.execution !== void 0) validateHistoireTestExecution(input.execution);
  if (!summary) {
    if (!Array.isArray(input.definitions)) invalid("Invalid test collection");
    for (const value3 of input.definitions) {
      const test = wireRecord(value3);
      if (!wireId(test.id) || typeof test.name !== "string" || typeof test.fullName !== "string" || test.mode !== void 0 && !["run", "skip", "only", "todo"].includes(test.mode)) invalid("Invalid test definition");
      if (test.timeout !== void 0 && (typeof test.timeout !== "number" || !Number.isFinite(test.timeout) || test.timeout < 0)) invalid("Invalid test deadline");
    }
    if (input.error !== void 0 && input.error !== null) validateTestError(input.error);
    return;
  }
  if (typeof input.ok !== "boolean" || !Array.isArray(input.errors) || !Array.isArray(input.tests)) invalid("Invalid test run summary");
  for (const key of ["total", "passed", "failed", "skipped"]) {
    if (!Number.isSafeInteger(input[key]) || input[key] < 0) invalid("Invalid test count");
  }
  for (const error of input.errors) validateTestError(error);
  for (const value3 of input.tests) {
    const test = wireRecord(value3);
    if (!wireId(test.id) || typeof test.name !== "string" || typeof test.fullName !== "string" || !["passed", "failed", "skipped"].includes(test.state) || !Array.isArray(test.errors)) invalid("Invalid test case");
    for (const error of test.errors) validateTestError(error);
    for (const key of ["storyId", "variantId"]) {
      if (test[key] !== void 0 && !wireId(test[key])) invalid("Invalid test target");
    }
  }
  if (input.uncollectedStories !== void 0) {
    if (!Array.isArray(input.uncollectedStories)) invalid("Invalid uncollected stories");
    for (const value3 of input.uncollectedStories) {
      const story = wireRecord(value3);
      if (typeof story.relativePath !== "string" || typeof story.error !== "string") invalid("Invalid collection failure");
    }
  }
}
function validateHistoireContent(value2, docs) {
  const input = wireRecord(value2);
  if (!wireId(input.storyId) || !wireId(input.epoch) || !wireId(input.revision) || typeof input.body !== "string" || input.variantId !== void 0 && !wireId(input.variantId)) invalid("Invalid content identity/body");
  if (docs ? !["sibling", "standalone", "inline", "collected"].includes(input.origin) || !["html", "text"].includes(input.format) : !["file", "virtual", "generated", "explicit", "slot"].includes(input.origin) || !["raw", "dynamic"].includes(input.mode)) {
    invalid("Invalid content kind");
  }
  for (const key of ["relativePath", "language"]) {
    if (input[key] !== void 0 && typeof input[key] !== "string") invalid("Invalid content label");
  }
}
function validateBridgeResult(command, value2) {
  validateWireValue(value2, { kind: "response", name: command });
  if (command === "catalog.list") {
    if (!Array.isArray(value2)) invalid("Expected catalog stories");
    for (const story of value2) validateHistoireCatalogStory(story);
  } else if (command === "catalog.getStory") {
    validateHistoireCatalogStory(value2);
  } else if (command === "catalog.search") {
    if (!Array.isArray(value2)) invalid("Expected search results");
    for (const entry of value2) {
      const result = wireRecord(entry);
      validateHistoireTarget(result.target);
      if (!["story", "variant", "docs"].includes(result.kind) || typeof result.title !== "string" || typeof result.rank !== "number" || !Number.isFinite(result.rank)) invalid("Invalid search result");
      if (result.match !== void 0) {
        const match = wireRecord(result.match);
        if (!["literal", "fuzzy"].includes(match.mode) || typeof match.score !== "number" || !Number.isFinite(match.score) || match.score < 0) invalid("Invalid search matching evidence");
      }
      for (const key of ["excerpt", "anchor"]) {
        if (result[key] !== void 0 && typeof result[key] !== "string") invalid("Invalid search excerpt");
      }
    }
  } else if (["state.get", "state.patch", "state.reset"].includes(command)) {
    if (value2 !== null || command === "state.get") validateHistoireStateSnapshot(value2);
  } else if (command === "docs.get" || command === "source.get") {
    validateHistoireContent(value2, command === "docs.get");
  } else if (command === "tests.collect" || command === "tests.run") {
    validateHistoireTestResult(value2, command === "tests.run");
  } else if (command === "tests.cancel") {
    const result = wireRecord(value2);
    if (Object.keys(result).some((key) => !["requestId", "cancelled"].includes(key)) || !wireId(result.requestId) || result.cancelled !== true) invalid("Invalid test cancellation acknowledgment");
  } else if (command === "controls.preset") {
    const input = wireRecord(value2);
    if (Object.keys(input).some((key) => !["items", "selectedId"].includes(key)) || !Array.isArray(input.items) || input.items.length > 1e3 || input.selectedId !== void 0 && !wireId(input.selectedId)) {
      invalid("Invalid preset result");
    }
    for (const value3 of input.items) {
      const item = wireRecord(value3);
      if (Object.keys(item).some((key) => !["id", "label"].includes(key)) || !wireId(item.id) || typeof item.label !== "string" || item.label.length > 120) invalid("Invalid preset option");
    }
  } else if (value2 !== null) {
    invalid("Expected null acknowledgment");
  }
}

// packages/histoire-protocol/src/bridge/events.ts
function fields(input, allowed) {
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid("Unknown controls event field");
}
function validateOverlay(input, closing) {
  fields(input, closing ? ["id"] : ["id", "anchor", "overlay"]);
  if (!wireId(input.id)) invalid("Invalid overlay identity");
  if (closing) return;
  const anchor = wireRecord(input.anchor);
  fields(anchor, ["x", "y", "width", "height"]);
  for (const key of ["x", "y", "width", "height"]) {
    if (typeof anchor[key] !== "number" || !Number.isFinite(anchor[key]) || ["width", "height"].includes(key) && anchor[key] < 0) invalid("Invalid overlay anchor");
  }
  const overlay = wireRecord(input.overlay);
  if (overlay.kind === "select") {
    fields(overlay, ["kind", "items", "label", "selectedId"]);
    if (!Array.isArray(overlay.items) || overlay.label !== void 0 && typeof overlay.label !== "string" || overlay.selectedId !== void 0 && !wireId(overlay.selectedId)) invalid("Invalid select overlay");
    for (const value2 of overlay.items) {
      const item = wireRecord(value2);
      fields(item, ["id", "label", "disabled"]);
      if (!wireId(item.id) || typeof item.label !== "string" || item.disabled !== void 0 && typeof item.disabled !== "boolean") invalid("Invalid overlay option");
    }
  } else if (overlay.kind === "tooltip") {
    fields(overlay, ["kind", "content", "placement", "distance"]);
    if (typeof overlay.content !== "string" || overlay.placement !== void 0 && !["top", "bottom", "left", "right"].includes(overlay.placement) || overlay.distance !== void 0 && (typeof overlay.distance !== "number" || !Number.isFinite(overlay.distance))) {
      invalid("Invalid tooltip overlay");
    }
  } else {
    invalid("Unknown overlay kind");
  }
}
function validateBridgeEventPayload(event, value2, measured = false) {
  const input = wireRecord(value2);
  if (event === "catalog.changed") {
    validateHistoireSourceDescriptor(input.descriptor);
  } else if (event === "content.changed") {
    if (!Array.isArray(input.storyIds) || input.storyIds.some((id) => !wireId(id))) invalid("Invalid changed-content targets");
  } else if (event === "selection.changed") {
    if (input.target !== null) validateHistoireTarget(input.target);
  } else if (event === "settings.changed") {
    validateSettingsPatch(input);
  } else if (event === "state.changed") {
    validateHistoireStateSnapshot(input, measured);
  } else if (event === "layout.changed") {
    validateHistoireViewports(input.viewports);
  } else if (event === "events.appended") {
    if (!Array.isArray(input.items) || input.items.length > 1e3 || input.reset !== void 0 && typeof input.reset !== "boolean" || input.droppedCount !== void 0 && (!Number.isSafeInteger(input.droppedCount) || input.droppedCount < 0)) invalid("Invalid event batch");
    for (const entry of input.items) validateHistoireEvent(entry, measured);
  } else if (event === "readiness.changed") {
    validateHistoireRuntimeSnapshot(input.runtime);
  } else if (event === "source.disconnected") {
    if (input.reason !== void 0) validateHistoireErrorData(input.reason);
  } else if (event === "tests.progress") {
    if (!wireId(input.runId) || !["collecting", "running", "completed", "cancelled", "failed"].includes(input.status)) invalid("Invalid test progress");
    for (const key of ["completed", "total"]) {
      if (input[key] !== void 0 && (!Number.isSafeInteger(input[key]) || input[key] < 0)) invalid("Invalid test progress count");
    }
    if (input.summary !== void 0) validateHistoireTestResult(input.summary, true);
    if (input.error !== void 0) validateHistoireErrorData(input.error);
  } else if (["overlay.open", "overlay.update", "overlay.close"].includes(event)) {
    validateOverlay(input, event === "overlay.close");
  } else if (event === "overlay.result") {
    fields(input, ["id", "restoreFocus", "itemId", "focusDirection"]);
    if (!wireId(input.id) || typeof input.restoreFocus !== "boolean" || input.itemId !== void 0 && !wireId(input.itemId) || input.focusDirection !== void 0 && !["next", "previous"].includes(input.focusDirection)) {
      invalid("Invalid overlay result");
    }
  } else if (event === "controls.height") {
    fields(input, ["height", "hasControls"]);
    if (typeof input.height !== "number" || !Number.isFinite(input.height) || input.height < 0 || input.hasControls !== void 0 && typeof input.hasControls !== "boolean") invalid("Invalid controls height");
  } else if (event === "focus.changed") {
    fields(input, ["focused", "direction", "action"]);
    if (typeof input.focused !== "boolean" || input.direction !== void 0 && !["next", "previous"].includes(input.direction) || input.action !== void 0 && !["search", "toggle-ui", "show-ui"].includes(input.action) || input.action !== void 0 && input.direction !== void 0) invalid("Invalid focus state");
  } else if (event === "channel.message") {
    validateHostChannelPayload(input, true);
  } else if (event === "plugin.message") {
    validatePluginChannelPayload(input, true);
  }
}

// packages/histoire-protocol/src/bridge/types.ts
var HISTOIRE_PROTOCOL_VERSION = 1;
var HISTOIRE_DESCRIPTOR_VERSION = 1;
var HISTOIRE_BRIDGE_COMMANDS = ["catalog.list", "catalog.getStory", "catalog.search", "selection.select", "state.get", "state.patch", "state.reset", "settings.update", "events.clear", "docs.get", "source.get", "tests.collect", "tests.run", "tests.cancel", "openInEditor", "subscriptions.add", "subscriptions.remove", "view.sync", "controls.configure", "controls.preset", "channel.post", "plugin.post"];
var HISTOIRE_BRIDGE_EVENTS = ["catalog.changed", "content.changed", "selection.changed", "state.changed", "settings.changed", "events.appended", "readiness.changed", "layout.changed", "tests.progress", "source.disconnected", "overlay.open", "overlay.update", "overlay.close", "overlay.result", "controls.height", "focus.changed", "channel.message", "plugin.message"];

// packages/histoire-protocol/src/bridge/payload.ts
function validateBridgePayload(command, value2, measured = false) {
  const input = wireRecord(value2);
  const fields2 = {
    "catalog.list": [],
    "catalog.getStory": ["storyId"],
    "catalog.search": ["query"],
    "selection.select": ["storyId", "variantId"],
    "state.get": [],
    "state.reset": [],
    "events.clear": [],
    "docs.get": ["storyId"],
    "source.get": ["storyId", "variantId", "mode"],
    "tests.collect": [],
    "tests.run": ["mode"],
    "tests.cancel": ["requestId"],
    "openInEditor": ["storyId", "variantId"],
    "subscriptions.add": ["subscriptionId", "streams"],
    "subscriptions.remove": ["subscriptionId"],
    "channel.post": ["name", "type", "data"],
    "plugin.post": ["pluginId", "actorId", "type", "data"],
    "controls.configure": ["customOnly"],
    "controls.preset": ["action", "id", "label"]
  };
  const allowed = fields2[command];
  if (allowed && Object.keys(input).some((key) => !allowed.includes(key))) invalid("Unknown command argument");
  if (["catalog.getStory", "docs.get"].includes(command) && !wireId(input.storyId)) invalid("Expected story ID");
  if (command === "catalog.search" && typeof input.query !== "string") invalid("Expected search query");
  if (command === "selection.select") validateHistoireTarget(input, true);
  if (command === "state.patch") {
    if (Object.hasOwn(input, "_hPropDefs")) invalid("Derived controls metadata is runtime-owned");
  }
  if (command === "settings.update") validateSettingsPatch(input);
  if (command === "source.get") {
    if (!wireId(input.storyId) || input.variantId !== void 0 && !wireId(input.variantId) || !["raw", "dynamic"].includes(input.mode)) invalid("Invalid source request");
  }
  if (command === "tests.run" && !["preview", "server"].includes(input.mode)) invalid("Explicit test execution mode required");
  if (command === "tests.cancel" && !wireId(input.requestId)) invalid("Exact test request identity required");
  if (command === "openInEditor") validateHistoireTarget(input);
  if (command.startsWith("subscriptions.")) {
    if (!wireId(input.subscriptionId)) invalid("Expected subscription identity");
    if (command === "subscriptions.add" && (!Array.isArray(input.streams) || input.streams.some((stream) => !HISTOIRE_BRIDGE_EVENTS.includes(stream)))) invalid("Invalid subscription stream");
  }
  if (command === "channel.post") validateHostChannelPayload(input);
  if (command === "plugin.post") validatePluginChannelPayload(input);
  if (command === "view.sync") validateHistoireSnapshot(value2, measured);
  if (command === "controls.configure" && typeof input.customOnly !== "boolean") invalid("Controls presentation must be boolean");
  if (command === "controls.preset") {
    if (!["list", "save", "apply", "delete", "rename"].includes(input.action)) invalid("Invalid preset action");
    const id = ["apply", "delete", "rename"].includes(input.action);
    const label = ["save", "rename"].includes(input.action);
    if (id ? !wireId(input.id) : input.id !== void 0) invalid("Invalid preset identity");
    if (label ? typeof input.label !== "string" || !input.label.trim() || input.label.length > 120 : input.label !== void 0) invalid("Invalid preset label");
  }
}

// packages/histoire-protocol/src/bridge/envelope.ts
var runtimeCommands = ["state.get", "state.patch", "state.reset", "tests.collect", "controls.preset", "channel.post", "plugin.post"];
function validateRole(role, command, payload, direction) {
  if (command === "controls.configure") {
    if (role !== "controls" || direction !== "parent-to-child") invalid("Controls presentation requires parent controls port");
    return;
  }
  if (command === "controls.preset") {
    if (direction === "parent-to-child" ? role !== "primary" : !["primary", "controls"].includes(role)) invalid("Preset action requires primary runtime or controls intent");
    return;
  }
  if (command === "view.sync") {
    if (direction !== "parent-to-child") invalid("View sync is parent-to-view only");
    if (role === "data") invalid("View sync requires surface port");
    return;
  }
  if (direction === "child-to-parent" && role !== "data") {
    if (role === "controls" && !["state.patch", "state.reset", "subscriptions.add", "subscriptions.remove"].includes(command)) invalid("Controls port command unavailable");
    return;
  }
  if (role === "data" && (runtimeCommands.includes(command) || command === "source.get" && payload.mode === "dynamic" || command === "tests.run" && payload.mode === "preview")) invalid("Data port cannot execute runtime commands");
  if (role === "view") invalid("View port cannot execute runtime commands");
  if (role === "controls" && !["state.patch", "subscriptions.add", "subscriptions.remove", "view.sync"].includes(command)) invalid("Controls port command unavailable");
}
function validateBridgeEnvelope(value2, owner, role, responseCommand, direction = "parent-to-child", metadataOnly = false) {
  const input = validateBridgeEnvelopeMetadata(value2, owner, direction);
  return metadataOnly ? input : validateBridgeEnvelopeBody(input, role, responseCommand, direction);
}
function validateBridgeEnvelopeMetadata(value2, owner, direction) {
  const input = wireRecord(value2);
  const keys2 = ["protocolVersion", "sessionId", "connectionId", "mountId", "sourceId", "epoch", "revision"];
  const allowed = [...keys2, "runtimeId", "target", "selectionVersion", "kind", ...input.kind === "request" ? ["requestId", "command", "payload", "selectionRequestId"] : input.kind === "response" ? ["requestId", "ok", "result", "error"] : ["event", "sequence", "payload"]];
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid("Unknown bridge envelope field");
  const publication = input.kind === "event" && ["catalog.changed", "content.changed"].includes(input.event);
  const metadata = {};
  for (const key of keys2) {
    metadata[key] = input[key];
    if (key === "protocolVersion" ? !Number.isSafeInteger(input[key]) || input[key] < 1 || input[key] !== owner[key] : !wireId(input[key]) || !(key === "revision" && publication) && input[key] !== owner[key]) invalid("Mismatched bridge owner/version");
  }
  if (input.runtimeId !== void 0) {
    if (!wireId(input.runtimeId) || owner.runtimeId !== void 0 && input.runtimeId !== owner.runtimeId) invalid("Mismatched runtime owner");
    metadata.runtimeId = input.runtimeId;
  } else if (owner.runtimeId !== void 0) {
    invalid("Missing runtime owner");
  }
  if (input.target !== void 0) {
    validateHistoireTarget(input.target);
    metadata.target = input.target;
    const target = input.target;
    if (owner.target && (target.storyId !== owner.target.storyId || target.variantId !== owner.target.variantId)) invalid("Mismatched runtime target");
  } else if (owner.target !== void 0) {
    invalid("Missing runtime target");
  }
  if (input.selectionVersion !== void 0) {
    if (!Number.isSafeInteger(input.selectionVersion) || input.selectionVersion < 0) invalid("Invalid selection generation");
    metadata.selectionVersion = input.selectionVersion;
    if (input.kind !== "event" && owner.selectionVersion !== void 0 && input.selectionVersion !== owner.selectionVersion) invalid("Mismatched selection generation");
  } else if (input.kind === "request" && input.command === "selection.select" && direction === "child-to-parent" && owner.selectionVersion !== void 0) {
    invalid("Missing selection generation");
  }
  metadata.kind = input.kind;
  if (input.kind === "request") {
    if (!wireId(input.requestId) || !HISTOIRE_BRIDGE_COMMANDS.includes(input.command)) invalid("Invalid bridge request");
    metadata.requestId = input.requestId;
    metadata.command = input.command;
    if (input.selectionRequestId !== void 0) {
      if (!wireId(input.selectionRequestId) || input.command !== "view.sync" || direction !== "parent-to-child") invalid("Selection acknowledgment requires parent view sync");
      metadata.selectionRequestId = input.selectionRequestId;
    }
  } else if (input.kind === "response") {
    if (!wireId(input.requestId) || typeof input.ok !== "boolean") invalid("Invalid bridge response");
    metadata.requestId = input.requestId;
    metadata.ok = input.ok;
  } else if (input.kind === "event") {
    if (!HISTOIRE_BRIDGE_EVENTS.includes(input.event) || !Number.isSafeInteger(input.sequence) || input.sequence < 0) invalid("Invalid bridge event");
    metadata.event = input.event;
    metadata.sequence = input.sequence;
  } else {
    invalid("Unknown bridge envelope kind");
  }
  validateWireValue(metadata, { kind: "metadata", name: "" });
  return input;
}
function validateBridgeEnvelopeBody(value2, role, responseCommand, direction = "parent-to-child") {
  const input = wireRecord(value2);
  if (input.kind === "request") {
    const command = input.command;
    validateWireValue(input.payload, { kind: "request", name: command });
    validateBridgePayload(command, input.payload, true);
    validateRole(role, command, wireRecord(input.payload), direction);
  } else if (input.kind === "response") {
    if (input.ok) {
      if (!responseCommand) invalid("Successful response requires captured command");
      validateBridgeResult(responseCommand, input.result);
    } else {
      validateHistoireErrorData(input.error);
    }
  } else {
    validateBridgeEventBody(input, role, direction);
  }
  return input;
}
function validateBridgeEventBody(input, role, direction) {
  const event = input.event;
  validateWireValue(input.payload, { kind: "event", name: event });
  validateBridgeEventPayload(event, input.payload, true);
  if (event === "channel.message" || event === "plugin.message") {
    const payload = wireRecord(input.payload);
    const target = wireRecord(payload.target);
    if (role !== "primary" || direction !== "child-to-parent" || !wireId(input.runtimeId) || payload.runtimeId !== input.runtimeId || !input.target || target.storyId !== wireRecord(input.target).storyId) {
      invalid("Application channel event requires exact primary document and story");
    }
  }
  if (event === "focus.changed" && role === "primary") {
    if (direction !== "child-to-parent" || wireRecord(input.payload).direction !== void 0) invalid("Primary focus must come from owned document");
  } else if (event.startsWith("overlay.") || event === "controls.height" || event === "focus.changed") {
    if (role !== "controls") invalid("Controls event requires controls port");
    if (event === "overlay.result" !== (direction === "parent-to-child")) invalid("Controls event direction unavailable");
  }
  if (event === "catalog.changed") {
    const descriptor = wireRecord(wireRecord(input.payload).descriptor);
    for (const key of ["sourceId", "epoch", "revision"]) {
      if (descriptor[key] !== input[key]) invalid("Catalog publication identity mismatch");
    }
  }
}

// packages/histoire-protocol/src/bridge/handshake.ts
function validateHistoireProtocolRange(value2) {
  const input = wireRecord(value2);
  if (Object.keys(input).some((key) => !["min", "max"].includes(key)) || !Number.isSafeInteger(input.min) || !Number.isSafeInteger(input.max) || input.min < 1 || input.max < input.min) invalid("Invalid protocol range");
  return input;
}
function negotiateHistoireProtocol(host, book) {
  validateHistoireProtocolRange(host);
  validateHistoireProtocolRange(book);
  const version = Math.min(host.max, book.max);
  if (version < Math.max(host.min, book.min)) throw new HistoireSdkError("PROTOCOL_MISMATCH", `Host protocol ${host.min}\u2013${host.max}; book protocol ${book.min}\u2013${book.max}`);
  return version;
}
function validateHistoireHello(value2) {
  validateWireValue(value2, { kind: "metadata", name: "" });
  const input = wireRecord(value2);
  if (Object.keys(input).some((key) => !["kind", "protocolRange", "nonce", "sessionId", "mountId", "parentOrigin", "role"].includes(key)) || input.kind !== "histoire:hello" || !["data", "primary", "controls", "view"].includes(input.role)) invalid("Invalid handshake hello");
  for (const key of ["nonce", "sessionId", "mountId"]) {
    if (!wireId(input[key])) invalid("Invalid handshake identity");
  }
  validateHistoireProtocolRange(input.protocolRange);
  validateEmbedOrigin(input.parentOrigin);
  return input;
}
function validateHistoireAck(value2, hello) {
  const input = wireRecord(value2);
  if (Object.keys(input).some((key) => !["kind", "nonce", "protocolRange", "ok", "owner", "descriptor", "error"].includes(key)) || input.kind !== "histoire:ack" || input.nonce !== hello.nonce || typeof input.ok !== "boolean") invalid("Invalid handshake acknowledgment");
  const range = validateHistoireProtocolRange(input.protocolRange);
  if (!input.ok) {
    validateHistoireErrorData(input.error);
  } else {
    const owner = wireRecord(input.owner);
    const version = negotiateHistoireProtocol(hello.protocolRange, range);
    if (owner.protocolVersion !== version || owner.sessionId !== hello.sessionId || owner.mountId !== hello.mountId) invalid("Mismatched handshake owner/version");
    for (const key of ["connectionId", "sourceId", "epoch", "revision"]) {
      if (!wireId(owner[key])) invalid("Invalid handshake owner");
    }
    if (owner.selectionVersion !== void 0 && (!Number.isSafeInteger(owner.selectionVersion) || owner.selectionVersion < 0)) invalid("Invalid handshake selection generation");
    if (Object.keys(owner).some((key) => !["protocolVersion", "sessionId", "mountId", "connectionId", "sourceId", "epoch", "revision", "selectionVersion"].includes(key))) invalid("Unknown handshake owner field");
    const descriptor = validateHistoireSourceDescriptor(input.descriptor);
    for (const key of ["sourceId", "epoch", "revision"]) {
      if (owner[key] !== descriptor[key]) invalid("Mismatched handshake descriptor");
    }
    if (descriptor.protocolVersion !== version) invalid("Mismatched descriptor protocol");
  }
  validateWireValue({ kind: input.kind, nonce: input.nonce, protocolRange: input.protocolRange, ok: input.ok, ...input.ok ? { owner: input.owner } : { error: input.error } }, { kind: "metadata", name: "" });
  return input;
}

// packages/histoire-protocol/src/types/common.ts
var HISTOIRE_SURFACES = ["explorer", "preview", "tree", "search", "toolbar", "controls", "docs", "source", "events", "tests"];
function getHistoireTargetKey(target) {
  return JSON.stringify([target.storyId, target.variantId]);
}

// packages/histoire-protocol/src/bridge/project-test-collection.ts
function validateProjectTestCollection(value2, targets) {
  validateWireValue(value2, { kind: "response", name: "tests.collect" });
  const input = wireRecord(value2);
  validateHistoireTestExecution(input.execution);
  if (input.execution.mode !== "server") invalid("Invalid project collection engine");
  if (!Array.isArray(input.variants)) invalid("Invalid project test collection");
  const seen = /* @__PURE__ */ new Set();
  for (const item of input.variants) {
    const entry = wireRecord(item);
    validateHistoireTarget(entry.target);
    const target = entry.target;
    if (target.variantId === null) invalid("Project collection requires variant identity");
    const key = getHistoireTargetKey(target);
    if (seen.has(key)) invalid("Duplicate project collection target");
    seen.add(key);
    validateHistoireTestResult(entry.collection, false);
  }
  if (targets) {
    const admitted = new Set(targets.map(getHistoireTargetKey));
    if (seen.size !== admitted.size || [...seen].some((key) => !admitted.has(key))) invalid("Test discovery target inventory changed");
  }
}

// packages/histoire-protocol/src/geometry.ts
function intersectRuntimeRects(left, right) {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const width = Math.min(left.x + left.width, right.x + right.width) - x;
  const height = Math.min(left.y + left.height, right.y + right.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}
function mapRuntimeViewport(viewport, frame, logical, clip) {
  const scaleX = frame.width / logical.width;
  const scaleY = frame.height / logical.height;
  function map(rect) {
    return { x: frame.x + rect.x * scaleX, y: frame.y + rect.y * scaleY, width: rect.width * scaleX, height: rect.height * scaleY };
  }
  const visibleRect = intersectRuntimeRects(map(viewport.visibleRect), clip);
  return visibleRect ? { ...map(viewport), target: viewport.target, scale: viewport.scale * scaleX, visibleRect } : null;
}

// packages/histoire-protocol/src/helpers/story-route.ts
function resolveStoryRouteId(params, query) {
  if (typeof params.storyId === "string" && params.storyId) return params.storyId;
  return typeof query.storyId === "string" && /^\.+$/.test(query.storyId) ? query.storyId : void 0;
}
function parseStoryRouteQuery(search) {
  const query = /* @__PURE__ */ Object.create(null);
  for (const pair of search.replace(/^\?/, "").split("&")) {
    if (!pair) continue;
    new URLSearchParams(pair).forEach((decoded, key) => {
      const value2 = pair.includes("=") ? decoded : null;
      const previous = query[key];
      if (previous === void 0) query[key] = value2;
      else if (previous === null) query[key] = [null, value2];
      else if (typeof previous === "string") query[key] = [previous, value2];
      else query[key] = [...previous, value2];
    });
  }
  return query;
}
function resolveStoryRouteSelection(params, query) {
  const storyId = resolveStoryRouteId(params, query);
  if (!storyId) return;
  const variantId = query.variantId;
  if (variantId === null) return { storyId, variantId: null };
  return { storyId, ...typeof variantId === "string" ? { variantId } : {} };
}
function isStoryRouteHash(hash) {
  return /^#\/story(?:[/?]|$)/.test(hash);
}
var STORY_ROUTE_PATH = "/story/:storyId?";

// packages/histoire-protocol/src/serialization/controls-revision.ts
function createControlsStateRevision() {
  let revision = 0;
  function valid(value2) {
    return typeof value2 === "number" && Number.isSafeInteger(value2) && value2 >= 0;
  }
  return {
    /** Last captured local edit or admitted child edit for this document only. */
    get current() {
      return revision;
    },
    /** Stamp edit before asynchronous postMessage can cross wrapper boundary. */
    capture() {
      if (revision === Number.MAX_SAFE_INTEGER) throw new HistoireSdkError("INVALID_ARGUMENT", "Controls revision exhausted");
      return ++revision;
    },
    /** Admit each child edit once, rejecting replay and malformed counters. */
    receive(value2) {
      if (value2 === void 0) return true;
      if (!valid(value2) || value2 <= revision) return false;
      revision = value2;
      return true;
    },
    /** New typing already captured locally makes older acknowledgment inapplicable. */
    accept(value2) {
      return value2 === void 0 || valid(value2) && value2 === revision;
    }
  };
}

// packages/histoire-protocol/src/serialization/state.ts
function isContainer(value2) {
  return value2 !== null && typeof value2 === "object";
}
function applySerializedState(target, source, reset = false) {
  const seen = /* @__PURE__ */ new WeakMap();
  let changed = false;
  function hasHiddenOwner(value2) {
    return Reflect.ownKeys(value2).some((key) => typeof key === "symbol" || key !== "length" && !Object.getOwnPropertyDescriptor(value2, key)?.enumerable);
  }
  function hasOpaque(value2, visited = /* @__PURE__ */ new WeakSet()) {
    if (typeof value2 === "function" || typeof value2 === "symbol") return true;
    if (!isContainer(value2) || visited.has(value2)) return false;
    visited.add(value2);
    const prototype = Object.getPrototypeOf(value2);
    if (!Array.isArray(value2) && prototype !== Object.prototype && prototype !== null) return true;
    if (hasHiddenOwner(value2)) return true;
    return Object.values(value2).some((child) => hasOpaque(child, visited));
  }
  function retainOpaque(container, key, visited = /* @__PURE__ */ new WeakSet()) {
    const value2 = container[key];
    if (typeof value2 === "function" || typeof value2 === "symbol") return true;
    if (isContainer(value2)) {
      const prototype = Object.getPrototypeOf(value2);
      if (!Array.isArray(value2) && prototype !== Object.prototype && prototype !== null) return true;
      if (visited.has(value2)) return hasOpaque(value2);
      visited.add(value2);
      let retained = hasHiddenOwner(value2);
      for (const child of Object.keys(value2).reverse()) {
        if (retainOpaque(value2, child, visited)) {
          retained = true;
        } else {
          try {
            if (Array.isArray(value2) && /^\d+$/.test(child)) value2.splice(Number(child), 1);
            else delete value2[child];
            changed = true;
          } catch {
            retained = true;
          }
        }
      }
      return retained;
    }
    return false;
  }
  function assign(container, key, value2) {
    if (Object.is(container[key], value2)) return;
    try {
      container[key] = value2;
      changed = true;
    } catch {
    }
  }
  function mergeField(container, key, value2, replaceMissing) {
    const current = container[key];
    if (typeof current === "function" || typeof current === "symbol") return;
    const prototype = isContainer(current) ? Object.getPrototypeOf(current) : void 0;
    const ownsInstance = isContainer(current) && !Array.isArray(current) && prototype !== Object.prototype && prototype !== null;
    if (ownsInstance && (!isContainer(value2) || Array.isArray(value2) || seen.has(value2))) return;
    if (!isContainer(value2)) {
      assign(container, key, value2);
      return;
    }
    if (seen.has(value2)) {
      assign(container, key, seen.get(value2));
      return;
    }
    const compatible = isContainer(current) && Array.isArray(current) === Array.isArray(value2);
    const next = compatible ? current : Array.isArray(value2) ? [] : {};
    merge(next, value2, replaceMissing);
    if (!compatible) assign(container, key, next);
  }
  function merge(current, incoming, replaceMissing = false) {
    seen.set(incoming, current);
    if (Array.isArray(current) && Array.isArray(incoming)) {
      const positions = current.flatMap((value2, index) => typeof value2 === "function" ? [] : [index]);
      for (let index = 0; index < incoming.length; index++) {
        mergeField(current, positions[index] ?? current.length, incoming[index], true);
      }
      for (const index of positions.slice(incoming.length).reverse()) {
        if (reset && retainOpaque(current, index)) continue;
        current.splice(index, 1);
        changed = true;
      }
      return;
    }
    for (const key of Object.keys(incoming)) {
      if (reset && key === "_hPropDefs") continue;
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      mergeField(current, key, incoming[key], replaceMissing || key.startsWith("_h"));
    }
    if (replaceMissing) {
      for (const key of Object.keys(current)) {
        if (Object.hasOwn(incoming, key) || typeof current[key] === "function" || reset && (key === "_hPropDefs" || retainOpaque(current, key))) continue;
        try {
          if (delete current[key]) changed = true;
        } catch {
        }
      }
    }
  }
  if (isContainer(target) && isContainer(source)) merge(target, source, reset);
  return changed;
}

// packages/histoire-protocol/src/serialization/test-errors.ts
function hasProperty(value2, key) {
  return !!value2 && typeof value2 === "object" && key in value2;
}
function toSerializableRaw(value2) {
  if (value2 === void 0) return void 0;
  try {
    return JSON.parse(JSON.stringify(value2));
  } catch {
    try {
      return String(value2);
    } catch {
      return void 0;
    }
  }
}
function serializeTestError(error) {
  if (error instanceof Error) {
    const payload = error;
    const raw = toSerializableRaw(payload.cause);
    return {
      name: payload.name || "Error",
      message: payload.message || error.toString(),
      ...payload.stack === void 0 ? {} : { stack: payload.stack },
      ...typeof payload.diff === "string" ? { diff: payload.diff } : {},
      ...raw === void 0 ? {} : { raw }
    };
  }
  if (error === null || error === void 0) {
    return {
      message: "Unknown error"
    };
  }
  if (typeof error === "string") {
    return {
      message: error
    };
  }
  if (hasProperty(error, "message")) {
    const rawMessage = String(hasProperty(error, "message") ? error.message : "");
    const name = hasProperty(error, "name") ? String(error.name) : void 0;
    const stack = hasProperty(error, "stack") ? String(error.stack ?? "") || void 0 : void 0;
    const diff = hasProperty(error, "diff") ? String(error.diff ?? "") || void 0 : void 0;
    const raw = toSerializableRaw(error.raw);
    return {
      message: rawMessage || "Unknown error",
      ...name === void 0 ? {} : { name },
      ...stack === void 0 ? {} : { stack },
      ...diff === void 0 ? {} : { diff },
      ...raw === void 0 ? {} : { raw }
    };
  }
  return {
    message: String(error)
  };
}
function serializeTestErrors(errors) {
  return errors.map(serializeTestError);
}
var ANSI_PATTERN = /\u001B\[\d*(?:;\d+)*m/g;
function stripAnsi(value2) {
  return value2.replace(ANSI_PATTERN, "");
}
function formatTestError(error) {
  if (typeof error === "string") {
    return stripAnsi(error);
  }
  return [error.message, error.stack, error.diff].filter(Boolean).map((part) => stripAnsi(String(part))).join("\n\n");
}

// packages/histoire-protocol/src/theme/color.ts
var value = "[+-]?(?:\\d+|\\d*\\.\\d+)%?";
var separator = "(?:\\s*,\\s*|\\s+)";
var alpha = `(?:\\s*[,/]\\s*(${value}))?`;
var rgb = new RegExp(`^rgba?\\(\\s*(${value})${separator}(${value})${separator}(${value})${alpha}\\s*\\)$`, "i");
var hue = "[+-]?(?:\\d+|\\d*\\.\\d+)(?:deg|rad|grad|turn)?";
var hsl = new RegExp(`^hsla?\\(\\s*(${hue})${separator}(${value})${separator}(${value})${alpha}\\s*\\)$`, "i");
function parseColor(input) {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (text.toLowerCase() === "transparent") return { mode: "rgb", color: ["0", "0", "0"], alpha: "0" };
  const expanded = /^#[a-f\d]{3,4}$/i.test(text) ? `#${[...text.slice(1)].map((value2) => value2 + value2).join("")}` : text;
  const hex = expanded.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i);
  if (hex) return { mode: "rgb", color: hex.slice(1, 4).map((part) => Number.parseInt(part, 16).toString()), alpha: hex[4] ? (Number.parseInt(hex[4], 16) / 255).toString() : void 0 };
  const matched = text.match(rgb) ?? text.match(hsl);
  if (!matched) return null;
  return { mode: /^rgb/i.test(text) ? "rgb" : "hsl", color: matched.slice(1, 4), alpha: matched[4] };
}
function getHistoireColorChannels(parsed) {
  const opacity = parsed.alpha === void 0 ? 1 : Number.parseFloat(parsed.alpha) / (parsed.alpha.endsWith("%") ? 100 : 1);
  let channels;
  if (parsed.mode === "rgb") {
    channels = parsed.color.map((value2) => Number.parseFloat(value2) * (value2.endsWith("%") ? 2.55 : 1));
  } else {
    const hue2 = parsed.color[0];
    const unit = hue2.match(/(?:deg|rad|grad|turn)$/i)?.[0].toLowerCase();
    const degrees = Number.parseFloat(hue2) * (unit === "rad" ? 180 / Math.PI : unit === "grad" ? 0.9 : unit === "turn" ? 360 : 1);
    const normalizedHue = (degrees % 360 + 360) % 360 / 60;
    const saturation = Math.max(0, Math.min(1, Number.parseFloat(parsed.color[1]) / 100));
    const lightness = Math.max(0, Math.min(1, Number.parseFloat(parsed.color[2]) / 100));
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const secondary = chroma * (1 - Math.abs(normalizedHue % 2 - 1));
    const offset = lightness - chroma / 2;
    const sectors = [[chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary], [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]];
    channels = sectors[Math.floor(normalizedHue)].map((value2) => (value2 + offset) * 255);
  }
  return { channels: channels.map((value2) => String(Math.round(Math.max(0, Math.min(255, value2)) * 1e3) / 1e3)).join(" "), alpha: String(Math.max(0, Math.min(1, opacity))) };
}

// packages/histoire-protocol/src/theme/semantic.ts
var histoireDefaultNeutralColors = {
  50: "#fafafa",
  100: "#f4f4f5",
  200: "#e4e4e7",
  300: "#d4d4d8",
  400: "#a1a1aa",
  500: "#71717a",
  600: "#52525b",
  700: "#3f3f46",
  750: "#323238",
  800: "#27272a",
  850: "#1f1f21",
  900: "#18181b",
  950: "#101012"
};
var histoireDefaultAccentColors = {
  50: "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  300: "#6ee7b7",
  400: "#34d399",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
  900: "#064e3b"
};
var lightShades = {
  primary: { "accent": "500", "accent-soft": "50", "accent-text": "800", "accent-link": "700" },
  gray: { canvas: "100", home: "50", surface: "50", border: "200", chip: "100", input: "50", text: "900", body: "700", muted: "500" }
};
var darkShades = {
  primary: { "accent": "400", "accent-soft": "400", "accent-link": "400" },
  gray: { canvas: "950", home: "950", surface: "900", border: "800", chip: "850", input: "950", text: "200", body: "300", muted: "400" }
};
function getHistoireSemanticThemeOverrides(colors = {}, dark = false) {
  const variables = {};
  const shades = dark ? darkShades : lightShades;
  for (const color of ["primary", "gray"]) {
    const defaults = color === "primary" ? histoireDefaultAccentColors : histoireDefaultNeutralColors;
    for (const [semantic, shade] of Object.entries(shades[color])) {
      const input = colors[color]?.[shade];
      if (!input || !parseColor(input) || input === defaults[shade]) continue;
      variables[`--histoire-${semantic}-rgb`] = `var(--_histoire-color-${color}-${shade})`;
      if (semantic !== "accent-soft" || !dark) variables[`--histoire-${semantic}-alpha`] = `var(--_histoire-color-${color}-${shade}-alpha, 1)`;
    }
  }
  return variables;
}

// packages/histoire-protocol/src/types/catalog.ts
function isHistoireProjectFileOrigin(origin) {
  return origin === void 0 || origin === "project";
}

// packages/histoire-protocol/src/types/controls.ts
var CONTROLS_APPEARANCE = "__histoire:controls-appearance";
var CONTROLS_OVERLAY = "__histoire:controls-overlay";
var CONTROLS_OVERLAY_RESULT = "__histoire:controls-overlay-result";
var CONTROLS_OVERLAY_REFRESH = "__histoire:controls-overlay-refresh";
var CONTROLS_FOCUS = "__histoire:controls-focus";

// packages/histoire-protocol/src/types/embed-presentation.ts
var HISTOIRE_EMBED_PANELS = ["controls", "docs", "source", "events"];

// packages/histoire-protocol/src/types/preview-message.ts
var STATE_SYNC = "__histoire:state-sync";
var SANDBOX_READY = "__histoire:sandbox-ready";
var EVENT_SEND = "__histoire:event";
var PREVIEW_SETTINGS_SYNC = "__histoire:preview-settings-sync";
var VARIANT_READY = "__histoire:variant-ready";
var PREVIEW_SYNC = "__histoire:preview-sync";
var CONTROLS_READY = "__histoire:controls-ready";
var CONTROLS_RESIZE = "__histoire:controls-resize";
var COLLECT_TESTS = "__histoire:collect-tests";
var RUN_TESTS = "__histoire:run-tests";
var RUN_TEST_CASE = "__histoire:run-test-case";
var TEST_DEFINITIONS = "__histoire:test-definitions";
var TEST_RESULT = "__histoire:test-result";
var TEST_CASE_RESULT = "__histoire:test-case-result";
var RUNTIME_REQUEST = "__histoire:runtime-request";
var RUNTIME_RESULT = "__histoire:runtime-result";
var RUNTIME_FAILED = "__histoire:runtime-failed";
var RUNTIME_LAYOUT = "__histoire:runtime-layout";
var RUNTIME_FOCUS = "__histoire:runtime-focus";
var HOST_CHANNEL_MESSAGE = "__histoire:host-channel";

// packages/histoire-protocol/src/types/settings.ts
function createDefaultHistoireSettings() {
  return { responsiveWidth: 720, responsiveHeight: null, rotate: false, backgroundColor: "transparent", checkerboard: false, checkerboardTheme: "light", textDirection: "ltr", colorScheme: "auto", globals: {} };
}

// packages/histoire-protocol/src/url/preview.ts
function normalizePreviewBase(value2) {
  const base = value2.endsWith("/") ? value2 : `${value2}/`;
  const segments = base.split("/").map((segment) => segment.replace(/%2e/gi, "."));
  if (!base.startsWith("/") || base.startsWith("//") || /[?#\\\0]/.test(base) || !base.isWellFormed() || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Preview base must be a same-origin absolute path");
  }
  return base;
}
function getSandboxRelativeUrl(options) {
  const query = new URLSearchParams({ storyId: options.storyId, variantId: options.variantId });
  const base = normalizePreviewBase(options.base);
  return `${base}__sandbox.html?${query}`;
}

// packages/histoire-protocol/src/url/embed.ts
function invalid2(message) {
  throw new HistoireSdkError("INVALID_ARGUMENT", message);
}
function validateEmbedPanels(value2 = ["controls"]) {
  if (!Array.isArray(value2) || value2.some((panel) => !HISTOIRE_EMBED_PANELS.includes(panel))) invalid2("Unsupported embed panel");
  return HISTOIRE_EMBED_PANELS.filter((panel) => value2.includes(panel));
}
function validateEmbedPresentation(value2) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) invalid2("Expected embed presentation");
  const input = value2;
  if (input.type !== "embed" || !["story", "variant"].includes(input.scope)) invalid2("Unsupported embed presentation");
  return { type: "embed", scope: input.scope, panels: validateEmbedPanels(input.panels) };
}
function hint(query, key) {
  const values = query.getAll(key);
  if (values.length > 1) invalid2(`Repeated embed ${key}`);
  return values[0];
}
function panels(query) {
  const value2 = hint(query, "panels");
  return validateEmbedPanels(value2 === void 0 ? void 0 : value2 === "" ? [] : value2.split(","));
}
function parseEmbedPresentation(query) {
  const type = hint(query, "presentation");
  if (type === void 0) return;
  return validateEmbedPresentation({ type, scope: hint(query, "scope"), panels: panels(query) });
}
function writeEmbedPresentation(query, input) {
  const value2 = validateEmbedPresentation(input);
  query.set("presentation", value2.type);
  query.set("scope", value2.scope);
  query.set("panels", value2.panels.join(","));
}
function parseEmbedDocumentOptions(query) {
  const storyId = targetId(hint(query, "storyId"));
  const variantId = hint(query, "variantId");
  return { storyId, ...variantId === void 0 ? {} : { variantId: targetId(variantId) }, panels: panels(query) };
}
function targetId(value2) {
  if (typeof value2 !== "string" || !value2 || !value2.isWellFormed()) invalid2("Expected exact embed story and variant IDs");
  return value2;
}
function getEmbedRelativeUrl(options) {
  const query = new URLSearchParams({ view: "embed", storyId: targetId(options.storyId) });
  if (options.variantId !== void 0) query.set("variantId", targetId(options.variantId));
  query.set("panels", validateEmbedPanels(options.panels).join(","));
  parseEmbedDocumentOptions(query);
  return `${normalizePreviewBase(options.base)}__embed.html?${query}`;
}
export {
  COLLECT_TESTS,
  CONTROLS_APPEARANCE,
  CONTROLS_FOCUS,
  CONTROLS_OVERLAY,
  CONTROLS_OVERLAY_REFRESH,
  CONTROLS_OVERLAY_RESULT,
  CONTROLS_READY,
  CONTROLS_RESIZE,
  EVENT_SEND,
  HISTOIRE_BRIDGE_COMMANDS,
  HISTOIRE_BRIDGE_EVENTS,
  HISTOIRE_DESCRIPTOR_VERSION,
  HISTOIRE_EMBED_PANELS,
  HISTOIRE_ERROR_CODES,
  HISTOIRE_MATRIX_NUMERIC_VALUES,
  HISTOIRE_PLUGIN_CHANNEL_MAX_BYTES,
  HISTOIRE_PLUGIN_ID_PATTERN,
  HISTOIRE_PLUGIN_NOTICES,
  HISTOIRE_PLUGIN_NOTICE_PREFIX,
  HISTOIRE_PROTOCOL_VERSION,
  HISTOIRE_SURFACES,
  HISTOIRE_WIRE_LIMITS,
  HOST_CHANNEL_MESSAGE,
  HistoireSdkError,
  PREVIEW_SETTINGS_SYNC,
  PREVIEW_SYNC,
  RUNTIME_FAILED,
  RUNTIME_FOCUS,
  RUNTIME_LAYOUT,
  RUNTIME_REQUEST,
  RUNTIME_RESULT,
  RUN_TESTS,
  RUN_TEST_CASE,
  SANDBOX_READY,
  STATE_SYNC,
  STORY_ROUTE_PATH,
  TEST_CASE_RESULT,
  TEST_DEFINITIONS,
  TEST_RESULT,
  VARIANT_READY,
  applySerializedState,
  createControlsStateRevision,
  createDefaultHistoireSettings,
  createEmbedFrameAncestors,
  createHostChannelRateLimiter,
  createPluginChannelLimiters,
  formatTestError,
  getEmbedRelativeUrl,
  getHistoireColorChannels,
  getHistoireFiniteMatrixValues,
  getHistoireMatrixRange,
  getHistoireMatrixRangeValues,
  getHistoireMatrixValues,
  getHistoireNumericMatrixValues,
  getHistoireSemanticThemeOverrides,
  getHistoireTargetKey,
  getHistoireWireLimit,
  getSandboxRelativeUrl,
  histoireDefaultAccentColors,
  histoireDefaultNeutralColors,
  intersectRuntimeRects,
  isHistoireMatrixPropName,
  isHistoirePluginId,
  isHistoirePluginNotice,
  isHistoireProjectFileOrigin,
  isStoryRouteHash,
  mapRuntimeViewport,
  measureWireValue,
  mergeEmbedFrameAncestors,
  negotiateHistoireProtocol,
  normalizeHistoireMatrixHint,
  normalizePreviewBase,
  parseColor,
  parseEmbedDocumentOptions,
  parseEmbedPresentation,
  parseStoryRouteQuery,
  resolveEmbedOrigins,
  resolveStoryRouteId,
  resolveStoryRouteSelection,
  serializeTestError,
  serializeTestErrors,
  validateBridgeEnvelope,
  validateBridgeEnvelopeBody,
  validateBridgeEventPayload,
  validateBridgePayload,
  validateBridgeResult,
  validateEmbedOrigin,
  validateEmbedOrigins,
  validateEmbedPanels,
  validateEmbedPresentation,
  validateFramePluginInventory,
  validateHistoireAck,
  validateHistoireCapabilities,
  validateHistoireCatalog,
  validateHistoireCatalogStory,
  validateHistoireContent,
  validateHistoireDiagnostics,
  validateHistoireErrorData,
  validateHistoireEvent,
  validateHistoireHello,
  validateHistoireProtocolRange,
  validateHistoireRuntimeSnapshot,
  validateHistoireSnapshot,
  validateHistoireSourceDescriptor,
  validateHistoireStateSnapshot,
  validateHistoireTarget,
  validateHistoireTestExecution,
  validateHistoireTestResult,
  validateHistoireViewports,
  validateHostChannelNames,
  validateHostChannelPayload,
  validatePluginChannelPayload,
  validateProjectTestCollection,
  validateSettingsPatch,
  validateWireValue,
  wireRecord,
  writeEmbedPresentation
};
