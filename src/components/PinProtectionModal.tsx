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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all animate-fade-in">
      <div
        className={`w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-300 ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Icon Emblem */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm mb-4">
            <Lock className="w-7 h-7 stroke-[1.8]" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Security Access</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enter the 5-digit PIN to access StockMeta AI Pro Studio
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
                      className={`w-11 h-13 sm:w-12 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-bold rounded-2xl border transition-all duration-200 ${
                        error
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                          : isFilled
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                          : isCurrent
                          ? 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-400'
                      }`}
                    >
                      {isFilled ? '●' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium pt-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Incorrect PIN. Please enter the valid 5-digit code.</span>
              </div>
            )}
          </div>

          {/* Unlock Dashboard Button */}
          <button
            type="submit"
            disabled={pin.length !== 5}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs ${
              pin.length === 5
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 cursor-pointer active:scale-[0.99]'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            <span>Unlock Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Developer Credit Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Crafted by <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">Woalid</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
