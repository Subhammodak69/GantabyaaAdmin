import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';

const inputClass = 'w-full h-[42px] rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const sameDay = (left, right) => left.toDateString() === right.toDateString();

const parseValue = (value) => {
  if (!value) return new Date();
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const clampDateToMonth = (date, targetMonth) => {
  const maxDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(date.getDate(), maxDay), date.getHours(), date.getMinutes());
};

const formatValue = (date, includeTime) => {
  const pad = (part) => String(part).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return includeTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
};

const displayValue = (date, includeTime) => date.toLocaleString(undefined, includeTime
  ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  : { year: 'numeric', month: 'short', day: 'numeric' });

const CustomDatePicker = ({ value = '', onChange, includeTime = true, placeholder = 'Select date', disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => parseValue(value));
  const [month, setMonth] = useState(() => {
    const date = parseValue(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [pickerType, setPickerType] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!value) return;
    const nextDate = parseValue(value);
    setSelectedDate(nextDate);
    setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setPickerType(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const years = useMemo(() => {
    const startYear = new Date().getFullYear() + 2;
    return Array.from({ length: 100 }, (_, index) => startYear - index);
  }, []);

  const days = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];
  }, [month]);

  const changeMonth = (offset) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(nextMonth);
    setSelectedDate((current) => clampDateToMonth(current, nextMonth));
  };

  const selectMonth = (monthIndex) => {
    const nextMonth = new Date(month.getFullYear(), monthIndex, 1);
    setMonth(nextMonth);
    setSelectedDate((current) => clampDateToMonth(current, nextMonth));
    setPickerType(null);
  };

  const selectYear = (year) => {
    const nextMonth = new Date(year, month.getMonth(), 1);
    setMonth(nextMonth);
    setSelectedDate((current) => clampDateToMonth(current, nextMonth));
    setPickerType(null);
  };

  const updateTime = (event) => {
    const [hours, minutes] = event.target.value.split(':').map(Number);
    setSelectedDate((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate(), hours || 0, minutes || 0));
  };

  const applyDate = () => {
    onChange(formatValue(selectedDate, includeTime));
    setIsOpen(false);
    setPickerType(null);
  };

  const clearDate = () => {
    onChange('');
    setIsOpen(false);
    setPickerType(null);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((current) => !current)}
        className={`${inputClass} flex items-center justify-between text-left ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className={value ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400'}>{value ? displayValue(selectedDate, includeTime) : placeholder}</span>
        <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {isOpen && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">Select date</p>
              <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{displayValue(selectedDate, includeTime)}</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close date picker"><X className="h-4 w-4" /></button>
            </div>

          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => changeMonth(-1)} className="rounded-lg p-2 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30" aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPickerType((current) => (current === 'month' ? null : 'month'))} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold uppercase text-cyan-700 dark:border-gray-700 dark:text-cyan-300">{monthNames[month.getMonth()]}</button>
              <button type="button" onClick={() => setPickerType((current) => (current === 'year' ? null : 'year'))} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold uppercase text-cyan-700 dark:border-gray-700 dark:text-cyan-300">{month.getFullYear()}</button>
            </div>
            <button type="button" onClick={() => changeMonth(1)} className="rounded-lg p-2 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30" aria-label="Next month"><ChevronRight className="h-5 w-5" /></button>
          </div>

          {pickerType && <div className="mb-3 max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/50"><p className="mb-2 text-xs font-bold text-gray-500">Select {pickerType}</p>{(pickerType === 'month' ? monthNames : years).map((item, index) => { const selected = pickerType === 'month' ? month.getMonth() === index : month.getFullYear() === item; return <button type="button" key={String(item)} onClick={() => (pickerType === 'month' ? selectMonth(index) : selectYear(Number(item)))} className={`block w-full border-b border-gray-200 py-2 text-left text-sm last:border-b-0 dark:border-gray-700 ${selected ? 'font-bold text-cyan-700 dark:text-cyan-300' : 'text-gray-700 dark:text-gray-200'}`}>{item}</button>; })}</div>}

          <div className="mb-2 flex">{weekDays.map((day, index) => <span key={`${day}-${index}`} className="flex-1 text-center text-xs font-bold text-gray-500">{day}</span>)}</div>
          <div className="flex flex-wrap">{days.map((day, index) => day ? <button type="button" key={day.toISOString()} onClick={() => setSelectedDate((current) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), current.getHours(), current.getMinutes()))} className="flex h-10 w-[14.28%] items-center justify-center" aria-label={day.toLocaleDateString(undefined, { dateStyle: 'full' })} aria-pressed={sameDay(day, selectedDate)}><span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${sameDay(day, selectedDate) ? 'bg-cyan-600 font-bold text-white' : 'text-gray-700 hover:bg-cyan-50 dark:text-gray-200 dark:hover:bg-gray-700'}`}>{day.getDate()}</span></button> : <span key={`blank-${index}`} className="h-10 w-[14.28%]" />)}</div>

          {includeTime && <label className="mt-3 block"><span className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500"><Clock className="h-3.5 w-3.5" />Time</span><input type="time" value={`${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`} onChange={updateTime} className={inputClass} /></label>}
          <div className="mt-4 flex gap-2"><button type="button" onClick={clearDate} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-rose-600 dark:border-gray-700">Clear</button><button type="button" onClick={() => setIsOpen(false)} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">Cancel</button><button type="button" onClick={applyDate} className="flex-1 rounded-lg bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-700">Apply date</button></div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

export default CustomDatePicker;
