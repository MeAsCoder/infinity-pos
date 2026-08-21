// Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { OfflineError } from '../api/client';
import Logo from '../components/Logo';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      // After successful login, check for open shift and redirect
      navigate('/pos');
    } catch (e) {
      if (e instanceof OfflineError) {
        setError('No internet connection and no cached session on this device. The first login on a device must happen online.');
      } else {
        setError(e.message || 'Login failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-ink-950">
      {/* Decorative side panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center bg-gradient-to-br from-ink-950 via-brand-dark/40 to-ink-950">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 65%, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative text-center px-12 flex flex-col items-center justify-center min-h-full py-12">
          <Logo className="justify-center mb-8 scale-[1.6]" />
          <p className="text-white/50 text-sm tracking-wide max-w-xs mx-auto leading-relaxed mb-12">
            Point of sale, stock, and credit — run with the same precision as the room itself.
          </p>
          
          {/* AlphaBuild Technologies Branding */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full px-8">
            <div className="border-t border-white/10 pt-4">
              <p className="text-white/30 text-xs font-medium tracking-wide">
                Developed by <span className="text-white/50 font-semibold">AlphaBuild Technologies</span>
              </p>
              <p className="text-white/20 text-xs mt-1.5">
                <a 
                  href="tel:+254701930035" 
                  className="hover:text-white/40 transition-colors duration-200 inline-flex items-center gap-1.5"
                >
                  <span className="text-sm">📞</span>
                  <span className="font-medium">+254 701 930 035</span>
                </a>
              </p>
              <div className="flex justify-center gap-3 mt-2.5">
                <a 
                  href="#" 
                  className="text-white/20 hover:text-white/40 transition-colors duration-200 text-sm"
                  title="Email us"
                >
                  ✉️
                </a>
                <a 
                  href="#" 
                  className="text-white/20 hover:text-white/40 transition-colors duration-200 text-sm"
                  title="Visit our website"
                >
                  🌐
                </a>
                <a 
                  href="#" 
                  className="text-white/20 hover:text-white/40 transition-colors duration-200 text-sm"
                  title="WhatsApp"
                >
                  💬
                </a>
              </div>
              <p className="text-white/10 text-[10px] mt-3 tracking-widest font-mono">
                v2.0.0
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="w-full lg:w-[440px] flex flex-col items-center justify-between p-6 bg-white">
        <div className="flex-1 flex items-center justify-center w-full">
          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <div className="lg:hidden flex justify-center mb-8">
              <div className="bg-ink-950 rounded-2xl px-5 py-4"><Logo /></div>
            </div>
            <h1 className="font-display text-2xl text-ink-950 font-semibold mb-1">Welcome back</h1>
            <p className="text-sm text-neutral-500 mb-7">Sign in to continue to the floor.</p>

            {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-xl p-3 mb-4 border border-rose-100">{error}</div>}

            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Username</label>
            <input 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              autoFocus
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 mb-4 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              placeholder="e.g. waiter1" 
            />

            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 mb-7 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              placeholder="••••••••" 
            />

            <button 
              disabled={busy}
              className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50 shadow-card"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer - Professional attribution (visible on mobile) */}
        <div className="w-full max-w-sm pt-4 pb-2 border-t border-neutral-100 lg:hidden">
          <div className="text-center">
            <p className="text-xs text-neutral-400 font-medium tracking-wide">
              Developed by <span className="text-brand font-semibold">AlphaBuild Technologies</span>
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              <a 
                href="tel:+254701930035" 
                className="hover:text-brand transition-colors duration-200 inline-flex items-center gap-1.5"
              >
                <span className="text-sm">📞</span>
                <span className="font-medium">+254 701 930 035</span>
              </a>
            </p>
            <p className="text-[10px] text-neutral-300 mt-2 tracking-wider">
              © {new Date().getFullYear()} All Rights Reserved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}