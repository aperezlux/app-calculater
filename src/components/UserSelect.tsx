import { useEffect, useState } from "react";
import { api } from "../api";
import type { UserPublic } from "../types";

interface Props {
  onPickUser: (user: UserPublic) => void;
  onCreateUser: () => void;
  refreshKey: number;
}

export function UserSelect({ onPickUser, onCreateUser, refreshKey }: Props) {
  const [users, setUsers] = useState<UserPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch((e) => setError(String(e)));
  }, [refreshKey]);

  return (
    <div className="screen screen-center">
      <div className="brandmark">
        <span className="brandmark-glyph" aria-hidden="true">
          ○
        </span>
        Notas Locales
      </div>
      <h1 className="screen-title">¿Quién va a escribir?</h1>
      <p className="screen-subtitle">Cada persona tiene su propio espacio, con PIN.</p>

      {error && <p className="error-text">{error}</p>}

      <div className="user-grid">
        {users?.map((u) => (
          <button key={u.id} className="user-tile" onClick={() => onPickUser(u)}>
            <span className="user-avatar">{u.name.trim().charAt(0).toUpperCase() || "?"}</span>
            <span className="user-name">{u.name}</span>
          </button>
        ))}

        <button className="user-tile user-tile-new" onClick={onCreateUser}>
          <span className="user-avatar user-avatar-new">+</span>
          <span className="user-name">Crear usuario</span>
        </button>
      </div>

      {users && users.length === 0 && (
        <p className="empty-hint">Todavía no hay ningún usuario. Crea el primero para empezar.</p>
      )}
    </div>
  );
}
