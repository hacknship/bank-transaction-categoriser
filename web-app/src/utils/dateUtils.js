/**
 * Timezone-safe date utilities for budget tracking.
 * After the DATE column migration, the API returns plain "YYYY-MM-DD" strings.
 * The ISO timestamp branch is kept as a fallback for any legacy data.
 */

/**
 * Parses a date string into a safe local Date object.
 * Handles both plain "YYYY-MM-DD" and ISO timestamps "YYYY-MM-DDTHH:mm:ss.sssZ".
 */
export const parseISO = (dateStr) => {
    if (!dateStr) return null;
    // If it's a full ISO timestamp (with T and timezone), parse it and extract local date
    if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    // Plain date string like "2026-03-01" — treat as local date (primary path after migration)
    const [year, month, day] = dateStr.split('-').map(Number);
    if (isNaN(year) || isNaN(month)) return null;
    return new Date(year, month - 1, day || 1);
};

/**
 * Formats a date into "Month 'YY" (e.g., Feb '26)
 */
export const formatBudgetMonth = (dateStr) => {
    if (!dateStr) return '-';
    const date = parseISO(dateStr);
    if (!date) return dateStr;

    const month = date.toLocaleDateString('en-MY', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    return `${month} '${year}`;
};

/**
 * Formats a date into "D Month YYYY" (e.g., 2 March 2026)
 */
export const formatFullDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = parseISO(dateStr);
    if (!date) return dateStr;

    return date.toLocaleDateString('en-MY', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

/**
 * Returns YYYY-MM for robust comparison
 */
export const getYearMonth = (dateStr) => {
    const date = parseISO(dateStr);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Returns MM/YYYY for input defaults
 */
export const formatMMYYYY = (dateStr) => {
    const date = parseISO(dateStr);
    if (!date) return '';
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

/**
 * Parses MM/YYYY string into a YYYY-MM-01 date string
 */
export const parseMMYYYY = (val) => {
    if (!val) return null;
    const parts = val.split('/');
    if (parts.length !== 2) return null;
    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return null;
    return `${year}-${String(month).padStart(2, '0')}-01`;
};
