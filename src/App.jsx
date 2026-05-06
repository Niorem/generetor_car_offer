import { useState, useRef, useEffect, useCallback } from "react";
import BatchImportPanel from "./BatchImportPanel";

const FONT_DB = {
  "Montserrat": [100,200,300,400,500,600,700,800,900],
  "Oswald": [200,300,400,500,600,700],
  "Bebas Neue": [400],
  "Poppins": [100,200,300,400,500,600,700,800,900],
  "Raleway": [100,200,300,400,500,600,700,800,900],
  "Roboto Condensed": [100,200,300,400,500,600,700,800,900],
  "Anton": [400],
  "Barlow Condensed": [100,200,300,400,500,600,700,800,900],
  "Teko": [300,400,500,600,700],
  "Russo One": [400],
};
const FONTS = Object.keys(FONT_DB);
const pickWeight = (family, requested) => {
  const weights = FONT_DB[family];
  if (!weights) return String(requested || 400);
  const req = parseInt(requested) || 400;
  return String(weights.reduce((best, w) => Math.abs(w - req) < Math.abs(best - req) ? w : best, weights[0]));
};
const DEFAULT_COLOR_PRESETS=[
  {id:"cyan",label:"Cyan",accentColor:"#00BCD4"},
  {id:"rosso",label:"Rosso",accentColor:"#FF5252"},
  {id:"verde",label:"Verde",accentColor:"#4CAF50"},
  {id:"oro",label:"Oro",accentColor:"#FFC107"},
  {id:"viola",label:"Viola",accentColor:"#9C27B0"},
];
const CW=1000,CH=1000;
const GL=160,GR=840,GT=25,GB=850; /* guide Left, Right, Top, Bottom */
let _oid=0,_exId=0;
const newOffer=()=>({id:++_oid,carName:"",highlightWord:"",specs:"",duration:"",deposit:"",price:"",carImg:null,carThumb:null,carX:500,carY:620,carScale:0.85,extras:[],_waText:"",_parsing:false,_waError:""});

const mkShadow=()=>({shadowEnabled:false,shadowColor:"#000000",shadowBlur:0,shadowOffsetX:0,shadowOffsetY:0});
const makeEls=()=>[
  {id:"header",text:"NOLEGGIO LUNGO TERMINE",x:500,y:120,fontSize:28,fontFamily:"Montserrat",fontWeight:"600",color:"#FFFFFF",textAlign:"center",visible:true,...mkShadow()},
  {id:"carName",text:"MERCEDES GLC COUPÉ",x:500,y:178,fontSize:52,fontFamily:"Montserrat",fontWeight:"900",color:"#FFFFFF",highlightWord:"GLC COUPÉ",highlightColor:"#00BCD4",textAlign:"center",visible:true,...mkShadow()},
  {id:"specs",text:"220D MHEV 4MATIC ADVANCED PLUS",x:500,y:228,fontSize:22,fontFamily:"Montserrat",fontWeight:"700",color:"#FFFFFF",textAlign:"center",visible:true,...mkShadow()},
  {id:"duration",text:"48 MESI – 60.000 KM",x:500,y:292,fontSize:24,fontFamily:"Montserrat",fontWeight:"700",color:"#FFFFFF",bgColor:"#1a1a2e",pillStyle:true,highlightWord:"60.000 KM",highlightColor:"#00BCD4",textAlign:"center",visible:true,...mkShadow()},
  {id:"deposit",text:"ANTICIPO 2.000€ I.E.",x:500,y:336,fontSize:22,fontFamily:"Montserrat",fontWeight:"700",color:"#FFFFFF",textAlign:"center",visible:true,...mkShadow()},
  {id:"price",text:"689",x:420,y:420,fontSize:110,fontFamily:"Montserrat",fontWeight:"900",color:"#00BCD4",textAlign:"center",visible:true,...mkShadow()},
  {id:"priceSuffix",text:"€/MESE",x:540,y:400,fontSize:30,fontFamily:"Montserrat",fontWeight:"700",color:"#FFFFFF",highlightWord:"€",highlightColor:"#00BCD4",textAlign:"left",visible:true,...mkShadow()},
  {id:"priceNote",text:"IVA ESCLUSA",x:540,y:438,fontSize:16,fontFamily:"Montserrat",fontWeight:"600",color:"#FFFFFF",textAlign:"left",visible:true,...mkShadow()},
  {id:"services",text:"SERVIZI INCLUSI NEL NOLEGGIO LUNGO TERMINE:\nASSICURAZIONI RCA, F&I, PAI & KASKO\nMANUTENZIONE ORDINARIA & STRAORDINARIA\nASSISTENZA STRADALE 24/7",x:500,y:900,fontSize:16,fontFamily:"Montserrat",fontWeight:"600",color:"#FFFFFF",highlightLines:[1,2,3],highlightColor:"#00BCD4",textAlign:"center",visible:true,...mkShadow()},
];

