'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Building2, Users, FileText, AlertCircle, FileSignature, Edit } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MaskedContact } from '@/components/ui/MaskedContact';

type CustomerInfo = {
    customer: any;
    companyProfile: any | null;
    shareholders: any[];
    contracts: any[];
};

// A helper for empty field fallback
const TextRow = ({ label, value }: { label: string, value: any }) => (
    <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">{label}</label>
        <div className="text-slate-800 break-words">{value || '未填写'}</div>
    </div>
);

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [data, setData] = useState<CustomerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string>('');

    // Edit Modal States
    const [isEditingBasic, setIsEditingBasic] = useState(false);
    const [editBasicData, setEditBasicData] = useState<any>({});

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editProfileData, setEditProfileData] = useState<any>({});

    const [isEditingShareholder, setIsEditingShareholder] = useState(false);
    const [editShareholderData, setEditShareholderData] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);

    const fetchCustomer = () => {
        setLoading(true);
        fetch(`/api/customers/${id}`)
            .then(res => res.json())
            .then(res => {
                if (res.error) throw new Error(res.error);
                setData(res);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setUserRole(data.user.role || '');
                }
            })
            .catch(console.error);

        if (id) fetchCustomer();
    }, [id]);

    const isManagerOrAdmin = userRole === 'manager' || userRole === 'admin';

    const handleSaveBasic = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_name: editBasicData.company_name,
                    contact_person: editBasicData.contact_person,
                    contact_info: editBasicData.contact_info,
                    website_member: editBasicData.website_member,
                    address: editBasicData.address,
                    customer_status: editBasicData.customer_status,
                    source_info: editBasicData.source_info,
                    service_manager: editBasicData.service_manager
                })
            });
            if (!res.ok) throw new Error('保存失败');
            setIsEditingBasic(false);
            fetchCustomer();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyProfile: editProfileData })
            });
            if (!res.ok) throw new Error('保存失败');
            setIsEditingProfile(false);
            fetchCustomer();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveShareholder = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareholder: editShareholderData })
            });
            if (!res.ok) throw new Error('保存失败');
            setIsEditingShareholder(false);
            fetchCustomer();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteShareholder = async (shareholderId: string) => {
        if (!confirm('确定要删除该股东吗？')) return;
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deleteShareholderId: shareholderId })
            });
            if (!res.ok) throw new Error('删除失败');
            fetchCustomer();
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (loading && !data) return <div className="p-8 text-center text-slate-500">加载中...</div>;
    if (error || !data?.customer) return <div className="p-8 text-center text-red-500">{error || '未找到该客户'}</div>;

    const { customer, companyProfile, shareholders, contracts } = data;

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">{customer.company_name}</h1>
                        <p className="text-sm text-slate-500 mt-1 flex gap-4">
                            <span>联系人: {customer.contact_person}</span>
                            <span>电话: <MaskedContact contact={customer.contact_info} /></span>
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Content with Tabs */}
            <main className="flex-1 overflow-auto p-6">
                <div className="max-w-6xl mx-auto">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="mb-6">
                            <TabsTrigger value="basic" className="flex gap-2">
                                <FileText className="w-4 h-4" />
                                基础档案
                            </TabsTrigger>
                            <TabsTrigger value="company" className="flex gap-2">
                                <Building2 className="w-4 h-4" />
                                公司画像
                            </TabsTrigger>
                            <TabsTrigger value="shareholders" className="flex gap-2">
                                <Users className="w-4 h-4" />
                                股东信息
                            </TabsTrigger>
                            <TabsTrigger value="contracts" className="flex gap-2">
                                <FileSignature className="w-4 h-4" />
                                合同管理
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="focus:outline-none focus:ring-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-semibold text-slate-800">基础业务档案</h2>
                                    {isManagerOrAdmin && (
                                        <button
                                            onClick={() => {
                                                setEditBasicData(customer);
                                                setIsEditingBasic(true);
                                            }}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                        >
                                            <Edit className="w-4 h-4" />
                                            编辑信息
                                        </button>
                                    )}
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Read-only info for now. Editing form to be added/ported. */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">企业名称</label>
                                        <div className="text-slate-800">{customer.company_name}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">联系人</label>
                                        <div className="text-slate-800">{customer.contact_person}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">联系方式</label>
                                        <div className="text-slate-800"><MaskedContact contact={customer.contact_info} /></div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">企微好友</label>
                                        <div className="text-slate-800">{customer.website_member || '未添加'}</div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-500 mb-1">通信地址</label>
                                        <div className="text-slate-800">{customer.address || '暂无'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">客户状态</label>
                                        <div className="text-slate-800">{customer.customer_status}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">客户来源</label>
                                        <div className="text-slate-800">{customer.source_info}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">客服经理</label>
                                        <div className="text-slate-800">{customer.service_manager}</div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="company" className="focus:outline-none focus:ring-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-semibold text-slate-800">公司画像</h2>
                                    {isManagerOrAdmin && (
                                        <button
                                            onClick={() => {
                                                setEditProfileData(companyProfile || {});
                                                setIsEditingProfile(true);
                                            }}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition"
                                        >
                                            <Edit className="w-4 h-4 inline-block mr-1" />
                                            {companyProfile ? '编辑画像' : '完善画像'}
                                        </button>
                                    )}
                                </div>
                                {companyProfile ? (
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <TextRow label="公司类型" value={companyProfile.company_type} />
                                        <TextRow label="企业性质" value={companyProfile.company_nature} />
                                        <TextRow label="税率" value={companyProfile.tax_rate} />
                                        <TextRow label="纳税人识别号" value={companyProfile.taxpayer_no || companyProfile.credit_code} />
                                        <TextRow label="法定代表人" value={companyProfile.legal_person || companyProfile.legal_representative} />
                                        <TextRow label="监事" value={companyProfile.supervisor} />
                                        <TextRow label="财务联系人" value={companyProfile.finance_contact} />
                                        <TextRow label="办税员" value={companyProfile.tax_handler} />
                                        <TextRow label="成立/注册日期" value={companyProfile.registration_date || companyProfile.establishment_date} />
                                        <TextRow label="注册资本" value={companyProfile.registered_capital ? `${companyProfile.registered_capital}${companyProfile.registered_capital_unit || '万元'}` : '未填写'} />
                                        <TextRow label="所属税局" value={companyProfile.tax_office} />
                                        <TextRow label="税管员" value={companyProfile.tax_admin} />
                                        <TextRow label="税管员电话" value={companyProfile.tax_admin_phone} />
                                        <TextRow label="所属社区" value={companyProfile.community} />
                                        <TextRow label="代开发票" value={companyProfile.invoice_proxy_flag ? '是' : '否'} />
                                        <TextRow label="云账房" value={companyProfile.cloud_accounting} />
                                        <TextRow label="账本编号" value={companyProfile.account_book_no} />
                                        <TextRow label="序号档案" value={companyProfile.serial_no} />
                                        <TextRow label="税局登录名" value={companyProfile.company_login_name} />
                                        <TextRow label="税局登录密码" value={companyProfile.company_login_password} />
                                        <TextRow label="合同归档" value={companyProfile.contract_flag ? '已归档' : '未归档'} />
                                        <TextRow label="上年营收额 (元)" value={companyProfile.last_year_revenue} />
                                        <TextRow label="开户银行名称" value={companyProfile.receipt_card_bank_name} />

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-500 mb-1">主营业务简述 / 经营范围</label>
                                            <div className="text-slate-800 text-sm whitespace-pre-wrap">{companyProfile.main_business || companyProfile.business_scope || '未填写'}</div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-500 mb-1">印章留存</label>
                                            <div className="flex flex-wrap gap-4 mt-1 text-slate-800">
                                                {companyProfile.seal_company && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">公章</span>}
                                                {companyProfile.seal_legal && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">法人章</span>}
                                                {companyProfile.seal_finance && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">财务章</span>}
                                                {companyProfile.seal_invoice && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">发票章</span>}
                                                {companyProfile.seal_shareholder && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">股东章</span>}
                                                {!companyProfile.seal_company && !companyProfile.seal_legal && !companyProfile.seal_finance && !companyProfile.seal_invoice && !companyProfile.seal_shareholder && <span>未留存</span>}
                                            </div>
                                        </div>

                                        <TextRow label="CA扣款标志" value={companyProfile.ca_token ? '有' : '无'} />

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-500 mb-1">画像备注</label>
                                            <div className="text-slate-800 text-sm whitespace-pre-wrap">{companyProfile.note || '未填写'}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                                        <Building2 className="w-12 h-12 mb-4 text-slate-300" />
                                        <h3 className="text-lg font-medium text-slate-800 mb-2">暂无公司画像</h3>
                                        <p className="mb-4">该客户尚未建立公司画像，如工商、税务等详细信息。</p>
                                        {isManagerOrAdmin && (
                                            <button
                                                onClick={() => {
                                                    setEditProfileData({});
                                                    setIsEditingProfile(true);
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                            >
                                                建立公司画像
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="shareholders" className="focus:outline-none focus:ring-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-semibold text-slate-800">股东与高管</h2>
                                    {isManagerOrAdmin && (
                                        <button
                                            onClick={() => {
                                                setEditShareholderData({});
                                                setIsEditingShareholder(true);
                                            }}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition"
                                        >
                                            添加股东
                                        </button>
                                    )}
                                </div>
                                {shareholders.length > 0 ? (
                                    <div className="divide-y divide-slate-100">
                                        {shareholders.map((sh: any) => (
                                            <div key={sh.id} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                                <div>
                                                    <div className="text-sm font-medium text-slate-500 mb-1">股东姓名</div>
                                                    <div className="font-semibold text-slate-800">{sh.name}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-500 mb-1">持股比例</div>
                                                    <div className="text-slate-800">{sh.share_ratio}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-500 mb-1">联系电话</div>
                                                    <div className="text-slate-800"><MaskedContact contact={sh.contact_number || ''} /></div>
                                                </div>
                                                <div className="flex justify-end col-span-1 md:col-span-3">
                                                    {isManagerOrAdmin && (
                                                        <>
                                                            <button onClick={() => { setEditShareholderData(sh); setIsEditingShareholder(true); }} className="text-blue-600 hover:text-blue-800 text-sm mr-4">编辑</button>
                                                            <button onClick={() => handleDeleteShareholder(sh.id)} className="text-red-600 hover:text-red-800 text-sm">删除</button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                                        <Users className="w-12 h-12 mb-4 text-slate-300" />
                                        <h3 className="text-lg font-medium text-slate-800 mb-2">暂无股东信息</h3>
                                        <p className="mb-4">您还没有登记任何股东或高管成员信息。</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="contracts" className="focus:outline-none focus:ring-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-semibold text-slate-800">合同管理</h2>
                                    {isManagerOrAdmin && (
                                        <button
                                            onClick={() => router.push(`/resources/contracts/new?customerId=${id}`)}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition"
                                        >
                                            新增合同
                                        </button>
                                    )}
                                </div>
                                {contracts && contracts.length > 0 ? (
                                    <div className="divide-y divide-slate-100">
                                        {contracts.map((contract: any) => (
                                            <div key={contract.id} className="p-6 flex flex-col md:flex-row justify-between hover:bg-slate-50/50 transition-colors gap-4">
                                                <div>
                                                    <div className="font-semibold text-slate-800 text-lg mb-1">{contract.contract_name}</div>
                                                    <div className="text-sm font-medium text-slate-500 mb-2">编号: {contract.contract_no}</div>
                                                    <div className="flex gap-4 text-sm text-slate-600">
                                                        <span>总金额: ￥{contract.total_contract_amount}</span>
                                                        <span>类型: {contract.contract_type}</span>
                                                        <span>状态: <span className={contract.status === '执行中' ? 'text-green-600' : 'text-slate-500'}>{contract.status}</span></span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end justify-center">
                                                    <div className="text-sm text-slate-500 mb-1">
                                                        {contract.start_date ? `${contract.start_date} ~ ${contract.end_date || '无期'}` : '未指定期限'}
                                                    </div>
                                                    <button
                                                        onClick={() => router.push(`/resources/contracts`)}
                                                        className="text-blue-600 hover:text-blue-800 text-sm"
                                                    >
                                                        查看详情
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                                        <FileSignature className="w-12 h-12 mb-4 text-slate-300" />
                                        <h3 className="text-lg font-medium text-slate-800 mb-2">暂无合同记录</h3>
                                        <p className="mb-4">该客户尚未签订任何合同。</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>

            {/* Edit Basic Dialog */}
            <Dialog open={isEditingBasic} onOpenChange={setIsEditingBasic}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>编辑基础业务档案</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div>
                            <label className="text-sm font-medium">企业名称</label>
                            <input type="text" value={editBasicData.company_name || ''} onChange={e => setEditBasicData({ ...editBasicData, company_name: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">联系人</label>
                            <input type="text" value={editBasicData.contact_person || ''} onChange={e => setEditBasicData({ ...editBasicData, contact_person: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">联系方式</label>
                            <input type="text" value={editBasicData.contact_info || ''} onChange={e => setEditBasicData({ ...editBasicData, contact_info: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">企微好友</label>
                            <input type="text" value={editBasicData.website_member || ''} onChange={e => setEditBasicData({ ...editBasicData, website_member: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">通信地址</label>
                            <input type="text" value={editBasicData.address || ''} onChange={e => setEditBasicData({ ...editBasicData, address: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">客户状态</label>
                            <select value={editBasicData.customer_status || ''} onChange={e => setEditBasicData({ ...editBasicData, customer_status: e.target.value })} className="w-full mt-1 rounded-md border p-2 bg-white">
                                <option value="意向">意向</option>
                                <option value="签约">签约</option>
                                <option value="流失">流失</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">客户来源</label>
                            <input type="text" value={editBasicData.source_info || ''} onChange={e => setEditBasicData({ ...editBasicData, source_info: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">客服经理</label>
                            <input type="text" value={editBasicData.service_manager || ''} onChange={e => setEditBasicData({ ...editBasicData, service_manager: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={() => setIsEditingBasic(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">取消</button>
                        <button onClick={handleSaveBasic} disabled={isSaving} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">保存</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Profile Dialog */}
            <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>完善客户画像</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div>
                            <label className="text-sm font-medium">公司类型</label>
                            <input type="text" value={editProfileData.company_type || ''} onChange={e => setEditProfileData({ ...editProfileData, company_type: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">企业性质</label>
                            <input type="text" value={editProfileData.company_nature || ''} onChange={e => setEditProfileData({ ...editProfileData, company_nature: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">纳税人识别号</label>
                            <input type="text" value={editProfileData.taxpayer_no || ''} onChange={e => setEditProfileData({ ...editProfileData, taxpayer_no: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">法定代表人</label>
                            <input type="text" value={editProfileData.legal_person || editProfileData.legal_representative || ''} onChange={e => setEditProfileData({ ...editProfileData, legal_person: e.target.value, legal_representative: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">财务联系人</label>
                            <input type="text" value={editProfileData.finance_contact || ''} onChange={e => setEditProfileData({ ...editProfileData, finance_contact: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">办税员</label>
                            <input type="text" value={editProfileData.tax_handler || ''} onChange={e => setEditProfileData({ ...editProfileData, tax_handler: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">成立/注册日期</label>
                            <input type="date" value={editProfileData.registration_date || editProfileData.establishment_date || ''} onChange={e => setEditProfileData({ ...editProfileData, registration_date: e.target.value, establishment_date: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">注册资本 (万元)</label>
                            <input type="number" step="0.01" value={editProfileData.registered_capital || ''} onChange={e => setEditProfileData({ ...editProfileData, registered_capital: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">所属税局</label>
                            <input type="text" value={editProfileData.tax_office || ''} onChange={e => setEditProfileData({ ...editProfileData, tax_office: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">经营范围</label>
                            <textarea rows={3} value={editProfileData.business_scope || editProfileData.main_business || ''} onChange={e => setEditProfileData({ ...editProfileData, business_scope: e.target.value, main_business: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">画像备注</label>
                            <textarea rows={2} value={editProfileData.note || ''} onChange={e => setEditProfileData({ ...editProfileData, note: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={() => setIsEditingProfile(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">取消</button>
                        <button onClick={handleSaveProfile} disabled={isSaving} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">保存</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Shareholder Dialog */}
            <Dialog open={isEditingShareholder} onOpenChange={setIsEditingShareholder}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editShareholderData.id ? '编辑股东' : '添加股东'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <label className="text-sm font-medium">股东姓名</label>
                            <input type="text" value={editShareholderData.name || ''} onChange={e => setEditShareholderData({ ...editShareholderData, name: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">持股比例 (%)</label>
                            <input type="number" step="0.01" value={editShareholderData.share_ratio || ''} onChange={e => setEditShareholderData({ ...editShareholderData, share_ratio: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">联系电话</label>
                            <input type="text" value={editShareholderData.contact_number || ''} onChange={e => setEditShareholderData({ ...editShareholderData, contact_number: e.target.value })} className="w-full mt-1 rounded-md border p-2" />
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={() => setIsEditingShareholder(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">取消</button>
                        <button onClick={handleSaveShareholder} disabled={isSaving} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">保存</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
