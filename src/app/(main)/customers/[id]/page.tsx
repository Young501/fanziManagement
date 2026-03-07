'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Building2, Users, FileText, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaskedContact } from '@/components/ui/MaskedContact';

type CustomerInfo = {
    customer: any;
    companyProfile: any | null;
    shareholders: any[];
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [data, setData] = useState<CustomerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`/api/customers/${id}`)
            .then(res => res.json())
            .then(res => {
                if (res.error) throw new Error(res.error);
                setData(res);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-8 text-center text-slate-500">加载中...</div>;
    if (error || !data?.customer) return <div className="p-8 text-center text-red-500">{error || '未找到该客户'}</div>;

    const { customer, companyProfile, shareholders } = data;

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
                        </TabsList>

                        <TabsContent value="basic" className="focus:outline-none focus:ring-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-semibold text-slate-800">基础业务档案</h2>
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
                                </div>
                                {companyProfile ? (
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-500 mb-1">统一社会信用代码</label>
                                            <div className="text-slate-800">{companyProfile.credit_code || '未填写'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-500 mb-1">法定代表人</label>
                                            <div className="text-slate-800">{companyProfile.legal_representative || '未填写'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-500 mb-1">注册资本</label>
                                            <div className="text-slate-800">{companyProfile.registered_capital ? `${companyProfile.registered_capital}万元` : '未填写'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-500 mb-1">成立日期</label>
                                            <div className="text-slate-800">{companyProfile.establishment_date || '未填写'}</div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-500 mb-1">经营范围</label>
                                            <div className="text-slate-800 text-sm whitespace-pre-wrap">{companyProfile.business_scope || '未填写'}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                                        <Building2 className="w-12 h-12 mb-4 text-slate-300" />
                                        <h3 className="text-lg font-medium text-slate-800 mb-2">暂无公司画像</h3>
                                        <p className="mb-4">该客户尚未建立公司画像，如工商、税务等详细信息。</p>
                                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">建立公司画像</button>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="shareholders" className="focus:outline-none focus:ring-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-semibold text-slate-800">股东与高管</h2>
                                    <button className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition">添加股东</button>
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
                    </Tabs>
                </div>
            </main>
        </div>
    );
}
