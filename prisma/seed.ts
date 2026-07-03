/**
 * Database seed — creates demo users, services, products, and customers.
 * Run: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
});

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Pre-hash all passwords at once (saltRounds=8 is fast, still secure for demo) ──
  console.log("Hashing passwords...");
  const [h1, h2, h3, h4, h5, h6] = await Promise.all([
    bcrypt.hash("admin123",   8),
    bcrypt.hash("manager123", 8),
    bcrypt.hash("recept123",  8),
    bcrypt.hash("stylist123", 8),
    bcrypt.hash("ankita123",  8),
    bcrypt.hash("meera123",   8),
  ]);

  // ─── Connect explicitly ───────────────────────────────
  await prisma.$connect();
  console.log("Connected to database ✓\n");

  // ─── Users (upsert all in one go) ────────────────────
  const userData = [
    { name: "Admin User",            email: "admin@salon.com",     passwordHash: h1, role: "ADMIN"         as const },
    { name: "Priya Sharma",          email: "manager@salon.com",   passwordHash: h2, role: "MANAGER"       as const },
    { name: "Reception Desk",        email: "reception@salon.com", passwordHash: h3, role: "RECEPTIONIST"  as const },
    { name: "Riya Patel",            email: "stylist@salon.com",   passwordHash: h4, role: "STYLIST"       as const },
    { name: "Ankita Singh",          email: "ankita@salon.com",    passwordHash: h5, role: "STYLIST"       as const },
    { name: "Meera Kapoor",          email: "meera@salon.com",     passwordHash: h6, role: "STYLIST"       as const },
  ];

  const createdUsers = await Promise.all(
    userData.map((u) =>
      prisma.user.upsert({
        where:  { email: u.email },
        update: {},
        create: u,
      })
    )
  );
  createdUsers.forEach((u) => console.log(`✓ User: ${u.email} (${u.role})`));

  // ─── Staff ────────────────────────────────────────────
  const staffRows = [
    { userId: createdUsers[1].id, employeeId: "EMP-001", name: "Priya Sharma",  phone: "9876543210", designation: "Senior Stylist & Manager",   specializations: ["Hair Coloring","Keratin","Bridal Styling"],    salary: 35000, joiningDate: new Date("2022-03-15") },
    { userId: createdUsers[3].id, employeeId: "EMP-002", name: "Riya Patel",    phone: "9876543211", designation: "Senior Stylist",              specializations: ["Hair Spa","Hair Cut","Smoothening"],           salary: 28000, joiningDate: new Date("2022-08-01") },
    { userId: createdUsers[4].id, employeeId: "EMP-003", name: "Ankita Singh",  phone: "9876543212", designation: "Makeup Artist",              specializations: ["Bridal Makeup","Party Makeup","Facial"],       salary: 25000, joiningDate: new Date("2023-01-10") },
    { userId: createdUsers[5].id, employeeId: "EMP-004", name: "Meera Kapoor",  phone: "9876543213", designation: "Nail & Skin Specialist",     specializations: ["Manicure","Pedicure","Waxing","Facial"],       salary: 22000, joiningDate: new Date("2023-06-20") },
  ];

  await Promise.all(
    staffRows.map((s) =>
      prisma.staff.upsert({ where: { employeeId: s.employeeId }, update: {}, create: s })
    )
  );
  console.log(`✓ Staff: ${staffRows.length} created`);

  // ─── Services ─────────────────────────────────────────
  const services = [
    { serviceCode: "SRV-001", name: "Women's Haircut",               category: "HAIR"   as const, price: 500,   duration: 45  },
    { serviceCode: "SRV-002", name: "Men's Haircut",                 category: "HAIR"   as const, price: 300,   duration: 30  },
    { serviceCode: "SRV-003", name: "Hair Coloring (Global)",        category: "HAIR"   as const, price: 2500,  duration: 120 },
    { serviceCode: "SRV-004", name: "Hair Coloring (Highlights)",    category: "HAIR"   as const, price: 3500,  duration: 150 },
    { serviceCode: "SRV-005", name: "Hair Spa",                      category: "HAIR"   as const, price: 1200,  duration: 60  },
    { serviceCode: "SRV-006", name: "Keratin Treatment",             category: "HAIR"   as const, price: 5000,  duration: 180 },
    { serviceCode: "SRV-007", name: "Smoothening",                   category: "HAIR"   as const, price: 4500,  duration: 180 },
    { serviceCode: "SRV-008", name: "Blow Dry & Styling",            category: "HAIR"   as const, price: 600,   duration: 45  },
    { serviceCode: "SRV-009", name: "Basic Facial",                  category: "SKIN"   as const, price: 1000,  duration: 60  },
    { serviceCode: "SRV-010", name: "Gold Facial",                   category: "SKIN"   as const, price: 2000,  duration: 75  },
    { serviceCode: "SRV-011", name: "D-Tan Facial",                  category: "SKIN"   as const, price: 1500,  duration: 60  },
    { serviceCode: "SRV-012", name: "Clean Up",                      category: "SKIN"   as const, price: 700,   duration: 40  },
    { serviceCode: "SRV-013", name: "Manicure (Basic)",              category: "NAILS"  as const, price: 600,   duration: 45  },
    { serviceCode: "SRV-014", name: "Pedicure (Basic)",              category: "NAILS"  as const, price: 800,   duration: 60  },
    { serviceCode: "SRV-015", name: "Gel Nail Extension",            category: "NAILS"  as const, price: 2000,  duration: 90  },
    { serviceCode: "SRV-016", name: "Party Makeup",                  category: "MAKEUP" as const, price: 2500,  duration: 90  },
    { serviceCode: "SRV-017", name: "Bridal Makeup",                 category: "MAKEUP" as const, price: 15000, duration: 180 },
    { serviceCode: "SRV-018", name: "Engagement Makeup",             category: "MAKEUP" as const, price: 8000,  duration: 150 },
    { serviceCode: "SRV-019", name: "Full Body Waxing",              category: "BODY"   as const, price: 2000,  duration: 90  },
    { serviceCode: "SRV-020", name: "Half Leg Waxing",               category: "BODY"   as const, price: 400,   duration: 30  },
    { serviceCode: "SRV-021", name: "Full Arms Waxing",              category: "BODY"   as const, price: 300,   duration: 25  },
    { serviceCode: "SRV-022", name: "Pre-Bridal Package (Basic)",    category: "BRIDAL" as const, price: 12000, duration: 300 },
    { serviceCode: "SRV-023", name: "Pre-Bridal Package (Premium)",  category: "BRIDAL" as const, price: 25000, duration: 360 },
  ];

  await Promise.all(
    services.map((s) =>
      prisma.service.upsert({
        where:  { serviceCode: s.serviceCode },
        update: {},
        create: { ...s, gstRate: 18 },
      })
    )
  );
  console.log(`✓ Services: ${services.length} created`);

  // ─── Products ─────────────────────────────────────────
  const products = [
    { sku: "PRD-001", name: "Wella Koleston Hair Color - Natural Brown", category: "HAIR_CARE" as const, brand: "Wella",    price: 850,  costPrice: 600,  stockQuantity: 15, minStockLevel: 5  },
    { sku: "PRD-002", name: "L'Oreal Keratin Treatment Kit",             category: "HAIR_CARE" as const, brand: "L'Oreal",  price: 2500, costPrice: 1800, stockQuantity: 8,  minStockLevel: 3  },
    { sku: "PRD-003", name: "Matrix Biolage Shampoo 400ml",              category: "HAIR_CARE" as const, brand: "Matrix",   price: 650,  costPrice: 420,  stockQuantity: 20, minStockLevel: 8  },
    { sku: "PRD-004", name: "OPI Nail Polish - Ballet Slipper",          category: "NAIL_CARE" as const, brand: "OPI",      price: 750,  costPrice: 500,  stockQuantity: 12, minStockLevel: 4  },
    { sku: "PRD-005", name: "Lakme Eyeconic Kajal",                      category: "MAKEUP"    as const, brand: "Lakme",    price: 200,  costPrice: 130,  stockQuantity: 3,  minStockLevel: 10 },
    { sku: "PRD-006", name: "Biotique Papaya Body Scrub 235g",           category: "SKIN_CARE" as const, brand: "Biotique", price: 450,  costPrice: 290,  stockQuantity: 18, minStockLevel: 6  },
  ];

  await Promise.all(
    products.map((p) =>
      prisma.product.upsert({
        where:  { sku: p.sku },
        update: {},
        create: { ...p, gstRate: 18 },
      })
    )
  );
  console.log(`✓ Products: ${products.length} created`);

  // ─── Customers ────────────────────────────────────────
  const customers = [
    { customerId: "CUS-0001", name: "Anjali Mehta",  phone: "9988776655", email: "anjali@gmail.com", gender: "FEMALE" as const, loyaltyPoints: 250 },
    { customerId: "CUS-0002", name: "Sunita Verma",  phone: "9977665544", email: "sunita@gmail.com", gender: "FEMALE" as const, loyaltyPoints: 480 },
    { customerId: "CUS-0003", name: "Pooja Reddy",   phone: "9966554433", email: "pooja@gmail.com",  gender: "FEMALE" as const, loyaltyPoints: 120 },
    { customerId: "CUS-0004", name: "Kavita Joshi",  phone: "9955443322",                            gender: "FEMALE" as const, loyaltyPoints: 0   },
    { customerId: "CUS-0005", name: "Rahul Sharma",  phone: "9944332211", email: "rahul@gmail.com",  gender: "MALE"   as const, loyaltyPoints: 80  },
  ];

  await Promise.all(
    customers.map((c) =>
      prisma.customer.upsert({ where: { customerId: c.customerId }, update: {}, create: c })
    )
  );
  console.log(`✓ Customers: ${customers.length} created`);

  // ─── Memberships ──────────────────────────────────────
  const memberships = [
    { name: "Silver",   tier: "SILVER"   as const, price: 2999,  validityDays: 90,  discountPercent: 10, benefits: ["10% off all services", "Birthday bonus 100 points", "Priority booking"] },
    { name: "Gold",     tier: "GOLD"     as const, price: 5999,  validityDays: 180, discountPercent: 15, benefits: ["15% off all services", "Free hair spa monthly", "Birthday + Anniversary bonus"] },
    { name: "Platinum", tier: "PLATINUM" as const, price: 11999, validityDays: 365, discountPercent: 20, benefits: ["20% off all services", "Free facial quarterly", "Dedicated stylist", "WhatsApp concierge"] },
  ];

  await Promise.all(
    memberships.map((m) =>
      prisma.membership.upsert({ where: { id: m.name.toLowerCase() }, update: {}, create: { id: m.name.toLowerCase(), ...m } })
        .catch(() => prisma.membership.findFirst({ where: { tier: m.tier } }))
    )
  );
  console.log("✓ Memberships: 3 tiers created");

  // ─── Salon Settings ───────────────────────────────────
  await prisma.salonSettings.upsert({
    where:  { id: "default" },
    update: {},
    create: {
      id:           "default",
      salonName:    "Elysian Salon",
      tagline:      "Where Beauty Meets Excellence",
      address:      "Shop No. 12, Luxury Mall, Bandra West, Mumbai - 400050",
      phone:        "022-12345678",
      email:        "hello@elysiansalon.in",
      gstin:        "27AABCE1234F1Z5",
      workingDays:  ["MON","TUE","WED","THU","FRI","SAT"],
      openingTime:  "09:00",
      closingTime:  "20:00",
    },
  });
  console.log("✓ Salon settings initialized");

  console.log("\n✅ Database seeded successfully!");
  console.log("\n📧 Login credentials:");
  console.log("   ADMIN         admin@salon.com      /  admin123");
  console.log("   MANAGER       manager@salon.com    /  manager123");
  console.log("   RECEPTIONIST  reception@salon.com  /  recept123");
  console.log("   STYLIST       stylist@salon.com    /  stylist123");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
