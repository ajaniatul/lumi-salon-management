// Shared reference data — the single source of truth for customers,
// products, and services. Consumed by CustomerPicker, ItemPicker, the
// global header search, and the Services / Products / Inventory /
// Billing pages. Edit an entry here and it stays consistent everywhere.

export type SalonCustomer = {
  id: string; name: string; phone: string;
  email?: string; membership?: string | null;
};

export const SALON_CUSTOMERS: SalonCustomer[] = [
  { id:"CUS-0001", name:"Anjali Mehta",   phone:"9988776655", email:"anjali@gmail.com",  membership:"Gold"     },
  { id:"CUS-0002", name:"Sunita Verma",   phone:"9977665544", email:"sunita@gmail.com",  membership:"Silver"   },
  { id:"CUS-0003", name:"Pooja Reddy",    phone:"9966554433", email:"pooja@gmail.com",   membership:null       },
  { id:"CUS-0004", name:"Kavita Joshi",   phone:"9955443322", email:"kavita@gmail.com",  membership:"Platinum" },
  { id:"CUS-0005", name:"Rahul Sharma",   phone:"9944332211", email:"rahul@gmail.com",   membership:null       },
  { id:"CUS-0006", name:"Deepa Nair",     phone:"9933221100", email:"deepa@gmail.com",   membership:"Silver"   },
  { id:"CUS-0007", name:"Riya Kapoor",    phone:"9811223344", email:"riya@gmail.com",    membership:null       },
  { id:"CUS-0008", name:"Mehak Arora",    phone:"9899001122", email:"mehak@gmail.com",   membership:null       },
  { id:"CUS-0009", name:"Prerna Gupta",   phone:"9922110099", email:"prerna@gmail.com",  membership:"Gold"     },
];

// ─── Products (retail + consumables) ──────────────────────
// price = sale price (excl. GST). cost = purchase cost. mrp = printed MRP.
export type SalonProduct = {
  id: string; name: string; brand: string; cat: string;
  price: number; cost: number; mrp: number;
  hsn: string; unit: string;
  stock: number; minStock: number;
  expiry: string; forSale: boolean; popular: boolean;
};

export const SALON_PRODUCTS: SalonProduct[] = [
  { id:"PRD-001", name:"Wella Koleston Perfect Hair Color",     brand:"Wella",       cat:"Hair Color", price:600,  cost:400,  mrp:750,  hsn:"3305", unit:"tube",   stock:15, minStock:5,  expiry:"Dec 2027", forSale:true,  popular:true  },
  { id:"PRD-002", name:"L'Oreal Xtenso Straightening Kit",      brand:"L'Oreal",     cat:"Treatment",  price:1800, cost:1200, mrp:2200, hsn:"3305", unit:"kit",    stock:8,  minStock:3,  expiry:"Oct 2026", forSale:true,  popular:true  },
  { id:"PRD-003", name:"Matrix Biolage Shampoo 400ml",          brand:"Matrix",      cat:"Hair Care",  price:520,  cost:350,  mrp:640,  hsn:"3305", unit:"bottle", stock:20, minStock:8,  expiry:"Mar 2027", forSale:true,  popular:false },
  { id:"PRD-004", name:"OPI Nail Lacquer - Ballet Slipper",     brand:"OPI",         cat:"Nail",       price:600,  cost:400,  mrp:700,  hsn:"3304", unit:"bottle", stock:12, minStock:4,  expiry:"N/A",      forSale:true,  popular:true  },
  { id:"PRD-005", name:"Lakme Eyeconic Kajal - Black",          brand:"Lakme",       cat:"Makeup",     price:150,  cost:90,   mrp:175,  hsn:"3304", unit:"piece",  stock:3,  minStock:10, expiry:"Jun 2026", forSale:true,  popular:false },
  { id:"PRD-006", name:"Biotique Papaya Body Scrub 235g",       brand:"Biotique",    cat:"Skin Care",  price:350,  cost:220,  mrp:420,  hsn:"3307", unit:"jar",    stock:18, minStock:6,  expiry:"Sep 2027", forSale:true,  popular:false },
  { id:"PRD-007", name:"Schwarzkopf Bleach Powder 450g",        brand:"Schwarzkopf", cat:"Hair Color", price:850,  cost:600,  mrp:990,  hsn:"3305", unit:"pack",   stock:6,  minStock:4,  expiry:"Feb 2027", forSale:false, popular:false },
  { id:"PRD-008", name:"Rica Stripless Wax Liposoluble 500ml",  brand:"Rica",        cat:"Wax",        price:620,  cost:450,  mrp:720,  hsn:"3307", unit:"tin",    stock:10, minStock:5,  expiry:"Aug 2026", forSale:false, popular:false },
];

// ─── Services ─────────────────────────────────────────────
// SAC codes: 999721 = hair, 999722 = beauty/nails/makeup, 999723 = spa/body
// gst is a single combined rate (CGST + SGST); all services are 18%.
export type SalonService = {
  code: string; name: string; cat: string;
  price: number; sac: string; duration: number;
  gst: number; desc: string; popular: boolean;
};

