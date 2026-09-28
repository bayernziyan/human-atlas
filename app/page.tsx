import {flushSync} from 'react-dom';
import {registerAtlasTools} from './agent-tools';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Activity,ArrowUpRight,ChevronRight,Focus,Info,Layers3,Pause,RotateCcw,RotateCw,Search,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import AnatomyScene from './scene';
import {DEFAULT_VISIBLE,SYSTEMS,explanation,localizedName,type Atlas,type Concept,type SceneState,type SystemId,type View,systemName} from './anatomy';
import {SUPPORTED_LANGUAGES,getCurrentLanguage,setLanguage,type SupportedLanguage} from '@/lib/i18n';
const initial:SceneState={explode:0,visible:DEFAULT_VISIBLE,selected:[],isolate:false,view:'three-quarter',rotate:false,reset:0};
const VIEW_LABEL_KEYS:Record<View,string>={
 'three-quarter':'view.labelThreeQuarter',
 'front':'view.labelFront',
 'side':'view.labelSide',
 'back':'view.labelBack',
};
const VIEW_TITLE_KEYS:Record<View,string>={
 'three-quarter':'view.threeQuarter',
 'front':'view.front',
 'side':'view.side',
 'back':'view.back',
};

function LanguageSwitcher(){
 const {t,i18n}=useTranslation();
 const [current,setCurrent]=useState<SupportedLanguage>(getCurrentLanguage());
 useEffect(()=>{
  const onLangChanged=()=>setCurrent(getCurrentLanguage());
  i18n.on('languageChanged',onLangChanged);
  return()=>{i18n.off('languageChanged',onLangChanged);};
 },[i18n]);
 const labels:Record<SupportedLanguage,{code:string;native:string;en:string}>={
  en:{code:'EN',native:'English',en:'English'},
  'zh-CN':{code:'中',native:'简体中文',en:'Simplified Chinese'},
 };
 return <div className="lang-switcher" role="group" aria-label={t('language.switcher')}>
  {SUPPORTED_LANGUAGES.map(lang=>{
   const info=labels[lang];
   const active=lang===current;
   return <button key={lang} type="button" className={`lang-pill ${active?'active':''}`} aria-pressed={active} aria-label={`${info.en} (${info.native})`} title={`${info.en} (${info.native})`} onClick={()=>setLanguage(lang)}>
    <span className="lang-code">{info.code}</span>
    <span className="lang-name">{info.native}</span>
   </button>;
  })}
 </div>;
}

function LanguageToast(){
 const {t,i18n}=useTranslation();
 const [visible,setVisible]=useState(false);
 const [current,setCurrent]=useState<SupportedLanguage>(getCurrentLanguage());
 const dismissedRef=useRef(false);
 useEffect(()=>{
  if(typeof window==='undefined')return;
  if(window.sessionStorage.getItem('human-atlas-lang-toast')==='1'){dismissedRef.current=true;return;}
  const showTimer=window.setTimeout(()=>{
   if(!dismissedRef.current)setVisible(true);
  },800);
  const hideTimer=window.setTimeout(()=>{
   setVisible(false);
   try{window.sessionStorage.setItem('human-atlas-lang-toast','1');}catch{}
  },8000);
  return()=>{window.clearTimeout(showTimer);window.clearTimeout(hideTimer);};
 },[]);
 useEffect(()=>{
  const onLangChanged=()=>{
   setCurrent(getCurrentLanguage());
   setVisible(false);
   try{window.sessionStorage.setItem('human-atlas-lang-toast','1');}catch{}
  };
  i18n.on('languageChanged',onLangChanged);
  return()=>{i18n.off('languageChanged',onLangChanged);};
 },[i18n]);
 if(current!=='en')return null;
 const switchTo=()=>{
  setLanguage('zh-CN');
 };
 const dismiss=()=>{
  setVisible(false);
  try{window.sessionStorage.setItem('human-atlas-lang-toast','1');}catch{}
 };
 return <div className={`lang-toast ${visible?'show':''}`} role="status" aria-live="polite">
  <span>{t('language.toast')}</span>
  <button type="button" className="lang-toast-action" onClick={switchTo}>{t('language.chinese')}</button>
  <button type="button" className="lang-toast-action" onClick={dismiss} aria-label={t('language.toastDismiss')}>×</button>
 </div>;
}

