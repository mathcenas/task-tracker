import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export function OnboardingGenericUserNotice() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm dark:border-amber-900/30 dark:bg-amber-950/20">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between font-medium text-amber-900 dark:text-amber-300"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <span>¿Por qué no recomendamos usuarios genéricos/compartidos?</span>
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2 text-amber-800 dark:text-amber-400/90 leading-relaxed">
          <p>
            Un usuario genérico (por ejemplo, una casilla de mail o un login de VPN que usan varias personas
            a la vez) rompe algo básico de la seguridad: la <strong>trazabilidad</strong>. Si no sabemos quién
            hizo qué, no podemos investigar un incidente, revertir un cambio indebido ni cumplir con auditorías
            de seguridad que pidan ese detalle.
          </p>
          <p>
            También complica las <strong>bajas</strong>: cuando una sola persona del equipo que compartía ese
            usuario se va, la única forma de quitarle el acceso es cambiar la contraseña para
            <strong> todos</strong> los que la usan, y volver a distribuirla — en cambio, con cuentas
            individuales alcanza con desactivar una sola.
          </p>
          <p>
            Por estos motivos recomendamos una cuenta por persona para cada sistema (mail, VPN, carpetas
            compartidas, etc.), con permisos ajustados a lo que cada uno necesita.
          </p>
          <p className="text-xs italic border-t border-amber-200/50 pt-2 dark:border-amber-900/40">
            * Si igualmente decidís continuar con un usuario genérico o compartido para algún acceso, TaskTracker
            Pro / Cenas Support deja constancia de esta recomendación y no se responsabiliza por accesos no
            identificables, uso indebido o incidentes de seguridad que resulten de esa decisión — la
            responsabilidad de esa configuración queda del lado de la empresa solicitante.
          </p>
        </div>
      )}
    </div>
  );
}
