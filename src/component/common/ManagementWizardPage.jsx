import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';

const ManagementWizardPage = ({
  title,
  description,
  icon: Icon,
  onClose,
  closeLabel = 'Back',
  footer,
  steps,
  currentStep,
  onStepChange,
  children,
}) => {
  const activeStep = steps?.find((step) => step.id === currentStep);
  const hasStepLayout = Boolean(steps?.length && activeStep && onStepChange);

  return (
    <div className="flex min-h-[calc(100vh-6rem)] w-full flex-col">
    <header className="mb-2 flex items-center justify-between gap-4 border-b border-gray-200/70 px-1 py-3 dark:border-gray-700/70">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
            <Icon size={18} className="text-emerald-600 dark:text-emerald-400" />
          </span>
        )}
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-gray-100">{title}</h1>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sm:hidden">Back</span>
        <span className="hidden sm:inline">{closeLabel}</span>
      </button>
    </header>
    <main className="flex-1 py-3">
      {hasStepLayout ? (
        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
          <aside className="min-w-0">
            <div className="mb-5 lg:hidden">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span>Step {currentStep} of {steps.length}</span>
                <span>{activeStep.label}</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                role="progressbar"
                aria-label={`${title} progress`}
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={currentStep}
              >
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${(currentStep / steps.length) * 100}%` }}
                />
              </div>
            </div>
            <nav aria-label={`${title} steps`} className="hidden lg:block">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Setup</p>
              <ol className="mt-4 space-y-1">
                {steps.map((step) => {
                  const isComplete = step.id < currentStep;
                  const isCurrent = step.id === currentStep;
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        aria-current={isCurrent ? 'step' : undefined}
                        disabled={!isComplete}
                        onClick={() => isComplete && onStepChange(step.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left transition ${
                          isCurrent
                            ? 'bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                            : isComplete
                            ? 'text-emerald-700 hover:bg-emerald-50/70 dark:text-emerald-400 dark:hover:bg-emerald-950/20'
                            : 'text-gray-400 dark:text-gray-500'
                        } ${!isComplete ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : isComplete
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                          }`}
                        >
                          {isComplete ? <Check className="h-4 w-4" /> : step.id}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{step.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                            {step.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>
          <section className="min-w-0">
            <div className="mb-5 border-b border-gray-200/70 pb-4 dark:border-gray-700/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Step {String(currentStep).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{activeStep.label}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{activeStep.description}</p>
            </div>
            {children}
          </section>
        </div>
      ) : children}
    </main>
    {footer && <footer className="border-t border-gray-200/70 px-1 py-4 dark:border-gray-700/70">{footer}</footer>}
    </div>
  );
};

export default ManagementWizardPage;
