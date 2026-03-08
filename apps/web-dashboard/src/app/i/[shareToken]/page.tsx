import type { Metadata } from "next";
import { PublicItineraryContent } from "@/components/public/PublicItineraryContent";

interface PageProps {
  params: Promise<{ shareToken: string }>;
}

async function fetchSharedItinerary(shareToken: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  try {
    const res = await fetch(
      `${apiUrl}/api/public/itineraries/${shareToken}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { shareToken } = await params;
  const itinerary = await fetchSharedItinerary(shareToken);

  if (!itinerary) {
    return {
      title: "Itinerary Not Found | A Third Space",
      description: "This itinerary could not be found.",
    };
  }

  const title = `${itinerary.title || "Itinerary"} — ${itinerary.city} | A Third Space`;
  const stops = (itinerary.items || []).length;
  const description =
    itinerary.summary ||
    `A ${stops}-stop itinerary for ${itinerary.city}. Discover the best spots curated by A Third Space.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SharedItineraryPage({ params }: PageProps) {
  const { shareToken } = await params;
  return <PublicItineraryContent shareToken={shareToken} />;
}
