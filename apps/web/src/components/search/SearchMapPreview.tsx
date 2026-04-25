import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { MapPin, Loader2 } from "lucide-react";

interface SearchMapPreviewProps {
  location: {
    name: string;
    lat: number;
    lng: number;
  };
}

const SearchMapPreview = ({ location }: SearchMapPreviewProps) => {
  const { invoke } = useEdgeFn();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      try {
        const { data } = await invoke<{ token: string }>({ fn: "mapbox-proxy", body: { action: "token" } });
        if (cancelled || !data?.token || !mapContainer.current) return;

        mapboxgl.accessToken = data.token;

        const map = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [location.lng, location.lat],
          zoom: 14,
          interactive: true,
          attributionControl: false,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        const marker = new mapboxgl.Marker({ color: "hsl(var(--primary))" })
          .setLngLat([location.lng, location.lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${location.name}</strong>`))
          .addTo(map);

        marker.togglePopup();

        map.on("load", () => {
          if (!cancelled) setLoading(false);
        });

        mapRef.current = map;
      } catch (err) {
        console.error("Map init error:", err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
    };
  }, [location.lat, location.lng, location.name]);

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <MapPin className="w-4 h-4" />
        <span>{location.name}</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-foreground/10">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="h-[200px] w-full" />
      <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs text-foreground flex items-center gap-1.5">
        <MapPin className="w-3 h-3 text-primary" />
        {location.name}
      </div>
    </div>
  );
};

export default SearchMapPreview;
