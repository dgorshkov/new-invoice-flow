const { useState, useCallback, useRef, useMemo, useEffect } = React;

/* ═══════════════════════════════════════════════════════════════════════════
   VAT DATA — 7 Finom markets, rates as of 26 Feb 2026
   ═══════════════════════════════════════════════════════════════════════════ */
const VAT = {
  DE:{name:"Germany",flag:"🇩🇪",std:19,cur:"EUR",
    rates:[{r:19,l:"Standard"},{r:7,l:"Reduced"},{r:0,l:"Zero-rated"}],
    cats:{19:["Electronics","Clothing","Appliances","Professional services","Restaurant beverages","Cars","Software","Consulting","Cosmetics","Goods"],7:["Food (restaurant)","Books & e-books","Newspapers","Public transport","Art & collectibles","Medical supplies","Cinema","Hotel accommodation"],0:["Photovoltaic ≤30kW","Exports","Intra-EU B2B"]},
    ex:{name:"Kleinunternehmerregelung",short:"Kleinunternehmer",ref:"§ 19 UStG",thresh:"Prior yr ≤€25k AND current yr ≤€100k",mention:"Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG"},
    taxIdLabel:"Steuernummer",taxIdPlaceholder:"12/345/67890",vatPrefix:"DE"},
  FR:{name:"France",flag:"🇫🇷",std:20,cur:"EUR",
    rates:[{r:20,l:"Standard"},{r:10,l:"Intermediate"},{r:5.5,l:"Reduced"},{r:2.1,l:"Super-reduced"},{r:0,l:"Zero-rated"}],
    cats:{20:["Most services","Alcohol","Clothing","Cosmetics","Cars","Fuels","Appliances","Luxury goods","Professional services","Software","Consulting","Goods"],10:["Restaurant meals","Hotel accommodation","Transport","Construction work","Catering","Takeaway"],5.5:["Food (later consumption)","Water","Books & e-books","Gas/electricity","Art","Cinema","Sporting events","Medical devices"],2.1:["Pharmaceuticals","Blood products","Newspapers","TV licenses"],0:["Exports","Intra-EU B2B"]},
    ex:{name:"Franchise en base de TVA",short:"Franchise en base",ref:"Art. 293 B CGI",thresh:"Services ≤€37.5k · Goods ≤€85k",mention:"TVA non applicable, art. 293 B du CGI"},
    taxIdLabel:"SIRET",taxIdPlaceholder:"123 456 789 00012",vatPrefix:"FR"},
  IT:{name:"Italy",flag:"🇮🇹",std:22,cur:"EUR",
    rates:[{r:22,l:"Standard"},{r:10,l:"Reduced"},{r:5,l:"Reduced (lower)"},{r:4,l:"Super-reduced"},{r:0,l:"Non imponibile"}],
    cats:{22:["Electronics","Clothing","Appliances","Professional services","Restaurant meals","Cars","Software","Consulting","Goods"],10:["Hotel","Tourism restaurant","Electricity/gas domestic","Building renovation","Certain medicines"],5:["Social/health services","Some foods","Medical equipment","Art/antiques","Performances"],4:["Basic groceries","Books & e-books","Periodicals & e-books","Medical aids","Newspapers"],0:["Exports","Intra-EU B2B"]},
    ex:{name:"Regime Forfettario",short:"Forfettario",ref:"L.190/2014 §54-89",mention:"Operazione in regime forfettario — L. 190/2014, commi 54-89"},
    taxIdLabel:"Codice Fiscale",taxIdPlaceholder:"RSSMRA85M01H501Z",vatPrefix:"IT"},
  ES:{name:"Spain",flag:"🇪🇸",std:21,cur:"EUR",
    rates:[{r:21,l:"Standard"},{r:10,l:"Reduced"},{r:4,l:"Super-reduced"},{r:0,l:"Zero-rated"}],
    cats:{21:["Most services","Beauty","Electronics","Clothing","Telecom","Electricity","Professional services","Consulting","Software","Goods"],10:["Cultural activities","Restaurant meals","Hotels","Transport","Agriculture","Refurbishment"],4:["Essential foods","Books & e-books","Certain newspapers","Subsidised housing","Prosthetics","Certain pharma"],0:["Exports","Intra-EU B2B"]},
    ex:null,taxIdLabel:"CIF/NIF",taxIdPlaceholder:"B12345678",vatPrefix:"ES"},
  NL:{name:"Netherlands",flag:"🇳🇱",std:21,cur:"EUR",
    rates:[{r:21,l:"Standard"},{r:9,l:"Reduced"},{r:0,l:"Zero-rated"}],
    cats:{21:["Most goods/services","Accommodation (from Jan 2026)","Cultural/sports (from Jan 2026)","Electronics","Clothing","Professional services","Consulting","Software","Goods"],9:["Food & drink","Agriculture","Medicines","Books & e-books","Newspapers","Art/collectibles","Takeaway","Cafés","Domestic transport","Hairdressing"],0:["Exports","Intra-EU B2B"]},
    ex:{name:"Kleineondernemersregeling",short:"KOR",ref:"Art.25 Wet OB",thresh:"Turnover ≤€20k",mention:"Vrijgesteld van OB o.g.v. artikel 25 Wet OB"},
    taxIdLabel:"KVK-nummer",taxIdPlaceholder:"12345678",vatPrefix:"NL"},
  BE:{name:"Belgium",flag:"🇧🇪",std:21,cur:"EUR",
    rates:[{r:21,l:"Standard"},{r:12,l:"Intermediate"},{r:6,l:"Reduced"},{r:0,l:"Zero-rated"}],
    cats:{21:["Most goods/services","Pesticides (Mar 2026)","Electronics","Clothing","Professional services","Consulting","Software","Goods"],12:["Restaurant food (excl. alcohol)","Social housing","Hotel/camping (Mar 2026)","Non-alc beverages (Mar 2026)"],6:["Basic food","Water","Pharma & medical devices","Books & e-books","Newspapers","Bike/shoe repairs"],0:["Exports","Intra-EU B2B"]},
    ex:{name:"Franchise de la taxe",short:"Franchise",ref:"Art.56bis CTVA",thresh:"Turnover ≤€25k (10% tolerance)",mention:"Petite entreprise — régime de franchise de taxe, TVA non applicable"},
    taxIdLabel:"BCE/KBO",taxIdPlaceholder:"0123.456.789",vatPrefix:"BE"},
  FI:{name:"Finland",flag:"🇫🇮",std:25.5,cur:"EUR",
    rates:[{r:25.5,l:"Standard"},{r:13.5,l:"Reduced (2026)"},{r:10,l:"Reduced (lower)"},{r:0,l:"Zero-rated"}],
    cats:{25.5:["Most goods/services","Consulting","Marketing","Design","IT","Electronics","Clothing","Professional services","Software","Goods"],13.5:["Food & beverages","Animal feed","Restaurant/catering","Accommodation","Transport","Books & e-books","Cultural/entertainment/sports","Fitness"],10:["Newspapers & magazines","Certain pharma"],0:["Exports","Intra-EU B2B"]},
    ex:{name:"Vähäinen liiketoiminta",short:"Small business",ref:"AVL 3 §",thresh:"Turnover ≤€20k",mention:"AVL 3 §:n mukainen vähäinen liiketoiminta"},
    taxIdLabel:"Y-tunnus",taxIdPlaceholder:"1234567-8",vatPrefix:"FI"},
};

const CLIENTS = [
  {id:1,name:"TechVentures GmbH",country:"DE",eu:true,biz:true,vatId:"DE312456789",addr:"Friedrichstraße 123, 10117 Berlin"},
  {id:2,name:"Atelier Lumière SARL",country:"FR",eu:true,biz:true,vatId:"FR82123456789",addr:"42 Rue de Rivoli, 75001 Paris"},
  {id:3,name:"Mario Rossi",country:"IT",eu:true,biz:false,vatId:null,addr:"Via Roma 15, 20121 Milano"},
  {id:4,name:"Nordic Digital Oy",country:"FI",eu:true,biz:true,vatId:"FI12345678",addr:"Mannerheimintie 10, 00100 Helsinki"},
  {id:5,name:"Smith & Partners Ltd",country:"GB",eu:false,biz:true,vatId:"GB123456789",addr:"1 King's Road, London SW3 4RP"},
  {id:6,name:"Jane Cooper",country:"US",eu:false,biz:false,vatId:null,addr:"350 Fifth Ave, New York, NY 10118"},
  {id:7,name:"Bakkerij de Windmolen BV",country:"NL",eu:true,biz:true,vatId:"NL123456789B01",addr:"Keizersgracht 452, 1016 Amsterdam"},
  {id:8,name:"López Consulting S.L.",country:"ES",eu:true,biz:true,vatId:"ESB12345678",addr:"Gran Vía 28, 28013 Madrid"},
  {id:9,name:"Brussels Creative ASBL",country:"BE",eu:true,biz:true,vatId:"BE0123456789",addr:"Av. Louise 54, 1050 Bruxelles"},
  {id:10,name:"Yuki Tanaka",country:"JP",eu:false,biz:false,vatId:null,addr:"Shibuya-ku, Tokyo 150-0002"},
];

const CATALOGUE = [
  {id:"c1",desc:"Web Development — hourly rate",price:95,unit:"hr",cat:"Professional services",supplyType:"services"},
  {id:"c2",desc:"UI/UX Design — hourly rate",price:85,unit:"hr",cat:"Professional services",supplyType:"services"},
  {id:"c3",desc:"SEO Consulting — monthly retainer",price:1200,unit:"mo",cat:"Consulting",supplyType:"services"},
  {id:"c4",desc:"Logo & Brand Identity Package",price:2500,unit:"pcs",cat:"Professional services",supplyType:"services"},
  {id:"c5",desc:"WordPress Maintenance — monthly",price:350,unit:"mo",cat:"Software",supplyType:"services"},
  {id:"c6",desc:"Copywriting — per 1000 words",price:120,unit:"pcs",cat:"Professional services",supplyType:"services"},
  {id:"c7",desc:"Photography — half day",price:450,unit:"pcs",cat:"Professional services",supplyType:"services"},
  {id:"c8",desc:"Printed Brochure — A4 full color",price:3.50,unit:"pcs",cat:"Goods",supplyType:"goods"},
  {id:"c9",desc:"Technical Manual (print)",price:45,unit:"pcs",cat:"Books & e-books",supplyType:"goods"},
  {id:"c10",desc:"E-book — Digital Guide",price:19.90,unit:"pcs",cat:"Books & e-books",supplyType:"goods"},
];

const CLIENT_HISTORY={
  1:{invoiceCount:12,avgPayDays:4,lastInvoice:"2026-01-15",note:"Reliable, always pays early"},
  2:{invoiceCount:3,avgPayDays:28,lastInvoice:"2025-11-20",note:"Pays close to due date"},
  3:{invoiceCount:0,avgPayDays:null,lastInvoice:null,note:"First invoice to this client"},
  4:{invoiceCount:8,avgPayDays:7,lastInvoice:"2026-02-01",note:"Consistent, pays within a week"},
  5:{invoiceCount:5,avgPayDays:35,lastInvoice:"2025-12-10",note:"Often pays late, needs follow-up"},
  6:{invoiceCount:0,avgPayDays:null,lastInvoice:null,note:"First invoice to this client"},
  7:{invoiceCount:2,avgPayDays:14,lastInvoice:"2026-01-28",note:"New relationship, on time so far"},
  8:{invoiceCount:6,avgPayDays:22,lastInvoice:"2026-02-05",note:"Usually pays within 3 weeks"},
  9:{invoiceCount:1,avgPayDays:10,lastInvoice:"2025-10-01",note:"Only one previous invoice, paid on time"},
  10:{invoiceCount:0,avgPayDays:null,lastInvoice:null,note:"First invoice to this client"},
};

const FLAGS={DE:"🇩🇪",FR:"🇫🇷",IT:"🇮🇹",ES:"🇪🇸",NL:"🇳🇱",BE:"🇧🇪",FI:"🇫🇮",GB:"🇬🇧",US:"🇺🇸",JP:"🇯🇵"};

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK SALES — each sale groups related artifacts (quote → invoice → credit note)
   ═══════════════════════════════════════════════════════════════════════════ */
const MOCK_SALES=[
  {id:1,clientName:"TechVentures GmbH",country:"DE",cur:"EUR",artifacts:[
    {type:"invoice",num:"INV-2026-791",amount:4522.50,date:"2026-03-03",dueDate:"2026-03-17",status:"shared"},
  ]},
  {id:9,clientName:"Mustermann GmbH",country:"DE",cur:"EUR",artifacts:[
    {type:"invoice",num:"INV-2026-798",amount:12600.00,date:"2026-03-07",dueDate:"2026-04-06",status:"draft"},
  ],aiSource:{type:"contract",label:"Created by AI based on the contract uploaded earlier",fileName:"Mustermann-GmbH-Contract-May2027.pdf",fileUrl:"#contract-preview"}},
  {id:10,clientName:"Ivan Examplov",country:"DE",cur:"EUR",artifacts:[
    {type:"invoice",num:"INV-2026-795",amount:3150.00,date:"2026-03-05",dueDate:"2026-04-04",status:"draft"},
  ],aiSource:{type:"email",label:"Created by AI based on your Gmail conversation with Ivan Examplov",linkText:"conversation",linkUrl:"#gmail-thread"}},
  {id:2,clientName:"Virtanen Digital Oy",country:"FI",cur:"EUR",artifacts:[
    {type:"invoice",num:"INV-2026-784",amount:1680.00,date:"2026-03-01",dueDate:"2026-03-31",status:"draft"},
  ]},
  {id:3,clientName:"SolarTech Solutions SARL",country:"FR",cur:"EUR",artifacts:[
    {type:"quote",num:"QT-2026-140",amount:8340.00,date:"2026-02-20",status:"accepted"},
    {type:"invoice",num:"INV-2026-772",amount:8340.00,date:"2026-02-27",dueDate:"2026-03-13",status:"shared"},
  ]},
  {id:4,clientName:"Smith & Partners Ltd",country:"GB",cur:"GBP",artifacts:[
    {type:"invoice",num:"INV-2026-765",amount:1850.00,date:"2026-02-20",dueDate:"2026-03-06",status:"overdue"},
  ]},
  {id:5,clientName:"Van den Berg Consulting BV",country:"NL",cur:"EUR",artifacts:[
    {type:"invoice",num:"INV-2026-758",amount:3200.00,date:"2026-02-15",dueDate:"2026-03-01",status:"paid"},
  ]},
  {id:6,clientName:"Rossi Design Studio SRL",country:"IT",cur:"EUR",artifacts:[
    {type:"quote",num:"QT-2026-098",amount:1200.00,date:"2026-01-25",status:"accepted"},
    {type:"invoice",num:"INV-2026-741",amount:960.00,date:"2026-02-10",dueDate:"2026-02-24",status:"paid"},
    {type:"credit_note",num:"CN-2026-012",amount:-240.00,date:"2026-02-12",status:"issued"},
  ]},
  {id:7,clientName:"TechVentures GmbH",country:"DE",cur:"EUR",artifacts:[
    {type:"invoice",num:"INV-2026-733",amount:6100.00,date:"2026-01-28",dueDate:"2026-02-11",status:"paid"},
  ]},
  {id:8,clientName:"García & Asociados SL",country:"ES",cur:"EUR",artifacts:[
    {type:"invoice",num:"INV-2026-720",amount:2475.00,date:"2026-01-15",dueDate:"2026-02-14",status:"paid"},
  ]},
];

/* ═══════════════════════════════════════════════════════════════════════════
   CURRENCIES — sym, approx rate to EUR (Feb 2026), locale for formatting
   ═══════════════════════════════════════════════════════════════════════════ */
const CUR = {
  EUR:{sym:"€",toEur:1,locale:"de-DE"},
  USD:{sym:"$",toEur:1/1.05,locale:"en-US"},
  GBP:{sym:"£",toEur:1/0.84,locale:"en-GB"},
  CHF:{sym:"CHF ",toEur:1/0.95,locale:"de-CH"},
  SEK:{sym:"kr ",toEur:1/11.2,locale:"sv-SE"},
  DKK:{sym:"kr ",toEur:1/7.46,locale:"da-DK"},
  NOK:{sym:"kr ",toEur:1/11.5,locale:"nb-NO"},
  PLN:{sym:"zł ",toEur:1/4.32,locale:"pl-PL"},
  CZK:{sym:"Kč ",toEur:1/25.1,locale:"cs-CZ"},
  JPY:{sym:"¥",toEur:1/160,locale:"ja-JP"},
};

/* ═══════════════════════════════════════════════════════════════════════════
   PDF LANGUAGE — labels for the A4 preview ONLY
   ═══════════════════════════════════════════════════════════════════════════ */
