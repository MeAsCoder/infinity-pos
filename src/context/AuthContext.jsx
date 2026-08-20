import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../db/offlineDb';
import { api, OfflineError } from '../api/client';

const AuthContext = createContext(null);

function getDeviceId() {
  let id = localStorage.getItem('infinity_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('infinity_device_id', id);
  }
  return id;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const deviceId = getDeviceId();

  useEffect(() => {
    (async () => {
      const session = await db.session.get(1);
      if (session) {
        setUser(session.user);
        // Best-effort revalidation with the server (catches a remotely
        // disabled account) — never blocks offline usage if it fails.
        try {
          const fresh = await api.me();
          await db.session.put({ ...session, user: fresh });
          setUser(fresh);
        } catch (e) {
          if (!(e instanceof OfflineError)) {
            // token rejected (expired/revoked) -> force logout
            if (e.status === 401) {
              await db.session.delete(1);
              setUser(null);
            }
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(username, password) {
    const result = await api.login(username, password, deviceId, navigator.userAgent.slice(0, 60));
    await db.session.put({ id: 1, token: result.token, user: result.user, deviceId, cachedAt: new Date().toISOString() });
    setUser(result.user);
    return result.user;
  }

  async function logout() {
    await db.session.delete(1);
    await db.currentShift.delete(1);
    setUser(null);
  }

  function hasPermission(perm) {
    if (!user) return false;
    return user.permissions.includes('*') || user.permissions.includes(perm);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, deviceId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
