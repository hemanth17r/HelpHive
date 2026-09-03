import React, { useContext, useRef } from 'react';
import { ArrowLeft, TrendingUp, Briefcase, CalendarDays } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import { formatCurrency } from '../../utils/currency';

const TaskerActivityScreen = () => {
  const { popScreen, jobs, userProfile, currency, userId } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const isGuest = !userId || userProfile?.isGuest;

  // Filter jobs for this tasker
  const taskerJobs = jobs.filter(j =>
    j.taskerId === userProfile?.id ||
    j.taskerName === userProfile?.name ||
    j.isAcceptedByMe
  );

  const displayCompleted = taskerJobs.filter(j => j.status === 'completed' || j.completedByMe);

  // Earnings calculations
  const totalEarned = isGuest 
    ? (userProfile?.taskerEarningsAmount || 24500)
    : displayCompleted.reduce((sum, j) => sum + (j.amount || 0), 0);
    
  const jobsCompletedCount = isGuest
    ? (userProfile?.taskerTasksCompleted || 42)
    : displayCompleted.length;

  // Current month earnings
  const now = new Date();
  const currentMonthJobs = displayCompleted.filter(j => {
    if (!j.timePosted) return false;
    const posted = new Date(j.timePosted);
    return posted.getMonth() === now.getMonth() && posted.getFullYear() === now.getFullYear();
  });
  
  const thisMonthEarnings = isGuest
    ? 6800
    : currentMonthJobs.reduce((sum, j) => sum + (j.amount || 0), 0);

  // Monthly breakdown (last 3 months)
  const getMonthName = (offset) => {
    const d = new Date();
    d.setMonth(d.getMonth() - offset);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const getEarningsForMonth = (offset) => {
    if (isGuest) {
      if (offset === 0) return 6800;
      if (offset === 1) return 9500;
      if (offset === 2) return 8200;
      return 0;
    }
    const d = new Date();
    d.setMonth(d.getMonth() - offset);
    const targetMonth = d.getMonth();
    const targetYear = d.getFullYear();
    
    return displayCompleted
      .filter(j => {
        if (!j.timePosted) return false;
        const posted = new Date(j.timePosted);
        return posted.getMonth() === targetMonth && posted.getFullYear() === targetYear;
      })
      .reduce((sum, j) => sum + (j.amount || 0), 0);
  };

  const monthlyEarnings = [
    { month: getMonthName(0), amount: getEarningsForMonth(0) },
    { month: getMonthName(1), amount: getEarningsForMonth(1) },
    { month: getMonthName(2), amount: getEarningsForMonth(2) },
  ];

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-4 bg-white shrink-0 z-10 sticky top-0">
        <button
          onClick={popScreen}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
          id="tasker-activity-back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-black text-dark ml-2">Bounty Stash & Ledger</span>
      </div>

      <div id="tasker-activity-scroll-container" className="flex-1 overflow-y-auto w-full">
        <div className="px-4 py-6 space-y-8 max-w-md lg:max-w-2xl lg:px-8 mx-auto pb-20">

        {/* ─── Earnings Summary Hero Card ─── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden" id="earnings-summary-card">
          {/* Gradient accent strip */}
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300"></div>

          <div className="p-5 space-y-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <TrendingUp className="w-4.5 h-4.5 text-primary" />
              </div>
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Bounty Overview</h3>
            </div>

            {/* Hero stat */}
            <div className="text-center py-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Bounties Claimed</span>
              <span className="text-4xl font-black text-dark tracking-tight leading-none" id="total-earned-value">
                {formatCurrency(totalEarned, currency?.code)}
              </span>
            </div>

            {/* 2-col mini grid */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <span className="text-xl font-black text-dark block leading-none" id="jobs-completed-value">{jobsCompletedCount}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1 block">Contracts Solved</span>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <span className="text-xl font-black text-dark block leading-none" id="this-month-value">{formatCurrency(thisMonthEarnings || 0, currency?.code)}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1 block">Current Cycle</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Monthly Earnings (Last 3 Months) ─── */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-3" id="monthly-earnings-section">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-50 rounded-xl">
              <CalendarDays className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Cycle Ledger</h3>
          </div>

          <div className="space-y-2 pt-1">
            {monthlyEarnings.map((entry, i) => (
              <div
                key={entry.month}
                className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${i === 0 ? 'bg-primary/5 border border-primary/10' : 'bg-gray-50'}`}
              >
                <span className={`text-xs font-bold ${i === 0 ? 'text-primary' : 'text-gray-600'}`}>
                  {entry.month}
                  {i === 0 && <span className="text-[9px] font-black uppercase tracking-wider text-primary/60 ml-1.5">(Current)</span>}
                </span>
                <span className={`text-sm font-black ${i === 0 ? 'text-primary' : 'text-dark'}`}>
                  {formatCurrency(entry.amount, currency?.code)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Direct Peer-to-Peer Settlement Card ─── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden" id="payout-info-section">
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <Briefcase className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Payment Settlement</h3>
              </div>
              <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                0% Fee
              </span>
            </div>
            
            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-4 space-y-1.5">
              <span className="text-xs font-black text-emerald-900 block">Direct Peer-to-Peer Settlement</span>
              <p className="text-[11px] font-semibold text-emerald-800 leading-relaxed">
                Direct settlement between both parties upon task completion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default TaskerActivityScreen;
