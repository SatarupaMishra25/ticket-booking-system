const concertArtwork = [
  "/events/midnight-symphony.webp",
  "/events/modern-movements.webp",
];

type ArtworkEvent = {
  title: string;
  type: string;
  posterUrl?: string | null;
};

/** Stable local artwork fallback while uploaded poster storage is optional. */
export function eventArtwork(event: ArtworkEvent) {
  if (event.posterUrl?.startsWith("/")) return event.posterUrl;
  if (event.type === "MOVIE") return "/events/stellar-screening.webp";

  const hash = [...event.title].reduce((total, character) => total + character.charCodeAt(0), 0);
  return concertArtwork[hash % concertArtwork.length];
}
