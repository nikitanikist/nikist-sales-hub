import { useMemo } from "react";
import { format, addDays, startOfDay, differenceInDays } from "date-fns";

interface StudentWithDue {
  id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  due_amount: number;
  cash_received: number;
  offer_amount: number;
  next_follow_up_date: string | null;
  pay_after_earning: boolean;
  status: string;
  conversion_date?: string;
  scheduled_date?: string;
  closer_id?: string | null;
  closer_name?: string | null;
}

interface UpcomingPayment {
  date: string;
  dateFormatted: string;
  students: StudentWithDue[];
  totalAmount: number;
  isToday: boolean;
  isPast: boolean;
}

interface ReceivablesAging {
  bracket: string;
  students: StudentWithDue[];
  amount: number;
  percentage: number;
}

interface InsightsData {
  upcomingPayments: UpcomingPayment[];
  thisWeekTotal: number;
  thisWeekStudentCount: number;
  studentsWithoutFollowUp: StudentWithDue[];
  studentsWithoutFollowUpAmount: number;
  overdueFollowUps: StudentWithDue[];
  overdueFollowUpsAmount: number;
  receivablesAging: ReceivablesAging[];
  totalReceivables: number;
  collectionRate: number;
  thisMonthCollected: number;
  lastMonthCollected: number;
}

export function useBatchInsights(
  students: StudentWithDue[] | undefined,
  emiPayments?: { student_id?: string; appointment_id?: string; amount: number; payment_date: string }[]
): InsightsData {
  return useMemo(() => {
    if (!students || students.length === 0) {
      return {
        upcomingPayments: [],
        thisWeekTotal: 0,
        thisWeekStudentCount: 0,
        studentsWithoutFollowUp: [],
        studentsWithoutFollowUpAmount: 0,
        overdueFollowUps: [],
        overdueFollowUpsAmount: 0,
        receivablesAging: [],
        totalReceivables: 0,
        collectionRate: 0,
        thisMonthCollected: 0,
        lastMonthCollected: 0,
      };
    }

    const today = startOfDay(new Date());
    const todayStr = format(today, "yyyy-MM-dd");

    // Filter active students with due amounts (not refunded/discontinued, not PAE)
    const activeStudentsWithDue = students.filter(
      (s) =>
        s.status !== "refunded" &&
        s.status !== "discontinued" &&
        !s.pay_after_earning &&
        (s.due_amount || 0) > 0
    );

    // 1. Upcoming Payments (next 14 days)
    const next14Days = Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, i);
      return format(date, "yyyy-MM-dd");
    });

    const upcomingPayments: UpcomingPayment[] = next14Days.map((dateStr) => {
      const studentsOnDate = activeStudentsWithDue.filter(
        (s) => s.next_follow_up_date === dateStr
      );
      const dateObj = new Date(dateStr);
      
      return {
        date: dateStr,
        dateFormatted: format(dateObj, "dd MMM"),
        students: studentsOnDate,
        totalAmount: studentsOnDate.reduce((sum, s) => sum + (s.due_amount || 0), 0),
        isToday: dateStr === todayStr,
        isPast: false,
      };
    });

    // This week totals (next 7 days)
    const thisWeekPayments = upcomingPayments.slice(0, 7);
    const thisWeekTotal = thisWeekPayments.reduce((sum, p) => sum + p.totalAmount, 0);
    const thisWeekStudentCount = thisWeekPayments.reduce((sum, p) => sum + p.students.length, 0);

    // 2. Students without follow-up date
    const studentsWithoutFollowUp = activeStudentsWithDue.filter(
      (s) => !s.next_follow_up_date
    );
    const studentsWithoutFollowUpAmount = studentsWithoutFollowUp.reduce(
      (sum, s) => sum + (s.due_amount || 0),
      0
    );

    // 3. Overdue follow-ups (follow-up date in the past)
    const overdueFollowUps = activeStudentsWithDue.filter(
      (s) => s.next_follow_up_date && new Date(s.next_follow_up_date) < today
    );
    const overdueFollowUpsAmount = overdueFollowUps.reduce(
      (sum, s) => sum + (s.due_amount || 0),
      0
    );

    // 4. Receivables aging (based on conversion date or scheduled date)
    const getStudentAge = (student: StudentWithDue): number => {
      const dateStr = student.conversion_date || student.scheduled_date;
      if (!dateStr) return 0;
      return differenceInDays(today, new Date(dateStr));
    };

    const aging0to30 = activeStudentsWithDue.filter((s) => {
      const age = getStudentAge(s);
      return age >= 0 && age <= 30;
    });
    const aging31to60 = activeStudentsWithDue.filter((s) => {
      const age = getStudentAge(s);
      return age > 30 && age <= 60;
    });
    const aging60plus = activeStudentsWithDue.filter((s) => {
      const age = getStudentAge(s);
      return age > 60;
    });

    const totalReceivables = activeStudentsWithDue.reduce(
      (sum, s) => sum + (s.due_amount || 0),
      0
    );

    const receivablesAging: ReceivablesAging[] = [
      {
        bracket: "0-30 days",
        students: aging0to30,
        amount: aging0to30.reduce((sum, s) => sum + (s.due_amount || 0), 0),
        percentage: totalReceivables > 0
          ? (aging0to30.reduce((sum, s) => sum + (s.due_amount || 0), 0) / totalReceivables) * 100
          : 0,
      },
      {
        bracket: "31-60 days",
        students: aging31to60,
        amount: aging31to60.reduce((sum, s) => sum + (s.due_amount || 0), 0),
        percentage: totalReceivables > 0
          ? (aging31to60.reduce((sum, s) => sum + (s.due_amount || 0), 0) / totalReceivables) * 100
          : 0,
      },
      {
        bracket: "60+ days",
        students: aging60plus,
        amount: aging60plus.reduce((sum, s) => sum + (s.due_amount || 0), 0),
        percentage: totalReceivables > 0
          ? (aging60plus.reduce((sum, s) => sum + (s.due_amount || 0), 0) / totalReceivables) * 100
          : 0,
      },
    ];

    // 5. Collection rate (cash_received / offer_amount for active students)
    const totalOffered = students
      .filter((s) => s.status !== "refunded" && s.status !== "discontinued")
      .reduce((sum, s) => sum + (s.offer_amount || 0), 0);
    const totalReceived = students
      .filter((s) => s.status !== "refunded" && s.status !== "discontinued")
      .reduce((sum, s) => sum + (s.cash_received || 0), 0);
    const collectionRate = totalOffered > 0 ? (totalReceived / totalOffered) * 100 : 0;

    // 6. This month vs last month collections from EMI payments
    let thisMonthCollected = 0;
    let lastMonthCollected = 0;

    if (emiPayments && emiPayments.length > 0) {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      emiPayments.forEach((emi) => {
        const emiDate = new Date(emi.payment_date);
        if (emiDate >= thisMonthStart) {
          thisMonthCollected += emi.amount;
        } else if (emiDate >= lastMonthStart && emiDate <= lastMonthEnd) {
          lastMonthCollected += emi.amount;
        }
      });
    }

    return {
      upcomingPayments,
      thisWeekTotal,
      thisWeekStudentCount,
      studentsWithoutFollowUp,
      studentsWithoutFollowUpAmount,
      overdueFollowUps,
      overdueFollowUpsAmount,
      receivablesAging,
      totalReceivables,
      collectionRate,
      thisMonthCollected,
      lastMonthCollected,
    };
  }, [students, emiPayments]);
}
