import React, { useState } from 'react';
import { api } from '../../services/api';
import { Clock, AlertTriangle } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

const SUPPORT_EMAIL = 'mathias@cenas.uy';

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setRemainingAttempts(null);
    setLockedUntil(null);

    try {
      const result = await api.login(formData.username, formData.password);

      if (result.success && result.token) {
        const encryptedSession = btoa(JSON.stringify({
          token: result.token,
          userId: result.user.id,
          username: result.user.username,
          role: result.user.role,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        }));

        localStorage.setItem('tasktracker_session', encryptedSession);
        onLoginSuccess();
      } else {
        setError(result.error || 'No se pudo iniciar sesión');
        if (typeof result.remainingAttempts === 'number') setRemainingAttempts(result.remainingAttempts);
        if (result.lockedUntil) setLockedUntil(result.lockedUntil);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Ocurrió un error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatLockoutTime = (lockedUntil: string) => {
    const lockTime = new Date(lockedUntil);
    const diffMs = lockTime.getTime() - Date.now();
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    return diffMins > 0 ? `${diffMins} minutos` : 'en breve';
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F8FAFC] font-sans">

      {/* LADO IZQUIERDO: lateral corporativo. order-2 en mobile, va después del
          formulario para no obligar a scrollear antes de poder iniciar sesión. */}
      <div className="order-2 lg:order-1 lg:col-span-5 bg-[#0B192C] p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#06B6D4]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <img
            src="https://landing.cenas.uy/assets/brand/logo-dark.png"
            alt="Cenas IT Solutions"
            className="h-9 w-auto"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        <div className="relative z-10 my-12">
          <span className="inline-block px-3 py-1 bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] text-xs font-mono font-bold rounded-md mb-4">
            PANEL DE ADMINISTRACIÓN
          </span>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Control, Transparencia e Infraestructura Crítica.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Gestioná clientes, proyectos, horas y reportes de auditoría en un solo lugar.
          </p>

          <div className="inline-flex items-center gap-2 bg-[#1E293B] border border-slate-700/60 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-200">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
            </span>
            Infraestructura monitoreada 24/7
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>Cenas IT Solutions</span>
          <span className="font-mono text-slate-400">ISO/IEC 20000</span>
        </div>
      </div>

      {/* LADO DERECHO: formulario de acceso. order-1 en mobile, para que el
          usuario llegue directo al login. */}
      <div className="order-1 lg:order-2 lg:col-span-7 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">

          <div>
            <div className="w-12 h-12 bg-[#06B6D4]/10 border border-[#06B6D4]/20 rounded-xl flex items-center justify-center text-[#06B6D4] mb-4 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-[#0B192C]">
              Iniciar Sesión
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Ingresá tus credenciales para acceder a TaskTracker Pro.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-[#0B192C] uppercase tracking-wider mb-2">
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={formData.username}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="usuario"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#06B6D4] focus:ring-1 focus:ring-[#06B6D4] transition-all disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-bold text-[#0B192C] uppercase tracking-wider">
                  Contraseña
                </label>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=Olvid%C3%A9%20mi%20contrase%C3%B1a`}
                  className="text-xs text-[#06B6D4] hover:underline font-semibold"
                >
                  ¿Olvidaste tu clave?
                </a>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#06B6D4] focus:ring-1 focus:ring-[#06B6D4] transition-all disabled:opacity-60"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-400 mr-2 shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {remainingAttempts} intento{remainingAttempts !== 1 ? 's' : ''} restante{remainingAttempts !== 1 ? 's' : ''}
                  </p>
                )}
                {lockedUntil && (
                  <p className="text-xs text-red-600 mt-1">
                    La cuenta se desbloquea en {formatLockoutTime(lockedUntil)}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !!lockedUntil}
              className="w-full py-3.5 px-4 bg-[#06B6D4] hover:bg-[#00D8F6] text-[#0B192C] font-bold text-sm rounded-lg transition-all duration-200 shadow-sm hover:shadow-[0_8px_20px_-6px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0B192C] mr-2"></span>
                  Ingresando...
                </span>
              ) : (
                'Ingresar al Portal'
              )}
            </button>
          </form>

          <div className="pt-4 text-center border-t border-slate-200/60">
            <p className="text-xs text-slate-500">
              ¿Problemas para acceder?{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#06B6D4] font-bold hover:underline">
                Contactar a Mesa de Ayuda
              </a>
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
