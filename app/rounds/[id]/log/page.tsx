import { notFound } from "next/navigation";
import { getRound } from "@/lib/db/rounds";
import { ShotEntryFlow } from "./ShotEntryFlow";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LogPage({ params }: Props) {
  const { id } = await params;
  const round = await getRound(id);

  if (!round) notFound();

  return <ShotEntryFlow roundId={id} sessionType={round.session_type} />;
}
