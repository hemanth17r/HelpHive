import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

const PullToRefresh = ({ onRefresh, children, disabled = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const THRESHOLD = 65; // px trigger threshold
  const MAX_PULL = 110;   // max drag distance

  const getScrollParent = (node) => {
    if (!node) return null;
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY || style.overflow || '';
    const isScrollable = (overflowY.includes('auto') || overflowY.includes('scroll')) && (node.scrollHeight > node.clientHeight);
    if (isScrollable) return node;
    return getScrollParent(node.parentElement || node.parentNode);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const scrollParent = getScrollParent(container) || container;

    const handleStart = (clientY) => {
      if (scrollParent.scrollTop === 0) {
        startYRef.current = clientY;
        isPullingRef.current = true;
      }
    };

    const handleMove = (clientY, e) => {
      if (!isPullingRef.current || refreshing) return;
      const diff = clientY - startYRef.current;

      if (diff > 0 && scrollParent.scrollTop === 0) {
        const pull = Math.min(diff * 0.4, MAX_PULL);
        setPullDistance(pull);
        if (e.cancelable) e.preventDefault();
      } else {
        isPullingRef.current = false;
        setPullDistance(0);
      }
    };

    const handleEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      const currentPull = pullDistance;
      if (currentPull >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullDistance(THRESHOLD);
        try {
          await onRefresh();
        } catch (err) {
          console.error('Refresh failed:', err);
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    // Touch Event Listeners
    const onTouchStart = (e) => handleStart(e.touches[0].clientY);
    const onTouchMove = (e) => handleMove(e.touches[0].clientY, e);
    const onTouchEnd = () => handleEnd();

    // Mouse Event Listeners (helpful for testing/desktop drag)
    const onMouseDown = (e) => handleStart(e.clientY);
    const onMouseMove = (e) => {
      if (e.buttons === 1) { // Left mouse button clicked
        handleMove(e.clientY, e);
      } else {
        isPullingRef.current = false;
        setPullDistance(0);
      }
    };
    const onMouseUp = () => handleEnd();

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove, { passive: false });
    container.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);

      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
    };
  }, [pullDistance, refreshing, onRefresh, disabled]);

  const rotateDeg = Math.min((pullDistance / THRESHOLD) * 360, 360);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-y-auto no-scrollbar relative h-full w-full select-none">
      {/* Pull indicator */}
      <div 
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none transition-all duration-150"
        style={{
          height: `${pullDistance}px`,
          top: 0,
          opacity: pullDistance > 10 ? Math.min(pullDistance / THRESHOLD, 1) : 0,
          transform: `translateY(${Math.max(0, pullDistance - 40)}px)`,
          zIndex: 40
        }}
      >
        <div className="bg-white p-2.5 rounded-full shadow-md border border-gray-100 flex items-center justify-center">
          <RefreshCw 
            className={`w-5 h-5 text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={{ 
              transform: refreshing ? undefined : `rotate(${rotateDeg}deg)`,
              transition: refreshing ? undefined : 'transform 50ms linear'
            }}
          />
        </div>
      </div>
      
      {/* Content wrapper */}
      <div 
        className="flex-1 flex flex-col h-full w-full transition-transform duration-150"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.8}px)` : 'translateY(0px)'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
