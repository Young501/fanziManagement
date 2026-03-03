import { Database, Users, ArrowUpRight, Activity } from 'lucide-react';

export default function Home() {
  const stats = [
    { name: '总用户数', value: '1,234', change: '+12%', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: '数据流请求', value: '8.4M', change: '+5.4%', icon: Database, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: '系统负载', value: '42%', change: '-2%', icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50' },
    { name: '活跃会话', value: '156', change: '+18%', icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">
            欢迎回来, Admin
          </h1>
          <p className="text-slate-500 text-sm">
            查看实时数据与平台运行状态。
          </p>
        </div>
        <div className="hidden sm:flex space-x-3">
          <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-sm">
            导出报告
          </button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm">
            新建项目
          </button>
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
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.change.startsWith('+')
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-rose-50 text-rose-600'
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

      {/* Main content grid area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">系统活动趋势</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              查看全部
            </button>
          </div>
          <div className="h-64 flex items-center justify-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
            <p className="text-slate-400 text-sm">图表占位区：待接驳</p>
          </div>
        </div>

        <div className="col-span-1 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">最近活动</h2>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-start gap-3 relative pb-4 before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-slate-200 last:before:hidden last:pb-0">
                <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 relative z-10">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">用户 User_{item} 登录成功</p>
                  <p className="text-xs text-slate-500 mt-1">10 分钟前</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
