import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Callback } from "./pages/Callback";

export default function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route
          path="*"
          element={
            user ? (
              <Home user={user} onLogout={logout} />
            ) : (
              <Login onLogin={login} />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
