import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../store/AppContext';
import { api } from '../services/api';
import { 
  Shield, Users, Briefcase, TrendingUp, Activity, 
  AlertTriangle, CheckCircle, Clock, ArrowLeft,
  RefreshCw, ChevronDown, ChevronUp, BarChart3,
  UserCheck, Zap, LogIn, LogOut, Star, Flag,
  PlusCircle, Eye, XCircle, ToggleRight, MapPin, 
  WifiOff, Frown
} from 'lucide-react';
import { SKILLS } from '../config/constants';

const EVENT_ICONS = {
  signup: UserCheck,
  login: LogIn,
  logout: LogOut,
  role_switch: ToggleRight,
  task_creation: PlusCircle,
  task_viewed: Eye,
  task_acceptance: CheckCircle,
  task_completion: Zap,
  task_cancellation: XCircle,
  rating_submitted: Star,
  badge_sent: Star,
  report_submitted: Flag,
  critical_failure: AlertTriangle,
  action_error: AlertTriangle,
};

const EVENT_COLORS = {
  signup: 'text-emerald-600 bg-emerald-50',
  login: 'text-blue-600 bg-blue-50',
  logout: 'text-gray-500 bg-gray-50',
  role_switch: 'text-purple-600 bg-purple-50',
  task_creation: 'text-orange-600 bg-orange-50',
  task_viewed: 'text-sky-500 bg-sky-50',
  task_acceptance: 'text-green-600 bg-green-50',
  task_completion: 'text-emerald-700 bg-emerald-50',
  task_cancellation: 'text-red-500 bg-red-50',
  rating_submitted: 'text-amber-600 bg-amber-50',
  badge_sent: 'text-yellow-600 bg-yellow-50',
  report_submitted: 'text-red-600 bg-red-50',
  critical_failure: 'text-red-700 bg-red-100',
  action_error: 'text-orange-700 bg-orange-100',
};

// Relative time helper
const timeAgo = (dateStr) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

