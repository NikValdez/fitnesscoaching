import { useState } from 'react'
import { Plus, Trash2, Check, LoaderCircle } from 'lucide-react'
import { programSchema, eventSchema, nutritionSchema } from '../lib/coaching-validation'
import { saveProgram, saveEvent, saveNutritionLog } from '../lib/coaching'
import { WorkspaceModal } from './workspace'
import type { PlanData } from './plan-card'

type Client = { id: string; name: string }
type FormProps = { onClose: () => void; onSaved: () => Promise<void> }
export function ProgramForm({
  clients,
  initial,
  clientId,
  kind,
  today,
  onClose,
  onSaved,
}: FormProps & {
  clients: Client[]
  initial?: PlanData
  clientId?: string
  kind: 'FITNESS' | 'NUTRITION'
  today: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [exercises, setExercises] = useState(
    initial?.exercises.map((e) => ({ ...e, notes: e.notes ?? '' })) || [
      { name: '', sets: 3, reps: '8–10', notes: '' },
    ],
  )
  return (
    <WorkspaceModal
      title={
        initial
          ? 'Refine the plan.'
          : kind === 'FITNESS'
            ? 'Build a fitness program.'
            : 'Build a nutrition plan.'
      }
      label={initial ? 'Edit program' : 'Individual programming'}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          const parsed = programSchema.safeParse({
            ...Object.fromEntries(new FormData(e.currentTarget)),
            kind,
            id: initial?.id,
            exercises: kind === 'FITNESS' ? exercises : [],
          })
          if (!parsed.success) {
            setError(parsed.error.issues[0].message)
            return
          }
          setBusy(true)
          try {
            await saveProgram({ data: parsed.data })
            await onSaved()
          } catch {
            setError('Could not save this plan. Check the client and try again.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Client
          <select
            name="clientId"
            aria-label="Client"
            defaultValue={initial?.clientId || clientId || ''}
            required
            disabled={Boolean(initial)}
          >
            <option value="" disabled>
              Select a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {initial && <input type="hidden" name="clientId" value={initial.clientId} />}
        </label>
        <label>
          Plan title
          <input
            name="title"
            required
            minLength={2}
            maxLength={120}
            defaultValue={initial?.title}
            placeholder={
              kind === 'FITNESS'
                ? 'e.g. Foundation strength · Block 01'
                : 'e.g. Nutrition foundations'
            }
          />
        </label>
        <div className="field-row">
          <label>
            Start date
            <input
              name="startDate"
              type="date"
              required
              defaultValue={initial?.startDate || today}
            />
          </label>
          <label>
            End date (optional)
            <input name="endDate" type="date" defaultValue={initial?.endDate || ''} />
          </label>
        </div>
        <label>
          {kind === 'FITNESS' ? 'Program guidance' : 'Nutrition guidance & meal plan'}
          <textarea
            name="description"
            rows={4}
            maxLength={5000}
            required={kind === 'NUTRITION'}
            defaultValue={initial?.description}
            placeholder={
              kind === 'FITNESS'
                ? 'Weekly frequency, progression, rest periods…'
                : 'Meal ideas, portion guidance, habits, and how to use these targets…'
            }
          />
        </label>
        {kind === 'FITNESS' ? (
          <section className="exercise-editor">
            <div className="form-section-heading">
              <h3>Exercises</h3>
              <span className="form-note">Sets, reps, and coaching cues</span>
            </div>
            {exercises.map((exercise, index) => (
              <div className="exercise-editor-row" key={index}>
                <label className="exercise-name">
                  Exercise {index + 1}
                  <input
                    required
                    maxLength={120}
                    value={exercise.name}
                    onChange={(e) =>
                      setExercises(
                        exercises.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)),
                      )
                    }
                    placeholder="e.g. Goblet squat"
                  />
                </label>
                <label>
                  Sets
                  <input
                    type="number"
                    required
                    min={1}
                    max={30}
                    value={exercise.sets}
                    onChange={(e) =>
                      setExercises(
                        exercises.map((x, i) =>
                          i === index ? { ...x, sets: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Reps / time
                  <input
                    required
                    maxLength={60}
                    value={exercise.reps}
                    onChange={(e) =>
                      setExercises(
                        exercises.map((x, i) => (i === index ? { ...x, reps: e.target.value } : x)),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove exercise ${index + 1}`}
                  onClick={() => setExercises(exercises.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} />
                </button>
                <label className="exercise-notes">
                  Coaching cues
                  <input
                    maxLength={5000}
                    value={exercise.notes}
                    onChange={(e) =>
                      setExercises(
                        exercises.map((x, i) =>
                          i === index ? { ...x, notes: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Tempo, rest, load, or technique…"
                  />
                </label>
              </div>
            ))}
            <button
              type="button"
              className="button button-outline"
              disabled={exercises.length >= 40}
              onClick={() =>
                setExercises([...exercises, { name: '', sets: 3, reps: '8–10', notes: '' }])
              }
            >
              <Plus size={15} />
              Add exercise
            </button>
          </section>
        ) : (
          <>
            <div className="form-section-heading">
              <h3>Daily targets</h3>
              <span className="form-note">Optional · set individually for this client</span>
            </div>
            <div className="field-row">
              <label>
                Calories (kcal)
                <input
                  type="number"
                  name="calories"
                  min={0}
                  max={10000}
                  defaultValue={initial?.calories ?? ''}
                />
              </label>
              <label>
                Protein (g)
                <input
                  type="number"
                  name="proteinGrams"
                  min={0}
                  max={1000}
                  defaultValue={initial?.proteinGrams ?? ''}
                />
              </label>
              <label>
                Carbs (g)
                <input
                  type="number"
                  name="carbsGrams"
                  min={0}
                  max={2000}
                  defaultValue={initial?.carbsGrams ?? ''}
                />
              </label>
              <label>
                Fats (g)
                <input
                  type="number"
                  name="fatsGrams"
                  min={0}
                  max={1000}
                  defaultValue={initial?.fatsGrams ?? ''}
                />
              </label>
            </div>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
          {busy ? 'Saving…' : 'Save plan'}
        </button>
      </form>
    </WorkspaceModal>
  )
}

export type EventData = {
  id: string
  clientId: string
  title: string
  kind: 'WORKOUT' | 'CHECK_IN' | 'NUTRITION' | 'COACH_TASK'
  date: string
  time: string | null
  durationMinutes: number
  notes: string | null
  programId: string | null
}
export function EventForm({
  clients,
  plans,
  initial,
  clientId,
  today,
  onClose,
  onSaved,
}: FormProps & {
  clients: Client[]
  plans: PlanData[]
  initial?: EventData
  clientId?: string
  today: string
}) {
  const [selectedClient, setClient] = useState(initial?.clientId || clientId || '')
  const [kind, setKind] = useState(initial?.kind || 'WORKOUT')
  const [programId, setProgramId] = useState(initial?.programId || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <WorkspaceModal
      title={initial ? 'Adjust the schedule.' : 'Make room for progress.'}
      label={initial ? 'Edit scheduled item' : 'Schedule an item'}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          const parsed = eventSchema.safeParse({
            ...Object.fromEntries(new FormData(e.currentTarget)),
            clientId: selectedClient,
            kind,
            programId,
            id: initial?.id,
          })
          if (!parsed.success) {
            setError(parsed.error.issues[0].message)
            return
          }
          setBusy(true)
          try {
            await saveEvent({ data: parsed.data })
            await onSaved()
          } catch {
            setError(
              'Could not save this item. Check that the plan belongs to the selected client.',
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Client
          <select
            required
            value={selectedClient}
            aria-label="Client"
            disabled={Boolean(initial)}
            onChange={(e) => {
              setClient(e.target.value)
              setProgramId('')
            }}
          >
            <option value="" disabled>
              Select a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind)
              setProgramId('')
            }}
          >
            <option value="WORKOUT">Workout / coaching session</option>
            <option value="CHECK_IN">Client check-in</option>
            <option value="NUTRITION">Nutrition task</option>
            <option value="COACH_TASK">Coach-only task</option>
          </select>
        </label>
        {kind === 'COACH_TASK' && (
          <p className="form-note">
            Only coaches can see this task. Use it for plan preparation or follow-up.
          </p>
        )}
        <label>
          Title
          <input
            name="title"
            required
            minLength={2}
            maxLength={120}
            defaultValue={initial?.title}
            placeholder={
              kind === 'COACH_TASK' ? 'e.g. Create nutrition plan' : 'e.g. Lower body session'
            }
          />
        </label>
        <div className="field-row">
          <label>
            Date
            <input type="date" name="date" required defaultValue={initial?.date || today} />
          </label>
          <label>
            Time (Los Angeles)
            <input type="time" name="time" defaultValue={initial?.time || ''} />
          </label>
        </div>
        <label>
          Duration (minutes)
          <input
            name="durationMinutes"
            type="number"
            min={5}
            max={480}
            required
            defaultValue={initial?.durationMinutes || 45}
          />
        </label>
        <label>
          Linked plan (optional)
          <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">No linked plan</option>
            {plans
              .filter(
                (plan) =>
                  plan.clientId === selectedClient &&
                  (kind === 'WORKOUT'
                    ? plan.kind === 'FITNESS'
                    : kind === 'NUTRITION'
                      ? plan.kind === 'NUTRITION'
                      : true),
              )
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Notes
          <textarea
            aria-label="Notes"
            name="notes"
            maxLength={5000}
            rows={3}
            defaultValue={initial?.notes || ''}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Save scheduled item'}
          <Check size={17} />
        </button>
      </form>
    </WorkspaceModal>
  )
}

export type NutritionData = {
  date: string
  calories: number
  proteinGrams: number
  carbsGrams: number
  fatsGrams: number
  waterLitres: number
  notes: string | null
}
export function NutritionForm({
  initial,
  today,
  onClose,
  onSaved,
}: FormProps & { initial?: NutritionData; today: string }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <WorkspaceModal
      title="Your nutrition, on record."
      label="Daily tracking"
      busy={busy}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          const parsed = nutritionSchema.safeParse(
            Object.fromEntries(new FormData(e.currentTarget)),
          )
          if (!parsed.success) {
            setError(parsed.error.issues[0].message)
            return
          }
          setBusy(true)
          try {
            await saveNutritionLog({ data: parsed.data })
            await onSaved()
          } catch {
            setError('Could not save your nutrition log. Please try again.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Date
          <input type="date" name="date" required defaultValue={initial?.date || today} />
        </label>
        <div className="field-row">
          {[
            ['Calories (kcal)', 'calories', 15000],
            ['Protein (g)', 'proteinGrams', 1000],
            ['Carbs (g)', 'carbsGrams', 2000],
            ['Fats (g)', 'fatsGrams', 1000],
          ].map(([label, name, max]) => (
            <label key={String(name)}>
              {label}
              <input
                type="number"
                name={String(name)}
                required
                min={0}
                max={Number(max)}
                defaultValue={initial?.[name as 'calories'] ?? ''}
              />
            </label>
          ))}
        </div>
        <label>
          Water (litres)
          <input
            type="number"
            name="waterLitres"
            required
            min={0}
            max={20}
            step={0.1}
            defaultValue={initial?.waterLitres ?? ''}
          />
        </label>
        <label>
          Notes
          <textarea
            name="notes"
            rows={3}
            maxLength={5000}
            defaultValue={initial?.notes || ''}
            placeholder="Meals, habits, or anything you noticed…"
          />
        </label>
        <p className="form-note">
          One entry per day. Saving a date you’ve already logged updates that entry.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Save nutrition log'}
          <Check size={17} />
        </button>
      </form>
    </WorkspaceModal>
  )
}
