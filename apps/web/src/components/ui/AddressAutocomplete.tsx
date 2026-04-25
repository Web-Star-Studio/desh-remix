import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { cn } from "@/lib/utils";

interface AddressResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: AddressResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  proximity?: [number, number];
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Buscar endereço ou local...",
  className,
  disabled,
  proximity,
}: AddressAutocompleteProps) {
  const { invoke } = useEdgeFn();
  const [results, setResults] = useState<AddressResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  const search = useCallback(
    async (query: string) => {
      if (query.trim().length < 3) {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const body: Record<string, string> = { query: query.trim() };
        if (proximity) body.proximity = `${proximity[0]},${proximity[1]}`;
        const { data } = await invoke<{ results: AddressResult[] }>({
          fn: "mapbox-proxy",
          body: { action: "geocode", ...body },
        });
        if (data?.results?.length) {
          setResults(data.results);
          setOpen(true);
        } else {
          setResults([]);
          setOpen(false);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [invoke],
  );

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (result: AddressResult) => {
    onChange(result.address);
    onSelect?.(result);
    setOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        }
        break;
      case "Escape":
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[role='option']");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `address-option-${activeIndex}` : undefined}
          className={cn(
            "bg-foreground/5 rounded-xl px-3 py-2 pl-8 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-primary/50 transition-colors w-full",
            className,
          )}
        />
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MapPin className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {open && results.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-xl border border-border/30 bg-background/95 backdrop-blur-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto"
        >
          {results.map((r, i) => (
            <button
              key={i}
              id={`address-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              type="button"
              onClick={() => handleSelect(r)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors flex items-start gap-2 border-b border-border/10 last:border-0",
                i === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-foreground/5",
              )}
            >
              <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-foreground font-medium truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{r.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
