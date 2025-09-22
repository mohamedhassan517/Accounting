import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import UserManagement from "@/components/users/UserManagement";
import { toast } from "sonner";
import { load, save } from "@/lib/storage";

type TransType = "revenue" | "expense";
interface Transaction { id: string; date: string; type: TransType; description: string; amount: number; approved: boolean; createdBy?: "manager"|"accountant"|"employee"; }
interface InventoryItem { id: string; name: string; updatedAt: string; quantity: number; unit: string; min: number; }
interface Movement { id: string; itemId: string; kind: "in"|"out"; qty: number; unitPrice: number; total: number; party: string; date: string; }
interface Project { id: string; name: string; location: string; floors: number; units: number; createdAt: string; }
interface ProjectCost { id: string; projectId: string; type: "construction"|"operation"|"expense"; amount: number; date: string; note: string; }
interface ProjectSale { id: string; projectId: string; unitNo: string; buyer: string; price: number; date: string; terms?: string; }
interface Project { id: string; name: string; location: string; floors: number; units: number; createdAt: string; }
interface ProjectCost { id: string; projectId: string; type: "construction"|"operation"|"expense"; amount: number; date: string; note: string; }
interface ProjectSale { id: string; projectId: string; unitNo: string; buyer: string; price: number; date: string; terms?: string; }

function uid() { return Math.random().toString(36).slice(2); }

