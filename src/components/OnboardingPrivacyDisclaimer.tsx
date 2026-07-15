import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface DisclaimerProps {
  accepted: boolean;
  setAccepted: (accepted: boolean) => void;
}

export function OnboardingPrivacyDisclaimer({ accepted, setAccepted }: DisclaimerProps) {
  return (
    <div className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
            Declaración de Privacidad y Protección de Datos (Ley N° 18.331 - Uruguay)
          </p>
          <p className="mb-2">
            Al enviar este formulario, usted declara que cuenta con el consentimiento del titular de los datos para su tratamiento exclusivamente operativo en el marco del soporte de TI.
          </p>
          <p>
            <strong>No almacenamiento de datos privados:</strong> Bajo ninguna circunstancia se solicitarán ni guardarán datos de carácter sensible (como Cédula de Identidad, salarios, domicilio o datos financieros). Los datos se procesan localmente de forma segura únicamente para la gestión de accesos solicitada.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200 dark:border-slate-800">
        <input
          type="checkbox"
          required
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
        />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Acepto los términos de procesamiento y protección de datos según la Ley N° 18.331 de Uruguay.
        </span>
      </label>
    </div>
  );
}
