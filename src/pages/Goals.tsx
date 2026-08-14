import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { useApp } from "../contexts/AppContextSupabase";
import GoalModal from "../components/GoalModal";
import { TargetIcon, TrendingUpIcon, CalendarIcon } from "../components/icons";
import { PlusIcon, EditIcon, DeleteIcon } from "../components/icons";
import { IconButton } from "../components/icons/IconButton";
import type { Goal } from "../types";
import type { DecimalAccount, DecimalInstance } from "../types/decimal-types";
import PageWrapper from "../components/PageWrapper";
import PageTip from "../components/PageTip";
import { toDecimal } from "../utils/decimal";
import { formatDecimal } from "../utils/decimal-format";
import { useCurrencyDecimal } from "../hooks/useCurrencyDecimal";
import Confetti from "../components/Confetti";
import GoalCelebrationModal from "../components/GoalCelebrationModal";
import { goalAchievementService } from "../services/goalAchievementService";
import { useNotifications } from "../contexts/NotificationContext";
import { usePreferences } from "../contexts/PreferencesContext";
import AchievementHistory from "../components/AchievementHistory";
import {
  daysUntil,
  formatDaysRemaining,
  isDeadlineUrgent,
  monthlyTargetToStayOnTrack
} from "../utils/goalDates";
import { preserveDemoParam } from "../utils/navigation";
import { createScopedLogger } from "../loggers/scopedLogger";

const logger = createScopedLogger('GoalsPage');

/** What the linked accounts say about one goal, once currencies are settled. */
interface LinkedAccountsSummary {
  /** Combined balance of the linked accounts that still exist and are open. */
  total: DecimalInstance;
  /** Those accounts, in the order the goal lists them. */
  available: DecimalAccount[];
  /** Links pointing at an account that has been closed or deleted. */
  unavailableCount: number;
}

/**
 * A goal plus everything the page needs to draw it — money as Decimal, and a
 * single answer to "how far along is this?" so the cards, the totals, the
 * completion write and the notifications can never disagree.
 */
interface GoalView {
  goal: Goal;
  current: DecimalInstance;
  target: DecimalInstance;
  /** True percentage, NOT clamped — 143% is a fact worth showing. */
  progress: number;
  /** Progress is coming from linked account balances, not the typed-in figure. */
  isTracked: boolean;
  linkedAccounts: DecimalAccount[];
  unavailableCount: number;
  isReached: boolean;
  isPaused: boolean;
}

const progressPercent = (current: DecimalInstance, target: DecimalInstance): number =>
  target.greaterThan(0) ? current.dividedBy(target).times(100).toNumber() : 0;

