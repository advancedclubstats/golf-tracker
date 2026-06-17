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
