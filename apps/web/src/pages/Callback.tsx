import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setSessionToken } from "../lib/api";

export function Callback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const session = params.get("session");
    const error = params.get("auth_error");

    if (session) {
      setSessionToken(session);
      window.location.href = "/";
    } else {
      console.error("Auth failed:", error);
      navigate("/?error=" + (error || "unknown"), { replace: true });
    }
  }, [params, navigate]);

  return <p>Logging you in...</p>;
}
