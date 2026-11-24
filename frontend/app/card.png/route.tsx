import { CARD } from "@/lib/siteMeta";
import { loadCardFonts, renderCard } from "@/lib/shareCard";

// The preview picture for links to the site (see layout.tsx). Built once, at deploy time.
export const dynamic = "force-static";

export async function GET() {
  return renderCard(CARD, await loadCardFonts());
}
