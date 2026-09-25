import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, DollarSign, ChevronsLeft, ChevronsRight, Clock } from 'lucide-react';
import { Holding } from '../types';

export interface CalendarDividend extends Holding {
  amount: string;
  payDay: number;
  payDayStr: string;
  payoutRatio: number;
  paymentMonths: number[]; // Month indices (0-11) when this dividend is paid
}

interface DividendCalendarProps {
  dividends: CalendarDividend[];
}

const DividendCalendar: React.FC<DividendCalendarProps> = ({ dividends }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDateInfo, setSelectedDateInfo] = useState<{day: number, payments: CalendarDividend[]} | null>(null);

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Navigation Handlers
  const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));
  const prevYear = () => setViewDate(new Date(currentYear - 1, currentMonth, 1));
  const nextYear = () => setViewDate(new Date(currentYear + 1, currentMonth, 1));
  const resetToToday = () => setViewDate(new Date());

  // Filter dividends for the currently displayed month
  const monthlyDividends = dividends.filter(d => d.paymentMonths.includes(currentMonth));
  const totalMonthlyIncome = monthlyDividends.reduce((acc, d) => acc + parseFloat(d.amount), 0);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDayOfMonth).fill(null);

  days.forEach(day => {
      week.push(day);
      if (week.length === 7) {
          weeks.push(week);
          week = [];
      }
  });
  if (week.length > 0) weeks.push([...week, ...Array(7 - week.length).fill(null)]);

  const handleDayClick = (day: number, payments: CalendarDividend[]) => {
    if (payments.length > 0) {
        setSelectedDateInfo({ day, payments });
    }
  };

  return (
      <div className="animate-fade-in relative">
          <div className="flex flex-col lg:flex-row items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-4 w-full lg:w-auto">
                <div className="bg-brand-600/10 p-3 rounded-xl border border-brand-600/20 hidden sm:block">
                    <CalendarIcon className="w-6 h-6 text-brand-500" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {monthNames[currentMonth]} {currentYear}
                        {currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear() && (
                            <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full">Current</span>
                        )}
                    </h2>
                    <div className="text-sm text-slate-400">Estimated Income: <span className="text-emerald-400 font-bold">${totalMonthlyIncome.toFixed(2)}</span></div>
                </div>
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
                <button onClick={resetToToday} className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors mr-2">
                    Today
                </button>
                <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-0.5">
                    <button onClick={prevYear} className="p-2 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors" title="Previous Year">
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors border-r border-slate-800" title="Previous Month">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors border-r border-slate-800" title="Next Month">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={nextYear} className="p-2 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors" title="Next Year">
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="p-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {d}
                    </div>
                ))}
            </div>
            <div className="divide-y divide-slate-800">
                {weeks.map((weekArray, wIdx) => (
                    <div key={wIdx} className="grid grid-cols-7 divide-x divide-slate-800">
                        {weekArray.map((day, dIdx) => {
                            const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();
                            const dayPayments = day ? monthlyDividends.filter(d => d.payDay === day) : [];
                            const dailyTotal = dayPayments.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

                            return (
                                <div
                                    key={dIdx}
                                    onClick={() => day && handleDayClick(day, dayPayments)}
                                    className={`min-h-[120px] md:min-h-[140px] p-2 relative group transition-colors ${
                                        !day ? 'bg-slate-950/30 pointer-events-none' :
                                        dayPayments.length > 0 ? 'hover:bg-slate-800/50 cursor-pointer bg-slate-900/50' : 'bg-slate-900/20'
                                    }`}
                                >
                                    {day && (
                                        <>
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-110' : 'text-slate-500'}`}>
                                                    {day}
                                                </span>
                                                {dailyTotal > 0 && (
                                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
                                                        ${Math.round(dailyTotal)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                {dayPayments.slice(0, 3).map(p => (
                                                    <div key={p.id} className="flex items-center justify-between bg-slate-800 border border-slate-700/50 rounded px-2 py-1.5 hover:border-slate-600 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                                                            <span className="text-[10px] font-bold text-slate-200 truncate max-w-[50px]">{p.symbol}</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400">${Math.round(parseFloat(p.amount))}</span>
                                                    </div>
                                                ))}
                                                {dayPayments.length > 3 && (
                                                    <div className="text-[10px] text-center text-slate-500 font-medium py-1">
                                                        +{dayPayments.length - 3} more
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>

        <div className="mt-6 flex gap-6 text-xs text-slate-500 justify-end">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-slate-900 border border-slate-700"></div>
                <span>No Payments</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-brand-600 shadow-sm shadow-brand-600/50"></div>
                <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-400/10 border border-emerald-400/20"></div>
                <span>Payout Day</span>
            </div>
        </div>

        {/* Detailed View Modal */}
        {selectedDateInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md m-4 overflow-hidden animate-fade-in-up">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-brand-500" />
                                {monthNames[currentMonth]} {selectedDateInfo.day}, {currentYear}
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Total Payments: <span className="text-emerald-400 font-bold">${selectedDateInfo.payments.reduce((a,b) => a + parseFloat(b.amount), 0).toFixed(2)}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedDateInfo(null)}
                            className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-2 max-h-[60vh] overflow-y-auto">
                        {selectedDateInfo.payments.map(payment => {
                            // Simulate Ex-Date (usually 2-4 weeks before pay date)
                            const exDateDay = Math.max(1, payment.payDay - 14);

                            return (
                                <div key={payment.id} className="p-4 hover:bg-slate-800/50 rounded-xl transition-colors flex items-center justify-between group border-b border-slate-800/50 last:border-0">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-300 border border-slate-700 group-hover:border-brand-500/50 transition-colors shadow-sm">
                                            {payment.symbol[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white flex items-center gap-2">{payment.symbol} <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{payment.assetType}</span></div>
                                            <div className="text-xs text-slate-500">{payment.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-emerald-400 flex items-center justify-end gap-1 text-lg">
                                            <DollarSign className="w-4 h-4" />{payment.amount}
                                        </div>
                                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 mt-1">
                                            <Clock className="w-3 h-3" /> Ex-Date: {monthNames[currentMonth].substring(0,3)} {exDateDay}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-4 bg-slate-950/30 border-t border-slate-800 text-center">
                        <button
                            onClick={() => setSelectedDateInfo(null)}
                            className="text-sm text-slate-400 hover:text-white transition-colors font-medium"
                        >
                            Close Details
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
  );
};

export default DividendCalendar;
