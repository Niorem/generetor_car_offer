// Parser per import batch di offerte auto.
// Combina parser locale (per righe strutturate KEY = VALUE) con AI Claude
// (per splittare la riga libera in carName/specs/highlightWord).

const CAR_BRANDS = [
  "ALFA ROMEO","LAND ROVER","ASTON MARTIN","MERCEDES BENZ","ROLLS ROYCE",
  "RANGE ROVER",
  "ABARTH","AUDI","BMW","CITROEN","CITROËN","CUPRA","DACIA","DS",
  "FERRARI","FIAT","FORD","HONDA","HYUNDAI","JAGUAR","JEEP","KIA",
  "LANCIA","LEXUS","MASERATI","MAZDA","MERCEDES","MG","MINI",
  "MITSUBISHI","NISSAN","OPEL","PEUGEOT","PORSCHE","RENAULT","SEAT",
  "SKODA","SMART","SUBARU","SUZUKI","TESLA","TOYOTA","VOLKSWAGEN",
  "VW","VOLVO",
].sort((a, b) => b.length - a.length);

// Splitta il testo in blocchi di offerte. Un blocco si chiude quando:
// - c'è una riga vuota
// - oppure la riga successiva inizia con un brand auto noto (cambio offerta senza riga vuota)
function splitBlocks(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const blocks = [];
  let cur = [];
  for (const line of lines) {
    if (!line) {
      if (cur.length) { blocks.push(cur); cur = []; }
      continue;
    }
    // Cambio offerta implicito: nuova riga libera (no '=' e starts with brand) dopo righe KEY=VALUE
    const isFreeForm = !line.includes("=");
    const startsWithBrand = CAR_BRANDS.some(b => {
      const u = line.toUpperCase();
      return u.startsWith(b + " ") || u === b;
    });
    if (cur.length > 0 && isFreeForm && startsWithBrand) {
      // se il blocco corrente ha gia almeno una riga e una linea KEY=VALUE,
      // questa nuova riga libera è una nuova offerta
      const hasKv = cur.some(l => l.includes("="));
      if (hasKv) { blocks.push(cur); cur = []; }
    }
    cur.push(line);
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

// Estrae brand+modello dalla prima riga di un blocco usando il database brand.
// Usato come fallback quando l'AI fallisce o non c'è API key.
function extractBrandModelLocal(line) {
  const upper = line.toUpperCase();
  for (const brand of CAR_BRANDS) {
    const idx = upper.indexOf(brand);
    if (idx !== 0) continue; // brand deve essere all'inizio
    const after = line.slice(brand.length).trim();
    // Modello: prime 1-2 parole prima di un indicatore di motorizzazione
    const stop = after.search(/\s+(?:\d+[.,]?\d*\s*(?:CV|HP|KW|TDI|TSI|HYBRID|ELECTRIC|PLUG|TURBO|MHEV|JTD|JTDM|D|DIESEL|BENZINA|GPL))/i);
    const modelPart = stop > 0 ? after.slice(0, stop) : after.split(/\s+/).slice(0, 2).join(" ");
    const specsPart = stop > 0 ? after.slice(stop).trim() : after.split(/\s+/).slice(2).join(" ");
    return {
      brand: brand,
      carName: `${brand} ${modelPart}`.trim().replace(/\s+/g, " "),
      model: modelPart.trim(),
      specs: specsPart,
      highlightWord: modelPart.split(/\s+/).slice(0, 2).join(" ").trim(),
    };
  }
  // Fallback: prima parola = brand, seconda = modello
  const parts = line.split(/\s+/);
  return {
    brand: (parts[0] || "").toUpperCase(),
    carName: parts.slice(0, 2).join(" "),
    model: parts[1] || "",
    specs: parts.slice(2).join(" "),
    highlightWord: parts[1] || "",
  };
}

// Parsa le righe strutturate "KEY = VALUE" e produce duration/deposit/price
// nel formato del generatore di card.
function parseStructuredLines(lines) {
  const result = { duration: "", deposit: "", price: "" };
  let durMonths = "";
  let durKm = "";
  for (const raw of lines) {
    const eqIdx = raw.indexOf("=");
    if (eqIdx < 0) continue;
    const key = raw.slice(0, eqIdx).trim().toUpperCase();
    const val = raw.slice(eqIdx + 1).trim();
    if (/^DURATA\b/.test(key)) {
      durMonths = val.replace(/\s+/g, " ").toUpperCase();
    } else if (/^KM\b/.test(key)) {
      // estrae solo i numeri/punti
      const m = val.match(/[\d.,]+/);
      const kmStr = m ? m[0] : val;
      durKm = `${kmStr} KM`;
    } else if (/^ANTICIPO\b/.test(key)) {
      // Estrae il numero (es. "EURO 2.000 + IVA" → "2.000")
      const m = val.match(/([\d.,]+)/);
      const num = m ? m[1] : "";
      result.deposit = num ? `ANTICIPO ${num}€ I.E.` : `ANTICIPO ${val}`;
    } else if (/^CANONE\b/.test(key) || /^PREZZO\b/.test(key) || /^RATA\b/.test(key)) {
      // Estrae solo le cifre intere (es. "EURO 349 + IVA" → "349")
      const m = val.match(/(\d{2,5})/);
      result.price = m ? m[1] : val.replace(/[^\d]/g, "");
    }
  }
  if (durMonths || durKm) {
    if (durMonths && durKm) result.duration = `${durMonths} – ${durKm}`;
    else result.duration = durMonths || durKm;
  }
  return result;
}

// Chiamata AI Claude per splittare il header (1 o più righe) in carName + specs + highlightWord.
// Una sola call per TUTTE le offerte (più veloce/economico).
// `headers` è un array di stringhe; ogni stringa può contenere newlines (header multi-riga).
async function aiSplitFreeFormLines(headers, apiKey) {
  if (!apiKey || !headers.length) return null;
  const prompt = `Sei un assistente per noleggio lungo termine. Per ogni offerta ricevuta in input, estrai:
- "carName": SOLO marca + modello principale, in MAIUSCOLO (es. "FIAT PANDINA", "OPEL COMBO CARGO", "MERCEDES CLASSE A").
  IMPORTANTE: se l'input ha più righe, la PRIMA riga è quasi sempre il carName completo. La SECONDA riga è specs.
- "specs": il resto (versione/motorizzazione/allestimento) in MAIUSCOLO (es. "1.0 FIREFLY 65 CV HYBRID ICON", "220 D 4MATIC ADVANCED").
- "highlightWord": parola/e del modello da evidenziare (di solito il modello senza brand, es. "PANDINA", "COMBO CARGO", "CLASSE A").

Input (offerte separate da "---"):
${headers.map((l,i)=>`OFFERTA #${i+1}:\n${l}`).join("\n---\n")}

Rispondi SOLO con un array JSON di lunghezza ${headers.length}, niente markdown niente backtick. Mantieni l'ordine. Schema: [{"carName":"...","specs":"...","highlightWord":"..."}, ...]`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || "API " + res.status);
    }
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    const raw = (d.content || []).map(c => c.text || "").join("");
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed) || parsed.length !== lines.length) {
      throw new Error("Risposta AI non coerente con il numero di righe");
    }
    return parsed;
  } catch (err) {
    console.warn("AI split failed, falling back to local parser:", err);
    return null;
  }
}