const LANG = {
  EN:{name:"English",
    invoice:"INVOICE",from:"From",billTo:"Bill to",desc:"Description",qty:"Qty",price:"Price",disc:"Disc",vat:"VAT",amount:"Amount",
    subtotal:"Subtotal (net)",total:"Total",payment:"Payment",legal:"Legal notices",
    deliveryDate:"Delivery date",servicePeriod:"Service period",date:"Date",due:"Due",po:"PO",eurEquiv:"EUR equivalent"},
  DE:{name:"Deutsch",
    invoice:"RECHNUNG",from:"Von",billTo:"Rechnungsempfänger",desc:"Beschreibung",qty:"Menge",price:"Preis",disc:"Rabatt",vat:"USt.",amount:"Betrag",
    subtotal:"Zwischensumme (netto)",total:"Gesamtbetrag",payment:"Zahlung",legal:"Rechtliche Hinweise",
    deliveryDate:"Lieferdatum",servicePeriod:"Leistungszeitraum",date:"Datum",due:"Fällig",po:"Bestellnr.",eurEquiv:"EUR-Gegenwert"},
  FR:{name:"Français",
    invoice:"FACTURE",from:"De",billTo:"Facturer à",desc:"Description",qty:"Qté",price:"Prix",disc:"Remise",vat:"TVA",amount:"Montant",
    subtotal:"Sous-total (HT)",total:"Total TTC",payment:"Paiement",legal:"Mentions légales",
    deliveryDate:"Date de livraison",servicePeriod:"Période de prestation",date:"Date",due:"Échéance",po:"Réf.",eurEquiv:"Équivalent EUR"},
  IT:{name:"Italiano",
    invoice:"FATTURA",from:"Da",billTo:"Fatturare a",desc:"Descrizione",qty:"Qtà",price:"Prezzo",disc:"Sconto",vat:"IVA",amount:"Importo",
    subtotal:"Subtotale (netto)",total:"Totale",payment:"Pagamento",legal:"Note legali",
    deliveryDate:"Data consegna",servicePeriod:"Periodo di servizio",date:"Data",due:"Scadenza",po:"Rif.",eurEquiv:"Equivalente EUR"},
  ES:{name:"Español",
    invoice:"FACTURA",from:"De",billTo:"Facturar a",desc:"Descripción",qty:"Cant.",price:"Precio",disc:"Dto.",vat:"IVA",amount:"Importe",
    subtotal:"Subtotal (neto)",total:"Total",payment:"Pago",legal:"Menciones legales",
    deliveryDate:"Fecha entrega",servicePeriod:"Período de servicio",date:"Fecha",due:"Vencimiento",po:"Pedido",eurEquiv:"Equivalente EUR"},
  NL:{name:"Nederlands",
    invoice:"FACTUUR",from:"Van",billTo:"Factureren aan",desc:"Omschrijving",qty:"Aantal",price:"Prijs",disc:"Korting",vat:"BTW",amount:"Bedrag",
    subtotal:"Subtotaal (netto)",total:"Totaal",payment:"Betaling",legal:"Wettelijke vermeldingen",
    deliveryDate:"Leverdatum",servicePeriod:"Dienstperiode",date:"Datum",due:"Vervaldatum",po:"Bestelnr.",eurEquiv:"EUR-equivalent"},
  FI:{name:"Suomi",
    invoice:"LASKU",from:"Lähettäjä",billTo:"Vastaanottaja",desc:"Kuvaus",qty:"Kpl",price:"Hinta",disc:"Ale",vat:"ALV",amount:"Summa",
    subtotal:"Välisumma (netto)",total:"Yhteensä",payment:"Maksu",legal:"Lakisääteiset merkinnät",
    deliveryDate:"Toimituspäivä",servicePeriod:"Palvelujakso",date:"Päivämäärä",due:"Eräpäivä",po:"Tilausnro",eurEquiv:"EUR-vastine"},
};

const LEGAL_TEXTS = {
  ics:"Intra-community supply of goods — exempt under Art. 138 Council Directive 2006/112/EC.",
  rc:"Reverse charge — VAT to be accounted for by the recipient per Art. 196 Council Directive 2006/112/EC.",
  exp:"Export supply — VAT exempt under applicable national legislation.",
};

function lookupRate(category,cc){const d=VAT[cc];if(!d)return 19;for(const[rate,cats]of Object.entries(d.cats)){if(cats.some(c=>c.toLowerCase()===category.toLowerCase()))return Number(rate);}return d.std;}

/* Build selectable category options for a country — excludes context-driven zero-rate entries */
const CONTEXT_CATS=new Set(["exports","intra-eu b2b"]);
function getCategoryOptions(cc){
  const d=VAT[cc];if(!d)return[];
  const opts=[];
  for(const[rate,cats]of Object.entries(d.cats)){
    const r=Number(rate);
    const rl=d.rates.find(x=>x.r===r);
    for(const cat of cats){
      if(r===0&&CONTEXT_CATS.has(cat.toLowerCase()))continue;
      opts.push({cat,rate:r,rateLabel:rl?`${rl.l} (${r}%)`:`${r}%`});
    }
  }
  return opts;
}

const delay=(min,max)=>new Promise(r=>setTimeout(r,min+Math.random()*(max-min)));

async function classify(desc,cc,buyerTag){
  await delay(1200,2200);
  const d=VAT[cc];
  /* Mock: pick a plausible category from valid options for this country */
  const opts=getCategoryOptions(cc);
  const descL=desc.toLowerCase();
  /* Try to match by keyword */
  const match=opts.find(o=>descL.includes(o.cat.toLowerCase().split(" ")[0].toLowerCase()));
  const picked=match||opts.find(o=>o.rate===d.std)||opts[0];
  return{confidence:"high",category:picked.cat,supplyType:"services",reasoning:`Classified as "${picked.cat}" → ${picked.rate}% for ${d.name}`};
}

async function generateEmailDraft(ctx){
  await delay(1500,2500);
  const items=ctx.items||"your recent order";
  return{subject:`Invoice ${ctx.invNum} — ${ctx.amount} due ${ctx.dueDate}`,body:`Hi ${ctx.clientName},\n\nHope you're doing well! Attaching invoice ${ctx.invNum} for ${ctx.amount}, covering ${items}.\n\nPayment is due by ${ctx.dueDate}. You can pay via ${ctx.payMethod||"bank transfer"} — details are on the invoice.\n\nLet me know if you have any questions.\n\nBest,\n${ctx.sellerName}`};
}

const TIMING_SLOTS=[
  {daysFromDue:-7,timing:"7 days before due"},{daysFromDue:-3,timing:"3 days before due"},
  {daysFromDue:0,timing:"On due date"},{daysFromDue:3,timing:"3 days overdue"},
  {daysFromDue:7,timing:"7 days overdue"},{daysFromDue:14,timing:"14 days overdue"},
  {daysFromDue:21,timing:"21 days overdue"},{daysFromDue:30,timing:"30 days overdue"},
];
function timingPhrase(d){if(d<0)return`is due in ${-d} day${d===-1?"":"s"}`;if(d===0)return"is due today";return`is now ${d} day${d===1?"":"s"} past due`;}
function previewForTone(tone,daysFromDue,ctx){const tp=timingPhrase(daysFromDue);
  if(tone==="friendly")return`Hi ${ctx.clientName}, just a friendly reminder that invoice ${ctx.invNum} for ${ctx.amount} ${tp}. Let us know if you have any questions.`;
  if(tone==="firm")return`Invoice ${ctx.invNum} for ${ctx.amount} ${tp}. Please arrange payment at your earliest convenience.`;
  return`This is an urgent reminder regarding invoice ${ctx.invNum} for ${ctx.amount}, ${tp}. Immediate payment is required.`;}

async function generateReminderSchedule(ctx){
  await delay(2000,3000);
  const rationale=ctx.isNewClient?`First invoice to ${ctx.clientName} — using a balanced approach until we learn their payment patterns.`:ctx.avgPayDays>25?`${ctx.clientName} averages ${ctx.avgPayDays} days to pay across ${ctx.invoiceCount} invoices. Firmer schedule with earlier follow-ups.`:`${ctx.clientName} averages ${ctx.avgPayDays} days to pay across ${ctx.invoiceCount} invoices. Light-touch approach since they're reliable.`;
  const steps=ctx.avgPayDays>25?[
    {timing:"7 days before due",daysFromDue:-7,tone:"friendly",channel:"email",preview:previewForTone("friendly",-7,ctx)},
    {timing:"On due date",daysFromDue:0,tone:"firm",channel:"email",preview:previewForTone("firm",0,ctx)},
    {timing:"3 days overdue",daysFromDue:3,tone:"firm",channel:"email",preview:previewForTone("firm",3,ctx)},
    {timing:"7 days overdue",daysFromDue:7,tone:"urgent",channel:"email",preview:previewForTone("urgent",7,ctx)}
  ]:[
    {timing:"3 days before due",daysFromDue:-3,tone:"friendly",channel:"email",preview:previewForTone("friendly",-3,ctx)},
    {timing:"On due date",daysFromDue:0,tone:"firm",channel:"email",preview:previewForTone("firm",0,ctx)},
    {timing:"7 days overdue",daysFromDue:7,tone:"firm",channel:"email",preview:previewForTone("firm",7,ctx)},
    {timing:"14 days overdue",daysFromDue:14,tone:"urgent",channel:"email",preview:previewForTone("urgent",14,ctx)}
  ];
  return{strategy:ctx.isNewClient?"Standard schedule for new client":"Adaptive schedule based on payment history",rationale,steps};
}

/* ═══════════════════════════════════════════════════════════════════════════
   PALETTE — WCAG AA
   ═══════════════════════════════════════════════════════════════════════════ */
/* FDS design tokens — mapped from @finom/ui/theme/light.css */
const C={
  /* brand */
  pink:"#FE42B4",pinkBright:"#FE42B4",                          /* --cl-pink-2 */
  pinkLight:"rgb(254,232,246)",pinkBorder:"rgb(255,179,225)",    /* --cl-pink-7, --cl-pink-4 */
  blue:"#4A74FF",blueBright:"#4A74FF",                           /* --cl-blue-2 */
  blueLight:"rgb(236,240,255)",blueBorder:"rgb(194,208,255)",    /* --cl-blue-7, --cl-blue-4 */
  /* base */
  dark:"#242424",text:"#242424",                                 /* --cl-default-1 */
  textSec:"rgba(36,47,51,0.64)",                                 /* --text-light (--cl-default-2-a) */
  textTer:"rgba(31,46,51,0.40)",                                 /* --text-xlight (--cl-default-3-a) */
  /* backgrounds */
  bg:"#EEF1F2",surface:"#FFFFFF",                                /* --bg-app, --bg-content */
  surfaceAlt:"rgba(37,78,92,0.08)",                              /* --bg-light (--cl-default-8-a) */
  /* borders */
  border:"rgba(37,78,92,0.12)",                                  /* --bdr-default (--cl-default-7-a) */
  borderLight:"rgba(37,78,92,0.08)",                             /* --cl-default-8-a */
  borderHard:"rgba(37,78,92,0.16)",                              /* --bdr-hard (--cl-default-6-a) */
  /* status */
  green:"#3AB15E",greenBright:"#3AB15E",                         /* --cl-green-2 */
  greenLight:"rgb(231,245,235)",greenBorder:"rgb(176,224,191)",  /* --cl-green-7, --cl-green-4 */
  red:"#ED393C",redLight:"rgb(255,234,234)",                     /* --cl-red-1, --cl-red-7 */
  amber:"#D09900",amberBright:"#F2BB22",                         /* --cl-yellow-1, --cl-yellow-2 */
  amberLight:"rgb(253,246,228)",                                 /* --cl-yellow-7 */
  teal:"#24949B",                                                /* --cl-teal-1 */
  tealLight:"rgb(230,246,247)",tealBorder:"rgb(174,227,230)",    /* --cl-teal-7, --cl-teal-4 */
  orange:"#EC672E",orangeLight:"rgb(252,236,230)",               /* --cl-orange-2, --cl-orange-7 */
  purple:"#914EDD",purpleLight:"rgb(241,233,251)",               /* --cl-purple-2, --cl-purple-7 */
};
/* FDS typography */
const SANS=`"Poppins",Arial,sans-serif`;                         /* --ff-poppins */
const MONO=`"JetBrains Mono","SF Mono","Fira Code",Consolas,monospace`;

/* ═══════════════════════════════════════════════════════════════════════════ */
const ICONS={
  branding:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.663 3.04094 17.0829 4.73812 18.875L7 16C7.5 15 8.5 14.5 10 15C11 15.3333 12.6 16.4 13 18C13.4 19.6 12.3333 21.3333 12 22Z"/></svg>,
  seller:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18Z"/><path d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2"/><path d="M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>,
  client:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  items:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/></svg>,
  details:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
};

