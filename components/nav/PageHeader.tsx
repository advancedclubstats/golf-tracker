/**
 * Shared page title for the main views. Navigation now lives in the bottom bar
 * (BottomNav) and the primary "New Round" action is the center FAB, so this is
 * just the editorial title. Server Component.
 */

export function PageHeader({ title }: { title: string }) {
  return (
    <header className="mb-4">
      <h1 className="font-heading text-[22px] font-bold tracking-[-0.02em]">{title}</h1>
    </header>
  );
}

/**
 * The Round Recall wordmark, mirroring the logged-out splash (green dot +
 * name). Used as the dashboard's header in place of a plain "Dashboard" title.
 */
export function BrandHeader() {
  return (
    <header className="mb-4 flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-[#CDF23E]" aria-hidden />
      <span className="font-heading text-lg font-bold tracking-[-0.02em]">Round Recall</span>
    </header>
  );
}
