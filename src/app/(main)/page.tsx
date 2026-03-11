export const dynamic = 'force-dynamic';

import { Database, Users, ArrowUpRight, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default async function Home() {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();

  let adminName = 'Admin';
  let userRole = 'employee';
  if (user) {
    const { data: profile } = await serverClient
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    if (profile) {
      userRole = profile.role || 'employee';
      if (profile.full_name) {
        adminName = profile.full_name.charAt(0) + '经理';
      } else if (user.email) {
        adminName = user.email.charAt(0).toUpperCase() + '经理';
      }
    }
  }

  // 1. Get total customers
  const { count: totalCustomers } = await serverClient
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .neq('customer_status', '流失');

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

  // 2. Get current month's new customers count
  const actualMonthStart = monthStart < '2026-03-10' ? '2026-03-10' : monthStart;
  const { count: thisMonthNewCustomers } = await serverClient
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', actualMonthStart)
    .neq('customer_status', '流失');

  // Get most recent 5 customers for the widget list
  const { data: recentNewCustomers } = await serverClient
    .from('customers')
    .select('id, company_name, created_at, contact_person')
    .gte('created_at', '2026-03-10')
    .order('created_at', { ascending: false })
    .limit(5);

  // 3. Collection tasks analysis

  const { data: allTasks } = await serverClient
    .from('collection_tasks')
    .select(`
        id,
        due_date,
        status,
        company_receivables (
            payment_due_date,
            amount_payable_period,
            amount_paid_period
        )
    `)
    .in('status', ['open', 'in_progress', 'promised']);

  let tasksDueThisMonth = 0;
  let tasksOverdue = 0;

  (allTasks || []).forEach((task: any) => {
    const rec = task.company_receivables ?? {};
    const paid = Number(rec.amount_paid_period || 0);
    const payable = Number(rec.amount_payable_period || 0);
    const uncollected_amount = Math.max(0, payable - paid);

    if (uncollected_amount <= 0) return; // Only open/unpaid

    const dueDate = rec.payment_due_date ?? task.due_date;
    const isOverdue = dueDate && dueDate < monthStart;

    if (isOverdue) {
      tasksOverdue++;
    } else if (dueDate >= monthStart && dueDate <= monthEnd) {
      tasksDueThisMonth++;
    }
  });

  // 4. Recent Payment Records
  const { data: recentPayments } = await serverClient
    .from('payment_records')
    .select(`
        id,
        paid_amount,
        paid_at,
        customers (
            company_name
        )
    `)
    .order('paid_at', { ascending: false })
    .limit(5);

  // 5. Churned Customers
  const { data: churnedCustomers } = await serverClient
    .from('customer_churn_logs')
    .select(`
        id,
        churn_date,
        churn_reason,
        customers (
            company_name
        )
    `)
    .order('churn_date', { ascending: false })
    .limit(5);

  const yearStart = `${now.getFullYear()}-01-01`;

  // 6. This year's financials (conditionally fetched based on role)
  let totalCollectedThisYear = 0;
  let totalSpentThisYear = 0;
  const canViewFinancials = userRole === 'admin' || userRole === 'manager';

  if (canViewFinancials) {
    const { data: thisYearPayments } = await serverClient
      .from('payment_records')
      .select('paid_amount')
      .gte('paid_at', yearStart);
    totalCollectedThisYear = (thisYearPayments || []).reduce((sum, r) => sum + Number(r.paid_amount || 0), 0);

    const supabaseAdmin = createAdminClient();
    const { data: thisYearExpenses } = await supabaseAdmin
      .from('expense_records')
      .select('expense_amount')
      .gte('expense_date', yearStart);
    totalSpentThisYear = (thisYearExpenses || []).reduce((sum, r) => sum + Number(r.expense_amount || 0), 0);
  }

  const stats = [
    { name: '总客户数', value: totalCustomers || 0, change: '实时', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: '本月新增客户', value: thisMonthNewCustomers || 0, change: '实时', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: '本月待收款任务', value: tasksDueThisMonth, change: '实时', icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: '逾期催款任务', value: tasksOverdue, change: '加急', icon: ArrowUpRight, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">
            欢迎回来, {adminName}
          </h1>
          <p className="text-slate-500 text-sm">
            查看实时数据与平台运行状态。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.change === '加急'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                    }`}
                >
                  {stat.change}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">{stat.name}</h3>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Summary Bar (Only visible to admin/manager) */}
      {canViewFinancials && (
        <div className="flex flex-col md:flex-row bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <div className="flex-1 p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-1/4 -translate-y-1/4 transition-transform group-hover:scale-110 group-hover:-translate-y-1/3">
              <TrendingUp className="w-32 h-32 text-emerald-600" />
            </div>
            <div className="relative z-10 flex items-center space-x-5">
              <div className="p-3.5 bg-emerald-50 rounded-xl ring-1 ring-emerald-100">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">今年已收款</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-slate-900">
                    ¥{totalCollectedThisYear.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    全年计
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-px bg-slate-100 hidden md:block"></div>
          <div className="h-px bg-slate-100 md:hidden block"></div>

          <div className="flex-1 p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-1/4 -translate-y-1/4 transition-transform group-hover:scale-110 group-hover:-translate-y-1/3">
              <TrendingDown className="w-32 h-32 text-rose-600" />
            </div>
            <div className="relative z-10 flex items-center space-x-5">
              <div className="p-3.5 bg-rose-50 rounded-xl ring-1 ring-rose-100">
                <TrendingDown className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">今年已支出</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-slate-900">
                    ¥{totalSpentThisYear.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    全年计
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content grid area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* left column: Recent payments & Churned */}
        <div className="col-span-1 lg:col-span-2 space-y-6">

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">近期新增客户</h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                查看全部
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">客户名称</th>
                    <th className="px-4 py-3">联系人</th>
                    <th className="px-4 py-3 rounded-tr-lg text-right">建档时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentNewCustomers && recentNewCustomers.length > 0 ? (
                    recentNewCustomers.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{c.company_name}</td>
                        <td className="px-4 py-3 text-slate-600">{c.contact_person || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 text-right">{formatDate(c.created_at).split(' ')[0]}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        暂无新增客户
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                近期流失记录摘要
              </h2>
            </div>
            <div className="space-y-3">
              {churnedCustomers && churnedCustomers.length > 0 ? (
                churnedCustomers.map((churn: any) => (
                  <div key={churn.id} className="flex items-start justify-between p-4 rounded-xl border border-red-100 bg-red-50/30">
                    <div>
                      <h4 className="font-medium text-slate-800 mb-1">{churn.customers?.company_name || '未知客户'}</h4>
                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-red-600">流失原因:</span> {churn.churn_reason}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-500">{churn.churn_date}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-sm font-medium text-slate-500">近期无客户流失，继续保持！</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right column: Timeline / Activities */}
        <div className="col-span-1 space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">最近收款活动</h2>
            <div className="space-y-4">
              {recentPayments && recentPayments.length > 0 ? (
                recentPayments.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="flex items-start gap-3 relative pb-4 before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-slate-200 last:before:hidden last:pb-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-200 relative z-10">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        收到 <strong>{item.customers?.company_name || '客户'}</strong> 的付款 <span className="text-emerald-600 font-semibold">¥{item.paid_amount.toLocaleString()}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{formatDate(item.paid_at)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">暂无收款活动</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
