'use client';

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Search, CheckCircle2, AlertCircle, Wallet, TrendingDown, ChevronRight, ChevronDown,
    X, CreditCard, Calendar, Banknote, FileText, Loader2, CircleDot,
    ImagePlus, Image as ImageIcon, Trash2, RefreshCw
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { MaskedContact } from '@/components/ui/MaskedContact';

// Compress an image File to JPEG via Canvas, max width 1200px, quality 0.75
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

// Add N months to a YYYY-MM-DD string
function addMonths(dateStr: string, n: number): string {
    if (!dateStr || !n) return dateStr;
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + n);
    return d.toISOString().split('T')[0];
}

// --- Types ---
type Customer = {
    id: string;
    company_name: string;
    contact_person: string | null;
    contact_info: string | null;
    service_manager: string | null;
};

type Receivable = {
    id: string;
    customer_id: string;
    billing_fee_month: number | null;
    pay_cycle_months: number | null;
    amount_payable_period: number;
    amount_paid_period: number | null;
    payment_due_date: string;
    contract_end_date: string | null;
    has_contract: boolean | null;
    standard_price: number | null;
    discount_gap: number | null;
    status: string;
    receipt_note?: string | null;
};

type RenewalFields = {
    has_contract: boolean;
    contract_end_date: string;
    payment_due_date: string;
    pay_cycle_months: number;
    billing_fee_month: number;
    amount_payable_period: number;
    standard_price: number;
    discount_gap: number;
};

const RENEWAL_FIELD_LABELS: Record<keyof RenewalFields, string> = {
    has_contract: '是否有合同',
    contract_end_date: '合同截止日期',
    payment_due_date: '下次收款日',
    pay_cycle_months: '付款周期(月)',
    billing_fee_month: '月收费金额',
    amount_payable_period: '下期应收金额',
    standard_price: '标准价格',
    discount_gap: '优惠差额',
};

const PAYMENT_METHODS = ['转账', '微信支付', '支付宝', '现金', '银行汇款', '其他'];

function formatCurrency(val: number | null | undefined) {
    if (val == null) return '¥0.00';
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
}

function formatDate(d: string | null) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('zh-CN');
}

function isOverdue(dateStr: string | null) {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
}

