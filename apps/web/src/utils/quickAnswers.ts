/**
 * Quick Answers - Instant results for math, conversions, dates
 * without calling the Perplexity API (saves credits).
 */

export interface QuickAnswer {
  type: "math" | "conversion" | "date" | "timer";
  query: string;
  answer: string;
  details?: string;
}

// Math evaluation (safe, no eval)
function tryMath(q: string): QuickAnswer | null {
  // Clean up query
  const cleaned = q
    .replace(/\s+/g, " ")
    .replace(/,/g, ".")
    .replace(/[xX×]/g, "*")
    .replace(/÷/g, "/")
    .replace(/%/g, "/100")
    .trim();

  // Match simple math expressions: numbers and operators only
  const mathRegex = /^[\d\s+\-*/().^]+$/;
  if (!mathRegex.test(cleaned)) return null;

  try {
    // Safe math evaluation using Function constructor with limited scope
    const sanitized = cleaned.replace(/\^/g, "**");
    const result = new Function(`"use strict"; return (${sanitized})`)();
    if (typeof result !== "number" || !isFinite(result)) return null;

    const formatted = result % 1 === 0
      ? result.toLocaleString("pt-BR")
      : result.toLocaleString("pt-BR", { maximumFractionDigits: 8 });

    return {
      type: "math",
      query: q,
      answer: formatted,
      details: `${cleaned} = ${formatted}`,
    };
  } catch {
    return null;
  }
}

// Unit conversions
const conversionPatterns: {
  regex: RegExp;
  convert: (value: number, from: string, to: string) => { result: number; unit: string } | null;
}[] = [
  {
    // "100 km em milhas", "50 kg to lbs", "30 celsius em fahrenheit"
    regex: /^([\d.,]+)\s*(km|mi|milhas?|metros?|m|cm|mm|pol|polegadas?|pés?|ft|kg|g|gramas?|lb|lbs|libras?|oz|onças?|litros?|l|ml|galões?|gal|celsius|fahrenheit|°[cf]|c|f)\s+(?:em|to|para|in|=)\s*(km|mi|milhas?|metros?|m|cm|mm|pol|polegadas?|pés?|ft|kg|g|gramas?|lb|lbs|libras?|oz|onças?|litros?|l|ml|galões?|gal|celsius|fahrenheit|°[cf]|c|f)$/i,
    convert: (value, from, to) => {
      const f = normalizeUnit(from);
      const t = normalizeUnit(to);
      const key = `${f}_${t}`;

      const conversions: Record<string, number> = {
        km_mi: 0.621371, mi_km: 1.60934,
        m_ft: 3.28084, ft_m: 0.3048,
        m_cm: 100, cm_m: 0.01,
        km_m: 1000, m_km: 0.001,
        cm_mm: 10, mm_cm: 0.1,
        cm_in: 0.393701, in_cm: 2.54,
        kg_lb: 2.20462, lb_kg: 0.453592,
        g_oz: 0.035274, oz_g: 28.3495,
        kg_g: 1000, g_kg: 0.001,
        l_gal: 0.264172, gal_l: 3.78541,
        l_ml: 1000, ml_l: 0.001,
      };

      // Temperature special case
      if (f === "c" && t === "f") return { result: (value * 9) / 5 + 32, unit: "°F" };
      if (f === "f" && t === "c") return { result: ((value - 32) * 5) / 9, unit: "°C" };

      const factor = conversions[key];
      if (!factor) return null;

      const unitLabels: Record<string, string> = {
        km: "km", mi: "milhas", m: "m", ft: "pés", cm: "cm", mm: "mm", in: "pol",
        kg: "kg", lb: "lbs", g: "g", oz: "oz", l: "L", gal: "gal", ml: "mL",
      };

      return { result: value * factor, unit: unitLabels[t] || t };
    },
  },
];

function normalizeUnit(u: string): string {
  const map: Record<string, string> = {
    quilômetros: "km", quilometros: "km", km: "km",
    milhas: "mi", milha: "mi", mi: "mi",
    metros: "m", metro: "m", m: "m",
    centímetros: "cm", centimetros: "cm", cm: "cm",
    milímetros: "mm", milimetros: "mm", mm: "mm",
    polegadas: "in", polegada: "in", pol: "in",
    pés: "ft", pe: "ft", ft: "ft",
    quilogramas: "kg", quilos: "kg", kg: "kg",
    gramas: "g", grama: "g", g: "g",
    libras: "lb", libra: "lb", lbs: "lb", lb: "lb",
    onças: "oz", onça: "oz", oz: "oz",
    litros: "l", litro: "l", l: "l",
    mililitros: "ml", ml: "ml",
    galões: "gal", galão: "gal", gal: "gal",
    celsius: "c", "°c": "c", c: "c",
    fahrenheit: "f", "°f": "f", f: "f",
  };
  return map[u.toLowerCase()] || u.toLowerCase();
}

function tryConversion(q: string): QuickAnswer | null {
  for (const { regex, convert } of conversionPatterns) {
    const match = q.match(regex);
    if (match) {
      const value = parseFloat(match[1].replace(",", "."));
      const result = convert(value, match[2], match[3]);
      if (result) {
        const formatted = result.result.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
        return {
          type: "conversion",
          query: q,
          answer: `${formatted} ${result.unit}`,
          details: `${value.toLocaleString("pt-BR")} ${match[2]} = ${formatted} ${result.unit}`,
        };
      }
    }
  }
  return null;
}

// Date/time queries
function tryDate(q: string): QuickAnswer | null {
  const lower = q.toLowerCase().trim();

  const datePatterns = [
    /^que\s+(dia|horas?|data)\s+(?:é\s+)?hoje/,
    /^qual\s+(?:é\s+)?(?:a\s+)?(?:data|hora|dia)\s+(?:de\s+)?hoje/,
    /^hoje\s+(?:é\s+)?que\s+dia/,
    /^what\s+(?:time|date|day)\s+is\s+it/,
    /^hora\s+atual/,
    /^data\s+(?:de\s+)?hoje/,
  ];

  if (!datePatterns.some(p => p.test(lower))) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return {
    type: "date",
    query: q,
    answer: `${dateStr}, ${timeStr}`,
    details: `Fuso horário: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  };
}

/**
 * Try to get a quick answer for the query.
 * Returns null if no quick answer is available.
 */
export function getQuickAnswer(query: string): QuickAnswer | null {
  const q = query.trim();
  if (!q || q.length > 100) return null;

  return tryMath(q) || tryConversion(q) || tryDate(q) || null;
}
