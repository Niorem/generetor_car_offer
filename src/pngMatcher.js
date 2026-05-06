// Logica di matching PNG: dato un brand+modello cerca il file giusto in una
// cartella scansionata via File System Access API. Tre livelli: esatto, fuzzy,
// missing. Logica derivata dal progetto Seleziona-png-auto.

import Fuse from "fuse.js";

// Apre il directory picker del browser e ritorna l'handle.
// Browser supportati: Chrome, Edge, Opera. Firefox/Safari → throw.
export async function pickFolder() {
  if (typeof window === "undefined" || !window.showDirectoryPicker) {
    throw new Error(
      "Il tuo browser non supporta la selezione cartelle. Usa Chrome o Edge, oppure usa il bottone 'Seleziona file'."
    );
  }
  return await window.showDirectoryPicker();
}

// Fallback: l'utente seleziona TUTTI i file della cartella tramite un classico
// <input type="file" multiple>. Funziona in tutti i browser (Firefox, Safari,
// Chrome, Edge), non richiede l'API File System Access.
// Ritorna lo stesso shape di scanFolder: array { name, cleanName, handle }.
// `handle` è un oggetto-shim che espone solo getFile() per compatibilità.
export async function loadFilesFromInput(fileList, exts = ["png", "jpg", "jpeg", "webp"]) {
  const re = new RegExp(`\\.(${exts.join("|")})$`, "i");
  const files = [];
  for (const file of fileList) {
    if (!re.test(file.name)) continue;
    const cleanName = file.name
      .replace(/^\s*\d+[.\-_)]\s*/, "")
      .replace(re, "")
      .replace(/[._\-]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    files.push({
      name: file.name,
      cleanName,
      handle: { getFile: async () => file },
    });
  }
  return files;
}