const HAS_HTML = s => /<\s*(\/?(?:b|u|i|color|br|span|strong|em|font))\b/i.test(s || "");
const HTML_PREP = s => (s || "").replace(/<br\s*\/?>/gi, "\n");
function parseInline(text) {
  const out = []; const stack = []; let buf = ""; let i = 0;
  const cur = () => { const r = { bold: false, italic: false, underline: false, color: null }; stack.forEach(s => { if (s.bold) r.bold = true; if (s.italic) r.italic = true; if (s.underline) r.underline = true; if (s.color) r.color = s.color; }); return r; };
  const flush = () => { if (buf) { out.push({ text: buf, ...cur() }); buf = ""; } };
  // Parse style="color:#xxx;font-weight:bold;text-decoration:underline;font-style:italic"
  const parseStyle = styleStr => {
    const r = {};
    if (!styleStr) return r;
    styleStr.split(";").forEach(decl => {
      const idx = decl.indexOf(":");
      if (idx < 0) return;
      const k = decl.substring(0, idx).trim().toLowerCase();
      const v = decl.substring(idx + 1).trim();
      if (k === "color") r.color = v;
      if (k === "font-weight" && /^(bold|[6-9]00)$/i.test(v)) r.bold = true;
      if (k === "text-decoration" && /underline/i.test(v)) r.underline = true;
      if (k === "font-style" && /italic/i.test(v)) r.italic = true;
    });
    return r;
  };
  // Parse all attributes from a tag body like: span style="color:red" id="x"
  const parseAttrs = body => {
    const attrs = {};
    const re = /(\w[\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m;
    while ((m = re.exec(body))) {
      attrs[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
    }
    return attrs;
  };
  while (i < text.length) {
    if (text[i] === "<") {
      const end = text.indexOf(">", i);
      if (end > i) {
        const body = text.substring(i + 1, end).trim();
        const close = body.startsWith("/");
        const inner = close ? body.slice(1).trim() : body;
        // Tag name = first word
        const nameMatch = inner.match(/^(\w+)/);
        if (nameMatch) {
          const name = nameMatch[1].toLowerCase();
          if (["b", "i", "u", "color", "span", "strong", "em", "font"].includes(name)) {
            flush();
            if (close) {
              for (let j = stack.length - 1; j >= 0; j--) if (stack[j]._n === name) { stack.splice(j, 1); break; }
            } else {
              const it = { _n: name };
              if (name === "b" || name === "strong") it.bold = true;
              if (name === "i" || name === "em") it.italic = true;
              if (name === "u") it.underline = true;
              const attrBody = inner.substring(nameMatch[1].length).trim();
              if (name === "color") {
                // <color="#xxx"> or <color=#xxx>
                const m2 = attrBody.match(/^=\s*"?([^"\s>]+)"?/);
                if (m2) it.color = m2[1];
              } else if (attrBody) {
                const attrs = parseAttrs(attrBody);
                if (attrs.color) it.color = attrs.color;
                if (attrs.style) {
                  const st = parseStyle(attrs.style);
                  if (st.color) it.color = st.color;
                  if (st.bold) it.bold = true;
                  if (st.underline) it.underline = true;
                  if (st.italic) it.italic = true;
                }
              }
              stack.push(it);
            }
            i = end + 1; continue;
          }
        }
      }
    }
    buf += text[i++];
  }
  flush();
  return out;
}
function drawTokens(ctx, el, tokens, x, y) {
  const fontFor = t => `${t.italic ? "italic " : ""}${pickWeight(el.fontFamily, t.bold ? "900" : el.fontWeight)} ${el.fontSize}px "${el.fontFamily}",sans-serif`;
  let totalW = 0;
  tokens.forEach(t => { ctx.font = fontFor(t); totalW += ctx.measureText(t.text).width; });
  let sx = x;
  if (el.textAlign === "center") sx = x - totalW / 2;
  else if (el.textAlign === "right") sx = x - totalW;
  const savedAlign = ctx.textAlign; ctx.textAlign = "left";
  let cx = sx;
  tokens.forEach(t => {
    ctx.font = fontFor(t);
    ctx.fillStyle = t.color || el.color;
    ctx.fillText(t.text, cx, y);
    const w = ctx.measureText(t.text).width;
    if (t.underline) {
      ctx.strokeStyle = t.color || el.color;
      ctx.lineWidth = Math.max(1, el.fontSize * 0.06);
      const uy = y + el.fontSize * 0.4;
      ctx.beginPath(); ctx.moveTo(cx, uy); ctx.lineTo(cx + w, uy); ctx.stroke();
    }
    cx += w;
  });
  ctx.textAlign = savedAlign;
}

function draw(ctx,els,bg,car,logo,bgC,ov,cP,lP,extras,globalExtras=[],watermarkImg=null,wmOpacity=0.05,wmScale=1,wmX=500,wmY=500){
  ctx.clearRect(0,0,CW,CH);ctx.fillStyle=bgC;ctx.fillRect(0,0,CW,CH);
  if(bg){const s=Math.max(CW/bg.width,CH/bg.height);ctx.drawImage(bg,(CW-bg.width*s)/2,(CH-bg.height*s)/2,bg.width*s,bg.height*s);ctx.globalAlpha=ov;ctx.fillStyle=bgC;ctx.fillRect(0,0,CW,CH);ctx.globalAlpha=1;}
  if(logo){const w=logo.width*lP.scale,h=logo.height*lP.scale;ctx.drawImage(logo,lP.x-w/2,lP.y-h/2,w,h);}
  els.forEach(el=>{
    if(!el.visible)return;ctx.save();
    ctx.font=`${pickWeight(el.fontFamily,el.fontWeight)} ${el.fontSize}px "${el.fontFamily}",sans-serif`;ctx.textAlign=el.textAlign||"center";ctx.textBaseline="middle";
    if(el.shadowEnabled){ctx.shadowColor=el.shadowColor||"rgba(0,0,0,0.8)";ctx.shadowBlur=el.shadowBlur||0;ctx.shadowOffsetX=el.shadowOffsetX||0;ctx.shadowOffsetY=el.shadowOffsetY||0;}else{ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
    if(el.id==="services"){HTML_PREP(el.text).split("\n").forEach((l,i)=>{const h=el.highlightLines?.includes(i);ctx.font=`${pickWeight(el.fontFamily,h?"700":el.fontWeight)} ${el.fontSize}px "${el.fontFamily}",sans-serif`;const baseColor=h?(el.highlightColor||"#00BCD4"):el.color;if(HAS_HTML(l)){const tokens=parseInline(l);drawTokens(ctx,{...el,color:baseColor,fontWeight:h?"700":el.fontWeight},tokens,el.x,el.y+i*(el.fontSize+6));}else{ctx.fillStyle=baseColor;ctx.fillText(l,el.x,el.y+i*(el.fontSize+6));}});ctx.restore();return;}
    if(el.pillStyle){
      const _hasHtml=HAS_HTML(el.text);
      let tw;
      let _tokens=null;
      if(_hasHtml){
        _tokens=parseInline(HTML_PREP(el.text));
        tw=0;
        const fontFor=t=>`${t.italic?"italic ":""}${pickWeight(el.fontFamily,t.bold?"900":el.fontWeight)} ${el.fontSize}px "${el.fontFamily}",sans-serif`;
        _tokens.forEach(t=>{ctx.font=fontFor(t);tw+=ctx.measureText(t.text).width;});
      } else {
        tw=ctx.measureText(el.text).width;
      }
      const ph=el.fontSize+16,pw=tw+40,rx=el.textAlign==="center"?el.x-pw/2:el.x;
      ctx.fillStyle=el.bgColor||"#1a1a2e";ctx.beginPath();const r=6;ctx.moveTo(rx+r,el.y-ph/2);ctx.lineTo(rx+pw-r,el.y-ph/2);ctx.quadraticCurveTo(rx+pw,el.y-ph/2,rx+pw,el.y-ph/2+r);ctx.lineTo(rx+pw,el.y+ph/2-r);ctx.quadraticCurveTo(rx+pw,el.y+ph/2,rx+pw-r,el.y+ph/2);ctx.lineTo(rx+r,el.y+ph/2);ctx.quadraticCurveTo(rx,el.y+ph/2,rx,el.y+ph/2-r);ctx.lineTo(rx,el.y-ph/2+r);ctx.quadraticCurveTo(rx,el.y-ph/2,rx+r,el.y-ph/2);ctx.closePath();ctx.fill();
      if(_hasHtml){
        drawTokens(ctx,el,_tokens,el.x,el.y);
      } else if(el.highlightWord){const parts=el.text.split("–").map(s=>s.trim());if(parts.length===2){const p1=parts[0]+" – ",sx=el.textAlign==="center"?el.x-tw/2:el.x;ctx.textAlign="left";ctx.fillStyle=el.color;ctx.fillText(p1,sx,el.y);ctx.fillStyle=el.highlightColor||"#00BCD4";ctx.fillText(parts[1],sx+ctx.measureText(p1).width,el.y);}else{ctx.fillStyle=el.color;ctx.fillText(el.text,el.x,el.y);}}else{ctx.fillStyle=el.color;ctx.fillText(el.text,el.x,el.y);}
      ctx.restore();return;
    }
    if(HAS_HTML(el.text)){const lines=HTML_PREP(el.text).split("\n");const lineH=el.fontSize+6;const baseY=el.y-(lines.length-1)*lineH/2;lines.forEach((line,i)=>{const tokens=parseInline(line);drawTokens(ctx,el,tokens,el.x,baseY+i*lineH);});}else if(el.highlightWord){const _hw=(el.highlightWord||"").trim();const _norm=s=>(s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();const idxI=_hw?_norm(el.text).indexOf(_norm(_hw)):-1;let before,hl,after;if(idxI>=0){before=el.text.substring(0,idxI);hl=el.text.substring(idxI,idxI+_hw.length);after=el.text.substring(idxI+_hw.length);}else if(_hw){before=el.text+(el.text?" ":"");hl=_hw;after="";}else{ctx.fillStyle=el.color;ctx.fillText(el.text,el.x,el.y);ctx.restore();return;}const bw=ctx.measureText(before).width,hw=ctx.measureText(hl).width,aw=ctx.measureText(after).width;const fw=bw+hw+aw;const sx=el.textAlign==="center"?el.x-fw/2:(el.textAlign==="right"?el.x-fw:el.x);ctx.textAlign="left";ctx.fillStyle=el.color;if(before)ctx.fillText(before,sx,el.y);ctx.fillStyle=el.highlightColor||"#00BCD4";ctx.fillText(hl,sx+bw,el.y);ctx.fillStyle=el.color;if(after)ctx.fillText(after,sx+bw+hw,el.y);}else{ctx.fillStyle=el.color;ctx.fillText(el.text,el.x,el.y);}
    ctx.restore();
  });
  if(car){const w=car.width*cP.scale,h=car.height*cP.scale;ctx.drawImage(car,cP.x-w/2,cP.y-h/2,w,h);}
  if(extras&&extras.length){extras.forEach(ex=>{if(!ex.img)return;const w=ex.img.width*ex.scale,h=ex.img.height*ex.scale;ctx.drawImage(ex.img,ex.x-w/2,ex.y-h/2,w,h);});}
  if(globalExtras&&globalExtras.length){globalExtras.forEach(ex=>{if(!ex.img)return;const w=ex.img.width*ex.scale,h=ex.img.height*ex.scale;ctx.drawImage(ex.img,ex.x-w/2,ex.y-h/2,w,h);});}
  if(watermarkImg){ctx.save();ctx.globalAlpha=wmOpacity;const ww=watermarkImg.width*(wmScale||1),wh=watermarkImg.height*(wmScale||1);ctx.drawImage(watermarkImg,(wmX||CW/2)-ww/2,(wmY||CH/2)-wh/2,ww,wh);ctx.restore();}
}
function drawGuides(ctx){
  ctx.save();
  ctx.setLineDash([10,5]);ctx.lineWidth=2;ctx.strokeStyle="rgba(0,188,212,0.7)";
  /* Left */
  ctx.beginPath();ctx.moveTo(GL,0);ctx.lineTo(GL,CH);ctx.stroke();
  /* Right */
  ctx.beginPath();ctx.moveTo(GR,0);ctx.lineTo(GR,CH);ctx.stroke();
  /* Top */
  ctx.beginPath();ctx.moveTo(0,GT);ctx.lineTo(CW,GT);ctx.stroke();
  /* Bottom */
  ctx.beginPath();ctx.moveTo(0,GB);ctx.lineTo(CW,GB);ctx.stroke();
  /* Center vertical */
  ctx.lineWidth=1;ctx.strokeStyle="rgba(0,188,212,0.35)";ctx.setLineDash([6,6]);
  ctx.beginPath();ctx.moveTo(CW/2,0);ctx.lineTo(CW/2,CH);ctx.stroke();
  /* Labels */
  ctx.setLineDash([]);ctx.font='bold 11px sans-serif';ctx.fillStyle="rgba(0,188,212,0.55)";ctx.textAlign="left";ctx.textBaseline="top";
  ctx.fillText("L",GL+4,GT+4);ctx.textAlign="right";ctx.fillText("R",GR-4,GT+4);
  ctx.textAlign="center";ctx.fillText("C",CW/2,GT+4);
  ctx.textAlign="left";ctx.fillText("B",GL+4,GB-16);
  ctx.restore();
}
function readFile(file){return new Promise(res=>{const r=new FileReader();r.onload=ev=>{const img=new Image();img.onload=()=>res({img,dataUrl:ev.target.result});img.src=ev.target.result;};r.readAsDataURL(file);});}
async function parseAI(text, apiKey){
  if(!apiKey) throw new Error("Inserisci la tua API key Anthropic nelle impostazioni (Setup)");
  try{
    const prompt = `Sei un assistente per un'azienda di noleggio auto a lungo termine. Dal seguente testo, estrai i dati dell'offerta auto.
Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick, senza altro testo. I campi sono:
- "carName": nome completo dell'auto in MAIUSCOLO (es. "MERCEDES GLC COUPÉ")
- "highlightWord": la parte del nome da evidenziare, tipicamente il modello (es. "GLC COUPÉ")
- "specs": versione/motorizzazione/allestimento in MAIUSCOLO (es. "220D MHEV 4MATIC ADVANCED PLUS")
- "duration": durata e chilometri nel formato "XX MESI – XX.XXX KM"
- "deposit": anticipo nel formato "ANTICIPO X.XXX€ I.E."
- "price": solo il numero del canone mensile (es. "689")
Se un campo non è presente nel testo, usa stringa vuota "".

Testo:
${text}`;

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
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(()=>({}));
      throw new Error(errBody?.error?.message || "API " + res.status);
    }
    const d = await res.json();
    if (d.error) throw new Error(d.error.message || "API error");
    const raw = (d.content || []).map(c => c.text || "").join("");
    if (!raw) throw new Error("Risposta vuota");
    const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(clean);
  } catch(err) {
    console.error("parseAI error:", err);
    throw err;
  }
}
const makeFilename=(name,price,num)=>{const n=new Date(),dd=String(n.getDate()).padStart(2,"0"),mm=String(n.getMonth()+1).padStart(2,"0"),yy=n.getFullYear(),hh=String(n.getHours()).padStart(2,"0"),mi=String(n.getMinutes()).padStart(2,"0");const prefix=num!=null?`${num}.`:"";return`${prefix}${(name||"auto").replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ]/g,"_").replace(/_+/g,"_")}_${(price||"0").replace(/[^0-9]/g,"")}_${dd}-${mm}-${yy}_${hh}-${mi}.png`;};

/* ===== LIVE PREVIEW CANVAS (per-offer) ===== */
function LiveCanvas({offer,elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,logoPos,showGuides,onDragCar,onDragExtra,globalExtras=[],watermarkImg=null,wmOpacity=0.05,wmScale=1,wmX=500,wmY=500}){
  const ref=useRef(null);
  const [drag,setDrag]=useState(null);
  const [ds,setDs]=useState(null);
  const buildEls=useCallback(()=>elements.map(el=>{
    if(el.id==="carName"){const cn=!!offer.carName;return{...el,text:offer.carName||el.text,highlightWord:offer.highlightWord||(cn?"":el.highlightWord)};}
    if(el.id==="specs")return{...el,text:offer.specs||el.text};
    if(el.id==="duration")return{...el,text:offer.duration||el.text};
    if(el.id==="deposit")return{...el,text:offer.deposit||el.text};
    if(el.id==="price")return{...el,text:offer.price||el.text};
    return el;
  }),[offer,elements]);
  useEffect(()=>{
    const c=ref.current;if(!c)return;const ctx=c.getContext("2d");
    draw(ctx,buildEls(),bgImage,offer.carImg||carImage,logoImage,bgColor,overlayOpacity,{x:offer.carX,y:offer.carY,scale:offer.carScale},logoPos,offer.extras,globalExtras,watermarkImg,wmOpacity,wmScale,wmX,wmY);
    if(showGuides)drawGuides(ctx);
  },[offer,elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,logoPos,buildEls,showGuides,globalExtras,watermarkImg,wmOpacity,wmScale,wmX,wmY]);
  const coords=e=>{const c=ref.current,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*CW/r.width,y:(e.clientY-r.top)*CH/r.height};};
  const onDown=e=>{const p=coords(e);
    /* extras: check top-to-bottom (last = top) */
    if(offer.extras&&offer.extras.length){for(let i=offer.extras.length-1;i>=0;i--){const ex=offer.extras[i];if(!ex.img)continue;const w=ex.img.width*ex.scale,h=ex.img.height*ex.scale;if(p.x>ex.x-w/2&&p.x<ex.x+w/2&&p.y>ex.y-h/2&&p.y<ex.y+h/2){setDrag({type:"extra",idx:i});setDs({x:p.x-ex.x,y:p.y-ex.y});return;}}}
    const car=offer.carImg||carImage;if(car){const w=car.width*offer.carScale,h=car.height*offer.carScale;if(p.x>offer.carX-w/2&&p.x<offer.carX+w/2&&p.y>offer.carY-h/2&&p.y<offer.carY+h/2){setDrag({type:"car"});setDs({x:p.x-offer.carX,y:p.y-offer.carY});}}};
  const onMove=e=>{if(!drag)return;const p=coords(e);if(drag.type==="extra"&&onDragExtra){onDragExtra(drag.idx,Math.round(p.x-ds.x),Math.round(p.y-ds.y));}else if(drag.type==="car"){onDragCar(Math.round(p.x-ds.x),Math.round(p.y-ds.y));}};
  const onUp=()=>{setDrag(null);setDs(null);};
  return <canvas ref={ref} width={CW} height={CH} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto",borderRadius:8,cursor:drag?"grabbing":"default",boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}/>;
}

/* ===== APP ===== */
export default function App(){
  const canvasRef=useRef(null);
  const [elements,setElements]=useState(makeEls);
  const [bgImage,setBgImage]=useState(null);
  const [carImage,setCarImage]=useState(null);
  const [carPos,setCarPos]=useState({x:500,y:620,scale:0.85});
  const [logoImage,setLogoImage]=useState(null);
  const [logoPos,setLogoPos]=useState({x:500,y:45,scale:0.3});
  const [bgColor,setBgColor]=useState("#0d0d1a");
  const [overlayOpacity,setOverlayOpacity]=useState(0.55);
  const [selectedEl,setSelectedEl]=useState(null);
  const [tab,setTab]=useState("setup");
  const [accCampi,setAccCampi]=useState(true);
  const [accElementi,setAccElementi]=useState(false);
  const [fontsLoaded,setFontsLoaded]=useState(false);
  const [dragging,setDragging]=useState(null);
  const [dragStart,setDragStart]=useState(null);
  const [offers,setOffers]=useState([]);
  const [activeOfferId,setActiveOfferId]=useState(null);
  const [waText,setWaText]=useState("");
  const [waParsing,setWaParsing]=useState(false);
  const [waError,setWaError]=useState("");
  const [showGuides,setShowGuides]=useState(true);
  const [customFonts,setCustomFonts]=useState([]);
  const customFontsLoadedRef=useRef(false);
  const [apiKey,setApiKey]=useState(()=>localStorage.getItem("anthropic_api_key")||"");
  const [colorPresets,setColorPresets]=useState(()=>{try{const s=localStorage.getItem("colorPresets");return s?JSON.parse(s):DEFAULT_COLOR_PRESETS;}catch{return DEFAULT_COLOR_PRESETS;}});
  const [newPresetColor,setNewPresetColor]=useState("#00BCD4");
  const [newPresetName,setNewPresetName]=useState("");
  const [globalExtras,setGlobalExtras]=useState([]);
  const [watermarkImg,setWatermarkImg]=useState(null);
  const [wmOpacity,setWmOpacity]=useState(0.05);
  const [wmScale,setWmScale]=useState(1);
  const [wmX,setWmX]=useState(500);
  const [wmY,setWmY]=useState(500);
  const [accSfondo,setAccSfondo]=useState(true);
  const [accLogo,setAccLogo]=useState(false);
  const [accExtras,setAccExtras]=useState(false);
  const [accWm,setAccWm]=useState(false);

  // Persist API key and color presets
  useEffect(()=>{localStorage.setItem("anthropic_api_key",apiKey);},[apiKey]);
  useEffect(()=>{localStorage.setItem("colorPresets",JSON.stringify(colorPresets));},[colorPresets]);

  // UNDO
  const histRef=useRef([]);const redoRef=useRef([]);const isUndo=useRef(false);
  const snap=useCallback(()=>{if(isUndo.current)return;const s=JSON.stringify({elements,offers:offers.map(o=>({...o,carImg:null,carThumb:o.carThumb})),carPos,logoPos,bgColor,overlayOpacity});const h=histRef.current;if(!h.length||h[h.length-1]!==s){h.push(s);if(h.length>100)h.shift();redoRef.current=[];}},[elements,offers,carPos,logoPos,bgColor,overlayOpacity]);
  const snapT=useRef(null);
  useEffect(()=>{if(snapT.current)clearTimeout(snapT.current);snapT.current=setTimeout(snap,250);},[snap]);
  const undo=useCallback(()=>{const h=histRef.current;if(h.length<2)return;const popped=h.pop();redoRef.current.push(popped);if(redoRef.current.length>100)redoRef.current.shift();const prev=h[h.length-1];if(!prev)return;isUndo.current=true;try{const s=JSON.parse(prev);setElements(s.elements);setOffers(old=>{const m={};old.forEach(o=>{m[o.id]=o.carImg;});return s.offers.map(o=>({...o,carImg:m[o.id]||null}));});setCarPos(s.carPos);setLogoPos(s.logoPos);setBgColor(s.bgColor);setOverlayOpacity(s.overlayOpacity);}catch(e){}setTimeout(()=>{isUndo.current=false;},100);},[]);
  const redo=useCallback(()=>{const r=redoRef.current;if(!r.length)return;const next=r.pop();if(!next)return;histRef.current.push(next);isUndo.current=true;try{const s=JSON.parse(next);setElements(s.elements);setOffers(old=>{const m={};old.forEach(o=>{m[o.id]=o.carImg;});return s.offers.map(o=>({...o,carImg:m[o.id]||null}));});setCarPos(s.carPos);setLogoPos(s.logoPos);setBgColor(s.bgColor);setOverlayOpacity(s.overlayOpacity);}catch(e){}setTimeout(()=>{isUndo.current=false;},100);},[]);
  useEffect(()=>{const h=e=>{const tag=(e.target&&e.target.tagName)||"";const isField=tag==="INPUT"||tag==="TEXTAREA"||(e.target&&e.target.isContentEditable);const cmd=e.ctrlKey||e.metaKey;if(cmd&&e.key==="z"&&!e.shiftKey){if(isField)return;e.preventDefault();undo();return;}if(cmd&&(e.key==="y"||(e.key==="z"&&e.shiftKey))){if(isField)return;e.preventDefault();redo();return;}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[undo,redo]);
  // Snapshot iniziale all'avvio (per poter annullare la prima modifica)
  useEffect(()=>{const t=setTimeout(()=>{if(histRef.current.length===0)snap();},150);return()=>clearTimeout(t);// eslint-disable-next-line
  },[]);

  useEffect(()=>{const l=document.createElement("link");l.href="https://fonts.googleapis.com/css2?"+Object.entries(FONT_DB).map(([n,ws])=>`family=${n.replace(/ /g,"+")}:wght@${ws.join(";")}`).join("&")+"&display=swap";l.rel="stylesheet";document.head.appendChild(l);document.fonts.ready.then(()=>setFontsLoaded(true));},[]);

  const getEl=id=>elements.find(e=>e.id===id);
  const setEl=(id,k,v)=>setElements(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));

  // Single canvas
  useEffect(()=>{if(isBatch)return;const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");draw(ctx,elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,carPos,logoPos,null,globalExtras,watermarkImg,wmOpacity,wmScale,wmX,wmY);if(showGuides)drawGuides(ctx);},[elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,carPos,logoPos,fontsLoaded,showGuides,tab,globalExtras,watermarkImg,wmOpacity,wmScale,wmX,wmY]);

  const loadImg=async(setter,e)=>{const f=e.target.files[0];if(!f)return;const{img}=await readFile(f);setter(img);};
  const uploadFont=async(e)=>{
    const files=Array.from(e.target.files||[]);
    for(const file of files){
      try{
        const name=file.name.replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_\- ]/g,"_");
        const buf=await file.arrayBuffer();
        const face=new FontFace(name,buf);
        await face.load();
        document.fonts.add(face);
        setCustomFonts(p=>p.find(x=>x.name===name)?p:[...p,{name,face,buffer:buf}]);
      }catch(err){console.error("Font load error:",file.name,err);alert("Impossibile caricare il font "+file.name+": "+err.message);}
    }
    e.target.value="";
  };
  const removeCustomFont=(name)=>{setCustomFonts(p=>{const it=p.find(x=>x.name===name);if(it&&it.face){try{document.fonts.delete(it.face);}catch{}}return p.filter(x=>x.name!==name);});setElements(p=>p.map(el=>el.fontFamily===name?{...el,fontFamily:"Montserrat"}:el));};
  const renameCustomFont=async(oldName,raw)=>{
    const newName=(raw||"").trim().replace(/[^a-zA-Z0-9_\- ]/g,"_");
    if(!newName||newName===oldName)return;
    if(customFonts.find(f=>f.name===newName)){alert("Esiste gia un font con questo nome: "+newName);return;}
    const item=customFonts.find(f=>f.name===oldName);
    if(!item||!item.buffer){alert("Impossibile rinominare: dati font mancanti");return;}
    try{
      const newFace=new FontFace(newName,item.buffer);
      await newFace.load();
      document.fonts.add(newFace);
      if(item.face){try{document.fonts.delete(item.face);}catch{}}
      setCustomFonts(p=>p.map(f=>f.name===oldName?{name:newName,face:newFace,buffer:item.buffer}:f));
      setElements(p=>p.map(el=>el.fontFamily===oldName?{...el,fontFamily:newName}:el));
    }catch(err){alert("Impossibile rinominare il font: "+err.message);}
  };
  const applyFontToAll=(family)=>{if(!family)return;setElements(p=>p.map(el=>({...el,fontFamily:family})));};
  // ===== Persistenza custom font (localStorage + export/import) =====
  const _bufToB64=buf=>{let s="";const arr=new Uint8Array(buf);for(let i=0;i<arr.length;i++)s+=String.fromCharCode(arr[i]);return btoa(s);};
  const _b64ToBuf=b64=>{const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return arr.buffer;};
  // Load saved fonts on first mount
  useEffect(()=>{
    if(customFontsLoadedRef.current)return;
    customFontsLoadedRef.current=true;
    try{
      const raw=localStorage.getItem("customFonts");
      if(!raw)return;
      const arr=JSON.parse(raw);
      (async()=>{
        for(const it of arr){
          try{
            const buf=_b64ToBuf(it.base64);
            const face=new FontFace(it.name,buf);
            await face.load();
            document.fonts.add(face);
            setCustomFonts(p=>p.find(x=>x.name===it.name)?p:[...p,{name:it.name,face,buffer:buf}]);
          }catch(err){console.warn("Font ricaricato non valido:",it.name,err);}
        }
      })();
    }catch(err){console.warn("Errore lettura localStorage customFonts:",err);}
  },[]);
  // Auto-save when customFonts changes (skip first render)
  const _firstSaveSkipRef=useRef(true);
  useEffect(()=>{
    if(_firstSaveSkipRef.current){_firstSaveSkipRef.current=false;return;}
    try{
      const data=customFonts.map(({name,buffer})=>({name,base64:buffer?_bufToB64(buffer):""})).filter(x=>x.base64);
      localStorage.setItem("customFonts",JSON.stringify(data));
    }catch(err){
      if(err&&err.name==="QuotaExceededError"){alert("Spazio storage esaurito. Esporta i font in un file JSON e/o rimuovi quelli inutilizzati.");}
      else{console.warn("Salvataggio font fallito:",err);}
    }
  },[customFonts]);
  // Export all custom fonts to JSON file
  const exportFonts=()=>{
    if(customFonts.length===0){alert("Nessun font personalizzato da esportare.");return;}
    const data=customFonts.map(({name,buffer})=>({name,base64:buffer?_bufToB64(buffer):""})).filter(x=>x.base64);
    const blob=new Blob([JSON.stringify({version:1,fonts:data},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    const ts=new Date().toISOString().slice(0,10);
    a.href=url;a.download=`car-offer-fonts_${ts}.json`;
    document.body.appendChild(a);a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);
  };
  // Import fonts from JSON file
  const importFonts=async(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    try{
      const text=await file.text();
      const obj=JSON.parse(text);
      const arr=obj.fonts||obj;
      if(!Array.isArray(arr))throw new Error("Formato non valido");
      let added=0,skipped=0;
      for(const it of arr){
        if(!it.name||!it.base64){skipped++;continue;}
        if(customFonts.find(x=>x.name===it.name)){skipped++;continue;}
        try{
          const buf=_b64ToBuf(it.base64);
          const face=new FontFace(it.name,buf);
          await face.load();
          document.fonts.add(face);
          setCustomFonts(p=>p.find(x=>x.name===it.name)?p:[...p,{name:it.name,face,buffer:buf}]);
          added++;
        }catch(err){skipped++;console.warn("Errore import font",it.name,err);}
      }
      alert(`Import completato: ${added} font aggiunti, ${skipped} saltati (gia presenti o invalidi).`);
    }catch(err){alert("File non valido: "+err.message);}
    e.target.value="";
  };
  const loadCarImg=async(e)=>{const f=e.target.files[0];if(!f)return;const{img}=await readFile(f);setCarImage(img);autoFitCar(img);};
  const autoFitCar=(img)=>{const s=(GR-GL)/img.width;const cy=GB-(img.height*s)/2;setCarPos({x:(GL+GR)/2,y:cy,scale:s});};
  const buildEls=(o)=>elements.map(el=>{if(el.id==="carName"){const cn=!!o.carName;return{...el,text:o.carName||el.text,highlightWord:o.highlightWord||(cn?"":el.highlightWord)};}if(el.id==="specs")return{...el,text:o.specs||el.text};if(el.id==="duration")return{...el,text:o.duration||el.text};if(el.id==="deposit")return{...el,text:o.deposit||el.text};if(el.id==="price")return{...el,text:o.price||el.text};return el;});


  // Canvas drag (single mode)
  const coords=e=>{const c=canvasRef.current,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*CW/r.width,y:(e.clientY-r.top)*CH/r.height};};
  const onDown=e=>{const p=coords(e);if(logoImage){const w=logoImage.width*logoPos.scale,h=logoImage.height*logoPos.scale;if(p.x>logoPos.x-w/2&&p.x<logoPos.x+w/2&&p.y>logoPos.y-h/2&&p.y<logoPos.y+h/2){setDragging("logo");setDragStart({x:p.x-logoPos.x,y:p.y-logoPos.y});return;}}if(carImage){const w=carImage.width*carPos.scale,h=carImage.height*carPos.scale;if(p.x>carPos.x-w/2&&p.x<carPos.x+w/2&&p.y>carPos.y-h/2&&p.y<carPos.y+h/2){setDragging("car");setDragStart({x:p.x-carPos.x,y:p.y-carPos.y});return;}}if(watermarkImg){const ww=watermarkImg.width*wmScale,wh=watermarkImg.height*wmScale;if(p.x>wmX-ww/2&&p.x<wmX+ww/2&&p.y>wmY-wh/2&&p.y<wmY+wh/2){setDragging("watermark");setDragStart({x:p.x-wmX,y:p.y-wmY});return;}}for(let i=globalExtras.length-1;i>=0;i--){const ex=globalExtras[i];if(!ex.img)continue;const w=ex.img.width*ex.scale,h=ex.img.height*ex.scale;if(p.x>ex.x-w/2&&p.x<ex.x+w/2&&p.y>ex.y-h/2&&p.y<ex.y+h/2){setDragging("gex_"+i);setDragStart({x:p.x-ex.x,y:p.y-ex.y});return;}}for(const el of[...elements].reverse()){if(!el.visible)continue;const ctx=canvasRef.current.getContext("2d");ctx.font=`${pickWeight(el.fontFamily,el.fontWeight)} ${el.fontSize}px "${el.fontFamily}",sans-serif`;const lines=el.text.split("\n"),mw=Math.max(...lines.map(l=>ctx.measureText(l).width)),th=lines.length*(el.fontSize+6);let ex=el.x;if(el.textAlign==="center")ex=el.x-mw/2;else if(el.textAlign==="right")ex=el.x-mw;if(p.x>ex-10&&p.x<ex+mw+10&&p.y>el.y-th/2-10&&p.y<el.y+th/2+10){setDragging(el.id);setDragStart({x:p.x-el.x,y:p.y-el.y});setSelectedEl(el.id);setTab("stile");return;}}};
  const onMove=e=>{if(!dragging)return;const pt=coords(e);if(dragging==="logo")setLogoPos(v=>({...v,x:pt.x-dragStart.x,y:pt.y-dragStart.y}));else if(dragging==="car")setCarPos(v=>({...v,x:pt.x-dragStart.x,y:pt.y-dragStart.y}));else if(dragging==="watermark"){setWmX(Math.round(pt.x-dragStart.x));setWmY(Math.round(pt.y-dragStart.y));}else if(dragging.startsWith("gex_")){const i=+dragging.split("_")[1];setGlobalExtras(prev=>prev.map((ex,idx)=>idx===i?{...ex,x:Math.round(pt.x-dragStart.x),y:Math.round(pt.y-dragStart.y)}:ex));}else{setEl(dragging,"x",Math.round(pt.x-dragStart.x));setEl(dragging,"y",Math.round(pt.y-dragStart.y));}};
  const onUp=()=>{setDragging(null);setDragStart(null);};

  // BATCH
  const updOffer=(id,k,v)=>setOffers(p=>p.map(o=>o.id===id?{...o,[k]:v}:o));
  const handleOfferCar=async(id,e)=>{const f=e.target.files[0];if(!f)return;const{img,dataUrl}=await readFile(f);const s=(GR-GL)/img.width;const cy=GB-(img.height*s)/2;setOffers(p=>p.map(o=>o.id===id?{...o,carImg:img,carThumb:dataUrl,carX:(GL+GR)/2,carY:cy,carScale:s}:o));};
  const removeOffer=id=>setOffers(p=>p.filter(o=>o.id!==id));
  const addExtra=async(offerId,e)=>{const f=e.target.files[0];if(!f)return;const{img,dataUrl}=await readFile(f);const ex={id:++_exId,img,thumb:dataUrl,x:500,y:500,scale:0.3};setOffers(p=>p.map(o=>o.id===offerId?{...o,extras:[...o.extras,ex]}:o));};
  const removeExtra=(offerId,exIdx)=>setOffers(p=>p.map(o=>o.id===offerId?{...o,extras:o.extras.filter((_,i)=>i!==exIdx)}:o));
  const updExtra=(offerId,exIdx,k,v)=>setOffers(p=>p.map(o=>o.id===offerId?{...o,extras:o.extras.map((ex,i)=>i===exIdx?{...ex,[k]:v}:ex)}:o));
  const QUALITY={ultra:{label:"Ultra HD",desc:"1500×1500px — massima qualità",size:1500,icon:"🔷"},hd:{label:"HD",desc:"1000×1000px — qualità standard",size:1000,icon:"🟢"},media:{label:"Media",desc:"700×700px — leggera",size:700,icon:"🟡"}};
  const [dlModal,setDlModal]=useState(null);
  const [dlProgress,setDlProgress]=useState(null);

  const renderImg=(o,sz)=>{
    const oc=document.createElement("canvas");oc.width=sz;oc.height=sz;
    const ctx=oc.getContext("2d");const s=sz/CW;ctx.scale(s,s);
    draw(ctx,buildEls(o),bgImage,o.carImg||carImage,logoImage,bgColor,overlayOpacity,{x:o.carX,y:o.carY,scale:o.carScale},logoPos,o.extras,globalExtras,watermarkImg,wmOpacity,wmScale,wmX,wmY);
    return oc.toDataURL("image/png");
  };
  const renderSingle=(sz)=>{
    const oc=document.createElement("canvas");oc.width=sz;oc.height=sz;
    const ctx=oc.getContext("2d");const s=sz/CW;ctx.scale(s,s);
    draw(ctx,elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,carPos,logoPos,null,globalExtras,watermarkImg,wmOpacity,wmScale,wmX,wmY);
    return oc.toDataURL("image/png");
  };

  const execDownload=(quality)=>{
    const sz=QUALITY[quality].size;
    if(dlModal.type==="single"){
      const d=renderSingle(sz);
      try{const a=document.createElement("a");a.download=makeFilename(getEl("carName")?.text,getEl("price")?.text);a.href=d;a.style.display="none";document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),200);}catch(e){}
      setDlModal(null);
    } else if(dlModal.type==="offer"){
      const{offer,num}=dlModal;
      const url=renderImg(offer,sz);
      try{const a=document.createElement("a");a.download=makeFilename(offer.carName,offer.price,num);a.href=url;a.style.display="none";document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),200);}catch(e){}
      setDlModal(null);
    } else if(dlModal.type==="all"){
      setDlModal(null);
      execDownloadAll(sz);
    }
  };

  const execDownloadAll=async(sz)=>{
    setDlProgress({c:0,t:offers.length});
    const files=[];
    for(let i=0;i<offers.length;i++){
      const o=offers[i];
      const url=renderImg(o,sz);
      const bytes=dataUrlToBytes(url);
      files.push({name:makeFilename(o.carName,o.price,i+1),data:bytes});
      setDlProgress({c:i+1,t:offers.length});
      await new Promise(r=>setTimeout(r,50));
    }
    setDlProgress({c:offers.length,t:offers.length,zipping:true});
    await new Promise(r=>setTimeout(r,100));
    const zipBytes=createZip(files);
    try{
      const blob=new Blob([zipBytes],{type:"application/zip"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");const now=new Date();const ds=`${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()}`;
      a.download=`offerte_${ds}.zip`;a.href=url;a.style.display="none";
      document.body.appendChild(a);a.click();setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
    }catch(e){
      let binary="";for(let i=0;i<zipBytes.length;i++)binary+=String.fromCharCode(zipBytes[i]);
      const b64=btoa(binary);const a=document.createElement("a");const now=new Date();const ds=`${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()}`;
      a.download=`offerte_${ds}.zip`;a.href=`data:application/zip;base64,${b64}`;a.style.display="none";
      document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),500);
    }
    setDlProgress(null);
  };

  // Minimal ZIP creator (STORE, no compression)
  const createZip=(files)=>{
    // files: [{name:string, data:Uint8Array}]
    const enc=new TextEncoder();
    const parts=[];const cdEntries=[];let offset=0;
    for(const f of files){
      const nameBytes=enc.encode(f.name);const data=f.data;
      const crc=crc32(data);
      // Local file header
      const lh=new Uint8Array(30+nameBytes.length);const lv=new DataView(lh.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0,true);lv.setUint16(8,0,true);
      lv.setUint16(10,0,true);lv.setUint16(12,0,true);lv.setUint32(14,crc,true);
      lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);
      lv.setUint16(26,nameBytes.length,true);lv.setUint16(28,0,true);
      lh.set(nameBytes,30);
      // Central directory entry
      const cd=new Uint8Array(46+nameBytes.length);const cv=new DataView(cd.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
      cv.setUint16(8,0,true);cv.setUint16(10,0,true);cv.setUint16(12,0,true);cv.setUint16(14,0,true);
      cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);
      cv.setUint16(28,nameBytes.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);
      cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);
      cv.setUint32(42,offset,true);cd.set(nameBytes,46);
      cdEntries.push(cd);
      parts.push(lh,data);offset+=lh.length+data.length;
    }
    const cdOffset=offset;let cdSize=0;
    for(const cd of cdEntries){parts.push(cd);cdSize+=cd.length;}
    // End of central directory
    const eocd=new Uint8Array(22);const ev=new DataView(eocd.buffer);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);
    ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
    ev.setUint32(12,cdSize,true);ev.setUint32(16,cdOffset,true);ev.setUint16(20,0,true);
    parts.push(eocd);
    const total=parts.reduce((s,p)=>s+p.length,0);
    const result=new Uint8Array(total);let pos=0;
    for(const p of parts){result.set(p,pos);pos+=p.length;}
    return result;
  };

  // CRC32
  const crc32=(data)=>{
    let crc=0xFFFFFFFF;
    const table=crc32.table||(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c;}crc32.table=t;return t;})();
    for(let i=0;i<data.length;i++)crc=(crc>>>8)^table[(crc^data[i])&0xFF];
    return(crc^0xFFFFFFFF)>>>0;
  };

  const dataUrlToBytes=(url)=>{
    const b64=url.split(",")[1];
    const bin=atob(b64);const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return bytes;
  };

  const addOffer=(afterId)=>{const o=newOffer();setOffers(p=>{if(!afterId)return[...p,o];const i=p.findIndex(x=>x.id===afterId);const n=[...p];n.splice(i+1,0,o);return n;});setActiveOfferId(o.id);};
  const addOffersFromBatch=(drafts)=>{if(!drafts||!drafts.length)return;const made=drafts.map(d=>({...newOffer(),...d}));setOffers(p=>[...p,...made]);setActiveOfferId(made[0].id);};
  const dupFromCurrent=()=>{const o=newOffer();o.carName=getEl("carName").text;o.highlightWord=getEl("carName").highlightWord||"";o.specs=getEl("specs").text;o.duration=getEl("duration").text;o.deposit=getEl("deposit").text;o.price=getEl("price").text;setOffers(p=>[...p,o]);setActiveOfferId(o.id);};
  const applyAccentColor=(color)=>{setElements(p=>p.map(e=>{const upd={};if(e.highlightColor!==undefined)upd.highlightColor=color;if(e.id==="price")upd.color=color;return{...e,...upd};}));};
  const saveColorPreset=()=>{if(!newPresetName.trim())return;const id="p"+Date.now();setColorPresets(p=>[...p,{id,label:newPresetName.trim(),accentColor:newPresetColor}]);setNewPresetName("");};
  const deleteColorPreset=(id)=>setColorPresets(p=>p.filter(x=>x.id!==id));
  const handleWa=async()=>{if(!waText.trim())return;setWaParsing(true);setWaError("");try{const p=await parseAI(waText,apiKey);if(p.carName)setEl("carName","text",p.carName);if(p.highlightWord)setEl("carName","highlightWord",p.highlightWord);if(p.specs)setEl("specs","text",p.specs);if(p.duration)setEl("duration","text",p.duration);if(p.deposit)setEl("deposit","text",p.deposit);if(p.price)setEl("price","text",p.price);setWaText("");}catch(err){console.error(err);setWaError("Errore: "+err.message);}setWaParsing(false);};
  const handleWaOffer=async(id,text)=>{if(!text.trim())return;setOffers(p=>p.map(o=>o.id===id?{...o,_parsing:true,_waError:""}:o));try{const p=await parseAI(text,apiKey);setOffers(pr=>pr.map(o=>o.id===id?{...o,carName:p.carName||o.carName,highlightWord:p.highlightWord||o.highlightWord,specs:p.specs||o.specs,duration:p.duration||o.duration,deposit:p.deposit||o.deposit,price:p.price||o.price,_parsing:false,_waText:""}:o));}catch(err){console.error(err);setOffers(p=>p.map(o=>o.id===id?{...o,_parsing:false,_waError:"Errore: "+err.message}:o));}};

  const sel=selectedEl?getEl(selectedEl):null;
  const isBatch=tab==="offerte";
  const activeOffer=isBatch?(offers.find(o=>o.id===activeOfferId)||offers[0]||null):null;
  const qf=[{id:"carName",label:"🚗 Nome Auto",ph:"es. MERCEDES GLC COUPÉ"},{id:"carName",key:"highlightWord",label:"✨ Evidenziata",ph:"es. GLC COUPÉ"},{id:"specs",label:"⚙️ Caratteristiche",ph:"es. 220D MHEV 4MATIC"},{id:"duration",label:"📅 Durata / KM",ph:"es. 48 MESI – 60.000 KM"},{id:"deposit",label:"💰 Anticipo",ph:"es. ANTICIPO 2.000€ I.E."},{id:"price",label:"🏷️ Canone",ph:"es. 689"},{id:"priceSuffix",label:"Suffisso",ph:"€/MESE"},{id:"priceNote",label:"Nota",ph:"IVA ESCLUSA"},{id:"header",label:"Intestazione",ph:"NOLEGGIO LUNGO TERMINE"}];

  return (
    <div style={{height:"100vh",overflow:"hidden",background:"#0a0a0f",color:"#e0e0e0",fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
        .inp{background:#14141f;border:1px solid #252538;color:#e0e0e0;padding:8px 10px;border-radius:6px;font-size:13px;width:100%;outline:none;transition:border .2s}.inp:focus{border-color:#00BCD4}
        textarea.inp{resize:vertical}select.inp{cursor:pointer}
        input[type="color"]{width:34px;height:30px;border:none;background:none;cursor:pointer;padding:0;border-radius:4px}
        .btn{padding:8px 14px;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-size:12px;transition:all .15s;letter-spacing:.3px}
        .bp{background:linear-gradient(135deg,#00BCD4,#0097A7);color:#fff}.bp:hover{filter:brightness(1.1)}
        .bs{background:#14141f;color:#aaa;border:1px solid #252538}.bs:hover{background:#1c1c30}
        .bd{background:#d32f2f22;color:#ef5350;border:1px solid #d32f2f44}.bd:hover{background:#d32f2f44}
        .bg{background:linear-gradient(135deg,#25D366,#128C7E);color:#fff}
        .tab{padding:10px 0;background:transparent;border:none;color:#555;cursor:pointer;font-size:12px;font-weight:600;border-bottom:2px solid transparent;text-align:center;transition:all .2s}.tab.on{color:#00BCD4;border-bottom-color:#00BCD4}
        .lbl{font-size:10px;color:#777;margin-bottom:3px;text-transform:uppercase;letter-spacing:.6px;font-weight:700}
        .row{display:flex;gap:8px;align-items:center}
        .card{background:#111119;border:1px solid #1e1e30;border-radius:9px;padding:12px;margin-bottom:10px}
        .fi{display:block;width:100%;padding:10px;margin-top:4px;background:#14141f;border:2px dashed #252538;border-radius:8px;color:#aaa;font-size:12px;cursor:pointer}.fi:hover{border-color:#00BCD4}
        .fi::file-selector-button{background:linear-gradient(135deg,#00BCD4,#0097A7);color:#fff;border:none;padding:6px 14px;border-radius:5px;font-weight:700;font-size:11px;cursor:pointer;margin-right:10px}
        .qf{background:#0f0f1a;border:1px solid #1e1e30;border-radius:8px;padding:9px 11px;margin-bottom:7px}.qf:focus-within{border-color:#00BCD4}
        .qf .ql{font-size:10px;color:#777;font-weight:600;margin-bottom:3px}
        .qf input,.qf textarea{background:transparent;border:none;color:#fff;font-size:13px;width:100%;outline:none;font-weight:600}
        .qf input::placeholder,.qf textarea::placeholder{color:#3a3a50;font-weight:400}
        .elitem{padding:7px 10px;border-radius:6px;cursor:pointer;font-size:12px;display:flex;justify-content:space-between;align-items:center}.elitem:hover{background:#14141f}.elitem.on{background:#14141f;border-left:3px solid #00BCD4}
        .offer-form{display:flex;flex-direction:column;gap:6px}
        .offer-form .ofi{margin-bottom:2px}
        .offer-form .ofi label{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:1px}
        .offer-form .ofi input{background:#0a0a14;border:1px solid #1e1e30;color:#ddd;padding:7px 9px;border-radius:6px;font-size:12px;width:100%;outline:none;font-weight:600}.offer-form .ofi input:focus{border-color:#00BCD4}
        .offer-num{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#00BCD4,#0097A7);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#fff;flex-shrink:0}
        .add-btn{border:2px dashed #252538;border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:16px;color:#555;font-size:13px;font-weight:600}
        .add-btn:hover{border-color:#00BCD4;color:#00BCD4;background:#00BCD408}
      `}</style>

      {/* HEADER */}
      <div style={{padding:"10px 18px",background:"#0d0d16",borderBottom:"1px solid #1a1a28",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:7,background:"linear-gradient(135deg,#00BCD4,#0097A7)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:15,color:"#fff"}}>O</div>
          <span style={{fontWeight:700,fontSize:15}}>Offer Creator</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="btn bs" style={{fontSize:11,padding:"7px 12px"}} onClick={undo} title="Ctrl+Z (annulla)">↩ Annulla</button>
          <button className="btn bs" style={{fontSize:11,padding:"7px 12px"}} onClick={redo} title="Ctrl+Y o Ctrl+Shift+Z (ripeti)">↪ Ripeti</button>
          <button className={`btn ${showGuides?"bp":"bs"}`} style={{fontSize:11,padding:"7px 12px"}} onClick={()=>setShowGuides(!showGuides)}>📐{showGuides?" ON":" OFF"}</button>
          {!isBatch&&<button className="btn bp" onClick={()=>setDlModal({type:"single"})} style={{fontSize:12,padding:"9px 18px"}}>⬇ Scarica</button>}
          {isBatch&&offers.length>0&&!dlProgress&&<button className="btn bp" onClick={()=>setDlModal({type:"all"})} style={{fontSize:12,padding:"9px 18px"}}>🚀 Scarica ZIP ({offers.length})</button>}
          {dlProgress&&<span style={{fontSize:12,color:"#00BCD4",fontWeight:700}}>⏳ {dlProgress.zipping?"Creando ZIP...": `${dlProgress.c}/${dlProgress.t} generate...`}</span>}
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",borderBottom:"1px solid #1a1a28",background:"#0d0d16"}}>
        {[{k:"setup",l:"⚙ Setup"},{k:"stile",l:"🎨 Stile"},{k:"offerte",l:`📦 Offerte${offers.length?` (${offers.length})`:""}`}].map(t=>
          <button key={t.k} className={`tab ${tab===t.k?"on":""}`} onClick={()=>setTab(t.k)}>{t.l}</button>)}
      </div>

      {/* MAIN CONTENT */}
      {!isBatch ? (
        <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>
          {/* SIDEBAR */}
          <div style={{width:380,background:"#0d0d16",borderRight:"1px solid #1a1a28",overflow:"auto",padding:12}}>
            {tab==="setup"&&(<div>
              {/* API Key */}
              <div style={{marginBottom:12,padding:"10px",background:"#0a0a14",border:"1px solid #1e1e30",borderRadius:8}}>
                <div className="lbl" style={{marginBottom:4}}>🔑 Anthropic API Key</div>
                <div className="row" style={{gap:6}}>
                  <input className="inp" type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-ant-api03-..." style={{fontSize:11,fontFamily:"monospace",flex:1}}/>
                  {apiKey&&<button onClick={()=>{setApiKey("");localStorage.removeItem("anthropic_api_key");}} title="Elimina API key" style={{background:"#1a0a0a",border:"1px solid #3a1a1a",color:"#ef5350",borderRadius:6,cursor:"pointer",padding:"0 10px",fontSize:13,flexShrink:0}}>🗑</button>}
                </div>
                <div style={{fontSize:9,color:apiKey?"#4CAF50":"#ef5350",marginTop:4}}>{apiKey?"✅ API key impostata":"⚠️ Necessaria per Compila con AI"}</div>
              </div>

              {/* ── SFONDO ── */}
              {[{label:"🌅 Sfondo",open:accSfondo,toggle:()=>setAccSfondo(p=>!p),content:(
                <div>
                  <div style={{marginBottom:10}}><div className="lbl">Colore sfondo</div><div className="row"><input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)}/><input className="inp" value={bgColor} onChange={e=>setBgColor(e.target.value)} style={{flex:1}}/></div></div>
                  <div style={{marginBottom:10}}><div className="lbl">Opacità overlay: {Math.round(overlayOpacity*100)}%</div><input type="range" min="0" max="1" step="0.05" value={overlayOpacity} onChange={e=>setOverlayOpacity(+e.target.value)} style={{width:"100%",accentColor:"#00BCD4"}}/></div>
                  <div style={{marginBottom:10}}><div className="lbl">Immagine sfondo</div><input type="file" accept="image/*" className="fi" style={{fontSize:10}} onChange={e=>loadImg(setBgImage,e)}/>{bgImage&&<div style={{fontSize:10,color:"#00BCD4",marginTop:2}}>✅ Caricata</div>}</div>
                  <div>
                    <div className="lbl" style={{marginBottom:6}}>Preset colori accento</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                      {colorPresets.map(pr=>(
                        <div key={pr.id} style={{display:"flex",alignItems:"center",gap:2}}>
                          <button className="btn bs" style={{fontSize:10,padding:"4px 8px",display:"flex",alignItems:"center",gap:4}} onClick={()=>applyAccentColor(pr.accentColor)}>
                            <span style={{display:"inline-block",width:10,height:10,background:pr.accentColor,borderRadius:2,flexShrink:0}}/>
                            {pr.label}
                          </button>
                          <button onClick={()=>deleteColorPreset(pr.id)} title="Rimuovi" style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:11,padding:"2px 4px",lineHeight:1}}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <input type="color" value={newPresetColor} onChange={e=>setNewPresetColor(e.target.value)} style={{width:32,height:28,border:"none",background:"none",cursor:"pointer",padding:0,borderRadius:4}}/>
                      <input className="inp" value={newPresetColor} onChange={e=>setNewPresetColor(e.target.value)} style={{width:80,padding:"4px 6px",fontSize:11,fontFamily:"monospace"}} placeholder="#00BCD4"/>
                      <input className="inp" value={newPresetName} onChange={e=>setNewPresetName(e.target.value)} style={{flex:1,minWidth:60,padding:"4px 6px",fontSize:11}} placeholder="Nome preset"/>
                      <button className="btn bp" onClick={saveColorPreset} disabled={!newPresetName.trim()} style={{padding:"5px 10px",fontSize:11,opacity:!newPresetName.trim()?0.4:1}}>💾 Salva</button>
                    </div>
                  </div>
                </div>
              )},{label:"🏷️ Logo",open:accLogo,toggle:()=>setAccLogo(p=>!p),content:(
                <div>
                  <div style={{marginBottom:10}}><div className="lbl">Immagine logo</div><input type="file" accept="image/png" className="fi" style={{fontSize:10}} onChange={e=>loadImg(setLogoImage,e)}/>{logoImage&&<div style={{fontSize:10,color:"#00BCD4",marginTop:2}}>✅ Caricato</div>}</div>
                  <div className="lbl">Posizione Logo</div>
                  <div className="row" style={{marginBottom:4}}><span style={{fontSize:9,width:12}}>X</span><input className="inp" type="number" value={logoPos.x} onChange={e=>setLogoPos(p=>({...p,x:+e.target.value}))} style={{padding:"3px 5px",fontSize:10}}/><span style={{fontSize:9,width:12}}>Y</span><input className="inp" type="number" value={logoPos.y} onChange={e=>setLogoPos(p=>({...p,y:+e.target.value}))} style={{padding:"3px 5px",fontSize:10}}/></div>
                  <div className="row"><span style={{fontSize:9,width:24}}>Scala</span><input type="range" min="0.02" max="1" step="0.01" value={logoPos.scale} onChange={e=>setLogoPos(p=>({...p,scale:+e.target.value}))} style={{flex:1,accentColor:"#00BCD4"}}/><span style={{fontSize:9,width:28,textAlign:"right"}}>{Math.round(logoPos.scale*100)}%</span></div>
                </div>
              )},{label:"🖼 Elementi Extra Globali",open:accExtras,toggle:()=>setAccExtras(p=>!p),content:(
                <div>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="fi" style={{padding:6,fontSize:11,marginBottom:8}}
                    onChange={async e=>{const f=e.target.files[0];if(!f)return;const{img,dataUrl}=await readFile(f);const ex={id:++_exId,img,thumb:dataUrl,x:500,y:500,scale:0.3};setGlobalExtras(p=>[...p,ex]);e.target.value="";}}/>
                  {globalExtras.map((ex,ei)=>(
                    <div key={ex.id} style={{background:"#0a0a14",border:"1px solid #1e1e30",borderRadius:7,padding:8,marginBottom:5}}>
                      <div className="row" style={{marginBottom:4}}>
                        {ex.thumb&&<img src={ex.thumb} alt="" style={{width:28,height:28,objectFit:"contain",borderRadius:3,background:"#14141f"}}/>}
                        <span style={{flex:1,fontSize:10,color:"#aaa",fontWeight:600}}>Extra {ei+1}</span>
                        <button className="btn bd" style={{padding:"3px 7px",fontSize:9}} onClick={()=>setGlobalExtras(p=>p.filter((_,i)=>i!==ei))}>✕</button>
                      </div>
                      <div className="row" style={{marginBottom:3}}>
                        <span style={{fontSize:8,width:10}}>X</span><input className="inp" type="number" value={ex.x} onChange={e=>setGlobalExtras(p=>p.map((x,i)=>i===ei?{...x,x:+e.target.value}:x))} style={{padding:"3px 5px",fontSize:10}}/>
                        <span style={{fontSize:8,width:10}}>Y</span><input className="inp" type="number" value={ex.y} onChange={e=>setGlobalExtras(p=>p.map((x,i)=>i===ei?{...x,y:+e.target.value}:x))} style={{padding:"3px 5px",fontSize:10}}/>
                      </div>
                      <div className="row"><span style={{fontSize:8,width:24}}>Scala</span><input type="range" min="0.02" max="3" step="0.02" value={ex.scale} onChange={e=>setGlobalExtras(p=>p.map((x,i)=>i===ei?{...x,scale:+e.target.value}:x))} style={{flex:1,accentColor:"#00BCD4"}}/><span style={{fontSize:9,width:28,textAlign:"right"}}>{Math.round(ex.scale*100)}%</span></div>
                    </div>
                  ))}
                  {globalExtras.length>0&&<div style={{fontSize:9,color:"#555",textAlign:"center",marginTop:4}}>Trascina gli extra sull'anteprima</div>}
                </div>
              )},{label:"💧 Watermark",open:accWm,toggle:()=>setAccWm(p=>!p),content:(
                <div>
                  {watermarkImg?(
                    <div>
                      <div className="row" style={{marginBottom:8}}>
                        <div style={{fontSize:11,color:"#00BCD4",flex:1}}>✅ Watermark caricato</div>
                        <button className="btn bd" style={{padding:"3px 8px",fontSize:10}} onClick={()=>setWatermarkImg(null)}>✕ Rimuovi</button>
                      </div>
                      <div className="row" style={{marginBottom:8}}>
                        <div style={{flex:1}}><div style={{fontSize:9,color:"#555",marginBottom:2}}>X</div><input className="inp" type="number" value={wmX} onChange={e=>setWmX(+e.target.value)} style={{padding:"4px 6px",fontSize:11}}/></div>
                        <div style={{flex:1}}><div style={{fontSize:9,color:"#555",marginBottom:2}}>Y</div><input className="inp" type="number" value={wmY} onChange={e=>setWmY(+e.target.value)} style={{padding:"4px 6px",fontSize:11}}/></div>
                      </div>
                      <div className="lbl" style={{marginBottom:3}}>Opacità: {Math.round(wmOpacity*100)}%</div>
                      <input type="range" min="0.01" max="1" step="0.01" value={wmOpacity} onChange={e=>setWmOpacity(+e.target.value)} style={{width:"100%",accentColor:"#00BCD4",marginBottom:8}}/>
                      <div className="lbl" style={{marginBottom:3}}>Dimensione: {Math.round(wmScale*100)}%</div>
                      <input type="range" min="0.05" max="3" step="0.05" value={wmScale} onChange={e=>setWmScale(+e.target.value)} style={{width:"100%",accentColor:"#00BCD4",marginBottom:4}}/>
                      <div style={{fontSize:9,color:"#555",textAlign:"center"}}>Trascina il watermark sull'anteprima</div>
                    </div>
                  ):(
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="fi" style={{padding:6,fontSize:11}}
                      onChange={async e=>{const f=e.target.files[0];if(!f)return;const{img}=await readFile(f);setWatermarkImg(img);}}/>
                  )}
                </div>
              )}].map(sec=>(
                <div key={sec.label} style={{marginBottom:6,borderRadius:8,border:"1px solid #1a1a28",overflow:"hidden"}}>
                  <div onClick={sec.toggle} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",cursor:"pointer",background:"#0d0d18",userSelect:"none"}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#e0e0e0"}}>{sec.label}</span>
                    <span style={{color:"#555",fontSize:14,transition:"transform .2s",transform:sec.open?"rotate(90deg)":"rotate(0deg)"}}>▸</span>
                  </div>
                  {sec.open&&<div style={{padding:"12px",background:"#09090f",borderTop:"1px solid #1a1a28"}}>{sec.content}</div>}
                </div>
              ))}
            </div>)}

            {tab==="stile"&&(<div>
              <div style={{borderTop:"1px solid #1e1e30",paddingTop:12,marginBottom:12}}>
                <div onClick={()=>setAccCampi(!accCampi)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",cursor:"pointer",borderBottom:"1px solid #1e1e30",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:800,color:"#00BCD4"}}>📝 Campi Rapidi</span>
                  <span style={{color:"#555",fontSize:14}}>{accCampi?"▾":"▸"}</span>
                </div>
                {accCampi&&(<div>
                  <div style={{background:"#0a1a12",border:"1px solid #1b3a28",borderRadius:10,padding:12,marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:18}}>💬</span><span style={{fontSize:12,fontWeight:700,color:"#25D366"}}>Inserisci istruzioni</span></div>
                    <textarea className="inp" rows={3} value={waText} onChange={e=>setWaText(e.target.value)} placeholder="Scrivi qui le indicazioni per la nuova offerta" style={{background:"#0d1f16",border:"1px solid #1b3a28",fontSize:12,marginBottom:8}}/>
                    <div className="row"><button className="btn bg" disabled={waParsing||!waText.trim()} onClick={handleWa} style={{padding:"8px 18px",fontSize:12,opacity:!waText.trim()?.4:1}}>{waParsing?"⏳ Analizzo...":"🤖 Compila con AI"}</button>{waError&&<span style={{fontSize:11,color:"#ef5350"}}>{waError}</span>}</div>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:"#999",marginBottom:10}}>Campi rapidi</div>
                  {qf.map((q,i)=>{const el=getEl(q.id),val=q.key?el[q.key]||"":el.text;return(<div className="qf" key={i}><div className="ql">{q.label}</div><input value={val} placeholder={q.ph} onChange={e=>{if(q.key)setEl(q.id,q.key,e.target.value);else setEl(q.id,"text",e.target.value);}}/></div>);})}
                  <div className="qf"><div className="ql">📋 Servizi</div><textarea className="inp" rows={3} value={getEl("services").text} onChange={e=>setEl("services","text",e.target.value)} style={{background:"transparent",border:"none",fontSize:11,padding:0}}/></div>
                </div>)}
              </div>
              
              <div style={{borderTop:"1px solid #1e1e30",paddingTop:12}}>
                <div onClick={()=>setAccElementi(!accElementi)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",cursor:"pointer",borderBottom:"1px solid #1e1e30",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:800,color:"#00BCD4"}}>🎨 Elementi</span>
                  <span style={{color:"#555",fontSize:14}}>{accElementi?"▾":"▸"}</span>
                </div>
                {accElementi&&(<div>
                  <div style={{marginBottom:12,padding:10,background:"#0f0f1a",border:"1px solid #1e1e30",borderRadius:8}}>
                    <div className="lbl" style={{marginBottom:6}}>⚡ Applica font a TUTTI gli elementi</div>
                    <select className="inp" defaultValue="" onChange={e=>{applyFontToAll(e.target.value);e.target.value="";}}>
                      <option value="">— Scegli font —</option>
                      <optgroup label="Preset">{FONTS.map(f=><option key={f}>{f}</option>)}</optgroup>
                      {customFonts.length>0&&<optgroup label="📝 Personalizzati">{customFonts.map(f=><option key={f.name}>{f.name}</option>)}</optgroup>}
                    </select>
                    <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid #1e1e30"}}>
                      <div className="lbl">📝 Carica font personalizzato (.ttf/.otf/.woff)</div>
                      <input type="file" multiple accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" className="fi" style={{padding:5,fontSize:10}} onChange={uploadFont}/>
                      <div style={{marginTop:6,display:"flex",gap:5}}>
                        <button onClick={exportFonts} className="btn bs" style={{flex:1,padding:"4px 6px",fontSize:10}} title="Scarica un file JSON con tutti i font personalizzati">⬇ Esporta</button>
                        <label className="btn bs" style={{flex:1,padding:"4px 6px",fontSize:10,textAlign:"center",cursor:"pointer",margin:0}} title="Carica un file JSON di font esportati">⬆ Importa
                          <input type="file" accept=".json,application/json" onChange={importFonts} style={{display:"none"}}/>
                        </label>
                      </div>
                      {customFonts.length>0&&<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>{customFonts.map(f=>(<div key={f.name} style={{fontSize:10,padding:"4px 8px",background:"#0a0a14",border:"1px solid #00BCD4",borderRadius:8,color:"#00BCD4",display:"flex",alignItems:"center",gap:6}}><span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:`"${f.name}",sans-serif`}}>{f.name}</span><button onClick={()=>applyFontToAll(f.name)} title="Applica a tutti gli elementi" style={{background:"transparent",border:"1px solid #00BCD4",color:"#00BCD4",borderRadius:4,padding:"1px 6px",fontSize:9,cursor:"pointer",fontWeight:700}}>⚡ Tutti</button><span onClick={()=>{const n=prompt("Nuovo nome per il font:",f.name);if(n)renameCustomFont(f.name,n);}} style={{cursor:"pointer",color:"#FFC107",fontWeight:700}} title="Rinomina">✏️</span><span onClick={()=>{if(window.confirm("Rimuovere il font \""+f.name+"\"?"))removeCustomFont(f.name);}} style={{cursor:"pointer",color:"#ef5350",fontWeight:700}} title="Rimuovi">×</span></div>))}</div>}
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>{elements.map(el=>(<div key={el.id} className={`elitem ${selectedEl===el.id?"on":""}`} onClick={()=>setSelectedEl(el.id)}><span>{el.id}</span><span style={{cursor:"pointer",opacity:el.visible?1:.3}} onClick={e=>{e.stopPropagation();setEl(el.id,"visible",!el.visible)}}>{el.visible?"👁":"🚫"}</span></div>))}</div>
                  {sel&&(<div className="card">
                                        <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#00BCD4"}}>{sel.id}</div>
                    <div style={{marginBottom:8}}><div className="lbl">Font</div><div className="row"><select className="inp" value={sel.fontFamily} onChange={e=>setEl(sel.id,"fontFamily",e.target.value)} style={{flex:2}}>{FONTS.map(f=><option key={f}>{f}</option>)}{customFonts.length>0&&<optgroup label="📝 Personalizzati">{customFonts.map(f=><option key={f.name}>{f.name}</option>)}</optgroup>}</select><select className="inp" value={sel.fontWeight} onChange={e=>setEl(sel.id,"fontWeight",e.target.value)} style={{flex:1}}>{["400","600","700","800","900"].map(w=><option key={w}>{w}</option>)}</select><input className="inp" type="number" value={sel.fontSize} onChange={e=>setEl(sel.id,"fontSize",+e.target.value)} style={{width:50,flex:"none"}}/></div></div>
                    <div style={{marginBottom:8}}><div className="lbl">Colori</div><div className="row"><div><div style={{fontSize:9,color:"#555"}}>Testo</div><input type="color" value={sel.color} onChange={e=>setEl(sel.id,"color",e.target.value)}/></div>{sel.highlightColor!==undefined&&<div><div style={{fontSize:9,color:"#555"}}>Evidenza</div><input type="color" value={sel.highlightColor} onChange={e=>setEl(sel.id,"highlightColor",e.target.value)}/></div>}{sel.bgColor!==undefined&&<div><div style={{fontSize:9,color:"#555"}}>Sfondo</div><input type="color" value={sel.bgColor} onChange={e=>setEl(sel.id,"bgColor",e.target.value)}/></div>}</div></div>
                    <div style={{marginBottom:8}}><div className="lbl">Posizione</div><div className="row"><input className="inp" type="number" value={sel.x} onChange={e=>setEl(sel.id,"x",+e.target.value)}/><input className="inp" type="number" value={sel.y} onChange={e=>setEl(sel.id,"y",+e.target.value)}/></div></div>
                    <div><div className="lbl">Allineamento</div><div className="row">{["left","center","right"].map(a=>(<button key={a} className={`btn ${sel.textAlign===a?"bp":"bs"}`} style={{flex:1,padding:5}} onClick={()=>setEl(sel.id,"textAlign",a)}>{a==="left"?"⬅":a==="center"?"⬛":"➡"}</button>))}</div></div>
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1e1e30"}}>
                      <div className="row" style={{marginBottom:6}}><span className="lbl" style={{flex:1,marginBottom:0}}>Ombra testo</span><label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><input type="checkbox" checked={!!sel.shadowEnabled} onChange={e=>setEl(sel.id,"shadowEnabled",e.target.checked)} style={{accentColor:"#00BCD4",width:15,height:15}}/><span style={{fontSize:11,color:sel.shadowEnabled?"#00BCD4":"#555"}}>Attiva</span></label></div>
                      {sel.shadowEnabled&&(<>
                        <div className="row" style={{marginBottom:6}}><div><div style={{fontSize:9,color:"#555"}}>Colore</div><input type="color" value={sel.shadowColor||"#000000"} onChange={e=>setEl(sel.id,"shadowColor",e.target.value)}/></div><div style={{flex:1,marginLeft:8}}><div style={{fontSize:9,color:"#555",marginBottom:2}}>Sfumatura: {sel.shadowBlur||0}px</div><input type="range" min="0" max="40" step="1" value={sel.shadowBlur||0} onChange={e=>setEl(sel.id,"shadowBlur",+e.target.value)} style={{width:"100%",accentColor:"#00BCD4"}}/></div></div>
                        <div className="row" style={{gap:8}}><div style={{flex:1}}><div style={{fontSize:9,color:"#555",marginBottom:2}}>Offset X: {sel.shadowOffsetX||0}px</div><input type="range" min="-20" max="20" step="1" value={sel.shadowOffsetX||0} onChange={e=>setEl(sel.id,"shadowOffsetX",+e.target.value)} style={{width:"100%",accentColor:"#00BCD4"}}/></div><div style={{flex:1}}><div style={{fontSize:9,color:"#555",marginBottom:2}}>Offset Y: {sel.shadowOffsetY||0}px</div><input type="range" min="-20" max="20" step="1" value={sel.shadowOffsetY||0} onChange={e=>setEl(sel.id,"shadowOffsetY",+e.target.value)} style={{width:"100%",accentColor:"#00BCD4"}}/></div></div>
                      </>)}
                    </div>
                  </div>)}
                </div>)}
              </div>
            </div>)}
          </div>
          {/* CANVAS */}}
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"#08080d",overflow:"hidden"}}>
            <canvas ref={canvasRef} width={CW} height={CH} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto",borderRadius:8,boxShadow:"0 8px 40px rgba(0,0,0,.6)",cursor:dragging?"grabbing":"default"}}/>
          </div>
        </div>
      ) : (
        /* ==================== BATCH MODE — SETUP LAYOUT ==================== */
        <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>
          {/* LEFT SIDEBAR */}
          <div style={{width:380,background:"#0d0d16",borderRight:"1px solid #1a1a28",display:"flex",flexDirection:"column",minHeight:0,overflowY:"auto"}}>

            {/* Batch import (testo + cartella PNG → N offerte) */}
            <div style={{flexShrink:0,padding:"10px 12px 0"}}>
              <BatchImportPanel apiKey={apiKey} existingOfferCount={offers.length} onCommit={addOffersFromBatch}/>
            </div>

            {/* Offer list — sempre visibile, non scorre con i controlli */}
            <div style={{flexShrink:0,padding:"12px 12px 8px",borderBottom:"1px solid #1a1a28"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:"#777",textTransform:"uppercase",letterSpacing:".6px"}}>Offerte ({offers.length})</div>
                <button className="btn bp" style={{padding:"4px 10px",fontSize:11}} onClick={()=>addOffer(null)}>➕ Nuova</button>
              </div>
              {offers.length===0&&(
                <div style={{textAlign:"center",padding:"12px 0",color:"#555",fontSize:12}}>Nessuna offerta ancora.</div>
              )}
              <div style={{maxHeight:180,overflowY:"auto"}}>
                {offers.map((o,idx)=>(
                  <div key={o.id} onClick={()=>setActiveOfferId(o.id)}
                    title={`${o.carName||"Nuova offerta"}${o.specs?"\n"+o.specs:""}${o.duration?"\n"+o.duration:""}${o.deposit?"\n"+o.deposit:""}${o.price?"\nCanone: "+o.price+"€/mese":""}`}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,marginBottom:3,cursor:"pointer",
                      background:activeOffer&&activeOffer.id===o.id?"#1a1a2e":"#0a0a14",
                      border:`1px solid ${activeOffer&&activeOffer.id===o.id?"#00BCD4":"#1e1e30"}`}}>
                    <div className="offer-num" style={{width:26,height:26,fontSize:11,flexShrink:0}}>{idx+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div title={o.carName||"Nuova offerta"} style={{fontSize:12,fontWeight:700,color:o.carName?"#fff":"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.carName||"Nuova offerta"}</div>
                      {o.price&&<div style={{fontSize:10,color:"#00BCD4",fontWeight:700}}>{o.price} €/mese</div>}
                    </div>
                    <button className="btn bd" style={{padding:"3px 7px",fontSize:10,flexShrink:0}} onClick={e=>{e.stopPropagation();removeOffer(o.id);}}>🗑</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls for active offer — flusso naturale (lo scroll è sul sidebar) */}
            <div style={{flexShrink:0,padding:12}}>
            {activeOffer&&(
              <div style={{borderTop:"1px solid #1a1a28",paddingTop:10}}>
                {/* AI */}
                <div style={{background:"#0a1a12",border:"1px solid #1b3a28",borderRadius:8,padding:10,marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#25D366",marginBottom:6}}>💬 Inserisci istruzioni</div>
                  <textarea value={activeOffer._waText||""} onChange={e=>setOffers(p=>p.map(x=>x.id===activeOffer.id?{...x,_waText:e.target.value}:x))} placeholder="Scrivi qui le indicazioni per la nuova offerta" rows={2} style={{width:"100%",background:"#0d1f16",border:"1px solid #1b3a28",color:"#ddd",padding:"6px 8px",borderRadius:6,fontSize:11,outline:"none",resize:"vertical"}}/>
                  <div className="row" style={{marginTop:6}}>
                    <button className="btn bg" disabled={activeOffer._parsing||!(activeOffer._waText||"").trim()} onClick={()=>handleWaOffer(activeOffer.id,activeOffer._waText||"")} style={{padding:"6px 14px",fontSize:11,opacity:!(activeOffer._waText||"").trim()?0.4:1}}>{activeOffer._parsing?"⏳":"🤖 Compila con AI"}</button>
                    {activeOffer._waError&&<span style={{fontSize:10,color:"#ef5350"}}>{activeOffer._waError}</span>}
                  </div>
                </div>

                {/* Fields */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                  {[{k:"carName",l:"Nome Auto",ph:"MERCEDES GLC COUPÉ"},{k:"highlightWord",l:"Evidenziata",ph:"GLC COUPÉ"},{k:"specs",l:"Caratteristiche",ph:"220D MHEV..."},{k:"duration",l:"Durata / KM",ph:"48 MESI – 60.000 KM"},{k:"deposit",l:"Anticipo",ph:"ANTICIPO 2.000€"},{k:"price",l:"Canone €",ph:"689"}].map(f=>(
                    <div className="ofi" key={f.k+f.l}><label>{f.l}</label><input value={activeOffer[f.k]} placeholder={f.ph} onChange={e=>updOffer(activeOffer.id,f.k,e.target.value)}/></div>
                  ))}
                </div>

                {/* Car upload */}
                <div style={{marginBottom:10}}>
                  <div className="lbl">Auto PNG</div>
                  <input type="file" accept="image/png" className="fi" style={{padding:6,fontSize:11}} onChange={e=>handleOfferCar(activeOffer.id,e)}/>
                  {activeOffer.carThumb&&<div style={{fontSize:10,color:"#00BCD4",marginTop:2}}>✅ Caricata</div>}
                </div>

                {/* Position */}
                <div style={{marginBottom:6}}>
                  <div className="lbl">Posizione & scala auto</div>
                  <div className="row" style={{marginBottom:4}}>
                    <span style={{fontSize:9,width:12}}>X</span><input className="inp" type="number" value={activeOffer.carX} onChange={e=>updOffer(activeOffer.id,"carX",+e.target.value)} style={{padding:"4px 6px",fontSize:11}}/>
                    <span style={{fontSize:9,width:12}}>Y</span><input className="inp" type="number" value={activeOffer.carY} onChange={e=>updOffer(activeOffer.id,"carY",+e.target.value)} style={{padding:"4px 6px",fontSize:11}}/>
                  </div>
                  <div className="row"><span style={{fontSize:9,width:28}}>Scala</span><input type="range" min="0.1" max="2" step="0.02" value={activeOffer.carScale} onChange={e=>updOffer(activeOffer.id,"carScale",+e.target.value)} style={{flex:1,accentColor:"#00BCD4"}}/><span style={{fontSize:10,width:30,textAlign:"right"}}>{Math.round(activeOffer.carScale*100)}%</span></div>
                  <div style={{fontSize:10,color:"#555",marginTop:4,textAlign:"center"}}>Trascina l'auto sull'anteprima</div>
                </div>

                {/* EXTRAS */}
                <div style={{borderTop:"1px solid #1e1e30",paddingTop:10}}>
                  <div className="row" style={{marginBottom:6}}><span className="lbl" style={{flex:1,marginBottom:0}}>Elementi extra</span><span style={{fontSize:10,color:"#555"}}>{(activeOffer.extras||[]).length} inseriti</span></div>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="fi" style={{padding:5,fontSize:10,marginBottom:6}} onChange={e=>addExtra(activeOffer.id,e)}/>
                  {(activeOffer.extras||[]).map((ex,ei)=>(
                    <div key={ex.id} style={{background:"#0a0a14",border:"1px solid #1e1e30",borderRadius:7,padding:8,marginBottom:5}}>
                      <div className="row" style={{marginBottom:4}}>
                        {ex.thumb&&<img src={ex.thumb} alt="" style={{width:28,height:28,objectFit:"contain",borderRadius:3,background:"#14141f"}}/>}
                        <span style={{flex:1,fontSize:10,color:"#aaa",fontWeight:600}}>Extra {ei+1}</span>
                        <button className="btn bd" style={{padding:"3px 7px",fontSize:9}} onClick={()=>removeExtra(activeOffer.id,ei)}>✕</button>
                      </div>
                      <div className="row" style={{marginBottom:3}}>
                        <span style={{fontSize:8,width:10}}>X</span><input className="inp" type="number" value={ex.x} onChange={e=>updExtra(activeOffer.id,ei,"x",+e.target.value)} style={{padding:"3px 5px",fontSize:10}}/>
                        <span style={{fontSize:8,width:10}}>Y</span><input className="inp" type="number" value={ex.y} onChange={e=>updExtra(activeOffer.id,ei,"y",+e.target.value)} style={{padding:"3px 5px",fontSize:10}}/>
                      </div>
                      <div className="row"><span style={{fontSize:8,width:24}}>Scala</span><input type="range" min="0.02" max="2" step="0.02" value={ex.scale} onChange={e=>updExtra(activeOffer.id,ei,"scale",+e.target.value)} style={{flex:1,accentColor:"#00BCD4"}}/><span style={{fontSize:9,width:28,textAlign:"right"}}>{Math.round(ex.scale*100)}%</span></div>
                    </div>
                  ))}
                  {(activeOffer.extras||[]).length>0&&<div style={{fontSize:9,color:"#555",textAlign:"center"}}>Trascina gli extra sull'anteprima</div>}
                </div>

                {/* Download current offer */}
                <div style={{marginTop:12,display:"flex",gap:6}}>
                  <button className="btn bp" style={{flex:1,padding:"8px 0",fontSize:12}} onClick={()=>setDlModal({type:"offer",offer:activeOffer,num:offers.findIndex(o=>o.id===activeOffer.id)+1})}>⬇ Scarica questa offerta</button>
                </div>
                <div style={{marginTop:6}}>
                  <button className="btn bs" style={{width:"100%",padding:"6px 0",fontSize:11}} onClick={()=>addOffer(activeOffer.id)}>➕ Aggiungi offerta dopo</button>
                </div>
              </div>
            )}
            </div>{/* fine sezione scrollabile controlli */}
          </div>

          {/* RIGHT: CANVAS */}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16,background:"#08080d",overflow:"hidden",gap:16}}>
            {activeOffer?(
              <div style={{maxWidth:"100%",maxHeight:"100%",flex:1,minHeight:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <LiveCanvas offer={activeOffer} elements={elements} bgImage={bgImage} carImage={carImage} logoImage={logoImage} bgColor={bgColor} overlayOpacity={overlayOpacity} logoPos={logoPos} showGuides={showGuides}
                  globalExtras={globalExtras} watermarkImg={watermarkImg} wmOpacity={wmOpacity} wmScale={wmScale} wmX={wmX} wmY={wmY}
                  onDragCar={(x,y)=>setOffers(p=>p.map(oo=>oo.id===activeOffer.id?{...oo,carX:x,carY:y}:oo))}
                  onDragExtra={(idx,x,y)=>setOffers(p=>p.map(oo=>oo.id===activeOffer.id?{...oo,extras:oo.extras.map((ex,i)=>i===idx?{...ex,x,y}:ex)}:oo))}/>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{fontSize:48}}>📦</div>
                <div style={{fontSize:16,color:"#666",textAlign:"center"}}>Nessuna offerta. Inizia aggiungendone una.</div>
                <div style={{display:"flex",gap:10}}>
                  <button className="btn bp" style={{padding:"12px 24px",fontSize:14}} onClick={()=>addOffer(null)}>➕ Nuova offerta</button>
                </div>
              </div>
            )}
            {offers.length>0&&(
              <div>
                {!dlProgress?
                  <button className="btn bp" style={{padding:"10px 24px",fontSize:13}} onClick={()=>setDlModal({type:"all"})}>🚀 Scarica tutte in ZIP ({offers.length})</button>
                  :<div style={{fontSize:14,color:"#00BCD4",fontWeight:700,textAlign:"center"}}>
                    <div style={{marginBottom:8}}>⏳ {dlProgress.zipping?"Creando ZIP...":`Generando ${dlProgress.c}/${dlProgress.t}...`}</div>
                    <div style={{width:300,height:6,background:"#14141f",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${(dlProgress.c/dlProgress.t)*100}%`,background:"linear-gradient(90deg,#00BCD4,#0097A7)",borderRadius:3,transition:"width .3s"}}/>
                    </div>
                  </div>
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUALITY MODAL */}
      {dlModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>setDlModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#111119",border:"1px solid #1e1e30",borderRadius:16,padding:"28px 32px",width:380,boxShadow:"0 20px 60px rgba(0,0,0,.6)"}}>
            <div style={{fontSize:16,fontWeight:800,color:"#fff",marginBottom:4}}>Seleziona qualità</div>
            <div style={{fontSize:12,color:"#666",marginBottom:20}}>
              {dlModal.type==="all"?`${offers.length} offerte → ZIP`
                :dlModal.type==="offer"?`${dlModal.offer.carName||"Offerta"}`
                :"Offerta singola"}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {Object.entries(QUALITY).map(([key,v])=>(
                <button key={key} onClick={()=>execDownload(key)} style={{
                  display:"flex",alignItems:"center",gap:14,padding:"14px 18px",
                  background:"#0a0a14",border:"1px solid #1e1e30",borderRadius:10,
                  cursor:"pointer",transition:"all .15s",color:"#fff",textAlign:"left",
                }} onMouseEnter={e=>e.currentTarget.style.borderColor="#00BCD4"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1e1e30"}>
                  <span style={{fontSize:24}}>{v.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800}}>{v.label}</div>
                    <div style={{fontSize:11,color:"#666",marginTop:2}}>{v.desc}</div>
                  </div>
                  <span style={{fontSize:11,color:"#00BCD4",fontWeight:700}}>{v.size}px</span>
                </button>
              ))}
            </div>
            <button onClick={()=>setDlModal(null)} style={{marginTop:16,width:"100%",padding:"10px",background:"transparent",border:"1px solid #252538",borderRadius:8,color:"#666",cursor:"pointer",fontSize:12,fontWeight:600}}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}
