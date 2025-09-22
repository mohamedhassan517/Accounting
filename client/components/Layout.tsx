import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100">
      <header className="backdrop-blur bg-white/70 border-b border-slate-200 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            نظام المحاسبة | Accounting
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user && (
              <>
                <Link className={navClass(location.pathname === "/dashboard")} to="/dashboard">لوحة التحكم</Link>
              </>
            )}
            {!user && (
              <Link className={navClass(location.pathname === "/login")} to="/login">تسجيل الدخول</Link>
            )}
            {user && (
              <button onClick={async () => { await logout(); navigate("/login"); }} className="rounded-md px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800">
                خروج
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

function navClass(active: boolean) {
  return `px-3 py-1.5 rounded-md ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:text-slate-900"}`;
}
