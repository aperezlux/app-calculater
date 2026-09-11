import { useState } from "react";
import { api } from "../api";
import { AUTO_LOCK_PRESETS } from "../types";
import type { UserPublic } from "../types";

interface Props {
  onCreated: (user: UserPublic) => void;
  onClose: () => void;
}

export function CreateUserModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [autoLockMinutes, setAutoLockMinutes] = useState<number | null>(10);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (name.trim().length === 0) return "Escribe un nombre de usuario.";
    if (!/^\d{4,8}$/.test(pin)) return "El PIN debe tener entre 4 y 8 dígitos.";
    if (pin !== confirmPin) return "Los dos PIN no coinciden.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const user = await api.createUser(name.trim(), pin);
      if (autoLockMinutes !== 10) {
        await api.updateUserSettings(user.id, { autoLockMinutes });
      }
      onCreated({ ...user, autoLockMinutes });
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Crear usuario</h2>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Nombre</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Angel"
              maxLength={40}
            />
          </label>

          <label className="field">
            <span>PIN (4 a 8 dígitos)</span>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </label>

          <label className="field">
            <span>Confirmar PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </label>

          <label className="field">
            <span>Cerrar mi sesión automáticamente después de</span>
            <select
              value={autoLockMinutes === null ? "never" : String(autoLockMinutes)}
              onChange={(e) =>
                setAutoLockMinutes(e.target.value === "never" ? null : Number(e.target.value))
              }
            >
              {AUTO_LOCK_PRESETS.map((p) => (
                <option key={p.label} value={p.minutes === null ? "never" : p.minutes}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
