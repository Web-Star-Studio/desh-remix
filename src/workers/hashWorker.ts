// Web Worker for computing SHA-256 hash of files off the main thread
self.onmessage = async (e: MessageEvent) => {
  try {
    const file = e.data as File;
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    self.postMessage({ hash: hashHex });
  } catch (err: any) {
    self.postMessage({ error: err.message || "Hash failed" });
  }
};
