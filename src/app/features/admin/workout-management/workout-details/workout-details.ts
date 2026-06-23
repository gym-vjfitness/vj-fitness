import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WorkoutDay, WorkoutExercise, WorkoutPlanDetails } from '../../../../models/workout.model';
import { WorkoutService } from '../../../../services/workout-service';
import { ExerciseService } from '../../../../services/exercise-service';
import { StorageService } from '../../../../services/storage-service';
import { VideoPlayer } from '../../../../shared/ui/video-player/video-player';

export interface EnrichedExercise extends Omit<WorkoutExercise, 'name' | 'trackingType' | 'setDetails'> {
  name?: string;
  notes?: string;
  dayNotes?: string;
  reps?: string;
  duration?: string;
  icon?: string;
  videoUrl?: string;
  setDetails: string[];
  trackingType?: 'time' | 'reps' | string;
  restSeconds?: number;
  details?: {
    id: string;
    name: string;
    description: string;
    video_url: string;
    target_muscle_group: string;
    equipment_required: string;
  };
}

export interface EnrichedWorkoutDay extends Omit<WorkoutDay, 'exercises'> {
  dayNotes?: string;
  focusMuscle?: string;
  exercises: EnrichedExercise[];
}

interface WorkoutCachePayload {
  workoutPlan: WorkoutPlanDetails;
  enrichedDays: EnrichedWorkoutDay[];
  timestamp: number;
}

