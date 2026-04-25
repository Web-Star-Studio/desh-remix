import type { ContactPhone, ContactEmail, ContactAddress } from "@/types/contacts";

export interface ParsedVCardContact {
  name: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  addresses: ContactAddress[];
  company: string;
  role: string;
  notes: string;
  website: string;
  birthday: string | null;
}

/**
 * Unfold vCard continuation lines (lines starting with space/tab are continuations).
 */
function unfold(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/**
 * Decode QUOTED-PRINTABLE value.
 */
function decodeQP(val: string): string {
  return val
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extract TYPE parameter from a property line like "TEL;TYPE=CELL;TYPE=VOICE:..."
 */
function extractType(params: string): string {
  const types: string[] = [];
  // Handle TYPE=value or just value after semicolon
  const matches = params.matchAll(/TYPE=([^;:,]+)/gi);
  for (const m of matches) types.push(m[1].toLowerCase());
  // Also handle vCard 2.1 style: TEL;CELL;VOICE:...
  const parts = params.split(";").slice(1);
  for (const p of parts) {
    const clean = p.split("=")[0].toLowerCase().trim();
    if (["cell", "home", "work", "fax", "pager", "voice", "main", "iphone", "other"].includes(clean)) {
      types.push(clean);
    }
  }
  return types.filter(t => t !== "voice").join(", ") || "principal";
}

function labelFromType(t: string): string {
  const map: Record<string, string> = {
    cell: "Celular", home: "Casa", work: "Trabalho", fax: "Fax",
    pager: "Pager", main: "Principal", iphone: "iPhone", other: "Outro",
    principal: "Principal",
  };
  const parts = t.split(",").map(s => s.trim());
  return parts.map(p => map[p] || p).join(", ") || "Principal";
}

function parseAddress(val: string, params: string): ContactAddress {
  // ADR format: PO Box;Extended;Street;City;State;Zip;Country
  const parts = val.split(";");
  const type = extractType(params);
  return {
    street: (parts[2] || "").trim(),
    city: (parts[3] || "").trim(),
    state: (parts[4] || "").trim(),
    zip: (parts[5] || "").trim(),
    country: (parts[6] || "").trim(),
    label: labelFromType(type),
  };
}

function parseSingleVCard(block: string): ParsedVCardContact | null {
  const lines = block.split(/\r?\n/);
  const contact: ParsedVCardContact = {
    name: "", phones: [], emails: [], addresses: [],
    company: "", role: "", notes: "", website: "", birthday: null,
  };

  for (const line of lines) {
    if (!line || line.startsWith("BEGIN:") || line.startsWith("END:") || line.startsWith("VERSION:")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const propPart = line.substring(0, colonIdx);
    let value = line.substring(colonIdx + 1).trim();
    const propName = propPart.split(";")[0].toUpperCase();

    // Handle QUOTED-PRINTABLE encoding
    if (propPart.toUpperCase().includes("QUOTED-PRINTABLE")) {
      value = decodeQP(value);
    }

    switch (propName) {
      case "FN":
        contact.name = value;
        break;
      case "N":
        // Fallback if FN is missing: N = Last;First;Middle;Prefix;Suffix
        if (!contact.name) {
          const np = value.split(";");
          contact.name = [np[3], np[1], np[2], np[0], np[4]].filter(Boolean).join(" ").trim();
        }
        break;
      case "TEL":
        if (value) {
          contact.phones.push({
            number: value.replace(/\s+/g, ""),
            label: labelFromType(extractType(propPart)),
          });
        }
        break;
      case "EMAIL":
        if (value) {
          contact.emails.push({
            email: value,
            label: labelFromType(extractType(propPart)),
          });
        }
        break;
      case "ORG":
        contact.company = value.split(";")[0].trim();
        break;
      case "TITLE":
        contact.role = value;
        break;
      case "NOTE":
        contact.notes = value.replace(/\\n/g, "\n");
        break;
      case "URL":
        contact.website = value;
        break;
      case "BDAY":
        // Format: YYYYMMDD or YYYY-MM-DD
        if (value.length === 8 && !value.includes("-")) {
          contact.birthday = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
          contact.birthday = value.slice(0, 10);
        }
        break;
      case "ADR": {
        const addr = parseAddress(value, propPart);
        if (addr.street || addr.city || addr.country) {
          contact.addresses.push(addr);
        }
        break;
      }
    }
  }

  if (!contact.name && !contact.phones.length && !contact.emails.length) return null;
  if (!contact.name) contact.name = contact.emails[0]?.email || contact.phones[0]?.number || "Sem nome";

  return contact;
}

/**
 * Parse a full .vcf file (may contain multiple vCards) and return an array of contacts.
 */
export function parseVCardFile(content: string): ParsedVCardContact[] {
  const unfolded = unfold(content);
  const blocks = unfolded.split(/(?=BEGIN:VCARD)/i);
  const contacts: ParsedVCardContact[] = [];

  for (const block of blocks) {
    if (!block.toUpperCase().includes("BEGIN:VCARD")) continue;
    const parsed = parseSingleVCard(block);
    if (parsed) contacts.push(parsed);
  }

  return contacts;
}