// Scansiona un directory handle e ritorna tutti i file immagine trovati,
// con nome "pulito" usato per il matching (rimuove prefisso numerico ed estensione).
// onProgress(count) è chiamato periodicamente per aggiornare la UI.
export async function scanFolder(handle, exts = ["png", "jpg", "jpeg", "webp"], onProgress = null) {
  const files = [];
  const re = new RegExp(`\\.(${exts.join("|")})$`, "i");
  let i = 0;
  for await (const entry of handle.values()) {
    if (entry.kind !== "file") continue;
    if (!re.test(entry.name)) continue;
    const cleanName = entry.name
      .replace(/^\s*\d+[.\-_)]\s*/, "") // rimuove "1. ", "2. ", "3.", "1-", "1)" all'inizio
      .replace(re, "")                  // rimuove estensione
      .replace(/[._\-]/g, " ")          // separatori → spazi
      .replace(/\s{2,}/g, " ")
      .trim();
    files.push({
      name: entry.name,
      cleanName,
      handle: entry,
    });
    i++;
    // Yield al browser ogni 200 file per non freezare la UI su cartelle enormi
    if (i % 200 === 0) {
      if (onProgress) onProgress(files.length);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  if (onProgress) onProgress(files.length);
  return files;
}

// Normalizza una stringa per il confronto: separatori (- _ . ' /) → spazi,
// rimuove accenti, collassa spazi, uppercase. Così "T-CROSS" e "T Cross" combaciano.
export function normalizeForMatch(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[._\-/'"]/g, " ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokenizza in parole utili per il match (filtra parole vuote o di 1 carattere).
function tokens(s) {
  return normalizeForMatch(s).split(" ").filter(t => t.length >= 2);
}

// Match a tre livelli per UNA richiesta (brand+model):
// 1. Esatto: nome file pulito contiene TUTTE le parole di brand+model (normalizzate)
// 2. Fuzzy: Fuse.js sul cleanName, ma solo se il punteggio è chiaramente buono
// 3. Missing
export function matchOne(req, files, fuse) {
  const reqTokens = tokens(`${req.brand || ""} ${req.model || ""}`);
  if (!reqTokens.length) {
    return { matches: [], status: "missing", selectedFile: null };
  }

  // Step 1: esatto - nome file contiene TUTTE le parole della query (normalizzate)
  const exact = files.filter(f => {
    const norm = normalizeForMatch(f.cleanName);
    return reqTokens.every(t => new RegExp(`\\b${t}\\b`).test(norm));
  });

  if (exact.length === 1) {
    return { matches: exact, status: "matched", selectedFile: exact[0] };
  }
  if (exact.length > 1) {
    // Più match esatti — se uno ha "meno parole extra", preferiscilo
    // (es. "Volkswagen T Cross" vs "Volkswagen T Cross R-Line 2024")
    const sorted = [...exact].sort((a, b) => {
      const la = normalizeForMatch(a.cleanName).split(" ").length;
      const lb = normalizeForMatch(b.cleanName).split(" ").length;
      return la - lb;
    });
    return { matches: sorted, status: "ambiguous", selectedFile: null };
  }

  // Step 2: fuzzy con score
  const search = reqTokens.join(" ");
  const results = fuse.search(search); // [{item, score}, ...]
  if (results.length === 0) {
    return { matches: [], status: "missing", selectedFile: null };
  }
  // Best score: più basso = migliore (Fuse.js)
  const best = results[0];
  const second = results[1];
  // Se il migliore è chiaramente buono (<= 0.15) e molto meglio del secondo, accettalo
  const STRONG_THRESHOLD = 0.15;
  const GAP_THRESHOLD = 0.1;
  if (best.score <= STRONG_THRESHOLD && (!second || second.score - best.score >= GAP_THRESHOLD)) {
    return { matches: [best.item], status: "matched", selectedFile: best.item };
  }
  // Mostra solo i match con score sotto una soglia ragionevole come ambigui
  const candidates = results.filter(r => r.score <= 0.4).slice(0, 5).map(r => r.item);
  if (candidates.length === 0) {
    return { matches: [], status: "missing", selectedFile: null };
  }
  if (candidates.length === 1) {
    return { matches: candidates, status: "matched", selectedFile: candidates[0] };
  }
  return { matches: candidates, status: "ambiguous", selectedFile: null };
}

// Match in batch: dato un array di richieste e i file della cartella, ritorna
// per ognuna l'oggetto { matches, status, selectedFile }.
export function matchBatch(requests, files) {
  if (!files || !files.length) {
    return requests.map(() => ({ matches: [], status: "missing", selectedFile: null }));
  }
  // Aggiungi una versione normalizzata pre-calcolata per la performance
  const filesNorm = files.map(f => ({ ...f, _norm: normalizeForMatch(f.cleanName) }));
  const fuse = new Fuse(filesNorm, {
    keys: ["_norm"],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  return requests.map(req => matchOne(req, filesNorm, fuse));
}

// Carica un file e lo ridimensiona se più grande di MAX_SIDE px sul lato lungo.
// Riduce drasticamente l'uso di memoria: una foto 4000x3000 occupa ~48 MB decodificata,
// ridimensionata a 1500x1125 ~6.7 MB. Importante con N offerte caricate insieme.
const MAX_SIDE = 1500;
const THUMB_SIDE = 200;

async function fileToImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Impossibile decodificare l'immagine: " + file.name));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function imageToCanvasDataUrl(img, w, h, mime = "image/png") {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL(mime, mime === "image/jpeg" ? 0.92 : undefined);
}

async function dataUrlToImage(dataUrl) {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossibile decodificare l'immagine ridimensionata"));
    img.src = dataUrl;
  });
}

// Carica un FileSystemFileHandle e ritorna { img: HTMLImageElement, dataUrl: string }
// L'immagine viene ridimensionata a max 1500px sul lato lungo per controllare la RAM.
export async function loadFileHandle(handle) {
  const file = await handle.getFile();
  const original = await fileToImage(file);
  const maxDim = Math.max(original.width, original.height);
  const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";

  if (maxDim <= MAX_SIDE) {
    // Già abbastanza piccola: usiamo l'immagine originale + un dataUrl thumb piccolo
    const thumbScale = THUMB_SIDE / maxDim;
    const thumbW = Math.max(1, Math.round(original.width * thumbScale));
    const thumbH = Math.max(1, Math.round(original.height * thumbScale));
    const thumbDataUrl = imageToCanvasDataUrl(original, thumbW, thumbH, mime);
    return { img: original, dataUrl: thumbDataUrl, file };
  }

  // Ridimensiona
  const ratio = MAX_SIDE / maxDim;
  const w = Math.round(original.width * ratio);
  const h = Math.round(original.height * ratio);
  const fullDataUrl = imageToCanvasDataUrl(original, w, h, mime);
  // Crea l'Image ridimensionata (necessaria per il render del canvas del generatore)
  const resized = await dataUrlToImage(fullDataUrl);
  // Genera anche un thumb molto piccolo per le anteprime UI
  const thumbScale = THUMB_SIDE / Math.max(w, h);
  const thumbW = Math.max(1, Math.round(w * thumbScale));
  const thumbH = Math.max(1, Math.round(h * thumbScale));
  const thumbDataUrl = imageToCanvasDataUrl(resized, thumbW, thumbH, mime);
  return { img: resized, dataUrl: thumbDataUrl, file };
}