// Per ogni blocco, separa le "header lines" (righe senza '=') dalle "structured lines"
// (righe KEY = VALUE). Le header lines vengono mantenute come array per rispettare
// la struttura a 2 righe del formato cliente (riga 1 = nome, riga 2 = caratteristiche).
function splitBlockHeader(block) {
  const headerLines = [];
  const structLines = [];
  let inStruct = false;
  for (const line of block) {
    if (line.includes("=")) inStruct = true;
    if (inStruct) structLines.push(line);
    else if (line.trim()) headerLines.push(line.trim());
  }
  return {
    headerLines,
    header: headerLines.join("\n"), // preservato il newline per l'AI
    structLines,
  };
}

// Quando ci sono 2+ righe header, la prima è il "nome auto" (BRAND + Modello)
// e le successive sono le caratteristiche (specs). Questo è il formato preferito
// dal cliente.
function extractFromMultiLineHeader(lines) {
  const firstLine = lines[0];
  const restLines = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
  const upper = firstLine.toUpperCase();
  // Prova a riconoscere il brand all'inizio della prima riga
  for (const brand of CAR_BRANDS) {
    if (upper.startsWith(brand + " ") || upper === brand) {
      const modelPart = firstLine.slice(brand.length).trim();
      return {
        brand,
        carName: firstLine.toUpperCase().replace(/\s+/g, " ").trim(),
        model: modelPart.toUpperCase(),
        specs: restLines.toUpperCase(),
        highlightWord: modelPart.toUpperCase(),
      };
    }
  }
  // Brand non in DB: prima parola = brand, resto della riga 1 = modello
  const parts = firstLine.split(/\s+/);
  return {
    brand: (parts[0] || "").toUpperCase(),
    carName: firstLine.toUpperCase().replace(/\s+/g, " ").trim(),
    model: parts.slice(1).join(" ").toUpperCase(),
    specs: restLines.toUpperCase(),
    highlightWord: parts.slice(1).join(" ").toUpperCase(),
  };
}

