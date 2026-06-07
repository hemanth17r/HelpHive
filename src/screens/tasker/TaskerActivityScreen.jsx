import React, { useContext, useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock, CheckCircle, TrendingUp, Briefcase, CalendarDays, Users, Hash, ChevronDown, ChevronUp, Inbox, Check, X } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import { SKILLS } from '../../data/mockData';

const TaskerActivityScreen = () => {
  const { popScreen, jobs, userProfile, setUserProfile, pushScreen, setCurrentPostedJob, setAcceptedJob, taskerActivityScrollTarget, setTaskerActivityScrollTarget } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);

  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [editedUpiId, setEditedUpiId] = useState('');
  const [pulseUpi, setPulseUpi] = useState(false);

  const activeRef = useRef(null);
  const completedRef = useRef(null);
  const upiRef = useRef(null);

  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

  const handleSaveUpi = (e) => {
    if (e) e.preventDefault();
    const finalUpi = editedUpiId.trim();
    if (!upiRegex.test(finalUpi)) {
      showToast('Please enter a valid UPI ID (e.g. name@bank)', 'error');
      return;
    }
    setUserProfile({ ...userProfile, upiId: finalUpi });
    showToast('UPI ID saved successfully!', 'success');
    setIsEditingUpi(false);
  };

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
        if (taskerActivityScrollTarget === 'upi' && upiRef.current) {
          upiRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setPulseUpi(true);
          setTimeout(() => setPulseUpi(false), 2000);
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

        {/* ─── UPI ID / Receive Payments Section ─── */}
        <div ref={upiRef} className={`bg-white rounded-3xl shadow-sm overflow-hidden transition-all duration-300 ${pulseUpi ? 'border border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'border border-gray-100'}`} id="upi-settings-section">
          <div className="p-5 space-y-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-orange-50 rounded-xl">
                <Briefcase className="w-4.5 h-4.5 text-orange-500" />
              </div>
              <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Payment Settings</h3>
            </div>
            
            {!userProfile?.upiId ? (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <h3 className="text-[11px] font-black uppercase text-orange-600 tracking-wider mb-2">Receive Payments</h3>
                <p className="text-[10px] font-bold text-gray-500 mb-3">Add your UPI ID to receive payments directly from customers.</p>
                <form onSubmit={handleSaveUpi} className="flex flex-col space-y-2">
                  <input
                    type="text"
                    value={editedUpiId}
                    onChange={(e) => setEditedUpiId(e.target.value)}
                    placeholder="e.g. username@okhdfcbank"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-dark focus:outline-none focus:border-primary"
                  />
                  <button type="submit" disabled={!editedUpiId.trim()} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 flex justify-center">
                    Save UPI ID
                  </button>
                </form>
              </div>
            ) : (
              <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Receive Payments (UPI)</span>
                  {!isEditingUpi && (
                    <button onClick={() => { setEditedUpiId(userProfile.upiId); setIsEditingUpi(true); }} className="text-primary hover:bg-primary/10 p-1 rounded-md transition-colors cursor-pointer text-[10px] font-bold uppercase">
                      Edit
                    </button>
                  )}
                </div>
                {isEditingUpi ? (
                  <form onSubmit={handleSaveUpi} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editedUpiId}
                      onChange={(e) => setEditedUpiId(e.target.value)}
                      placeholder="e.g. username@okhdfcbank"
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs font-bold text-dark focus:outline-none focus:border-primary"
                    />
                    <button type="button" onClick={() => setIsEditingUpi(false)} className="text-gray-400 hover:text-red-500 p-1.5 cursor-pointer flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                    <button type="submit" disabled={!editedUpiId.trim()} className="text-primary hover:text-primary/80 p-1.5 cursor-pointer disabled:opacity-50 flex-shrink-0">
                      <Check className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <span className="text-sm font-bold text-dark truncate">{userProfile.upiId}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskerActivityScreen;
