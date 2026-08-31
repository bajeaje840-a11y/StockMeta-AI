import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

interface PinProtectionModalProps {
  onUnlock: () => void;
}

const CORRECT_PIN = '14418';

export function PinProtectionModal({ onUnlock }: PinProtectionModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.trim() === CORRECT_PIN) {
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
      inputRef.current?.focus();
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
    setPin(val);
    if (error) setError(false);

    if (val.length === 5) {
      if (val === CORRECT_PIN) {
        setError(false);
        onUnlock();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin('');
          inputRef.current?.focus();
        }, 400);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all">
      <div
        className={`w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-300 ${
          shake ? 'animate-bounce' : ''
        }`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px -10px rgba(99, 102, 241, 0.15)',
        }}
      >
        {/* Decorative Top Accent Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Icon Emblem */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 mb-4 ring-4 ring-indigo-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Security Access</h2>
          <p className="text-sm text-slate-400 mt-1.5">
            Please enter the 5-digit PIN to access StockMeta AI
          </p>
        </div>

        {/* PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="relative flex justify-center items-center">
              {/* Real hidden/transparent input for smooth typing */}
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={pin}
                onChange={handlePinChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 text-center tracking-widest text-transparent"
                autoComplete="off"
                autoFocus
              />

              {/* 5 Digit Visual Boxes */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {[0, 1, 2, 3, 4].map((index) => {
                  const digit = pin[index];
                  const isFilled = digit !== undefined;
                  const isCurrent = pin.length === index;

                  return (
                    <div
                      key={index}
                      className={`w-11 h-13 sm:w-13 sm:h-15 flex items-center justify-center text-xl sm:text-2xl font-bold rounded-xl border transition-all duration-200 ${
                        error
                          ? 'border-red-500/80 bg-red-500/10 text-red-400'
                          : isFilled
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 shadow-sm shadow-indigo-500/20'
                          : isCurrent
                          ? 'border-slate-500 bg-slate-800/80 text-white ring-2 ring-indigo-500/30'
                          : 'border-slate-800 bg-slate-950/60 text-slate-500'
                      }`}
                    >
                      {isFilled ? '●' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-red-400 font-medium pt-2 animate-fadeIn">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Incorrect PIN. Please enter the valid 5-digit code.</span>
              </div>
            )}
          </div>

          {/* Keypad Quick Numbers / Submit Button */}
          <button
            type="submit"
            disabled={pin.length !== 5}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              pin.length === 5
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 cursor-pointer active:scale-[0.99]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>Unlock Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Developer Credit Footer */}
        <div className="mt-8 pt-4 border-t border-slate-800/80 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-xs font-medium text-slate-300 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Developed by <strong className="text-indigo-300 font-semibold">Woalid</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
