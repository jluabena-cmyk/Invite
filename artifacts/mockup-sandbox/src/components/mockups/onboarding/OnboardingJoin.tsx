import React from "react";

export function OnboardingJoin() {
  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-[#1a1f3c] font-sans">
      {/* Chrome */}
      <div className="absolute top-0 left-0 right-0 flex justify-center mt-12 z-10">
        <span className="text-white text-sm tracking-widest font-light italic opacity-90">invite</span>
      </div>
      <div className="absolute top-0 right-0 mt-12 mr-6 z-10">
        <button className="text-white text-sm opacity-60 font-medium">Skip</button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center pt-20">
        {/* Illustration: The join moment */}
        <div className="bg-white rounded-3xl mx-5 shadow-2xl p-5 relative overflow-hidden flex flex-col">
          {/* Layer 1 — Mini iMessage bubble */}
          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[240px]">
            {/* Avatar row */}
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-xs font-bold border-2 border-white relative z-10">
                J
              </div>
              <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-white text-xs font-bold border-2 border-white -ml-2 relative z-0">
                S
              </div>
            </div>
            
            {/* Message text */}
            <p className="text-sm text-gray-800 leading-snug">
              Jordan added you to Friday Night Sushi 🍣
            </p>
            
            {/* Link pill */}
            <div className="bg-[#6366F1]/10 rounded-lg px-3 py-1.5 mt-2 flex items-center gap-2">
              <span className="text-xs">🔗</span>
              <span className="text-xs text-[#6366F1] font-medium truncate">invite.app/join/fri-sushi</span>
            </div>
          </div>

          {/* Layer 2 — join preview card */}
          <div className="bg-gray-50 rounded-2xl p-4 mt-3 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 text-sm">Friday Night Sushi 🍣</h3>
            <p className="text-xs text-gray-500 mt-0.5">Nobu Downtown · Fri Jan 24 · 7:30 PM</p>
            
            <div className="flex items-center mt-3">
              <div className="flex">
                <div className="w-8 h-8 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-xs font-bold border-2 border-white relative z-20">
                  J
                </div>
                <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-white text-xs font-bold border-2 border-white -ml-2 relative z-10">
                  S
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white -ml-2 relative z-0">
                  E
                </div>
              </div>
              <span className="text-xs text-gray-500 ml-2">Jordan, Sam + 2 more</span>
            </div>
            
            <button className="w-full bg-[#6366F1] text-white rounded-xl py-2.5 text-sm font-semibold text-center mt-3 shadow-sm">
              Join event →
            </button>
          </div>
        </div>

        {/* Text */}
        <h1 className="text-white text-4xl font-bold mx-6 mt-10 leading-tight">
          Tap a link.<br />You're in.
        </h1>
        <p className="text-[#94A3B8] text-[15px] mx-6 mt-3 leading-relaxed">
          Got a dinner invite? One tap and you're part of the plan.
        </p>
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto pb-8 flex flex-col items-center">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-8">
          <div className="bg-white rounded-full w-2 h-2"></div>
          <div className="bg-white rounded-full w-2 h-2"></div>
          <div className="bg-white rounded-full w-2 h-2"></div>
          <div className="bg-white rounded-full w-2 h-2"></div>
          <div className="bg-white/30 rounded-full w-2 h-2"></div>
          <div className="bg-white/30 rounded-full w-2 h-2"></div>
        </div>
        
        {/* CTA */}
        <button className="mx-6 w-[calc(100%-48px)] rounded-2xl bg-[#6366F1] text-white font-semibold py-4 text-base shadow-[0_0_24px_rgba(99,102,241,0.5)] transition-transform active:scale-[0.98]">
          Get started →
        </button>
      </div>
    </div>
  );
}

export default OnboardingJoin;