export default function Goals(): React.JSX.Element {
  const { goals, deleteGoal, updateGoal, getDecimalAccounts } = useApp();
  const { formatCurrency, convertAndSum } = useCurrencyDecimal();
  const { checkGoalProgress } = useNotifications();
  const { enableGoalCelebrations } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebratingGoal, setCelebratingGoal] = useState<Goal | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [showAchievements, setShowAchievements] = useState(false);
  const [linkedSummaries, setLinkedSummaries] = useState<Map<string, LinkedAccountsSummary>>(
    () => new Map()
  );

  const decimalAccounts = useMemo(() => getDecimalAccounts(), [getDecimalAccounts]);
  const accountsById = useMemo(
    () => new Map(decimalAccounts.map((account: DecimalAccount) => [account.id, account])),
    [decimalAccounts]
  );

  /**
   * Linked accounts DRIVE progress: the page has always promised "link accounts
   * for automatic progress tracking", and this is where that becomes true.
   *
   * Balances are summed through convertAndSum, so a goal linked to a euro
   * account and a sterling one totals correctly in the display currency
   * instead of adding the two numbers together as if they were the same money.
   */
  useEffect(() => {
    let cancelled = false;

    const buildSummaries = async (): Promise<void> => {
      const next = new Map<string, LinkedAccountsSummary>();

      for (const goal of goals) {
        const linkedIds = goal.linkedAccountIds ?? [];
        if (linkedIds.length === 0) continue;

        const available: DecimalAccount[] = [];
        for (const id of linkedIds) {
          const account = accountsById.get(id);
          // A closed account is as unavailable as a deleted one: it no longer
          // holds money towards this goal.
          if (account && account.isActive !== false) available.push(account);
        }

        const total = available.length > 0
          ? await convertAndSum(available.map(account => ({
              amount: account.balance,
              currency: account.currency
            })))
          : toDecimal(0);

        next.set(goal.id, {
          total,
          available,
          unavailableCount: linkedIds.length - available.length
        });
      }

      if (!cancelled) setLinkedSummaries(next);
    };

    void buildSummaries();
    return (): void => { cancelled = true; };
  }, [goals, accountsById, convertAndSum]);

  const goalViews = useMemo<GoalView[]>(() => goals.map(goal => {
    const target = toDecimal(goal.targetAmount);
    const summary = linkedSummaries.get(goal.id);
    // Links whose accounts have ALL gone leave nothing to derive from, so the
    // goal falls back to its last stored amount and says so on the card. The
    // alternative — showing £0 — would look like the money had vanished.
    const isTracked = summary !== undefined && summary.available.length > 0;
    const current = isTracked ? summary.total : toDecimal(goal.currentAmount);
    const progress = progressPercent(current, target);

    return {
      goal,
      current,
      target,
      progress,
      isTracked,
      linkedAccounts: summary?.available ?? [],
      unavailableCount: summary?.unavailableCount ?? 0,
      isReached: goal.status === 'completed' || progress >= 100,
      isPaused: goal.status === 'paused' || goal.isActive === false
    };
  }), [goals, linkedSummaries]);

  const activeViews = useMemo(
    () => goalViews.filter(view => !view.isPaused && !view.isReached),
    [goalViews]
  );
  const completedViews = useMemo(() => goalViews.filter(view => view.isReached), [goalViews]);
  const pausedViews = useMemo(
    () => goalViews.filter(view => view.isPaused && !view.isReached),
    [goalViews]
  );

  /**
   * The goals as the rest of the app should see them: for a linked goal the
   * derived balance IS its current amount, so milestone and completion
   * notifications fire off the same number the card shows.
   */
  const effectiveGoals = useMemo<Goal[]>(
    () => goalViews.map(view => ({
      ...view.goal,
      currentAmount: view.current.toNumber(),
      progress: view.current.toNumber()
    })),
    [goalViews]
  );

  // The snapshot the next run compares against. A REF, not state: holding it in
  // state while listing it as a dependency of the effect that sets it is an
  // unbounded render loop (set → re-render → effect → set …).
  const previousSnapshotRef = useRef<{ goals: Goal[]; progress: Map<string, number> } | null>(null);
  // Goals we have already tried to mark complete, so a failing write is
  // attempted once rather than on every data change.
  const completionWritesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const previous = previousSnapshotRef.current;
    previousSnapshotRef.current = {
      goals: effectiveGoals,
      progress: new Map(goalViews.map(view => [view.goal.id, view.progress]))
    };

    if (goalViews.length === 0) return;

    // Milestones and completion notifications belong to notificationService,
    // which fires on a THRESHOLD CROSSING. The page used to run its own
    // sessionStorage-banded copy alongside it, so 25% arrived twice.
    if (previous && previous.goals.length > 0) {
      checkGoalProgress(effectiveGoals, previous.goals);
    }

    for (const view of goalViews) {
      if (!view.isReached) continue;
      const { goal } = view;

      // Achievement is a fact about the goal, so it lives on the goal: status
      // + completed_at reach every device, where a localStorage flag reached
      // one browser. Recording is idempotent per goal id.
      goalAchievementService.recordAchievement(
        goal,
        goal.completedAt ? new Date(goal.completedAt) : new Date()
      );

      if (goal.status !== 'completed' && !completionWritesRef.current.has(goal.id)) {
        completionWritesRef.current.add(goal.id);
        void updateGoal(goal.id, {
          status: 'completed',
          achieved: true,
          completedAt: new Date().toISOString()
        }).catch((error: unknown) => {
          logger.error('Failed to mark goal as completed', error);
        });
      }

      // Confetti is for the moment it happens — a goal that was already at
      // 100% when the page opened has had its party.
      const crossedJustNow = previous !== null && (previous.progress.get(goal.id) ?? 100) < 100;
      if (
        crossedJustNow &&
        enableGoalCelebrations &&
        !goalAchievementService.hasBeenCelebrated(goal.id)
      ) {
        goalAchievementService.markAsCelebrated(goal.id);
        setCelebrationMessage(goalAchievementService.getCelebrationMessage(goal));
        setCelebratingGoal(goal);
        setShowConfetti(true);
      }
    }
  }, [goalViews, effectiveGoals, checkGoalProgress, enableGoalCelebrations, updateGoal]);

  const handleEdit = (goal: Goal): void => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string): void => {
    if (confirm("Are you sure you want to delete this goal?")) {
      void deleteGoal(id).catch((error: unknown) => {
        logger.error('Failed to delete goal', error);
      });
    }
  };

  const handleCloseModal = (): void => {
    setIsModalOpen(false);
    setEditingGoal(undefined);
  };

  const openAccount = (accountId: string): void => {
    navigate(preserveDemoParam(`/accounts/${accountId}`, location.search));
  };

  const formatPercentage = (value: DecimalInstance | number, decimals: number = 1): string => {
    return formatDecimal(value, decimals);
  };

  const getGoalIcon = (type: Goal["type"]): string => {
    switch (type) {
      case "savings":
        return "💰";
      case "debt-payoff":
        return "💳";
      case "investment":
        return "📈";
      case "custom":
        return "🎯";
    }
  };

  const totalTargetAmount = useMemo(
    () => activeViews.reduce((sum, view) => sum.plus(view.target), toDecimal(0)),
    [activeViews]
  );
  const totalCurrentAmount = useMemo(
    () => activeViews.reduce((sum, view) => sum.plus(view.current), toDecimal(0)),
    [activeViews]
  );
  const overallProgress = progressPercent(totalCurrentAmount, totalTargetAmount);
  const overallRingProgress = Math.min(Math.max(overallProgress, 0), 100);

  return (
    <PageWrapper
      title="Goals"
      rightContent={
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="cursor-pointer rounded-full"
          aria-label="Add goal"
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
          >
            <circle
              cx="24"
              cy="24"
              r="24"
              fill="#D9E1F2"
              className="transition-all duration-200"
              onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
              onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
            />
            <g transform="translate(12, 12)">
              <path
                d="M12 5v14M5 12h14"
                stroke="#1F2937"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </button>
      }
    >

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-body">Active Goals</p>
              <p className="text-page font-bold text-gray-900 dark:text-white">{activeViews.length}</p>
            </div>
            <TargetIcon className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-body">Total Target</p>
              <p className="text-page font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalTargetAmount)}
              </p>
            </div>
            <TrendingUpIcon className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-body">Total Saved</p>
              <p className="text-page font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalCurrentAmount)}
              </p>
            </div>
            <div className="relative h-8 w-8">
              <svg className="h-8 w-8 transform -rotate-90">
                <circle cx="16" cy="16" r="14" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="#3b82f6"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${overallRingProgress * 0.88} 88`}
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-body">Completed</p>
              <p className="text-page font-bold text-gray-900 dark:text-white">{completedViews.length}</p>
            </div>
            <div className="text-page">🏆</div>
          </div>
        </div>
        </div>

        {/* Active Goals */}
        <div className="pt-4">
          {activeViews.length > 0 && (
        <div className="mb-6">
          <h2 className="text-card font-semibold text-theme-heading dark:text-white mb-4">Active Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeViews.map((view) => {
              const { goal } = view;
              const progressDisplay = formatPercentage(toDecimal(view.progress), 1);
              // The BAR is clamped (a 143% bar would spill out of its track);
              // the number beside it is not, because that is the truth.
              const barWidth = Math.min(Math.max(view.progress, 0), 100);
              const daysLeft = daysUntil(goal.targetDate);
              const monthlyTarget = monthlyTargetToStayOnTrack({
                targetAmount: view.target,
                currentAmount: view.current,
                targetDate: goal.targetDate
              });

              return (
                <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      <span className="text-page">{getGoalIcon(goal.type)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                        <p className="text-body text-gray-500 dark:text-gray-400 capitalize">{(goal.type ?? "savings").replace("-", " ")}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <IconButton
                        onClick={() => handleEdit(goal)}
                        icon={<EditIcon size={16} />}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                        aria-label={`Edit ${goal.name}`}
                      />
                      <IconButton
                        onClick={() => handleDelete(goal.id)}
                        icon={<DeleteIcon size={16} />}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                        aria-label={`Delete ${goal.name}`}
                      />
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-body text-gray-600 dark:text-gray-400 mb-4">{goal.description}</p>
                  )}

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-body mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                        <span className="font-medium text-gray-900 dark:text-white">{progressDisplay}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          /* ONE HUE, WALKED — not a traffic light.
                             This ran gray → yellow → navy → blue by
                             threshold, which is traffic-light vocabulary
                             applied to something with no failure state: a goal
                             60% funded is a SCALE, and a scale has no bad end.
                             Amber at the midpoint said "caution" about a goal
                             that is simply in progress, and spent the yellow
                             thread on a bar with nothing to press.

                             Navy walked from the end that contrasts with the
                             ground, exactly as the categorical ramp does, so
                             fuller reads as further along rather than as a
                             different KIND of thing. `bg-nav-bg`, not
                             `bg-primary`: Tailwind cannot put an opacity
                             modifier on a bare `var()` and emits no rule at
                             all — see the probe recorded in index.css. */
                          className={`h-2 rounded-full transition-all duration-300 ${
                            view.progress >= 100
                              ? "bg-nav-bg"
                              : view.progress >= 75
                                ? "bg-nav-bg/80"
                                : view.progress >= 50
                                  ? "bg-nav-bg/60"
                                  : "bg-nav-bg/40"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-body">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Current</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(view.current)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Target</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(view.target)}
                        </p>
                      </div>
                    </div>

                    {monthlyTarget && (
                      <p className="text-body font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(monthlyTarget)}/month to stay on track
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-body">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                        <span className={isDeadlineUrgent(daysLeft) ? "text-red-600" : "text-gray-600 dark:text-gray-400"}>
                          {formatDaysRemaining(daysLeft)}
                        </span>
                      </div>
                      {view.isTracked && (
                        // The "Current" figure above IS this sum — say where it
                        // comes from rather than printing the same money twice.
                        <div className="text-gray-600 dark:text-gray-400">
                          Tracked from linked accounts
                        </div>
                      )}
                    </div>

                    {view.linkedAccounts.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {view.linkedAccounts.map(account => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => openAccount(account.id)}
                            className="px-2 py-1 rounded-lg text-dense font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                            aria-label={`Open ${account.name}`}
                          >
                            {account.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* A CAVEAT, not a next action. It is a standing statement
                        about what this figure cannot include, and amber made a
                        permanent truth about the data look like a transient
                        problem with it. Neutral, and it says the same thing. */}
                    {view.unavailableCount > 0 && (
                      <p className="text-body text-gray-500 dark:text-gray-400">
                        {view.unavailableCount === 1
                          ? '1 linked account unavailable'
                          : `${view.unavailableCount} linked accounts unavailable`}
                        {view.isTracked
                          ? ' — this total covers the rest'
                          : ' — showing the last saved amount'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeViews.length === 0 && goals.length === 0 && (
        /* Empty state when no goals at all */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-12" data-testid="empty-state">
          <div className="text-center">
            <TargetIcon className="h-24 w-24 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-card font-semibold text-gray-900 dark:text-white mb-2">
              No goals yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Set financial goals to track your progress towards savings targets, debt payoff, or investment milestones.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#1a2332] text-white px-6 py-3 rounded-lg hover:bg-[#2d3a4d] transition-colors"
            >
              <PlusIcon size={20} />
              <span>Create Your First Goal</span>
            </button>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
                <div className="text-page mb-2">💰</div>
                <h4 className="font-medium text-gray-900 dark:text-white text-body">Savings Goal</h4>
                <p className="text-dense text-gray-600 dark:text-gray-400 mt-1">
                  Build your emergency fund or save for a big purchase
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
                <div className="text-page mb-2">💳</div>
                <h4 className="font-medium text-gray-900 dark:text-white text-body">Debt Payoff</h4>
                <p className="text-dense text-gray-600 dark:text-gray-400 mt-1">
                  Track progress on paying down credit cards or loans
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
                <div className="text-page mb-2">📈</div>
                <h4 className="font-medium text-gray-900 dark:text-white text-body">Investment</h4>
                <p className="text-dense text-gray-600 dark:text-gray-400 mt-1">
                  Monitor your investment portfolio growth targets
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeViews.length === 0 && goals.length > 0 && (
        /* Goals exist, none of them active: say which, rather than claiming
           everything is finished when some are merely paused. */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-12" data-testid="empty-state">
          <div className="text-center">
            <div className="text-5xl mb-4">{completedViews.length > 0 ? '🎉' : '⏸️'}</div>
            <h3 className="text-card font-semibold text-gray-900 dark:text-white mb-2">
              {completedViews.length > 0 && pausedViews.length === 0
                ? 'All goals completed!'
                : 'No active goals'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {completedViews.length > 0 && pausedViews.length === 0
                ? 'Congratulations on achieving your goals! Ready to set new financial targets?'
                : 'Your goals are paused or finished. Resume one by editing it, or set a new target.'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#1a2332] text-white px-6 py-3 rounded-lg hover:bg-[#2d3a4d] transition-colors"
            >
              <PlusIcon size={20} />
              <span>Set a New Goal</span>
            </button>
          </div>
        </div>
      )}

      {/* Paused Goals */}
      {pausedViews.length > 0 && (
        <div className="mb-6">
          <h2 className="text-card font-semibold text-theme-heading dark:text-white mb-4">Paused Goals</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {pausedViews.map((view) => (
                <div key={view.goal.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl opacity-50">{getGoalIcon(view.goal.type)}</span>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{view.goal.name}</h4>
                      <p className="text-body text-gray-500 dark:text-gray-400">
                        Paused • {formatCurrency(view.current)} of {formatCurrency(view.target)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IconButton
                      onClick={() => handleEdit(view.goal)}
                      icon={<EditIcon size={16} />}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                      aria-label={`Edit ${view.goal.name}`}
                    />
                    <IconButton
                      onClick={() => handleDelete(view.goal.id)}
                      icon={<DeleteIcon size={16} />}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                      aria-label={`Delete ${view.goal.name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedViews.length > 0 && (
        <div>
          <h2 className="text-card font-semibold text-theme-heading dark:text-white mb-4">Completed Goals</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {completedViews.map((view) => (
                <div key={view.goal.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl opacity-50">{getGoalIcon(view.goal.type)}</span>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{view.goal.name}</h4>
                      <p className="text-body text-gray-500 dark:text-gray-400">
                        {view.goal.completedAt
                          ? `Completed ${format(new Date(view.goal.completedAt), 'd MMM yyyy')}`
                          : 'Completed'} • {formatCurrency(view.target)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IconButton
                      onClick={() => handleEdit(view.goal)}
                      icon={<EditIcon size={16} />}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                      aria-label={`Edit ${view.goal.name}`}
                    />
                    <IconButton
                      onClick={() => handleDelete(view.goal.id)}
                      icon={<DeleteIcon size={16} />}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                      aria-label={`Delete ${view.goal.name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Achievement History Toggle */}
        {goals.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowAchievements(!showAchievements)}
              className="text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-2"
            >
              <span>🏆</span>
              {showAchievements ? 'Hide' : 'View'} Achievement History
            </button>
          </div>
        )}

        {/* Achievement History */}
        {showAchievements && (
          <div className="mt-6">
            <AchievementHistory />
          </div>
        )}
        </div>
      </div>

      <GoalModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        goal={editingGoal}
      />

      {/* Confetti Animation */}
      <Confetti
        isActive={showConfetti}
        duration={4000}
        onComplete={() => setShowConfetti(false)}
      />

      {/* Goal Celebration Modal */}
      {celebratingGoal && (
        <GoalCelebrationModal
          isOpen={!!celebratingGoal}
          onClose={() => setCelebratingGoal(null)}
          goal={celebratingGoal}
          message={celebrationMessage}
        />
      )}

    <PageTip id="goals-intro" title="Track your financial goals" description="Set savings targets, debt payoff goals, and investment milestones. Link accounts and the balance in them becomes the goal's progress, automatically." />
    </PageWrapper>
  );
}
