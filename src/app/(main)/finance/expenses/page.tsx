'use client';

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Search, CheckCircle2, X, Calendar, Banknote, FileText, Loader2,
    ImagePlus, Image as ImageIcon, Trash2, CreditCard, Tag, Building2, ClipboardList,
    AlertCircle, ExternalLink, History
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// Compress an image File to JPEG via Canvas
async function compressImage(file: File, maxW = 1200, quality = 0.75): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const ratio = Math.min(1, maxW / img.width);
            const w = Math.round(img.width * ratio);
            const h = Math.round(img.height * ratio);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('压缩失败'));
            }, 'image/jpeg', quality);
        };
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = url;
    });
}

type Customer = {
    id: string;
    company_name: string;
    contact_person: string | null;
    contact_info: string | null;
};

const EXPENSE_CATEGORIES = ['办公费', '交通费', '社保公积金', '工资', '税费', '外包服务费', '其他'];
const PAYMENT_METHODS = ['转账', '微信支付', '支付宝', '现金', '银行汇款', '其他'];

function formatCurrency(val: number | null | undefined) {
    if (val == null) return '¥0.00';
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
}

// ─── Entry Tab Content ───────────────────────────────────────────────────
function ExpenseEntryContent() {
    const searchParams = useSearchParams();
    const initCustomerName = searchParams.get('customer_name');

    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('办公费');
    const [expenseType, setExpenseType] = useState('');
    const [vendorName, setVendorName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('转账');
    const [note, setNote] = useState('');

    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const hasAutoFilled = useRef(false);
    useEffect(() => {
        if (initCustomerName && !hasAutoFilled.current) {
            hasAutoFilled.current = true;
            setCustomerLoading(true);
            setCustomerSearch(initCustomerName);
            fetch(`/api/customers?search=${encodeURIComponent(initCustomerName)}&limit=10&include_churned=false`)
                .then(res => res.json())
                .then(json => {
                    const list: Customer[] = json.data || [];
                    const exactMatch = list.find(c => c.company_name === initCustomerName);
                    if (exactMatch) selectCustomer(exactMatch);
                    else if (list.length > 0) { setCustomerResults(list); setShowDropdown(true); }
                })
                .catch(err => console.error(err))
                .finally(() => setCustomerLoading(false));
        }
    }, [initCustomerName]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleCustomerSearch = (value: string) => {
        setCustomerSearch(value);
        setShowDropdown(true);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        if (!value.trim()) { setCustomerResults([]); return; }
        searchDebounce.current = setTimeout(async () => {
            setCustomerLoading(true);
            try {
                const res = await fetch(`/api/customers?search=${encodeURIComponent(value)}&limit=8&include_churned=false`);
                const json = await res.json();
                setCustomerResults(json.data || []);
            } catch { setCustomerResults([]); }
            finally { setCustomerLoading(false); }
        }, 300);
    };

    const selectCustomer = (c: Customer) => { setSelectedCustomer(c); setCustomerSearch(c.company_name); setShowDropdown(false); };
    const clearCustomer = () => { setSelectedCustomer(null); setCustomerSearch(''); setCustomerResults([]); };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAttachmentPreview(URL.createObjectURL(file));
        setAttachmentFile(file);
    };

    const clearAttachment = () => {
        if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
        setAttachmentFile(null);
        setAttachmentPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const amountNum = parseFloat(expenseAmount) || 0;

    const canSubmit = useMemo(() => {
        if (!expenseDate) return false;
        if (amountNum <= 0) return false;
        if (!expenseCategory) return false;
        return true;
    }, [expenseDate, amountNum, expenseCategory]);

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setSubmitError(null);
        let attachmentUrl: string | null = null;

        try {
            if (attachmentFile) {
                setUploading(true);
                try {
                    const compressed = await compressImage(attachmentFile);
                    const folder = selectedCustomer ? selectedCustomer.id : 'general';
                    const filename = `${folder}/${Date.now()}.jpg`;
                    const supabase = createClient();
                    const { error: uploadError } = await supabase.storage
                        .from('expense-attachments')
                        .upload(filename, compressed, { contentType: 'image/jpeg', upsert: false });
                    if (uploadError) throw new Error(`附件上传失败: ${uploadError.message}`);
                    const { data: urlData } = supabase.storage
                        .from('expense-attachments')
                        .getPublicUrl(filename);
                    attachmentUrl = urlData.publicUrl;
                } finally {
                    setUploading(false);
                }
            }

            const payload = {
                customer_id: selectedCustomer?.id || null,
                expense_date: expenseDate,
                expense_amount: parseFloat(expenseAmount),
                expense_category: expenseCategory,
                expense_type: expenseType || null,
                vendor_name: vendorName || null,
                payment_method: paymentMethod || null,
                note: note || null,
                attachment: attachmentUrl,
            };

            const res = await fetch('/api/finance/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || json.error) { setSubmitError(json.error || '提交失败，请重试'); return; }

            setSubmitSuccess(true);
            setExpenseAmount('');
            setExpenseType('');
            setVendorName('');
            setNote('');
            clearAttachment();
        } catch (e: any) {
            setSubmitError(e?.message || '提交失败，请重试');
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    };

    const resetAll = () => {
        clearCustomer();
        setExpenseDate(new Date().toISOString().split('T')[0]);
        setExpenseAmount('');
        setExpenseCategory('办公费');
        setExpenseType('');
        setVendorName('');
        setPaymentMethod('转账');
        setNote('');
        clearAttachment();
        setSubmitError(null);
        setSubmitSuccess(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: Form */}
            <div className="lg:col-span-2 space-y-5">

                {/* Customer Search (Optional) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">A</div>
                        <h2 className="text-sm font-semibold text-slate-800">关联客户</h2>
                        <span className="ml-auto text-xs text-slate-400">选填 · 可直接跳过</span>
                    </div>
                    <div className="p-5">
                        <div className="relative" ref={dropdownRef}>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        {customerLoading
                                            ? <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                                            : <Search className="h-4 w-4 text-slate-400" />}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="搜索公司名称（选填）..."
                                        className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-4 text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-600 sm:text-sm transition-all"
                                        value={customerSearch}
                                        onChange={e => handleCustomerSearch(e.target.value)}
                                        onFocus={() => setShowDropdown(true)}
                                    />
                                </div>
                                {selectedCustomer && (
                                    <button onClick={clearCustomer} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {showDropdown && customerSearch && customerResults.length > 0 && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                                    {customerResults.map(c => (
                                        <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-violet-50 transition-colors flex items-center justify-between group" onClick={() => selectCustomer(c)}>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700">{c.company_name}</p>
                                                {c.contact_person && <p className="text-xs text-slate-500 mt-0.5">{c.contact_person}</p>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showDropdown && customerSearch && !customerLoading && customerResults.length === 0 && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">未找到相关客户</div>
                            )}
                        </div>

                        {selectedCustomer && (
                            <div className="mt-4 flex items-center gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                                <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{selectedCustomer.company_name[0]}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-violet-900 truncate">{selectedCustomer.company_name}</p>
                                    {selectedCustomer.contact_person && <p className="text-xs text-violet-700 mt-0.5">{selectedCustomer.contact_person}</p>}
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-violet-500 flex-shrink-0" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Expense Form */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">B</div>
                        <h2 className="text-sm font-semibold text-slate-800">填写费用信息</h2>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-slate-400" /> 费用日期 <span className="text-red-500">*</span>
                            </label>
                            <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 transition-colors text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Banknote className="w-4 h-4 text-slate-400" /> 费用金额 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">¥</span>
                                <input type="number" min="0" step="0.01" placeholder="输入费用金额" value={expenseAmount}
                                    onChange={e => { setExpenseAmount(e.target.value); setSubmitError(null); setSubmitSuccess(false); }}
                                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 transition-colors text-sm font-mono" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Tag className="w-4 h-4 text-slate-400" /> 费用类别 <span className="text-red-500">*</span>
                            </label>
                            <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 bg-white transition-colors text-sm">
                                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <ClipboardList className="w-4 h-4 text-slate-400" /> 费用类型
                            </label>
                            <input type="text" placeholder="如：打印耗材、出租车费（选填）" value={expenseType} onChange={e => setExpenseType(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 transition-colors text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-slate-400" /> 供应商名称
                            </label>
                            <input type="text" placeholder="供应商 / 收款方（选填）" value={vendorName} onChange={e => setVendorName(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 transition-colors text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-slate-400" /> 付款方式
                            </label>
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 bg-white transition-colors text-sm">
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-slate-400" /> 备注
                            </label>
                            <textarea placeholder="费用备注说明（选填）" value={note} onChange={e => setNote(e.target.value)} rows={2}
                                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 transition-colors text-sm resize-none" />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <ImageIcon className="w-4 h-4 text-slate-400" /> 附件凭证
                            </label>
                            {!attachmentPreview ? (
                                <label className="flex items-center justify-center gap-2 py-5 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all text-sm text-slate-500">
                                    <ImagePlus className="w-5 h-5 text-slate-400" />
                                    <span>点击上传凭证图片（选填）</span>
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                            ) : (
                                <div className="relative inline-block">
                                    <img src={attachmentPreview} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-slate-200" />
                                    <button onClick={clearAttachment} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: Preview + Submit */}
            <div className="space-y-5">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
                    <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50">
                        <h3 className="text-sm font-semibold text-violet-900 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-violet-500" /> 录入预览
                        </h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs text-slate-500">关联客户</span>
                            <span className="text-sm font-medium text-slate-800 truncate max-w-[160px]">{selectedCustomer ? selectedCustomer.company_name : '未关联'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs text-slate-500">费用日期</span>
                            <span className="text-sm font-medium text-slate-800">{expenseDate || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs text-slate-500">费用金额</span>
                            <span className="text-lg font-bold text-violet-700 font-mono">{formatCurrency(amountNum || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs text-slate-500">费用类别</span>
                            <span className="text-sm font-medium text-slate-800">{expenseCategory}</span>
                        </div>
                        {expenseType && (
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                <span className="text-xs text-slate-500">费用类型</span>
                                <span className="text-sm text-slate-700 truncate max-w-[160px]">{expenseType}</span>
                            </div>
                        )}
                        {vendorName && (
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                <span className="text-xs text-slate-500">供应商</span>
                                <span className="text-sm text-slate-700 truncate max-w-[160px]">{vendorName}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs text-slate-500">付款方式</span>
                            <span className="text-sm text-slate-700">{paymentMethod}</span>
                        </div>
                        {note && (
                            <div className="flex justify-between items-start py-2">
                                <span className="text-xs text-slate-500">备注</span>
                                <span className="text-sm text-slate-600 text-right max-w-[160px] break-words">{note}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitting}
                        className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm ${canSubmit && !submitting
                            ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 hover:shadow-md active:scale-[0.98]'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {submitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {uploading ? '上传附件中...' : '提交中...'}
                            </span>
                        ) : '提交成本记录'}
                    </button>
                    <button onClick={resetAll} className="px-5 py-3 rounded-xl font-semibold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">重置</button>
                </div>

                {submitError && (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-sm text-red-600 flex items-center gap-2 animate-in fade-in duration-200">
                        <X className="w-4 h-4 flex-shrink-0" /> {submitError}
                    </div>
                )}

                {submitSuccess && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-sm text-emerald-700 flex items-center gap-2 animate-in fade-in duration-200">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <p className="font-semibold">成本记录已成功提交！</p>
                            <p className="text-xs mt-0.5 text-emerald-600">您可以继续录入下一条记录，或切换到历史记录查看。</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── History Tab Content ───────────────────────────────────────────────────
function ExpenseHistoryContent() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [role, setRole] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const limit = 20;

    useEffect(() => { fetchData(); }, [page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/finance/expenses/history?page=${page}&limit=${limit}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json.data || []);
            setCount(json.count || 0);
            setRole(json.role);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('确定要删除这条成本记录吗？\n此操作不可撤销。')) return;
        setDeleteLoading(id);
        try {
            const res = await fetch(`/api/finance/expenses/history?id=${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(prev => prev.filter(item => item.id !== id));
            setCount(prev => prev - 1);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setDeleteLoading(null);
        }
    };

    const categoryColors: Record<string, { bg: string; text: string }> = {
        '办公费': { bg: 'bg-blue-50', text: 'text-blue-600' },
        '交通费': { bg: 'bg-cyan-50', text: 'text-cyan-600' },
        '社保公积金': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
        '工资': { bg: 'bg-indigo-50', text: 'text-indigo-600' },
        '税费': { bg: 'bg-amber-50', text: 'text-amber-600' },
        '外包服务费': { bg: 'bg-purple-50', text: 'text-purple-600' },
        '其他': { bg: 'bg-slate-100', text: 'text-slate-600' },
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">日期</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">客户</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">金额</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">类别</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">类型</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">供应商</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">付款方式</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">凭证</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider w-20">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 relative">
                            {loading ? (
                                <tr><td colSpan={9} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto" /><p className="text-slate-400 mt-2">加载数据中...</p></td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={9} className="py-20 text-center text-slate-500">暂无成本记录</td></tr>
                            ) : (
                                data.map((item) => {
                                    const catColor = categoryColors[item.expense_category] || categoryColors['其他'];
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-4 text-slate-500 whitespace-nowrap text-center">{item.expense_date}</td>
                                            <td className="py-4 px-4 font-medium text-slate-900 text-center">{item.customers?.company_name || <span className="text-slate-400">-</span>}</td>
                                            <td className="py-4 px-4 text-center font-bold text-red-600 font-mono">{formatCurrency(item.expense_amount)}</td>
                                            <td className="py-4 px-4 text-center"><span className={`px-2 py-1 rounded text-xs font-semibold ${catColor.bg} ${catColor.text}`}>{item.expense_category}</span></td>
                                            <td className="py-4 px-4 text-slate-600 text-center">{item.expense_type || <span className="text-slate-300">-</span>}</td>
                                            <td className="py-4 px-4 text-slate-600 text-center">{item.vendor_name || <span className="text-slate-300">-</span>}</td>
                                            <td className="py-4 px-4 text-slate-600 text-center">{item.payment_method || <span className="text-slate-300">-</span>}</td>
                                            <td className="py-4 px-4 text-center">
                                                {item.attachment ? (
                                                    <button onClick={() => setPreviewImage(item.attachment)} className="p-1.5 bg-slate-100 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all mx-auto" title="查看凭证">
                                                        <ImageIcon className="w-4 h-4" />
                                                    </button>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {role === 'admin' && (
                                                    <button onClick={() => handleDelete(item.id)} disabled={deleteLoading === item.id} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="删除记录">
                                                        {deleteLoading === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {count > limit && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <div className="text-sm text-slate-500">共 {count} 条记录</div>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">上一页</button>
                            <span className="px-3 py-1 text-sm font-medium">第 {page} 页</span>
                            <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= count} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">下一页</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-violet-500" /> 费用凭证预览</h3>
                            <button onClick={() => setPreviewImage(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50/50">
                            <img src={previewImage} alt="Expense Attachment" className="max-w-full h-auto object-contain rounded-lg" />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                            <a href={previewImage} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all"><ExternalLink className="w-4 h-4" /> 查看原图</a>
                            <button onClick={() => setPreviewImage(null)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-all border border-slate-200">关闭</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page with Tabs ───────────────────────────────────────────────────
export default function ExpensePage() {
    const [activeTab, setActiveTab] = useState<'entry' | 'history'>('entry');

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">成本记录</h1>
                    <p className="text-sm text-slate-500 mt-1">录入公司运营成本及费用支出，或查看成本历史明细。</p>
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('entry')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'entry'
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        成本录入
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'history'
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        历史记录
                    </button>
                </div>
            </div>

            {activeTab === 'entry' ? (
                <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>}>
                    <ExpenseEntryContent />
                </Suspense>
            ) : (
                <ExpenseHistoryContent />
            )}
        </div>
    );
}
