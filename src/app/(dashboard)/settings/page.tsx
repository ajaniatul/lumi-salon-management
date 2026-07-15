"use client";
import { useState, useEffect } from "react";
import { Save, Building, Clock, Bell, Shield, Percent, Users, Trash2, UserPlus, Power, X, Tag, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id:"salon",      label:"Salon Info",       icon:Building, desc:"Name, address, GSTIN, contact" },
  { id:"hours",      label:"Business Hours",   icon:Clock,    desc:"Opening/closing times per day" },
  { id:"categories", label:"Categories",       icon:Tag,      desc:"Service & product category lists" },
  { id:"gst",        label:"GST & Billing",    icon:Percent,  desc:"Tax rates, invoice format, GSTIN" },
  { id:"notifications", label:"Notifications", icon:Bell,     desc:"WhatsApp, SMS and email triggers" },
  { id:"roles",      label:"Roles & Access",   icon:Shield,   desc:"Staff permissions per role" },
  { id:"users",      label:"User Accounts",    icon:Users,    desc:"Add and manage staff login profiles" },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const INIT_NOTIFICATIONS = [
  { trigger:"Appointment Confirmed", channel:"WhatsApp", enabled:true, timing:"Immediately", desc:"Sends booking confirmation with stylist name, time and service details" },
  { trigger:"Appointment Reminder", channel:"WhatsApp + SMS", enabled:true, timing:"2 hours before", desc:"Reminds customer of upcoming appointment and cancel/reschedule link" },
  { trigger:"Invoice Sent", channel:"WhatsApp", enabled:true, timing:"After checkout", desc:"Sends PDF invoice with GST breakdown" },
  { trigger:"Birthday Greeting", channel:"WhatsApp", enabled:true, timing:"Morning of birthday", desc:"Personalised birthday message with a special offer" },
  { trigger:"Anniversary Greeting", channel:"WhatsApp", enabled:false, timing:"Morning of anniversary", desc:"Wedding anniversary message — requires date in customer profile" },
  { trigger:"Membership Renewal Reminder", channel:"WhatsApp + Email", enabled:true, timing:"15 days before expiry", desc:"Nudges customer to renew with renewal link and benefits summary" },
];

const ROLES = [
  { key: "ADMIN",        label: "Admin (Owner)",  color: "bg-primary-100 text-primary-700 border-primary-200" },
  { key: "MANAGER",      label: "Manager",        color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "RECEPTIONIST", label: "Receptionist",   color: "bg-teal-100 text-teal-700 border-teal-200" },
  { key: "STYLIST",      label: "Stylist",        color: "bg-blue-100 text-blue-700 border-blue-200" },
] as const;
type RoleKey = typeof ROLES[number]["key"];

const ALL_MODULES = [
  { id: "dashboard",         label: "Dashboard",                    group: "Core" },
  { id: "appt_view",         label: "Appointments — View",          group: "Core" },
  { id: "appt_manage",       label: "Appointments — Create / Edit / Delete", group: "Core" },
  { id: "customers_view",    label: "Customers — View",             group: "Core" },
  { id: "customers_manage",  label: "Customers — Add / Edit",       group: "Core" },
  { id: "billing_view",      label: "Billing & Invoices — View",    group: "Finance" },
  { id: "billing_manage",    label: "Billing & Invoices — Create / Edit", group: "Finance" },
  { id: "expenses",          label: "Expenses",                     group: "Finance" },
  { id: "petty_cash",        label: "Petty Cash Book",              group: "Finance" },
  { id: "services_view",     label: "Services & Products — View",   group: "Catalogue" },
  { id: "services_manage",   label: "Services & Products — Add / Edit", group: "Catalogue" },
  { id: "inventory",         label: "Inventory",                    group: "Catalogue" },
  { id: "purchases",         label: "Purchases",                    group: "Catalogue" },
  { id: "staff_view",        label: "Staff — View",                 group: "People" },
  { id: "staff_manage",      label: "Staff — Add / Edit",           group: "People" },
  { id: "attendance_view",   label: "Attendance — View All",        group: "People" },
  { id: "attendance_mark",   label: "Attendance — Mark / Edit",     group: "People" },
  { id: "commission",        label: "Commission Reports",           group: "People" },
  { id: "memberships",       label: "Memberships",                  group: "Growth" },
  { id: "packages",          label: "Packages",                     group: "Growth" },
  { id: "reports",           label: "Reports & Analytics",          group: "Growth" },
  { id: "settings",          label: "Settings",                     group: "Admin" },
  { id: "user_accounts",     label: "User Accounts",                group: "Admin" },
];

