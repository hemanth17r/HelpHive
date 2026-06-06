import React, { useContext, useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock, CheckCircle, TrendingUp, Briefcase, CalendarDays, Users, Hash, ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../data/mockData';

const TaskerActivityScreen = () => {
  const { popScreen, jobs, userProfile, pushScreen, setCurrentPostedJob, setAcceptedJob, taskerActivityScrollTarget, setTaskerActivityScrollTarget } = useContext(AppContext);

  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const activeRef = useRef(null);
  const completedRef = useRef(null);

  // Scroll to targeted section if directed from MyProfileScreen
  useEffect(() => {
    if (taskerActivityScrollTarget) {
      setTimeout(() => {
        if (taskerActivityScrollTarget === 'active' && activeRef.current) {
          activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (taskerActivityScrollTarget === 'completed' && completedRef.current) {
          completedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setTaskerActivityScrollTarget(null);
      }, 100);
    }
  }, [taskerActivityScrollTarget, setTaskerActivityScrollTarget]);

  const PREVIEW_COUNT = 2;

  // Filter jobs for this tasker
  const taskerJobs = jobs.filter(j =>
    j.taskerId === userProfile?.id ||
    j.taskerName === userProfile?.name
  );

  const activeJobs = taskerJobs.filter(j => j.status === 'accepted' || j.status === 'in_progress');
  const completedJobs = taskerJobs.filter(j => j.status === 'completed');

  const displayActive = activeJobs;
  const displayCompleted = completedJobs;

  // Earnings calculations
  const totalEarned = displayCompleted.reduce((sum, j) => sum + (j.amount || 0), 0);
  const jobsCompletedCount = displayCompleted.length;

  // Current month earnings
  const now = new Date();
  const currentMonthJobs = displayCompleted.filter(j => {
    if (!j.timePosted) return false;
    const posted = new Date(j.timePosted);
    return posted.getMonth() === now.getMonth() && posted.getFullYear() === now.getFullYear();
  });
  const thisMonthEarnings = currentMonthJobs.reduce((sum, j) => sum + (j.amount || 0), 0);

  // Monthly breakdown (last 3 months)
  const getMonthName = (offset) => {
    const d = new Date();
    d.setMonth(d.getMonth() - offset);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const getEarningsForMonth = (offset) => {
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
      <div className="flex items-center px-4 py-4 bg-white border-b border-gray-100 shadow-xs shrink-0 z-10 sticky top-0 rounded-b-3xl">
        <button
          onClick={popScreen}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
          id="tasker-activity-back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-black text-dark ml-2">Earnings</span>
      </div>

      <div id="tasker-activity-scroll-container" className="flex-1 overflow-y-auto px-4 py-6 space-y-8 max-w-md lg:max-w-2xl lg:px-8 mx-auto w-full pb-20">

        {/* ─── Earnings Summary Hero Card ─── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden" id="earnings-summary-card">
          {/* Gradient accent strip */}
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300"></div>

          <div className="p-5 space-y-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <TrendingUp className="w-4.5 h-4.5 text-primary" />
              </div>
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Earnings Overview</h3>
            </div>

            {/* Hero stat */}
            <div className="text-center py-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Earned</span>
              <span className="text-4xl font-black text-dark tracking-tight leading-none" id="total-earned-value">
                ₹{totalEarned.toLocaleString('en-IN')}
              </span>
            </div>

            {/* 2-col mini grid */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <span className="text-xl font-black text-dark block leading-none" id="jobs-completed-value">{jobsCompletedCount}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1 block">Jobs Completed</span>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <span className="text-xl font-black text-dark block leading-none" id="this-month-value">₹{(thisMonthEarnings || 0).toLocaleString('en-IN')}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1 block">This Month</span>
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
            <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Monthly Earnings</h3>
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
                  ₹{entry.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskerActivityScreen;
