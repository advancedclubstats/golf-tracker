import { NewRoundForm } from "./NewRoundForm";

export default function NewRoundPage() {
  return (
    <main className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Round</h1>
        <p className="text-sm text-muted-foreground">
          Fill in the details, then log your shots hole by hole.
        </p>
      </div>
      <NewRoundForm />
    </main>
  );
}
