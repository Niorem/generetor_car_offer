import { useState, useRef, useEffect, useCallback } from "react";

const FONTS=["Montserrat","Oswald","Bebas Neue","Poppins","Raleway","Roboto Condensed","Anton","Barlow Condensed","Teko","Russo One"];
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

function draw(ctx,els,bg,car,logo,bgC,ov,cP,lP,extras){
  ctx.clearRect(0,0,CW,CH);ctx.fillStyle=bgC;ctx.fillRect(0,0,CW,CH);
  if(bg){const s=Math.max(CW/bg.width,CH/bg.height);ctx.drawImage(bg,(CW-bg.width*s)/2,(CH-bg.height*s)/2,bg.width*s,bg.height*s);ctx.globalAlpha=ov;ctx.fillStyle=bgC;ctx.fillRect(0,0,CW,CH);ctx.globalAlpha=1;}
  if(logo){const w=logo.width*lP.scale,h=logo.height*lP.scale;ctx.drawImage(logo,lP.x-w/2,lP.y-h/2,w,h);}
  els.forEach(el=>{
    if(!el.visible)return;ctx.save();
    ctx.font=`${el.fontWeight} ${el.fontSize}px "${el.fontFamily}",sans-serif`;ctx.textAlign=el.textAlign||"center";ctx.textBaseline="middle";
    if(el.shadowEnabled){ctx.shadowColor=el.shadowColor||"rgba(0,0,0,0.8)";ctx.shadowBlur=el.shadowBlur||0;ctx.shadowOffsetX=el.shadowOffsetX||0;ctx.shadowOffsetY=el.shadowOffsetY||0;}else{ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
    if(el.id==="services"){el.text.split("\n").forEach((l,i)=>{const h=el.highlightLines?.includes(i);ctx.font=`${h?"700":el.fontWeight} ${el.fontSize}px "${el.fontFamily}",sans-serif`;ctx.fillStyle=h?(el.highlightColor||"#00BCD4"):el.color;ctx.fillText(l,el.x,el.y+i*(el.fontSize+6));});ctx.restore();return;}
    if(el.pillStyle){const tw=ctx.measureText(el.text).width,ph=el.fontSize+16,pw=tw+40,rx=el.textAlign==="center"?el.x-pw/2:el.x;ctx.fillStyle=el.bgColor||"#1a1a2e";ctx.beginPath();const r=6;ctx.moveTo(rx+r,el.y-ph/2);ctx.lineTo(rx+pw-r,el.y-ph/2);ctx.quadraticCurveTo(rx+pw,el.y-ph/2,rx+pw,el.y-ph/2+r);ctx.lineTo(rx+pw,el.y+ph/2-r);ctx.quadraticCurveTo(rx+pw,el.y+ph/2,rx+pw-r,el.y+ph/2);ctx.lineTo(rx+r,el.y+ph/2);ctx.quadraticCurveTo(rx,el.y+ph/2,rx,el.y+ph/2-r);ctx.lineTo(rx,el.y-ph/2+r);ctx.quadraticCurveTo(rx,el.y-ph/2,rx+r,el.y-ph/2);ctx.closePath();ctx.fill();
      if(el.highlightWord){const parts=el.text.split("–").map(s=>s.trim());if(parts.length===2){const p1=parts[0]+" – ",sx=el.textAlign==="center"?el.x-tw/2:el.x;ctx.textAlign="left";ctx.fillStyle=el.color;ctx.fillText(p1,sx,el.y);ctx.fillStyle=el.highlightColor||"#00BCD4";ctx.fillText(parts[1],sx+ctx.measureText(p1).width,el.y);}else{ctx.fillStyle=el.color;ctx.fillText(el.text,el.x,el.y);}}else{ctx.fillStyle=el.color;ctx.fillText(el.text,el.x,el.y);}ctx.restore();return;}
    if(el.highlightWord){const idxI=el.text.toUpperCase().indexOf(el.highlightWord.toUpperCase());if(idxI>=0){const before=el.text.substring(0,idxI),hl=el.text.substring(idxI,idxI+el.highlightWord.length),after=el.text.substring(idxI+el.highlightWord.length);const bw=ctx.measureText(before).width,hw=ctx.measureText(hl).width,fw=ctx.measureText(el.text).width,sx=el.textAlign==="center"?el.x-fw/2:el.x;ctx.textAlign="left";ctx.fillStyle=el.color;if(before)ctx.fillText(before,sx,el.y);ctx.fillStyle=el.highlightColor||"#00BCD4";ctx.fillText(hl,sx+bw,el.y);ctx.fillStyle=el.color;if(after)ctx.fillText(after,sx+bw+hw,el.y);}else{ctx.fillStyle=el.color;ctx.fillText(el.text,el.x,el.y);}}else{ctx.fillStyle=el.color;ctx.fillText(el.text,el.x,el.y);}
    ctx.restore();
  });
  if(car){const w=car.width*cP.scale,h=car.height*cP.scale;ctx.drawImage(car,cP.x-w/2,cP.y-h/2,w,h);}
  if(extras&&extras.length){extras.forEach(ex=>{if(!ex.img)return;const w=ex.img.width*ex.scale,h=ex.img.height*ex.scale;ctx.drawImage(ex.img,ex.x-w/2,ex.y-h/2,w,h);});}
}
function drawGuides(ctx){
  ctx.save();
  /* Solid bright lines */
  ctx.setLineDash([10,5]);ctx.lineWidth=2;ctx.strokeStyle="rgba(0,188,212,0.7)";
  /* Left */
  ctx.beginPath();ctx.moveTo(GL,0);ctx.lineTo(GL,CH);ctx.stroke();
  /* Right */
  ctx.beginPath();ctx.moveTo(GR,0);ctx.lineTo(GR,CH);ctx.stroke();
  /* Top */
  ctx.beginPath();ctx.moveTo(0,GT);ctx.lineTo(CW,GT);ctx.stroke();
  /* Bottom */
  ctx.beginPath();ctx.moveTo(0,GB);ctx.lineTo(CW,GB);ctx.stroke();
  /* Small labels */
  ctx.setLineDash([]);ctx.font='bold 11px sans-serif';ctx.fillStyle="rgba(0,188,212,0.55)";ctx.textAlign="left";ctx.textBaseline="top";
  ctx.fillText("L",GL+4,GT+4);ctx.textAlign="right";ctx.fillText("R",GR-4,GT+4);
  ctx.textAlign="left";ctx.fillText("T",GL+4,GT+4);ctx.fillText("B",GL+4,GB-16);
  ctx.restore();
}
function readFile(file){return new Promise(res=>{const r=new FileReader();r.onload=ev=>{const img=new Image();img.onload=()=>res({img,dataUrl:ev.target.result});img.src=ev.target.result;};r.readAsDataURL(file);});}
async function parseAI(text){
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error("API " + res.status);
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
function LiveCanvas({offer,elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,logoPos,showGuides,onDragCar,onDragExtra}){
  const ref=useRef(null);
  const [drag,setDrag]=useState(null);
  const [ds,setDs]=useState(null);
  const buildEls=useCallback(()=>elements.map(el=>{
    if(el.id==="carName")return{...el,text:offer.carName||el.text,highlightWord:offer.highlightWord||el.highlightWord};
    if(el.id==="specs")return{...el,text:offer.specs||el.text};
    if(el.id==="duration")return{...el,text:offer.duration||el.text};
    if(el.id==="deposit")return{...el,text:offer.deposit||el.text};
    if(el.id==="price")return{...el,text:offer.price||el.text};
    return el;
  }),[offer,elements]);
  useEffect(()=>{
    const c=ref.current;if(!c)return;const ctx=c.getContext("2d");
    draw(ctx,buildEls(),bgImage,offer.carImg||carImage,logoImage,bgColor,overlayOpacity,{x:offer.carX,y:offer.carY,scale:offer.carScale},logoPos,offer.extras);
    if(showGuides)drawGuides(ctx);
  },[offer,elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,logoPos,buildEls,showGuides]);
  const coords=e=>{const c=ref.current,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*CW/r.width,y:(e.clientY-r.top)*CH/r.height};};
  const onDown=e=>{const p=coords(e);
    /* extras: check top-to-bottom (last = top) */
    if(offer.extras&&offer.extras.length){for(let i=offer.extras.length-1;i>=0;i--){const ex=offer.extras[i];if(!ex.img)continue;const w=ex.img.width*ex.scale,h=ex.img.height*ex.scale;if(p.x>ex.x-w/2&&p.x<ex.x+w/2&&p.y>ex.y-h/2&&p.y<ex.y+h/2){setDrag({type:"extra",idx:i});setDs({x:p.x-ex.x,y:p.y-ex.y});return;}}}
    const car=offer.carImg||carImage;if(car){const w=car.width*offer.carScale,h=car.height*offer.carScale;if(p.x>offer.carX-w/2&&p.x<offer.carX+w/2&&p.y>offer.carY-h/2&&p.y<offer.carY+h/2){setDrag({type:"car"});setDs({x:p.x-offer.carX,y:p.y-offer.carY});}}};
  const onMove=e=>{if(!drag)return;const p=coords(e);if(drag.type==="extra"&&onDragExtra){onDragExtra(drag.idx,Math.round(p.x-ds.x),Math.round(p.y-ds.y));}else if(drag.type==="car"){onDragCar(Math.round(p.x-ds.x),Math.round(p.y-ds.y));}};
  const onUp=()=>{setDrag(null);setDs(null);};
  return <canvas ref={ref} width={CW} height={CH} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} style={{width:"100%",borderRadius:8,cursor:drag?"grabbing":"default",boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}/>;
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

  // UNDO
  const histRef=useRef([]);const isUndo=useRef(false);
  const snap=useCallback(()=>{if(isUndo.current)return;const s=JSON.stringify({elements,offers:offers.map(o=>({...o,carImg:null,carThumb:o.carThumb})),carPos,logoPos,bgColor,overlayOpacity});const h=histRef.current;if(!h.length||h[h.length-1]!==s){h.push(s);if(h.length>50)h.shift();}},[elements,offers,carPos,logoPos,bgColor,overlayOpacity]);
  const snapT=useRef(null);
  useEffect(()=>{if(snapT.current)clearTimeout(snapT.current);snapT.current=setTimeout(snap,600);},[snap]);
  const undo=useCallback(()=>{const h=histRef.current;if(h.length<2)return;h.pop();const prev=h[h.length-1];if(!prev)return;isUndo.current=true;try{const s=JSON.parse(prev);setElements(s.elements);setOffers(old=>{const m={};old.forEach(o=>{m[o.id]=o.carImg;});return s.offers.map(o=>({...o,carImg:m[o.id]||null}));});setCarPos(s.carPos);setLogoPos(s.logoPos);setBgColor(s.bgColor);setOverlayOpacity(s.overlayOpacity);}catch(e){}setTimeout(()=>{isUndo.current=false;},100);},[]);
  useEffect(()=>{const h=e=>{if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();undo();}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[undo]);

  useEffect(()=>{const l=document.createElement("link");l.href=`https://fonts.googleapis.com/css2?${FONTS.map(f=>`family=${f.replace(/ /g,"+")}:wght@400;600;700;800;900`).join("&")}&display=swap`;l.rel="stylesheet";document.head.appendChild(l);document.fonts.ready.then(()=>setFontsLoaded(true));},[]);

  const getEl=id=>elements.find(e=>e.id===id);
  const setEl=(id,k,v)=>setElements(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));

  // Single canvas
  useEffect(()=>{if(isBatch)return;const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");draw(ctx,elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,carPos,logoPos,null);if(showGuides)drawGuides(ctx);},[elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,carPos,logoPos,fontsLoaded,showGuides,tab]);

  const loadImg=async(setter,e)=>{const f=e.target.files[0];if(!f)return;const{img}=await readFile(f);setter(img);};
  const loadCarImg=async(e)=>{const f=e.target.files[0];if(!f)return;const{img}=await readFile(f);setCarImage(img);autoFitCar(img);};
  const autoFitCar=(img)=>{const s=(GR-GL)/img.width;const cy=GB-(img.height*s)/2;setCarPos({x:(GL+GR)/2,y:cy,scale:s});};
  const buildEls=(o)=>elements.map(el=>{if(el.id==="carName")return{...el,text:o.carName||el.text,highlightWord:o.highlightWord||el.highlightWord};if(el.id==="specs")return{...el,text:o.specs||el.text};if(el.id==="duration")return{...el,text:o.duration||el.text};if(el.id==="deposit")return{...el,text:o.deposit||el.text};if(el.id==="price")return{...el,text:o.price||el.text};return el;});


  // Canvas drag (single mode)
  const coords=e=>{const c=canvasRef.current,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*CW/r.width,y:(e.clientY-r.top)*CH/r.height};};
  const onDown=e=>{const p=coords(e);if(logoImage){const w=logoImage.width*logoPos.scale,h=logoImage.height*logoPos.scale;if(p.x>logoPos.x-w/2&&p.x<logoPos.x+w/2&&p.y>logoPos.y-h/2&&p.y<logoPos.y+h/2){setDragging("logo");setDragStart({x:p.x-logoPos.x,y:p.y-logoPos.y});return;}}if(carImage){const w=carImage.width*carPos.scale,h=carImage.height*carPos.scale;if(p.x>carPos.x-w/2&&p.x<carPos.x+w/2&&p.y>carPos.y-h/2&&p.y<carPos.y+h/2){setDragging("car");setDragStart({x:p.x-carPos.x,y:p.y-carPos.y});return;}}for(const el of[...elements].reverse()){if(!el.visible)continue;const ctx=canvasRef.current.getContext("2d");ctx.font=`${el.fontWeight} ${el.fontSize}px "${el.fontFamily}",sans-serif`;const lines=el.text.split("\n"),mw=Math.max(...lines.map(l=>ctx.measureText(l).width)),th=lines.length*(el.fontSize+6);let ex=el.x;if(el.textAlign==="center")ex=el.x-mw/2;if(p.x>ex-10&&p.x<ex+mw+10&&p.y>el.y-th/2-10&&p.y<el.y+th/2+10){setDragging(el.id);setDragStart({x:p.x-el.x,y:p.y-el.y});setSelectedEl(el.id);setTab("elemento");return;}}};
  const onMove=e=>{if(!dragging)return;const p=coords(e);if(dragging==="logo")setLogoPos(v=>({...v,x:p.x-dragStart.x,y:p.y-dragStart.y}));else if(dragging==="car")setCarPos(v=>({...v,x:p.x-dragStart.x,y:p.y-dragStart.y}));else{setEl(dragging,"x",Math.round(p.x-dragStart.x));setEl(dragging,"y",Math.round(p.y-dragStart.y));}};
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
    draw(ctx,buildEls(o),bgImage,o.carImg||carImage,logoImage,bgColor,overlayOpacity,{x:o.carX,y:o.carY,scale:o.carScale},logoPos,o.extras);
    return oc.toDataURL("image/png");
  };
  const renderSingle=(sz)=>{
    const oc=document.createElement("canvas");oc.width=sz;oc.height=sz;
    const ctx=oc.getContext("2d");const s=sz/CW;ctx.scale(s,s);
    draw(ctx,elements,bgImage,carImage,logoImage,bgColor,overlayOpacity,carPos,logoPos,null);
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
  const dupFromCurrent=()=>{const o=newOffer();o.carName=getEl("carName").text;o.highlightWord=getEl("carName").highlightWord||"";o.specs=getEl("specs").text;o.duration=getEl("duration").text;o.deposit=getEl("deposit").text;o.price=getEl("price").text;setOffers(p=>[...p,o]);setActiveOfferId(o.id);};
  const handleWa=async()=>{if(!waText.trim())return;setWaParsing(true);setWaError("");try{const p=await parseAI(waText);if(p.carName)setEl("carName","text",p.carName);if(p.highlightWord)setEl("carName","highlightWord",p.highlightWord);if(p.specs)setEl("specs","text",p.specs);if(p.duration)setEl("duration","text",p.duration);if(p.deposit)setEl("deposit","text",p.deposit);if(p.price)setEl("price","text",p.price);setWaText("");}catch(err){console.error(err);setWaError("Errore: "+err.message);}setWaParsing(false);};
  const handleWaOffer=async(id,text)=>{if(!text.trim())return;setOffers(p=>p.map(o=>o.id===id?{...o,_parsing:true,_waError:""}:o));try{const p=await parseAI(text);setOffers(pr=>pr.map(o=>o.id===id?{...o,carName:p.carName||o.carName,highlightWord:p.highlightWord||o.highlightWord,specs:p.specs||o.specs,duration:p.duration||o.duration,deposit:p.deposit||o.deposit,price:p.price||o.price,_parsing:false,_waText:""}:o));}catch(err){console.error(err);setOffers(p=>p.map(o=>o.id===id?{...o,_parsing:false,_waError:"Errore: "+err.message}:o));}};

  const sel=selectedEl?getEl(selectedEl):null;
  const isBatch=tab==="offerte";
  const activeOffer=isBatch?(offers.find(o=>o.id===activeOfferId)||offers[0]||null):null;
  const qf=[{id:"carName",label:"🚗 Nome Auto",ph:"es. MERCEDES GLC COUPÉ"},{id:"carName",key:"highlightWord",label:"✨ Evidenziata",ph:"es. GLC COUPÉ"},{id:"specs",label:"⚙️ Caratteristiche",ph:"es. 220D MHEV 4MATIC"},{id:"duration",label:"📅 Durata / KM",ph:"es. 48 MESI – 60.000 KM"},{id:"deposit",label:"💰 Anticipo",ph:"es. ANTICIPO 2.000€ I.E."},{id:"price",label:"🏷️ Canone",ph:"es. 689"},{id:"priceSuffix",label:"Suffisso",ph:"€/MESE"},{id:"priceNote",label:"Nota",ph:"IVA ESCLUSA"},{id:"header",label:"Intestazione",ph:"NOLEGGIO LUNGO TERMINE"}];

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",color:"#e0e0e0",fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
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
          <button className="btn bs" style={{fontSize:11,padding:"7px 12px"}} onClick={undo} title="Ctrl+Z">↩ Annulla</button>
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
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          {/* SIDEBAR */}
          <div style={{width:380,background:"#0d0d16",borderRight:"1px solid #1a1a28",overflow:"auto",padding:12}}>
            {tab==="setup"&&(<div>
              <div style={{borderTop:"1px solid #1e1e30",paddingTop:12,marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:800,color:"#00BCD4",marginBottom:10}}>⚙ Sfondo</div>
                <div style={{marginBottom:12}}><div className="lbl">Colore sfondo</div><div className="row"><input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)}/><input className="inp" value={bgColor} onChange={e=>setBgColor(e.target.value)} style={{flex:1}}/></div></div>
                <div style={{marginBottom:14}}><div className="lbl">Opacità overlay: {Math.round(overlayOpacity*100)}%</div><input type="range" min="0" max="1" step="0.05" value={overlayOpacity} onChange={e=>setOverlayOpacity(+e.target.value)} style={{width:"100%",accentColor:"#00BCD4"}}/></div>
                <div style={{marginBottom:12}}><div className="lbl">Immagine sfondo</div><input type="file" accept="image/*" className="fi" style={{fontSize:10}} onChange={e=>loadImg(setBgImage,e)}/>{bgImage&&<div style={{fontSize:10,color:"#00BCD4",marginTop:2}}>✅</div>}</div>
                <div className="lbl" style={{marginBottom:8}}>Preset colori</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{[{bg:"#0d0d1a",a:"#00BCD4",l:"Cyan"},{bg:"#1a0a0a",a:"#FF5252",l:"Rosso"},{bg:"#0a1a0d",a:"#4CAF50",l:"Verde"},{bg:"#1a1505",a:"#FFC107",l:"Oro"},{bg:"#0d0a1a",a:"#9C27B0",l:"Viola"},{bg:"#f0f0f0",a:"#1a1a2e",l:"Chiaro"}].map(pr=>(<button key={pr.l} className="btn bs" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>{setBgColor(pr.bg);setElements(p=>p.map(e=>({...e,...(e.highlightColor!==undefined?{highlightColor:pr.a}:{}),
                  ...(e.id==="price"?{color:pr.a}:{}),
                  ...(pr.bg==="#f0f0f0"&&e.color==="#FFFFFF"?{color:"#1a1a2e"}:{}),
                  ...(pr.bg!=="#f0f0f0"&&e.color==="#1a1a2e"?{color:"#FFFFFF"}:{})})));}}><span style={{display:"inline-block",width:10,height:10,background:pr.bg,border:`2px solid ${pr.a}`,borderRadius:2,marginRight:4,verticalAlign:"middle"}}/>{pr.l}</button>))}</div>
              </div>

              <div style={{borderTop:"1px solid #1e1e30",paddingTop:12}}>
                <div style={{fontSize:12,fontWeight:800,color:"#00BCD4",marginBottom:10}}>🏷️ Logo</div>
                <div style={{marginBottom:12}}><div className="lbl">Immagine logo</div><input type="file" accept="image/png" className="fi" style={{fontSize:10}} onChange={e=>loadImg(setLogoImage,e)}/>{logoImage&&<div style={{fontSize:10,color:"#00BCD4",marginTop:2}}>✅</div>}</div>
                <div style={{marginBottom:10}}>
                  <div className="lbl">Posizione Logo</div>
                  <div className="row" style={{marginBottom:4}}><span style={{fontSize:9,width:12}}>X</span><input className="inp" type="number" value={logoPos.x} onChange={e=>setLogoPos(p=>({...p,x:+e.target.value}))} style={{padding:"3px 5px",fontSize:10}}/><span style={{fontSize:9,width:12}}>Y</span><input className="inp" type="number" value={logoPos.y} onChange={e=>setLogoPos(p=>({...p,y:+e.target.value}))} style={{padding:"3px 5px",fontSize:10}}/></div>
                  <div className="row"><span style={{fontSize:9,width:24}}>Scala</span><input type="range" min="0.02" max="1" step="0.01" value={logoPos.scale} onChange={e=>setLogoPos(p=>({...p,scale:+e.target.value}))} style={{flex:1,accentColor:"#00BCD4"}}/><span style={{fontSize:9,width:28,textAlign:"right"}}>{Math.round(logoPos.scale*100)}%</span></div>
                </div>
              </div>
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
                  <div style={{marginBottom:12}}>{elements.map(el=>(<div key={el.id} className={`elitem ${selectedEl===el.id?"on":""}`} onClick={()=>setSelectedEl(el.id)}><span>{el.id}</span><span style={{cursor:"pointer",opacity:el.visible?1:.3}} onClick={e=>{e.stopPropagation();setEl(el.id,"visible",!el.visible)}}>{el.visible?"👁":"🚫"}</span></div>))}</div>
                  {sel&&(<div className="card">
                    <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#00BCD4"}}>{sel.id}</div>
                    <div style={{marginBottom:8}}><div className="lbl">Font</div><div className="row"><select className="inp" value={sel.fontFamily} onChange={e=>setEl(sel.id,"fontFamily",e.target.value)} style={{flex:2}}>{FONTS.map(f=><option key={f}>{f}</option>)}</select><select className="inp" value={sel.fontWeight} onChange={e=>setEl(sel.id,"fontWeight",e.target.value)} style={{flex:1}}>{["400","600","700","800","900"].map(w=><option key={w}>{w}</option>)}</select><input className="inp" type="number" value={sel.fontSize} onChange={e=>setEl(sel.id,"fontSize",+e.target.value)} style={{width:50,flex:"none"}}/></div></div>
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
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"#08080d",overflow:"auto"}}>
            <canvas ref={canvasRef} width={CW} height={CH} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} style={{maxWidth:"min(100%,calc(100vh - 120px))",maxHeight:"calc(100vh - 120px)",borderRadius:8,boxShadow:"0 8px 40px rgba(0,0,0,.6)",cursor:dragging?"grabbing":"default"}}/>
          </div>
        </div>
      ) : (
        /* ==================== BATCH MODE — SETUP LAYOUT ==================== */
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          {/* LEFT SIDEBAR */}
          <div style={{width:380,background:"#0d0d16",borderRight:"1px solid #1a1a28",overflow:"auto",padding:12,display:"flex",flexDirection:"column",gap:10}}>

            {/* Offer list */}
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:"#777",textTransform:"uppercase",letterSpacing:".6px"}}>Offerte ({offers.length})</div>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn bp" style={{padding:"4px 10px",fontSize:11}} onClick={()=>addOffer(null)}>➕ Nuova</button>
                  <button className="btn bs" style={{padding:"4px 10px",fontSize:11}} onClick={dupFromCurrent}>📋 Copia</button>
                </div>
              </div>
              {offers.length===0&&(
                <div style={{textAlign:"center",padding:"20px 0",color:"#555",fontSize:12}}>Nessuna offerta ancora.</div>
              )}
              {offers.map((o,idx)=>(
                <div key={o.id} onClick={()=>setActiveOfferId(o.id)}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,marginBottom:4,cursor:"pointer",
                    background:activeOffer&&activeOffer.id===o.id?"#1a1a2e":"#0a0a14",
                    border:`1px solid ${activeOffer&&activeOffer.id===o.id?"#00BCD4":"#1e1e30"}`}}>
                  <div className="offer-num" style={{width:28,height:28,fontSize:12,flexShrink:0}}>{idx+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:o.carName?"#fff":"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.carName||"Nuova offerta"}</div>
                    {o.price&&<div style={{fontSize:10,color:"#00BCD4",fontWeight:700}}>{o.price} €/mese</div>}
                  </div>
                  <button className="btn bd" style={{padding:"3px 7px",fontSize:10,flexShrink:0}} onClick={e=>{e.stopPropagation();removeOffer(o.id);}}>🗑</button>
                </div>
              ))}
            </div>

            {/* Controls for active offer */}
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
          </div>

          {/* RIGHT: CANVAS */}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16,background:"#08080d",overflow:"auto",gap:16}}>
            {activeOffer?(
              <div style={{maxWidth:"min(100%,calc(100vh - 120px))",width:"100%"}}>
                <LiveCanvas offer={activeOffer} elements={elements} bgImage={bgImage} carImage={carImage} logoImage={logoImage} bgColor={bgColor} overlayOpacity={overlayOpacity} logoPos={logoPos} showGuides={showGuides}
                  onDragCar={(x,y)=>setOffers(p=>p.map(oo=>oo.id===activeOffer.id?{...oo,carX:x,carY:y}:oo))}
                  onDragExtra={(idx,x,y)=>setOffers(p=>p.map(oo=>oo.id===activeOffer.id?{...oo,extras:oo.extras.map((ex,i)=>i===idx?{...ex,x,y}:ex)}:oo))}/>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{fontSize:48}}>📦</div>
                <div style={{fontSize:16,color:"#666",textAlign:"center"}}>Nessuna offerta. Inizia aggiungendone una.</div>
                <div style={{display:"flex",gap:10}}>
                  <button className="btn bp" style={{padding:"12px 24px",fontSize:14}} onClick={()=>addOffer(null)}>➕ Nuova offerta</button>
                  <button className="btn bs" style={{padding:"12px 24px",fontSize:14}} onClick={dupFromCurrent}>📋 Copia da offerta singola</button>
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
