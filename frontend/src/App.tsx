import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { Loader } from "./components/ui/Loader";
import { useAuth } from "./lib/auth";
import { useLanguage } from "./lib/i18n";

const Login = lazy(() => import("./pages/Login"));
const Landing = lazy(() => import("./pages/Landing"));
const ChooseLanguage = lazy(() => import("./pages/ChooseLanguage"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const Team = lazy(() => import("./pages/Team"));
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
