import type { ApplicationStep } from '@my-app/shared';

export function deriveApplicationState(steps: ApplicationStep[]) {
  const currentStep = steps.length > 0 ? steps[steps.length - 1].name : '未着手';
  if (steps.some((step) => step.result === '不合格' || step.result === '辞退')) {
    return { status: '終了' as const, currentStep };
  }
  if (steps.some((step) => step.name === '最終面接' && step.result === '合格')) {
    return { status: '内定' as const, currentStep };
  }
  return { status: undefined, currentStep };
}
