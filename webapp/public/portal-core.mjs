const L=(typeof window!=='undefined'&&window.RimmaLocale)||{locale:'es-ES',currency:'EUR'};

export const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));

export const uuid=value=>/^[a-f0-9-]{36}$/i.test(String(value||""));

export const moneyMinor=value=>{
 const n=Number(value);
 if(!Number.isFinite(n)||n<=0||Math.round(n*100)>9000000000000)throw Error("El importe debe ser positivo y válido.");
 const cents=Math.round(n*100);
 if(!Number.isSafeInteger(cents))throw Error("El importe no es válido.");
 return cents;
};

export const money=(value,currency=L.currency||"EUR")=>{
 try{
  return new Intl.NumberFormat(L.locale||"es-ES",{style:"currency",currency}).format(Number(value||0)/100);
 }catch{
  return esc(value)+" "+esc(currency);
 }
};

export const localDate=value=>{
 if(!value)return "—";
 const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(match)return match[3]+"/"+match[2]+"/"+match[1];
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?String(value):parsed.toLocaleDateString(L.locale||"es-ES");
};

export const localDateTime=value=>{
 if(!value)return "—";
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())
  ? String(value)
  : parsed.toLocaleString(L.locale||"es-ES",{dateStyle:"short",timeStyle:"short"});
};

export const choice=(value,options)=>options.map(([id,label])=>
 '<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(label)+'</option>'
).join("");

export const b=(label,action,data="",extra="")=>
 '<button type="button" class="feature-button" data-feature="'+action+'" '+data+' '+extra+'>'+label+'</button>';

export const select=(id,label,options)=>
 '<label for="fx-'+id+'">'+label+'</label><select id="fx-'+id+'" name="'+id+'">'+options+'</select>';

export const field=(id,label,type="text",extra="")=>
 '<label for="fx-'+id+'">'+label+'</label><input id="fx-'+id+'" name="'+id+'" type="'+type+'" '+extra+'>';

export const textarea=(id,label,limit)=>
 '<label for="fx-'+id+'">'+label+'</label><textarea id="fx-'+id+'" name="'+id+'" maxlength="'+limit+'"></textarea>';
