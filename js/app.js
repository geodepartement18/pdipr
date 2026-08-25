const URL="https://services-eu1.arcgis.com/BskcOcOpYAUZPEMQ/ArcGIS/rest/services/pdipr_cher/FeatureServer/0";
const state={all:null,filtered:[],fields:{},filter:"ALL",search:"",selected:null,selectedLayer:null,geo:null};
const $=id=>document.getElementById(id);
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
function field(fields,names){const m=new Map(fields.map(x=>[x.name.toLowerCase(),x.name]));for(const n of names){if(m.has(n.toLowerCase()))return m.get(n.toLowerCase())}return null}
function val(f,k){return state.fields[k]?f.properties?.[state.fields[k]]:null}
function km(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString("fr-FR",{maximumFractionDigits:2}):"—"}
function practice(v,w){if(w==="ALL")return true;const a=norm(v),b=norm(w);return b==="cyclo et pedestre"?a.includes("cyclo")&&a.includes("pedestre"):a===b||a.includes(b)}
function id(f){return f.id??f.properties?.OBJECTID??f.properties?.objectid}
function style(){return{color:"#1769aa",weight:4,opacity:.85}}
function selectedStyle(){return{color:"#d14900",weight:7,opacity:1}}
function popup(f){return `<div class="popup-title">${esc(val(f,"title")||"Itinéraire")}</div><div class="popup-line">${esc(val(f,"commune")||"")}</div><div class="popup-line">${esc(val(f,"practice")||"")} ${val(f,"distance")!=null?"• "+km(val(f,"distance"))+" km":""}</div><button class="consult" data-id="${esc(id(f))}">Consulter</button>`}
function render(){const list=$("itineraryList");list.innerHTML="";if(!state.filtered.length){$("emptyNotice").classList.add("visible");return}$("emptyNotice").classList.remove("visible");for(const f of state.filtered){const i=document.createElement("calcite-list-item");i.label=val(f,"title")||"Itinéraire";i.description=[val(f,"commune"),val(f,"distance")!=null?km(val(f,"distance"))+" km":"",val(f,"practice")].filter(Boolean).join(" • ");i.dataset.id=id(f);list.appendChild(i)}}
function stats(){let total=0;state.filtered.forEach(f=>{const n=Number(val(f,"distance"));if(Number.isFinite(n))total+=n});$("countDisplayed").textContent=state.filtered.length.toLocaleString("fr-FR");$("totalDistance").textContent=total.toLocaleString("fr-FR",{maximumFractionDigits:2});$("footerTotal").textContent=state.filtered.length.toLocaleString("fr-FR");$("footerSelection").textContent=state.selected?"1 sélection":"Aucune sélection"}
function select(f,l,zoom=true){if(state.selectedLayer&&state.selectedLayer!==l)state.selectedLayer.setStyle(style());state.selected=f;state.selectedLayer=l;l.setStyle(selectedStyle());stats();if(zoom&&l.getBounds().isValid())map.fitBounds(l.getBounds(),{padding:[30,30],maxZoom:14})}
function detail(f){const defs=[["Commune","commune"],["Pratique","practice"],["Type","type"],["Distance","distance"],["Durée","duration"],["Dénivelé","elevation"],["Gestionnaire","manager"],["Observations","observations"],["Identifiant","id"]];const html=defs.map(([a,k])=>{let v=val(f,k);if(v==null||v==="")return"";if(k==="distance")v=km(v)+" km";return `<div class="detail-field"><span class="detail-label">${a}</span><span class="detail-value">${esc(v)}</span></div>`}).join("");$("detailDialog").heading=val(f,"title")||"Itinéraire";$("detailContent").innerHTML=`<div class="detail-grid">${html}</div>`;$("detailDialog").open=true}
function apply(){const q=norm(state.search);state.filtered=state.all.features.filter(f=>practice(val(f,"practice"),state.filter)&&(!q||[val(f,"title"),val(f,"commune"),val(f,"id"),val(f,"practice"),val(f,"type")].map(norm).join(" ").includes(q)));if(state.geo)state.geo.remove();state.geo=L.geoJSON({type:"FeatureCollection",features:state.filtered},{style:style,onEachFeature:(f,l)=>{l.bindPopup(popup(f));l.on("click",()=>select(f,l,true))}}).addTo(map);render();stats()}
async function load(){const meta=await (await fetch(URL+"?f=json")).json();if(meta.error)throw Error(meta.error.message);const c={id:["code_iti","id_iti","objectid"],title:["nom_iti","nom","libelle","name"],practice:["pratique","type_pratique"],commune:["nom_com","commune"],distance:["dist","distance","longueur"],duration:["duree","durée"],type:["type_iti","type"],elevation:["denivele","dénivelé"],manager:["gestionnaire"],observations:["obs","observation"]};for(const [k,v] of Object.entries(c))state.fields[k]=field(meta.fields||[],v);const p=new URLSearchParams({where:"1=1",outFields:"*",returnGeometry:"true",outSR:"4326",f:"geojson"});state.all=await(await fetch(URL+"/query?"+p)).json();if(state.all.error)throw Error(state.all.error.message);apply()}
const map=L.map("map",{zoomControl:false,preferCanvas:true}).setView([46.95,2.5],9);
L.control.zoom({position:"topright"}).addTo(map);
const osm=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors",maxZoom:19}).addTo(map);
const topo=L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors, SRTM | OpenTopoMap",maxZoom:17});
const imagery=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{attribution:"Tiles © Esri"});
L.control.layers({"OpenStreetMap":osm,"OpenTopoMap":topo,"Esri World Imagery":imagery},{},{position:"topright"}).addTo(map);
L.control.scale({imperial:false}).addTo(map);
$("practiceFilter").addEventListener("calciteSegmentedControlChange",e=>{state.filter=e.target.value;apply()});
$("itinerarySearch").addEventListener("calciteInputInput",e=>{state.search=e.target.value;apply()});
$("itineraryList").addEventListener("calciteListItemSelect",e=>{const f=state.all.features.find(x=>String(id(x))===String(e.target.selectedItems?.[0]?.dataset?.id));if(f){const l=state.geo.getLayers().find(x=>String(id(x.feature))===String(id(f)));if(l)select(f,l,true)}});
map.on("popupopen",e=>{const b=e.popup.getElement()?.querySelector(".consult");if(b)b.onclick=()=>{const f=state.all.features.find(x=>String(id(x))===String(b.dataset.id));if(f)detail(f)}});
$("fitAll").onclick=()=>state.geo?.getBounds().isValid()&&map.fitBounds(state.geo.getBounds(),{padding:[25,25]});
$("togglePanel").onclick=()=>{$("catalogPanel").collapsed=!$("catalogPanel").collapsed};
$("locateButton").onclick=()=>map.locate({setView:true,maxZoom:13,enableHighAccuracy:true});
map.on("locationfound",e=>L.circleMarker(e.latlng,{radius:8,color:"#1769aa",fillOpacity:.8}).addTo(map).bindPopup("Vous êtes ici.").openPopup());
map.on("locationerror",e=>{$("errorAlert").message=e.message;$("errorAlert").open=true});
$("printButton").onclick=()=>window.print();
$("aboutAction").onclick=()=>$("aboutDialog").open=true;
$("helpAction").onclick=()=>$("helpDialog").open=true;
$("closeDetail").onclick=()=>$("detailDialog").open=false;
(async()=>{try{$("loader").active=true;await load();$("loader").active=false;if(state.geo?.getBounds().isValid())map.fitBounds(state.geo.getBounds(),{padding:[25,25]})}catch(e){console.error(e);$("loader").active=false;$("errorAlert").message=e.message||String(e);$("errorAlert").open=true}})();

