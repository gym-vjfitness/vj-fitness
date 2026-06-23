import { Component, inject, OnInit, signal, computed, PLATFORM_ID, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface ActivityLevel {
  id: string; label: string; description: string; multiplier: number; icon: string;
}

@Component({
  selector: 'app-health-insight',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './health-insight.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health-insight.scss',
})
export class HealthInsight implements OnInit {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private platformId = inject(PLATFORM_ID);

  weight = signal<number>(0);
  height = signal<number>(0);
  age = signal<number>(0);
  gender = signal<'Male' | 'Female'>('Male');
  fullName = signal<string>('Member');
  waist = signal<number | null>(null);
  isLoaded = signal<boolean>(false);

  activeGoalTab = signal<'lose' | 'gain'>('lose');
  isDropdownOpen = signal<boolean>(false);
  isNotesExpanded = signal<boolean>(false); 

  activities: ActivityLevel[] = [
    { id: 'sedentary', label: 'Desk Job / Sedentary', description: 'Mostly sitting, little exercise.', multiplier: 1.2, icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'light', label: 'Lightly Active', description: 'Light exercise 1-3 days/week.', multiplier: 1.375, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'moderate', label: 'Moderately Active', description: 'Good workout 3-5 days/week.', multiplier: 1.55, icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { id: 'active', label: 'Highly Active', description: 'Intense training 6-7 days/week.', multiplier: 1.725, icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z' }
  ];
  selectedActivity = signal<ActivityLevel>(this.activities[0]);

  nutritionTips = [
    { title: 'Fiber is King', content: 'Aim for 25-30g of fiber daily. It controls hunger spikes, aids digestion, and keeps your energy stable.' },
    { title: 'Micronutrients Matter', content: 'Don\'t just hit macros. Eat a variety of colored vegetables to get your essential vitamins for immune health.' },
    { title: 'Protein Distribution', content: 'Spread your protein evenly across 3-4 meals to maximize muscle protein synthesis throughout the day.' },
    { title: 'Hydration Timing', content: 'Drink a large glass of water 30 minutes before meals to aid digestion and prevent accidental overeating.' },
    { title: 'Sleep & Metabolism', content: 'Lack of sleep increases cortisol and your hunger hormone (ghrelin). Aim for 7-9 hours to optimize fat loss.' }
  ];

  bmi = computed(() => {
    const w = this.weight(); const h = (this.height() || 1) / 100;
    return parseFloat((w / (h * h)).toFixed(1));
  });

  bmiStatus = computed(() => {
    const b = this.bmi();
    if (b < 18.5) return { label: 'Underweight', color: 'text-info', bg: 'bg-info/10' };
    if (b <= 24.9) return { label: 'Optimal Range', color: 'text-success', bg: 'bg-success/10' };
    if (b <= 29.9) return { label: 'Overweight', color: 'text-warning', bg: 'bg-warning/10' };
    return { label: 'Obese', color: 'text-danger', bg: 'bg-danger/10' };
  });

  bmiPosition = computed(() => Math.max(0, Math.min(100, ((this.bmi() - 14) / (40 - 14)) * 100)));

  targetWeightRange = computed(() => {
    const h = (this.height() || 1) / 100;
    return { min: Math.round(18.5 * (h * h)), max: Math.round(24.9 * (h * h)) };
  });

  leanBodyMass = computed(() => {
    const w = this.weight(); const h = this.height(); const g = this.gender();
    if (!w || !h) return 0;
    if (g === 'Male') return parseFloat(((0.407 * w) + (0.267 * h) - 19.2).toFixed(1));
    return parseFloat(((0.252 * w) + (0.473 * h) - 48.3).toFixed(1));
  });

  fatMass = computed(() => parseFloat((this.weight() - this.leanBodyMass()).toFixed(1)));
  bodyFatPercentage = computed(() => parseFloat(((this.fatMass() / (this.weight() || 1)) * 100).toFixed(1)));

  isHealthyFat = computed(() => {
    const bf = this.bodyFatPercentage();
    return this.gender() === 'Male' ? (bf >= 14 && bf <= 24) : (bf >= 21 && bf <= 31);
  });

  ffmi = computed(() => {
    const lbm = this.leanBodyMass(); const h = (this.height() || 1) / 100;
    const rawFfmi = lbm / (h * h);
    return parseFloat((rawFfmi + 6.1 * (1.8 - h)).toFixed(1));
  });

  ffmiStatus = computed(() => {
    const f = this.ffmi(); const g = this.gender();
    if (g === 'Male') {
      if (f < 18) return { label: 'Below Average', color: 'text-info' };
      if (f <= 20) return { label: 'Average Muscle', color: 'text-success' };
      if (f <= 22) return { label: 'Excellent Muscle', color: 'text-primary' };
      return { label: 'Elite / Pro Level', color: 'text-accent' };
    } else {
      if (f < 14) return { label: 'Below Average', color: 'text-info' };
      if (f <= 16) return { label: 'Average Muscle', color: 'text-success' };
      if (f <= 18) return { label: 'Excellent Muscle', color: 'text-primary' };
      return { label: 'Elite / Pro Level', color: 'text-accent' };
    }
  });

  whtr = computed(() => {
    const w = this.waist(); const h = this.height();
    if (!w || !h) return null;
    return parseFloat((w / h).toFixed(2));
  });

  whtrStatus = computed(() => {
    const ratio = this.whtr();
    if (!ratio) return null;
    if (ratio < 0.43) return { label: 'Underweight Range', color: 'text-info', risk: 'Low' };
    if (ratio >= 0.43 && ratio < 0.5) return { label: 'Healthy Range', color: 'text-success', risk: 'Optimal' };
    if (ratio >= 0.5 && ratio < 0.58) return { label: 'Elevated Zone', color: 'text-warning', risk: 'Moderate' };
    return { label: 'Action Needed', color: 'text-danger', risk: 'Elevated' };
  });

  bmr = computed(() => {
    const w = this.weight(); const h = this.height(); const a = this.age(); const g = this.gender();
    if (!w || !h || !a) return 0;
    let base = (10 * w) + (6.25 * h) - (5 * a);
    return g === 'Male' ? Math.round(base + 5) : Math.round(base - 161);
  });

  dailyBurn = computed(() => Math.round(this.bmr() * this.selectedActivity().multiplier));

  targetCalories = computed(() => {
    const burn = this.dailyBurn();
    return this.activeGoalTab() === 'lose' ? burn - 500 : burn + 300;
  });

  isCaloriesTooLow = computed(() => this.targetCalories() < this.bmr());

  macros = computed(() => {
    const cals = this.targetCalories();
    return {
      protein: Math.round((cals * 0.30) / 4), 
      carbs: Math.round((cals * 0.40) / 4),   
      fats: Math.round((cals * 0.30) / 9)     
    };
  });

  waterIntake = computed(() => parseFloat((this.weight() * 0.035).toFixed(1))); 

  heartRateZones = computed(() => {
    const max = Math.round(208 - (0.7 * this.age())); 
    return {
      max: max,
      fatBurn: `${Math.round(max * 0.6)} - ${Math.round(max * 0.7)}`,
      cardio: `${Math.round(max * 0.7)} - ${Math.round(max * 0.8)}`,
      strength: `${Math.round(max * 0.8)} - ${Math.round(max * 0.9)}` 
    };
  });

  ngOnInit() { this.loadUserData(); }

  loadUserData() {
    this.route.queryParams.subscribe(params => {
      const w = Number(params['weight']);
      const h = Number(params['height']);
      const waistVal = params['waist'] ? Number(params['waist']) : null;
      if (w && h) { 
        this.weight.set(w); 
        this.height.set(h); 
        if (waistVal) {
          this.waist.set(waistVal);
        }
        const currentBmi = w / Math.pow(h / 100, 2);
        this.activeGoalTab.set(currentBmi > 24.9 ? 'lose' : 'gain');
      } else { 
        this.goBack(); 
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          if (userObj.full_name) this.fullName.set(userObj.full_name.split(' ')[0]);
          if (userObj.gender) this.gender.set(userObj.gender);
          if (userObj.date_of_birth) this.calculateAge(userObj.date_of_birth);
        }
      } catch (e) { console.error(e); }
    }
    this.isLoaded.set(true);
  }

  private calculateAge(dobStr: string) {
    const birthDate = new Date(dobStr); const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { calculatedAge--; }
    this.age.set(calculatedAge);
  }

  toggleDropdown() { this.isDropdownOpen.set(!this.isDropdownOpen()); }
  selectActivity(activity: ActivityLevel) { this.selectedActivity.set(activity); this.isDropdownOpen.set(false); }
  toggleNotes() { this.isNotesExpanded.set(!this.isNotesExpanded()); }
  goBack() { this.location.back(); }
}