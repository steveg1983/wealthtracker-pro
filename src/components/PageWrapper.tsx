import React from 'react';

interface PageWrapperProps {
  title: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  reducedHeaderWidth?: boolean;
  /**
   * Extra classes for the content container. Its reason to exist is vertical
   * rhythm: a page made of stacked sections should say `space-y-6` here once,
   * rather than have every section bring its own margin and disagree.
   */
  contentClassName?: string;
}

export default function PageWrapper({ title, headerContent, children, rightContent, contentClassName = '' }: PageWrapperProps): React.JSX.Element {
  return (
    <>
      <div className="relative mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
          {headerContent}
        </div>
        {rightContent && (
          <div className="flex items-center gap-2">
            {rightContent}
          </div>
        )}
      </div>
      {/*
        NO BOTTOM RESERVATION HERE — Layout already makes it, once
        (PHONE_CAPTURES_REVIEW_2026-08-13 §3.3).

        This used to carry `pb-24 lg:pb-0`, and on a phone that was the SECOND
        reservation for the same strip of screen: Layout's `page-bottom-gutter`
        already reserves 9.5rem for the bottom nav and the quick-add button
        floating above it, and says in its own comment that the reservation is
        one number precisely so the two cannot drift. MEASURED on the Find page
        at 375×812 before this change: a 208px empty-state card followed by
        96px here plus 152px there — 248px of nothing under a card a fifth of
        that tall, which is what the review photographed and read, reasonably,
        as a card with a min-height failing to fill.

        The two breakpoints did not even agree. `page-bottom-gutter` applies at
        `max-width: 767px`, exactly matching `MobileBottomNav`'s `md:hidden`, so
        the gutter exists when and only when the chrome it clears exists. The
        `lg:pb-0` here ran to 1023px, so between 768 and 1023 this reserved
        96px for a nav bar that is not on screen. Above `md`, Layout's own
        `md:pb-8` is the whole answer.

        Height comes from the content. If a page ever needs more room at the
        bottom, the number belongs in Layout beside the measurements it is made
        of — not here, where it is invisible to the comment that explains it.
      */}
      <div className={`relative ${contentClassName}`.trimEnd()}>
        {children}
      </div>
    </>
  );
}