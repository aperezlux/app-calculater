import { useState } from "react";
import { api } from "../api";
import type { UserPublic } from "../types";

interface Props {
  user: UserPublic;
  onSuccess: () => void;
  onBack: () => void;
}

export function PinScreen({ user, onSuccess, onBack }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function submit(candidate: string) {
    if (candidate.length < 4) return;
    setChecking(true);
    setError(null);
    try {
      const ok = await api.verifyPin(user.id, candidate);
      if (ok) {
        onSuccess();
      } else {
        setAttempts((a) => a + 1);
        setError("PIN incorrecto. Inténtalo de nuevo.");
        setPin("");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="screen screen-center">
      <button className="link-back" onClick={onBack}>
        ← Otro usuario
      </button>

      <span className="user-avatar user-avatar-lg">{user.name.trim().charAt(0).toUpperCase()}</span>
      <h1 className="screen-title">Hola, {user.name}</h1>
      <p className="screen-subtitle">Introduce tu PIN</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(pin);
        }}
      >
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          maxLength={8}
          disabled={checking}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setPin(digits);
            if (digits.length === 8) submit(digits);
          }}
          aria-label="PIN"
        />
        <div className="pin-dots" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className={`pin-dot ${i < pin.length ? "pin-dot-filled" : ""}`} />
          ))}
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={checking || pin.length < 4}>
          {checking ? "Comprobando..." : "Entrar"}
        </button>
      </form>

      {attempts >= 3 && (
        <p className="empty-hint">
          Si olvidaste tu PIN, pide a otra persona con acceso a este equipo que elimine y
          vuelva a crear tu usuario desde "Seleccionar usuario".
        </p>
      )}
    </div>
  );
}