export const SALON_SERVICES: SalonService[] = [
  { code:"SRV-001", name:"Women's Haircut",                cat:"Hair",   price:500,   sac:"999721", duration:45,  gst:18, popular:true,  desc:"Precision cut with wash and blow-dry finish." },
  { code:"SRV-002", name:"Men's Haircut",                  cat:"Hair",   price:300,   sac:"999721", duration:30,  gst:18, popular:false, desc:"Classic or modern cut with scalp massage and styling." },
  { code:"SRV-003", name:"Hair Coloring — Global",         cat:"Hair",   price:2500,  sac:"999721", duration:120, gst:18, popular:true,  desc:"Full head single-shade color using premium Wella/L'Oreal." },
  { code:"SRV-004", name:"Hair Coloring — Highlights",     cat:"Hair",   price:3500,  sac:"999721", duration:150, gst:18, popular:false, desc:"Partial or full highlights with foil technique." },
  { code:"SRV-005", name:"Hair Spa",                       cat:"Hair",   price:1200,  sac:"999721", duration:60,  gst:18, popular:true,  desc:"Deep conditioning treatment with steam, protein mask." },
  { code:"SRV-006", name:"Keratin Treatment",              cat:"Hair",   price:5000,  sac:"999721", duration:180, gst:18, popular:true,  desc:"Formaldehyde-free keratin smoothing treatment." },
  { code:"SRV-007", name:"Smoothening",                    cat:"Hair",   price:4500,  sac:"999721", duration:180, gst:18, popular:false, desc:"Chemical hair straightening. Semi-permanent." },
  { code:"SRV-008", name:"Blow Dry & Styling",             cat:"Hair",   price:600,   sac:"999721", duration:45,  gst:18, popular:false, desc:"Professional blow-dry with round brush styling." },
  { code:"SRV-009", name:"Basic Facial",                   cat:"Skin",   price:1000,  sac:"999722", duration:60,  gst:18, popular:false, desc:"Cleansing, steaming, exfoliation, massage and face mask." },
  { code:"SRV-010", name:"Gold Facial",                    cat:"Skin",   price:2000,  sac:"999722", duration:75,  gst:18, popular:true,  desc:"24K gold-infused facial for anti-aging and radiance." },
  { code:"SRV-011", name:"D-Tan Facial",                   cat:"Skin",   price:1500,  sac:"999722", duration:60,  gst:18, popular:false, desc:"Targeted tan removal and pigmentation treatment." },
  { code:"SRV-012", name:"Clean Up",                       cat:"Skin",   price:700,   sac:"999722", duration:40,  gst:18, popular:false, desc:"Quick cleanse, scrub and light mask." },
  { code:"SRV-013", name:"Manicure (Basic)",               cat:"Nails",  price:600,   sac:"999722", duration:45,  gst:18, popular:false, desc:"Nail shaping, cuticle care, hand massage and nail paint." },
  { code:"SRV-014", name:"Pedicure (Basic)",               cat:"Nails",  price:800,   sac:"999722", duration:60,  gst:18, popular:false, desc:"Foot soak, scrub, nail shaping and leg massage." },
  { code:"SRV-015", name:"Gel Nail Extension",             cat:"Nails",  price:2000,  sac:"999722", duration:90,  gst:18, popular:true,  desc:"Full gel nail extension set with nail art." },
  { code:"SRV-016", name:"Party Makeup",                   cat:"Makeup", price:2500,  sac:"999722", duration:90,  gst:18, popular:false, desc:"Full face party-ready makeup with professional products." },
  { code:"SRV-017", name:"Bridal Makeup",                  cat:"Makeup", price:15000, sac:"999722", duration:180, gst:18, popular:true,  desc:"Full HD/airbrush bridal look with draping and accessories." },
  { code:"SRV-018", name:"Engagement Makeup",              cat:"Makeup", price:8000,  sac:"999722", duration:150, gst:18, popular:false, desc:"Engagement-appropriate makeup with hair styling." },
  { code:"SRV-019", name:"Full Body Waxing",               cat:"Body",   price:2000,  sac:"999723", duration:90,  gst:18, popular:false, desc:"Rica/honey wax for full body hair removal." },
  { code:"SRV-020", name:"Half Leg Waxing",                cat:"Body",   price:400,   sac:"999723", duration:30,  gst:18, popular:false, desc:"Waxing from knee to ankle. Rica wax used." },
  { code:"SRV-021", name:"Full Arms Waxing",               cat:"Body",   price:300,   sac:"999723", duration:25,  gst:18, popular:false, desc:"Waxing from wrist to shoulder." },
  { code:"SRV-022", name:"Pre-Bridal Package (Basic)",     cat:"Bridal", price:12000, sac:"999722", duration:300, gst:18, popular:false, desc:"3-session package: facial, body polish, wax, manicure-pedicure." },
  { code:"SRV-023", name:"Pre-Bridal Package (Premium)",   cat:"Bridal", price:25000, sac:"999722", duration:360, gst:18, popular:true,  desc:"5-session luxury: gold facial, keratin, wax, manicure, trial makeup." },
];
