import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { DialogService } from './dialog-service';

@Injectable({
  providedIn: 'root',
})
export class UserSettingService {

  isDarkMode = signal<boolean>(true);
  private supabaseService = inject(SupabaseService);
  private dialogService = inject(DialogService);

  constructor() {
    this.initTheme();
  }

  private initTheme() {
    // 1. Check if user has saved a preference before
    const savedTheme = localStorage.getItem('gym-theme');

    // 2. Default to true (Dark) UNLESS they specifically saved 'light'
    const isDark = savedTheme !== 'light';

    // 3. Set the signal and apply the class
    this.isDarkMode.set(isDark);
    this.applyThemeClass(isDark);
  }

  toggleTheme() {
    // Add smooth transition class temporarily
    document.documentElement.classList.add('theme-transitioning');

    // Flip the signal state
    const newState = !this.isDarkMode();
    this.isDarkMode.set(newState);

    // Save to local storage so it survives refresh
    localStorage.setItem('gym-theme', newState ? 'dark' : 'light');

    // Apply to DOM
    this.applyThemeClass(newState);

    // Remove transition class after animation (700ms)
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 700);
  }

  private applyThemeClass(isDark: boolean) {
    // This strictly controls your CSS variables
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  async logout() {

    const confirmed = await this.dialogService.open({
      title: `Loging Out`,
      message: `Are you sure you want to logout?`,
      mode: 'warning',
      confirmText: 'logout',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    this.supabaseService.logout();
  }

  getFaqs() {
    return [
      {
        question: 'What happens when my gym subscription expires?',
        answer: 'You will receive notifications on your dashboard before your subscription ends. If it expires, your system access will be locked. You will only be able to access the payment tab. Once your payment succeeds, your full access is instantly restored.'
      },
      {
        question: 'How do I track my attendance and gym visits?',
        answer: 'You can view your current gym streak, monthly visit count, and a weekly graph for the last 5 weeks in the Attendance tab. Please note that the system displays a maximum of 35 days of past attendance history.'
      },
      {
        question: 'How often can I update my health data?',
        answer: 'You can log and update your weight tracking once a week. Your dashboard will automatically use this to calculate your BMI and display your overall health data.'
      },
      {
        question: 'Where do I find my diet and workout plans?',
        answer: 'Your customized daily workout sheets and diet plans are assigned by the administration. You can view and follow them every day in the Diet and Workout sections of your dashboard.'
      },
      {
        question: 'What can I use the AI Chat for?',
        answer: 'Our integrated AI Chat is specifically designed to answer health, fitness, and gym-related questions. For administrative issues or account specific inquiries, please contact the gym admin.'
      },
      {
        question: 'Can I pay for my subscription in cash or at the gym?',
        answer: 'Yes. If you cannot make an online payment through the system, please contact the gym admin directly at the front desk. They can manually update your subscription status in the system.'
      },
      {
        question: 'How will I know if the gym is closed for a holiday?',
        answer: 'The gym administration will post notifications regarding upcoming holidays, closures, or special product advertisements directly to your member dashboard.'
      }
    ];
  }

  getTermsAndConditions() {
    return [
      {
        heading: '1. Account Access and Subscriptions',
        text: 'Access to the member portal is strictly tied to your subscription status. If your subscription expires, your account will be locked, restricting access to all features except the payment portal. Full access will be restored upon successful payment. Manual payments must be coordinated directly with the gym administration.'
      },
      {
        heading: '2. Health Data and Privacy',
        text: 'To provide a personalized experience, our system allows you to track personal health data, including weight, height, and BMI. Your attendance data and payment history are accessible to the gym administration for management purposes. We do not sell your personal health data to third parties.'
      },
      {
        heading: '3. AI Chat Assistant',
        text: 'The integrated AI chatbot is provided for general health, fitness, and gym-related inquiries only. The AI is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a physician or qualified health provider before starting any new diet or fitness program.'
      },
      {
        heading: '4. Workout and Diet Plans',
        text: 'Any daily workout sheets or diet plans provided in your dashboard are assigned by the gym administration. Participation in these plans is strictly at your own risk. You declare that you are physically sound and suffer from no condition that would prevent your participation in these activities.'
      },
      {
        heading: '5. Administration Rights',
        text: 'The gym administration reserves the right to manage member accounts at their discretion. This includes the right to deactivate or delete inactive accounts, update global diet or exercise blueprints, and display sponsored product advertisements on the member dashboard.'
      },
      {
        heading: '6. Contact and Cancellations',
        text: 'For membership cancellations, manual subscription renewals, disputes regarding attendance, or technical issues not covered in the FAQ, please contact the gym admin directly at the facility.'
      }
    ];
  }
}