const DEFAULT_PERMISSIONS: Record<RoleKey, string[]> = {
  ADMIN:        ALL_MODULES.map(m => m.id),
  MANAGER:      ["dashboard","appt_view","appt_manage","customers_view","customers_manage","billing_view","billing_manage","expenses","services_view","inventory","purchases","staff_view","attendance_view","attendance_mark","commission","memberships","packages","reports"],
  RECEPTIONIST: ["dashboard","appt_view","appt_manage","customers_view","customers_manage","billing_view","billing_manage","services_view","memberships","packages"],
  STYLIST:      ["dashboard","appt_view","customers_view","commission"],
};

const ROLE_COLORS: Record<string,string> = {
  "Admin (Owner)":  "bg-primary-100 text-primary-700 border-primary-200",
  "Manager":        "bg-violet-100 text-violet-700 border-violet-200",
  "Receptionist":   "bg-teal-100 text-teal-700 border-teal-200",
  "Stylist":        "bg-blue-100 text-blue-700 border-blue-200",
};

export default function SettingsPage() {
  const [active, setActive] = useState("salon");
  const [notifications, setNotifications] = useState(INIT_NOTIFICATIONS);
  const [editRole, setEditRole] = useState<RoleKey|null>(null);

  // Permission state — initialise from localStorage, fall back to defaults
  const [permissions, setPermissions] = useState<Record<RoleKey, string[]>>(() => {
    if (typeof window === "undefined") return DEFAULT_PERMISSIONS;
    try {
      const saved = localStorage.getItem("rolePermissions");
      return saved ? JSON.parse(saved) : DEFAULT_PERMISSIONS;
    } catch { return DEFAULT_PERMISSIONS; }
  });
  const [permDraft, setPermDraft] = useState<string[]>([]);

  const openEditRole = (rk: RoleKey) => {
    setPermDraft([...(permissions[rk] ?? [])]);
    setEditRole(rk);
  };
  const savePermissions = () => {
    if (!editRole) return;
    const next = { ...permissions, [editRole]: permDraft };
    setPermissions(next);
    localStorage.setItem("rolePermissions", JSON.stringify(next));
    setEditRole(null);
    toast.success("Permissions updated");
  };
  const [notifSaved, setNotifSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "RECEPTIONIST" as "ADMIN" | "MANAGER" | "RECEPTIONIST" | "STYLIST",
  });

  // Category state
  const DEFAULT_SVC_CATS  = ["HAIR","SKIN","NAILS","MAKEUP","BODY","BRIDAL","KIDS","WELLNESS"];
  const DEFAULT_PROD_CATS = ["HAIR_CARE","SKIN_CARE","NAIL_CARE","MAKEUP","TOOLS","ACCESSORIES","CONSUMABLES"];
  const [serviceCats, setServiceCats] = useState<string[]>(DEFAULT_SVC_CATS);
  const [productCats, setProductCats] = useState<string[]>(DEFAULT_PROD_CATS);
  const [newSvcCat,   setNewSvcCat]   = useState("");
  const [newProdCat,  setNewProdCat]  = useState("");
  const [savingCats,  setSavingCats]  = useState(false);

  const DB_ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin (Owner)",
    MANAGER: "Manager",
    RECEPTIONIST: "Receptionist",
    STYLIST: "Stylist",
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (json.success) setUsersList(json.data);
    } catch {
      toast.error("Failed to load user accounts");
    }
  };

  const toggleUserActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("User login access status updated");
        loadUsers();
      } else {
        toast.error(json.error || "Failed to update user status");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user account?")) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "User account removed");
        loadUsers();
      } else {
        toast.error(json.error || "Failed to delete user account");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      toast.error("All fields are required");
      return;
    }
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserForm),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("User account created successfully!");
        setShowAddUserModal(false);
        setNewUserForm({ name: "", email: "", password: "", role: "RECEPTIONIST" });
        loadUsers();
      } else {
        toast.error(json.error || "Failed to create user account");
      }
    } catch {
      toast.error("Failed to create user");
    }
  };

  useEffect(() => {
    if (active === "users") {
      loadUsers();
    }
  }, [active]);

  const [form, setForm] = useState({
    salonName: "Lumi Beauty Lounge",
    tagline: "Where Beauty Meets Luxury",
    phone: "022-12345678",
    email: "hello@lumisalon.in",
    website: "www.lumisalon.in",
    address: "Shop No. 12, First Floor, Luxury Mall, Linking Road, Bandra West, Mumbai - 400050",
    gstin: "27AABCE1234F1Z5",
    logo: "",
    openingTime: "10:00 AM",
    closingTime: "07:00 PM",
  });

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setForm({
            salonName: d.salonName || "",
            tagline: d.tagline || "",
            phone: d.phone || "",
            email: d.email || "",
            website: "www.lumisalon.in", // mock website
            address: d.address || "",
            gstin: d.gstin || "",
            logo: d.logo || "",
            openingTime: d.openingTime || "10:00 AM",
            closingTime: d.closingTime || "07:00 PM",
          });
          if (d.serviceCategories?.length) setServiceCats(d.serviceCategories);
          if (d.productCategories?.length) setProductCats(d.productCategories);
        }
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleNotif = (trigger: string) => {
    setNotifications(ns => ns.map(n => n.trigger===trigger ? { ...n, enabled:!n.enabled } : n));
  };
  const saveNotifs = () => { setNotifSaved(true); setTimeout(()=>setNotifSaved(false), 2500); };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      toast.error("Logo file size must be under 800KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(f => ({ ...f, logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setForm(f => ({ ...f, logo: "" }));
  };

  const saveSalonInfo = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonName: form.salonName,
          tagline: form.tagline,
          phone: form.phone,
          email: form.email,
          address: form.address,
          gstin: form.gstin,
          logo: form.logo,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Salon information saved successfully!");
        // Refresh page to propagate layout changes
        window.location.reload();
      } else {
        toast.error(json.error || "Failed to save settings");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const [savingHours, setSavingHours] = useState(false);
  const saveBusinessHours = async () => {
    setSavingHours(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingTime: form.openingTime, closingTime: form.closingTime }),
      });
      const json = await res.json();
      if (json.success) toast.success("Business hours saved successfully!");
      else toast.error(json.error || "Failed to save hours");
    } catch { toast.error("Network error"); }
    finally { setSavingHours(false); }
  };

  const saveCategories = async () => {
    setSavingCats(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceCategories: serviceCats.filter(c => c.trim()),
          productCategories: productCats.filter(c => c.trim()),
        }),
      });
      const json = await res.json();
      if (json.success) toast.success("Categories saved!");
      else toast.error(json.error || "Failed to save categories");
    } catch { toast.error("Network error"); }
    finally { setSavingCats(false); }
  };

  const addSvcCat = () => {
    const v = newSvcCat.trim().toUpperCase().replace(/\s+/g, "_");
    if (!v || serviceCats.includes(v)) { setNewSvcCat(""); return; }
    setServiceCats(c => [...c, v]);
    setNewSvcCat("");
  };
  const addProdCat = () => {
    const v = newProdCat.trim().toUpperCase().replace(/\s+/g, "_");
    if (!v || productCats.includes(v)) { setNewProdCat(""); return; }
    setProductCats(c => [...c, v]);
    setNewProdCat("");
  };

  return (
    <div className="px-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={cn("w-full text-left p-3 rounded-xl transition-all flex items-start gap-3",
                active === s.id ? "bg-primary-50 border border-primary-200" : "hover:bg-ivory-100 border border-transparent"
              )}>
              <s.icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", active===s.id?"text-primary-600":"text-muted-foreground")} />
              <div>
                <p className={cn("text-sm font-semibold", active===s.id?"text-primary-700":"text-foreground")}>{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-3">
          {active === "salon" && (
            <div className="card-luxury p-5 space-y-5">
              <div>
                <h3 className="text-base font-bold text-foreground">Salon Information</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This information appears on all invoices, receipts and customer communications.</p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                  <span className="text-sm animate-pulse">Loading salon settings…</span>
                </div>
              ) : (
                <>
                  {/* Logo Upload Section */}
                  <div className="p-4 rounded-2xl border border-ivory-300 bg-ivory-50 flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-ivory-300 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                      {form.logo ? (
                        <img src={form.logo} className="w-full h-full object-contain" alt="Salon Logo" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600">
                          L
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1">
                      <p className="text-sm font-semibold text-foreground">Brand Logo</p>
                      <p className="text-xs text-muted-foreground font-medium">Upload a square logo (recommended size: 120x120px, PNG or JPG under 800KB)</p>
                      <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                        <label className="btn-outline text-xs px-3 py-1.5 cursor-pointer inline-block rounded-xl border-primary-300 hover:bg-primary-50">
                          Upload Logo
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </label>
                        {form.logo && (
                          <button onClick={handleRemoveLogo} className="text-xs text-red-500 hover:underline px-2">Remove</button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">Salon Name</label>
                      <input className="input-luxury text-sm w-full" value={form.salonName} onChange={e => setForm(f => ({ ...f, salonName: e.target.value }))} />
                      <p className="text-[10px] text-muted-foreground mt-1">Displayed on all customer-facing documents</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">Tagline</label>
                      <input className="input-luxury text-sm w-full" value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} />
                      <p className="text-[10px] text-muted-foreground mt-1">Short brand descriptor (optional)</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">Phone Number</label>
                      <input className="input-luxury text-sm w-full" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                      <p className="text-[10px] text-muted-foreground mt-1">Primary contact for customers</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">Email Address</label>
                      <input className="input-luxury text-sm w-full" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                      <p className="text-[10px] text-muted-foreground mt-1">Booking confirmations sent from here</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-foreground mb-1 block">Registered Address</label>
                      <textarea className="input-luxury text-sm w-full h-20 resize-none" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                      <p className="text-[10px] text-muted-foreground mt-1">Full address as it should appear on GST invoices</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">GSTIN</label>
                      <input className="input-luxury text-sm w-full" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
                      <p className="text-[10px] text-muted-foreground mt-1">15-digit GST Identification Number</p>
                    </div>
                  </div>

                  <button onClick={saveSalonInfo} disabled={saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                    <Save className="w-4 h-4" /> {saving ? "Saving Changes..." : "Save Changes"}
                  </button>
                </>
              )}
            </div>
          )}

          {active === "hours" && (
            <div className="card-luxury p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Business Hours</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Set opening and closing time for each day. Toggle a day off to mark the salon as closed.</p>
              </div>
              <div className="space-y-3">
                {DAYS.map(day => {
                  const isClosed = day === "Sunday";
                  return (
                    <div key={day} className="flex items-center gap-4 p-3 rounded-xl border border-ivory-200 bg-ivory-50">
                      <div className="w-24">
                        <p className="text-sm font-semibold text-foreground">{day}</p>
                      </div>
                      {isClosed ? (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="badge text-[10px] bg-gray-100 text-gray-500 border border-gray-200">Closed</span>
                          <p className="text-xs text-muted-foreground">Salon is not open on Sundays</p>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-3">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Opens</label>
                            <input className="input-luxury text-xs py-1.5 w-28" value={form.openingTime} onChange={e => setForm(f => ({ ...f, openingTime: e.target.value }))} />
                          </div>
                          <span className="text-muted-foreground text-sm mt-4">–</span>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Closes</label>
                            <input className="input-luxury text-xs py-1.5 w-28" value={form.closingTime} onChange={e => setForm(f => ({ ...f, closingTime: e.target.value }))} />
                          </div>
                          <div className="mt-4">
                            <span className="badge text-[10px] bg-emerald-100 text-emerald-700">Open</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={saveBusinessHours} disabled={savingHours} className="btn-primary text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> {savingHours ? "Saving Hours..." : "Save Hours"}
              </button>
            </div>
          )}

          {active === "gst" && (
            <div className="card-luxury p-5 space-y-5">
              <div>
                <h3 className="text-base font-bold text-foreground">GST & Billing Settings</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure how GST is calculated and displayed on invoices. Indian salon services attract 18% GST split equally as CGST + SGST.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label:"Default GST Rate for Services", value:"18%", hint:"Standard rate for beauty and personal care services in India" },
                  { label:"Default GST Rate for Retail Products", value:"18%", hint:"Hair care, skin care and cosmetic products" },
                  { label:"CGST Component", value:"9%", hint:"Central GST — half of the total GST rate" },
                  { label:"SGST Component", value:"9%", hint:"State GST — half of the total GST rate (Maharashtra)" },
                  { label:"Invoice Prefix", value:"INV-2026-", hint:"Auto-incremented after this prefix" },
                  { label:"Invoice Starting Number", value:"0001", hint:"Next invoice will be INV-2026-0049" },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs font-semibold text-foreground mb-1 block">{f.label}</label>
                    <input className="input-luxury text-sm w-full" defaultValue={f.value} />
                    <p className="text-[10px] text-muted-foreground mt-1">{f.hint}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
                <strong>Note:</strong> Both CGST and SGST appear as separate line items on every invoice. The salon&apos;s GSTIN is auto-printed on all receipts. Input Tax Credit (ITC) on purchases is tracked separately in the Purchases module.
              </div>
              <button onClick={() => toast.success("GST & billing settings saved")} className="btn-primary text-sm flex items-center gap-2"><Save className="w-4 h-4" /> Save GST Settings</button>
            </div>
          )}

          {active === "notifications" && (
            <div className="card-luxury p-5 space-y-5">
              <div>
                <h3 className="text-base font-bold text-foreground">Notifications & Reminders</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure which automated messages are sent to customers via WhatsApp, SMS and email.</p>
              </div>
              <div className="space-y-3">
                {notifications.map(n => (
                  <div key={n.trigger} className="p-4 rounded-xl border border-ivory-200 bg-ivory-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground">{n.trigger}</p>
                          <span className="badge text-[9px] bg-blue-100 text-blue-600">{n.channel}</span>
                          <span className="badge text-[9px] bg-ivory-200 text-muted-foreground">{n.timing}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{n.desc}</p>
                      </div>
                      <button onClick={() => toggleNotif(n.trigger)}
                        className={cn("w-10 h-5 rounded-full flex-shrink-0 transition-colors", n.enabled?"bg-primary-500":"bg-gray-200")}>
                        <div className={cn("w-4 h-4 bg-white rounded-full shadow-sm mt-0.5 transition-transform", n.enabled?"translate-x-5":"translate-x-0.5")} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={saveNotifs} className="btn-primary text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> {notifSaved ? "Saved!" : "Save Notification Settings"}
              </button>
            </div>
          )}

          {active === "roles" && (
            <div className="card-luxury p-5 space-y-5">
              <div>
                <h3 className="text-base font-bold text-foreground">Roles & Access Control</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define which modules each role can access. Changes are saved locally and serve as your internal reference.</p>
              </div>

              {/* Role cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map(role => {
                  const perms = permissions[role.key] ?? [];
                  const groups = ALL_MODULES.reduce((acc, m) => {
                    if (perms.includes(m.id)) { acc[m.group] = (acc[m.group]||0)+1; }
                    return acc;
                  }, {} as Record<string,number>);
                  return (
                    <div key={role.key} className="p-4 rounded-xl border border-ivory-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", role.color)}>{role.label}</span>
                        <button onClick={() => openEditRole(role.key)}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors">
                          <Shield className="w-3 h-3" /> Edit Access
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(groups).map(([grp, cnt]) => (
                          <span key={grp} className="text-[10px] px-2 py-0.5 rounded-md bg-ivory-100 text-foreground border border-ivory-200 font-medium">
                            {grp} ({cnt})
                          </span>
                        ))}
                        {Object.keys(groups).length === 0 && (
                          <span className="text-[10px] text-muted-foreground italic">No access granted</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{perms.length} of {ALL_MODULES.length} modules enabled</p>
                    </div>
                  );
                })}
              </div>

              {/* Permission matrix table */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Full Permission Matrix</p>
                <div className="overflow-x-auto rounded-xl border border-ivory-200">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-ivory-50 border-b border-ivory-200">
                        <th className="p-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide w-48">Module</th>
                        {ROLES.map(r => (
                          <th key={r.key} className="p-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            <span className={cn("px-1.5 py-0.5 rounded-md border text-[9px]", r.color)}>{r.label.split(" ")[0]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {["Core","Finance","Catalogue","People","Growth","Admin"].map(group => (
                        <>
                          <tr key={`g-${group}`} className="bg-ivory-100/70 border-b border-ivory-200">
                            <td colSpan={5} className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{group}</td>
                          </tr>
                          {ALL_MODULES.filter(m => m.group === group).map(mod => (
                            <tr key={mod.id} className="border-b border-ivory-100 hover:bg-ivory-50/50 transition-colors">
                              <td className="p-3 text-foreground font-medium text-[11px]">{mod.label}</td>
                              {ROLES.map(r => {
                                const has = (permissions[r.key] ?? []).includes(mod.id);
                                return (
                                  <td key={r.key} className="p-3 text-center">
                                    <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                                      has ? "bg-emerald-100 text-emerald-600" : "bg-red-50 text-red-300")}>
                                      {has ? "✓" : "✗"}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {active === "users" && (
            <div className="card-luxury p-5 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">User Login Profiles</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">Add, block, or delete login accounts for your receptionists, managers, and stylists.</p>
                </div>
                <button onClick={() => setShowAddUserModal(true)} className="btn-primary text-xs flex items-center gap-2 py-2 px-3 rounded-xl font-bold">
                  <UserPlus className="w-3.5 h-3.5" /> Add User Account
                </button>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto border border-ivory-200 rounded-2xl bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-ivory-200 bg-ivory-50 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-3">User Details</th>
                      <th className="p-3">Designation Role</th>
                      <th className="p-3">Last Access Log</th>
                      <th className="p-3">Login Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground font-medium">
                          No staff users found. Create one above.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((u) => (
                        <tr key={u.id} className="border-b border-ivory-100 hover:bg-ivory-50/50 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm">{u.name}</p>
                                <p className="text-muted-foreground font-medium text-[11px] mt-0.5">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={cn("badge text-[10px] border px-2 py-0.5 rounded-full font-bold", ROLE_COLORS[DB_ROLE_LABELS[u.role]] || "bg-gray-100 text-gray-700")}>
                              {DB_ROLE_LABELS[u.role] || u.role}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground font-medium">
                            {u.lastLogin ? new Date(u.lastLogin).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            }) : "Never logged in"}
                          </td>
                          <td className="p-3">
                            <button onClick={() => toggleUserActive(u.id, u.isActive)} className="flex items-center gap-1.5 focus:outline-none">
                              <span className={cn("w-2 h-2 rounded-full", u.isActive ? "bg-emerald-500 animate-pulse" : "bg-red-400")} />
                              <span className={cn("font-bold text-[10px] uppercase tracking-wide", u.isActive ? "text-emerald-700" : "text-red-500")}>
                                {u.isActive ? "Active" : "Suspended"}
                              </span>
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => toggleUserActive(u.id, u.isActive)}
                                className={cn("p-1.5 rounded-lg border transition-all",
                                  u.isActive ? "border-amber-200 text-amber-600 hover:bg-amber-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                )}
                                title={u.isActive ? "Suspend Access" : "Grant Access"}>
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteUser(u.id)} className="p-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete Profile">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add User Modal */}
              {showAddUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: "rgba(20,12,14,0.82)", backdropFilter: "blur(4px)" }}>
                  <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
                      <h3 className="text-sm font-bold text-foreground">Add New User Profile</h3>
                      <button onClick={() => setShowAddUserModal(false)} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200 text-muted-foreground transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateUser}>
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider block mb-1">Full Name</label>
                          <input type="text" className="input-luxury text-sm w-full" placeholder="e.g. Maya Roy" required
                            value={newUserForm.name} onChange={e => setNewUserForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider block mb-1">Email Address</label>
                          <input type="email" className="input-luxury text-sm w-full" placeholder="maya@lumisalon.in" required
                            value={newUserForm.email} onChange={e => setNewUserForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider block mb-1">Password</label>
                          <input type="password" className="input-luxury text-sm w-full" placeholder="••••••••" required minLength={6}
                            value={newUserForm.password} onChange={e => setNewUserForm(f => ({ ...f, password: e.target.value }))} />
                          <p className="text-[9px] text-muted-foreground mt-0.5">Must be at least 6 characters long</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider block mb-1">Designation & Role</label>
                          <select className="input-luxury text-sm w-full py-2 bg-white"
                            value={newUserForm.role} onChange={e => setNewUserForm(f => ({ ...f, role: e.target.value as any }))}>
                            <option value="ADMIN">Admin (Owner)</option>
                            <option value="MANAGER">Manager</option>
                            <option value="RECEPTIONIST">Receptionist</option>
                            <option value="STYLIST">Stylist</option>
                          </select>
                        </div>
                      </div>
                      <div className="px-5 py-4 border-t border-ivory-200 bg-ivory-50 flex gap-2">
                        <button type="button" onClick={() => setShowAddUserModal(false)} className="flex-1 btn-outline text-xs py-2.5 rounded-xl font-bold">Cancel</button>
                        <button type="submit" className="flex-1 btn-primary text-xs py-2.5 rounded-xl font-bold">Create Profile</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {editRole && (() => {
            const roleInfo = ROLES.find(r => r.key === editRole)!;
            const groups = [...new Set(ALL_MODULES.map(m => m.group))];
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background:"rgba(20,12,14,0.82)", backdropFilter:"blur(4px)" }}
                onClick={e => { if(e.target===e.currentTarget) setEditRole(null); }}>
                <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" style={{ color:"#111111" }} />
                      <h3 className="text-sm font-bold text-foreground">Edit Access — {roleInfo.label}</h3>
                    </div>
                    <button onClick={() => setEditRole(null)} className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    <div className="px-5 py-3 border-b border-ivory-100 flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">{permDraft.length} of {ALL_MODULES.length} modules enabled</p>
                      <div className="flex gap-2">
                        <button onClick={() => setPermDraft(ALL_MODULES.map(m => m.id))} className="text-[10px] text-primary-600 font-semibold hover:underline">All</button>
                        <button onClick={() => setPermDraft([])} className="text-[10px] text-red-500 font-semibold hover:underline">None</button>
                      </div>
                    </div>
                    {groups.map(group => (
                      <div key={group}>
                        <p className="px-5 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-ivory-50 border-b border-ivory-100">{group}</p>
                        {ALL_MODULES.filter(m => m.group === group).map(mod => {
                          const checked = permDraft.includes(mod.id);
                          return (
                            <label key={mod.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-ivory-50 hover:bg-ivory-50 cursor-pointer transition-colors">
                              <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                checked ? "bg-primary-500 border-primary-500" : "border-ivory-300 bg-white")}
                                onClick={() => setPermDraft(p => checked ? p.filter(x => x !== mod.id) : [...p, mod.id])}>
                                {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                              </div>
                              <span className="text-xs text-foreground">{mod.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-4 border-t border-ivory-200 bg-ivory-50 flex gap-2 flex-shrink-0">
                    <button onClick={() => setEditRole(null)} className="flex-1 btn-outline text-xs py-2.5 rounded-xl font-bold">Cancel</button>
                    <button onClick={savePermissions} className="flex-1 btn-primary text-xs py-2.5 rounded-xl font-bold">Save Changes</button>
                  </div>
                </div>
              </div>
            );
          })()}
          {active === "categories" && (
            <div className="card-luxury p-5 space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Categories</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define the categories available when adding services and products. These appear in the dropdown menus across the app.</p>
              </div>

              {/* Service Categories */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                  <h4 className="text-sm font-bold text-foreground">Service Categories</h4>
                  <span className="text-[10px] text-muted-foreground">({serviceCats.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {serviceCats.map(cat => (
                    <div key={cat} className="flex items-center gap-1 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-medium px-2.5 py-1.5 rounded-xl">
                      <span>{cat}</span>
                      <button onClick={() => setServiceCats(c => c.filter(x => x !== cat))} className="ml-1 text-violet-400 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSvcCat}
                    onChange={e => setNewSvcCat(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addSvcCat()}
                    placeholder="e.g. HAIR or WELLNESS"
                    className="input-luxury text-sm flex-1"
                  />
                  <button onClick={addSvcCat} className="btn-outline text-sm px-4 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">Category names are stored in uppercase with underscores (e.g. &quot;Hair Care&quot; → HAIR_CARE). Press Enter or click Add.</p>
              </div>

              <div className="border-t border-ivory-200" />

              {/* Product Categories */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                  <h4 className="text-sm font-bold text-foreground">Product Categories</h4>
                  <span className="text-[10px] text-muted-foreground">({productCats.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {productCats.map(cat => (
                    <div key={cat} className="flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-2.5 py-1.5 rounded-xl">
                      <span>{cat}</span>
                      <button onClick={() => setProductCats(c => c.filter(x => x !== cat))} className="ml-1 text-rose-300 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newProdCat}
                    onChange={e => setNewProdCat(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addProdCat()}
                    placeholder="e.g. SKIN_CARE or TOOLS"
                    className="input-luxury text-sm flex-1"
                  />
                  <button onClick={addProdCat} className="btn-outline text-sm px-4 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">Spaces are automatically converted to underscores. Press Enter or click Add.</p>
              </div>

              <button onClick={saveCategories} disabled={savingCats} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                <Save className="w-4 h-4" /> {savingCats ? "Saving..." : "Save Categories"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
