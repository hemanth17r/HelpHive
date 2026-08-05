import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../store/AppContext';
import { api } from '../services/api';
import { reverseGeocode } from '../utils/geocoding';
import { 
  Shield, Users, Briefcase, TrendingUp, Activity, 
  AlertTriangle, CheckCircle, Clock, ArrowLeft,
  RefreshCw, ChevronDown, ChevronUp, BarChart3,
  UserCheck, Zap, LogIn, LogOut, Star, Flag,
  PlusCircle, Eye, XCircle, ToggleRight, MapPin, 
  WifiOff, Frown, HelpCircle
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
  
  // V2 Marketplace Metrics
  const [demandHotspots, setDemandHotspots] = useState([]);
  const [coverageGaps, setCoverageGaps] = useState([]);
  const [failedExperiences, setFailedExperiences] = useState([]);
  const [cityLeaderboard, setCityLeaderboard] = useState([]);

  // Pending Commission & Referral Approvals
  const [pendingCommissionPayments, setPendingCommissionPayments] = useState([]);
  const [pendingReferralPayouts, setPendingReferralPayouts] = useState([]);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const { data: comms } = await api.fetchPendingCommissionPayments();
      const { data: payouts } = await api.fetchPendingReferralPayouts();
      if (comms) setPendingCommissionPayments(comms);
      if (payouts) setPendingReferralPayouts(payouts);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      fetchPendingApprovals();
      const [statsRes, countsRes, timeseriesRes, eventsRes, hotspotsRes, gapsRes, failedRes, leaderboardRes] = await Promise.all([
        api.getDashboardStats(),
        api.getEventCounts(),
        api.getDailyTimeseries(null, activeTimeRange),
        api.getRecentEvents(50),
        api.getDemandHotspots(),
        api.getCoverageGaps(),
        api.getFailedFirstExperiences(),
        api.getCityLeaderboard()
      ]);

      if (statsRes.error) {
        if (statsRes.error.message?.includes('Unauthorized') || statsRes.error.message?.includes('access required')) {
          setError('Your session has expired or is unauthorized. Please try logging out and logging back in.');
        } else {
          setError(statsRes.error.message || 'Failed to load dashboard metrics.');
        }
        return;
      }

      if (statsRes.data) setStats(statsRes.data);
      if (countsRes.data) setEventCounts(countsRes.data);
      if (timeseriesRes.data) setTimeseries(timeseriesRes.data);
      if (eventsRes.data) setRecentEvents(eventsRes.data);
      if (failedRes.data) setFailedExperiences(failedRes.data);
      if (leaderboardRes.data) setCityLeaderboard(leaderboardRes.data);

      if (hotspotsRes.data) {
        setDemandHotspots(hotspotsRes.data);
        // Geocode unresolved hotspots asynchronously
        hotspotsRes.data.forEach(async (hotspot) => {
          if (hotspot.lat && hotspot.lng && (!hotspot.locationName || hotspot.locationName.startsWith('Location at') || hotspot.locationName === 'Unknown Location')) {
            try {
              const geo = await reverseGeocode(hotspot.lat, hotspot.lng);
              if (geo && geo.displayName) {
                setDemandHotspots(prev => 
                  prev.map(h => h.id === hotspot.id ? { ...h, locationName: geo.displayName } : h)
                );
              }
            } catch (err) {
              console.error('Failed to geocode hotspot:', err);
            }
          }
        });
      }

      if (gapsRes.data) {
        setCoverageGaps(gapsRes.data);
        // Geocode unresolved gaps asynchronously
        gapsRes.data.forEach(async (gap) => {
          if (gap.lat && gap.lng && (!gap.locationName || gap.locationName.startsWith('Location at') || gap.locationName === 'Unknown Location')) {
            try {
              const geo = await reverseGeocode(gap.lat, gap.lng);
              if (geo && geo.displayName) {
                setCoverageGaps(prev => 
                  prev.map(g => g.id === gap.id ? { ...g, locationName: geo.displayName } : g)
                );
              }
            } catch (err) {
              console.error('Failed to geocode gap:', err);
            }
          }
        });
      }
    } catch (e) {
      console.error('Dashboard data fetch error:', e);
    }
  }, [activeTimeRange]);

  // Self-heal/populate city column for legacy data
  const healCities = useCallback(async () => {
    try {
      const { data: unresolved } = await api.getUnresolvedCityLocations();
      if (unresolved && unresolved.length > 0) {
        let hasUpdates = false;
        for (const loc of unresolved) {
          try {
            const geo = await reverseGeocode(loc.lat, loc.lng);
            const locality = geo?.address?.find(c => c.types?.includes('locality'));
            let city = locality?.long_name || locality?.short_name;
            if (!city) {
              const adminArea2 = geo?.address?.find(c => c.types?.includes('administrative_area_level_2'));
              city = adminArea2?.long_name || adminArea2?.short_name;
            }
            if (!city && geo?.displayName) {
              const parts = geo.displayName.split(',').map(p => p.trim());
              if (parts.length >= 3) {
                const filtered = parts.filter(p => {
                  const lower = p.toLowerCase();
                  return lower !== 'india' && !/^\d{6}$/.test(p) && !lower.includes('telangana') && !lower.includes('punjab') && !lower.includes('andhra pradesh');
                });
                city = filtered.length > 0 ? filtered[filtered.length - 1] : parts[1] || parts[0];
              } else {
                city = parts[1] || parts[0];
              }
            }
            
            if (city) {
              if (loc.type === 'tasker') {
                await api.updateProfile(loc.id, { city });
              } else if (loc.type === 'address') {
                await api.updateAddress(loc.id, { city });
              }
              hasUpdates = true;
            }
          } catch (err) {
            console.error("Self-heal failed for id " + loc.id, err);
          }
        }
        if (hasUpdates) {
          // Re-fetch leaderboard to reflect healed cities
          const leaderboardRes = await api.getCityLeaderboard();
          if (leaderboardRes.data) setCityLeaderboard(leaderboardRes.data);
        }
      }
    } catch (e) {
      console.error("Error healing cities:", e);
    }
  }, []);

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
        healCities();
      } catch (e) {
        setError('Failed to verify admin access.');
      }
      setLoading(false);
    };
    verify();
  }, [userId, fetchAllData, healCities]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setTimeout(() => setRefreshing(false), 500);
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
    <div className="flex-1 flex flex-col pb-20 bg-gray-50/30">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-5 sm:px-6 shrink-0">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between mb-1">
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
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column (2/3 width on desktop) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Core Platform Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard 
                  icon={Users} 
                  label="Total Accounts" 
                  value={stats?.total_accounts ?? '—'} 
                  sub="Registered profiles"
                  color="indigo"
                />
                <StatCard 
                  icon={HelpCircle} 
                  label="Explorers (Drop-off)" 
                  value={stats?.explorer_drop_off ?? '—'} 
                  sub="Incomplete onboarding"
                  color="gray"
                />
                <StatCard 
                  icon={Users} 
                  label="Serious Taskers" 
                  value={stats?.total_taskers ?? '—'} 
                  sub={`${stats?.users_today ?? 0} active today`}
                  color="blue"
                />
                <StatCard 
                  icon={Users} 
                  label="Serious Hirers" 
                  value={stats?.total_hirers ?? '—'} 
                  sub="Onboarded & Active"
                  color="purple"
                />
              </div>

              {/* Job Pipeline Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard 
                  icon={Briefcase} 
                  label="Total Jobs" 
                  value={stats?.total_jobs ?? '—'} 
                  sub={`${stats?.jobs_today ?? 0} today`}
                  color="orange"
                />
                <StatCard 
                  icon={Zap} 
                  label="Active Jobs" 
                  value={stats?.active_jobs ?? '—'} 
                  sub="open & accepted"
                  color="blue"
                />
              </div>

              {/* Actionable Pipeline */}
              <div className="grid grid-cols-2 gap-4">
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

              {/* Activity Chart */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
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
                <MiniBarChart data={chartData} height={120} />
                <div className="flex justify-between mt-2 px-1">
                  <span className="text-[10px] text-gray-400 font-semibold">
                    {chartData[0]?.label || ''}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    {chartData[chartData.length - 1]?.label || ''}
                  </span>
                </div>
              </div>

              {/* Job Status Breakdown */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Job Pipeline</h3>
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

              {/* Event Breakdown */}
              {eventCounts.length > 0 && (() => {
                const maxCount = Math.max(...eventCounts.map(e => parseInt(e.event_count)), 1);
                return (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Event Breakdown (30d)</h3>
                    <div className="space-y-3">
                      {eventCounts.map(ec => {
                        const Icon = EVENT_ICONS[ec.event_type] || Activity;
                        const colorClass = EVENT_COLORS[ec.event_type] || 'text-gray-500 bg-gray-50';
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
                );
              })()}

            </div>

            {/* Right Column (1/3 width on desktop) */}
            <div className="space-y-6">
              
              {/* Top Cities Leaderboard */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-dark">Top Cities</h3>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    India
                  </span>
                </div>

                {cityLeaderboard.length === 0 ? (
                  <p className="text-xs text-gray-400 font-semibold py-4 text-center">No city data available yet</p>
                ) : (
                  <div className="space-y-3.5">
                    {cityLeaderboard.map((item, index) => {
                      const maxVal = cityLeaderboard[0]?.total_count || 1;
                      const percentage = ((item.total_count / maxVal) * 100).toFixed(0);
                      
                      // Rank styling
                      const ranks = [
                        { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: '🏆' },
                        { badge: 'bg-slate-100 text-slate-700 border-slate-200', label: '🥈' },
                        { badge: 'bg-orange-100 text-orange-700 border-orange-200', label: '🥉' }
                      ];
                      const defaultRank = { badge: 'bg-gray-50 text-gray-500 border-gray-100', label: `#${index + 1}` };
                      const rankInfo = ranks[index] || defaultRank;

                      return (
                        <div key={item.city_name} className="space-y-1.5 group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-[10px] font-black shrink-0 ${rankInfo.badge}`}>
                                {rankInfo.label}
                              </span>
                              <span className="text-xs font-bold text-dark truncate group-hover:text-primary transition-colors">
                                {item.city_name}
                              </span>
                            </div>
                            <div className="text-[11px] font-extrabold text-gray-500 text-right shrink-0">
                              {item.total_count} <span className="text-[9px] text-gray-400 font-bold">({item.hirer_count}H, {item.tasker_count}T)</span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-50 rounded-full overflow-hidden relative border border-gray-100/50">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                index === 0 ? 'bg-amber-500' :
                                index === 1 ? 'bg-slate-400' :
                                index === 2 ? 'bg-orange-400' : 'bg-primary'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Platform Health Q&A */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Platform Health Q&A</h3>
                
                <div className="space-y-4">
                  {/* Q1 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-dark">Are people showing up?</p>
                      <p className="text-[10px] font-semibold text-gray-500 mt-0.5">
                        <span className="text-blue-600 font-bold">{stats?.signups_today ?? 0}</span> new signups today • <span className="text-blue-600 font-bold">{stats?.logins_today ?? 0}</span> sign-ins today
                      </p>
                    </div>
                  </div>

                  {/* Q2 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-dark">Are jobs getting posted?</p>
                      <p className="text-[10px] font-semibold text-gray-500 mt-0.5">
                        <span className="text-orange-600 font-bold">{stats?.jobs_today ?? 0}</span> new tasks created today
                      </p>
                    </div>
                  </div>

                  {/* Q3 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-dark">Are jobs getting done?</p>
                      <p className="text-[10px] font-semibold text-gray-500 mt-0.5">
                        <span className="text-green-600 font-bold">{stats?.acceptances_today ?? 0}</span> tasks accepted today • <span className="text-emerald-600 font-bold">{stats?.completions_today ?? 0}</span> completed today
                      </p>
                    </div>
                  </div>

                  {/* Q4 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-dark">Is anything broken?</p>
                      <p className="text-[10px] font-semibold text-gray-500 mt-0.5">
                        <span className={stats?.cancellations_today > 0 ? "text-red-500 font-bold" : "text-gray-500 font-semibold"}>
                          {stats?.cancellations_today ?? 0} cancellations today
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* V2 Metric: Demand Hotspots */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-orange-500">Demand Hotspots</h3>
                  </div>
                </div>
                {demandHotspots.length === 0 ? (
                  <p className="text-xs text-gray-400 font-semibold py-4 text-center">No active hotspots</p>
                ) : (
                  <div className="space-y-3.5">
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
                            <span className="font-semibold text-red-500"><span className="font-black text-red-600">{hotspot.supplyDeficit}</span> Missing</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* V2 Metric: Coverage Gaps */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-red-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-red-500">Coverage Gaps</h3>
                  </div>
                </div>
                {coverageGaps.length === 0 ? (
                  <p className="text-xs text-gray-400 font-semibold py-4 text-center">No coverage gaps detected</p>
                ) : (
                  <div className="space-y-3.5">
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
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Frown className="w-4 h-4 text-purple-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-500">Failed First Experiences</h3>
                  </div>
                </div>
                {failedExperiences.length === 0 ? (
                  <p className="text-xs text-gray-400 font-semibold py-4 text-center">No failures tracking</p>
                ) : (
                  <div className="space-y-2.5">
                    {failedExperiences.map(failed => (
                      <div key={failed.id} className="flex justify-between items-center border border-gray-100 rounded-lg p-2.5 bg-gray-50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                            <Frown className="w-3 h-3" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-dark">{failed.reason.replace(/_/g, ' ')}</div>
                            <div className="text-[10px] font-semibold text-gray-500">
                              {failed.userName || 'Unknown User'} {failed.userPhone ? `(${failed.userPhone})` : ''} | <span className="uppercase">{failed.role}</span> | {timeAgo(failed.date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
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
                    <p className="text-[10px] text-gray-400 mt-1">Events will appear as users interact</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
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
                    className="w-full mt-3 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    {showAllEvents ? (
                      <>Show Less <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Show All ({recentEvents.length}) <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>



              {/* Commission Payment Approvals */}
              <div className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-dark flex items-center gap-2">
                    <span>💼 Pending Commission Payments</span>
                    <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {pendingCommissionPayments.length}
                    </span>
                  </h3>
                </div>

                {pendingCommissionPayments.length === 0 ? (
                  <p className="text-xs text-gray-400 font-semibold py-1">No pending commission payments to verify.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingCommissionPayments.map((p) => {
                      const tObj = p.tasker || {};
                      return (
                        <div key={p.id} className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 text-xs">
                            <div className="font-bold text-dark flex items-center gap-2">
                              <span>👤 {tObj.name || 'Tasker'}</span>
                              <span className="text-gray-500 font-normal">({tObj.phone || 'No phone'})</span>
                            </div>
                            <p className="text-gray-600 font-medium">
                              Claimed Paid Amount: <span className="font-black text-amber-700">₹{parseFloat(p.amount_paid).toFixed(2)}</span>
                            </p>
                            <p className="text-[10px] text-gray-400">
                              Current Pending Dues: ₹{parseFloat(tObj.unpaid_commission_dues || 0).toFixed(2)} • Submitted: {timeAgo(p.created_at)}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={async () => {
                                const { error } = await api.approveCommissionPayment(p.id);
                                if (!error) fetchPendingApprovals();
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors shadow-xs"
                            >
                              Approve Payment (₹{parseFloat(p.amount_paid).toFixed(0)})
                            </button>

                            <button
                              onClick={async () => {
                                const { error } = await api.declineCommissionPayment(p.id);
                                if (!error) fetchPendingApprovals();
                              }}
                              className="bg-gray-100 hover:bg-red-50 text-red-600 font-bold text-xs px-3 py-2 rounded-xl cursor-pointer transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Referral Payout Requests */}
              <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-dark flex items-center gap-2">
                    <span>🎁 Pending Referral Payout Requests</span>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {pendingReferralPayouts.length}
                    </span>
                  </h3>
                </div>

                {pendingReferralPayouts.length === 0 ? (
                  <p className="text-xs text-gray-400 font-semibold py-1">No pending referral payout requests.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingReferralPayouts.map((p) => {
                      const rObj = p.referrer || {};
                      return (
                        <div key={p.id} className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 text-xs">
                            <div className="font-bold text-dark flex items-center gap-2">
                              <span>👤 {rObj.name || 'User'}</span>
                              <span className="text-gray-500 font-normal">({rObj.phone || 'No phone'})</span>
                            </div>
                            <p className="text-gray-600 font-medium">
                              UPI ID: <span className="font-black text-dark bg-white px-2 py-0.5 rounded border border-gray-200">{p.upi_id || rObj.upi_id}</span>
                            </p>
                            <p className="text-gray-600 font-medium">
                              Requested Payout: <span className="font-black text-emerald-700">₹{parseFloat(p.amount).toFixed(2)}</span>
                            </p>
                            <p className="text-[10px] text-gray-400">
                              Submitted: {timeAgo(p.created_at)}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${p.upi_id || rObj.upi_id} ${p.amount}`);
                              }}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs px-3 py-2 rounded-xl cursor-pointer transition-colors flex items-center space-x-1"
                            >
                              <span>Copy UPI</span>
                            </button>

                            <button
                              onClick={async () => {
                                const { error } = await api.approveReferralPayout(p.id);
                                if (!error) fetchPendingApprovals();
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors shadow-xs"
                            >
                              Mark Paid (₹{parseFloat(p.amount).toFixed(0)})
                            </button>

                            <button
                              onClick={async () => {
                                const { error } = await api.declineReferralPayout(p.id);
                                if (!error) fetchPendingApprovals();
                              }}
                              className="bg-gray-100 hover:bg-red-50 text-red-600 font-bold text-xs px-3 py-2 rounded-xl cursor-pointer transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* System Info */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">System</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-[10px] text-gray-500 font-medium">
                    <span className="text-gray-400">Events:</span> {stats?.total_events ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    <span className="text-gray-400">Today:</span> {stats?.events_today ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    <span className="text-gray-400">Active users:</span> {stats?.users_today ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    <span className="text-gray-400">Jobs today:</span> {stats?.jobs_today ?? 0}
                  </div>
                </div>
              </div>

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
    purple: 'text-purple-600 bg-purple-50',
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
