import { useState, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Plane, Hotel, Briefcase, Calendar as CalendarIcon, DollarSign,
  GraduationCap, FileText, Users, ArrowRight, Search,
  Minus, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

/* ── Types ── */
export interface StructuredParams {
  _ai_resolved?: boolean;
  departure_id?: string;
  arrival_id?: string;
  outbound_date?: string;
  return_date?: string;
  passengers?: number;
  travel_class?: number;
  type?: number;
  q?: string;
  check_in_date?: string;
  check_out_date?: string;
  adults?: number;
  children?: number;
  sort_by?: number;
  location?: string;
  date_range?: string;
  ltype?: string;
  chips?: string;
  as_ylo?: string;
  as_yhi?: string;
  scisbd?: string;
  as_sdt?: string;
  before_priority_date?: string;
  after_priority_date?: string;
  status?: string;
  window?: string;
  exchange?: string;
  stops?: string;
  currency?: string;
  rating?: string;
  property_type?: string;
  htichips?: string;
  htichips_type?: string;
  country?: string;
  [key: string]: any;
}

interface Props {
  engine: string;
  onSearch: (query: string, params: StructuredParams) => void;
  initialQuery: string;
}

/* ── Date picker helper ── */
function DateField({ label, value, onChange, minDate }: { label: string; value?: Date; onChange: (d: Date | undefined) => void; minDate?: Date }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-9 px-3 text-xs justify-start font-normal gap-1.5 min-w-[130px]", !value && "text-muted-foreground")}>
          <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single" selected={value} onSelect={onChange} initialFocus
          disabled={(d) => minDate ? d < minDate : d < new Date(new Date().setHours(0, 0, 0, 0))}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── Number stepper ── */
function Stepper({ label, value, onChange, min = 0, max = 9 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1.5 border border-input rounded-md px-2 h-9">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" disabled={value <= min}>
        <Minus className="w-3 h-3" />
      </button>
      <span className="text-xs font-medium w-4 text-center">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" disabled={value >= max}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ── Chip selector ── */
function ChipSelect({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value === value ? "" : o.value)} className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border", o.value === value ? "bg-primary/15 text-primary border-primary/30" : "bg-transparent text-muted-foreground border-input hover:bg-accent")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Flights form ── */
function FlightsForm({ onSearch, initialQuery }: { onSearch: Props["onSearch"]; initialQuery: string }) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [outDate, setOutDate] = useState<Date>();
  const [retDate, setRetDate] = useState<Date>();
  const [pax, setPax] = useState(1);
  const [children, setChildren] = useState(0);
  const [travelClass, setTravelClass] = useState("1");
  const [stops, setStops] = useState("");
  const [tripType, setTripType] = useState("1");
  const [sortBy, setSortBy] = useState("");
  const [currency, setCurrency] = useState("BRL");

  const tripOptions = [
    { label: "Ida e volta", value: "1" },
    { label: "Só ida", value: "2" },
  ];
  const classOptions = [
    { label: "Econômica", value: "1" },
    { label: "Premium", value: "2" },
    { label: "Executiva", value: "3" },
    { label: "Primeira", value: "4" },
  ];
  const stopsOptions = [
    { label: "Qualquer", value: "" },
    { label: "Direto", value: "1" },
    { label: "1 parada", value: "2" },
    { label: "2+", value: "3" },
  ];
  const sortOptions = [
    { label: "Melhores", value: "" },
    { label: "Preço", value: "2" },
    { label: "Duração", value: "5" },
  ];
  const currencyOptions = [
    { label: "BRL", value: "BRL" },
    { label: "USD", value: "USD" },
    { label: "EUR", value: "EUR" },
  ];

  const submit = () => {
    const q = initialQuery || `${origin} ${dest}`.trim();
    const params: StructuredParams = { _ai_resolved: true };
    if (origin) params.departure_id = origin.toUpperCase();
    if (dest) params.arrival_id = dest.toUpperCase();
    if (outDate) params.outbound_date = format(outDate, "yyyy-MM-dd");
    params.type = Number(tripType);
    if (tripType === "1" && retDate) params.return_date = format(retDate, "yyyy-MM-dd");
    if (pax > 1) params.passengers = pax;
    if (children > 0) params.children = children;
    params.travel_class = Number(travelClass);
    if (stops) params.stops = stops;
    if (sortBy) params.sort_by = Number(sortBy);
    params.currency = currency;
    onSearch(q, params);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <Input placeholder="Origem (ex: GRU)" value={origin} onChange={e => setOrigin(e.target.value)} className="h-9 w-28 text-xs uppercase" maxLength={5} />
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input placeholder="Destino (ex: GIG)" value={dest} onChange={e => setDest(e.target.value)} className="h-9 w-28 text-xs uppercase" maxLength={5} />
        </div>
        <DateField label="Ida" value={outDate} onChange={setOutDate} />
        {tripType === "1" && <DateField label="Volta" value={retDate} onChange={setRetDate} minDate={outDate} />}
        <Stepper label="Adultos" value={pax} onChange={setPax} min={1} />
        <Stepper label="Crianças" value={children} onChange={setChildren} min={0} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Viagem:</span>
          <ChipSelect options={tripOptions} value={tripType} onChange={setTripType} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Classe:</span>
          <ChipSelect options={classOptions} value={travelClass} onChange={setTravelClass} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Paradas:</span>
          <ChipSelect options={stopsOptions} value={stops} onChange={setStops} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Ordenar:</span>
          <ChipSelect options={sortOptions} value={sortBy} onChange={setSortBy} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Moeda:</span>
          <ChipSelect options={currencyOptions} value={currency} onChange={setCurrency} />
        </div>
        <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={submit}><Search className="w-3.5 h-3.5" /> Buscar voos</Button>
      </div>
    </div>
  );
}

/* ── Hotels form ── */
function HotelsForm({ onSearch, initialQuery }: { onSearch: Props["onSearch"]; initialQuery: string }) {
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [guests, setGuests] = useState(2);
  const [children, setChildren] = useState(0);
  const [sortBy, setSortBy] = useState("3");
  const [rating, setRating] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [currency, setCurrency] = useState("BRL");

  const sortOptions = [
    { label: "Menor preço", value: "3" },
    { label: "Relevância", value: "13" },
    { label: "Melhor nota", value: "8" },
  ];
  const ratingOptions = [
    { label: "Qualquer", value: "" },
    { label: "3+", value: "7" },
    { label: "3.5+", value: "8" },
    { label: "4+", value: "9" },
    { label: "4.5+", value: "10" },
  ];
  const propOptions = [
    { label: "Qualquer", value: "" },
    { label: "Hotel", value: "1" },
    { label: "Pousada", value: "3" },
    { label: "Resort", value: "8" },
    { label: "Hostel", value: "9" },
  ];
  const currencyOptions = [
    { label: "BRL", value: "BRL" },
    { label: "USD", value: "USD" },
    { label: "EUR", value: "EUR" },
  ];

  const submit = () => {
    const params: StructuredParams = { _ai_resolved: true };
    if (checkIn) params.check_in_date = format(checkIn, "yyyy-MM-dd");
    if (checkOut) params.check_out_date = format(checkOut, "yyyy-MM-dd");
    if (guests !== 2) params.adults = guests;
    if (children > 0) params.children = children;
    if (sortBy) params.sort_by = Number(sortBy);
    if (rating) params.rating = rating;
    if (propertyType) params.property_type = propertyType;
    params.currency = currency;
    onSearch(initialQuery, params);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <DateField label="Check-in" value={checkIn} onChange={setCheckIn} />
        <DateField label="Check-out" value={checkOut} onChange={setCheckOut} minDate={checkIn} />
        <Stepper label="Adultos" value={guests} onChange={setGuests} min={1} />
        <Stepper label="Crianças" value={children} onChange={setChildren} min={0} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Ordenar:</span>
          <ChipSelect options={sortOptions} value={sortBy} onChange={setSortBy} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Nota:</span>
          <ChipSelect options={ratingOptions} value={rating} onChange={setRating} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Tipo:</span>
          <ChipSelect options={propOptions} value={propertyType} onChange={setPropertyType} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Moeda:</span>
          <ChipSelect options={currencyOptions} value={currency} onChange={setCurrency} />
        </div>
        <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={submit}><Search className="w-3.5 h-3.5" /> Buscar hotéis</Button>
      </div>
    </div>
  );
}

/* ── Events form ── */
function EventsForm({ onSearch, initialQuery }: { onSearch: Props["onSearch"]; initialQuery: string }) {
  const [location, setLocation] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [eventType, setEventType] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  const locationRef = useRef<HTMLInputElement>(null);

  const CITIES = [
    "São Paulo, SP, Brazil", "Rio de Janeiro, RJ, Brazil", "Belo Horizonte, MG, Brazil",
    "Porto Alegre, RS, Brazil", "Curitiba, PR, Brazil", "Salvador, BA, Brazil",
    "Brasília, DF, Brazil", "Fortaleza, CE, Brazil", "Recife, PE, Brazil",
    "Florianópolis, SC, Brazil", "Goiânia, GO, Brazil", "Manaus, AM, Brazil",
    "Belém, PA, Brazil", "Campinas, SP, Brazil", "São Luís, MA, Brazil",
    "Natal, RN, Brazil", "João Pessoa, PB, Brazil", "Vitória, ES, Brazil",
    "Ribeirão Preto, SP, Brazil", "Joinville, SC, Brazil", "Santos, SP, Brazil",
    "Uberlândia, MG, Brazil", "Sorocaba, SP, Brazil", "Aracaju, SE, Brazil",
    "Maceió, AL, Brazil", "Campo Grande, MS, Brazil", "Cuiabá, MT, Brazil",
    "Teresina, PI, Brazil", "Londrina, PR, Brazil", "Niterói, RJ, Brazil",
  ];

  const handleLocationChange = (val: string) => {
    setLocation(val);
    if (val.length >= 2) {
      const lower = val.toLowerCase();
      setFilteredCities(CITIES.filter(c => c.toLowerCase().includes(lower)).slice(0, 6));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectCity = (city: string) => {
    setLocation(city);
    setShowSuggestions(false);
  };

  const dateOptions = [
    { label: "Hoje", value: "today" },
    { label: "Amanhã", value: "tomorrow" },
    { label: "Esta semana", value: "week" },
    { label: "Este mês", value: "month" },
  ];
  const typeOptions = [
    { label: "Presencial", value: "" },
    { label: "Virtual", value: "Virtual-Event" },
  ];

  const submit = () => {
    const q = initialQuery || "eventos";
    const params: StructuredParams = { _ai_resolved: true };
    if (location) params.location = location;
    if (dateRange) params.htichips = `date:${dateRange}`;
    if (eventType) params.htichips_type = `event_type:${eventType}`;
    onSearch(q, params);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Input
            ref={locationRef}
            placeholder="Cidade / local"
            value={location}
            onChange={e => handleLocationChange(e.target.value)}
            onFocus={() => { if (filteredCities.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="h-9 w-48 text-xs"
          />
          {showSuggestions && filteredCities.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-foreground/10 bg-background/95 backdrop-blur-md shadow-lg p-1">
              {filteredCities.map(city => (
                <button
                  key={city}
                  onMouseDown={() => selectCity(city)}
                  className="flex items-center gap-2 w-full text-left text-xs text-foreground/80 py-1.5 px-2 rounded-md hover:bg-foreground/5 transition-colors"
                >
                  <span className="text-muted-foreground">📍</span>
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Quando:</span>
          <ChipSelect options={dateOptions} value={dateRange} onChange={setDateRange} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Tipo:</span>
          <ChipSelect options={typeOptions} value={eventType} onChange={setEventType} />
        </div>
        <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={submit}><Search className="w-3.5 h-3.5" /> Buscar eventos</Button>
      </div>
    </div>
  );
}

/* ── Jobs form ── */
function JobsForm({ onSearch, initialQuery }: { onSearch: Props["onSearch"]; initialQuery: string }) {
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("");
  const [remote, setRemote] = useState("");
  const [datePosted, setDatePosted] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);

  const CITIES = [
    "São Paulo, SP, Brazil", "Rio de Janeiro, RJ, Brazil", "Belo Horizonte, MG, Brazil",
    "Porto Alegre, RS, Brazil", "Curitiba, PR, Brazil", "Salvador, BA, Brazil",
    "Brasília, DF, Brazil", "Fortaleza, CE, Brazil", "Recife, PE, Brazil",
    "Florianópolis, SC, Brazil", "Campinas, SP, Brazil", "Goiânia, GO, Brazil",
  ];

  const handleLocationChange = (val: string) => {
    setLocation(val);
    if (val.length >= 2) {
      const lower = val.toLowerCase();
      setFilteredCities(CITIES.filter(c => c.toLowerCase().includes(lower)).slice(0, 6));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const typeOptions = [
    { label: "Integral", value: "1" },
    { label: "Meio período", value: "2" },
    { label: "Estágio", value: "3" },
    { label: "Freelancer", value: "4" },
  ];
  const remoteOptions = [
    { label: "Qualquer", value: "" },
    { label: "Remoto", value: "requirements:remote" },
  ];
  const dateOptions = [
    { label: "Qualquer", value: "" },
    { label: "Hoje", value: "date_posted:today" },
    { label: "3 dias", value: "date_posted:3days" },
    { label: "Semana", value: "date_posted:week" },
    { label: "Mês", value: "date_posted:month" },
  ];

  const submit = () => {
    const q = initialQuery;
    const params: StructuredParams = { _ai_resolved: true };
    if (location) params.location = location;
    if (jobType) params.ltype = jobType;
    const chips: string[] = [];
    if (remote) chips.push(remote);
    if (datePosted) chips.push(datePosted);
    if (chips.length > 0) params.chips = chips.join(",");
    onSearch(q, params);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Input
            placeholder="Local (ex: São Paulo)"
            value={location}
            onChange={e => handleLocationChange(e.target.value)}
            onFocus={() => { if (filteredCities.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="h-9 w-48 text-xs"
          />
          {showSuggestions && filteredCities.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-foreground/10 bg-background/95 backdrop-blur-md shadow-lg p-1">
              {filteredCities.map(city => (
                <button
                  key={city}
                  onMouseDown={() => { setLocation(city); setShowSuggestions(false); }}
                  className="flex items-center gap-2 w-full text-left text-xs text-foreground/80 py-1.5 px-2 rounded-md hover:bg-foreground/5 transition-colors"
                >
                  <span className="text-muted-foreground">📍</span>
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Tipo:</span>
          <ChipSelect options={typeOptions} value={jobType} onChange={setJobType} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Modelo:</span>
          <ChipSelect options={remoteOptions} value={remote} onChange={setRemote} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Publicado:</span>
          <ChipSelect options={dateOptions} value={datePosted} onChange={setDatePosted} />
        </div>
        <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={submit}><Search className="w-3.5 h-3.5" /> Buscar vagas</Button>
      </div>
    </div>
  );
}

/* ── Finance form ── */
function FinanceForm({ onSearch, initialQuery }: { onSearch: Props["onSearch"]; initialQuery: string }) {
  const [ticker, setTicker] = useState(initialQuery);
  const [windowVal, setWindowVal] = useState("1M");
  const [exchange, setExchange] = useState("");

  const windowOptions = [
    { label: "1D", value: "1D" },
    { label: "5D", value: "5D" },
    { label: "1M", value: "1M" },
    { label: "6M", value: "6M" },
    { label: "YTD", value: "YTD" },
    { label: "1A", value: "1Y" },
    { label: "5A", value: "5Y" },
    { label: "Máx", value: "MAX" },
  ];
  const exchangeOptions = [
    { label: "Auto", value: "" },
    { label: "B3", value: "BVMF" },
    { label: "NASDAQ", value: "NASDAQ" },
    { label: "NYSE", value: "NYSE" },
    { label: "Crypto", value: "CRYPTO" },
  ];

  useEffect(() => { setTicker(initialQuery); }, [initialQuery]);

  const submit = () => {
    let q = ticker || initialQuery;
    if (exchange && !q.includes(":")) q = `${q}:${exchange}`;
    const params: StructuredParams = { _ai_resolved: true, window: windowVal };
    onSearch(q, params);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Ticker (ex: PETR4, $TSLA, BTC)" value={ticker} onChange={e => setTicker(e.target.value)} className="h-9 w-44 text-xs uppercase" />
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Bolsa:</span>
          <ChipSelect options={exchangeOptions} value={exchange} onChange={setExchange} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Período:</span>
          <ChipSelect options={windowOptions} value={windowVal} onChange={setWindowVal} />
        </div>
        <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={submit}><Search className="w-3.5 h-3.5" /> Buscar cotação</Button>
      </div>
    </div>
  );
}

/* ── Scholar form ── */
function ScholarForm({ onSearch, initialQuery }: { onSearch: Props["onSearch"]; initialQuery: string }) {
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [docType, setDocType] = useState("");

  const sortOptions = [
    { label: "Relevância", value: "" },
    { label: "Data", value: "1" },
  ];
  const typeOptions = [
    { label: "Artigos", value: "" },
    { label: "Patentes", value: "7" },
    { label: "Jurisprudência", value: "4" },
  ];

  const submit = () => {
    const params: StructuredParams = { _ai_resolved: true };
    if (yearFrom) params.as_ylo = yearFrom;
    if (yearTo) params.as_yhi = yearTo;
    if (sortBy) params.scisbd = sortBy;
    if (docType) params.as_sdt = docType;
    onSearch(initialQuery, params);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Ano de" value={yearFrom} onChange={e => setYearFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-9 w-20 text-xs" maxLength={4} />
        <span className="text-xs text-muted-foreground">até</span>
        <Input placeholder="Ano até" value={yearTo} onChange={e => setYearTo(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-9 w-20 text-xs" maxLength={4} />
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Ordenar:</span>
          <ChipSelect options={sortOptions} value={sortBy} onChange={setSortBy} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Tipo:</span>
          <ChipSelect options={typeOptions} value={docType} onChange={setDocType} />
        </div>
        <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={submit}><Search className="w-3.5 h-3.5" /> Buscar artigos</Button>
      </div>
    </div>
  );
}

/* ── Patents form ── */
function PatentsForm({ onSearch, initialQuery }: { onSearch: Props["onSearch"]; initialQuery: string }) {
  const [afterDate, setAfterDate] = useState<Date>();
  const [beforeDate, setBeforeDate] = useState<Date>();
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");

  const statusOptions = [
    { label: "Qualquer", value: "" },
    { label: "Concedida", value: "GRANT" },
    { label: "Pedido", value: "APPLICATION" },
  ];
  const countryOptions = [
    { label: "Qualquer", value: "" },
    { label: "BR", value: "BR" },
    { label: "US", value: "US" },
    { label: "EP", value: "EP" },
    { label: "CN", value: "CN" },
  ];

  const submit = () => {
    const params: StructuredParams = { _ai_resolved: true };
    if (afterDate) params.after_priority_date = format(afterDate, "yyyyMMdd");
    if (beforeDate) params.before_priority_date = format(beforeDate, "yyyyMMdd");
    if (status) params.status = status;
    if (country) params.country = country;
    onSearch(initialQuery, params);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <DateField label="Após data" value={afterDate} onChange={setAfterDate} minDate={new Date("1900-01-01")} />
        <DateField label="Antes de" value={beforeDate} onChange={setBeforeDate} minDate={afterDate || new Date("1900-01-01")} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">Status:</span>
          <ChipSelect options={statusOptions} value={status} onChange={setStatus} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium">País:</span>
          <ChipSelect options={countryOptions} value={country} onChange={setCountry} />
        </div>
        <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={submit}><Search className="w-3.5 h-3.5" /> Buscar patentes</Button>
      </div>
    </div>
  );
}

/* ── Engine → icon map ── */
const engineIcons: Record<string, any> = {
  "Voos": Plane, "Hotéis": Hotel, "Vagas": Briefcase, "Eventos": CalendarIcon,
  "Finanças": DollarSign, "Acadêmico": GraduationCap, "Patentes": FileText,
};

/* ── Main adaptive form ── */
const AdaptiveSearchForm = memo(({ engine, onSearch, initialQuery }: Props) => {
  const formMap: Record<string, JSX.Element> = {
    "Voos": <FlightsForm onSearch={onSearch} initialQuery={initialQuery} />,
    "Hotéis": <HotelsForm onSearch={onSearch} initialQuery={initialQuery} />,
    "Eventos": <EventsForm onSearch={onSearch} initialQuery={initialQuery} />,
    "Vagas": <JobsForm onSearch={onSearch} initialQuery={initialQuery} />,
    "Finanças": <FinanceForm onSearch={onSearch} initialQuery={initialQuery} />,
    "Acadêmico": <ScholarForm onSearch={onSearch} initialQuery={initialQuery} />,
    "Patentes": <PatentsForm onSearch={onSearch} initialQuery={initialQuery} />,
  };

  const form = formMap[engine];
  if (!form) return null;

  const Icon = engineIcons[engine] || Search;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={engine}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className="mt-3 pt-3 border-t border-foreground/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Parâmetros de busca</span>
          </div>
          {form}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

AdaptiveSearchForm.displayName = "AdaptiveSearchForm";
export default AdaptiveSearchForm;
