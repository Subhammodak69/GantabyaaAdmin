import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BookOpenText,
  Check,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import ActionMenu from '../component/common/ActionMenu';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import ManagementTable from '../component/common/ManagementTable';
import Modal from '../component/common/Modal';
import SelectField from '../component/common/SelectField';
import { apiCall, handleApiError } from '../utils/apiCall';

const ENDPOINT = '/api/v1/admin/rules-regulations';
const tourTypes = ['DOMESTIC', 'INTERNATIONAL'];
const tourTypeOptions = tourTypes.map((type) => ({ value: type, label: type }));
const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const defaultForm = { rule_title: '', regulations: 'null', type: 'DOMESTIC', is_active: true };

const prettyRegulations = (value) => JSON.stringify(value ?? null, null, 2);

const RulesRegulations = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await apiCall(ENDPOINT, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to fetch rules and regulations');
      if (!Array.isArray(payload?.data)) throw new Error('The rules and regulations response is invalid');
      setRules(payload.data);
    } catch (error) {
      handleApiError(error, 'Unable to load rules and regulations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, []);

  const filteredRules = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rules.filter((rule) => {
      const matchesType = typeFilter === 'ALL' || rule.type === typeFilter;
      const matchesSearch = !term || (rule.rule_title || '').toLowerCase().includes(term);
      return matchesType && matchesSearch;
    });
  }, [rules, searchTerm, typeFilter]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingRule(null);
    setForm(defaultForm);
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm(defaultForm);
    setFormOpen(true);
  };

  const openEdit = (rule) => {
    setEditingRule(rule);
    setForm({
      rule_title: rule.rule_title || '',
      regulations: prettyRegulations(rule.regulations),
      type: rule.type || 'DOMESTIC',
      is_active: rule.is_active !== false,
    });
    setFormOpen(true);
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveRule = async (event) => {
    event.preventDefault();
    const title = form.rule_title.trim();
    if (!title) {
      toast.error('Rule title is required');
      return;
    }

    let regulations;
    try {
      regulations = JSON.parse(form.regulations.trim() || 'null');
    } catch {
      toast.error('Regulations must be valid JSON, or left empty for null');
      return;
    }

    const payload = {
      rule_title: title,
      regulations,
      type: form.type,
      ...(editingRule ? { is_active: form.is_active } : {}),
    };

    setSaving(true);
    try {
      const endpoint = editingRule ? `${ENDPOINT}/${encodeURIComponent(editingRule.id)}` : ENDPOINT;
      const response = await apiCall(endpoint, editingRule ? 'PATCH' : 'POST', payload);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to save rule');
      toast.success(result?.message || (editingRule ? 'Rule updated successfully' : 'Rule created successfully'));
      closeForm();
      await loadRules();
    } catch (error) {
      handleApiError(error, editingRule ? 'Unable to update rule' : 'Unable to create rule');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await apiCall(`${ENDPOINT}/${encodeURIComponent(deleteTarget.id)}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to delete rule');
      toast.success(result?.message || 'Rule deleted successfully');
      setDeleteTarget(null);
      await loadRules();
    } catch (error) {
      handleApiError(error, 'Unable to delete rule');
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = rules.filter((rule) => rule.is_active).length;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-blue-300 dark:to-indigo-300">
            Rules &amp; Regulations
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage the policies shown for domestic and international tours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRules}
            disabled={loading}
            aria-label="Refresh rules and regulations"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add rule
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total rules', value: rules.length, icon: FileText, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
          { label: 'Active rules', value: activeCount, icon: Check, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
          { label: 'Tour categories', value: tourTypes.length, icon: BookOpenText, color: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search rules..."
            aria-label="Search rules"
            className={`${inputClass} pl-9`}
          />
        </label>
        <div className="sm:w-52">
          <SelectField
            options={[{ value: 'ALL', label: 'All tour types' }, ...tourTypeOptions]}
            value={[{ value: 'ALL', label: 'All tour types' }, ...tourTypeOptions].find((option) => option.value === typeFilter)}
            onChange={(option) => setTypeFilter(option?.value || 'ALL')}
            isSearchable={false}
            aria-label="Filter by tour type"
            classNamePrefix="react-select"
          />
        </div>
      </div>

      <div className="overflow-hidden md:rounded-2xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />
            Loading rules and regulations...
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpenText className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{rules.length ? 'No matching rules found.' : 'No rules have been added yet.'}</p>
            {!rules.length && <button type="button" onClick={openCreate} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">Add your first rule</button>}
          </div>
        ) : (
          <div className="w-full">
              <ManagementTable>
                <table className="w-full table-fixed divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
                  <colgroup>
                    <col className="w-[40%]" />
                    <col className="w-[17%]" />
                    <col className="w-[12%]" />
                    <col className="w-[19%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="bg-gray-50 dark:bg-gray-800/70">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Rule</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Tour type</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Last updated</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"><FileText className="h-4 w-4" /></span>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white">{rule.rule_title || 'Untitled rule'}</p>
                              <p className="max-w-md truncate text-xs text-gray-500 dark:text-gray-400">{rule.regulations == null ? 'No regulation details' : prettyRegulations(rule.regulations).replace(/\s+/g, ' ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${rule.type === 'INTERNATIONAL' ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{rule.type || 'DOMESTIC'}</span></td>
                        <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${rule.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-500 dark:text-gray-400">{rule.updated_at ? new Date(rule.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end">
                            <ActionMenu actions={[
                              { label: 'Edit rule', icon: <Pencil className="h-4 w-4 text-indigo-500" />, onClick: () => openEdit(rule) },
                              { label: 'Delete rule', icon: <Trash2 className="h-4 w-4 text-red-500" />, className: 'text-red-600 hover:text-red-700 dark:text-red-400', onClick: () => setDeleteTarget(rule) },
                            ]} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ManagementTable>
          </div>
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editingRule ? 'Edit rule' : 'Add rule'}
        icon={BookOpenText}
        size="lg"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeForm} disabled={saving} className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Cancel</button>
            <button type="submit" form="rules-regulations-form" disabled={saving} className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : editingRule ? 'Save changes' : 'Create rule'}</button>
          </div>
        )}
      >
        <form id="rules-regulations-form" onSubmit={saveRule} className="space-y-5 p-1">
          <div>
            <label htmlFor="rule-title" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Rule title</label>
            <input id="rule-title" value={form.rule_title} onChange={(event) => updateForm('rule_title', event.target.value)} className={inputClass} placeholder="e.g. Cancellation policy" maxLength={200} required />
          </div>
          <div>
            <label htmlFor="rule-regulations" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Regulations (JSON)</label>
            <textarea id="rule-regulations" value={form.regulations} onChange={(event) => updateForm('regulations', event.target.value)} className={`${inputClass} font-mono text-xs`} rows={8} spellCheck="false" placeholder={'null\nor {"items": ["Example regulation"]}'} />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Enter valid JSON (text, object, or array). Leave as <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">null</code> if no details are needed.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rule-type" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Tour type</label>
              <SelectField
                inputId="rule-type"
                options={tourTypeOptions}
                value={tourTypeOptions.find((option) => option.value === form.type)}
                onChange={(option) => updateForm('type', option?.value || 'DOMESTIC')}
                isSearchable={false}
                classNamePrefix="react-select"
              />
            </div>
            {editingRule && (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700">
                <input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
              </label>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete rule"
        message="This rule and its regulation details will be permanently removed."
        itemLabel={deleteTarget?.rule_title || 'this rule'}
        confirming={deleting}
      />
    </div>
  );
};

export default RulesRegulations;