function calcDerivedStatus(paid: number, payable: number, dueDate: string) {
    if (paid >= payable && payable > 0) return { label: '已付清', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (paid > 0 && paid < payable) {
        if (isOverdue(dueDate)) return { label: '部分-逾期', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { label: '部分付款', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
    if (isOverdue(dueDate)) return { label: '未付-逾期', color: 'text-red-600', bg: 'bg-red-50' };
    return { label: '未付款', color: 'text-amber-600', bg: 'bg-amber-50' };
}

function PaymentEntryContent() {
    const searchParams = useSearchParams();
    const initCustomerName = searchParams.get('customer_name');
    const taskId = searchParams.get('task_id');
    const router = useRouter();

    // Step A: Customer selection
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Step B: Receivable selection
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [receivablesLoading, setReceivablesLoading] = useState(false);
    const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);

    // Step C: Payment form & Mode
    const [isAdHoc, setIsAdHoc] = useState(false);
    const [adHocServiceName, setAdHocServiceName] = useState('');
    const [paidAt, setPaidAt] = useState(() => new Date().toISOString().split('T')[0]);
    const [paidAmount, setPaidAmount] = useState('');
    const [method, setMethod] = useState('转账');
    const [note, setNote] = useState('');
    const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step E: Renewal confirmation
    const [renewal, setRenewal] = useState<RenewalFields | null>(null);
    const [changeReasons, setChangeReasons] = useState<Partial<Record<keyof RenewalFields, string>>>({});

    // Submission state
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [showAdjustment, setShowAdjustment] = useState(false);
    const [discountedPayable, setDiscountedPayable] = useState<number | null>(null);
    const [discountReason, setDiscountReason] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    // Initialize renewal defaults when receivable changes
    useEffect(() => {
        if (selectedReceivable) {
            const nextDueDate = addMonths(selectedReceivable.payment_due_date, selectedReceivable.pay_cycle_months || 1);
            const nextContractEnd = selectedReceivable.contract_end_date
                ? addMonths(selectedReceivable.contract_end_date, selectedReceivable.pay_cycle_months || 1)
                : '';

            if (selectedCustomer) {
                setRenewal({
                    has_contract: selectedReceivable.has_contract || false,
                    contract_end_date: nextContractEnd,
                    payment_due_date: nextDueDate,
                    pay_cycle_months: selectedReceivable.pay_cycle_months || 1,
                    amount_payable_period: (selectedReceivable.billing_fee_month || 0) * (selectedReceivable.pay_cycle_months || 1),
                    billing_fee_month: selectedReceivable.billing_fee_month || 0,
                    standard_price: selectedReceivable.standard_price || 0,
                    discount_gap: selectedReceivable.discount_gap || 0,
                });
            }
            setDiscountedPayable(selectedReceivable.amount_payable_period);
            setDiscountReason('');
            setChangeReasons({});
            setShowAdjustment(false);
        } else {
            setRenewal(null);
            setDiscountedPayable(null);
            setDiscountReason('');
            setChangeReasons({});
            setShowAdjustment(false);
        }
    }, [selectedReceivable]);

    // Auto-fill from URL params
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
                    if (exactMatch) {
                        selectCustomer(exactMatch);
                    } else if (list.length > 0) {
                        setCustomerResults(list);
                        setShowDropdown(true);
                    }
                })
                .catch(err => console.error(err))
                .finally(() => setCustomerLoading(false));
        }
    }, [initCustomerName]);

    // Compute which fields have actually changed from original
    const changedFields = useMemo((): (keyof RenewalFields)[] => {
        if (!renewal || !selectedReceivable) return [];
        const changed: (keyof RenewalFields)[] = [];
        if (renewal.has_contract !== (selectedReceivable.has_contract ?? false)) changed.push('has_contract');
        const autoNext = addMonths(selectedReceivable.payment_due_date, renewal.pay_cycle_months);
        if (renewal.payment_due_date && renewal.payment_due_date !== autoNext) changed.push('payment_due_date');

        const autoContractEnd = selectedReceivable.contract_end_date
            ? addMonths(selectedReceivable.contract_end_date, renewal.pay_cycle_months)
            : '';
        if (renewal.contract_end_date !== autoContractEnd) changed.push('contract_end_date');

        if (renewal.pay_cycle_months !== (selectedReceivable.pay_cycle_months || 1)) changed.push('pay_cycle_months');
        if (renewal.billing_fee_month !== Number(selectedReceivable.billing_fee_month || 0)) changed.push('billing_fee_month');
        if (renewal.amount_payable_period !== Number(selectedReceivable.amount_payable_period || 0)) changed.push('amount_payable_period');
        if (renewal.standard_price !== Number(selectedReceivable.standard_price || 0)) changed.push('standard_price');
        if (renewal.discount_gap !== Number(selectedReceivable.discount_gap || 0)) changed.push('discount_gap');
        return changed;
    }, [renewal, selectedReceivable]);

    const renewalValid = changedFields.every(f => f === 'amount_payable_period' || !!changeReasons[f]?.trim());
    const updateRenewal = <K extends keyof RenewalFields>(key: K, val: RenewalFields[K]) => {
        if (!renewal) return;
        const next = { ...renewal, [key]: val };

        // Auto calculate amount_payable_period if billing_fee_month or pay_cycle_months changes
        if (key === 'billing_fee_month' || key === 'pay_cycle_months') {
            next.amount_payable_period = Math.round((next.billing_fee_month || 0) * (next.pay_cycle_months || 1) * 100) / 100;
        }

        setRenewal(next);
    };

    const updateReason = (key: keyof RenewalFields, val: string) => {
        setChangeReasons(prev => ({ ...prev, [key]: val }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setScreenshotPreview(URL.createObjectURL(file));
        setScreenshotFile(file);
    };

    const clearScreenshot = () => {
        if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
        setScreenshotFile(null);
        setScreenshotPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Search customers
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

    const selectCustomer = async (c: Customer) => {
        setSelectedCustomer(c);
        setCustomerSearch(c.company_name);
        setShowDropdown(false);
        setSelectedReceivable(null);
        setPaidAmount('');
        setSubmitError(null);
        setSubmitSuccess(false);

        setReceivablesLoading(true);
        try {
            const res = await fetch(`/api/finance/payment/receivables?customer_id=${c.id}`);
            const json = await res.json();
            const list: Receivable[] = json.data || [];
            setReceivables(list);
            const preselect = list.find(r => {
                const rem = Number(r.amount_payable_period) - Number(r.amount_paid_period || 0);
                return rem > 0;
            });
            setSelectedReceivable(preselect || null);
        } catch { setReceivables([]); }
        finally { setReceivablesLoading(false); }
    };

    const clearCustomer = () => {
        setSelectedCustomer(null);
        setCustomerSearch('');
        setCustomerResults([]);
        setReceivables([]);
        setSelectedReceivable(null);
        setPaidAmount('');
        setSubmitError(null);
        setSubmitSuccess(false);
        setIsAdHoc(false);
        setAdHocServiceName('');
        clearScreenshot();
    };

    // Preview values
    const payable = discountedPayable ?? (selectedReceivable?.amount_payable_period || 0);
    const paidSoFar = Number(selectedReceivable?.amount_paid_period || 0);
    const amountNum = parseFloat(paidAmount) || 0;
    const remaining = Math.max(0, payable - paidSoFar); // current unpaid balance for THIS period
    const afterPaid = paidSoFar + amountNum;
    const afterRemaining = Math.max(0, payable - afterPaid);
    const afterStatus = selectedReceivable
        ? calcDerivedStatus(afterPaid, payable, selectedReceivable.payment_due_date)
        : null;

    const discountValid = discountedPayable === (selectedReceivable?.amount_payable_period || 0) || !!discountReason.trim();

    const canSubmit = useMemo(() => {
        if (!selectedCustomer) return false;
        if (!paidAt) return false;
        if (amountNum <= 0) return false;

        if (isAdHoc) {
            if (!adHocServiceName.trim()) return false;
            return true;
        } else {
            if (!selectedReceivable) return false;
            // Use current payable for limit check
            if (amountNum > remaining + 0.01) return false;
            if (!renewalValid) return false;
            if (!discountValid) return false;
            return true;
        }
    }, [selectedCustomer, isAdHoc, adHocServiceName, selectedReceivable, paidAt, amountNum, renewalValid, remaining, discountValid]);

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setSubmitError(null);
        let screenshotUrl: string | null = null;

        try {
            if (screenshotFile) {
                setUploading(true);
                try {
                    const compressed = await compressImage(screenshotFile);
                    const filename = `${selectedCustomer!.id}/${Date.now()}.jpg`;
                    const supabase = createClient();
                    const { error: uploadError } = await supabase.storage
                        .from('payment-screenshots')
                        .upload(filename, compressed, { contentType: 'image/jpeg', upsert: false });
                    if (uploadError) throw new Error(`图片上传失败: ${uploadError.message}`);
                    const { data: urlData } = supabase.storage
                        .from('payment-screenshots')
                        .getPublicUrl(filename);
                    screenshotUrl = urlData.publicUrl;
                } finally {
                    setUploading(false);
                }
            }

            const payload: any = {
                customer_id: selectedCustomer!.id,
                paid_at: paidAt,
                paid_amount: parseFloat(paidAmount),
                method: method || null,
                note: note || null,
                screenshot: screenshotUrl,
                is_ad_hoc: isAdHoc,
            };

            if (isAdHoc) {
                payload.ad_hoc_service_name = adHocServiceName;
            } else {
                payload.receivable_id = selectedReceivable!.id;
                payload.discounted_payable = discountedPayable;
                payload.discount_reason = discountReason;

                // Determine if we should send renewal info
                const targetPayable = discountedPayable !== null ? discountedPayable : selectedReceivable!.amount_payable_period;
                const paidSoFar = selectedReceivable!.amount_paid_period || 0;
                const remainingToPay = targetPayable - paidSoFar;
                const isFinishing = (parseFloat(paidAmount) || 0) >= remainingToPay - 0.01;

                if (isFinishing || changedFields.length > 0) {
                    payload.renewal = {
                        has_contract: renewal!.has_contract,
                        contract_end_date: renewal!.contract_end_date || null,
                        payment_due_date: renewal!.payment_due_date || null,
                        pay_cycle_months: renewal!.pay_cycle_months,
                        billing_fee_month: renewal!.billing_fee_month,
                        amount_payable_period: renewal!.amount_payable_period,
                        standard_price: renewal!.standard_price,
                        discount_gap: renewal!.discount_gap,
                    };

                    // Auto-fill change reasons for fields that have advanced but weren't manually changed
                    const enhancedReasons = { ...changeReasons } as any;
                    (['has_contract', 'contract_end_date', 'payment_due_date', 'pay_cycle_months', 'billing_fee_month', 'amount_payable_period', 'standard_price', 'discount_gap'] as const).forEach(field => {
                        if (changedFields.includes(field as any)) {
                            if (!enhancedReasons[field]) {
                                enhancedReasons[field] = '系统自动顺延';
                            }
                        }
                    });
                    payload.change_reasons = enhancedReasons;
                }
            }

            const res = await fetch('/api/finance/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || json.error) {
                setSubmitError(json.error || '提交失败，请重试');
                return;
            }

            // Auto complete collection task if taskId is provided
            if (taskId) {
                try {
                    await fetch(`/api/finance/collection-tasks/${taskId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'completed' }),
                    });
                } catch (e) {
                    console.error('Failed to auto-complete task', e);
                }
            }

            setSubmitSuccess(true);
            clearScreenshot();
            const r2 = await fetch(`/api/finance/payment/receivables?customer_id=${selectedCustomer!.id}`);
            const j2 = await r2.json();
            const list: Receivable[] = j2.data || [];
            setReceivables(list);
            const updated = list.find(r => r.id === selectedReceivable!.id) || null;
            setSelectedReceivable(updated);
            setPaidAmount('');
            setNote('');
        } catch (e: any) {
            setSubmitError(e?.message || '提交失败，请重试');
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">收款录入</h1>
                <p className="text-sm text-slate-500 mt-1">选择客户和账单，录入收款信息，系统自动更新账单状态。</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT: Customer + Form */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Step A: Customer Search */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">A</div>
                            <h2 className="text-sm font-semibold text-slate-800">选择客户</h2>
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
                                            placeholder="搜索公司名称..."
                                            className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-4 text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 sm:text-sm transition-all"
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
                                            <button
                                                key={c.id}
                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                                                onClick={() => selectCustomer(c)}
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{c.company_name}</p>
                                                    {(c.contact_person || c.contact_info) && (
                                                        <div className="text-xs text-slate-500 mt-0.5 flex gap-1">
                                                            {c.contact_person && <span>{c.contact_person}</span>}
                                                            {c.contact_person && c.contact_info && <span>·</span>}
                                                            {c.contact_info && <MaskedContact contact={c.contact_info} />}
                                                        </div>
                                                    )}
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showDropdown && customerSearch && !customerLoading && customerResults.length === 0 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                                        未找到相关客户
                                    </div>
                                )}
                            </div>

                            {selectedCustomer && (
                                <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        {selectedCustomer.company_name[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-blue-900 truncate">{selectedCustomer.company_name}</p>
                                        <p className="text-xs text-blue-700 mt-0.5 flex gap-1 items-center">
                                            {selectedCustomer.contact_person && <span>{selectedCustomer.contact_person}</span>}
                                            {selectedCustomer.contact_person && selectedCustomer.contact_info && <span>·</span>}
                                            {selectedCustomer.contact_info && <MaskedContact contact={selectedCustomer.contact_info} className="!text-blue-700" iconClassName="w-3.5 h-3.5 !text-blue-500" />}
                                            {selectedCustomer.contact_info && selectedCustomer.service_manager && <span>·</span>}
                                            {selectedCustomer.service_manager && <span>财务: {selectedCustomer.service_manager}</span>}
                                        </p>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mode Toggle */}
                    {selectedCustomer && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex gap-2">
                            <button
                                onClick={() => { setIsAdHoc(false); setSubmitError(null); }}
                                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${!isAdHoc ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                            >
                                <span className="font-semibold text-sm">常规账单收款</span>
                                <span className="text-xs mt-0.5 opacity-80">勾销已生成的财务应收</span>
                            </button>
                            <button
                                onClick={() => { setIsAdHoc(true); setSelectedReceivable(null); setSubmitError(null); }}
                                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${isAdHoc ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                            >
                                <span className="font-semibold text-sm">一次性项目收款</span>
                                <span className="text-xs mt-0.5 opacity-80">代办费、工本费等非周期临时入账</span>
                            </button>
                        </div>
                    )}

                    {/* Step B: Receivable selection (Hidden if AdHoc) */}
                    {selectedCustomer && !isAdHoc && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">B</div>
                                <h2 className="text-sm font-semibold text-slate-800">选择应收账单</h2>
                                <span className="ml-auto text-xs text-slate-400">点击行选择 · 自动预选最早未结清账单</span>
                            </div>
                            <div className="overflow-x-auto">
                                {receivablesLoading ? (
                                    <div className="flex justify-center items-center py-10">
                                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                                    </div>
                                ) : receivables.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-slate-500">该客户暂无应收账单</div>
                                ) : (
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                                <th className="w-8 py-3 pl-4 pr-2"></th>
                                                <th className="py-3 px-4 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">应付日期</th>
                                                <th className="py-3 px-4 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-widest">月收费</th>
                                                <th className="py-3 px-4 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-widest">本期应收</th>
                                                <th className="py-3 px-4 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-widest">已收</th>
                                                <th className="py-3 px-4 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-widest">未收</th>
                                                <th className="py-3 px-4 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">状态</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {receivables.map(r => {
                                                const rem = Number(r.amount_payable_period) - Number(r.amount_paid_period || 0);
                                                const st = calcDerivedStatus(Number(r.amount_paid_period || 0), Number(r.amount_payable_period), r.payment_due_date);
                                                const isSelected = selectedReceivable?.id === r.id;
                                                return (
                                                    <tr
                                                        key={r.id}
                                                        onClick={() => { setSelectedReceivable(r); setPaidAmount(''); setSubmitError(null); setSubmitSuccess(false); }}
                                                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                                                    >
                                                        <td className="py-3 pl-4 pr-2">
                                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                                                                {isSelected && <CircleDot className="w-2 h-2 text-white" />}
                                                            </div>
                                                        </td>
                                                        <td className={`py-3 px-4 font-medium flex items-center gap-2 ${isOverdue(r.payment_due_date) && rem > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                                            {formatDate(r.payment_due_date)}
                                                            {r.receipt_note && r.status === 'paid' && !r.billing_fee_month && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">一次性</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-slate-600 font-mono">
                                                            {r.billing_fee_month ? formatCurrency(r.billing_fee_month) : (
                                                                <span className="text-[11px] text-slate-400 truncate max-w-[100px] inline-block align-bottom">{r.receipt_note || '-'}</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-semibold text-slate-800 font-mono">{formatCurrency(r.amount_payable_period)}</td>
                                                        <td className="py-3 px-4 text-right text-emerald-600 font-mono">{formatCurrency(r.amount_paid_period)}</td>
                                                        <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">{formatCurrency(Math.max(0, rem))}</td>
                                                        <td className="py-3 px-4">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${st.color} ${st.bg}`}>
                                                                {st.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step C: Payment form */}
                    {selectedCustomer && (isAdHoc || selectedReceivable) && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold ${isAdHoc ? 'bg-amber-500' : 'bg-blue-600'}`}>C</div>
                                <h2 className="text-sm font-semibold text-slate-800">填写收款信息</h2>
                            </div>
                            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Ad Hoc Service Name (Only visible if AdHoc) */}
                                {isAdHoc && (
                                    <div className="sm:col-span-2 mb-2 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                        <label className="block text-sm font-medium text-amber-900 mb-1.5 flex items-center gap-1.5">
                                            <FileText className="w-4 h-4 text-amber-500" /> 服务项目名称 / 名目名称 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={adHocServiceName}
                                            onChange={e => { setAdHocServiceName(e.target.value); setSubmitError(null); }}
                                            placeholder="如：工商代办费、公章印制费"
                                            className="w-full rounded-xl border border-amber-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors text-sm"
                                        />
                                        <p className="mt-1.5 text-xs text-amber-700">提交后将自动在后台挂账一笔同名服务，并标记为已付清，保证账务完整对应。</p>
                                    </div>
                                )}

                                {/* Paid date */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-slate-400" /> 收款日期 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={paidAt}
                                        onChange={e => setPaidAt(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors text-sm"
                                    />
                                </div>

                                {/* Paid amount */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <Banknote className="w-4 h-4 text-slate-400" /> 收款金额 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">¥</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder={!isAdHoc ? `最多 ${remaining.toFixed(2)}` : '输入收款总额'}
                                            value={paidAmount}
                                            onChange={e => { setPaidAmount(e.target.value); setSubmitError(null); setSubmitSuccess(false); }}
                                            className={`w-full rounded-xl border py-2.5 pl-8 pr-3 text-slate-900 focus:outline-none focus:ring-2 transition-colors text-sm font-mono ${!isAdHoc && parseFloat(paidAmount || '0') > remaining + 0.01 ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-slate-200 focus:ring-blue-600'}`}
                                        />
                                    </div>
                                    {!isAdHoc && parseFloat(paidAmount || '0') > remaining + 0.01 && (
                                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" /> 超过未收金额 {formatCurrency(remaining)}
                                        </p>
                                    )}
                                    {!isAdHoc && (
                                        <button
                                            type="button"
                                            onClick={() => setPaidAmount(remaining.toFixed(2))}
                                            className="mt-1 text-xs text-blue-600 hover:underline"
                                        >
                                            填入全部未收金额 ({formatCurrency(remaining)})
                                        </button>
                                    )}
                                </div>

                                {/* Method */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <CreditCard className="w-4 h-4 text-slate-400" /> 收款方式
                                    </label>
                                    <select
                                        value={method}
                                        onChange={e => setMethod(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white transition-colors text-sm"
                                    >
                                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>

                                {/* Note */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FileText className="w-4 h-4 text-slate-400" /> 备注
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="收款备注（选填）"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors text-sm"
                                    />
                                </div>
                            </div>

                            {/* Negotiation / Price Adjustment (Moved from Step E) */}
                            {!isAdHoc && selectedReceivable && renewal && (
                                <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-4">
                                    <div
                                        className="flex items-center justify-between cursor-pointer group"
                                        onClick={() => setShowAdjustment(!showAdjustment)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <TrendingDown className="w-4 h-4 text-emerald-600" />
                                            <label className="text-sm font-semibold text-emerald-900 cursor-pointer">本次收款协商优惠 (Optional)</label>
                                            <ChevronDown className={`w-4 h-4 text-emerald-400 transition-transform duration-200 ${showAdjustment ? 'rotate-180' : ''}`} />
                                        </div>
                                        <div className="text-xs text-emerald-700 font-medium">
                                            {discountedPayable !== selectedReceivable.amount_payable_period ? (
                                                <span className="text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-200">已应用优惠</span>
                                            ) : (
                                                <span>原应收：<span className="font-mono">{formatCurrency(selectedReceivable.amount_payable_period)}</span></span>
                                            )}
                                        </div>
                                    </div>

                                    {showAdjustment && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[11px] font-medium text-emerald-700 mb-1">协商后的本期应收总额</label>
                                                    <div className="relative">
                                                        <span className="absolute inset-y-0 left-3 flex items-center text-emerald-500 text-sm">¥</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={discountedPayable ?? ''}
                                                            onChange={e => setDiscountedPayable(parseFloat(e.target.value) || 0)}
                                                            className="w-full rounded-lg border border-emerald-200 py-2 pl-7 pr-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono bg-white shadow-sm"
                                                        />
                                                    </div>
                                                </div>
                                                {discountedPayable !== selectedReceivable.amount_payable_period && (
                                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <label className="block text-[11px] font-medium text-emerald-700 mb-1">优惠原因 (Required)</label>
                                                        <input
                                                            type="text"
                                                            placeholder="请填写优惠理由..."
                                                            value={discountReason}
                                                            onChange={e => setDiscountReason(e.target.value)}
                                                            className={`w-full rounded-lg border py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors shadow-sm ${!discountReason ? 'border-amber-400 bg-white' : 'border-emerald-200 bg-white'}`}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-emerald-600 leading-relaxed italic">
                                                提示：若本期实收金额因特殊原因产生变动，请点击上方“协商优惠”进行调整，下一期将自动恢复合同原价。
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100">
                                {/* Screenshot upload */}
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <ImagePlus className="w-4 h-4 text-slate-400" /> 收款凭证截图（选填，自动压缩）
                                    </label>
                                    {!screenshotPreview ? (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-6 flex flex-col items-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all"
                                        >
                                            <ImageIcon className="w-8 h-8" />
                                            <span className="text-sm">点击上传截图（JPG/PNG/WEBP）</span>
                                            <span className="text-xs opacity-70">自动压缩至 1200px 宽、75% 质量</span>
                                        </button>
                                    ) : (
                                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                            <img src={screenshotPreview} alt="收款截图预览" className="w-full max-h-48 object-contain" />
                                            <button
                                                type="button"
                                                onClick={clearScreenshot}
                                                className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-full p-1.5 shadow-sm border border-slate-200 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-200 flex items-center gap-2">
                                                <ImageIcon className="w-3.5 h-3.5" />
                                                {screenshotFile?.name} · 将在提交时自动压缩上传
                                            </div>
                                        </div>
                                    )}
                                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step E: Renewal & Contract Confirmation (Hidden if AdHoc) */}
                    {selectedCustomer && !isAdHoc && selectedReceivable && renewal && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">E</div>
                                <h2 className="text-sm font-semibold text-slate-800">确认合同 & 续期信息</h2>
                                <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                                    变更字段需填写原因
                                </span>
                            </div>
                            <div className="p-5 space-y-4">

                                {/* Contract status */}
                                <RenewalRow
                                    label="是否有合同"
                                    changed={changedFields.includes('has_contract')}
                                    reason={changeReasons.has_contract || ''}
                                    onReasonChange={v => updateReason('has_contract', v)}
                                    original={selectedReceivable.has_contract ? '有合同' : '无合同'}
                                >
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => updateRenewal('has_contract', true)}
                                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${renewal.has_contract ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                        >
                                            已签合同
                                        </button>
                                        <button
                                            onClick={() => updateRenewal('has_contract', false)}
                                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${!renewal.has_contract ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                        >
                                            未签合同
                                        </button>
                                    </div>
                                </RenewalRow>

                                {/* Contract end date */}
                                <RenewalRow
                                    label="合同截止日期"
                                    changed={changedFields.includes('contract_end_date')}
                                    reason={changeReasons.contract_end_date || ''}
                                    onReasonChange={v => updateReason('contract_end_date', v)}
                                    original={selectedReceivable.contract_end_date ? formatDate(selectedReceivable.contract_end_date) : '未填写'}
                                    hint={!renewal.has_contract ? '无合同也可填写预计截止日，留空表示无' : `默认 = 当前截止日 + ${renewal.pay_cycle_months} 个月`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={renewal.contract_end_date}
                                            onChange={e => updateRenewal('contract_end_date', e.target.value)}
                                            className="flex-1 rounded-xl border border-slate-200 py-2 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                                        />
                                        <button
                                            type="button"
                                            title="重置为自动计算值"
                                            onClick={() => updateRenewal('contract_end_date', selectedReceivable.contract_end_date ? addMonths(selectedReceivable.contract_end_date, renewal.pay_cycle_months) : '')}
                                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </div>
                                </RenewalRow>

                                {/* Pay cycle */}
                                <RenewalRow
                                    label="付款周期 (月)"
                                    changed={changedFields.includes('pay_cycle_months')}
                                    reason={changeReasons.pay_cycle_months || ''}
                                    onReasonChange={v => updateReason('pay_cycle_months', v)}
                                    original={`${selectedReceivable.pay_cycle_months || 1} 个月`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            max="60"
                                            value={renewal.pay_cycle_months}
                                            onChange={e => {
                                                const v = parseInt(e.target.value) || 1;
                                                updateRenewal('pay_cycle_months', v);
                                                // Auto-recalculate next dates
                                                updateRenewal('payment_due_date', addMonths(selectedReceivable.payment_due_date, v));
                                                if (selectedReceivable.contract_end_date) {
                                                    updateRenewal('contract_end_date', addMonths(selectedReceivable.contract_end_date, v));
                                                }
                                            }}
                                            className="w-24 rounded-xl border border-slate-200 py-2 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                                        />
                                        <span className="text-sm text-slate-500">个月</span>
                                    </div>
                                </RenewalRow>

                                {/* Next payment date */}
                                <RenewalRow
                                    label="下次收款日"
                                    changed={changedFields.includes('payment_due_date')}
                                    reason={changeReasons.payment_due_date || ''}
                                    onReasonChange={v => updateReason('payment_due_date', v)}
                                    original={formatDate(selectedReceivable.payment_due_date)}
                                    hint={`默认 = 当前截止日 + ${renewal.pay_cycle_months} 个月`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={renewal.payment_due_date}
                                            onChange={e => updateRenewal('payment_due_date', e.target.value)}
                                            className="flex-1 rounded-xl border border-slate-200 py-2 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                                        />
                                        <button
                                            type="button"
                                            title="重置为自动计算值"
                                            onClick={() => updateRenewal('payment_due_date', addMonths(selectedReceivable.payment_due_date, renewal.pay_cycle_months))}
                                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </div>
                                </RenewalRow>

                                {/* Billing fee month */}
                                <RenewalRow
                                    label="月收费金额"
                                    changed={changedFields.includes('billing_fee_month')}
                                    reason={changeReasons.billing_fee_month || ''}
                                    onReasonChange={v => updateReason('billing_fee_month', v)}
                                    original={formatCurrency(selectedReceivable.billing_fee_month)}
                                >
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">¥</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={renewal.billing_fee_month}
                                            onChange={e => updateRenewal('billing_fee_month', parseFloat(e.target.value) || 0)}
                                            className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
                                        />
                                    </div>
                                </RenewalRow>

                                {/* Standard price */}
                                <RenewalRow
                                    label="标准价格"
                                    changed={changedFields.includes('standard_price')}
                                    reason={changeReasons.standard_price || ''}
                                    onReasonChange={v => updateReason('standard_price', v)}
                                    original={formatCurrency(selectedReceivable.standard_price)}
                                >
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">¥</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={renewal.standard_price}
                                            onChange={e => updateRenewal('standard_price', parseFloat(e.target.value) || 0)}
                                            className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
                                        />
                                    </div>
                                </RenewalRow>

                                {/* Discount gap */}
                                <RenewalRow
                                    label="优惠差额"
                                    changed={changedFields.includes('discount_gap')}
                                    reason={changeReasons.discount_gap || ''}
                                    onReasonChange={v => updateReason('discount_gap', v)}
                                    original={formatCurrency(selectedReceivable.discount_gap)}
                                >
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">¥</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={renewal.discount_gap}
                                            onChange={e => updateRenewal('discount_gap', parseFloat(e.target.value) || 0)}
                                            className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
                                        />
                                    </div>
                                </RenewalRow>

                                {/* Validation warning */}
                                {!renewalValid && changedFields.length > 0 && (
                                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>以下字段有变更，请填写变更原因：{changedFields.filter(f => f !== 'amount_payable_period' && !changeReasons[f]).map(f => RENEWAL_FIELD_LABELS[f]).join('、')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Preview + Submit */}
                <div className="space-y-5">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold ${isAdHoc ? 'bg-amber-500' : 'bg-blue-600'}`}>D</div>
                            <h2 className="text-sm font-semibold text-slate-800">
                                {isAdHoc ? '预览新增收款' : '预览冲抵结果'}
                            </h2>
                        </div>

                        <div className="p-5 space-y-4">
                            {!selectedReceivable && !isAdHoc ? (
                                <div className="text-center py-6 text-slate-400">
                                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs">请先选择客户和账单</p>
                                </div>
                            ) : (
                                <>
                                    {isAdHoc ? (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-3">
                                                <span className="text-slate-500">本次收款金额</span>
                                                <span className={`font-bold font-mono text-xl ${amountNum > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                    {amountNum > 0 ? formatCurrency(amountNum) : '—'}
                                                </span>
                                            </div>
                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                                <p className="text-xs text-amber-700 leading-relaxed">
                                                    提交后，系统将自动基于您填写的金额和名目，生成一笔独立的底层账单，并自动标记为<span className="font-semibold">“已全额付清”</span>。
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">本期应收</span>
                                                <span className="font-semibold text-slate-800 font-mono">{formatCurrency(selectedReceivable?.amount_payable_period)}</span>
                                            </div>
                                            {discountedPayable !== null && selectedReceivable && Math.abs(discountedPayable - selectedReceivable.amount_payable_period) > 0.01 && (
                                                <div className="flex justify-between items-center text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <span className="text-slate-500">本期优惠</span>
                                                    <span className="font-semibold text-red-600 font-mono">-{formatCurrency(selectedReceivable.amount_payable_period - discountedPayable)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">冲抵前已收</span>
                                                <span className="font-semibold text-emerald-600 font-mono">{formatCurrency(paidSoFar)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm border-t border-dashed border-slate-200 pt-2.5">
                                                <span className="text-slate-500">本次收款</span>
                                                <span className={`font-bold font-mono text-base ${amountNum > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                    {amountNum > 0 ? formatCurrency(amountNum) : '—'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2.5">
                                                <span className="font-medium text-slate-700">冲抵后已收</span>
                                                <span className="font-bold text-emerald-600 font-mono">{formatCurrency(afterPaid)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-medium text-slate-700">冲抵后未收</span>
                                                <span className={`font-bold font-mono ${afterRemaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {formatCurrency(afterRemaining)}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {afterStatus && amountNum > 0 && !isAdHoc && (
                                        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 mt-2">
                                            <span className="text-xs text-slate-500">状态将变为</span>
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${afterStatus.color} ${afterStatus.bg}`}>
                                                {afterStatus.label}
                                            </span>
                                        </div>
                                    )}

                                    {/* Renewal summary */}
                                    {renewal && changedFields.length > 0 && !isAdHoc && (
                                        <div className="border-t border-slate-100 pt-3 space-y-1.5">
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">变更摘要</p>
                                            {changedFields.map(f => (
                                                <div key={f} className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500">{RENEWAL_FIELD_LABELS[f as keyof typeof RENEWAL_FIELD_LABELS]}</span>
                                                    <span className="font-medium text-amber-700">已修改</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {submitError && (
                                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span>{submitError}</span>
                                        </div>
                                    )}

                                    {submitSuccess && (
                                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                            <span>收款录入成功！系统已自动生成底层账单记录。</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setShowConfirm(true)}
                                        disabled={!canSubmit || submitting || uploading}
                                        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${canSubmit && !submitting && !uploading
                                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200'
                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            }`}
                                    >
                                        {(submitting || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {uploading ? '压缩上传中...' : submitting ? '提交中...' : '确认提交收款'}
                                    </button>

                                    {!canSubmit && !submitSuccess && (
                                        <p className="text-xs text-center text-slate-400">
                                            {!amountNum ? '请输入收款金额'
                                                : !isAdHoc && amountNum > remaining + 0.01 ? '金额超出未收余额'
                                                    : !isAdHoc && !renewalValid ? '请填写所有变更原因'
                                                        : '信息填写完整后可提交'}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && selectedCustomer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-900">确认收款信息</h3>
                            <button onClick={() => setShowConfirm(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">客户名称</span>
                                    <span className="font-semibold text-slate-900">{selectedCustomer.company_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">收款日期</span>
                                    <span className="font-semibold text-slate-900">{paidAt}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">收款金额</span>
                                    <span className="font-bold text-blue-600 text-lg font-mono">{formatCurrency(amountNum)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">收款方式</span>
                                    <span className="font-semibold text-slate-900">{method}</span>
                                </div>
                                {!isAdHoc && renewal && (
                                    <>
                                        <div className="h-px bg-slate-100 my-2" />
                                        <div className="flex justify-between text-sm text-violet-700">
                                            <span className="opacity-70">下次收款日</span>
                                            <span className="font-bold">{formatDate(renewal.payment_due_date)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-violet-700">
                                            <span className="opacity-70">合同截止日</span>
                                            <span className="font-bold">{formatDate(renewal.contract_end_date)}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    请核对以上信息，提交后系统将自动更新财务底账并生成收款记录。
                                </p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => { setShowConfirm(false); handleSubmit(); }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all"
                            >
                                确认提交
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PaymentEntryPage() {
    return (
        <Suspense fallback={
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        }>
            <PaymentEntryContent />
        </Suspense>
    );
}

// ─── Sub-component: RenewalRow ───────────────────────────────────────────────
function RenewalRow({
    label, changed, original, reason, onReasonChange, hint, children,
}: {
    label: string;
    changed: boolean;
    original: string;
    reason: string;
    onReasonChange: (v: string) => void;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`rounded-xl p-4 transition-colors ${changed ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-transparent'}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-slate-700">{label}</label>
                    {changed && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">已修改</span>
                    )}
                </div>
                <span className="text-xs text-slate-400">当前：<span className="font-medium text-slate-600">{original}</span></span>
            </div>
            {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
            {children}
            {changed && (
                <div className="mt-2.5">
                    <input
                        type="text"
                        placeholder="* 请填写变更原因（必填）"
                        value={reason}
                        onChange={e => onReasonChange(e.target.value)}
                        className={`w-full rounded-lg border py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${!reason ? 'border-amber-300 bg-white' : 'border-slate-200 bg-white'}`}
                    />
                </div>
            )}
        </div>
    );
}