// Funzione principale: prende il testo grezzo + apiKey, ritorna array di "draft offer".
// Ogni draft contiene: { carName, highlightWord, specs, duration, deposit, price, brand, model, originalText }
export async function parseBatchOffers(text, apiKey) {
  const blocks = splitBlocks(text);
  if (!blocks.length) return [];

  // Estrai header (multi-riga libera) e structured (KEY=VALUE)
  const partitioned = blocks.map(splitBlockHeader);
  // Filtra blocchi senza header (sono malformati / solo KV — li scartiamo)
  const valid = partitioned
    .map((p, i) => ({ ...p, idx: i, block: blocks[i] }))
    .filter(p => p.headerLines.length > 0);

  if (!valid.length) return [];

  // Per l'AI, mandiamo l'header completo (con newlines preservati)
  const freeFormHeaders = valid.map(p => p.header);
  const aiResults = await aiSplitFreeFormLines(freeFormHeaders, apiKey);

  return valid.map((p, i) => {
    const structured = parseStructuredLines(p.structLines);

    let split;
    if (aiResults && aiResults[i]) {
      const r = aiResults[i];
      split = {
        carName: (r.carName || "").toString().trim(),
        specs: (r.specs || "").toString().trim(),
        highlightWord: (r.highlightWord || "").toString().trim(),
      };
      const brandFound = CAR_BRANDS.find(b => split.carName.toUpperCase().startsWith(b));
      split.brand = brandFound || split.carName.split(/\s+/)[0] || "";
      split.model = brandFound
        ? split.carName.slice(brandFound.length).trim()
        : split.carName.split(/\s+/).slice(1).join(" ");
    } else {
      // Fallback locale: scegli la strategia in base al numero di righe header
      const local = p.headerLines.length >= 2
        ? extractFromMultiLineHeader(p.headerLines)
        : extractBrandModelLocal(p.headerLines[0]);
      split = {
        carName: (local.carName || "").toUpperCase(),
        specs: (local.specs || "").toUpperCase(),
        highlightWord: (local.highlightWord || "").toUpperCase(),
        brand: local.brand || "",
        model: (local.model || "").toUpperCase(),
      };
    }

    return {
      ...split,
      ...structured,
      originalText: p.block.join("\n"),
    };
  });
}

// Esposta per uso standalone/test
export { splitBlocks, extractBrandModelLocal, parseStructuredLines };