// Simple SVG bar chart component
const MiniBarChart = ({ data, height = 120 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-xs font-semibold" style={{ height }}>
        No data yet — events will appear as users interact
      </div>
    );
  }
  
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const barWidth = Math.max(4, Math.min(20, Math.floor((100 / data.length) * 2)));
  
  return (
    <div className="flex items-end justify-between gap-[2px] px-1" style={{ height }}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.count / maxVal) * (height - 24));
        return (
          <div key={i} className="flex flex-col items-center flex-1 min-w-0 group relative">
            <div 
              className="w-full bg-orange-400 rounded-t-sm transition-all duration-200 group-hover:bg-orange-500 min-w-[4px] max-w-[20px] mx-auto"
              style={{ height: barH }}
            />
            {/* Tooltip on hover */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-dark text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap z-10 shadow-lg">
              {d.label}: {d.count}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AdminDashboard = () => {
  const { popScreen, pushScreen, userId, isAdmin } = useContext(AppContext);
  
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState(null);
  const [eventCounts, setEventCounts] = useState([]);
  const [timeseries, setTimeseries] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [activeTimeRange, setActiveTimeRange] = useState(30);
  const [helpReports, setHelpReports] = useState([]);
  
  // V2 Marketplace Metrics
  const [demandHotspots, setDemandHotspots] = useState([]);
  const [coverageGaps, setCoverageGaps] = useState([]);
  const [failedExperiences, setFailedExperiences] = useState([]);

  const fetchAllData = useCallback(async () => {
    try {
      const [statsRes, countsRes, timeseriesRes, eventsRes, reportsRes, hotspotsRes, gapsRes, failedRes] = await Promise.all([
        api.getDashboardStats(),
        api.getEventCounts(),
        api.getDailyTimeseries(null, activeTimeRange),
        api.getRecentEvents(50),
        api.getHelpReports(),
        api.getDemandHotspots(),
        api.getCoverageGaps(),
        api.getFailedFirstExperiences()
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (countsRes.data) setEventCounts(countsRes.data);
      if (timeseriesRes.data) setTimeseries(timeseriesRes.data);
      if (eventsRes.data) setRecentEvents(eventsRes.data);
      if (reportsRes.data) setHelpReports(reportsRes.data);
      if (hotspotsRes.data) setDemandHotspots(hotspotsRes.data);
      if (gapsRes.data) setCoverageGaps(gapsRes.data);
      if (failedRes.data) setFailedExperiences(failedRes.data);
    } catch (e) {
      console.error('Dashboard data fetch error:', e);
    }
  }, [activeTimeRange]);

  // Verify admin on mount — double-check via DB even if isAdmin is true in state
  useEffect(() => {
    const verify = async () => {
      if (!userId) {
        setLoading(false);
        setError('Not authenticated');
        return;
      }

      try {
        const isVerified = await api.verifyAdmin(userId);
        if (!isVerified) {
          setAuthorized(false);
          setLoading(false);
          setError('Access denied. Admin privileges required.');
          return;
        }
        setAuthorized(true);
        await fetchAllData();
      } catch (e) {
        setError('Failed to verify admin access.');
      }
      setLoading(false);
    };
    verify();
  }, [userId, fetchAllData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleResolveReport = async (id) => {
    const { error } = await api.updateHelpReportStatus(id, 'resolved');
    if (!error) {
      setHelpReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
    }
  };

  // Compute derived metrics
  const fillRate = stats ? 
    (stats.total_jobs > 0 ? ((stats.accepted_jobs + stats.completed_jobs) / stats.total_jobs * 100).toFixed(0) : '0') : '—';
  const completionRate = stats ?
    ((stats.accepted_jobs + stats.completed_jobs) > 0 ? (stats.completed_jobs / (stats.accepted_jobs + stats.completed_jobs) * 100).toFixed(0) : '0') : '—';

  // Build chart data from timeseries
  const chartData = (() => {
    if (!timeseries || timeseries.length === 0) return [];
    
    // Group by day
    const dayMap = {};
    timeseries.forEach(row => {
      const day = row.day;
      if (!dayMap[day]) dayMap[day] = 0;
      dayMap[day] += parseInt(row.event_count);
    });
    
    // Fill missing days
    const days = [];
    const now = new Date();
    for (let i = activeTimeRange - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      days.push({ label, count: dayMap[key] || 0 });
    }
    return days;
  })();

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Access denied state
  if (!authorized || error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-black text-dark mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 font-medium mb-6">{error || 'You do not have admin privileges.'}</p>
          <button 
            onClick={popScreen}
            className="bg-dark text-white px-6 py-2.5 rounded-xl text-sm font-bold cursor-pointer hover:bg-gray-800 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayedEvents = showAllEvents ? recentEvents : recentEvents.slice(0, 15);

  return (
    <div className="flex-1 flex flex-col pb-20">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <button 
              onClick={popScreen}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-400" />
                <h1 className="text-white font-black text-lg">Admin Dashboard</h1>
              </div>
              <p className="text-gray-400 text-xs font-semibold mt-0.5">
                HelpHive Platform Health
              </p>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            className={`p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        
        {/* Core Platform Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard 
            icon={Users} 
            label="Total Users" 
            value={stats?.total_users ?? '—'} 
            sub={`${stats?.users_today ?? 0} today`}
            color="blue"
          />
          <StatCard 
            icon={Briefcase} 
            label="Total Jobs" 
            value={stats?.total_jobs ?? '—'} 
            sub={`${stats?.jobs_today ?? 0} today`}
            color="orange"
          />
        </div>

        {/* Actionable Pipeline */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard 
            icon={TrendingUp} 
            label="Fill Rate" 
            value={`${fillRate}%`} 
            sub="accepted / posted"
            color="green"
          />
          <StatCard 
            icon={CheckCircle} 
            label="Completion" 
            value={`${completionRate}%`} 
            sub="completed / filled"
            color="emerald"
          />
        </div>

        {/* Job Status Breakdown */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Job Pipeline</h3>
          <div className="flex items-center gap-2">
            <PipelineItem label="Open" value={stats?.open_jobs ?? 0} color="bg-blue-500" />
            <div className="text-gray-300">→</div>
            <PipelineItem label="Accepted" value={stats?.accepted_jobs ?? 0} color="bg-orange-500" />
            <div className="text-gray-300">→</div>
            <PipelineItem label="Completed" value={stats?.completed_jobs ?? 0} color="bg-emerald-500" />
            {(stats?.expired_jobs > 0) && (
              <>
                <div className="text-gray-300 ml-2">|</div>
                <PipelineItem label="Expired" value={stats?.expired_jobs ?? 0} color="bg-gray-400" />
              </>
            )}
          </div>
        </div>

        {/* Activity Chart */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Activity</h3>
            </div>
            <div className="flex gap-1">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setActiveTimeRange(d)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                    activeTimeRange === d 
                      ? 'bg-dark text-white' 
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <MiniBarChart data={chartData} height={100} />
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[10px] text-gray-400 font-semibold">
              {chartData[0]?.label || ''}
            </span>
            <span className="text-[10px] text-gray-400 font-semibold">
              {chartData[chartData.length - 1]?.label || ''}
            </span>
          </div>
        </div>

        {/* Event Breakdown */}
        {eventCounts.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Event Breakdown (30d)</h3>
            <div className="space-y-2">
              {eventCounts.map(ec => {
                const Icon = EVENT_ICONS[ec.event_type] || Activity;
                const colorClass = EVENT_COLORS[ec.event_type] || 'text-gray-500 bg-gray-50';
                const maxCount = Math.max(...eventCounts.map(e => parseInt(e.event_count)), 1);
                const barWidth = (parseInt(ec.event_count) / maxCount * 100);
                return (
                  <div key={ec.event_type} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-dark truncate">{ec.event_type.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-black text-gray-600 ml-2">{ec.event_count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-400 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* V2 Metric: Demand Hotspots */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-orange-500">Demand Hotspots</h3>
            </div>
          </div>
          {demandHotspots.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-4 text-center">No active hotspots</p>
          ) : (
            <div className="space-y-3">
              {demandHotspots.map(hotspot => {
                const skill = SKILLS.find(s => s.id === hotspot.categoryId);
                return (
                  <div key={hotspot.id} className="border border-orange-100 rounded-xl p-3 bg-orange-50/30">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-black text-dark">{hotspot.locationName || hotspot.label}</h4>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        hotspot.urgency === 'high' ? 'bg-red-100 text-red-600' : 
                        hotspot.urgency === 'medium' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {hotspot.urgency.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-gray-500 mb-2">{skill ? skill.label : hotspot.categoryId}</p>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold"><span className="font-black text-dark">{hotspot.waitlistCount}</span> Waitlisted</span>
                      <span className="font-semibold text-red-500"><span className="font-black text-red-600">{hotspot.supplyDeficit}</span> Missing Taskers</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* V2 Metric: Coverage Gaps */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-red-500">Coverage Gaps</h3>
            </div>
          </div>
          {coverageGaps.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-4 text-center">No coverage gaps detected</p>
          ) : (
            <div className="space-y-3">
              {coverageGaps.map(gap => {
                const skill = SKILLS.find(s => s.id === gap.categoryId);
                return (
                  <div key={gap.id} className="border border-red-100 rounded-xl p-3 bg-red-50/30 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-black text-dark">{gap.locationName || gap.label}</h4>
                      <p className="text-[10px] font-bold text-gray-500">{skill ? skill.label : gap.categoryId}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-red-500">{gap.missingSupply} needed</div>
                      <div className="text-[10px] font-semibold text-gray-500">Vol: {gap.demandVolume}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* V2 Metric: Failed First Experiences */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Frown className="w-4 h-4 text-purple-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-500">Failed First Experiences</h3>
            </div>
          </div>
          {failedExperiences.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-4 text-center">No failures tracking</p>
          ) : (
            <div className="space-y-2">
              {failedExperiences.map(failed => (
                <div key={failed.id} className="flex justify-between items-center border border-gray-100 rounded-lg p-2 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                      <Frown className="w-3 h-3" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-dark">{failed.reason.replace(/_/g, ' ')}</div>
                      <div className="text-[10px] font-semibold text-gray-500">Role: <span className="uppercase">{failed.role}</span> | {timeAgo(failed.date)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Recent Activity</h3>
            </div>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {stats?.total_events ?? 0} total
            </span>
          </div>
          
          {displayedEvents.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-400">No events yet</p>
              <p className="text-[10px] text-gray-400 mt-1">Events will appear as users interact with the platform</p>
            </div>
          ) : (
            <div className="space-y-1">
              {displayedEvents.map(event => {
                const Icon = EVENT_ICONS[event.event_type] || Activity;
                const colorClass = EVENT_COLORS[event.event_type] || 'text-gray-500 bg-gray-50';
                return (
                  <div key={event.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-dark">{event.event_type.replace(/_/g, ' ')}</span>
                        {event.active_role && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            event.active_role === 'tasker' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                          }`}>
                            {event.active_role}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium mt-0.5 truncate">
                        {event.user_name || 'Anonymous'} {event.user_phone ? `(${event.user_phone})` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap shrink-0">
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          
          {recentEvents.length > 15 && (
            <button 
              onClick={() => setShowAllEvents(!showAllEvents)}
              className="w-full mt-2 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              {showAllEvents ? (
                <>Show Less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show All ({recentEvents.length}) <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>

        {/* Help Reports Section */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-red-500">User Help Reports</h3>
            </div>
            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              {helpReports.filter(r => r.status === 'pending').length} pending
            </span>
          </div>

          {helpReports.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-400">No help reports!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {helpReports.slice(0, 10).map(report => (
                <div key={report.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          report.status === 'pending' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {report.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold">{timeAgo(report.created_at)}</span>
                      </div>
                      <p className="text-xs font-medium text-dark">{report.description}</p>
                      {report.user_id && (
                        <p className="text-[10px] text-gray-500 mt-1 font-semibold truncate">User ID: {report.user_id}</p>
                      )}
                    </div>
                  </div>
                  {report.status === 'pending' && (
                    <button
                      onClick={() => handleResolveReport(report.id)}
                      className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer w-full mt-2 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Mark as Resolved
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Info */}
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">System</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-[10px] text-gray-500 font-medium">
              <span className="text-gray-400">Events tracked:</span> {stats?.total_events ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">
              <span className="text-gray-400">Events today:</span> {stats?.events_today ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">
              <span className="text-gray-400">Active users today:</span> {stats?.users_today ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">
              <span className="text-gray-400">Jobs today:</span> {stats?.jobs_today ?? 0}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, sub, color }) => {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50',
    orange: 'text-orange-600 bg-orange-50',
    green: 'text-green-600 bg-green-50',
    emerald: 'text-emerald-600 bg-emerald-50',
  };
  const colors = colorMap[color] || colorMap.blue;
  
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3.5 shadow-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-black text-dark">{value}</p>
      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{sub}</p>
    </div>
  );
};

// Pipeline Item Component
const PipelineItem = ({ label, value, color }) => (
  <div className="flex-1 text-center">
    <div className={`h-2 ${color} rounded-full mb-1.5`} />
    <p className="text-sm font-black text-dark">{value}</p>
    <p className="text-[9px] font-bold text-gray-400 uppercase">{label}</p>
  </div>
);

export default AdminDashboard;
