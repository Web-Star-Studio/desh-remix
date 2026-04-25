export interface LabeledEntry {
  label: string;
  value: string;
}

/** Backward compat: convert old string[] to LabeledEntry[] */
export function toLabeledArray(arr: unknown[]): LabeledEntry[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(item =>
    typeof item === "string"
      ? { label: "", value: item }
      : { label: (item as Record<string, string>)?.label || "", value: (item as Record<string, string>)?.value || "" }
  );
}