@Component({
  selector: 'app-workout-details',
  standalone: true,
  imports: [CommonModule, VideoPlayer, RouterLink],
  templateUrl: './workout-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./workout-details.scss'],
})
export class WorkoutDetails implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private storageService = inject(StorageService);
  private location = inject(Location);

  isLoading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  isUnassigned = signal<boolean>(false);
  workoutPlan = signal<WorkoutPlanDetails | null>(null);
  enrichedDays = signal<EnrichedWorkoutDay[]>([]);
  selectedDayIndex = signal<number>(0);
  expandedExerciseIndex = signal<number | null>(null);
  activeVideoUrl = signal<string | null>(null);

  isReloadDisabled = signal<boolean>(false);
  private cooldownTimeout: any;

  activeDay = computed(() => {
    const days = this.enrichedDays();
    return days.length > 0 ? days[this.selectedDayIndex()] : null;
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id || id === 'unassigned') {
      this.isUnassigned.set(true);
      this.isLoading.set(false);
      return;
    }

    this.loadWorkoutData(id);
  }

  ngOnDestroy() {
    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
    }
  }

  private isValidCache(cache: unknown): cache is WorkoutCachePayload {
    if (!cache || typeof cache !== 'object') return false;

    const data = cache as WorkoutCachePayload;
    return !!data.workoutPlan && Array.isArray(data.enrichedDays) && typeof data.timestamp === 'number';
  }

  private buildSetDetails(ex: any): string[] {
    if (Array.isArray(ex?.setDetails) && ex.setDetails.length > 0) {
      return ex.setDetails.map((item: any) => String(item).trim()).filter(Boolean);
    }

    const reps = String(ex?.reps ?? '').trim();
    const duration = String(ex?.duration ?? '').trim();
    const source = reps || duration;

    if (source.includes('-')) {
      return source
        .split('-')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    const sets = Number(ex?.sets ?? 0);

    if (source && sets > 1) {
      return Array.from({ length: sets }, () => source);
    }

    if (sets > 0) {
      return Array.from({ length: sets }, (_, index) => String(index + 1));
    }

    return source ? [source] : [];
  }

  private buildExerciseDetails(ex: any, day: any, index: number) {
    const name = String(ex?.name ?? ex?.details?.name ?? '').trim() || `Exercise ${index + 1}`;

    return {
      id: String(ex?.exercise_id ?? ex?.id ?? `${day?.dayName ?? 'day'}-${index}`),
      name,
      description: String(ex?.details?.description ?? ex?.description ?? '').trim(),
      video_url: String(ex?.details?.video_url ?? ex?.videoUrl ?? ex?.video_url ?? '').trim(),
      target_muscle_group: String(
        ex?.details?.target_muscle_group ??
          ex?.target_muscle_group ??
          day?.focusMuscle ??
          day?.focus_muscle ??
          ''
      ).trim(),
      equipment_required: String(ex?.details?.equipment_required ?? ex?.equipment_required ?? '').trim(),
    };
  }

  private normalizeScheduleData(scheduleData: any[] = [], exerciseMap = new Map<string, any>()): EnrichedWorkoutDay[] {
    const days = Array.isArray(scheduleData) ? scheduleData : [];

    return days.map((day: any) => {
      const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
      const focusMuscle = String(day?.focusMuscle ?? day?.focus_muscle ?? '').trim();
      const dayNotes = String(day?.dayNotes ?? day?.notes ?? '').trim();

      return {
        ...day,
        dayName: day?.dayName ?? '',
        focusMuscle,
        dayNotes,
        exercises: exercises.map((ex: any, index: number) => {
          const apiDetails = ex?.exercise_id ? exerciseMap.get(ex.exercise_id) : undefined;
          const rawDetails = this.buildExerciseDetails(ex, day, index);
          const details = apiDetails ?? rawDetails;

          // Firmly extract video URL to prevent it from getting lost
          const videoUrl = String(ex?.videoUrl ?? ex?.video_url ?? details.video_url ?? '').trim();

          return {
            ...ex,
            exercise_id: String(ex?.exercise_id ?? details.id),
            name: ex?.name ?? details.name,
            notes: String(ex?.notes ?? ex?.dayNotes ?? dayNotes ?? '').trim(),
            dayNotes,
            reps: ex?.reps,
            duration: ex?.duration,
            icon: ex?.icon,
            videoUrl: videoUrl,
            setDetails: this.buildSetDetails(ex),
            trackingType: ex?.trackingType ?? (ex?.duration ? 'time' : 'reps'),
            restSeconds: ex?.restSeconds ?? ex?.rest_seconds,
            details: {
              ...details,
              video_url: videoUrl 
            },
          } as EnrichedExercise;
        }),
      } as EnrichedWorkoutDay;
    });
  }

  async loadWorkoutData(id: string, forceReload: boolean = false) {
    this.isLoading.set(true);
    this.errorMsg.set(null);
    this.isUnassigned.set(false);

    const cacheKey = `workout_cache_${id}`;

    try {
      if (!forceReload) {
        const cached = await this.storageService.getItem<WorkoutCachePayload>(cacheKey);

        if (this.isValidCache(cached)) {
          this.workoutPlan.set(cached.workoutPlan);
          
          // FIX: Apply cached enriched days directly instead of re-normalizing them.
          this.enrichedDays.set(cached.enrichedDays);
          this.selectedDayIndex.set(0);
          this.isLoading.set(false);

          this.checkReloadCooldown(cached.timestamp);
          return;
        }
      }

      const { data: plan, error: planError } = await this.workoutService.getWorkoutPlanById(id);
      if (planError || !plan) throw new Error('Workout protocol not found.');

      this.workoutPlan.set(plan);

      const exerciseIds = new Set<string>();
      (plan.schedule_data || []).forEach((day: WorkoutDay) => {
        day.exercises?.forEach((ex: WorkoutExercise) => {
          if ((ex as any).exercise_id) exerciseIds.add((ex as any).exercise_id);
        });
      });

      let exercisesDetails: any[] = [];
      if (exerciseIds.size > 0) {
        exercisesDetails = await this.exerciseService.getExercisesByIds(Array.from(exerciseIds));
      }

      const exerciseMap = new Map(exercisesDetails.map((ex) => [ex.id, ex]));
      const enrichedSchedule = this.normalizeScheduleData(plan.schedule_data || [], exerciseMap);

      this.enrichedDays.set(enrichedSchedule);
      this.selectedDayIndex.set(0);

      const currentTimestamp = Date.now();
      await this.storageService.setItem(cacheKey, {
        workoutPlan: plan,
        enrichedDays: enrichedSchedule,
        timestamp: currentTimestamp,
      });

      this.checkReloadCooldown(currentTimestamp);
    } catch (err: any) {
      console.error('Error loading workout data:', err);
      this.errorMsg.set(err?.message || 'Failed to sync data.');
      this.isUnassigned.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  forceReload() {
    if (this.isReloadDisabled()) return;
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadWorkoutData(id, true);
    }
  }

  private checkReloadCooldown(timestamp: number) {
    const ONE_HOUR = 60 * 60 * 1000;
    const elapsed = Date.now() - timestamp;

    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
    }

    if (elapsed < ONE_HOUR) {
      this.isReloadDisabled.set(true);
      this.cooldownTimeout = setTimeout(() => {
        this.isReloadDisabled.set(false);
      }, ONE_HOUR - elapsed);
    } else {
      this.isReloadDisabled.set(false);
    }
  }

  selectDay(index: number) {
    this.selectedDayIndex.set(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  playVideo(url?: string) {
    if (url) {
      this.activeVideoUrl.set(url);
    }
  }

  toggleExercise(index: number) {
    this.expandedExerciseIndex.update((current) => (current === index ? null : index));
  }

  closeVideoModal() {
    this.activeVideoUrl.set(null);
  }

  goBack() {
    this.location.back();
  }
}