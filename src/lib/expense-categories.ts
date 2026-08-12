export const EXPENSE_CATEGORIES = [
    '办公用品费',
    '水费',
    '电费',
    '交通费',
    '汽油费',
    '物业费',
    '汽车费',
    '社保费',
    '兼职工资',
    '外包代办费',
    '招待费',
    '差旅费',
    '房租',
    '通讯费',
    '软件服务费',
    '快递物流费',
    '培训费',
    '税费',
    '银行手续费',
    '其他',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export function normalizeExpenseCategory(category: unknown) {
    return typeof category === 'string' ? category.trim() : '';
}

export function isValidExpenseCategory(category: unknown): category is ExpenseCategory {
    return EXPENSE_CATEGORIES.includes(normalizeExpenseCategory(category) as ExpenseCategory);
}
