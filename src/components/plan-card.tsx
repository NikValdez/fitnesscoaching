import { ArrowUpRight, Dumbbell, Utensils } from 'lucide-react'
import { displayDate } from './workspace'

export type PlanData = {
  id: string
  title: string
  kind: 'FITNESS' | 'NUTRITION'
  description: string
  clientId: string
  startDate: string
  endDate: string | null
  calories: number | null
  proteinGrams: number | null
  carbsGrams: number | null
  fatsGrams: number | null
  exercises: { name: string; sets: number; reps: string; notes: string | null }[]
  client?: { name: string }
}
export function PlanCard({ plan, onOpen }: { plan: PlanData; onOpen: () => void }) {
  const Icon = plan.kind === 'FITNESS' ? Dumbbell : Utensils
  return (
    <button
      className={`plan-card ${plan.kind === 'NUTRITION' ? 'nutrition-plan' : ''}`}
      onClick={onOpen}
    >
      <div className="plan-card-top">
        <span className="plan-icon">
          <Icon size={22} strokeWidth={1.4} />
        </span>
        <span className="eyebrow">
          {plan.kind === 'FITNESS' ? 'Fitness program' : 'Nutrition plan'}
        </span>
        <ArrowUpRight size={18} />
      </div>
      <h3>{plan.title}</h3>
      {plan.client && <span className="plan-client">{plan.client.name}</span>}
      <p>{plan.description || `${plan.exercises.length} exercises, programmed for you.`}</p>
      <div className="plan-card-bottom">
        <span>
          {displayDate(plan.startDate)}
          {plan.endDate ? ` — ${displayDate(plan.endDate)}` : ' · Ongoing'}
        </span>
        <span>
          {plan.kind === 'FITNESS'
            ? `${plan.exercises.length} exercises`
            : plan.calories
              ? `${plan.calories.toLocaleString()} kcal`
              : 'Daily guidance'}
        </span>
      </div>
    </button>
  )
}
export function PlanDetails({ plan }: { plan: PlanData }) {
  return (
    <div className="plan-details">
      <p className="form-note">
        {displayDate(plan.startDate)}
        {plan.endDate ? ` — ${displayDate(plan.endDate)}` : ' · Ongoing'}
        {plan.client ? ` · ${plan.client.name}` : ''}
      </p>
      <p className="preserve-lines">{plan.description}</p>
      {plan.kind === 'FITNESS' ? (
        <div className="exercise-list">
          {plan.exercises.map((exercise, index) => (
            <article key={index}>
              <span className="exercise-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{exercise.name}</h3>
                <strong>
                  {exercise.sets} sets × {exercise.reps}
                </strong>
                {exercise.notes && <p>{exercise.notes}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="macro-grid">
          {[
            ['Calories', plan.calories, 'kcal'],
            ['Protein', plan.proteinGrams, 'g'],
            ['Carbs', plan.carbsGrams, 'g'],
            ['Fats', plan.fatsGrams, 'g'],
          ].map(([label, value, unit]) => (
            <div key={String(label)}>
              <span className="eyebrow">{label}</span>
              <strong>
                {value ?? '—'} <small>{value != null ? unit : ''}</small>
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
