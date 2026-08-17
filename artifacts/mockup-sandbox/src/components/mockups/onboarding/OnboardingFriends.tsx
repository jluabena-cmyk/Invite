import React from "react";
import { Link } from "wouter";

export function OnboardingFriends() {
  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-[#1a1f3c] font-sans">
      {/* Top Chrome */}
      <div className="absolute top-12 left-0 right-0 flex justify-center px-6">
        <span className="text-white text-sm tracking-widest font-light italic opacity-90">invite</span>
        <button className="absolute right-6 text-white text-sm opacity-60 font-medium">Skip</button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pt-32 pb-8">
        
        {/* Friends Card */}
        <div className="bg-white rounded-[32px] mx-5 shadow-2xl overflow-hidden flex flex-col" style={{ height: '420px' }}>
          {/* Card Header */}
          <div className="px-5 pt-6 pb-4 border-b border-gray-50/50">
            <h3 className="text-[16px] font-semibold text-gray-900 tracking-tight">Add to Friday Night Sushi 🍣</h3>
            <p className="text-[13px] text-gray-400 mt-0.5">3 friends selected</p>
          </div>

          {/* Friends List */}
          <div className="flex-1 overflow-hidden flex flex-col pt-2 pb-4">
            
            {/* Friend 1 */}
            <div className="px-5 py-2.5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-[15px]" style={{ backgroundColor: '#6366F1' }}>
                JM
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-gray-900 leading-tight">Jordan M.</div>
                <div className="text-[13px] text-gray-400">@jordanm</div>
              </div>
              <div className="bg-[#6366F1] text-white rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-wide">
                ✓ Added
              </div>
            </div>

            {/* Friend 2 */}
            <div className="px-5 py-2.5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-[15px]" style={{ backgroundColor: '#F97316' }}>
                SK
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-gray-900 leading-tight">Sam K.</div>
                <div className="text-[13px] text-gray-400">@samkwon</div>
              </div>
              <div className="bg-[#6366F1] text-white rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-wide">
                ✓ Added
              </div>
            </div>

            {/* Friend 3 */}
            <div className="px-5 py-2.5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-[15px]" style={{ backgroundColor: '#10B981' }}>
                AT
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-gray-900 leading-tight">Alex T.</div>
                <div className="text-[13px] text-gray-400">@alext</div>
              </div>
              <div className="bg-[#6366F1] text-white rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-wide">
                ✓ Added
              </div>
            </div>

            {/* Friend 4 */}
            <div className="px-5 py-2.5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-[15px]" style={{ backgroundColor: '#F59E0B' }}>
                RB
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-gray-900 leading-tight">Riley B.</div>
                <div className="text-[13px] text-gray-400">@rileyb</div>
              </div>
              <div className="border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-[13px] font-medium tracking-wide">
                Add
              </div>
            </div>

            {/* Friend 5 */}
            <div className="px-5 py-2.5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-[15px]" style={{ backgroundColor: '#EC4899' }}>
                CL
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-gray-900 leading-tight">Casey L.</div>
                <div className="text-[13px] text-gray-400">@caseyl</div>
              </div>
              <div className="border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-[13px] font-medium tracking-wide">
                Add
              </div>
            </div>

          </div>
        </div>

        {/* Text Area */}
        <div className="mt-8 mx-6 flex-1">
          <h1 className="text-white text-[38px] font-bold leading-[1.1] tracking-tight whitespace-pre-line">
            {"Your crew is\none tap away."}
          </h1>
          <p className="text-[#94A3B8] text-[16px] mt-3 leading-relaxed pr-4">
            Add friends once. Invite them to every dinner after that.
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto px-6 pb-2">
          {/* Progress Dots */}
          <div className="flex items-center gap-2 mb-8 ml-1">
            <div className="w-2 h-2 rounded-full bg-white"></div>
            <div className="w-2 h-2 rounded-full bg-white"></div>
            <div className="w-2 h-2 rounded-full bg-white/30"></div>
            <div className="w-2 h-2 rounded-full bg-white/30"></div>
            <div className="w-2 h-2 rounded-full bg-white/30"></div>
            <div className="w-2 h-2 rounded-full bg-white/30"></div>
          </div>
          
          <button className="w-full bg-[#6366F1] text-white font-semibold py-4 rounded-2xl text-[17px] active:scale-[0.98] transition-transform">
            Next →
          </button>
        </div>

      </div>
    </div>
  );
}