export default function Home(){
 const {t,i18n}=useTranslation();
 const detailTitle=useRef<HTMLHeadingElement>(null);
 const [atlas,setAtlas]=useState<Atlas|null>(null),[state,setState]=useState(initial),[progress,setProgress]=useState(0),[error,setError]=useState(''),[panel,setPanel]=useState<'layers'|'search'|null>(null),[details,setDetails]=useState(false),[about,setAbout]=useState(false),[query,setQuery]=useState(''),[chosen,setChosen]=useState<Concept|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  setProgress(0);setError('');setAtlas(null);setChosen(null);setDetails(false);setState({...initial,visible:DEFAULT_VISIBLE});
  fetch('/models/atlas.json',{signal:abort.signal}).then(r=>{
   if(!r.ok)throw new Error(t('error.loadCatalogue'));
   return r.json();
  }).then(data=>setAtlas(data as Atlas)).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
  return()=>abort.abort();
 },[t]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==='/'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){e.preventDefault();setPanel('search');setDetails(false);}};
  window.addEventListener('keydown',key);
  return()=>window.removeEventListener('keydown',key);
 },[]);
 useEffect(()=>{if(typeof document!=='undefined')document.documentElement.lang=i18n.language;},[i18n.language]);
 const parts=useMemo(()=>new Map(atlas?.parts.map(p=>[p.id,p])),[atlas]);
 const conceptSystem=useMemo(()=>{const m=new Map<string,SystemId>();if(atlas)for(const p of atlas.parts)if(!m.has(p.conceptId))m.set(p.conceptId,p.system);return m;},[atlas]);
 const counts=useMemo(()=>Object.fromEntries(SYSTEMS.map(s=>[s.id,atlas?.parts.filter(p=>p.system===s.id).length??0])),[atlas]);
 const activeSystems=SYSTEMS.filter(s=>counts[s.id]>0);
 const selectedParts=state.selected.map(id=>parts.get(id)).filter(p=>!!p),selected=selectedParts[0],system=SYSTEMS.find(s=>s.id===selected?.system);
 const visibleCount=atlas?.parts.filter(p=>state.isolate?state.selected.includes(p.id):state.visible.includes(p.system)||state.selected.includes(p.id)).length??0;
 const results=useMemo(()=>{
  if(!atlas)return[];
  const term=query.toLowerCase().trim();
  if(!term)return ['heart','brain','liver','stomach','spleen','pancreas','urinary bladder','trachea'].map(name=>atlas.concepts.find(c=>c.name.toLowerCase()===name)).filter((x):x is Concept=>!!x);
  return atlas.concepts.filter(c=>{
   const en=c.name.toLowerCase();
   if(en.includes(term))return true;
   if(c.id.toLowerCase().includes(term))return true;
   const local=localizedName(c.name,conceptSystem.get(c.id)).toLowerCase();
   return local.includes(term);
  }).sort((a,b)=>a.name.length-b.name.length).slice(0,80);
 },[atlas,query,i18n.language]);
 const choose=(c:Concept)=>{setChosen(c);setState(s=>({...s,selected:c.elements,isolate:false,rotate:false}));setDetails(true);setPanel(null);};
 useEffect(()=>{if(!atlas)return;return registerAtlasTools(atlas,c=>flushSync(()=>choose(c)));},[atlas]);
 const choosePart=(id:string)=>{const p=parts.get(id);if(!p)return;setChosen({id:p.conceptId,name:p.name,elements:[id]});setState(s=>({...s,selected:[id],isolate:false,rotate:false}));setDetails(true);setPanel(null);};
 const toggle=(id:SystemId)=>{setDetails(false);setState(s=>({...s,selected:[],isolate:false,visible:s.visible.includes(id)?s.visible.filter(x=>x!==id):[...s.visible,id]}));};
 const reset=()=>{setState(s=>({...s,reset:s.reset+1}));setChosen(null);setDetails(false);setPanel(null);};
 const openPanel=(next:'layers'|'search')=>{setDetails(false);setPanel(p=>p===next?null:next);};
 const presetAll=()=>setState(s=>({...s,selected:[],isolate:false,visible:activeSystems.map(x=>x.id)}));
 const presetSkeleton=()=>setState(s=>({...s,selected:[],isolate:false,visible:['skeletal']}));
 const presetOrgans=()=>setState(s=>({...s,selected:[],isolate:false,visible:['cardiac','respiratory','digestive','urinary','endocrine','reproductive']}));
 const identityMeta=atlas?t('app.subtitle',{n:atlas.parts.length.toLocaleString()}):t('app.subtitleCountFallback');
 const progressLabel=atlas?t('loading.progress',{pct:progress,n:atlas.parts.length.toLocaleString()}):t('loading.progressFallback',{pct:progress});
 return <main className="studio">
  {atlas&&<AnatomyScene atlas={atlas} state={{...state,inspectorOpen:details&&selectedParts.length>0}} onSelect={choosePart} onProgress={n=>{setProgress(n);if(n===100)setError('');}} onError={setError}/>}
  <div className="vignette"/>
  <header className="identity"><div className="eyebrow"><span className="status-dot"/> {t('app.eyebrow')}</div><h1>{t('app.title')}<Badge variant="outline" className="edition">3D</Badge></h1><div className="identity-meta">{identityMeta}</div></header>
  <nav className="top-actions" aria-label={t('nav.explorerPanels')}><LanguageSwitcher/><Button variant="ghost" className={panel==='search'?'active':''} onClick={()=>openPanel('search')} aria-label={t('nav.search')}><Search size={18}/><span>{t('nav.search')}</span><kbd>/</kbd></Button><Button variant="ghost" className="icon-button" aria-label={t('nav.about')} onClick={()=>{setDetails(false);setPanel(null);setAbout(true);}}><Info size={18}/></Button></nav>
  <section className={`layers-panel glass ${panel==='layers'?'mobile-open':''}`} aria-label={t('layers.panelAria')}>
   <div className="panel-heading"><span>{t('layers.heading')}</span><Button variant="ghost" className="mobile-only icon-button" onClick={()=>setPanel(null)} aria-label={t('layers.close')}><X size={18}/></Button><Badge variant="secondary" className="desktop-only small-number">{activeSystems.length}</Badge></div>
   <div className="layer-presets"><Button variant="ghost" aria-pressed={activeSystems.every(x=>state.visible.includes(x.id))} onClick={presetAll}>{t('layers.presetAll')}</Button><Button variant="ghost" aria-pressed={state.visible.length===1&&state.visible[0]==='skeletal'} onClick={presetSkeleton}>{t('layers.presetSkeleton')}</Button><Button variant="ghost" aria-pressed={state.visible.length===6&&['cardiac','respiratory','digestive','urinary','endocrine','reproductive'].every(id=>state.visible.includes(id as SystemId))} onClick={presetOrgans}>{t('layers.presetOrgans')}</Button></div>
   <div className="system-list">{activeSystems.map(s=>{const localized=systemName(s.id);return <div className={`system-row ${state.visible.includes(s.id)?'enabled':''}`} key={s.id}><Button variant="ghost" className="system-name" title={t('layers.showOnly',{name:localized})} onClick={()=>setState(v=>({...v,visible:[s.id],isolate:false,selected:[]}))}><span className="system-dot" style={{background:s.color}}/>{localized}<span className="system-count">{counts[s.id]}</span></Button><Switch checked={state.visible.includes(s.id)} onCheckedChange={()=>toggle(s.id)} aria-label={t('layers.show',{name:localized})} /></div>;})}</div>
   <div className="panel-foot"><span>{t('piece.visibleCount',{n:visibleCount.toLocaleString()})}</span><Button variant="ghost" onClick={()=>setState(s=>({...s,visible:[],selected:[],isolate:false}))}>{t('layers.hideAll')}</Button></div>
  </section>
  {panel==='search'&&<section className="search-panel glass" aria-label={t('search.panelAria')}><div className="panel-heading"><span>{t('search.heading')}</span><Button variant="ghost" className="icon-button" onClick={()=>setPanel(null)} aria-label={t('search.close')}><X size={18}/></Button></div><Combobox<Concept> items={results} value={null} onValueChange={value=>{if(value)choose(value);}} inputValue={query} onInputValueChange={setQuery} itemToStringLabel={c=>c.name} filter={null} open onOpenChange={open=>{if(!open)setPanel(null);}}><ComboboxInput autoFocus placeholder={t('search.inputPlaceholder')} aria-label={t('search.inputAria')} showTrigger={false}/><ComboboxContent className="anatomy-search-results"><ComboboxEmpty>{t('search.empty')}</ComboboxEmpty><ComboboxList>{(c:Concept)=><ComboboxItem key={c.id} value={c}><span className="search-result-name">{localizedName(c.name,conceptSystem.get(c.id))}</span><span className="small-number">{t('piece.count',{count:c.elements.length})}</span></ComboboxItem>}</ComboboxList></ComboboxContent></Combobox><p className="search-note">{query?t('search.noteWithQuery'):t('search.noteEmpty')}</p></section>}
  <nav className="view-controls glass" aria-label={t('nav.cameraControls')}>{(['three-quarter','front','side','back'] as View[]).map(v=><Button variant="ghost" key={v} className={state.view===v?'active':''} aria-pressed={state.view===v} disabled={state.explode>.8&&v!=='front'} onClick={()=>setState(s=>({...s,view:v,reset:s.reset+1,rotate:false}))} title={t(VIEW_TITLE_KEYS[v])} aria-label={t(VIEW_TITLE_KEYS[v])}><span>{t(VIEW_LABEL_KEYS[v])}</span></Button>)}<i/><Button variant="ghost" disabled={state.explode>=.4} aria-label={state.rotate?t('view.pause'):t('view.rotate')} title={t('view.rotateTitle')} className={state.rotate?'active':''} onClick={()=>setState(s=>({...s,rotate:!s.rotate}))}>{state.rotate?<Pause size={17}/>:<RotateCw size={18}/>}</Button><Button variant="ghost" aria-label={t('view.reset')} title={t('view.reset')} onClick={reset}><RotateCcw size={17}/></Button></nav>
  <div className="scene-caption"><span className="caption-line"/><span>{state.isolate?(chosen?.name??t('caption.selected')):state.explode>.95?t('caption.inventory'):state.explode>.05?t('caption.separated'):t('caption.assembled')}</span><span className="caption-line"/></div>
  <div className="bottom-dock glass"><Button variant="ghost" className="mobile-only dock-layers" onClick={()=>openPanel('layers')} aria-label={t('dock.openLayers')}><Layers3 size={20}/><span>{t('dock.systems')}</span></Button><div className="explode-control"><div className="explode-label"><label id="explode-label">{t('dock.explodeLabel')}</label><output>{Math.round(state.explode*100)}<span>{t('dock.explodeSuffix')}</span></output></div><Slider aria-labelledby="explode-label" min={0} max={100} step={1} value={[state.explode*100]} onValueChange={v=>setState(s=>({...s,explode:(Array.isArray(v)?v[0]:v)/100,view:(Array.isArray(v)?v[0]:v)>80?'front':s.view,rotate:false}))}/><div className="slider-endpoints"><span>{t('dock.assembled')}</span><span>{t('dock.everyPiece')}</span></div></div><Button variant="ghost" className="dock-reset" onClick={reset} aria-label={t('dock.resetAria')}><RotateCcw size={18}/><span>{t('dock.reset')}</span></Button></div>
  <footer className="studio-footer"><span>{state.explode>.8?t('footer.dragPan'):t('footer.dragOrbit')} <b>·</b> {t('footer.pinch')} <b>·</b> {t('footer.tap')}</span><Button variant="ghost" onClick={()=>{setDetails(false);setPanel(null);setAbout(true);}}>{t('footer.credits')} <ArrowUpRight size={12}/></Button></footer>
  {progress<100&&!error&&<div className="loading glass" role="status"><Activity size={18}/><div><strong>{t('loading.title')}</strong><span>{progressLabel}</span><div className="loading-track"><i style={{width:`${progress}%`}}/></div></div></div>}
  {error&&<div className="loading glass error" role="alert"><p>{error}</p><Button variant="ghost" onClick={()=>location.reload()}>{t('loading.reload')}</Button></div>}
  <Sheet open={details&&selectedParts.length>0} modal={false} disablePointerDismissal onOpenChange={setDetails}><SheetContent initialFocus={detailTitle} className={`detail-sheet glass ${state.isolate?'is-isolated':''}`} showCloseButton={true}><div className="detail-header"><div className="detail-accent" style={{background:system?.color}}/><div className="eyebrow">{system?systemName(system.id):t('detail.eyebrowFallback')}</div><SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">{chosen?localizedName(chosen.name, system?.id):''}</SheetTitle></div><div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}><SheetDescription className="structure-description">{chosen&&selected?explanation(chosen.name,selected.system):''}</SheetDescription>{chosen&&!t(`explanations.${chosen.name.toLowerCase()}`,{defaultValue:''})&&<span className="context-note">{t('detail.contextNote')}</span>}<div className="structure-meta"><span>{t('detail.atlasReference')}<strong>{chosen?.id}</strong></span><span>{t('detail.selectedPieces')}<strong>{state.selected.length.toLocaleString()}</strong></span></div>{selectedParts.length>1&&<div className="member-list"><h3>{t('detail.includedStructures')}</h3>{selectedParts.slice(0,50).map(p=><Button variant="ghost" key={p.id} onClick={()=>choosePart(p.id)}><span>{localizedName(p.name, p.system)}</span><ChevronRight size={14}/></Button>)}{selectedParts.length>50&&<p>{t('detail.andMore',{n:selectedParts.length-50})}</p>}</div>}<a className="source-link" href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">{t('detail.viewSource')} <ArrowUpRight size={14}/></a></div><div className="detail-actions"><Button className={`primary-action ${state.isolate?'active':''}`} onClick={()=>setState(s=>({...s,isolate:!s.isolate,explode:0}))}><Focus size={18}/>{state.isolate?t('detail.showSurrounding'):t('detail.isolate')}<ChevronRight size={16}/></Button><Button variant="ghost" className="secondary-action" onClick={()=>{setState(s=>({...s,selected:[],isolate:false}));setDetails(false);}}>{t('detail.clear')}</Button></div></SheetContent></Sheet>
  <Sheet open={about} onOpenChange={setAbout}><SheetContent className="about-sheet glass"><div className="eyebrow">{t('about.eyebrow')}</div><SheetTitle className="structure-title">{t('about.title')}</SheetTitle><SheetDescription>{t('about.lede')}</SheetDescription><div className="about-copy"><p><strong>{t('about.sectionTitle')}</strong><br/>{t('about.sectionBody')}</p><p>{t('about.scope')}</p><p>{t('about.detail')}</p><h3>{t('about.sourceHeading')}</h3><p>{t('about.sourceBody')}</p><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">{t('about.datasetLicense')} <ArrowUpRight size={14}/></a><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">{t('about.originalGeometry')} <ArrowUpRight size={14}/></a><a href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" target="_blank" rel="noreferrer">{t('about.sourcePublication')} <ArrowUpRight size={14}/></a></div></SheetContent></Sheet>
  <LanguageToast/>
 </main>;
}