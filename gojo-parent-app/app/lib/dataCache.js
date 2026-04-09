import AsyncStorage from "@react-native-async-storage/async-storage";

const memoryCache = new Map();

function now() {
  return Date.now();
}

function asValidRecord(record) {
  if (!record || typeof record !== "object") return null;
  if (typeof record.savedAt !== "number") return null;
  return record;
}

export async function readCachedJsonRecord(key) {
  const mem = asValidRecord(memoryCache.get(key));
  if (mem) return mem;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = asValidRecord(JSON.parse(raw));
    if (!parsed) return null;

    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function readCachedJson(key, maxAgeMs) {
  const record = await readCachedJsonRecord(key);
  if (!record) return null;
  if (now() - record.savedAt > maxAgeMs) return null;
  return record.value;
}

export async function writeCachedJson(key, value) {
  const record = { savedAt: now(), value };
  memoryCache.set(key, record);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(record));
  } catch {
    // noop
  }
}

export function clearMemoryCacheByPrefix(prefix) {
  for (const key of memoryCache.keys()) {
    if (String(key).startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}
