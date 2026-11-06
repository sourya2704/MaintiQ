import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { Loader } from "./components/ui/Loader";
import { useAuth } from "./lib/auth";
import { useLanguage } from "./lib/i18n";

const Login = lazy(() => import("./pages/Login"));
const ChooseLanguage = lazy(() => import("./pages/ChooseLanguage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MechanicHome = lazy(() => import("./pages/MechanicHome"));
const Machines = lazy(() => import("./pages/Machines"));
const MachineDetail = lazy(() => import("./pages/MachineDetail"));
const NewIncident = lazy(() => import("./pages/NewIncident"));
const Incidents = lazy(() => import("./pages/Incidents"));
const IncidentDetail = lazy(() => import("./pages/IncidentDetail"));
const MemorySearch = lazy(() => import("./pages/MemorySearch"));
const Settings = lazy(() => import("./pages/Settings"));
const Messages = lazy(() => import("./pages/Messages"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { chosen } = useLanguage();
  const location = useLocation();
  if (loading) return <Loader label="Authenticating" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // First sign-in after registering: pick English or Hindi before anything else.
  if (!chosen) return <ChooseLanguage />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const mechanic = user?.role === "technician";
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
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
          <Route path="messages/:userId" element={<Messages />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
