import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { Loader } from "./components/ui/Loader";
import { useAuth } from "./lib/auth";
import { useLanguage } from "./lib/i18n";

// Every signed-in page, so they can be fetched ahead of time (see below).
const PAGES = {
  Team: () => import("./pages/Team"),
  Dashboard: () => import("./pages/Dashboard"),
  MechanicHome: () => import("./pages/MechanicHome"),
  Machines: () => import("./pages/Machines"),
  MachineDetail: () => import("./pages/MachineDetail"),
  NewIncident: () => import("./pages/NewIncident"),
  Incidents: () => import("./pages/Incidents"),
  IncidentDetail: () => import("./pages/IncidentDetail"),
  MemorySearch: () => import("./pages/MemorySearch"),
  Settings: () => import("./pages/Settings"),
  Messages: () => import("./pages/Messages"),
};

/** Once signed in and the browser is idle, download the other pages so tapping a menu item is instant. */
function usePrefetchPages(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => Object.values(PAGES).forEach((load) => void load().catch(() => {})));
    return () => cancel(id);
  }, [enabled]);
}

const Login = lazy(() => import("./pages/Login"));
const Landing = lazy(() => import("./pages/Landing"));
const ChooseLanguage = lazy(() => import("./pages/ChooseLanguage"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const Team = lazy(PAGES.Team);
const Dashboard = lazy(PAGES.Dashboard);
const MechanicHome = lazy(PAGES.MechanicHome);
const Machines = lazy(PAGES.Machines);
const MachineDetail = lazy(PAGES.MachineDetail);
const NewIncident = lazy(PAGES.NewIncident);
const Incidents = lazy(PAGES.Incidents);
const IncidentDetail = lazy(PAGES.IncidentDetail);
const MemorySearch = lazy(PAGES.MemorySearch);
const Settings = lazy(PAGES.Settings);
const Messages = lazy(PAGES.Messages);

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { chosen } = useLanguage();
  const location = useLocation();
  if (loading) return <Loader label="Authenticating" />;
  // Visitors see the public website at the root; any other page asks them to sign in.
  if (!user) return location.pathname === "/" ? <Landing /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // First sign-in: replace the admin's one-time password, then pick English or Hindi.
  if (user.must_change_password) return <SetPassword />;
  if (!chosen) return <ChooseLanguage />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const mechanic = user?.role === "technician";
  usePrefetchPages(Boolean(user));
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={mechanic ? <MechanicHome /> : <Dashboard />} />
          <Route path="machines" element={<Machines />} />
          <Route path="machines/:id" element={<MachineDetail />} />
          <Route path="report" element={<NewIncident />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="incidents/:id" element={<IncidentDetail />} />
          <Route path="memory" element={<MemorySearch />} />
          <Route path="settings" element={<Settings />} />
          <Route path="messages" element={<Messages />} />
          <Route path="team" element={<Team />} />
          <Route path="messages/:userId" element={<Messages />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
