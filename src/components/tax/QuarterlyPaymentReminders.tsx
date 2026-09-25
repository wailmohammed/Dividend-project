import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Calendar, 
  Bell, 
  Download, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  CalendarPlus,
  CalendarCheck
} from 'lucide-react';
import { format, differenceInDays, parseISO, addDays, isBefore, isAfter } from 'date-fns';

interface QuarterlyDeadline {
  quarter: string;
  period: string;
  deadline: Date;
  paymentDue: number;
  isPast: boolean;
  isUpcoming: boolean;
  daysUntil: number;
}

interface QuarterlyPaymentRemindersProps {
  estimatedQuarterlyPayments: { quarter: string; payment: number }[];
  taxYear?: number;
}

// IRS Quarterly payment deadlines
const getQuarterlyDeadlines = (year: number): { quarter: string; period: string; deadline: Date }[] => [
  { quarter: 'Q1', period: 'Jan 1 - Mar 31', deadline: new Date(year, 3, 15) }, // April 15
  { quarter: 'Q2', period: 'Apr 1 - May 31', deadline: new Date(year, 5, 15) }, // June 15
  { quarter: 'Q3', period: 'Jun 1 - Aug 31', deadline: new Date(year, 8, 15) }, // September 15
  { quarter: 'Q4', period: 'Sep 1 - Dec 31', deadline: new Date(year + 1, 0, 15) } // January 15 next year
];

// Generate iCal format event
const generateICalEvent = (deadline: QuarterlyDeadline, taxYear: number): string => {
  const startDate = deadline.deadline;
  const endDate = addDays(deadline.deadline, 1);
  
  const formatICalDate = (date: Date) => format(date, "yyyyMMdd");
  
  const reminderDate = addDays(deadline.deadline, -7);
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Portfolio Tax Tracker//EN
BEGIN:VEVENT
UID:tax-payment-${deadline.quarter}-${taxYear}@portfolio-tracker
DTSTART;VALUE=DATE:${formatICalDate(startDate)}
DTEND;VALUE=DATE:${formatICalDate(endDate)}
SUMMARY:IRS Quarterly Tax Payment Due (${deadline.quarter})
DESCRIPTION:Estimated tax payment of $${deadline.paymentDue.toFixed(2)} due for ${deadline.quarter} ${taxYear}. Submit via IRS Direct Pay or Form 1040-ES.
LOCATION:IRS
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-P7D
DESCRIPTION:Tax payment due in 7 days
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-P1D
DESCRIPTION:Tax payment due tomorrow!
END:VALARM
END:VEVENT
END:VCALENDAR`;
};

// Generate Google Calendar URL
const generateGoogleCalendarUrl = (deadline: QuarterlyDeadline, taxYear: number): string => {
  const startDate = format(deadline.deadline, "yyyyMMdd");
  const endDate = format(addDays(deadline.deadline, 1), "yyyyMMdd");
  
  const title = encodeURIComponent(`IRS Quarterly Tax Payment Due (${deadline.quarter})`);
  const details = encodeURIComponent(
    `Estimated tax payment of $${deadline.paymentDue.toFixed(2)} due for ${deadline.quarter} ${taxYear}.\n\n` +
    `Payment Options:\n` +
    `• IRS Direct Pay: https://www.irs.gov/payments/direct-pay\n` +
    `• EFTPS: https://www.eftps.gov\n` +
    `• Form 1040-ES voucher\n\n` +
    `Remember: Safe harbor is 90% of current year tax or 100% of prior year.`
  );
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}`;
};

export const QuarterlyPaymentReminders: React.FC<QuarterlyPaymentRemindersProps> = ({
  estimatedQuarterlyPayments,
  taxYear = new Date().getFullYear()
}) => {
  const [enableReminders, setEnableReminders] = useState(true);
  const [reminderDays, setReminderDays] = useState(7);

  const today = new Date();

  // Calculate deadlines with status
  const deadlines = useMemo((): QuarterlyDeadline[] => {
    const irsDeadlines = getQuarterlyDeadlines(taxYear);
    
    return irsDeadlines.map((d, index) => {
      const payment = estimatedQuarterlyPayments.find(p => p.quarter === d.quarter)?.payment || 0;
      const daysUntil = differenceInDays(d.deadline, today);
      const isPast = isBefore(d.deadline, today);
      const isUpcoming = !isPast && daysUntil <= 30;
      
      return {
        ...d,
        paymentDue: payment,
        isPast,
        isUpcoming,
        daysUntil
      };
    });
  }, [taxYear, estimatedQuarterlyPayments, today]);

  const nextDeadline = deadlines.find(d => !d.isPast);
  const totalAnnualPayment = deadlines.reduce((sum, d) => sum + d.paymentDue, 0);

  const downloadICalFile = (deadline: QuarterlyDeadline) => {
    const icalContent = generateICalEvent(deadline, taxYear);
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tax-payment-${deadline.quarter}-${taxYear}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllEvents = () => {
    const upcomingDeadlines = deadlines.filter(d => !d.isPast);
    
    const events = upcomingDeadlines.map(d => {
      const startDate = format(d.deadline, "yyyyMMdd");
      const endDate = format(addDays(d.deadline, 1), "yyyyMMdd");
      
      return `BEGIN:VEVENT
