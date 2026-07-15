import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

export function OnboardingInfoBanner() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm dark:border-blue-900/30 dark:bg-blue-950/20">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between font-medium text-blue-900 dark:text-blue-300"
      >
        <span className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span>Información sobre este servicio de gestión de accesos</span>
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2 text-blue-800 dark:text-blue-400/90 leading-relaxed">
          <p>
            Queremos contarte que la implementación y el uso de este portal de solicitudes
            <strong> no tiene ningún costo adicional</strong> para tu empresa.
          </p>
          <p>
            Nuestro objetivo con esta herramienta es facilitar la operativa de tu negocio: ordenar y agilizar tus procesos internos para que las altas y bajas no se pierdan en chats, al mismo tiempo que mantenemos un <strong>registro histórico riguroso de permisos y accesos</strong> de cada colaborador para auditorías de seguridad.
          </p>
          <p className="text-xs italic border-t border-blue-200/50 pt-2 dark:border-blue-900/40">
            * Las horas de soporte técnico dedicadas a la creación o desactivación efectiva de las cuentas se seguirán computando bajo nuestra modalidad habitual de abono o tarifa por hora.
          </p>
        </div>
      )}
    </div>
  );
}
