export const RECEIVABLE_STATUS = {
    PAID: 'paid',
    PARTIAL: 'partial',
    OVERDUE: 'overdue',
    UNPAID: 'unpaid',
} as const;

export type ReceivableStatus = typeof RECEIVABLE_STATUS[keyof typeof RECEIVABLE_STATUS];

function parseDateOnly(date: string | null | undefined) {
    if (!date) return null;
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function todayDateOnly() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function calculateReceivableStatus(
    paidPeriod: number,
    payablePeriod: number,
    dueDateStr: string | null | undefined,
    today = todayDateOnly()
): ReceivableStatus {
    const paid = Number.isFinite(paidPeriod) ? paidPeriod : 0;
    const payable = Number.isFinite(payablePeriod) ? payablePeriod : 0;
    const due = parseDateOnly(dueDateStr);
    const isOverdue = !!due && due.getTime() < today.getTime();

    if (payable <= 0) return paid > 0 ? RECEIVABLE_STATUS.PAID : RECEIVABLE_STATUS.UNPAID;
    if (paid >= payable - 0.01) return RECEIVABLE_STATUS.PAID;
    if (paid > 0) return isOverdue ? RECEIVABLE_STATUS.OVERDUE : RECEIVABLE_STATUS.PARTIAL;
    return isOverdue ? RECEIVABLE_STATUS.OVERDUE : RECEIVABLE_STATUS.UNPAID;
}

export function getRemainingReceivableAmount(payablePeriod: number, paidPeriod: number) {
    const payable = Number.isFinite(payablePeriod) ? payablePeriod : 0;
    const paid = Number.isFinite(paidPeriod) ? paidPeriod : 0;
    return Math.max(0, payable - paid);
}