UID:tax-payment-${d.quarter}-${taxYear}@portfolio-tracker
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:IRS Quarterly Tax Payment Due (${d.quarter})
DESCRIPTION:Estimated tax payment of $${d.paymentDue.toFixed(2)} due for ${d.quarter} ${taxYear}
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-P7D
DESCRIPTION:Tax payment due in 7 days
END:VALARM
END:VEVENT`;
    }).join('\n');

    const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Portfolio Tax Tracker//EN
${events}
END:VCALENDAR`;

    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tax-payments-${taxYear}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Next Payment Alert */}
      {nextDeadline && nextDeadline.isUpcoming && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <span className="font-semibold">{nextDeadline.quarter} Payment Due Soon!</span>
              <span className="ml-2 text-muted-foreground">
                ${nextDeadline.paymentDue.toLocaleString()} due in {nextDeadline.daysUntil} days 
                ({format(nextDeadline.deadline, 'MMM d, yyyy')})
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => downloadICalFile(nextDeadline)}
              >
                <Download className="w-4 h-4 mr-1" />
                Add to Calendar
              </Button>
              <Button 
                size="sm"
                onClick={() => window.open('https://www.irs.gov/payments/direct-pay', '_blank')}
              >
                Pay Now
                <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Annual Tax</p>
                <p className="text-2xl font-bold">
                  ${totalAnnualPayment.toLocaleString()}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next Payment</p>
                <p className="text-2xl font-bold">
                  {nextDeadline ? `$${nextDeadline.paymentDue.toLocaleString()}` : 'Paid'}
                </p>
                {nextDeadline && (
                  <p className="text-xs text-muted-foreground">
                    {format(nextDeadline.deadline, 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Payments Made</p>
                <p className="text-2xl font-bold">
                  {deadlines.filter(d => d.isPast).length}/4
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5" />
                Calendar Integration
              </CardTitle>
              <CardDescription>
                Add payment deadlines to your calendar with automatic reminders
              </CardDescription>
            </div>
            <Button onClick={downloadAllEvents} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download All Events
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {deadlines.map((deadline) => (
              <Card 
                key={deadline.quarter}
                className={`relative ${
                  deadline.isPast 
                    ? 'opacity-60 bg-muted/30' 
                    : deadline.isUpcoming 
                      ? 'border-amber-500/50 bg-amber-500/5' 
                      : ''
                }`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={deadline.isPast ? 'secondary' : deadline.isUpcoming ? 'default' : 'outline'}>
                      {deadline.quarter}
                    </Badge>
                    {deadline.isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : deadline.isUpcoming ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  <p className="text-lg font-bold mb-1">
                    ${deadline.paymentDue.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">
                    {deadline.period}
                  </p>
                  <p className="text-sm font-medium mb-3">
                    Due: {format(deadline.deadline, 'MMM d, yyyy')}
                  </p>
                  
                  {!deadline.isPast && (
                    <p className="text-xs text-muted-foreground mb-3">
                      {deadline.daysUntil} days remaining
                    </p>
                  )}
                  
                  {!deadline.isPast && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 text-xs"
                        onClick={() => downloadICalFile(deadline)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        iCal
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 text-xs"
                        onClick={() => window.open(generateGoogleCalendarUrl(deadline, taxYear), '_blank')}
                      >
                        <CalendarCheck className="w-3 h-3 mr-1" />
                        Google
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reminder Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4" />
            Reminder Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-reminders">Email Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Receive email notifications before payment deadlines
              </p>
            </div>
            <Switch
              id="enable-reminders"
              checked={enableReminders}
              onCheckedChange={setEnableReminders}
            />
          </div>
          
          {enableReminders && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                You'll receive reminders:
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  7 days before each deadline
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  1 day before each deadline
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  On the deadline date
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to Make Quarterly Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">IRS Direct Pay</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Free, secure online payment directly from your bank account.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://www.irs.gov/payments/direct-pay', '_blank')}
              >
                Go to Direct Pay
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">EFTPS</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Electronic Federal Tax Payment System for scheduled payments.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://www.eftps.gov', '_blank')}
              >
                Go to EFTPS
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Form 1040-ES</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Print vouchers and mail with check or money order.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://www.irs.gov/forms-pubs/about-form-1040-es', '_blank')}
              >
                Get Form 1040-ES
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