function Collapsible({icon,title,subtitle,open,onToggle,children}){
  return(<div style={{marginBottom:12,borderRadius:16,border:`2px solid ${open?C.borderHard:C.border}`,background:C.surface,overflow:"hidden",transition:"border-color .2s"}}>
    <button onClick={onToggle} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",width:"100%",textAlign:"left",cursor:"pointer",userSelect:"none",background:"transparent",borderBottom:open?`1px solid ${C.borderLight}`:"none",border:"none",outline:"none",fontFamily:SANS}}>
      <div style={{width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:open?C.dark:C.surfaceAlt,color:open?"#fff":C.textTer,border:`2px solid ${open?C.dark:C.border}`,transition:"all .2s"}}>{icon}</div>
      <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:500,color:C.dark}}>{title}</div>{subtitle&&!open&&<div style={{fontSize:13,color:C.textSec,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{subtitle}</div>}</div>
      <svg width="14" height="14" viewBox="0 0 16 16" style={{transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s",flexShrink:0}}><path d="M4 6l4 4 4-4" fill="none" stroke={C.textTer} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    {open&&<div style={{padding:"16px 20px 20px"}}>{children}</div>}
  </div>);
}

function Section({icon,title,subtitle,children,locked}){
  return(<div style={{marginBottom:12,borderRadius:16,border:`2px solid ${C.border}`,background:C.surface,overflow:"hidden",opacity:locked?.4:1,pointerEvents:locked?"none":"auto",transition:"opacity .2s"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderBottom:`1px solid ${C.borderLight}`,background:C.surfaceAlt}}>
      <div style={{width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:C.dark,color:"#fff",border:`2px solid ${C.dark}`}}>{icon}</div>
      <div style={{flex:1}}><div style={{fontSize:15,fontWeight:500,color:C.dark}}>{title}</div>{subtitle&&<div style={{fontSize:13,color:C.textSec,marginTop:2}}>{subtitle}</div>}</div>
    </div>
    <div style={{padding:"16px 20px 20px"}}>{children}</div>
  </div>);
}

function isoDate(d){return d.toISOString().split("T")[0];}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function fmtDate(s){if(!s)return"—";const d=new Date(s+"T00:00:00");return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}

function Field({label,children,half}){
  return(<div style={{flex:half?"1 1 45%":"1 1 100%",minWidth:half?140:0}}><label style={{fontSize:11,fontWeight:600,color:C.textSec,display:"block",marginBottom:4,letterSpacing:0.2}}>{label}</label>{children}</div>);
}
/* FDS Input: 40px height, 2px border, 8px radius, 14px horizontal padding */
const inputStyle={width:"100%",padding:"10px 14px",border:`2px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:SANS,background:C.surface,color:C.text,height:40,boxSizing:"border-box",transition:"border-color .15s ease-in-out"};
const monoInputStyle={...inputStyle,fontFamily:MONO,fontSize:13};
const selectStyle={...inputStyle,appearance:"none",paddingRight:32,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4' fill='none' stroke='%23737A7D' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 12px center"};

function ZeroBadge({reason}){
  if(!reason)return null;
  const m={rc:{l:"RC",bg:C.blueLight,br:C.blueBorder,c:C.blue},ics:{l:"ICS",bg:C.tealLight,br:C.tealBorder,c:C.teal},export:{l:"EXP",bg:C.greenLight,br:C.greenBorder,c:C.green},exempt:{l:"EX",bg:C.amberLight,br:`${C.amber}30`,c:C.amber}};
  const s=m[reason];if(!s)return null;
  return<span style={{fontSize:8,fontFamily:MONO,fontWeight:700,padding:"0 3px",borderRadius:3,background:s.bg,color:s.c,border:`1px solid ${s.br}`,marginLeft:2,letterSpacing:.3}}>{s.l}</span>;
}

function AiPill({style:sx}){
  return<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:600,padding:"2px 7px 2px 5px",borderRadius:8,background:"linear-gradient(135deg,#EDE9FE,#E0E7FF)",color:"#6D28D9",fontFamily:SANS,letterSpacing:.3,whiteSpace:"nowrap",border:"1px solid #DDD6FE",...sx}}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>
    AI</span>;
}

const A4W=595,A4H=842;
function A4Page({children,pageNum,totalPages,scale}){
  return(<div style={{width:A4W*scale,height:A4H*scale,background:"#fff",borderRadius:3,border:`1px solid ${C.border}`,boxShadow:"0 2px 8px rgba(0,0,0,.06)",overflow:"hidden",flexShrink:0,marginBottom:10,position:"relative"}}>
    <div style={{width:A4W,height:A4H,transform:`scale(${scale})`,transformOrigin:"top left",padding:"36px 34px 28px",fontFamily:SANS,color:C.text,fontSize:10,display:"flex",flexDirection:"column"}}>{children}</div>
    {totalPages>1&&<div style={{position:"absolute",bottom:4*scale,right:8*scale,fontSize:9*scale,fontFamily:MONO,color:C.textTer}}>Page {pageNum}/{totalPages}</div>}
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════════ */
function InvoiceBuilder(){
  const[brandingOpen,setBrandingOpen]=useState(false);
  const[sellerOpen,setSellerOpen]=useState(false);
  const[sellerCC,setSellerCC]=useState("DE");
  const[exempt,setExempt]=useState(false);
  const[sellerName,setSellerName]=useState("Mustermann Digital GmbH");
  const[sellerTrade,setSellerTrade]=useState("Mustermann Digital");
  const[sellerStreet,setSellerStreet]=useState("Friedrichstraße 100");
  const[sellerCity,setSellerCity]=useState("10117 Berlin");
  const[sellerVatId,setSellerVatId]=useState("DE999888777");
  const[sellerTaxId,setSellerTaxId]=useState("27/123/45678");
  const[sellerEmail,setSellerEmail]=useState("invoices@mustermann.de");
  const[sellerPhone,setSellerPhone]=useState("+49 30 1234567");
  const[brandColor,setBrandColor]=useState("#FE42B4");
  const[companyDisplay,setCompanyDisplay]=useState("Mustermann Digital GmbH");
  const[client,setClient]=useState(null);
  const[clientListOpen,setClientListOpen]=useState(true);
  const[items,setItems]=useState([]);
  const[desc,setDesc]=useState("");
  const[showAddPanel,setShowAddPanel]=useState(false);
  const[showFreeform,setShowFreeform]=useState(false);
  const[catSearch,setCatSearch]=useState("");
  const[invNum,setInvNum]=useState("INV-2026-"+String(Math.floor(Math.random()*900)+100));
  const today=useMemo(()=>new Date(),[]);
  const[invDate,setInvDate]=useState(isoDate(today));
  const[dueDate,setDueDate]=useState(isoDate(addDays(today,30)));
  const[payTerms,setPayTerms]=useState("Net 30");
  const[payMethod,setPayMethod]=useState("Bank transfer (SEPA)");
  const[iban]=useState("DE89 3704 0044 0532 0130 00");
  const[bic]=useState("FNOMDEB2XXX");
  const[poNumber,setPoNumber]=useState("");
  const[notes,setNotes]=useState("Thank you for your business.");
  const[footerNote,setFooterNote]=useState("");
  const[deliveryType,setDeliveryType]=useState("date");
  const[deliveryDate,setDeliveryDate]=useState(isoDate(today));
  const[periodStart,setPeriodStart]=useState(isoDate(new Date(today.getFullYear(),today.getMonth(),1)));
  const[periodEnd,setPeriodEnd]=useState(isoDate(new Date(today.getFullYear(),today.getMonth()+1,0)));

  /* Document-level: language (PDF only) and currency */
  const[pdfLang,setPdfLang]=useState("EN");
  const[curCode,setCurCode]=useState("EUR");
  const L=LANG[pdfLang];
  const cur=CUR[curCode];
  const isEur=curCode==="EUR";

  /* Post-creation flow state */
  const[phase,setPhase]=useState("list");
  const[detailSale,setDetailSale]=useState(null);
  const[detailArtifact,setDetailArtifact]=useState(null);
  const[emailTo,setEmailTo]=useState("");
  const[emailSubject,setEmailSubject]=useState("");
  const[emailBody,setEmailBody]=useState("");
  const[emailLoading,setEmailLoading]=useState(false);
  const[reminderData,setReminderData]=useState(null);
  const[reminderLoading,setReminderLoading]=useState(false);
  const[customizing,setCustomizing]=useState(false);
  const[sentViaEmail,setSentViaEmail]=useState(false);
  const[savingDraft,setSavingDraft]=useState(false);
  const[sendingEmail,setSendingEmail]=useState(false);
  const[creatingInvoice,setCreatingInvoice]=useState(false);
  const[aiPrompt,setAiPrompt]=useState("");
  const[aiGenerating,setAiGenerating]=useState(false);
  const[aiStep,setAiStep]=useState("");
  const shareLink=useMemo(()=>"https://pay.finom.co/inv/"+invNum.replace(/[^A-Za-z0-9]/g,"").toLowerCase(),[invNum]);

  /* Format amounts in selected currency */
  const fmtAmt=useCallback((n)=>{
    if(curCode==="JPY")return cur.sym+Math.round(n/cur.toEur).toLocaleString(cur.locale);
    const val=n/cur.toEur;
    return cur.sym+val.toLocaleString(cur.locale,{minimumFractionDigits:2,maximumFractionDigits:2});
  },[curCode,cur]);
  const fmtEur=(n)=>n.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
  /* For the wizard side — always EUR */
  const fmtEurSym=(n)=>"€"+fmtEur(n);

  const sd=VAT[sellerCC];
  const isEx=exempt&&sd.ex;
  const buyerTag=useMemo(()=>{
    if(!client)return null;
    if(!client.eu)return client.biz?"Export B2B":"Export B2C";
    if(client.country===sellerCC)return client.biz?"Domestic B2B":"Domestic B2C";
    return client.biz?"Intra-EU B2B":"EU B2C";
  },[client,sellerCC]);
  const isRC=buyerTag==="Intra-EU B2B";
  const isExport=buyerTag==="Export B2B"||buyerTag==="Export B2C";
  const isZero=isRC||isExport;

  /* Rate is always derived: context (export/RC/exempt) overrides; otherwise category → rate */
  const resolvedItems=useMemo(()=>items.map(it=>{
    if(isEx)return{...it,effectiveRate:0,zeroReason:"exempt"};
    if(!it.done)return{...it,effectiveRate:0,zeroReason:null};
    if(isRC)return{...it,effectiveRate:0,zeroReason:it.supplyType==="goods"?"ics":"rc"};
    if(isExport)return{...it,effectiveRate:0,zeroReason:"export"};
    const derivedRate=it.cat?lookupRate(it.cat,sellerCC):sd.std;
    return{...it,effectiveRate:derivedRate,zeroReason:null};
  }),[items,isEx,isRC,isExport,sellerCC,sd]);

  const legalMentions=useMemo(()=>{
    const m=[];
    if(isEx){m.push({text:sd.ex.mention,color:C.amber,key:"exempt"});return m;}
    const hasRC=resolvedItems.some(i=>i.zeroReason==="rc");
    const hasICS=resolvedItems.some(i=>i.zeroReason==="ics");
    const hasExp=resolvedItems.some(i=>i.zeroReason==="export");
    if(hasICS){const n=resolvedItems.filter(i=>i.zeroReason==="ics").map(i=>i.desc);m.push({text:LEGAL_TEXTS.ics+(n.length<=3?` (${n.join("; ")})`:""),color:C.teal,key:"ics"});}
    if(hasRC){const n=resolvedItems.filter(i=>i.zeroReason==="rc").map(i=>i.desc);m.push({text:LEGAL_TEXTS.rc+(n.length<=3?` (${n.join("; ")})`:""),color:C.blue,key:"rc"});}
    if(hasExp)m.push({text:LEGAL_TEXTS.exp,color:C.green,key:"exp"});
    return m;
  },[resolvedItems,isEx,sd]);

  /* Re-classify on country change — categories may differ between countries */
  const prevCC=useRef(sellerCC);
  useEffect(()=>{
    if(prevCC.current===sellerCC)return;prevCC.current=sellerCC;
    const toR=items.filter(i=>i.done&&!i.loading);if(!toR.length)return;
    const bt=buyerTag||"Domestic B2B";
    const catI=toR.filter(i=>i.fromCat),freeI=toR.filter(i=>!i.fromCat);
    /* Catalogue items: check if their category exists in new country, else fall back to std */
    if(catI.length){
      const opts=getCategoryOptions(sellerCC);
      const optCats=new Set(opts.map(o=>o.cat.toLowerCase()));
      setItems(p=>p.map(i=>{const ci=catI.find(t=>t.id===i.id);if(!ci)return i;
        const catExists=optCats.has(ci.cat.toLowerCase());
        return catExists?i:{...i,cat:opts.find(o=>o.rate===VAT[sellerCC].std)?.cat||opts[0]?.cat||i.cat};
      }));
    }
    /* Freeform items: re-classify to pick appropriate category for new country */
    if(freeI.length){setItems(p=>p.map(i=>freeI.find(t=>t.id===i.id)?{...i,loading:true}:i));freeI.forEach(async it=>{const r=await classify(it.desc,sellerCC,bt);setItems(p=>p.map(i=>i.id===it.id?{...i,loading:false,conf:r.confidence,cat:r.category,supplyType:r.supplyType||"services",reason:r.reasoning}:i));});}
  },[sellerCC,items,buyerTag]);

  const addItem=useCallback(async()=>{
    if(!desc.trim())return;const d2=desc.trim();setDesc("");
    const id=Date.now();
    setItems(p=>[...p,{id,desc:d2,qty:1,price:0,discount:0,loading:true,done:false,cat:null,supplyType:"services",fromCat:false}]);
    setShowAddPanel(false);setShowFreeform(false);
    const r=await classify(d2,sellerCC,buyerTag||"Domestic B2B");
    setItems(p=>p.map(i=>i.id===id?{...i,loading:false,done:true,conf:r.confidence,cat:r.category,supplyType:r.supplyType||"services",reason:r.reasoning}:i));
  },[desc,sellerCC,buyerTag,sd]);

  const addFromCat=useCallback((catItem)=>{
    const id=Date.now();
    setItems(p=>[...p,{id,desc:catItem.desc,qty:1,price:catItem.price,discount:0,loading:false,done:true,conf:"high",cat:catItem.cat,supplyType:catItem.supplyType,reason:"Catalogue item",fromCat:true}]);
    setCatSearch("");setShowAddPanel(false);
  },[sellerCC]);

  const updateItem=(id,field,val)=>setItems(p=>p.map(i=>i.id===id?{...i,[field]:val}:i));
  const removeItem=id=>setItems(p=>p.filter(i=>i.id!==id));

  /* ─── Post-creation transition handlers ─── */
  const handleSendInvoice=useCallback(async()=>{
    if(!client||items.length===0)return;
    setCreatingInvoice(true);
    await delay(1500,2500);
    setCreatingInvoice(false);
    setPhase("send");
    setEmailTo("");
    setEmailLoading(true);
    const itemDescs=items.map(i=>i.desc).join(", ");
    try{
      const draft=await generateEmailDraft({sellerName,clientName:client.name,invNum,amount:fmtEurSym(subtotalRef.current+vatTotalRef.current),dueDate:fmtDate(dueDate),items:itemDescs,buyerTag:buyerTagRef.current,payMethod});
      setEmailSubject(draft.subject);setEmailBody(draft.body);
    }catch{
      setEmailSubject(`Invoice ${invNum} from ${sellerName}`);
      setEmailBody(`Dear ${client.name},\n\nPlease find attached invoice ${invNum} for your recent order, due ${fmtDate(dueDate)}.\n\nBest regards,\n${sellerName}`);
    }
    setEmailLoading(false);
  },[client,items,invNum,sellerName,dueDate,payMethod]);

  const handleGoToReminders=useCallback(async(viaSend)=>{
    if(viaSend)setSentViaEmail(true);
    setPhase("reminders");
    setReminderLoading(true);
    const ch=client?CLIENT_HISTORY[client.id]||{}:{};
    try{
      const sched=await generateReminderSchedule({clientName:client?.name||"Client",amount:fmtEurSym(subtotalRef.current+vatTotalRef.current),dueDate:fmtDate(dueDate),invNum,buyerTag:buyerTagRef.current,isNewClient:!ch.invoiceCount,paymentHistory:ch.note||"No history",avgPayDays:ch.avgPayDays,invoiceCount:ch.invoiceCount||0});
      setReminderData(sched);
    }catch{
      setReminderData({strategy:"Standard reminder schedule",steps:[
        {timing:"3 days before due",daysFromDue:-3,tone:"friendly",channel:"email",preview:`Hi ${client?.name}, just a friendly reminder that invoice ${invNum} is due in 3 days.`},
        {timing:"On due date",daysFromDue:0,tone:"firm",channel:"email",preview:`Invoice ${invNum} is due today. Please arrange payment at your earliest convenience.`},
        {timing:"7 days overdue",daysFromDue:7,tone:"firm",channel:"email",preview:`Invoice ${invNum} is now 7 days past due. Please process payment promptly.`},
        {timing:"14 days overdue",daysFromDue:14,tone:"urgent",channel:"email",preview:`Urgent: invoice ${invNum} is 14 days overdue. Immediate payment is required.`}]});
    }
    setReminderLoading(false);
  },[client,dueDate,invNum]);

  const subtotalRef=useRef(0);
  const vatTotalRef=useRef(0);
  const buyerTagRef=useRef("");

  const subtotal=resolvedItems.reduce((s,i)=>s+(i.qty*i.price*(1-i.discount/100)),0);
  const vatTotal=resolvedItems.reduce((s,i)=>{const line=i.qty*i.price*(1-i.discount/100);return s+line*(i.effectiveRate||0)/100;},0);
  const total=subtotal+vatTotal;
  subtotalRef.current=subtotal;vatTotalRef.current=vatTotal;buyerTagRef.current=buyerTag;
  const vatGroups=useMemo(()=>{const g={};resolvedItems.forEach(i=>{const er=i.effectiveRate||0;const line=i.qty*i.price*(1-i.discount/100);if(!g[er])g[er]={base:0,vat:0};g[er].base+=line;g[er].vat+=line*er/100;});return g;},[resolvedItems]);

  const filteredCat=CATALOGUE.filter(c=>!catSearch||c.desc.toLowerCase().includes(catSearch.toLowerCase())||c.cat.toLowerCase().includes(catSearch.toLowerCase()));

  // Done screen copy — must be top-level hooks (not inside conditional render)
  const doneHl=useMemo(()=>{const h=sentViaEmail?["Off your plate.","And... sent.","Out the door.","Done deal."]:["Saved and sealed.","Ready when you are.","Locked in."];return h[Math.floor(Math.random()*h.length)];},[phase]);
  const doneSl=useMemo(()=>{const cn=client?.name||"them";const s=sentViaEmail
    ?[`${cn} should see this any moment now. Go do something you actually enjoy.`,`It's in ${cn}'s hands now. You've done your part.`,`Making its way to ${cn}. We'll keep an eye on things from here.`]
    :[`${cn} doesn't know what's coming yet. Send it whenever you're ready.`,`Looking sharp. Take a second to admire it, then hit send whenever.`,`Saved and waiting for your go. No rush — it's not going anywhere.`];
    return s[Math.floor(Math.random()*s.length)];},[phase]);

  const previewRef=useRef(null);const[previewScale,setPreviewScale]=useState(1);
  useEffect(()=>{const el=previewRef.current;if(!el)return;const ro=new ResizeObserver(entries=>{for(const e of entries)setPreviewScale(Math.min(1,(e.contentRect.width-16)/A4W));});ro.observe(el);return()=>ro.disconnect();},[]);

  const ITEMS_PAGE1=18,ITEMS_CONT=32;
  const pages=useMemo(()=>{const ri=resolvedItems;if(ri.length<=ITEMS_PAGE1)return[ri];const res=[ri.slice(0,ITEMS_PAGE1)];let idx=ITEMS_PAGE1;while(idx<ri.length){res.push(ri.slice(idx,idx+ITEMS_CONT));idx+=ITEMS_CONT;}return res;},[resolvedItems]);
  const totalPages=pages.length;

  const deliveryStr=deliveryType==="date"?`${L.deliveryDate}: ${fmtDate(deliveryDate)}`:`${L.servicePeriod}: ${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`;

  /* Catalogue panel — plain function, NOT a component (avoids remount on every render) */
  const renderCatPanel=(onClose)=>(
    <div style={{padding:12,background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:8,marginBottom:6}}>
      {onClose&&<div style={{display:"flex",alignItems:"center",marginBottom:8}}><span style={{fontSize:15,fontWeight:600,color:C.dark}}>Add item</span><div style={{flex:1}}/><button onClick={onClose} style={{background:"transparent",border:"none",color:C.textSec,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button></div>}
      <input value={catSearch} onChange={e=>setCatSearch(e.target.value)} placeholder="Search catalogue…" style={{...inputStyle,marginBottom:6,background:C.surfaceAlt}}/>
      <div style={{maxHeight:200,overflowY:"auto"}}>
        {filteredCat.map(c=>(<button key={c.id} onClick={()=>addFromCat(c)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",cursor:"pointer",borderRadius:6,border:"none",background:"transparent",width:"100%",textAlign:"left",outline:"none"}}
          onMouseOver={e=>e.currentTarget.style.background=C.surfaceAlt} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,color:C.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.desc}</div>
            <div style={{fontSize:11,color:C.textSec}}>{c.cat} · <span style={{color:c.supplyType==="goods"?C.teal:C.blue}}>{c.supplyType}</span></div>
          </div>
          <span style={{fontSize:12,fontFamily:MONO,fontWeight:600,color:C.dark,flexShrink:0}}>€{c.price.toFixed(2)}</span>
          <span style={{fontSize:9,fontFamily:MONO,color:C.textSec,flexShrink:0}}>/{c.unit}</span>
        </button>))}
        {filteredCat.length===0&&<div style={{padding:10,fontSize:13,color:C.textSec,textAlign:"center",fontStyle:"italic"}}>No matches</div>}
      </div>
      {showFreeform?(
        <div style={{display:"flex",gap:5,marginTop:8}}>
          <input value={desc} onChange={e=>setDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Describe a custom item…" autoFocus style={{...inputStyle,flex:1}}/>
          <button onClick={addItem} disabled={!desc.trim()} style={{padding:"9px 14px",borderRadius:12,border:"none",background:desc.trim()?C.dark:C.borderLight,color:desc.trim()?"#fff":C.textTer,fontSize:13,fontWeight:500,cursor:desc.trim()?"pointer":"default",whiteSpace:"nowrap",fontFamily:SANS}}>+ Add</button>
        </div>
      ):(
        <button onClick={()=>setShowFreeform(true)} style={{marginTop:8,width:"100%",padding:"8px",borderRadius:12,border:`1.5px dashed ${C.border}`,background:"transparent",color:C.textSec,fontSize:11,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4,outline:"none"}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Custom item
        </button>
      )}
    </div>
  );

  /* Table header for A4 */
  const renderTH=()=>(<div style={{display:"flex",fontSize:7,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:.4,padding:"0 0 4px",borderBottom:`1.5px solid ${C.dark}`}}>
    <span style={{flex:1}}>{L.desc}</span><span style={{width:26,textAlign:"right"}}>{L.qty}</span><span style={{width:48,textAlign:"right"}}>{L.price}</span><span style={{width:30,textAlign:"right"}}>{L.disc}</span><span style={{width:36,textAlign:"right"}}>{L.vat}</span><span style={{width:54,textAlign:"right"}}>{L.amount}</span>
  </div>);

  const renderItemRow=(it)=>{const lineNet=it.qty*it.price*(1-it.discount/100);const lineGross=lineNet*(1+(it.effectiveRate||0)/100);
    return(<div key={it.id} style={{display:"flex",alignItems:"baseline",fontSize:9.5,padding:"3px 0",borderBottom:`1px solid ${C.borderLight}`}}>
      <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:4,color:C.text}}>{it.desc}{it.loading?" ⏳":""}</span>
      <span style={{width:26,textAlign:"right",fontFamily:MONO,fontSize:8.5,color:C.textSec}}>{it.qty}</span>
      <span style={{width:48,textAlign:"right",fontFamily:MONO,fontSize:8.5,color:C.text}}>{fmtAmt(it.price)}</span>
      <span style={{width:30,textAlign:"right",fontFamily:MONO,fontSize:8.5,color:it.discount>0?C.red:C.textTer}}>{it.discount>0?`-${it.discount}%`:"—"}</span>
      <span style={{width:36,textAlign:"right",fontFamily:MONO,fontSize:8.5}}><span style={{color:it.effectiveRate===0?C.green:C.textSec}}>{it.effectiveRate||0}%</span>{it.zeroReason&&<ZeroBadge reason={it.zeroReason}/>}</span>
      <span style={{width:54,textAlign:"right",fontFamily:MONO,fontSize:8.5,fontWeight:600,color:C.dark}}>{fmtAmt(lineGross)}</span>
    </div>);
  };

  const renderFooterBlock=()=>(<>
    <div style={{borderTop:`1.5px solid ${C.dark}`,paddingTop:7,marginTop:4}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9.5,color:C.textSec,marginBottom:2}}><span>{L.subtotal}</span><span style={{fontFamily:MONO,fontWeight:500}}>{fmtAmt(subtotal)}</span></div>
      {Object.entries(vatGroups).map(([rate,g])=>(<div key={rate} style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.textSec,marginBottom:1}}><span>{L.vat} {rate}%</span><span style={{fontFamily:MONO}}>{fmtAmt(g.vat)}</span></div>))}
      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:800,color:C.dark,marginTop:5,paddingTop:5,borderTop:`1px solid ${C.border}`}}><span>{L.total}</span><span style={{fontFamily:MONO}}>{fmtAmt(total)}</span></div>
      {!isEur&&(<div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.textSec,marginTop:2}}><span>{L.eurEquiv}</span><span style={{fontFamily:MONO}}>€{fmtEur(total)}</span></div>)}
    </div>
    {payMethod==="Bank transfer (SEPA)"&&(<div style={{marginTop:10,paddingTop:6,borderTop:`1px dashed ${C.border}`}}><div style={{fontSize:7,fontWeight:600,color:C.textTer,textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>{L.payment}</div><div style={{fontSize:8.5,fontFamily:MONO,color:C.textSec,lineHeight:1.6}}>Finom / Solarisbank AG · IBAN: {iban} · BIC: {bic}</div></div>)}
    {legalMentions.length>0&&(<div style={{marginTop:6,paddingTop:5,borderTop:`1px dashed ${C.border}`}}><div style={{fontSize:6.5,fontWeight:600,color:C.textTer,textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>{L.legal}</div>{legalMentions.map(m=><div key={m.key} style={{fontSize:8,color:m.color,lineHeight:1.5,marginBottom:2,fontWeight:500}}>{m.text}</div>)}</div>)}
    {notes&&<div style={{marginTop:5,fontSize:8.5,color:C.textSec,lineHeight:1.5}}>{notes}</div>}
    {footerNote&&<div style={{marginTop:4,paddingTop:4,borderTop:`1px solid ${C.borderLight}`,fontSize:7.5,color:C.textTer,lineHeight:1.5}}>{footerNote}</div>}
  </>);

  /* ─── POST-CREATION SCREENS ─── */
  const inputStylePost={width:"100%",padding:"10px 14px",borderRadius:8,border:`2px solid ${C.border}`,fontSize:14,fontFamily:SANS,color:C.text,background:C.surface,height:40,boxSizing:"border-box"};
  const toneColors={friendly:C.green,firm:C.amber,urgent:C.red};
  const toneBg={friendly:C.greenLight,firm:C.amberLight,urgent:C.redLight};

  const freshInvNum=()=>"INV-2026-"+String(Math.floor(Math.random()*900)+100);

  const aiGenerate=async(prompt)=>{
    setAiGenerating(true);
    const steps=["Understanding your request...","Matching client from history...","Building line items...","Classifying VAT treatment...","Setting payment terms...","Generating preview..."];
    for(const s of steps){setAiStep(s);await delay(600,1000);}
    setClient(CLIENTS[0]);setClientListOpen(false);
    setItems([{id:Date.now(),desc:"Web development — February 2026",qty:40,price:95,unit:"hr",discount:0,done:true,conf:"high",cat:"Professional services",supplyType:"services",reasoning:"Matched from previous invoices to TechVentures GmbH",fromCat:false}]);
    setPayTerms("Net 14");setDueDate(isoDate(addDays(today,14)));
    setNotes("Hours as discussed — 40h web development for the February sprint.");
    setInvNum(freshInvNum());
    setAiGenerating(false);setAiStep("");setPhase("editor");
  };

  const renderAiCreateScreen=()=>(
    <div className="phase-enter" key="ai-create" style={{maxWidth:640,margin:"0 auto",padding:"40px 24px 40px"}}>
      <div style={{marginBottom:24}}><span onClick={()=>setPhase("list")} style={{fontSize:12,fontWeight:500,color:C.textSec,letterSpacing:.5,textTransform:"uppercase",cursor:"pointer"}}>← Back to invoices</span></div>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#EDE9FE,#E0E7FF)",marginBottom:16}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>
        </div>
        <h2 style={{fontSize:24,fontWeight:700,color:C.dark,margin:"0 0 8px",fontFamily:SANS}}>What are you invoicing for?</h2>
        <p style={{fontSize:14,color:C.textSec,margin:0,lineHeight:1.5}}>Describe the work, and we'll generate a complete invoice for you to review.</p>
      </div>
      {!aiGenerating?(
        <div>
          <textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)}
            placeholder={"\"40 hours of web development for TechVentures in February\"\n\"Monthly retainer for Atelier Lumière — design services, €2,400\"\n\"Sold 500 printed brochures to Nordic Digital\""}
            style={{width:"100%",minHeight:120,padding:"14px 16px",borderRadius:8,border:`2px solid ${C.border}`,fontSize:15,fontFamily:SANS,color:C.text,background:"#fff",resize:"vertical",lineHeight:1.6,outline:"none"}}
            onFocus={e=>e.target.style.borderColor=C.dark} onBlur={e=>e.target.style.borderColor=C.border} autoFocus/>
          <div style={{display:"flex",gap:12,marginTop:16}}>
            <button onClick={()=>aiGenerate(aiPrompt)} disabled={!aiPrompt.trim()}
              style={{flex:1,padding:"0 24px",height:48,borderRadius:24,border:"none",background:aiPrompt.trim()?C.dark:C.surfaceAlt,color:aiPrompt.trim()?"#fff":C.textTer,fontSize:15,fontWeight:500,cursor:aiPrompt.trim()?"pointer":"default",fontFamily:SANS,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>
              Generate invoice</button>
            <button onClick={()=>{setInvNum(freshInvNum());setPhase("editor");}}
              style={{padding:"0 24px",height:48,borderRadius:24,border:`1px solid ${C.border}`,background:"transparent",color:C.textSec,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:SANS,whiteSpace:"nowrap"}}>
              Use blank form</button>
          </div>
          <div style={{marginTop:32}}>
            <div style={{fontSize:12,fontWeight:600,color:C.textTer,textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Or start from recent context</div>
            {[
              {icon:"📄",label:"Contract: Mustermann-GmbH-Contract-May2027.pdf",sub:"6 milestones, next: €12,600 due March 2026"},
              {icon:"📧",label:"Gmail: conversation with Ivan Examplov",sub:"Web consulting, ~35 hours discussed"},
              {icon:"🔁",label:"Recurring: TechVentures GmbH — monthly retainer",sub:"€4,800/mo, last invoiced 1 Mar"},
            ].map((s,i)=>(
              <div key={i} onClick={()=>{setAiPrompt(s.label);aiGenerate(s.label);}} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderRadius:12,border:`2px solid ${C.border}`,marginBottom:8,cursor:"pointer",transition:"all .15s",background:"#fff"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderHard;e.currentTarget.style.background=C.surfaceAlt;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="#fff";}}>
                <span style={{fontSize:20}}>{s.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.label}</div>
                  <div style={{fontSize:12,color:C.textSec,marginTop:2}}>{s.sub}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={C.textTer} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
            ))}
          </div>
        </div>
      ):(
        <div style={{textAlign:"center",padding:"40px 0"}}>
          <div style={{display:"inline-block",width:48,height:48,borderRadius:24,border:`3px solid ${C.borderLight}`,borderTopColor:"#6D28D9",animation:"spin 1s linear infinite",marginBottom:20}}/>
          <div style={{fontSize:16,fontWeight:600,color:C.dark,marginBottom:8}}>{aiStep}</div>
          <div style={{fontSize:13,color:C.textSec}}>Building your invoice from: "{aiPrompt}"</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  );

  /* sales are always expanded — no toggle needed */

  const renderListScreen=()=>{
    const statusCfg={shared:{color:C.blue,label:"Shared"},not_shared:{color:C.textTer,label:"Not shared"},overdue:{color:C.red,label:"Overdue"},paid:{color:C.green,label:"Paid"},draft:{color:C.amber,label:"Draft"},accepted:{color:C.green,label:"Accepted"},issued:{color:C.blue,label:"Issued"},credit_note:{color:C.orange||C.red,label:"Issued"}};
    const typeCfg={invoice:{icon:"INV",color:C.dark},quote:{icon:"QT",color:C.textSec},credit_note:{icon:"CN",color:C.red}};
    const fmtDate=(iso)=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"});};
    const fmtAmt=(a,c)=>{const cur=CUR[c]||CUR.EUR;return a.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+cur.sym.trim();};
    const sidebarItem=(icon,label,sub)=>(
      <div key={label} onClick={()=>alert("Not available in this prototype.")} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"16px 18px",cursor:"pointer",transition:"background .15s"}}
        onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <div style={{flexShrink:0,marginTop:2}}>{icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:600,color:C.dark}}>{label}</div>
          <div style={{fontSize:12,color:C.textSec,marginTop:2,lineHeight:1.35}}>{sub}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,marginTop:4}}><path d="M9 18l6-6-6-6" stroke={C.textTer} strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
    );
    return(
      <div className="phase-enter" key="list" style={{maxWidth:1200,margin:"0 auto",padding:"0 32px 40px",display:"flex",gap:20,alignItems:"flex-start"}}>
        {/* LEFT SIDEBAR */}
        <div style={{flex:"0 0 300px",paddingTop:4}}>
          {/* Action buttons card */}
          <div style={{background:"#fff",borderRadius:20,padding:"24px 16px",marginBottom:16,display:"flex",gap:0}}>
            <button onClick={()=>{setAiPrompt("");setPhase("ai-create");}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"12px 8px",border:"none",background:"transparent",cursor:"pointer",fontFamily:SANS,transition:"all .15s"}}
              onMouseEnter={e=>e.currentTarget.querySelector("div").style.background=C.borderLight}
              onMouseLeave={e=>e.currentTarget.querySelector("div").style.background=C.surfaceAlt}>
              <div style={{width:48,height:48,borderRadius:12,background:C.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",transition:"background .15s"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={C.dark} strokeWidth="1.5"/><path d="M14 2v6h6" stroke={C.dark} strokeWidth="1.5"/><path d="M12 13v4m-2-2h4" stroke={C.dark} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <span style={{fontSize:13,fontWeight:600,color:C.dark}}>New{"\n"}invoice</span>
            </button>
            <div style={{width:1,background:C.borderLight,margin:"8px 0"}}/>
            <button onClick={()=>alert("Not available in this prototype.")} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"12px 8px",border:"none",background:"transparent",cursor:"pointer",fontFamily:SANS}}>
              <div style={{width:48,height:48,borderRadius:12,background:C.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={C.dark} strokeWidth="1.5" strokeLinecap="round"/><path d="M12 3v12m0-12l4 4m-4-4L8 7" stroke={C.dark} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{fontSize:13,fontWeight:600,color:C.dark}}>Upload{"\n"}document</span>
            </button>
          </div>

          {/* Navigation card */}
          <div style={{background:"#fff",borderRadius:20,overflow:"hidden",marginBottom:16}}>
            {sidebarItem(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 7H4a1 1 0 00-1 1v12a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" stroke={C.textSec} strokeWidth="1.5"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke={C.textSec} strokeWidth="1.5"/></svg>,
              "Goods & Services","Manage your products and services to use it in invoices"
            )}
            <div style={{height:1,background:C.borderLight,margin:"0 18px"}}/>
            {sidebarItem(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke={C.textSec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 12 12)"/><path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke={C.textSec} strokeWidth="1.5" strokeLinecap="round"/></svg>,
              "Import data to Finom","Simply transfer your contacts and products from other system"
            )}
          </div>

          {/* Receive invoices card */}
          <div style={{background:"#fff",borderRadius:20,padding:"24px 20px"}}>
            <div style={{fontSize:15,fontWeight:700,color:C.dark,marginBottom:8,lineHeight:1.3}}>Receive invoices and receipts by email</div>
            <div style={{fontSize:13,fontFamily:MONO,color:C.dark,marginBottom:6}}>invoices@mustermann.de</div>
            <div style={{fontSize:12,color:C.textSec,lineHeight:1.4}}>All invoices, receipts and other documents sent to this email will be added directly to Finom</div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontSize:28,fontWeight:600,color:C.dark,margin:"0 0 20px",fontFamily:SANS}}>Get Paid</h1>

          {/* Search bar */}
          <div style={{position:"relative",marginBottom:14}}>
            <svg style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}} width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={C.textTer} strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke={C.textTer} strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input readOnly placeholder="Search by counterparty or invoice parameters" style={{width:"100%",padding:"10px 14px 10px 42px",borderRadius:8,border:`2px solid ${C.border}`,fontSize:14,fontFamily:SANS,color:C.text,background:"#fff",cursor:"default",height:40}}/>
          </div>

          {/* Filter chips */}
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {["Invoices ˅","Status","Scheduled email","Issue date","More filters ···"].map(f=>(
              <span key={f} style={{padding:"7px 16px",borderRadius:20,border:"none",fontSize:13,color:C.textSec,fontWeight:500,background:C.surfaceAlt,cursor:"default",whiteSpace:"nowrap"}}>{f}</span>
            ))}
          </div>

          {/* Sort control */}
          <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.borderLight}`,marginBottom:0}}>
            <div style={{flex:1}}/>
            <div style={{padding:"12px 0 10px",fontSize:12,fontWeight:600,color:C.blue,letterSpacing:.3,textTransform:"uppercase",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>By date <span style={{fontSize:10}}>˅</span></div>
          </div>

          {/* Sales list */}
          {MOCK_SALES.map((sale,idx)=>{
            const multi=sale.artifacts.length>1;
            const primary=sale.artifacts.find(a=>a.type==="invoice")||sale.artifacts[0];
            const primarySt=statusCfg[primary.status]||statusCfg.draft;
            const saleTotal=sale.artifacts.reduce((s,a)=>s+a.amount,0);
            return(
              <div key={sale.id} style={{borderBottom:idx<MOCK_SALES.length-1?`1px solid ${C.borderLight}`:"none",padding:"14px 4px"}}>
                {/* Sale header: client + amount */}
                <div style={{display:"flex",alignItems:"center",marginBottom:multi?8:0}}>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontSize:14,fontWeight:600,color:C.dark}}>{sale.clientName}</span>
                    {sale.aiSource&&(
                      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                        <AiPill style={{fontSize:9,padding:"1px 6px 1px 4px"}}/>
                        <span style={{fontSize:12,color:C.textSec,lineHeight:1.3}}>
                          {sale.aiSource.type==="contract"?(<>
                            {sale.aiSource.label} — <a href={sale.aiSource.fileUrl} onClick={e=>e.stopPropagation()} style={{color:C.blue,textDecoration:"none",fontWeight:500}}>{sale.aiSource.fileName}</a>
                          </>):(<>
                            Created by AI based on your Gmail <a href={sale.aiSource.linkUrl} onClick={e=>e.stopPropagation()} style={{color:C.blue,textDecoration:"none",fontWeight:500}}>{sale.aiSource.linkText}</a> with {sale.clientName}
                          </>)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:14,fontWeight:600,color:C.dark}}>{fmtAmt(multi?saleTotal:primary.amount,sale.cur)}</span>
                  </div>
                </div>
                {/* Artifacts — always visible */}
                {sale.artifacts.map((a,ai)=>{
                  const ast=statusCfg[a.status]||statusCfg.draft;
                  const tc=typeCfg[a.type]||typeCfg.invoice;
                  return(
                    <div key={ai} onClick={()=>{setDetailSale(sale);setDetailArtifact(a);setPhase("detail");}}
                      style={{display:"flex",alignItems:"center",padding:multi?"6px 8px":"4px 0",borderRadius:8,cursor:"pointer",transition:"background .15s",marginTop:multi&&ai===0?0:2}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <span style={{fontSize:10,fontFamily:MONO,fontWeight:600,padding:"2px 6px",borderRadius:4,background:a.type==="credit_note"?C.redLight:C.surfaceAlt,color:tc.color,border:`1px solid ${C.border}`,marginRight:10,whiteSpace:"nowrap"}}>{tc.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <span style={{fontSize:13,fontWeight:500,color:C.dark}}>{a.num}</span>
                      </div>
                      <div style={{flex:"0 0 130px",display:"flex",alignItems:"center",gap:6}}>
                        <span style={{width:6,height:6,borderRadius:3,background:ast.color,flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:500,color:C.textSec}}>{ast.label}</span>
                        {a.dueDate&&a.status!=="paid"&&a.status!=="draft"&&<span style={{fontSize:11,color:C.textTer}}>· Due {fmtDate(a.dueDate)}</span>}
                      </div>
                      <div style={{flex:"0 0 90px",textAlign:"right"}}>
                        <span style={{fontSize:13,fontFamily:MONO,fontWeight:500,color:a.amount<0?C.red:C.dark}}>{a.amount<0?"−":""}{fmtAmt(Math.abs(a.amount),sale.cur)}</span>
                      </div>
                      <div style={{flex:"0 0 60px",textAlign:"right"}}>
                        <span style={{fontSize:12,color:C.textTer}}>{fmtDate(a.date)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDetailScreen=()=>{
    if(!detailSale||!detailArtifact)return null;
    const sale=detailSale;const art=detailArtifact;
    const statusCfg={shared:{color:C.blue,label:"Shared"},overdue:{color:C.red,label:"Overdue"},paid:{color:C.green,label:"Paid"},draft:{color:C.amber,label:"Draft"},accepted:{color:C.green,label:"Accepted"},issued:{color:C.blue,label:"Issued"}};
    const st=statusCfg[art.status]||statusCfg.draft;
    const typeLabel={invoice:"Invoice",quote:"Quote",credit_note:"Credit Note"}[art.type]||"Document";
    const fmtDateL=(iso)=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});};
    const fmtAmtL=(a,c)=>{const cu=CUR[c]||CUR.EUR;return a.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+cu.sym.trim();};
    /* Mock history events */
    const history=[
      {date:art.date,label:"Created",done:true},
      ...(art.status==="shared"||art.status==="paid"?[{date:art.date,label:"Shared with client",done:true}]:[]),
      ...(art.status==="paid"?[{date:art.dueDate||art.date,label:"Payment received",done:true}]:[]),
      ...(art.status!=="paid"?[{date:art.dueDate||null,label:art.status==="overdue"?"Payment overdue":"Awaiting payment",done:false}]:[]),
    ];
    return(
    <div className="phase-enter" key="detail" style={{maxWidth:1200,margin:"0 auto",padding:"0 32px 40px",display:"flex",gap:20,alignItems:"flex-start"}}>
      {/* LEFT — main content */}
      <div style={{flex:1,minWidth:0}}>
        {/* Back link */}
        <div style={{marginBottom:16}}>
          <span onClick={()=>setPhase("list")} style={{fontSize:13,fontWeight:500,color:C.textSec,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to Get Paid
          </span>
        </div>

        {/* Hero card */}
        <div style={{background:"#fff",borderRadius:20,padding:"40px 40px 32px",textAlign:"center",marginBottom:16}}>
          {/* Status badge */}
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:8,height:8,borderRadius:4,background:st.color}}/>
              <span style={{fontSize:13,fontWeight:500,color:C.textSec}}>{st.label}</span>
            </div>
          </div>

          {/* Title */}
          <div style={{fontSize:28,fontWeight:700,color:C.dark,marginBottom:8}}>{typeLabel} {art.num.split("-").pop()}</div>

          {/* Format badge */}
          {art.type==="invoice"&&<div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:16,background:C.surfaceAlt,color:C.textSec,fontSize:13,fontWeight:500,marginBottom:12}}>PDF (ZUGFeRD)</div>}

          {/* Client + amount */}
          <div style={{fontSize:15,color:C.textSec,marginBottom:4}}>to {sale.clientName}</div>
          <div style={{fontSize:20,fontWeight:700,color:C.dark,marginBottom:24}}>{fmtAmtL(art.amount<0?-art.amount:art.amount,sale.cur)}</div>

          {/* Action buttons */}
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:28}}>
            <button style={{padding:"0 24px",height:40,borderRadius:20,border:"none",background:C.dark,color:"#fff",fontSize:15,fontWeight:500,cursor:"pointer",fontFamily:SANS}}>Share document</button>
            <button style={{width:40,height:40,borderRadius:20,border:`1px solid ${C.border}`,background:"#fff",color:C.textSec,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>···</button>
          </div>

          {/* PDF preview thumbnail */}
          <div style={{background:C.surfaceAlt,borderRadius:12,padding:16,display:"inline-block"}}>
            <div style={{width:200,height:280,background:"#fff",borderRadius:4,border:`1px solid ${C.border}`,boxShadow:"0 2px 8px rgba(0,0,0,.04)",padding:"16px 14px",textAlign:"left",fontSize:8,color:C.text,fontFamily:SANS}}>
              <div style={{fontSize:6,fontWeight:800,color:C.dark,marginBottom:8}}>finom</div>
              <div style={{display:"flex",gap:4,marginBottom:8}}>
                <div style={{flex:1,padding:4,background:C.surfaceAlt,borderRadius:2}}>
                  <div style={{width:"60%",height:2,background:C.border,borderRadius:1,marginBottom:2}}/>
                  <div style={{width:"80%",height:2,background:C.borderLight,borderRadius:1}}/>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:7,fontWeight:700,color:C.dark}}>{typeLabel.toUpperCase()}</div>
                  <div style={{fontSize:5,color:C.textTer}}>{art.num}</div>
                </div>
              </div>
              <div style={{height:1.5,background:C.dark,borderRadius:1,marginBottom:4}}/>
              {[.9,.7,.6,.5].map((w,i)=><div key={i} style={{height:1.5,background:C.borderLight,borderRadius:1,marginBottom:3,width:`${w*100}%`}}/>)}
              <div style={{marginTop:"auto",paddingTop:12,borderTop:`1px solid ${C.dark}`,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:5,fontWeight:600,color:C.textSec}}>TOTAL</span>
                <span style={{fontSize:7,fontWeight:700,color:C.dark}}>{fmtAmtL(Math.abs(art.amount),sale.cur)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div style={{background:"#fff",borderRadius:20,padding:"32px 40px"}}>
          <div style={{fontSize:20,fontWeight:700,color:C.dark,marginBottom:20}}>Details</div>
          <div style={{display:"flex",gap:0,flexDirection:"column"}}>
            {[
              ["Issuer","Mustermann Digital GmbH"],
              ["",[`VAT ID: ${sellerVatId}`,`IBAN: ${iban}`,`BIC: ${bic}`].join("\n")],
              ["Customer",sale.clientName],
              ["Issue date",fmtDateL(art.date)],
              ...(art.dueDate?[["Due date",fmtDateL(art.dueDate)]]:[]),
              ["Amount",fmtAmtL(Math.abs(art.amount),sale.cur)],
              ["Document number",art.num],
            ].map(([label,val],i)=>(
              <div key={i} style={{display:"flex",padding:"10px 0",borderBottom:i<6?`1px solid ${C.borderLight}`:"none"}}>
                <div style={{flex:"0 0 160px",fontSize:13,color:C.textSec}}>{label}</div>
                <div style={{flex:1,fontSize:14,fontWeight:label?500:400,color:C.dark,whiteSpace:"pre-line"}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — sidebar */}
      <div style={{flex:"0 0 320px",paddingTop:36}}>
        {/* Files card */}
        <div style={{background:"#fff",borderRadius:20,padding:"24px 24px",marginBottom:16}}>
          <div style={{fontSize:17,fontWeight:700,color:C.dark,marginBottom:14}}>Files</div>
          {[
            {name:`${art.num}.pdf`,label:"PDF",size:"124 KB",icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={C.red} strokeWidth="1.5"/><path d="M14 2v6h6" stroke={C.red} strokeWidth="1.5"/><text x="12" y="17" textAnchor="middle" fill={C.red} fontSize="6" fontWeight="700" fontFamily={SANS}>PDF</text></svg>},
            {name:`${art.num}.xml`,label:"ZUGFeRD",size:"18 KB",icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={C.blue} strokeWidth="1.5"/><path d="M14 2v6h6" stroke={C.blue} strokeWidth="1.5"/><text x="12" y="17" textAnchor="middle" fill={C.blue} fontSize="5" fontWeight="700" fontFamily={SANS}>XML</text></svg>},
            {name:`${art.num}-xrechnung.xml`,label:"XRechnung",size:"22 KB",icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={C.teal} strokeWidth="1.5"/><path d="M14 2v6h6" stroke={C.teal} strokeWidth="1.5"/><text x="12" y="17" textAnchor="middle" fill={C.teal} fontSize="4.5" fontWeight="700" fontFamily={SANS}>XR</text></svg>},
          ].map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<2?`1px solid ${C.borderLight}`:"none"}}>
              <div style={{flexShrink:0}}>{f.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:C.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.label}</div>
                <div style={{fontSize:11,color:C.textTer}}>{f.size}</div>
              </div>
              <button onClick={e=>e.stopPropagation()} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:"#fff",color:C.textSec,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:SANS,display:"flex",alignItems:"center",gap:4}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
        </div>

        {/* Link payment card */}
        <div style={{background:"#fff",borderRadius:20,padding:"32px 24px",textAlign:"center",marginBottom:16}}>
          <div style={{width:56,height:56,borderRadius:16,background:C.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={C.textSec} strokeWidth="2" strokeLinecap="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={C.textSec} strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div style={{fontSize:17,fontWeight:700,color:C.dark,marginBottom:8}}>Link payment</div>
          <div style={{fontSize:13,color:C.textSec,lineHeight:1.5,marginBottom:16}}>If you already have a payment on this document, just attach it.</div>
          <button style={{width:"100%",padding:"0 20px",height:40,borderRadius:20,border:`1px solid ${C.border}`,background:"#fff",color:C.dark,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:SANS}}>Link payment</button>
        </div>

        {/* History card */}
        <div style={{background:"#fff",borderRadius:20,padding:"24px 24px"}}>
          <div style={{fontSize:17,fontWeight:700,color:C.dark,marginBottom:16}}>History</div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {history.map((ev,i)=>{
              const isLast=i===history.length-1;
              return(
                <div key={i} style={{display:"flex",gap:12,minHeight:isLast?0:36}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                    <div style={{width:10,height:10,borderRadius:5,border:`2px solid ${ev.done?C.green:C.border}`,background:ev.done?C.green:"transparent",flexShrink:0,marginTop:2}}/>
                    {!isLast&&<div style={{flex:1,width:1.5,background:C.borderLight,marginTop:4}}/>}
                  </div>
                  <div style={{paddingBottom:isLast?0:8}}>
                    <div style={{fontSize:13,fontWeight:500,color:ev.done?C.dark:C.textTer}}>{ev.label}</div>
                    {ev.date&&<div style={{fontSize:12,color:C.textTer,marginTop:2}}>{fmtDateL(ev.date)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );};

  const renderSendScreen=()=>(
    <div className="phase-enter" key="send" style={{maxWidth:760,margin:"0 auto",padding:"0 32px 40px"}}>
      <div style={{marginBottom:16}}><span onClick={()=>setPhase("editor")} style={{fontSize:12,fontWeight:500,color:C.textSec,letterSpacing:.5,textTransform:"uppercase",cursor:"pointer"}}>← Back to editor</span></div>
      <div style={{background:C.greenLight,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:32,height:32,borderRadius:16,background:C.green,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:C.dark}}>Invoice {invNum} created</div>
          <div style={{fontSize:13,color:C.textSec}}>{fmtEurSym(total)} to {client?.name}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
        <div style={{flex:"1 1 60%"}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <div style={{fontSize:17,fontWeight:600,color:C.dark,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>Send by email <AiPill/></div>
            {emailLoading?(<div style={{display:"flex",alignItems:"center",gap:10,padding:"32px 0",justifyContent:"center"}}><div className="sp"/><span style={{fontSize:13,color:C.textSec}}>Composing email...</span><AiPill/></div>):(<>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:500,color:C.textSec,display:"block",marginBottom:4}}>To</label>
                <input value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="client@example.com" style={inputStylePost}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:500,color:C.textSec,display:"block",marginBottom:4}}>Subject</label>
                <input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} style={inputStylePost}/>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,fontWeight:500,color:C.textSec,display:"block",marginBottom:4}}>Message</label>
                <textarea value={emailBody} onChange={e=>setEmailBody(e.target.value)} rows={8} style={{...inputStylePost,lineHeight:1.6,resize:"vertical"}}/>
              </div>
              <button onClick={async()=>{setSendingEmail(true);await delay(1500,2500);setSendingEmail(false);handleGoToReminders(true);}} disabled={sendingEmail} style={{width:"100%",padding:"14px",borderRadius:20,border:"none",background:C.dark,color:"#fff",fontSize:15,fontWeight:600,cursor:sendingEmail?"default":"pointer",opacity:sendingEmail?.7:1,fontFamily:SANS,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {sendingEmail?<><div className="sp" style={{width:16,height:16,borderWidth:2}}/> Sending...</>:<><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Send email</>}
              </button>
              <div style={{textAlign:"center",marginTop:12}}><span onClick={()=>handleGoToReminders(false)} style={{fontSize:13,color:C.textSec,cursor:"pointer",textDecoration:"underline"}}>Skip for now</span></div>
            </>)}
          </div>
        </div>
        <div style={{flex:"1 1 35%"}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <div style={{fontSize:15,fontWeight:600,color:C.dark,marginBottom:12}}>Share link</div>
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              <input readOnly value={shareLink} style={{...inputStylePost,flex:1,fontSize:12,color:C.textSec,background:C.surfaceAlt}}/>
              <button onClick={()=>{navigator.clipboard?.writeText(shareLink);}} style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${C.border}`,background:C.surfaceAlt,cursor:"pointer",fontSize:12,fontFamily:SANS,color:C.dark,whiteSpace:"nowrap"}}>Copy</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[{name:"WhatsApp",color:"#25D366",icon:"W",url:`https://wa.me/?text=${encodeURIComponent(`Invoice ${invNum}: ${shareLink}`)}`},
                {name:"Telegram",color:"#0088cc",icon:"T",url:`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(`Invoice ${invNum}`)}`},
                {name:"Copy link & paste anywhere",color:C.textSec,icon:"@",url:`mailto:?subject=${encodeURIComponent(`Invoice ${invNum}`)}&body=${encodeURIComponent(`View invoice: ${shareLink}`)}`}
              ].map(ch=>(
                <a key={ch.name} href={ch.url} target="_blank" rel="noopener" style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,background:C.surfaceAlt,textDecoration:"none",color:C.text,fontSize:13,fontWeight:500}}>
                  <div style={{width:28,height:28,borderRadius:14,background:ch.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700}}>{ch.icon}</div>
                  {ch.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const [addingReminder,setAddingReminder]=useState(false);

  const updateStepTone=(idx,tone)=>{
    const ctx={clientName:client?.name||"Client",invNum,amount:fmtEurSym(total)};
    setReminderData(d=>{
      const ns=[...d.steps];
      ns[idx]={...ns[idx],tone,preview:previewForTone(tone,ns[idx].daysFromDue,ctx)};
      return{...d,steps:ns};
    });
  };
  const removeStep=(idx)=>{
    setReminderData(d=>({...d,steps:d.steps.filter((_,i)=>i!==idx)}));
  };
  const addStep=(slot)=>{
    const ctx={clientName:client?.name||"Client",invNum,amount:fmtEurSym(total)};
    const tone=slot.daysFromDue>=7?"firm":slot.daysFromDue>=14?"urgent":"friendly";
    const newStep={timing:slot.timing,daysFromDue:slot.daysFromDue,tone,channel:"email",preview:previewForTone(tone,slot.daysFromDue,ctx)};
    setReminderData(d=>{
      const ns=[...d.steps,newStep].sort((a,b)=>a.daysFromDue-b.daysFromDue);
      return{...d,steps:ns};
    });
    setAddingReminder(false);
  };

  const renderRemindersScreen=()=>{
    const ch=client?CLIENT_HISTORY[client.id]||{}:{};
    const steps=reminderData?.steps||[];
    const usedDays=new Set(steps.map(s=>s.daysFromDue));
    const availableSlots=TIMING_SLOTS.filter(s=>!usedDays.has(s.daysFromDue));

    /* Insight card content */
    const rationale=reminderData?.rationale;
    const isNew=!ch.invoiceCount;
    const isLate=ch.avgPayDays>25;
    const insightIcon=isNew?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>:isLate?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>;
    const insightBg=isNew?C.blueLight:isLate?C.amberLight:C.greenLight;
    const insightBorder=isNew?C.blueBorder:isLate?"#F5D0A9":C.greenBorder;
    const insightColor=isNew?C.blue:isLate?C.amber:C.green;

    return(
    <div className="phase-enter" key="reminders" style={{maxWidth:640,margin:"0 auto",padding:"0 24px 40px"}}>
      <div style={{fontSize:22,fontWeight:600,color:C.dark,marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.dark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span>Payment reminders for <span style={{color:C.blue}}>{invNum}</span></span>
        <AiPill/>
      </div>

      {/* ── Insight card ── */}
      {reminderLoading?null:(
        <div style={{padding:"16px 20px",borderRadius:14,background:insightBg,border:`1px solid ${insightBorder}`,marginBottom:24}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
            <div style={{width:32,height:32,borderRadius:16,background:insightColor,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,flexShrink:0}}>{insightIcon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:C.dark,marginBottom:4}}>
                {isNew?"First invoice to this client":isLate?`${client?.name} tend to pay late`:`Tailored for ${client?.name}`}
              </div>
              <div style={{fontSize:13,color:C.text,lineHeight:1.5,marginBottom:8}}>
                {rationale||(isNew?`Standard schedule — we'll learn their payment patterns over time.`:isLate?`They average ${ch.avgPayDays} days to pay across ${ch.invoiceCount} invoices. Firmer schedule with earlier follow-ups.`:`Based on ${ch.invoiceCount} previous invoices, they pay in ~${ch.avgPayDays} days on average. Light-touch approach.`)}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {ch.invoiceCount?<><span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"rgba(255,255,255,.6)",color:C.text,fontWeight:500}}>{ch.invoiceCount} invoice{ch.invoiceCount>1?"s":""}</span>
                <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"rgba(255,255,255,.6)",color:C.text,fontWeight:500}}>avg {ch.avgPayDays} days</span></>:
                <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"rgba(255,255,255,.6)",color:C.text,fontWeight:500}}>No payment history</span>}
                {ch.lastPaidDate&&<span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"rgba(255,255,255,.6)",color:C.text,fontWeight:500}}>Last: {ch.lastPaidDate}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {reminderLoading?(<div style={{display:"flex",alignItems:"center",gap:10,padding:"48px 0",justifyContent:"center"}}><div className="sp"/><span style={{fontSize:13,color:C.textSec}}>Generating reminder schedule...</span><AiPill/></div>):(<>
        {/* ── Timeline ── */}
        <div style={{marginBottom:24}}>
          {steps.map((step,i)=>{
            const isLast=i===steps.length-1;
            const tc=toneColors[step.tone]||C.textSec;
            const tb=toneBg[step.tone]||C.surfaceAlt;
            const stepDate=new Date(new Date(dueDate+"T00:00:00").getTime()+step.daysFromDue*864e5);
            const stepDateStr=stepDate.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
            const toneIcon=step.tone==="friendly"?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>:step.tone==="firm"?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
            const channelIcon=<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
            return(
              <div key={step.daysFromDue} style={{display:"flex",gap:0,minHeight:isLast&&!customizing?0:0}}>
                {/* Timeline rail */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:28,flexShrink:0}}>
                  <div style={{width:28,height:28,borderRadius:14,background:tb,border:`2px solid ${tc}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{toneIcon}</div>
                  {!isLast&&<div style={{flex:1,width:2,background:C.borderLight,minHeight:20}}/>}
                </div>
                {/* Step card */}
                <div style={{flex:1,marginLeft:14,marginBottom:isLast?0:16,padding:"12px 16px",borderRadius:12,background:C.surface,border:`1px solid ${C.borderLight}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                    <span style={{fontSize:14,fontWeight:600,color:C.dark}}>{step.timing}</span>
                    {!customizing&&<span style={{fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:8,background:tb,color:tc}}>{step.tone}</span>}
                    <span style={{fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:8,background:C.blueLight,color:C.blue,display:"inline-flex",alignItems:"center",gap:3}}>{channelIcon}{step.channel}</span>
                    {customizing&&steps.length>1&&<span onClick={()=>removeStep(i)} style={{marginLeft:"auto",width:22,height:22,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.textSec,fontSize:16,lineHeight:1,background:C.surfaceAlt,border:`1px solid ${C.borderLight}`,fontWeight:500}}>×</span>}
                  </div>
                  <div style={{fontSize:12,color:C.textSec,marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.textTer} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {stepDateStr}
                  </div>
                  {/* Tone pills — shown when customizing */}
                  {customizing&&(
                    <div style={{display:"flex",gap:6,marginBottom:8}}>
                      {["friendly","firm","urgent"].map(t=>{
                        const active=step.tone===t;
                        return <button key={t} onClick={()=>updateStepTone(i,t)} style={{padding:"4px 14px",borderRadius:12,border:`1.5px solid ${active?toneColors[t]:C.borderLight}`,background:active?toneBg[t]:"transparent",color:active?toneColors[t]:C.textSec,fontSize:12,fontWeight:active?600:500,cursor:"pointer",fontFamily:SANS,transition:"all .15s"}}>{t}</button>;
                      })}
                    </div>
                  )}
                  <div style={{fontSize:13,color:C.textSec,lineHeight:1.5}}>{step.preview}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Add reminder (when customizing) ── */}
        {customizing&&!addingReminder&&availableSlots.length>0&&(
          <div style={{marginBottom:20,textAlign:"center"}}>
            <button onClick={()=>setAddingReminder(true)} style={{padding:"8px 20px",borderRadius:16,border:`1.5px dashed ${C.border}`,background:"transparent",color:C.textSec,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:SANS}}>+ Add reminder</button>
          </div>
        )}
        {customizing&&addingReminder&&(
          <div style={{marginBottom:20,padding:"14px 16px",borderRadius:12,border:`1px solid ${C.borderLight}`,background:C.surfaceAlt}}>
            <div style={{fontSize:12,fontWeight:600,color:C.textSec,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>When to send?</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {availableSlots.map(slot=>(
                <button key={slot.daysFromDue} onClick={()=>addStep(slot)} style={{padding:"6px 14px",borderRadius:12,border:`1px solid ${C.border}`,background:C.surface,color:C.dark,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:SANS,transition:"all .15s"}}>{slot.timing}</button>
              ))}
            </div>
            <div style={{marginTop:8,textAlign:"right"}}><span onClick={()=>setAddingReminder(false)} style={{fontSize:12,color:C.textSec,cursor:"pointer"}}>Cancel</span></div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={()=>setPhase("done")} style={{flex:1,padding:"14px",borderRadius:20,border:"none",background:C.dark,color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:SANS}}>Confirm reminders</button>
          <button onClick={()=>{setCustomizing(e=>!e);setAddingReminder(false);}} style={{padding:"14px 20px",borderRadius:20,border:`1px solid ${C.border}`,background:customizing?C.surfaceAlt:"transparent",color:C.dark,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:SANS}}>{customizing?"Done":"Customize"}</button>
        </div>
        <div style={{textAlign:"center",marginTop:12}}><span onClick={()=>{setReminderData(null);setPhase("done");}} style={{fontSize:13,color:C.textSec,cursor:"pointer",textDecoration:"underline"}}>No reminders</span></div>
      </>)}
    </div>
  );};

  const renderDoneScreen=()=>{
    const hasReminders=reminderData&&reminderData.steps&&reminderData.steps.length>0;
    const stampLabel=sentViaEmail?"SENT":"SAVED";
    const lifecycle=[{l:"Created",done:true},{l:sentViaEmail?"Sent":"Saved",done:true},{l:"Viewed",done:false},{l:"Paid",done:false}];
    return(
    <div key="done" style={{maxWidth:540,margin:"0 auto",padding:"40px 24px 60px",textAlign:"center"}}>
      {/* ── card + stamp → files into storage box ── */}
      <div style={{position:"relative",height:260,marginBottom:20}}>
        {/* Box BACK wall — bottom layer */}
        <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",zIndex:1,
          animation:"doneBoxIn .4s ease 1.3s both"}}>
          <svg width="200" height="160" viewBox="0 0 200 160" fill="none">
            <rect x="1" y="10" width="198" height="149" rx="4" fill="#ddd8d0" stroke="#c8c2b8"/>
            <rect x="1" y="1" width="198" height="16" rx="4" fill="#e4dfda" stroke="#c8c2b8"/>
            <rect x="10" y="20" width="180" height="130" rx="2" fill="#e4dfda" opacity=".4"/>
          </svg>
        </div>

        {/* Card — middle layer, slides into box */}
        <div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",zIndex:2}}>
          <div style={{position:"relative",animation:"doneFileAway .8s cubic-bezier(.4,0,.2,1) 1.7s forwards"}}>
            {/* mini invoice card */}
            <div style={{width:160,height:204,background:"#fff",borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,.08)",padding:"14px 16px",textAlign:"left",
              animation:"doneCardIn .45s cubic-bezier(.34,1.56,.64,1) .15s both",position:"relative"}}>
              <div style={{fontSize:8,fontWeight:800,color:C.dark,letterSpacing:-.3,marginBottom:10}}>finom</div>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                <div style={{flex:1,padding:"5px 6px",borderRadius:4,background:C.bg}}>
                  <div style={{width:"55%",height:2.5,background:C.border,borderRadius:2,marginBottom:3}}/>
                  <div style={{width:"75%",height:2.5,background:C.borderLight,borderRadius:2}}/>
                </div>
                <div style={{flex:1,padding:"5px 6px",borderRadius:4,background:C.bg}}>
                  <div style={{width:"65%",height:2.5,background:C.border,borderRadius:2,marginBottom:3}}/>
                  <div style={{width:"45%",height:2.5,background:C.borderLight,borderRadius:2}}/>
                </div>
              </div>
              <div style={{height:2,background:C.dark,borderRadius:1,marginBottom:5}}/>
              {[.85,.7,.5].map((w,i)=><div key={i} style={{height:2,background:C.borderLight,borderRadius:1,marginBottom:5,width:`${w*100}%`}}/>)}
              <div style={{flex:1}}/>
              <div style={{marginTop:24,paddingTop:6,borderTop:`1.5px solid ${C.dark}`,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <div style={{fontSize:7,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:.5}}>Total</div>
                <div style={{fontSize:13,fontWeight:700,color:C.dark}}>{fmtEurSym(total)}</div>
              </div>
            </div>
            {/* SENT/SAVED rubber stamp */}
            <div style={{position:"absolute",top:"50%",left:"50%",
              padding:"5px 16px",border:`3px solid ${sentViaEmail?C.green:C.blue}`,borderRadius:4,
              background:"rgba(255,255,255,.85)",
              animation:"doneStamp .35s cubic-bezier(.2,.6,.35,1.4) .9s both"}}>
              <span style={{fontSize:18,fontWeight:800,color:sentViaEmail?C.green:C.blue,letterSpacing:4,fontFamily:MONO}}>{stampLabel}</span>
            </div>
          </div>
        </div>

        {/* Box FRONT wall — top layer, obscures the card */}
        <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",zIndex:3,
          animation:"doneBoxIn .4s ease 1.35s both"}}>
          <svg width="210" height="90" viewBox="0 0 210 90" fill="none">
            <rect x="1" y="1" width="208" height="88" rx="5" fill="#f0ece6" stroke="#d4cfc7"/>
            <rect x="81" y="10" width="48" height="8" rx="4" fill="#cfc9c1"/>
            <rect x="55" y="28" width="100" height="50" rx="4" fill="#faf8f5" stroke="#ddd8d0"/>
            <text x="105" y="51" textAnchor="middle" fill="#b5afa5" fontSize="9" fontWeight="600" fontFamily="Poppins, system-ui, sans-serif">INVOICES</text>
            <text x="105" y="66" textAnchor="middle" fill="#ccc5bb" fontSize="7.5" fontFamily="Poppins, system-ui, sans-serif">2026</text>
          </svg>
        </div>
      </div>

      {/* ── text + lifecycle — reveals after card files away ── */}
      <div style={{animation:"doneReveal .5s ease 2.1s both"}}>
        <div style={{fontSize:30,fontWeight:800,color:C.dark,letterSpacing:-.5,marginBottom:8}}>{doneHl}</div>
        <div style={{fontSize:15,color:C.textSec,lineHeight:1.7,maxWidth:400,margin:"0 auto 28px"}}>{doneSl}</div>

        {/* invoice lifecycle progress */}
        <div style={{display:"inline-flex",alignItems:"center",gap:0,padding:"10px 20px",borderRadius:20,
          background:C.surface,border:`1px solid ${C.borderLight}`,marginBottom:hasReminders?10:28}}>
          {lifecycle.map((s,i)=><React.Fragment key={i}>
            {i>0&&<div style={{width:28,height:1.5,background:s.done?C.greenBorder:C.borderLight,marginLeft:-1,marginRight:-1}}/>}
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"0 4px"}}>
              <div style={{width:18,height:18,borderRadius:9,flexShrink:0,
                background:s.done?C.green:"transparent",border:`1.5px solid ${s.done?C.green:C.border}`,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                {s.done?<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                :<div style={{width:6,height:6,borderRadius:3,background:C.borderLight}}/>}
              </div>
              <span style={{fontSize:12,fontWeight:s.done?600:400,color:s.done?C.dark:C.textTer,whiteSpace:"nowrap"}}>{s.l}</span>
            </div>
          </React.Fragment>)}
        </div>

        {/* reminders note */}
        {hasReminders&&<div style={{fontSize:13,color:C.green,marginTop:4,marginBottom:28,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 017 7c0 3.53-1.4 5.17-2.4 6.65-.58.86-.6 1.85-.6 2.35v0H8v0c0-.5-.02-1.49-.6-2.35C6.4 14.17 5 12.53 5 9a7 7 0 017-7z" stroke={C.green} strokeWidth="1.5"/><path d="M10 21.5a2 2 0 004 0" stroke={C.green} strokeWidth="1.5" strokeLinecap="round"/></svg>
          {reminderData.steps.length} smart reminders will keep things on track
        </div>}

        {/* bookkeeping record */}
        <div style={{textAlign:"left",padding:"16px 20px",borderRadius:14,background:C.surface,border:`1px solid ${C.borderLight}`,marginBottom:24,maxWidth:420,margin:"0 auto 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{width:28,height:28,borderRadius:8,background:C.blueLight,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 10h8"/><path d="M8 14h4"/></svg>
            </div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14,fontWeight:600,color:C.dark}}>Bookkeeping record created</span><AiPill/></div>
              <div style={{fontSize:11,color:C.textSec}}>Auto-categorized from invoice line items</div>
            </div>
          </div>
          <div style={{padding:"12px 14px",borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.borderLight}`}}>
            {Object.entries(vatGroups).map(([rate,g])=>{
              const rn=Number(rate);
              const catLabel=rn===0?"Tax-exempt revenues":`Revenues with ${rn}% VAT${rn===sd.std?" (Standard Rate)":rn===7?" (Reduced Rate)":" (Reduced Rate)"}`;
              return <div key={rate} style={{marginBottom:Object.keys(vatGroups).length>1?8:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:2}}>
                  <span style={{fontSize:13,fontWeight:500,color:C.dark}}>{catLabel}</span>
                  <span style={{fontSize:13,fontWeight:600,color:C.dark}}>{fmtEurSym(g.base+g.vat)}</span>
                </div>
                {rn>0&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:C.blueLight,color:C.blue,fontWeight:500}}>VAT {rn}%: {fmtEurSym(g.vat)}</span>}
              </div>;
            })}
          </div>
          <button onClick={()=>{}} style={{marginTop:10,width:"100%",padding:"8px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.dark,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:SANS,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Review &amp; adjust
          </button>
        </div>

        {/* actions */}
        <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:0}}>
          <button onClick={()=>{setInvNum(freshInvNum());setPhase("editor");setClient(null);setItems([]);setClientListOpen(true);setEmailTo("");setEmailSubject("");setEmailBody("");setReminderData(null);setCustomizing(false);setSentViaEmail(false);setSavingDraft(false);setSendingEmail(false);setCreatingInvoice(false);}} style={{padding:"14px 32px",borderRadius:24,border:"none",background:C.dark,color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:SANS,transition:"transform .15s"}}
            onMouseEnter={e=>e.currentTarget.style.transform="scale(1.03)"}
            onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>Create another invoice</button>
          <button onClick={()=>setPhase("list")} style={{padding:"14px 28px",borderRadius:24,border:`1px solid ${C.border}`,background:"transparent",color:C.dark,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:SANS,transition:"all .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.surface;e.currentTarget.style.borderColor=C.dark}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=C.border}}>Back to invoices</button>
        </div>
      </div>
    </div>
  );};

  /* ─── RENDER ─── */
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:SANS,color:C.text}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}::selection{background:${C.blueLight}}input::placeholder,textarea::placeholder{color:${C.textTer}}input:hover,textarea:hover,select:hover{border-color:${C.borderHard}}input:focus,textarea:focus,select:focus{outline:none;border-color:${C.dark}!important;box-shadow:none}.sp{width:14px;height:14px;border:2.5px solid ${C.border};border-top-color:${C.dark};border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}button{font-family:${SANS};transition:all .15s ease-in-out}textarea{resize:vertical;font-family:${SANS}}@media(max-width:1100px){.split-layout{flex-direction:column!important}.preview-wrap{position:relative!important;max-height:none!important}}.phase-enter{opacity:0;transform:translateY(12px);animation:fadeSlideIn .3s ease forwards}@keyframes fadeSlideIn{to{opacity:1;transform:translateY(0)}}@keyframes doneCardIn{0%{opacity:0;transform:scale(.85) translateY(24px)}100%{opacity:1;transform:scale(1) translateY(0)}}@keyframes doneStamp{0%{opacity:0;transform:translate(-50%,-50%) rotate(-12deg) scale(2.8)}60%{opacity:1;transform:translate(-50%,-50%) rotate(-12deg) scale(.92)}100%{opacity:1;transform:translate(-50%,-50%) rotate(-12deg) scale(1)}}@keyframes doneFileAway{0%{transform:scale(1) translateY(0)}100%{transform:scale(.5) translateY(96px)}}@keyframes doneBoxIn{0%{opacity:0;transform:translateX(-50%) translateY(20px)}100%{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes doneReveal{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}`}</style>

      {/* HEADER — app.finom.co style */}
      <div style={{height:80,padding:"0 32px",display:"flex",alignItems:"center",position:"relative"}}>
        <span style={{fontSize:22,fontWeight:800,color:C.dark,letterSpacing:-.7,cursor:"pointer"}} onClick={()=>setPhase("list")}>finom</span>
        <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",background:"rgb(32,32,32,0.90)",borderRadius:28,height:48,padding:"0 4px",backdropFilter:"blur(8px)"}}>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"0 14px",height:40,borderRadius:20,border:"none",background:"rgba(254,66,180,0.15)",color:"#fff",fontSize:15,fontWeight:500,cursor:"pointer",fontFamily:SANS,margin:"0 2px"}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
            GO
          </button>
          {["Home","Get Paid","Accounting","Team","Cards"].map(item=><button key={item} onClick={()=>{if(item==="Get Paid")setPhase("list");}} style={{padding:"0 14px",height:40,border:"none",background:"transparent",color:item==="Get Paid"?"#fff":"rgba(255,255,255,0.55)",fontSize:15,fontWeight:500,cursor:"pointer",fontFamily:SANS,borderRadius:20,whiteSpace:"nowrap",borderBottom:item==="Get Paid"?"2px solid #fff":"2px solid transparent",borderRadius:0,paddingBottom:2}}>{item}</button>)}
        </div>
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:C.surfaceAlt,border:`2px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.textSec}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
          </div>
          <span style={{fontSize:14,fontWeight:500,color:C.dark,cursor:"pointer"}}>{sellerTrade||sellerName} <span style={{fontSize:10,color:C.textTer}}>▾</span></span>
        </div>
      </div>

      {phase==="list"&&renderListScreen()}
      {phase==="detail"&&renderDetailScreen()}
      {phase==="ai-create"&&renderAiCreateScreen()}

      {phase==="editor"&&(<>
      {/* PAGE TITLE BAR */}
      <div style={{maxWidth:1440,margin:"0 auto",padding:"4px 32px 12px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <span onClick={()=>setPhase("list")} style={{fontSize:13,fontWeight:500,color:C.textSec,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to invoices</span>
          <span style={{fontSize:12,fontFamily:MONO,color:C.textTer}}>{invNum}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h1 style={{fontSize:28,fontWeight:600,color:C.dark,margin:0,fontFamily:SANS}}>New <span style={{color:C.blue}}>invoice</span></h1>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {/* FDS btn-light-secondary */}
            <button onClick={async()=>{setSavingDraft(true);await delay(1200,2000);setSavingDraft(false);setPhase("list");}} disabled={savingDraft||creatingInvoice} style={{padding:"0 24px",height:40,borderRadius:20,border:`1px solid ${C.border}`,background:C.surfaceAlt,color:C.dark,fontSize:15,fontWeight:500,cursor:(savingDraft||creatingInvoice)?"default":"pointer",opacity:(savingDraft||creatingInvoice)?.6:1,fontFamily:SANS,display:"flex",alignItems:"center",gap:6}}>
              {savingDraft?<><div className="sp" style={{width:14,height:14,borderWidth:2,borderColor:`${C.dark} transparent transparent transparent`}}/> Saving...</>:"Save draft"}
            </button>
            {/* FDS btn-primary */}
            <button onClick={handleSendInvoice} disabled={!client||items.length===0||creatingInvoice||savingDraft} style={{padding:"0 24px",height:40,borderRadius:20,border:"none",background:C.dark,color:"#fff",fontSize:15,fontWeight:500,cursor:(!client||items.length===0||creatingInvoice||savingDraft)?"default":"pointer",opacity:(!client||items.length===0||creatingInvoice||savingDraft)?.6:1,fontFamily:SANS,display:"flex",alignItems:"center",gap:6}}>
              {creatingInvoice?<><div className="sp" style={{width:14,height:14,borderWidth:2}}/> Creating...</>:<><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Send invoice</>}
            </button>
          </div>
        </div>
      </div>

      <div className="split-layout" style={{display:"flex",maxWidth:1440,margin:"0 auto 32px",marginLeft:"auto",marginRight:"auto",background:"#fff",borderRadius:20,overflow:"hidden",minHeight:"calc(100vh - 170px)",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
        {/* ═══ LEFT PANEL ═══ */}
        <div style={{flex:"0 0 540px",padding:"20px 16px 32px",overflowY:"auto",maxHeight:"calc(100vh - 170px)",borderRight:`1px solid ${C.border}`}}>

          {/* STEP 0: Branding */}
          <Collapsible icon={ICONS.branding} title="Invoice Branding" subtitle="Logo, colors, layout" open={brandingOpen} onToggle={()=>setBrandingOpen(!brandingOpen)}>
            <div style={{display:"flex",gap:14,marginBottom:14}}>
              <div style={{width:68,height:68,borderRadius:8,border:`2px dashed ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:2,flexShrink:0,cursor:"pointer",background:C.surfaceAlt}} onClick={()=>alert("Logo upload is not available in this prototype.")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={C.textTer} strokeWidth="2" strokeLinecap="round"/></svg><span style={{fontSize:8,color:C.textTer,fontWeight:600}}>Logo</span>
              </div>
              <div style={{flex:1}}>
                <Field label="Display name"><input value={companyDisplay} onChange={e=>setCompanyDisplay(e.target.value)} style={inputStyle}/></Field>
                <div style={{marginTop:8}}><Field label="Accent color"><div style={{display:"flex",gap:5}}>
                  {["#FE42B4","#4A74FF","#1A1A1A","#00C48C","#FFB020","#8B5CF6"].map(c=><div key={c} onClick={()=>setBrandColor(c)} style={{width:24,height:24,borderRadius:5,background:c,cursor:"pointer",border:brandColor===c?`2.5px solid ${C.dark}`:`2.5px solid transparent`,outline:brandColor===c?`2px solid ${C.surface}`:"none"}}/>)}
                </div></Field></div>
              </div>
            </div>
            <div style={{fontSize:13,color:C.textSec,textAlign:"center",padding:8,background:C.surfaceAlt,borderRadius:8,border:`1px solid ${C.borderLight}`}}>Branding changes will be reflected in a future version of this prototype.</div>
          </Collapsible>

          {/* STEP 1: Seller */}
          <Collapsible icon={ICONS.seller} title="Your Business" subtitle={`${sd.flag} ${sellerName}${isEx?` · ${sd.ex.short}`:""}`} open={sellerOpen} onToggle={()=>setSellerOpen(!sellerOpen)}>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
              {Object.keys(VAT).map(k=>{const v=VAT[k],sel=sellerCC===k;return(<button key={k} onClick={()=>{setSellerCC(k);setExempt(false);}} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 9px",background:sel?C.surfaceAlt:"transparent",border:`2px solid ${sel?C.dark:C.border}`,borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:sel?600:500,color:sel?C.dark:C.textSec,outline:"none"}}><span>{v.flag}</span>{v.name}<span style={{fontFamily:MONO,fontSize:9,color:sel?C.dark:C.textTer}}>{v.std}%</span></button>);})}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12}}>
              <Field label="Registered name" half><input value={sellerName} onChange={e=>setSellerName(e.target.value)} style={inputStyle}/></Field>
              <Field label="Trade name (if different)" half><input value={sellerTrade} onChange={e=>setSellerTrade(e.target.value)} placeholder="Optional" style={inputStyle}/></Field>
              <Field label="Street address" half><input value={sellerStreet} onChange={e=>setSellerStreet(e.target.value)} style={inputStyle}/></Field>
              <Field label="Postal code & city" half><input value={sellerCity} onChange={e=>setSellerCity(e.target.value)} style={inputStyle}/></Field>
              <Field label={`VAT ID (${sd.vatPrefix}…)`} half><input value={sellerVatId} onChange={e=>setSellerVatId(e.target.value)} placeholder={`${sd.vatPrefix}000000000`} style={monoInputStyle}/></Field>
              <Field label={sd.taxIdLabel} half><input value={sellerTaxId} onChange={e=>setSellerTaxId(e.target.value)} placeholder={sd.taxIdPlaceholder} style={monoInputStyle}/></Field>
              <Field label="Email" half><input value={sellerEmail} onChange={e=>setSellerEmail(e.target.value)} type="email" style={inputStyle}/></Field>
              <Field label="Phone" half><input value={sellerPhone} onChange={e=>setSellerPhone(e.target.value)} type="tel" style={inputStyle}/></Field>
            </div>
            {!sd.ex?(<div style={{padding:"10px 12px",background:C.redLight,border:`1px solid ${C.red}30`,borderRadius:8}}><span style={{fontSize:13,fontWeight:600,color:C.red}}>{sd.flag} Spain — no small business VAT exemption.</span><span style={{fontSize:13,color:C.textSec,marginLeft:4}}>All autónomos charge IVA.</span></div>):(
              <button onClick={()=>setExempt(!exempt)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",width:"100%",textAlign:"left",cursor:"pointer",background:exempt?C.greenLight:C.surfaceAlt,border:`1.5px solid ${exempt?C.greenBorder:C.border}`,borderRadius:8,outline:"none"}}>
                <div style={{width:18,height:18,borderRadius:4,flexShrink:0,border:`2px solid ${exempt?C.green:C.border}`,background:exempt?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{exempt&&<svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                <div><span style={{fontSize:15,fontWeight:600,color:C.dark}}>{sd.ex.short}</span><span style={{fontSize:13,color:C.textSec,marginLeft:6}}>{sd.ex.ref} · {sd.ex.thresh}</span></div>
              </button>
            )}
          </Collapsible>

          {/* STEP 2: Client */}
          <Section icon={ICONS.client} title="Client" subtitle={client?`${FLAGS[client.country]||"🌐"} ${client.name}`:null}>
            {client&&!clientListOpen?(
              <div style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",background:C.surfaceAlt,border:`2px solid ${C.dark}`,borderRadius:8}}>
                <span style={{fontSize:16,flexShrink:0}}>{FLAGS[client.country]||"🌐"}</span>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:C.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{client.name}</div><div style={{fontSize:11,color:C.textSec,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{client.addr}</div></div>
                <span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 8px",borderRadius:10,background:client.biz?C.blueLight:C.surfaceAlt,color:client.biz?C.blue:C.textSec,border:`1px solid ${client.biz?C.blueBorder:C.border}`,whiteSpace:"nowrap"}}>{client.biz?"B2B":"B2C"}</span>
                <button onClick={()=>setClientListOpen(true)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,color:C.textSec,fontSize:11,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",outline:"none"}}>Change</button>
              </div>
            ):(<>
              <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:300,overflowY:"auto",paddingRight:2}}>
                {CLIENTS.map(c=>{const sel=client?.id===c.id;return(<button key={c.id} onClick={()=>{setClient(c);setClientListOpen(false);}} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",cursor:"pointer",textAlign:"left",background:sel?C.surfaceAlt:"transparent",border:`2px solid ${sel?C.dark:C.border}`,borderRadius:8,outline:"none",width:"100%"}}>
                  <span style={{fontSize:16,flexShrink:0}}>{FLAGS[c.country]||"🌐"}</span>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:sel?600:500,color:C.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div><div style={{fontSize:11,color:C.textSec,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.addr}</div></div>
                  <span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 8px",borderRadius:10,background:c.biz?C.blueLight:C.surfaceAlt,color:c.biz?C.blue:C.textSec,border:`1px solid ${c.biz?C.blueBorder:C.border}`,whiteSpace:"nowrap"}}>{c.biz?"B2B":"B2C"}</span>
                </button>);})}
              </div>
              <button style={{marginTop:8,width:"100%",padding:"9px",borderRadius:12,border:`1.5px dashed ${C.border}`,background:"transparent",color:C.textSec,fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,outline:"none"}} onClick={()=>alert("Client creation is not available in this prototype.")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>Add new client
              </button>
            </>)}
          </Section>

          {/* STEP 3: Line Items */}
          <Section icon={ICONS.items} title="Line Items" subtitle={items.length?`${items.length} item${items.length>1?"s":""} · ${fmtEurSym(subtotal)} net`:null} locked={!client}>
            {isEx&&(<div style={{padding:"8px 12px",background:C.amberLight,border:`1px solid ${C.amber}30`,borderRadius:8,marginBottom:10,fontSize:13,color:C.textSec}}><strong style={{color:C.amber}}>{sd.ex.short}:</strong> No VAT on this invoice.</div>)}
            {isZero&&!isEx&&(<div style={{padding:"8px 12px",background:isRC?C.blueLight:C.greenLight,border:`1px solid ${isRC?C.blueBorder:C.greenBorder}`,borderRadius:8,marginBottom:10,fontSize:13,color:C.textSec}}><strong style={{color:isRC?C.blue:C.green}}>{isRC?"Intra-EU B2B":"Export"}:</strong> All items at 0%. {isRC?"Goods → ICS (Art. 138); Services → RC (Art. 196).":""}</div>)}

            {items.map(it=>{const ri=resolvedItems.find(r=>r.id===it.id)||it;
              const showCategory=it.done&&!isEx&&!isZero; /* hide when category is irrelevant */
              const catOpts=getCategoryOptions(sellerCC);
              return(
              <div key={it.id} style={{padding:12,background:C.surfaceAlt,border:`1px solid ${C.borderLight}`,borderRadius:8,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:15,fontWeight:500,color:C.dark}}>{it.desc}</span>
                      {it.fromCat&&<span style={{fontSize:11,fontFamily:SANS,fontWeight:500,padding:"2px 6px",borderRadius:8,background:C.surfaceAlt,color:C.textTer,border:`1px solid ${C.border}`}}>CAT</span>}
                      {!it.fromCat&&it.done&&<AiPill/>}
                      {it.done&&it.supplyType&&isZero&&!isEx&&<span style={{fontSize:11,fontFamily:SANS,fontWeight:500,padding:"3px 8px",borderRadius:10,background:it.supplyType==="goods"?C.tealLight:C.blueLight,color:it.supplyType==="goods"?C.teal:C.blue,border:`1px solid ${it.supplyType==="goods"?C.tealBorder:C.blueBorder}`}}>{it.supplyType==="goods"?"GOODS":"SERVICES"}</span>}
                    </div>
                    {it.done&&ri.zeroReason&&(<div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
                      <ZeroBadge reason={ri.zeroReason}/>
                      <span style={{fontSize:11,color:C.textSec}}>0% — {ri.zeroReason==="exempt"?"small business exemption":ri.zeroReason==="ics"?"intra-community supply (Art. 138)":ri.zeroReason==="rc"?"reverse charge (Art. 196)":"export exempt"}</span>
                    </div>)}
                    {it.loading&&<div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}><div className="sp"/><span style={{fontSize:11,color:C.textSec}}>Classifying…</span><AiPill/></div>}
                  </div>
                  <button onClick={()=>removeItem(it.id)} style={{background:"transparent",border:"none",color:C.textTer,cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 2px"}} aria-label="Remove">×</button>
                </div>
                <div style={{display:"flex",gap:6,marginBottom:showCategory?8:0}}>
                  <div style={{flex:"0 0 56px"}}><label style={{fontSize:11,fontWeight:500,color:C.textSec,display:"block",marginBottom:2}}>Qty</label><input type="number" min="1" value={it.qty} onChange={e=>updateItem(it.id,"qty",Math.max(1,+e.target.value||1))} style={{...monoInputStyle,textAlign:"center",padding:"7px 4px"}}/></div>
                  <div style={{flex:1}}><label style={{fontSize:11,fontWeight:500,color:C.textSec,display:"block",marginBottom:2}}>Unit price (€)</label><input type="number" min="0" step="0.01" value={it.price||""} placeholder="0.00" onChange={e=>updateItem(it.id,"price",+e.target.value||0)} style={monoInputStyle}/></div>
                  <div style={{flex:"0 0 66px"}}><label style={{fontSize:11,fontWeight:500,color:C.textSec,display:"block",marginBottom:2}}>Disc. %</label><input type="number" min="0" max="100" value={it.discount||""} placeholder="0" onChange={e=>updateItem(it.id,"discount",Math.min(100,+e.target.value||0))} style={{...monoInputStyle,textAlign:"center",padding:"7px 4px"}}/></div>
                </div>
                {/* Category dropdown — determines VAT rate. Hidden when rate is context-driven. */}
                {showCategory&&(<div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
                  <div style={{flex:1}}><label style={{fontSize:11,fontWeight:500,color:C.textSec,display:"block",marginBottom:2}}>Category</label>
                    <select value={it.cat||""} onChange={e=>updateItem(it.id,"cat",e.target.value)} style={{...selectStyle,fontSize:12}}>
                      {!it.cat&&<option value="">—</option>}
                      {/* Group by rate tier */}
                      {[...new Set(catOpts.map(o=>o.rate))].sort((a,b)=>b-a).map(rate=>{
                        const tier=catOpts.filter(o=>o.rate===rate);
                        const rl=sd.rates.find(x=>x.r===rate);
                        return <optgroup key={rate} label={rl?`${rl.l} — ${rate}%`:`${rate}%`}>
                          {tier.map(o=><option key={o.cat} value={o.cat}>{o.cat}</option>)}
                        </optgroup>;
                      })}
                    </select>
                  </div>
                  <div style={{flex:"0 0 auto",paddingBottom:2}}>
                    <span style={{fontSize:13,fontFamily:MONO,fontWeight:600,color:C.dark,padding:"8px 12px",background:C.surface,border:`2px solid ${C.border}`,borderRadius:8,display:"inline-block",whiteSpace:"nowrap"}}>{ri.effectiveRate}%</span>
                  </div>
                </div>)}
              </div>);})}

            {/* Items=0 → catalogue inline. Items>0 → behind Add button. */}
            {items.length===0?(
              renderCatPanel(null)
            ):(
              showAddPanel?(
                renderCatPanel(()=>{setShowAddPanel(false);setShowFreeform(false);setCatSearch("");setDesc("");})
              ):(
                <button onClick={()=>setShowAddPanel(true)} style={{width:"100%",padding:"10px",borderRadius:12,border:`1.5px dashed ${C.border}`,background:C.surfaceAlt,color:C.textSec,fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,outline:"none",marginTop:4}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Add item
                </button>
              )
            )}
          </Section>

          {/* STEP 4: Details & Payment */}
          <Section icon={ICONS.details} title="Details & Payment" locked={!client}>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12}}>
              <Field label="Invoice date" half><input type="date" value={invDate} onChange={e=>setInvDate(e.target.value)} style={inputStyle}/></Field>
              <Field label="Due date" half><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={inputStyle}/></Field>
              <Field label="Payment terms" half>
                <select value={payTerms} onChange={e=>{setPayTerms(e.target.value);const days={"Due on receipt":0,"Net 7":7,"Net 14":14,"Net 30":30,"Net 45":45,"Net 60":60}[e.target.value];if(days!==undefined)setDueDate(isoDate(addDays(new Date(invDate+"T00:00:00"),days)));}} style={selectStyle}>
                  {["Due on receipt","Net 7","Net 14","Net 30","Net 45","Net 60"].map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Payment method" half>
                <select value={payMethod} onChange={e=>setPayMethod(e.target.value)} style={selectStyle}>
                  {["Bank transfer (SEPA)","PayPal","Credit card","Other"].map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            {/* Delivery / service period */}
            <div style={{padding:"10px 12px",background:C.surfaceAlt,border:`1px solid ${C.borderLight}`,borderRadius:8,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:600,color:C.textSec}}>Delivery / Service period</div><div style={{flex:1}}/>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:C.textSec}}>Period</span>
                  <button onClick={()=>setDeliveryType(deliveryType==="date"?"period":"date")} style={{width:36,height:20,borderRadius:10,border:"none",padding:2,cursor:"pointer",background:deliveryType==="period"?C.dark:C.border,display:"flex",alignItems:"center",transition:"background .2s",outline:"none"}}>
                    <div style={{width:16,height:16,borderRadius:8,background:"#fff",boxShadow:"0 1px 2px rgba(0,0,0,.15)",transition:"transform .2s",transform:deliveryType==="period"?"translateX(16px)":"translateX(0)"}}/>
                  </button>
                </div>
              </div>
              {deliveryType==="date"?<Field label="Delivery date"><input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} style={inputStyle}/></Field>:(
                <div style={{display:"flex",gap:10}}><Field label="Period start" half><input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} style={inputStyle}/></Field><Field label="Period end" half><input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} style={inputStyle}/></Field></div>
              )}
            </div>

            {/* PDF language & currency */}
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <Field label="PDF language" half>
                <select value={pdfLang} onChange={e=>setPdfLang(e.target.value)} style={selectStyle}>
                  {Object.entries(LANG).map(([k,v])=><option key={k} value={k}>{v.name}</option>)}
                </select>
              </Field>
              <Field label="Invoice currency" half>
                <select value={curCode} onChange={e=>setCurCode(e.target.value)} style={selectStyle}>
                  {Object.keys(CUR).map(k=><option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
            </div>
            {!isEur&&(<div style={{padding:"8px 12px",background:C.amberLight,border:`1px solid ${C.amber}30`,borderRadius:8,marginBottom:12,fontSize:13,color:C.textSec}}>
              <strong style={{color:C.amber}}>FX note:</strong> Prices entered in EUR. Preview converts at approximate rate 1 EUR ≈ {(1/cur.toEur).toFixed(curCode==="JPY"?0:2)} {curCode}. EUR equivalent shown on invoice.
            </div>)}

            {payMethod==="Bank transfer (SEPA)"&&(<div style={{padding:"10px 12px",background:C.surfaceAlt,border:`1px solid ${C.borderLight}`,borderRadius:8,marginBottom:12}}><div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>Bank details</div><div style={{fontSize:12,fontFamily:MONO,color:C.text,lineHeight:1.7}}>Finom / Solarisbank AG<br/>IBAN: {iban}<br/>BIC: {bic}</div></div>)}
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
              <Field label="PO / Reference number" half><input value={poNumber} onChange={e=>setPoNumber(e.target.value)} placeholder="Optional" style={inputStyle}/></Field>
              <div style={{flex:"1 1 100%"}}><Field label="Notes to client"><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} style={{...inputStyle,lineHeight:1.5}}/></Field></div>
              <div style={{flex:"1 1 100%"}}><Field label="Footer / disclaimer"><textarea value={footerNote} onChange={e=>setFooterNote(e.target.value)} rows={2} placeholder="e.g. Late payments subject to interest…" style={{...inputStyle,lineHeight:1.5}}/></Field></div>
            </div>
          </Section>

        </div>

        {/* ═══ RIGHT — A4 PREVIEW ═══ */}
        <div className="preview-wrap" ref={previewRef} style={{flex:1,padding:"20px 20px 32px",overflowY:"auto",maxHeight:"calc(100vh - 170px)",background:C.surfaceAlt,display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:.6,marginBottom:10,alignSelf:"flex-start"}}>Live Preview {totalPages>1&&<span style={{fontFamily:MONO,fontWeight:400}}>· {totalPages} pages</span>}</div>

          {/* PAGE 1 */}
          <A4Page pageNum={1} totalPages={totalPages} scale={previewScale}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:7.5,fontWeight:600,color:C.textTer,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>{L.from}</div>
                <div style={{fontWeight:700,fontSize:12,color:C.dark}}>{sellerName}</div>
                {sellerTrade&&sellerTrade!==sellerName&&<div style={{fontSize:9,color:C.textSec}}>t/a {sellerTrade}</div>}
                <div style={{fontSize:9,color:C.textSec,lineHeight:1.5,marginTop:1}}>{sellerStreet}, {sellerCity}<br/>{sd.flag} {sd.name}</div>
                <div style={{fontSize:8,fontFamily:MONO,color:C.textSec,marginTop:2,lineHeight:1.5}}>VAT: {sellerVatId}<br/>{sd.taxIdLabel}: {sellerTaxId}</div>
                {(sellerEmail||sellerPhone)&&<div style={{fontSize:8,color:C.textSec,marginTop:1}}>{sellerEmail}{sellerEmail&&sellerPhone?" · ":""}{sellerPhone}</div>}
                {isEx&&<div style={{fontSize:8,fontFamily:MONO,color:C.amber,fontWeight:700,marginTop:3,padding:"2px 5px",background:C.amberLight,borderRadius:3,display:"inline-block",border:`1px solid ${C.amber}25`}}>{sd.ex.short}</div>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:15,fontWeight:800,letterSpacing:-.3,color:C.dark}}>{L.invoice}</div>
                <div style={{fontSize:9,color:C.textSec,marginTop:1}}>{invNum}</div>
                <div style={{fontSize:9,color:C.textSec}}>{L.date}: {fmtDate(invDate)}</div>
                <div style={{fontSize:9,fontWeight:600,color:C.text}}>{L.due}: {fmtDate(dueDate)}</div>
                <div style={{fontSize:8.5,color:C.textSec,marginTop:2}}>{deliveryStr}</div>
                {poNumber&&<div style={{fontSize:8,color:C.textSec,marginTop:2}}>{L.po}: {poNumber}</div>}
                {!isEur&&<div style={{fontSize:8,fontFamily:MONO,color:C.amber,marginTop:3,fontWeight:600}}>{curCode} (≈ EUR)</div>}
              </div>
            </div>
            <div style={{marginBottom:14,padding:"8px 10px",background:C.surfaceAlt,borderRadius:5,border:`1px solid ${C.borderLight}`}}>
              <div style={{fontSize:7,fontWeight:600,color:C.textTer,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>{L.billTo}</div>
              {client?(<div>
                <div style={{fontWeight:600,fontSize:10.5,color:C.dark}}>{FLAGS[client.country]} {client.name}</div>
                <div style={{fontSize:9,color:C.textSec}}>{client.addr}</div>
                {client.vatId&&<div style={{fontSize:8,fontFamily:MONO,color:C.textSec,marginTop:1}}>VAT: {client.vatId}</div>}
                <span style={{fontSize:7.5,fontFamily:MONO,fontWeight:700,padding:"1px 4px",borderRadius:2,background:C.blueLight,color:C.blue,marginTop:2,display:"inline-block",border:`1px solid ${C.blueBorder}`}}>{buyerTag}</span>
              </div>):(<div style={{fontSize:10,color:C.textTer,fontStyle:"italic"}}>Select a client…</div>)}
            </div>
            <div style={{flex:1,minHeight:0}}>
              {renderTH()}
              {items.length===0&&<div style={{padding:"14px 0",textAlign:"center",color:C.textTer,fontSize:9,fontStyle:"italic"}}>No line items</div>}
              {(pages[0]||[]).map(it=>renderItemRow(it))}
              {totalPages>1&&<div style={{padding:"6px 0",textAlign:"center",fontSize:8,color:C.textTer,fontStyle:"italic",borderBottom:`1px solid ${C.borderLight}`}}>Continued…</div>}
            </div>
            {totalPages===1&&renderFooterBlock()}
          </A4Page>

          {pages.slice(1).map((pageItems,idx)=>{const pn=idx+2;const isLast=pn===totalPages;return(
            <A4Page key={pn} pageNum={pn} totalPages={totalPages} scale={previewScale}>
              <div style={{fontSize:8,color:C.textSec,marginBottom:8,display:"flex",justifyContent:"space-between"}}><span>{sellerName} → {client?.name||"—"}</span><span style={{fontFamily:MONO}}>{invNum}</span></div>
              <div style={{flex:1,minHeight:0}}>{renderTH()}{pageItems.map(it=>renderItemRow(it))}{!isLast&&<div style={{padding:"6px 0",textAlign:"center",fontSize:8,color:C.textTer,fontStyle:"italic"}}>Continued…</div>}</div>
              {isLast&&renderFooterBlock()}
            </A4Page>);})}

          <div style={{marginTop:4,display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center"}}>
            <span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 10px",borderRadius:12,background:C.surface,border:`1px solid ${C.border}`,color:C.textSec}}>{sd.flag} {sd.name}</span>
            {buyerTag&&<span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 10px",borderRadius:12,background:C.surface,border:`1px solid ${C.border}`,color:C.textSec}}>{buyerTag}</span>}
            <span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 10px",borderRadius:12,background:C.surface,border:`1px solid ${C.border}`,color:C.textSec}}>{curCode}{!isEur?" ≈ EUR":""}</span>
            <span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 10px",borderRadius:12,background:C.surface,border:`1px solid ${C.border}`,color:C.textSec}}>{LANG[pdfLang].name}</span>
            {isEx&&<span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 10px",borderRadius:12,background:C.amberLight,border:`1px solid ${C.amber}25`,color:C.amber}}>{sd.ex.short}</span>}
            {resolvedItems.some(i=>i.zeroReason==="rc")&&<span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 10px",borderRadius:12,background:C.blueLight,border:`1px solid ${C.blueBorder}`,color:C.blue}}>Reverse charge</span>}
            {resolvedItems.some(i=>i.zeroReason==="ics")&&<span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 10px",borderRadius:12,background:C.tealLight,border:`1px solid ${C.tealBorder}`,color:C.teal}}>Intra-community supply</span>}
            {isExport&&!isEx&&<span style={{fontSize:11,fontFamily:SANS,fontWeight:400,padding:"4px 10px",borderRadius:12,background:C.greenLight,border:`1px solid ${C.greenBorder}`,color:C.green}}>Export 0%</span>}
          </div>
          <div style={{textAlign:"center",marginTop:6}}><span style={{fontSize:9,fontFamily:MONO,color:C.textTer}}>A4 · VAT rates 26 Feb 2026 · Claude API classification{!isEur?` · FX rates approximate`:""}</span></div>
        </div>
      </div>
      </>)}

      {phase==="send"&&renderSendScreen()}
      {phase==="reminders"&&renderRemindersScreen()}
      {phase==="done"&&renderDoneScreen()}
    </div>
  );
}
