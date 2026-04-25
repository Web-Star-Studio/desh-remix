import { memo } from "react";
import { MapPin, ExternalLink } from "lucide-react";

interface LocationMessageProps {
  latitude: number;
  longitude: number;
  name?: string;
}

export const LocationMessage = memo(function LocationMessage({ latitude, longitude, name }: LocationMessageProps) {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || "";
  const staticMapUrl = mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ef4444(${longitude},${latitude})/${longitude},${latitude},14/300x200@2x?access_token=${mapboxToken}`
    : null;

  return (
    <div className="rounded-lg overflow-hidden max-w-[280px]">
      {staticMapUrl ? (
        <img src={staticMapUrl} alt="Localização" className="w-full h-[150px] object-cover" />
      ) : (
        <div className="w-full h-[100px] bg-foreground/10 flex items-center justify-center">
          <MapPin className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="p-2 space-y-1">
        {name && <p className="text-xs font-medium">{name}</p>}
        <p className="text-[10px] text-muted-foreground">{latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
        <div className="flex gap-1">
          <a
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            <ExternalLink className="w-2.5 h-2.5" /> Google Maps
          </a>
          <a
            href={`https://waze.com/ul?ll=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            <ExternalLink className="w-2.5 h-2.5" /> Waze
          </a>
        </div>
      </div>
    </div>
  );
});
