import React, { useState, useEffect, useCallback } from 'react';
import SelectField from './SelectField';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';

const Pagination = ({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onLimitChange,
    onItemsPerPageChange,
    availableLimits = [10, 20, 50, 100],
    className = '',
    showInfo = true,
}) => {
    const handleLimitChange = onLimitChange || onItemsPerPageChange;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const [jumpPage, setJumpPage] = useState('');

    useEffect(() => {
        setJumpPage(String(currentPage));
    }, [currentPage]);

    const handleJump = (e) => {
        e.preventDefault();
        const page = Number.parseInt(jumpPage, 10);
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        } else {
            setJumpPage(String(currentPage));
        }
    };

    const limitOptions = availableLimits.map((limit) => ({
        value: limit,
        label: String(limit),
    }));

    const getPageNumbers = () => {
        const delta = 1;
        const range = [];
        const rangeWithDots = [];
        let last;

        for (let i = 1; i <= totalPages; i += 1) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= currentPage - delta && i <= currentPage + delta)
            ) {
                range.push(i);
            }
        }

        range.forEach((i) => {
            if (last) {
                if (i - last === 2) {
                    rangeWithDots.push(last + 1);
                } else if (i - last !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            last = i;
        });

        return rangeWithDots;
    };

    if (totalItems === 0) return null;

    const navBtnClass =
        'inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 text-slate-700 transition hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-indigo-400';

    const pageBtnClass = (active) =>
        `inline-flex h-8 min-w-8 items-center justify-center rounded-2xl px-2 text-sm font-semibold transition ${active
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
            : 'text-slate-700 hover:bg-slate-200 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-400'
        }`;

    return (
        <div
            className={`px-3  ${className}`.trim()}
        >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Info */}
                {showInfo && (
                    <p className="text-center text-xs text-slate-700 dark:text-slate-200 sm:text-left sm:text-sm">
                        Showing{' '}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {startItem}–{endItem}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</span>
                    </p>
                )}

                {/* Page controls */}
                <div className="flex items-center justify-center gap-1">
                    <button
                        type="button"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        className={navBtnClass}
                        title="First page"
                        aria-label="First page"
                    >
                        <ChevronsLeft size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={navBtnClass}
                        title="Previous page"
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={15} />
                    </button>

                    <div className="flex items-center gap-0.5 px-1">
                        {getPageNumbers().map((page, idx) =>
                            page === '...' ? (
                                <span
                                    key={`dots-${idx}`}
                                    className="inline-flex h-8 w-6 items-center justify-center text-xs text-slate-600 dark:text-slate-300"
                                >
                                    …
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    type="button"
                                    onClick={() => onPageChange(page)}
                                    className={pageBtnClass(currentPage === page)}
                                    aria-label={`Page ${page}`}
                                    aria-current={currentPage === page ? 'page' : undefined}
                                >
                                    {page}
                                </button>
                            ),
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={navBtnClass}
                        title="Next page"
                        aria-label="Next page"
                    >
                        <ChevronRight size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className={navBtnClass}
                        title="Last page"
                        aria-label="Last page"
                    >
                        <ChevronsRight size={15} />
                    </button>
                </div>

                {/* Limit + jump */}
                <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
                    {handleLimitChange && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 sm:text-sm">
                                Rows
                            </span>
                            <SelectField
                                options={limitOptions}
                                value={limitOptions.find((option) => option.value === itemsPerPage)}
                                onChange={(selected) => handleLimitChange(selected.value)}
                                isSearchable={false}
                                menuPlacement="top"
                                classNamePrefix="react-select"
                            />
                        </div>
                    )}

                    <form onSubmit={handleJump} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 sm:text-sm">
                            Page
                        </span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={jumpPage}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setJumpPage(val);
                            }}
                            className="h-10 w-14 rounded-2xl border border-slate-200 bg-white text-center text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            aria-label="Go to page"
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
                            of <span className="font-semibold text-slate-900 dark:text-slate-100">{totalPages}</span>
                        </span>
                    </form>
                </div>
            </div>
        </div>
    );
};

export const usePagination = (initialPage = 1, initialLimit = 20) => {
    const [pagination, setPagination] = useState({
        page: initialPage,
        limit: initialLimit,
        total: 0,
        total_pages: 1,
        is_last_page: true,
    });

    const updatePagination = useCallback((data) => {
        setPagination((prev) => {
            const page = data.page || prev.page;
            const limit = data.limit || prev.limit;
            const total = data.total ?? prev.total;
            const total_pages = data.total_pages || Math.ceil(total / limit) || 1;
            return {
                page,
                limit,
                total,
                total_pages,
                is_last_page: data.is_last_page ?? page >= total_pages,
            };
        });
    }, []);

    const goToPage = useCallback((page) => {
        setPagination((prev) => ({ ...prev, page }));
    }, []);

    const changeLimit = useCallback((limit) => {
        setPagination((prev) => ({ ...prev, limit, page: 1 }));
    }, []);

    const resetPagination = useCallback(() => {
        setPagination({
            page: initialPage,
            limit: initialLimit,
            total: 0,
            total_pages: 1,
            is_last_page: true,
        });
    }, [initialPage, initialLimit]);

    return { pagination, updatePagination, goToPage, changeLimit, resetPagination };
};

export default Pagination;
