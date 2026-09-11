import { useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { api } from "../api";
import { AUTO_LOCK_PRESETS, AVAILABLE_FONTS } from "../types";
import type { ThemePref, UserPublic } from "../types";

interface Props {
  user: UserPublic;
  onUserUpdated: (u: UserPublic) => void;
  onUserDeleted: () => void;
  onClose: () => void;
}

export function SettingsPanel(props: Props) {
  const { user } = props;
  const [tab, setTab] = useState<"account" | "security" | "appearance" | "editor" | "backup">("account");
  const [name, setName] = useState(user.name);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    if (!name.trim()) return setError("El nombre no puede estar vacío.");
    try {
      const updated = await api.renameUser(user.id, name.trim());
      props.onUserUpdated(updated);
      setMessage("Nombre actualizado.");
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function changePin() {
    if (!/^\d{4,8}$/.test(newPin)) return setError("El nuevo PIN debe tener entre 4 y 8 dígitos.");
    if (newPin !== confirmNewPin) return setError("Los PIN nuevos no coinciden.");
    try {
      await api.changePin(user.id, currentPin, newPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
      setMessage("PIN actualizado.");
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function setAutoLock(minutes: number | null) {
    const updated = await api.updateUserSettings(user.id, { autoLockMinutes: minutes });
    props.onUserUpdated(updated);
  }

  async function setTheme(theme: ThemePref) {
    const updated = await api.updateUserSettings(user.id, { theme });
    props.onUserUpdated(updated);
  }

  async function setDefaultFont(defaultFont: string) {
    const updated = await api.updateUserSettings(user.id, { defaultFont });
    props.onUserUpdated(updated);
  }

  async function setDefaultFontSize(defaultFontSize: number) {
    const updated = await api.updateUserSettings(user.id, { defaultFontSize });
    props.onUserUpdated(updated);
  }

  async function deleteUser() {
    if (
      confirm(
        `¿Estás seguro de que deseas eliminar el usuario "${user.name}" y todas sus notas? Esta acción no se puede deshacer.`
      )
    ) {
      await api.deleteUser(user.id);
      props.onUserDeleted();
    }
  }

  async function handleExport() {
    try {
      const json = await api.exportBackup(user.id);
      const path = await save({
        defaultPath: `notas-locales-${user.name}-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "Respaldo JSON", extensions: ["json"] }],
      });
      if (path) {
        await writeTextFile(path, json);
        setMessage("Respaldo exportado correctamente.");
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleImport() {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Respaldo JSON", extensions: ["json"] }],
      });
      if (!path || Array.isArray(path)) return;
      const json = await readTextFile(path);
      const overwrite = confirm(
        "¿Deseas sobrescribir notas existentes con el mismo identificador? Cancelar conservará ambas copias."
      );
      const result = await api.importBackup(user.id, json, overwrite);
      setMessage(`Importado: ${result.imported} notas. Omitidas: ${result.skipped}.`);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="settings-layout">
          <nav className="settings-tabs">
            {(
              [
                ["account", "Cuenta"],
                ["security", "Seguridad"],
                ["appearance", "Apariencia"],
                ["editor", "Editor"],
                ["backup", "Respaldo"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`settings-tab ${tab === key ? "settings-tab-active" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {message && <p className="success-text">{message}</p>}
            {error && <p className="error-text">{error}</p>}

            {tab === "account" && (
              <div className="form-stack">
                <h3>Cuenta</h3>
                <label className="field">
                  <span>Nombre</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <button className="btn btn-primary btn-small" onClick={saveName}>
                  Guardar nombre
                </button>

                <hr className="settings-divider" />
                <h3>Zona de peligro</h3>
                <button className="btn btn-danger" onClick={deleteUser}>
                  Eliminar usuario y todas sus notas
                </button>
              </div>
            )}

            {tab === "security" && (
              <div className="form-stack">
                <h3>Cerrar mi sesión automáticamente después de</h3>
                <select
                  value={user.autoLockMinutes === null ? "never" : String(user.autoLockMinutes)}
                  onChange={(e) => setAutoLock(e.target.value === "never" ? null : Number(e.target.value))}
                >
                  {AUTO_LOCK_PRESETS.map((p) => (
                    <option key={p.label} value={p.minutes === null ? "never" : p.minutes}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <label className="field">
                  <span>Tiempo personalizado (minutos)</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="Ej. 7"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0) setAutoLock(v);
                    }}
                  />
                </label>

                <hr className="settings-divider" />
                <h3>Cambiar PIN</h3>
                <label className="field">
                  <span>PIN actual</span>
                  <input type="password" inputMode="numeric" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                </label>
                <label className="field">
                  <span>Nuevo PIN</span>
                  <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                </label>
                <label className="field">
                  <span>Confirmar nuevo PIN</span>
                  <input type="password" inputMode="numeric" value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                </label>
                <button className="btn btn-primary btn-small" onClick={changePin}>
                  Actualizar PIN
                </button>
              </div>
            )}

            {tab === "appearance" && (
              <div className="form-stack">
                <h3>Tema</h3>
                <div className="segmented">
                  {(["light", "dark", "auto"] as ThemePref[]).map((t) => (
                    <button
                      key={t}
                      className={`segmented-btn ${user.theme === t ? "segmented-btn-active" : ""}`}
                      onClick={() => setTheme(t)}
                    >
                      {t === "light" ? "Claro" : t === "dark" ? "Oscuro" : "Automático"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "editor" && (
              <div className="form-stack">
                <h3>Fuente predeterminada</h3>
                <select value={user.defaultFont} onChange={(e) => setDefaultFont(e.target.value)}>
                  {AVAILABLE_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <h3>Tamaño de letra predeterminado</h3>
                <select
                  value={user.defaultFontSize}
                  onChange={(e) => setDefaultFontSize(Number(e.target.value))}
                >
                  {[12, 14, 16, 18, 20, 24].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === "backup" && (
              <div className="form-stack">
                <h3>Exportar respaldo</h3>
                <p className="settings-help">
                  Guarda todas tus notas, carpetas y preferencias en un archivo .json que puedes
                  mover a otra computadora.
                </p>
                <button className="btn btn-primary btn-small" onClick={handleExport}>
                  Exportar respaldo
                </button>

                <hr className="settings-divider" />
                <h3>Importar respaldo</h3>
                <p className="settings-help">
                  Selecciona un archivo .json exportado previamente. Se te preguntará antes de
                  sobrescribir cualquier nota existente.
                </p>
                <button className="btn btn-ghost btn-small" onClick={handleImport}>
                  Importar respaldo
                </button>
              </div>
            )}
          </div>
        </div>
        <button className="modal-close" onClick={props.onClose} title="Cerrar (Esc)">
          ×
        </button>
      </div>
    </div>
  );
}
