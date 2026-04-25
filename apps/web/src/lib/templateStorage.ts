const DB_NAME = "image_templates_db";
const DB_VERSION = 1;
const STORE_NAME = "templates";
const MAX_TEMPLATES = 30;

export interface SavedTemplate {
  id: string;
  name: string;
  prompt: string;
  style: string;
  imageUrl: string;
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllTemplates(): Promise<SavedTemplate[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as SavedTemplate[]) || [];
        all.sort((a, b) => b.timestamp - a.timestamp);
        resolve(all);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveTemplate(tpl: SavedTemplate): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(tpl);
      tx.oncomplete = async () => {
        // Enforce max limit
        try {
          const all = await getAllTemplates();
          if (all.length > MAX_TEMPLATES) {
            const toDelete = all.slice(MAX_TEMPLATES);
            const delTx = db.transaction(STORE_NAME, "readwrite");
            const delStore = delTx.objectStore(STORE_NAME);
            toDelete.forEach(t => delStore.delete(t.id));
          }
        } catch {}
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    throw e;
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export async function clearTemplates(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/** Migrate templates from localStorage to IndexedDB (one-time) */
export async function migrateFromLocalStorage(): Promise<SavedTemplate[]> {
  try {
    const raw = localStorage.getItem("image_templates");
    if (!raw) return [];
    const templates: SavedTemplate[] = JSON.parse(raw);
    if (!Array.isArray(templates) || templates.length === 0) return [];
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      templates.forEach(t => store.put(t));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    localStorage.removeItem("image_templates");
    return templates;
  } catch {
    return [];
  }
}
