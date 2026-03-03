import type { Metadata } from "next";
import { PublicEventContent } from "@/components/public/PublicEventContent";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function fetchPublicEvent(id: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${apiUrl}/api/public/events/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchPublicEvent(id);

  if (!event) {
    return {
      title: "Event Not Found | A Third Space",
      description: "This event could not be found.",
    };
  }

  const title = `${event.emoji || ""} ${event.title} | A Third Space`.trim();
  const description =
    event.description?.slice(0, 160) || "Discover this event on A Third Space";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(event.originalImageUrl && {
        images: [{ url: event.originalImageUrl, width: 1200, height: 630 }],
      }),
    },
    twitter: {
      card: event.originalImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(event.originalImageUrl && { images: [event.originalImageUrl] }),
    },
  };
}

export default async function PublicEventPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEventContent eventId={id} />;
}
