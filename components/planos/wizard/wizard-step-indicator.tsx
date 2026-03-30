import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface WizardStepIndicatorProps {
  currentStep: number  // 1, 2 ou 3
}

const steps = [
  { n: 1, label: 'Responsável & Pacientes' },
  { n: 2, label: 'Consultas & Valores'    },
  { n: 3, label: 'Revisão & Salvar'       },
]

export default function WizardStepIndicator({ currentStep }: WizardStepIndicatorProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, idx) => {
        const done    = step.n < currentStep
        const active  = step.n === currentStep
        const pending = step.n > currentStep

        return (
          <div key={step.n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                done    && 'bg-brand-500 text-white',
                active  && 'bg-brand-500 text-white ring-4 ring-brand-100',
                pending && 'bg-slate-200 text-slate-400',
              )}>
                {done ? <Check className="w-4 h-4" /> : step.n}
              </div>
              <p className={cn(
                'text-xs mt-1.5 font-medium whitespace-nowrap',
                active  ? 'text-brand-600' : 'text-slate-400'
              )}>
                {step.label}
              </p>
            </div>

            {idx < steps.length - 1 && (
              <div className={cn(
                'h-0.5 w-16 mx-2 mb-5 transition-all',
                step.n < currentStep ? 'bg-brand-400' : 'bg-slate-200'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
