import React from 'react';
import { FileText } from 'lucide-react';
import ActionMenu from './ActionMenu';

const DocumentListItem = ({
  document,
  subtitle,
  details = [],
  actions = [],
  onPreview,
  selected,
  onSelect,
}) => {
  const isActive = document.is_active !== false;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/10 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onSelect && (
          <input
            type="checkbox"
            aria-label={`Select ${document.title || 'document'}`}
            checked={selected}
            onChange={() => onSelect(document.id)}
            disabled={!isActive}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
        )}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => isActive && onPreview?.(document)}
            disabled={!isActive || !onPreview}
            className="block max-w-full truncate text-left font-semibold text-gray-900 hover:text-emerald-700 disabled:cursor-default dark:text-gray-100 dark:hover:text-emerald-300"
          >
            {document.title || document.file_name || 'Untitled document'}
          </button>
          <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {subtitle || document.description || document.file_name || 'Document'}
          </div>
        </div>
      </div>

      {details.length > 0 && (
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {details.map(({ label, value, badge }, index) => (
            <div key={`${label}-${index}`} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
              <dd className="mt-0.5 truncate text-sm text-gray-700 dark:text-gray-300">
                {badge ? (
                  <span className="inline-flex max-w-full truncate rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {value}
                  </span>
                ) : value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {actions.length > 0 && (
        <div className="flex shrink-0 justify-end sm:ml-2">
          <ActionMenu menuId={`document-${document.id}`} actions={actions} />
        </div>
      )}
    </article>
  );
};

export default DocumentListItem;
