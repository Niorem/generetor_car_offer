import { useState, useCallback, useEffect, useMemo } from "react";
import { parseBatchOffers } from "./batchParser";
import { pickFolder, scanFolder, matchBatch, loadFileHandle, loadFilesFromInput } from "./pngMatcher";

// Costanti del canvas/guide del generatore (devono restare allineate con App.jsx)
const GL = 160, GR = 840, GB = 850;

// Riposiziona/ridimensiona l'immagine auto come fa handleOfferCar in App.jsx,
// così le offerte create dal batch hanno lo stesso layout di quelle create a mano.
function fitCar(img) {
  const scale = (GR - GL) / img.width;
  const carY = GB - (img.height * scale) / 2;
  return { carX: (GL + GR) / 2, carY, carScale: scale };
}

const STATUS_COLORS = {
  matched: { bg: "#0a1a12", border: "#1b3a28", fg: "#25D366", label: "TROVATO" },
  ambiguous: { bg: "#1a160a", border: "#3a3018", fg: "#FFC107", label: "AMBIGUO" },
  missing: { bg: "#1a0a0a", border: "#3a1818", fg: "#ef5350", label: "MANCANTE" },
  pending: { bg: "#0d0d16", border: "#252538", fg: "#777", label: "..." },
};

export default function BatchImportPanel({ apiKey, existingOfferCount, onCommit }) {
  const [text, setText] = useState("");
  const [folderHandle, setFolderHandle] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState([]);
  const [thumbs, setThumbs] = useState({}); // { fileName: dataUrl }
  const [drafts, setDrafts] = useState([]); // [{ ...parsed, match, selectedFile, manualImg, manualThumb }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  // Handler: scelta cartella (preferito - usa File System Access API)
  const onPickFolder = useCallback(async () => {
    setError("");
    try {
      console.log("[BatchImport] Apertura selettore cartella...");
      const handle = await pickFolder();
      console.log("[BatchImport] Cartella selezionata:", handle?.name);
      setFolderHandle(handle);
      setFolderName(handle.name || "Cartella");
      setScanning(true);
      setScanCount(0);
      const found = await scanFolder(handle, undefined, (n) => setScanCount(n));
      console.log("[BatchImport] Scan completata:", found.length, "file");
      setFiles(found);
      setThumbs({});
    } catch (err) {
      console.warn("[BatchImport] pickFolder error:", err);
      if (err && err.name === "AbortError") {
        setError("Selezione annullata. Riclicca o usa il bottone 'Seleziona file' qui sotto.");
      } else {
        setError(err?.message || String(err));
      }
    } finally {
      setScanning(false);
    }
  }, []);

  // Handler fallback: selezione di TUTTI i file via <input type="file" multiple>
  // Funziona in qualsiasi browser. L'utente seleziona i file dentro la cartella.
  const onPickFiles = useCallback(async (e) => {
    setError("");
    const list = e.target.files;
    if (!list || !list.length) return;
    try {
      setScanning(true);
      setScanCount(0);
      const found = await loadFilesFromInput(list);
      const folderGuess = list[0]?.webkitRelativePath?.split("/")[0] || `${list.length} file`;
      setFolderHandle({ name: folderGuess, _isInputFallback: true });
      setFolderName(folderGuess);
      setFiles(found);
      setScanCount(found.length);
      setThumbs({});
      console.log("[BatchImport] Files (fallback):", found.length);
    } catch (err) {
      console.warn("[BatchImport] file input error:", err);
      setError(err?.message || String(err));
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  }, []);

  // Carica thumbnail (solo per i file referenziati nei drafts) on-demand
  useEffect(() => {
    let cancelled = false;
    const referenced = new Set();
    drafts.forEach(d => {
      if (d.selectedFile) referenced.add(d.selectedFile.name);
      (d.match?.matches || []).forEach(m => referenced.add(m.name));
    });
    const toLoad = [...referenced].filter(name => !thumbs[name]);
    if (!toLoad.length) return;
    (async () => {
      const loaded = {};
      for (const name of toLoad) {
        const f = files.find(x => x.name === name);
        if (!f) continue;
        try {
          const { dataUrl } = await loadFileHandle(f.handle);
          if (cancelled) return;
          loaded[name] = dataUrl;
        } catch (_) { /* ignore */ }
      }
      if (!cancelled && Object.keys(loaded).length) {
        setThumbs(prev => ({ ...prev, ...loaded }));
      }
    })();
    return () => { cancelled = true; };
  }, [drafts, files, thumbs]);

  // Handler: parse + match
  const onAnalyze = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const parsed = await parseBatchOffers(text, apiKey);
      if (!parsed.length) {
        setError("Nessuna offerta trovata nel testo. Controlla il formato.");
        setDrafts([]);
        return;
      }
      const matches = matchBatch(parsed, files);
      setDrafts(parsed.map((p, i) => ({
        ...p,
        match: matches[i],
        selectedFile: matches[i].selectedFile || null,
        manualImg: null,
        manualThumb: null,
      })));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }, [text, apiKey, files]);

  // Handler: utente sceglie un file dagli ambigui
  const chooseFile = (idx, file) => {
    setDrafts(p => p.map((d, i) => i === idx
      ? { ...d, selectedFile: file, match: { ...d.match, status: "matched" }, manualImg: null, manualThumb: null }
      : d));
  };

  // Handler: utente carica manualmente un PNG (per i missing o per sostituire)
  const uploadManual = async (idx, fileEvent) => {
    const f = fileEvent.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const img = new Image();
      img.onload = () => {
        setDrafts(p => p.map((d, i) => i === idx
          ? { ...d, manualImg: img, manualThumb: ev.target.result, selectedFile: null, match: { ...d.match, status: "matched" } }
          : d));
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(f);
    fileEvent.target.value = "";
  };

  // Rimuove l'immagine selezionata (torna allo stato pre-scelta)
  const clearSelection = (idx) => {
    setDrafts(p => p.map((d, i) => i === idx
      ? { ...d, selectedFile: null, manualImg: null, manualThumb: null, match: { ...d.match, status: d.match.matches.length ? "ambiguous" : "missing" } }
      : d));
  };

  // Stats per il riepilogo
  const stats = useMemo(() => {
    let matched = 0, ambiguous = 0, missing = 0;
    drafts.forEach(d => {
      if (d.selectedFile || d.manualImg) matched++;
      else if (d.match?.status === "ambiguous") ambiguous++;
      else missing++;
    });
    return { matched, ambiguous, missing, total: drafts.length };
  }, [drafts]);

  // Commit: trasforma i drafts in offers complete, carica le immagini, ritorna a App
  const onCommitClick = async () => {
    setCommitting(true);
    try {
      const out = [];
      for (const d of drafts) {
        let carImg = null, carThumb = null;
        let pos = { carX: 500, carY: 620, carScale: 0.85 };
        if (d.manualImg) {
          carImg = d.manualImg;
          carThumb = d.manualThumb;
          pos = fitCar(d.manualImg);
        } else if (d.selectedFile) {
          try {
            const loaded = await loadFileHandle(d.selectedFile.handle);
            carImg = loaded.img;
            carThumb = loaded.dataUrl;
            pos = fitCar(loaded.img);
          } catch (e) { console.warn("Impossibile caricare", d.selectedFile.name, e); }
        }
        out.push({
          carName: d.carName || "",
          highlightWord: d.highlightWord || "",
          specs: d.specs || "",
          duration: d.duration || "",
          deposit: d.deposit || "",
          price: d.price || "",
          carImg, carThumb, ...pos,
          extras: [], _waText: "", _parsing: false, _waError: "",
        });
      }
      onCommit(out);
      // reset dopo commit
      setText("");
      setDrafts([]);
      setError("");
      setCollapsed(true);
    } finally {
      setCommitting(false);
    }
  };

  const canAnalyze = text.trim().length > 0 && files.length > 0 && !busy;
  const hasResults = drafts.length > 0;

  return (
    <div style={{
      background: "#0a1420",
      border: "1px solid #1d3550",
      borderRadius: 10,
      padding: collapsed ? "8px 12px" : 12,
      marginBottom: 10,
    }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",userSelect:"none"}}
      >
        <div style={{fontSize:11,fontWeight:700,color:"#00BCD4",textTransform:"uppercase",letterSpacing:".6px"}}>
          📥 Import batch (testo + cartella PNG)
        </div>
        <span style={{color:"#00BCD4",fontSize:12}}>{collapsed ? "▸" : "▾"}</span>
      </div>

      {!collapsed && (
        <div style={{marginTop:10}}>
          {/* Step 1: cartella PNG */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"#777",marginBottom:4,letterSpacing:".5px"}}>
              1. CARTELLA PNG AUTO
            </div>
            <button
              className="btn bp"
              onClick={onPickFolder}
              disabled={scanning}
              style={{width:"100%",padding:"10px 12px",fontSize:12,textAlign:"center",opacity:scanning?0.6:1}}
            >
              {scanning ? "⏳ Scansione in corso..." : (folderHandle ? "🔄 Cambia cartella" : "📁 Seleziona cartella (consigliato)")}
            </button>

            {/* Fallback universale: file picker multiplo */}
            <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
              <div style={{flex:1,height:1,background:"#252538"}}/>
              <span style={{fontSize:9,color:"#666",fontWeight:700,letterSpacing:".5px"}}>OPPURE</span>
              <div style={{flex:1,height:1,background:"#252538"}}/>
            </div>
            <label className="btn bs" style={{display:"block",width:"100%",padding:"8px 12px",fontSize:11,textAlign:"center",cursor:scanning?"default":"pointer",marginTop:6,opacity:scanning?0.6:1}}>
              📤 Seleziona file (apri la cartella, Ctrl+A, Apri)
              <input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,image/*"
                onChange={onPickFiles}
                disabled={scanning}
                style={{display:"none"}}
              />
            </label>

            {/* Indicatore progresso scansione */}
            {scanning && (
              <div style={{marginTop:6,padding:"6px 8px",background:"#0a1420",border:"1px solid #1d3550",borderRadius:4,fontSize:11,color:"#00BCD4",fontWeight:700}}>
                ⏳ Sto leggendo i file... <span style={{color:"#fff"}}>{scanCount}</span> trovati finora
              </div>
            )}

            {/* Conferma cartella selezionata */}
            {!scanning && folderHandle && (
              <div style={{marginTop:6,padding:"8px 10px",background:"#0a1a12",border:"1px solid #1b3a28",borderRadius:6}}>
                <div style={{fontSize:10,color:"#25D366",fontWeight:700,letterSpacing:".4px",marginBottom:2}}>
                  ✅ CARTELLA SELEZIONATA
                </div>
                <div style={{fontSize:13,color:"#fff",fontWeight:700,wordBreak:"break-all",lineHeight:1.3}}>
                  📁 {folderName}
                </div>
                <div style={{fontSize:11,color:"#ccc",marginTop:2}}>
                  <span style={{color:files.length>0?"#25D366":"#ef5350",fontWeight:700}}>{files.length}</span> file PNG/JPG trovati
                </div>
                {files.length === 0 && (
                  <div style={{fontSize:10,color:"#ef5350",marginTop:4}}>
                    ⚠️ Nessuna immagine trovata. Controlla che la cartella contenga file .png/.jpg
                  </div>
                )}
              </div>
            )}

            {/* Suggerimento se l'utente non ha ancora cliccato */}
            {!scanning && !folderHandle && !error && (
              <div style={{marginTop:6,fontSize:10,color:"#777",fontStyle:"italic"}}>
                Quando clicchi, si apre la finestra di Windows per scegliere la cartella. Concedi i permessi quando il browser te li chiede.
              </div>
            )}
          </div>

          {/* Step 2: testo */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"#777",marginBottom:4,letterSpacing:".5px"}}>
              2. TESTO OFFERTE (separa con riga vuota)
            </div>
            <textarea
              value={text}
              onChange={e=>setText(e.target.value)}
              placeholder={`Esempio:\n\nOPEL Combo Cargo 1.5 Diesel 100CV S&S PC\nDURATA = 48 MESI\nKM INCLUSI = 60.000 TOTALI\nANTICIPO = EURO 2.000 + IVA\nCANONE DI NOLEGGIO = EURO 349 + IVA\n\nOPEL Vivaro 1.5 Diesel 120CV S&S PL-TN M Furgone\nDURATA = 48 MESI\n...`}
              rows={8}
              style={{width:"100%",background:"#0a0a14",border:"1px solid #1e1e30",color:"#ddd",padding:"8px 10px",borderRadius:6,fontSize:11,outline:"none",resize:"vertical",fontFamily:"monospace",lineHeight:1.4}}
            />
          </div>

          {/* Step 3: analizza */}
          <button
            className="btn bp"
            onClick={onAnalyze}
            disabled={!canAnalyze}
            style={{width:"100%",padding:"9px 14px",fontSize:12,opacity:canAnalyze?1:0.4,marginBottom:8}}
            title={!canAnalyze ? (
              !text.trim() ? "Incolla prima il testo delle offerte" :
              !files.length ? "Seleziona prima la cartella PNG" :
              "Attendi..."
            ) : "Analizza"}
          >
            {busy ? "⏳ Analizzo..." : "🔍 Analizza testo e cerca PNG"}
          </button>

          {!canAnalyze && !busy && (
            <div style={{fontSize:10,color:"#FFC107",marginBottom:6,padding:"4px 6px",background:"#1a160a",border:"1px solid #3a3018",borderRadius:4}}>
              {!files.length && !text.trim() && "⚠️ Manca: cartella PNG + testo"}
              {!files.length && text.trim() && "⚠️ Manca: clicca '📁 Seleziona cartella...' qui sopra"}
              {files.length > 0 && !text.trim() && "⚠️ Manca: incolla il testo delle offerte"}
            </div>
          )}

          {!apiKey && (
            <div style={{fontSize:10,color:"#FFC107",marginBottom:6}}>
              ⚠️ Nessuna API key Anthropic in Setup. Userò il parser locale (può sbagliare il taglio carName/specs).
            </div>
          )}
          {error && (
            <div style={{fontSize:10,color:"#ef5350",marginBottom:6,padding:"6px 8px",background:"#1a0a0a",border:"1px solid #3a1818",borderRadius:4}}>
              {error}
            </div>
          )}

          {/* Risultati */}
          {hasResults && (
            <>
              <div style={{display:"flex",gap:6,marginBottom:8,marginTop:8}}>
                <div style={{flex:1,padding:"6px 8px",background:"#0a1a12",border:"1px solid #1b3a28",borderRadius:6,textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#777",fontWeight:700}}>TROVATI</div>
                  <div style={{fontSize:18,color:"#25D366",fontWeight:900}}>{stats.matched}</div>
                </div>
                <div style={{flex:1,padding:"6px 8px",background:"#1a160a",border:"1px solid #3a3018",borderRadius:6,textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#777",fontWeight:700}}>AMBIGUI</div>
                  <div style={{fontSize:18,color:"#FFC107",fontWeight:900}}>{stats.ambiguous}</div>
                </div>
                <div style={{flex:1,padding:"6px 8px",background:"#1a0a0a",border:"1px solid #3a1818",borderRadius:6,textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#777",fontWeight:700}}>MANCANTI</div>
                  <div style={{fontSize:18,color:"#ef5350",fontWeight:900}}>{stats.missing}</div>
                </div>
              </div>

              <div style={{maxHeight:360,overflowY:"auto",marginBottom:8,paddingRight:4}}>
                {drafts.map((d, idx) => {
                  const status = d.selectedFile || d.manualImg
                    ? "matched"
                    : (d.match?.status === "ambiguous" ? "ambiguous" : "missing");
                  const c = STATUS_COLORS[status];
                  const selThumb = d.manualThumb || (d.selectedFile && thumbs[d.selectedFile.name]);
                  const titleTip = `${d.carName || "(senza nome)"}${d.specs ? "\n" + d.specs : ""}${d.duration ? "\n" + d.duration : ""}${d.deposit ? "\n" + d.deposit : ""}${d.price ? "\nCanone: " + d.price + "€/mese" : ""}`;
                  return (
                    <div key={idx} style={{
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      borderRadius: 6,
                      padding: 8,
                      marginBottom: 6,
                    }} title={titleTip}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                        <span style={{
                          fontSize:9,fontWeight:700,padding:"2px 6px",
                          background:c.fg+"22",color:c.fg,borderRadius:3,
                          letterSpacing:".4px",flexShrink:0,marginTop:2,
                        }}>{c.label}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div title={d.carName} style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {d.carName || "(nessun nome)"}
                          </div>
                          {d.specs && <div title={d.specs} style={{fontSize:10,color:"#aaa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.specs}</div>}
                          <div style={{fontSize:9,color:"#777",marginTop:2}}>
                            {d.duration && <span>📅 {d.duration}</span>}
                            {d.deposit && <span style={{marginLeft:6}}>💰 {d.deposit}</span>}
                            {d.price && <span style={{marginLeft:6}}>🏷 {d.price}€</span>}
                          </div>
                        </div>
                      </div>

                      {/* Anteprima file selezionato (matched) */}
                      {status === "matched" && (selThumb || d.selectedFile) && (
                        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,padding:6,background:"#0a0a14",border:"1px solid #1e1e30",borderRadius:4}} title={d.manualImg ? "Caricato manualmente" : (d.selectedFile?.name || "")}>
                          <div style={{width:46,height:46,background:"#fff",borderRadius:4,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {selThumb
                              ? <img src={selThumb} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>
                              : <span style={{fontSize:9,color:"#999"}}>...</span>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:10,fontWeight:700,color:"#ddd",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {d.manualImg ? "(caricato manualmente)" : d.selectedFile.name}
                            </div>
                          </div>
                          <button className="btn bd" onClick={()=>clearSelection(idx)} style={{padding:"3px 6px",fontSize:9,flexShrink:0}}>✕</button>
                        </div>
                      )}

                      {/* Lista ambigui per scelta */}
                      {status === "ambiguous" && (
                        <div style={{marginTop:6}}>
                          <div style={{fontSize:9,color:"#777",fontWeight:700,marginBottom:4}}>SCEGLI IL FILE CORRETTO:</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                            {(d.match?.matches || []).map(m => (
                              <button
                                key={m.name}
                                onClick={()=>chooseFile(idx, m)}
                                title={m.name}
                                style={{
                                  display:"flex",alignItems:"center",gap:5,padding:4,
                                  background:"#0a0a14",border:"1px solid #1e1e30",borderRadius:4,
                                  cursor:"pointer",textAlign:"left",minWidth:0,
                                }}
                              >
                                <div style={{width:28,height:28,background:"#fff",borderRadius:3,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  {thumbs[m.name]
                                    ? <img src={thumbs[m.name]} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>
                                    : <span style={{fontSize:8,color:"#999"}}>...</span>}
                                </div>
                                <span style={{fontSize:9,color:"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{m.name}</span>
                              </button>
                            ))}
                          </div>
                          <label className="btn bs" style={{display:"block",marginTop:6,padding:"5px 8px",fontSize:9,textAlign:"center",cursor:"pointer"}}>
                            📤 Oppure carica manualmente...
                            <input type="file" accept="image/*" onChange={e=>uploadManual(idx, e)} style={{display:"none"}}/>
                          </label>
                        </div>
                      )}

                      {/* Missing: solo upload manuale */}
                      {status === "missing" && (
                        <label className="btn bs" style={{display:"block",marginTop:6,padding:"5px 8px",fontSize:10,textAlign:"center",cursor:"pointer"}}>
                          📤 Carica un PNG manualmente per questa offerta
                          <input type="file" accept="image/*" onChange={e=>uploadManual(idx, e)} style={{display:"none"}}/>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                className="btn bp"
                onClick={onCommitClick}
                disabled={committing || !drafts.length}
                style={{width:"100%",padding:"10px 14px",fontSize:13}}
              >
                {committing
                  ? "⏳ Creo le offerte..."
                  : `✅ Crea ${drafts.length} offerte${existingOfferCount > 0 ? ` (totale ${existingOfferCount + drafts.length})` : ""}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
