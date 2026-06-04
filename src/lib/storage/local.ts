export function readLocalValue<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalValue<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is non-critical in Nebula-Hub; UI stays functional without it.
  }
}

export function removeLocalValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Non-critical preference cleanup.
  }
}
