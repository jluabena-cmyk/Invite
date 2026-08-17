import React from 'react';

export function OnboardingSettle() {
  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-[#1a1f3c] font-sans">
      {/* Top Bar */}
      <div className="absolute top-12 left-0 right-0 px-6 flex justify-between items-center z-10">
        <div className="text-white text-sm tracking-widest font-semibold flex-1 text-center pl-8">invite</div>
        <button className="text-white text-sm font-medium opacity-80">Skip</button>
      </div>

      {/* Illustration Area */}
      <div className="flex-1 flex flex-col justify-end pb-8 relative mt-20 z-0">
        <div className="mx-6 bg-white rounded-2xl shadow-2xl p-5 overflow-hidden transform -rotate-1">
          <div className="text-center font-bold text-gray-900 text-sm mb-5">Friday night 🍕</div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F97316] text-white flex items-center justify-center text-sm font-bold">J</div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm leading-tight">Jordan</div>
                  <div className="text-xs text-slate-400">Pay via Venmo</div>
                </div>
              </div>
              <div className="font-bold text-gray-900 text-sm">$23.50</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#10B981] text-white flex items-center justify-center text-sm font-bold">S</div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm leading-tight">Sam</div>
                </div>
              </div>
              <div className="font-bold text-gray-900 text-sm">$18.00</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F59E0B] text-white flex items-center justify-center text-sm font-bold">A</div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm leading-tight">Alex</div>
                  <div className="text-xs text-slate-400">Pay via Cash App</div>
                </div>
              </div>
              <div className="font-bold text-gray-900 text-sm">$31.25</div>
            </div>
            
            <div className="h-px bg-gray-100 my-4"></div>

            <div className="flex items-center justify-between bg-[#6366F1]/10 -mx-3 px-3 py-2 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#6366F1] text-white flex items-center justify-center text-sm font-bold">Y</div>
                <div>
                  <div className="font-semibold text-[#6366F1] text-sm leading-tight">You</div>
                </div>
              </div>
              <div className="font-bold text-[#6366F1] text-sm">$19.75</div>
            </div>
          </div>
          
          <div className="mt-5 text-center text-xs text-slate-400 font-medium">Total: $92.50</div>
        </div>
      </div>

      {/* Text Content */}
      <div className="px-6 mb-12 mt-6">
        <h1 className="text-white text-4xl font-bold leading-[1.1] whitespace-pre-line">
          {"Everyone sees\nexactly what\nthey owe."}
        </h1>
        <p className="text-[#94A3B8] mt-4 text-[17px]">
          No arguments. No calculator. Just dinner.
        </p>
      </div>

      {/* Bottom Area */}
      <div className="pb-[34px] px-6 mt-auto">
        <div className="flex justify-center gap-[6px] mb-8">
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white"></div>
        </div>
        <button className="w-full bg-[#6366F1] text-white font-semibold rounded-2xl py-4 text-[17px]">
          Create account
        </button>
      </div>
    </div>
  );
}