export default function AccountingSystem() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const isAccountant = user?.role === "accountant";
  const isEmployee = user?.role === "employee";
  const [active, setActive] = useState<"dashboard"|"transactions"|"inventory"|"projects"|"reports"|"users">("dashboard");

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: uid(), date: "2024-12-01", type: "revenue", description: "بيع شقة - المشروع الأول", amount: 150000, approved: true, createdBy: "manager" },
    { id: uid(), date: "2024-11-28", type: "expense", description: "شراء مواد بناء - أسمنت", amount: 25000, approved: true, createdBy: "manager" },
  ]);
  const [quick, setQuick] = useState<{ type: TransType; amount: string; description: string; date: string }>(() => ({ type: "revenue", amount: "", description: "", date: new Date().toLocaleDateString("en-CA") }));

  const totals = useMemo(() => {
    const rev = transactions.filter(t=>t.type==="revenue").reduce((a,b)=>a+b.amount,0);
    const exp = transactions.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
    return { revenue: rev, expenses: exp, profit: rev-exp };
  }, [transactions]);

  const addQuick = () => {
    if (!quick.amount || !quick.description || !quick.date) return;
    const approved = isManager || isAccountant;
    setTransactions(prev => [{ id: uid(), date: quick.date, type: quick.type, description: quick.description, amount: Number(quick.amount), approved, createdBy: user?.role as any }, ...prev]);
    setQuick({ type: "revenue", amount: "", description: "", date: new Date().toLocaleDateString("en-CA") });
  };

  const deleteTrans = (id: string) => setTransactions(prev => prev.filter(t=>t.id!==id));

  // Inventory state
  const [items, setItems] = useState<InventoryItem[]>([
    { id: uid(), name: "أسمنت مقاوم", updatedAt: "2024-12-01", quantity: 450, unit: "طن", min: 100 },
    { id: uid(), name: "حديد تسليح", updatedAt: "2024-11-30", quantity: 50, unit: "طن", min: 80 },
    { id: uid(), name: "طوب أحمر", updatedAt: "2024-12-01", quantity: 15000, unit: "قطعة", min: 5000 },
  ]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [sales, setSales] = useState<ProjectSale[]>([]);
  const [newProject, setNewProject] = useState({ name: "", location: "", floors: "", units: "" });
  const [newCost, setNewCost] = useState({ projectId: "", type: "construction" as ProjectCost["type"], amount: "", date: new Date().toLocaleDateString("en-CA"), note: "" });
  const [newSale, setNewSale] = useState({ projectId: "", unitNo: "", buyer: "", price: "", date: new Date().toLocaleDateString("en-CA"), terms: "" });
  const [newItem, setNewItem] = useState({ name: "", quantity: "", unit: "طن", min: "" });
  const addItem = () => {
    if (!newItem.name || !newItem.quantity || !newItem.min) return;
    setItems(prev => [...prev, { id: uid(), name: newItem.name, updatedAt: new Date().toLocaleDateString("en-CA"), quantity: Number(newItem.quantity), unit: newItem.unit, min: Number(newItem.min) }]);
    setNewItem({ name: "", quantity: "", unit: "طن", min: "" });
  };
  const deleteItem = (id: string) => setItems(prev => prev.filter(i=>i.id!==id));

  // Receive/Issue forms
  const today = () => new Date().toLocaleDateString("en-CA");
  const [receive, setReceive] = useState({ itemId: "", qty: "", unitPrice: "", supplier: "", date: today() });
  const [issue, setIssue] = useState({ itemId: "", qty: "", unitPrice: "", project: "", date: today() });

  const receiveSubmit = () => {
    if (!receive.itemId || !receive.qty || !receive.unitPrice || !receive.supplier) return;
    const qty = Number(receive.qty); const price = Number(receive.unitPrice); const total = qty * price;
    setItems(prev => prev.map(i => i.id===receive.itemId ? { ...i, quantity: i.quantity + qty, updatedAt: receive.date } : i));
    setMovements(prev => [{ id: uid(), itemId: receive.itemId, kind: "in", qty, unitPrice: price, total, party: receive.supplier, date: receive.date }, ...prev]);
    setTransactions(prev => [{ id: uid(), date: receive.date, type: "expense", description: `شراء ${getItemName(receive.itemId)} من ${receive.supplier} (${qty} ${getItemUnit(receive.itemId)} × ${price.toLocaleString()})`, amount: total, approved: isManager || isAccountant, createdBy: user?.role as any }, ...prev]);
    const it = items.find(i=>i.id===receive.itemId);
    if (it && it.quantity + qty < it.min) toast.warning(`تنبيه: مخزون ${it.name} منخفض`);
    toast.success("تم تسجيل الوارد وتحديث المصروفات");
    setReceive({ itemId: "", qty: "", unitPrice: "", supplier: "", date: today() });
  };

  const issueSubmit = () => {
    if (!issue.itemId || !issue.qty || !issue.unitPrice || !issue.project) return;
    const qty = Number(issue.qty); const price = Number(issue.unitPrice); const total = qty * price;
    setItems(prev => prev.map(i => i.id===issue.itemId ? { ...i, quantity: Math.max(0, i.quantity - qty), updatedAt: issue.date } : i));
    setMovements(prev => [{ id: uid(), itemId: issue.itemId, kind: "out", qty, unitPrice: price, total, party: issue.project, date: issue.date }, ...prev]);
    setTransactions(prev => [{ id: uid(), date: issue.date, type: "expense", description: `صرف ${getItemName(issue.itemId)} لمشروع ${issue.project} (${qty} ${getItemUnit(issue.itemId)} × ${price.toLocaleString()})`, amount: total, approved: isManager || isAccountant, createdBy: user?.role as any }, ...prev]);
    const it = items.find(i=>i.id===issue.itemId);
    if (it && it.quantity - qty < it.min) toast.warning(`تنبيه: مخزون ${it.name} منخفض`);
    toast.success("تم تسجيل الصرف وتحديث المصروفات");
    setIssue({ itemId: "", qty: "", unitPrice: "", project: "", date: today() });
  };

  function getItemName(id: string){ return items.find(i=>i.id===id)?.name ?? ""; }
  function getItemUnit(id: string){ return items.find(i=>i.id===id)?.unit ?? ""; }

  // Project helpers
  function projectTotals(id: string){
    const c = costs.filter(x=>x.projectId===id).reduce((a,b)=>a+b.amount,0);
    const s = sales.filter(x=>x.projectId===id).reduce((a,b)=>a+b.price,0);
    return { costs: c, sales: s, profit: s - c, sold: sales.filter(x=>x.projectId===id).length };
  }

  function addProject(){
    if (!newProject.name || !newProject.location || !newProject.floors || !newProject.units) return;
    setProjects(prev => [...prev, { id: uid(), name: newProject.name, location: newProject.location, floors: Number(newProject.floors), units: Number(newProject.units), createdAt: new Date().toLocaleDateString("en-CA") }]);
    setNewProject({ name: "", location: "", floors: "", units: "" });
    toast.success("تمت إضافة المشروع العقاري");
  }

  function addProjectCost(){
    if (!newCost.projectId || !newCost.amount) return;
    const amount = Number(newCost.amount);
    const c: ProjectCost = { id: uid(), projectId: newCost.projectId, type: newCost.type, amount, date: newCost.date, note: newCost.note };
    setCosts(prev => [c, ...prev]);
    const p = projects.find(p=>p.id===newCost.projectId);
    setTransactions(prev => [{ id: uid(), date: newCost.date, type: "expense", description: `تكلفة ${newCost.type === "construction"?"إنشاء":newCost.type === "operation"?"تشغيل":"مصروفات"} لمشروع ${p?.name || ""}`, amount }, ...prev]);
    toast.success("تم تسجيل تكلفة المشروع وتحديث المصروفات");
    setNewCost({ projectId: "", type: "construction", amount: "", date: new Date().toLocaleDateString("en-CA"), note: "" });
  }

  function addProjectSale(){
    if (!newSale.projectId || !newSale.price || !newSale.unitNo || !newSale.buyer) return;
    const price = Number(newSale.price);
    const s: ProjectSale = { id: uid(), projectId: newSale.projectId, unitNo: newSale.unitNo, buyer: newSale.buyer, price, date: newSale.date, terms: newSale.terms };
    setSales(prev => [s, ...prev]);
    const p = projects.find(p=>p.id===newSale.projectId);
    setTransactions(prev => [{ id: uid(), date: newSale.date, type: "revenue", description: `بيع وحدة ${newSale.unitNo} من مشروع ${p?.name || ""} إلى ${newSale.buyer}`, amount: price }, ...prev]);
    toast.success("تم تسجيل البيع وتحديث الإيرادات");
    printInvoice(s.id);
    setNewSale({ projectId: "", unitNo: "", buyer: "", price: "", date: new Date().toLocaleDateString("en-CA"), terms: "" });
  }

  function printInvoice(id: string){
    const s = sales.find(x=>x.id===id);
    if (!s) return;
    const p = projects.find(x=>x.id===s.projectId);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>فاتورة بيع</title>
      <style>body{font-family:Arial,system-ui;padding:24px;background:#f6f7fb;color:#111} .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;max-width:720px;margin:0 auto} .h{font-weight:800;font-size:20px;margin-bottom:8px} .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px} .row{display:flex;justify-content:space-between;margin:6px 0} .total{font-weight:800;font-size:18px} .mt{margin-top:16px} .btn{display:inline-block;margin-top:16px;padding:10px 16px;background:#111;color:#fff;border-radius:8px;text-decoration:none}</style>
    </head><body>
      <div class="card">
        <div class="h">فاتورة بيع وحدة عقارية</div>
        <div class="grid">
          <div class="row"><div>المشروع:</div><div>${p?.name ?? ""}</div></div>
          <div class="row"><div>الموقع:</div><div>${p?.location ?? ""}</div></div>
          <div class="row"><div>رقم الوحدة:</div><div>${s.unitNo}</div></div>
          <div class="row"><div>المشتري:</div><div>${s.buyer}</div></div>
          <div class="row"><div>التاريخ:</div><div>${s.date}</div></div>
        </div>
        <div class="mt row total"><div>السعر الإجمالي:</div><div>${s.price.toLocaleString()} ج.م</div></div>
        ${s.terms?`<div class="mt">الشروط: ${s.terms}</div>`:""}
        <a href="#" class="btn" onclick="window.print();return false;">طباعة</a>
      </div>
    </body></html>`);
    win.document.close();
  }

// Reports
  const [reportType, setReportType] = useState("profit-loss");
  const [selectedProject, setSelectedProject] = useState("");
  const [dateFrom, setDateFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString("en-CA"));
  const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString("en-CA"));

  const filtered = useMemo(() => transactions.filter(t => t.date >= dateFrom && t.date <= dateTo), [transactions, dateFrom, dateTo]);

  function buildReport() {
    if (reportType === "profit-loss") {
      const rev = filtered.filter(t=>t.type==="revenue").reduce((a,b)=>a+b.amount,0);
      const exp = filtered.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
      return { title: "تقرير الأرباح والخسائر", headers: ["البند","القيمة"], rows: [
        ["إجمالي الإيرادات", rev.toLocaleString()+" ج.م"],
        ["إجمالي المصروفات", exp.toLocaleString()+" ج.م"],
        ["صافي الربح", (rev-exp).toLocaleString()+" ج.م"],
      ] };
    }
    if (reportType === "revenue") {
      return { title: "تقرير الإيرادات", headers: ["التاريخ","الوصف","المبلغ"], rows: filtered.filter(t=>t.type==="revenue").map(t=>[t.date,t.description, t.amount.toLocaleString()+" ج.م"]) };
    }
    if (reportType === "expense") {
      return { title: "تقرير المصروفات", headers: ["التاريخ","الوصف","المبلغ"], rows: filtered.filter(t=>t.type==="expense").map(t=>[t.date,t.description, t.amount.toLocaleString()+" ج.م"]) };
    }
    if (reportType === "salary") {
      const sal = filtered.filter(t=>t.type==="expense" && /(راتب|salary|مرتبات|موظف)/i.test(t.description));
      return { title: "تقرير المرتبات", headers: ["التاريخ","الوصف","المبلغ"], rows: sal.map(t=>[t.date,t.description, t.amount.toLocaleString()+" ج.م"]) };
    }
    if (reportType === "inventory") {
      const rows = items.map(i=>[i.name, i.quantity.toLocaleString()+" "+i.unit, i.min.toLocaleString(), i.quantity < i.min ? "منخفض" : "جيد"]);
      return { title: "تقرير المخزون", headers: ["المادة","الكمية","الحد الأدنى","الحالة"], rows };
    }
    if (reportType === "project") {
      const p = projects.find(p=>p.id===selectedProject);
      const c = costs.filter(x=>x.projectId===selectedProject && x.date >= dateFrom && x.date <= dateTo);
      const s = sales.filter(x=>x.projectId===selectedProject && x.date >= dateFrom && x.date <= dateTo);
      const totalC = c.reduce((a,b)=>a+b.amount,0), totalS = s.reduce((a,b)=>a+b.price,0);
      const rows: string[][] = [
        ["المشروع", p?.name || "-"],
        ["الموقع", p?.location || "-"],
        ["عدد الأدوار", String(p?.floors ?? "-")],
        ["عدد الوحدات", String(p?.units ?? "-")],
        ["إجمالي التكاليف", totalC.toLocaleString()+" ج.م"],
        ["إجمالي المبيعات", totalS.toLocaleString()+" ج.م"],
        ["الربح/الخسارة", (totalS-totalC).toLocaleString()+" ج.م"],
      ];
      return { title: "تقرير مشروع عقاري", headers: ["البند","القيمة"], rows };
    }
    return { title: "تقرير", headers: [], rows: [] };
  }

  const exportCsv = () => {
    const rep = buildReport();
    const rows = [rep.headers, ...rep.rows];
    const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${rep.title}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const rep = buildReport();
    const table = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body><table border="1">${["<tr>"+rep.headers.map(h=>`<th>${h}</th>`).join("")+"</tr>", ...rep.rows.map(r=>"<tr>"+r.map(c=>`<td>${c}</td>`).join("")+"</tr>")].join("")}</table></body></html>`;
    const blob = new Blob([table], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${rep.title}.xls`; a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const rep = buildReport();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${rep.title}</title>
      <style>body{font-family:Arial,system-ui;padding:24px} h1{font-size:20px;margin-bottom:12px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px} th{background:#f1f5f9}</style>
    </head><body>
      <h1>${rep.title}</h1>
      <div>الفترة: ${dateFrom} - ${dateTo}</div>
      <table><thead><tr>${rep.headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>
        ${rep.rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}
      </tbody></table>
      <script>window.print()</script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">لوحة التحكم</h1>
          <p className="text-slate-500 text-sm">نظام محاسبة عقاري سهل الاستخدام</p>
        </div>
        <div className="flex gap-2">
          {(() => {
            const tabs: (typeof active)[] = ["dashboard", "inventory", "projects"]; // للجميع
            if (isManager || isAccountant) tabs.splice(1, 0, "transactions");
            if (isManager || isAccountant) tabs.push("reports");
            if (isManager) tabs.push("users");
            return tabs.map(tab => (
              <button key={tab} onClick={()=>setActive(tab)} className={`px-3 py-2 rounded-full border ${active===tab?"bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent":"border-indigo-300 text-indigo-700"}`}>
                {tab==="dashboard"?"لوحة التحكم":tab==="transactions"?"المعاملات":tab==="inventory"?"المخزون":tab==="projects"?"العقارات":tab==="reports"?"التقارير":"المستخدمون"}
              </button>
            ));
          })()}
        </div>
      </div>

      {active==="dashboard" && (
        <section className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow">
              <div className="text-sm opacity-90">الحساب</div>
              <div className="mt-2 text-2xl font-extrabold">{user?.name}</div>
              <div className="text-xs mt-1">الدور: {user?.role === "manager" ? "مدير" : user?.role === "accountant" ? "محاسب" : "موظف"}</div>
            </div>
            <div className="rounded-xl p-4 bg-white border border-slate-200 shadow">
              <div className="text-sm text-slate-600">الوضع</div>
              <div className="mt-2 text-2xl font-bold">{isManager ? "صلاحيات مدير" : "مستخدم عادي"}</div>
            </div>
            <div className="rounded-xl p-4 bg-white border border-slate-200 shadow">
              <div className="text-sm text-slate-600">الوصول</div>
              <div className="mt-2 text-2xl font-bold">{isManager ? "إدارة المستخدمين مسموحة" : "غير متاحة"}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Stat value={totals.revenue} label="إجمالي الإيرادات" color="text-emerald-600" />
            <Stat value={totals.expenses} label="إجمالي المصروفات" color="text-rose-600" />
            <Stat value={totals.profit} label="صافي الربح (ج.م)" color="text-indigo-700" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
            <h3 className="font-semibold mb-3">إضافة معاملة سريعة</h3>
            <div className="grid md:grid-cols-5 gap-3">
              <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={quick.type} onChange={(e)=>setQuick({ ...quick, type: e.target.value as TransType })}>
                <option value="revenue">إيراد</option>
                <option value="expense">مصروف</option>
              </select>
              <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="المبلغ" value={quick.amount} onChange={(e)=>setQuick({ ...quick, amount: e.target.value })} />
              <input type="date" className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={quick.date} onChange={(e)=>setQuick({ ...quick, date: e.target.value })} />
              <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2 md:col-span-2" placeholder="الوصف" value={quick.description} onChange={(e)=>setQuick({ ...quick, description: e.target.value })} />
            </div>
            <button onClick={addQuick} className="mt-3 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2">إضافة معاملة</button>
          </div>
        </section>
      )}

      {active==="transactions" && (
        <section className="bg-white border border-slate-200 rounded-xl p-4 shadow">
          <h3 className="font-semibold mb-3">المعاملات المالية</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left bg-slate-50">
                  <th className="px-3 py-2">التاريخ</th>
                  <th className="px-3 py-2">النوع</th>
                  <th className="px-3 py-2">الوصف</th>
                  <th className="px-3 py-2">المبلغ</th>
                  <th className="px-3 py-2">الحالة</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2">{t.date}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-1 rounded-full text-xs ${t.type==="revenue"?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-700"}`}>{t.type==="revenue"?"إيراد":"مصروف"}</span></td>
                    <td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2">{t.amount.toLocaleString()} ج.م</td>
                    <td className="px-3 py-2">{(t as any).approved ? <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700">معتمد</span> : <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-700">بانتظار الاعتماد</span>}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      {isManager && !(t as any).approved && (
                        <button className="rounded-md bg-indigo-600 text-white px-3 py-1" onClick={()=>setTransactions(prev=>prev.map(x=>x.id===t.id?{...(x as any), approved:true}:x))}>اعتماد</button>
                      )}
                      <button className="rounded-md bg-red-600 text-white px-3 py-1" onClick={()=>deleteTrans(t.id)}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {active==="inventory" && (
        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
            <h3 className="font-semibold mb-3">إضافة مادة جديدة</h3>
            <div className="grid md:grid-cols-4 gap-3">
              <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="اسم المادة" value={newItem.name} onChange={(e)=>setNewItem({ ...newItem, name: e.target.value })} />
              <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="الكمية" value={newItem.quantity} onChange={(e)=>setNewItem({ ...newItem, quantity: e.target.value })} />
              <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={newItem.unit} onChange={(e)=>setNewItem({ ...newItem, unit: e.target.value })}>
                <option value="طن">طن</option>
                <option value="قطعة">قطعة</option>
                <option value="متر">متر</option>
                <option value="لتر">لتر</option>
              </select>
              <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="الحد الأدنى" value={newItem.min} onChange={(e)=>setNewItem({ ...newItem, min: e.target.value })} />
            </div>
            <button onClick={addItem} className="mt-3 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2">حفظ المادة</button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
              <h3 className="font-semibold mb-3">تسجيل وارد من مورد</h3>
              <div className="grid md:grid-cols-5 gap-3">
                <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={receive.itemId} onChange={(e)=>setReceive({ ...receive, itemId: e.target.value })}>
                  <option value="">اختر المادة</option>
                  {items.map(i=> <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="الكم��ة" value={receive.qty} onChange={(e)=>setReceive({ ...receive, qty: e.target.value })} />
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="سعر الوحدة" value={receive.unitPrice} onChange={(e)=>setReceive({ ...receive, unitPrice: e.target.value })} />
                <input type="date" className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={receive.date} onChange={(e)=>setReceive({ ...receive, date: e.target.value })} />
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="اسم المورد" value={receive.supplier} onChange={(e)=>setReceive({ ...receive, supplier: e.target.value })} />
              </div>
              <button onClick={receiveSubmit} className="mt-3 rounded-md bg-slate-900 text-white px-4 py-2">تسجيل الوارد</button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
              <h3 className="font-semibold mb-3">تسجيل صرف لمشروع</h3>
              <div className="grid md:grid-cols-5 gap-3">
                <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={issue.itemId} onChange={(e)=>setIssue({ ...issue, itemId: e.target.value })}>
                  <option value="">اختر المادة</option>
                  {items.map(i=> <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="الكمية" value={issue.qty} onChange={(e)=>setIssue({ ...issue, qty: e.target.value })} />
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="سعر الوحدة" value={issue.unitPrice} onChange={(e)=>setIssue({ ...issue, unitPrice: e.target.value })} />
                <input type="date" className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={issue.date} onChange={(e)=>setIssue({ ...issue, date: e.target.value })} />
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="اسم المشروع" value={issue.project} onChange={(e)=>setIssue({ ...issue, project: e.target.value })} />
              </div>
              <button onClick={issueSubmit} className="mt-3 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2">تسجيل الصرف</button>
            </div>
          </div>

          <div className="space-y-2">
            {items.map(i => (
              <div key={i.id} className={`flex items-center justify-between bg-white border rounded-lg p-3 ${i.quantity < i.min ? "border-rose-300" : "border-slate-200"}`}>
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-slate-500">آخر تحديث: {i.updatedAt}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${i.quantity < i.min ? "text-rose-600" : ""}`}>{i.quantity.toLocaleString()} {i.unit}</div>
                  <div className={`text-xs ${i.quantity < i.min ? "text-rose-600" : "text-emerald-600"}`}>{i.quantity < i.min ? "مخزون منخفض" : "متوفر"}</div>
                </div>
                <button className="rounded-md bg-red-600 text-white px-3 py-1" onClick={()=>deleteItem(i.id)}>حذف</button>
              </div>
            ))}
          </div>

          {movements.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
              <h3 className="font-semibold mb-3">حركة المخزون</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-slate-50">
                      <th className="px-3 py-2">التاريخ</th>
                      <th className="px-3 py-2">المادة</th>
                      <th className="px-3 py-2">نوع الحركة</th>
                      <th className="px-3 py-2">الكمية</th>
                      <th className="px-3 py-2">سعر الوحدة</th>
                      <th className="px-3 py-2">الإجمالي</th>
                      <th className="px-3 py-2">الجهة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.id} className="border-t">
                        <td className="px-3 py-2">{m.date}</td>
                        <td className="px-3 py-2">{getItemName(m.itemId)}</td>
                        <td className="px-3 py-2">{m.kind === "in" ? "وارد" : "صرف"}</td>
                        <td className="px-3 py-2">{m.qty} {getItemUnit(m.itemId)}</td>
                        <td className="px-3 py-2">{m.unitPrice.toLocaleString()}</td>
                        <td className="px-3 py-2">{m.total.toLocaleString()}</td>
                        <td className="px-3 py-2">{m.party}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {active==="projects" && (
        <section className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
              <h3 className="font-semibold mb-3">إضافة مشروع عقاري</h3>
              <div className="grid gap-3">
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="اسم المشروع" value={newProject.name} onChange={e=>setNewProject({...newProject, name:e.target.value})} />
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="الموقع" value={newProject.location} onChange={e=>setNewProject({...newProject, location:e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="عدد الأدوار" value={newProject.floors} onChange={e=>setNewProject({...newProject, floors:e.target.value})} />
                  <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="عدد الوحدات" value={newProject.units} onChange={e=>setNewProject({...newProject, units:e.target.value})} />
                </div>
                <button onClick={addProject} className="rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2">حفظ المشروع</button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
              <h3 className="font-semibold mb-3">تسجيل تكلفة للمشروع</h3>
              <div className="grid gap-3">
                <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={newCost.projectId} onChange={e=>setNewCost({...newCost, projectId:e.target.value})}>
                  <option value="">اختر المشروع</option>
                  {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={newCost.type} onChange={e=>setNewCost({...newCost, type:e.target.value as any})}>
                    <option value="construction">إنشاء</option>
                    <option value="operation">تشغيل</option>
                    <option value="expense">مصروفات</option>
                  </select>
                  <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="المبلغ" value={newCost.amount} onChange={e=>setNewCost({...newCost, amount:e.target.value})} />
                </div>
                <input type="date" className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={newCost.date} onChange={e=>setNewCost({...newCost, date:e.target.value})} />
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="ملاحظة" value={newCost.note} onChange={e=>setNewCost({...newCost, note:e.target.value})} />
                <button onClick={addProjectCost} className="rounded-md bg-slate-900 text-white px-4 py-2">تسجيل التكلفة</button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
              <h3 className="font-semibold mb-3">تسجيل بيع وحدة وإصدار فاتورة</h3>
              <div className="grid gap-3">
                <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={newSale.projectId} onChange={e=>setNewSale({...newSale, projectId:e.target.value})}>
                  <option value="">اختر المشروع</option>
                  {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="رقم الوحدة" value={newSale.unitNo} onChange={e=>setNewSale({...newSale, unitNo:e.target.value})} />
                  <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="السعر" value={newSale.price} onChange={e=>setNewSale({...newSale, price:e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="اسم المشتري" value={newSale.buyer} onChange={e=>setNewSale({...newSale, buyer:e.target.value})} />
                  <input type="date" className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={newSale.date} onChange={e=>setNewSale({...newSale, date:e.target.value})} />
                </div>
                <input className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" placeholder="شروط التعاقد (اختياري)" value={newSale.terms} onChange={e=>setNewSale({...newSale, terms:e.target.value})} />
                <button onClick={addProjectSale} className="rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2">تسجيل البيع + فاتورة</button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
            <h3 className="font-semibold mb-3">المشروعات</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left bg-slate-50">
                    <th className="px-3 py-2">المشروع</th>
                    <th className="px-3 py-2">الموقع</th>
                    <th className="px-3 py-2">الأدوار</th>
                    <th className="px-3 py-2">الوحدات</th>
                    <th className="px-3 py-2">مباعة/متاحة</th>
                    <th className="px-3 py-2">التكاليف</th>
                    <th className="px-3 py-2">المبيعات</th>
                    <th className="px-3 py-2">الربح</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => { const t = projectTotals(p.id); return (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2">{p.location}</td>
                      <td className="px-3 py-2">{p.floors}</td>
                      <td className="px-3 py-2">{p.units}</td>
                      <td className="px-3 py-2">{t.sold} / {Math.max(0, p.units - t.sold)}</td>
                      <td className="px-3 py-2">{t.costs.toLocaleString()} ج.م</td>
                      <td className="px-3 py-2">{t.sales.toLocaleString()} ج.م</td>
                      <td className="px-3 py-2">{t.profit.toLocaleString()} ج.م</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </div>

          {sales.length>0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
              <h3 className="font-semibold mb-3">المبيعات</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-slate-50">
                      <th className="px-3 py-2">التاريخ</th>
                      <th className="px-3 py-2">المشروع</th>
                      <th className="px-3 py-2">الوحدة</th>
                      <th className="px-3 py-2">المشتري</th>
                      <th className="px-3 py-2">السعر</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map(s => { const p = projects.find(x=>x.id===s.projectId); return (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2">{s.date}</td>
                        <td className="px-3 py-2">{p?.name}</td>
                        <td className="px-3 py-2">{s.unitNo}</td>
                        <td className="px-3 py-2">{s.buyer}</td>
                        <td className="px-3 py-2">{s.price.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right"><button className="rounded-md bg-slate-900 text-white px-3 py-1" onClick={()=>printInvoice(s.id)}>فاتورة</button></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {costs.length>0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow">
              <h3 className="font-semibold mb-3">التكاليف</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-slate-50">
                      <th className="px-3 py-2">التاريخ</th>
                      <th className="px-3 py-2">المشروع</th>
                      <th className="px-3 py-2">النوع</th>
                      <th className="px-3 py-2">المبلغ</th>
                      <th className="px-3 py-2">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map(c => { const p = projects.find(x=>x.id===c.projectId); return (
                      <tr key={c.id} className="border-t">
                        <td className="px-3 py-2">{c.date}</td>
                        <td className="px-3 py-2">{p?.name}</td>
                        <td className="px-3 py-2">{c.type==="construction"?"إنشاء":c.type==="operation"?"تشغيل":"مصروفات"}</td>
                        <td className="px-3 py-2">{c.amount.toLocaleString()}</td>
                        <td className="px-3 py-2">{c.note}</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {active==="reports" && (
        <section className="bg-white border border-slate-200 rounded-xl p-4 shadow space-y-4">
          <h3 className="font-semibold">التقارير</h3>
          <div className="grid md:grid-cols-4 gap-3">
            <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={reportType} onChange={(e)=>setReportType(e.target.value)}>
              <option value="profit-loss">الأرباح والخسائر</option>
              <option value="revenue">الإيرادات</option>
              <option value="expense">المصروفات</option>
              <option value="salary">المرتبات</option>
              <option value="project">تقرير مشروع</option>
              <option value="inventory">تقرير المخزون</option>
            </select>
            {reportType === "project" && (
              <select className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={selectedProject} onChange={(e)=>setSelectedProject(e.target.value)}>
                <option value="">اختر المشروع</option>
                {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <input type="date" className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} />
            <input type="date" className="rounded-md border-2 border-slate-200 focus:border-indigo-500 outline-none px-3 py-2" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} />
            <button onClick={exportPDF} className="rounded-md bg-indigo-600 text-white px-4 py-2">تصدير PDF</button>
            <button onClick={exportExcel} className="rounded-md bg-emerald-600 text-white px-4 py-2">تصدير Excel</button>
            <button onClick={exportCsv} className="rounded-md bg-slate-900 text-white px-4 py-2">تصدير CSV</button>
          </div>
          <div className="border rounded-lg p-3">
            <div className="font-semibold mb-2">نتيجة التقرير</div>
            <div className="text-sm text-slate-600">الفترة {dateFrom} - {dateTo}</div>
            <div className="mt-3 grid md:grid-cols-3 gap-3">
              <Stat value={totals.revenue} label="إجمالي الإيرادات" color="text-emerald-600" />
              <Stat value={totals.expenses} label="إجمالي المصروفات" color="text-rose-600" />
              <Stat value={totals.profit} label="صافي الربح (ج.م)" color="text-indigo-700" />
            </div>
          </div>
        </section>
      )}

      {active==="users" && (
        <section>
          {isManager ? (
            <UserManagement />
          ) : (
            <div className="rounded-xl p-6 bg-white border border-slate-200 shadow">ليس ل��يك صلاحية لعرض إدارة المستخدمين</div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl p-4 bg-white border border-slate-200 shadow text-center">
      <div className={`text-3xl font-extrabold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-sm text-slate-600 mt-1">{label}</div>
    </div>
  );
}
