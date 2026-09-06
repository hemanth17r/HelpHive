import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Search, X, Flame, Zap, Globe, MapPin, Check } from 'lucide-react';
import { HERO_DISCIPLINES, GAME_SKILLS } from '../config/skillRegistry';

/**
 * SkillPicker
 *
 * Single Source of Truth for skill selection across HelpHive.
 * Fully context-aware and respects section-specific layouts:
 *
 * Props:
 *  - mode: 'single' | 'multi' (default: 'single')
 *  - selected: string (for single) | string[] (for multi)
 *  - onSelect: (skillId: string, skillObj: object) => void
 *  - layout: 'accordion' | 'modal' | 'grid' (default: 'grid')
 *  - showCustomBountyOption: boolean (shows fallback custom bounty buttons on empty search in PostJob)
 *  - onSelectCustomBounty: (type: 'physical' | 'remote') => void
 *  - maxHeight: string (optional container height override, e.g. '360px')
 *  - searchPlaceholder: string
 */
const SkillPicker = ({
  mode = 'single',
  selected,
  onSelect,
  layout = 'grid', // 'grid' | 'accordion' | 'modal'
  showCustomBountyOption = false,
  onSelectCustomBounty = null,
  maxHeight = null,
  searchPlaceholder = 'Search skills (e.g. Driver, Drone, Chef, Reels)...'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState('all');

  // Multi-select set for O(1) membership check
  const selectedSet = useMemo(() => {
    if (Array.isArray(selected)) {
      return new Set(selected);
    }
    return new Set(selected ? [selected] : []);
  }, [selected]);

  // Scroll and tab synchronization refs for accordion & modal layouts
  const scrollContainerRef = useRef(null);
  const tabsScrollRef = useRef(null);
  const categoryRefs = useRef({});
  const tabButtonRefs = useRef({});
  const isManualScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Grouped skills by discipline
  const groupedSkills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return HERO_DISCIPLINES.map(discipline => {
      const skillsInDiscipline = GAME_SKILLS.filter(s => s.disciplineId === discipline.id);
      const filtered = skillsInDiscipline.filter(skill => {
        if (!q) return true;
        return (
          skill.label.toLowerCase().includes(q) ||
          skill.shortLabel?.toLowerCase().includes(q) ||
          skill.tagline?.toLowerCase().includes(q) ||
          skill.aliases?.some(a => a.toLowerCase().includes(q)) ||
          skill.examples?.some(e => e.toLowerCase().includes(q))
        );
      });
      return {
        discipline,
        skills: filtered
      };
    }).filter(group => group.skills.length > 0);
  }, [searchQuery]);

  // Flat list for grid mode or filtered by selected discipline tab
  const flatFilteredSkills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return GAME_SKILLS.filter(skill => {
      if (selectedDisciplineId !== 'all' && skill.disciplineId !== selectedDisciplineId) {
        return false;
      }
      if (!q) return true;
      return (
        skill.label.toLowerCase().includes(q) ||
        skill.shortLabel?.toLowerCase().includes(q) ||
        skill.tagline?.toLowerCase().includes(q) ||
        skill.aliases?.some(a => a.toLowerCase().includes(q)) ||
        skill.examples?.some(e => e.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedDisciplineId]);

  const totalMatches = useMemo(() => {
    return groupedSkills.reduce((sum, g) => sum + g.skills.length, 0);
  }, [groupedSkills]);

  // Smoothly center the active tab horizontally
  const scrollToTab = useCallback((tabId) => {
    const tabEl = tabButtonRefs.current[tabId];
    const container = tabsScrollRef.current;
    if (tabEl && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      const offset = (tabRect.left - containerRect.left) + container.scrollLeft;
      const targetScroll = offset - (container.clientWidth / 2) + (tabEl.clientWidth / 2);
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, []);

  // Tapping a category tab in accordion/modal mode
  const handleCategoryTabClick = useCallback((disciplineId) => {
    setSelectedDisciplineId(disciplineId);
    scrollToTab(disciplineId);

    if (layout === 'grid') return; // Grid mode filters flat list directly

    const container = scrollContainerRef.current;
    if (!container) return;

    isManualScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    const sectionEl = categoryRefs.current[disciplineId];
    if (sectionEl) {
      const containerRect = container.getBoundingClientRect();
      const sectionRect = sectionEl.getBoundingClientRect();
      const targetScroll = container.scrollTop + (sectionRect.top - containerRect.top);
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 600);
  }, [layout, scrollToTab]);

  // Vertical scrollspy for accordion / modal modes
  const handleVerticalScroll = useCallback(() => {
    if (layout === 'grid' || isManualScrollingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container || groupedSkills.length === 0) return;

    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 15) {
      const lastGroup = groupedSkills[groupedSkills.length - 1];
      if (lastGroup && selectedDisciplineId !== lastGroup.discipline.id) {
        setSelectedDisciplineId(lastGroup.discipline.id);
        scrollToTab(lastGroup.discipline.id);
      }
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const threshold = containerRect.top + 45;

    let activeId = groupedSkills[0]?.discipline.id;
    for (const group of groupedSkills) {
      const el = categoryRefs.current[group.discipline.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold) {
          activeId = group.discipline.id;
        }
      }
    }

    if (activeId && activeId !== selectedDisciplineId) {
      setSelectedDisciplineId(activeId);
      scrollToTab(activeId);
    }
  }, [layout, groupedSkills, selectedDisciplineId, scrollToTab]);

  const handleItemClick = (skill) => {
    if (onSelect) {
      onSelect(skill.id, skill);
    }
  };

  // -------------------------------------------------------------
  // RENDER: Skill Item Card (Unified Standard)
  // -------------------------------------------------------------
  const renderSkillCard = (skill) => {
    const isSelected = mode === 'single'
      ? (selected === skill.id || selected === skill.categoryId)
      : selectedSet.has(skill.id);
    const SkillIcon = skill.icon || Zap;
    const isCyber = skill.type === 'remote';

    return (
      <button
        key={skill.id}
        type="button"
        onClick={() => handleItemClick(skill)}
        className={`w-full relative flex items-center p-3 rounded-2xl border transition-all cursor-pointer text-left active-scale ${
          isSelected
            ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20 text-primary'
            : 'bg-white border-slate-200 hover:border-slate-300 text-dark shadow-2xs'
        }`}
      >
        {/* Skill Icon */}
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 mr-3 transition-colors ${
          isSelected ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600'
        }`}>
          <SkillIcon className="w-4 h-4" />
        </div>

        {/* Skill Details */}
        <div className="flex-1 min-w-0 pr-2">
          <h4 className={`text-xs font-black tracking-tight leading-snug truncate ${
            isSelected ? 'text-primary' : 'text-slate-900'
          }`}>
            {skill.label}
          </h4>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
              isCyber ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {isCyber ? (
                <>
                  <Globe className="w-2.5 h-2.5" />
                  <span>Cyber</span>
                </>
              ) : (
                <>
                  <MapPin className="w-2.5 h-2.5" />
                  <span>Field</span>
                </>
              )}
            </span>

            {skill.isHighDemand && (
              <span className="text-orange-500 inline-flex items-center" title="High Demand">
                <Flame className="w-3 h-3 fill-orange-500/20" />
              </span>
            )}
          </div>
        </div>

        {/* Multi-Select Checkbox Indicator */}
        {mode === 'multi' && (
          <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
            isSelected
              ? 'bg-primary border-primary text-white shadow-xs'
              : 'border-slate-200 bg-slate-50'
          }`}>
            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Search Bar */}
      <div className="relative shrink-0">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-bold text-dark focus:outline-none focus:border-primary transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Discipline Tabs */}
      <div
        ref={tabsScrollRef}
        className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1 shrink-0 scroll-smooth"
      >
        {layout === 'grid' && (
          <button
            type="button"
            onClick={() => setSelectedDisciplineId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedDisciplineId === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Disciplines ({GAME_SKILLS.length})
          </button>
        )}

        {HERO_DISCIPLINES.map(d => {
          const hasMatches = groupedSkills.some(g => g.discipline.id === d.id);
          if (searchQuery.trim() && !hasMatches) return null;

          const count = GAME_SKILLS.filter(s => s.disciplineId === d.id).length;
          const isCurrent = selectedDisciplineId === d.id;

          return (
            <button
              key={d.id}
              type="button"
              ref={el => tabButtonRefs.current[d.id] = el}
              onClick={() => handleCategoryTabClick(d.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {d.shortTitle || d.title} {layout === 'grid' && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Selected count info banner (for multi-selection in grid/modal) */}
      {mode === 'multi' && (
        <div className="flex items-center justify-between px-1 text-xs font-bold shrink-0">
          <span className="text-slate-500">
            {layout === 'grid' ? flatFilteredSkills.length : totalMatches} available
          </span>
          <span className="text-primary font-black">
            {selectedSet.size} selected
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LAYOUT 1: GRID MODE (Used in Setup Wizard & Onboarding Screen) */}
      {/* ------------------------------------------------------------- */}
      {layout === 'grid' && (
        <div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pb-2 overflow-y-auto"
          style={maxHeight ? { maxHeight } : {}}
        >
          {flatFilteredSkills.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-2 bg-white rounded-2xl border border-dashed border-slate-200">
              <Search className="w-8 h-8 text-slate-300" />
              <h4 className="text-xs font-bold text-slate-600">No matching skills found</h4>
              <p className="text-[11px] text-slate-400">Try searching for a different keyword or clear search</p>
            </div>
          ) : (
            flatFilteredSkills.map(skill => renderSkillCard(skill))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LAYOUT 2 & 3: CATEGORIZED LIST / SCROLLSPY (PostJob & Modal)  */}
      {/* ------------------------------------------------------------- */}
      {(layout === 'accordion' || layout === 'modal') && (
        <div
          ref={scrollContainerRef}
          onScroll={handleVerticalScroll}
          className="overflow-y-auto pr-1 space-y-5 flex-1 min-h-[300px]"
          style={maxHeight ? { maxHeight, height: maxHeight } : {}}
        >
          {totalMatches === 0 ? (
            showCustomBountyOption ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center p-6 rounded-2xl bg-orange-50/80 border border-orange-200 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
                  <Zap className="w-5 h-5 fill-white/20" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-xs">
                    No standard skill for "{searchQuery}"
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    Broadcast this bounty as a Custom Bounty.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onSelectCustomBounty && onSelectCustomBounty('physical')}
                    className="px-3.5 py-2 bg-primary hover:bg-primary/95 text-white font-black text-xs rounded-xl shadow-xs transition-all active-scale cursor-pointer inline-flex items-center space-x-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white/20" />
                    <span>Custom Field Bounty</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectCustomBounty && onSelectCustomBounty('remote')}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-xs transition-all active-scale cursor-pointer inline-flex items-center space-x-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white/20" />
                    <span>Custom Cyber Bounty</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <h4 className="font-black text-slate-800 text-xs">No matching skills found</h4>
                <p className="text-[11px] text-slate-400">Try searching for another skill or clear search</p>
              </div>
            )
          ) : (
            groupedSkills.map(group => {
              const DisciplineIcon = group.discipline.icon || Zap;
              return (
                <div
                  key={group.discipline.id}
                  ref={el => categoryRefs.current[group.discipline.id] = el}
                  className="space-y-2 scroll-mt-2"
                >
                  {/* Category Header */}
                  <div className="py-1.5 px-0.5 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-5 h-5 rounded-md bg-orange-100 text-primary flex items-center justify-center shrink-0">
                        <DisciplineIcon className="w-3 h-3" />
                      </div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 truncate">
                        {group.discipline.title}
                      </h4>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                      {group.skills.length}
                    </span>
                  </div>

                  {/* List of Skills */}
                  <div className="space-y-1.5 pt-1">
                    {group.skills.map(skill => renderSkillCard(skill))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SkillPicker;