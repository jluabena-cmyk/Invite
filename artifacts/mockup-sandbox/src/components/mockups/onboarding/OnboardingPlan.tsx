import React from 'react';

export function OnboardingPlan() {
  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-[#1a1f3c] font-sans">
      {/* Chrome */}
      <div className="absolute top-0 w-full flex justify-center mt-12 z-10 pointer-events-none">
        <span className="text-white text-sm tracking-widest font-light italic">invite</span>
      </div>
      <div className="absolute top-0 right-0 mt-12 mr-6 z-10">
        <button className="text-white text-sm opacity-60 hover:opacity-100 transition-opacity">
          Skip
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pt-32 px-5 pb-8 relative z-0">
        
        {/* Illustration Card */}
        <div className="bg-white rounded-[24px] shadow-2xl p-5 mb-8 transform -rotate-1">
          
          {/* Top section - restaurant picker */}
          <div className="flex items-center gap-3">
            <div className="w-[52px] h-[52px] bg-orange-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
              🍣
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">Nobu Downtown</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Japanese · Tribeca</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[12px]">⭐</span>
                <span className="text-[12px] font-medium text-gray-500"><span className="text-amber-500">4.8</span></span>
              </div>
            </div>
            <div className="w-6 h-6 bg-[#6366F1] rounded-full flex items-center justify-center text-white text-xs shrink-0 shadow-sm">
              ✓
            </div>
          </div>

          <div className="border-t border-gray-100 my-4"></div>

          {/* Middle section - date + time */}
          <div className="mb-4 flex flex-col gap-2">
            <div>
              <div className="text-xs text-gray-400 font-medium mb-1">Date</div>
              <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-800">Fri, Jan 24</span>
                <span className="text-base">📅</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium mb-1">Time</div>
              <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-800">7:30 PM</span>
                <span className="text-base">🕣</span>
              </div>
            </div>
          </div>

          {/* Bottom section - event name */}
          <div>
            <div className="text-xs text-gray-400 font-medium mb-1">Event name</div>
            <div className="bg-[#6366F1]/[0.08] border border-[#6366F1]/20 rounded-xl px-4 py-2.5">
              <span className="text-sm font-medium text-[#6366F1]">Friday Night Sushi 🍣</span>
            </div>
          </div>

        </div>

        {/* Text */}
        <div className="mt-auto mb-6 px-1">
          <h1 className="text-[32px] leading-tight font-bold text-white mb-3 tracking-tight whitespace-pre-line">
            {"Plan the\nperfect night."}
          </h1>
          <p className="text-[#94A3B8] text-base leading-relaxed pr-8">
            Pick a restaurant, set a time. invite handles the rest.
          </p>
        </div>
        
      </div>

      {/* Bottom Actions */}
      <div className="px-6 pb-8">
        <button className="w-full bg-[#6366F1] text-white font-semibold py-4 rounded-2xl text-base shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-transform">
          Next →
        </button>
        
        {/* Dots */}
        <div className="flex justify-center items-center gap-1.5 mt-6">
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white/30"></div>
          <div className="w-2 h-2 rounded-full bg-white/30"></div>
          <div className="w-2 h-2 rounded-full bg-white/30"></div>
        </div>
      </div>
    </div>
  );
}
