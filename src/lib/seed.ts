import { addDays, parseISO, toISO } from "./engine";
import type { PlannedStop, Settings, Stay } from "./types";

/** Arrival dates and nights transcribed from the supplied September 21 itinerary.
 * Checkout belongs to the next stop, so logged end dates are inclusive.
 */
const ITINERARY: [state: string, location: string, arrival: string, nights: number][] = [
  ["TN", "Nashville Shores Lakeside Resort — Hermitage", "2026-04-23", 14],
  ["TN", "Piney River RV Resort — Bon Aqua", "2026-05-07", 9],
  ["IN", "Weary Traveler RV Park — Seymour", "2026-05-16", 1],
  ["MI", "Covert / South Haven KOA Holiday — Covert", "2026-05-17", 1],
  ["MI", "Sun Outdoors Petoskey Bay Harbor — Petoskey", "2026-05-18", 12],
  ["MI", "Pictured Rocks RV Park & Campground — Christmas", "2026-05-30", 7],
  ["WI", "Breezy Hill Campground — Fond Du Lac", "2026-06-06", 14],
  ["IA", "Crossroads RV Park — Mount Pleasant", "2026-06-20", 8],
  ["NE", "La Bonita RV Park — Norfolk", "2026-06-28", 7],
  ["SD", "Castlewood Municipal Campground — Castlewood", "2026-07-05", 1],
  ["MN", "In The Woods — Walker", "2026-07-06", 11],
  ["ND", "North Park Campground — Dickinson", "2026-07-17", 1],
  ["MT", "Spring Creek Campground and Trout Ranch — Big Timber", "2026-07-18", 7],
  ["MT", "Ennis RV Park by Starry Night Lodging — Ennis", "2026-07-25", 7],
  ["MT", "Sojo Norwegian Ranch — Missoula", "2026-08-01", 1],
  ["MT", "Whispering Pines RV Park — Columbia Falls", "2026-08-02", 13],
  ["MT", "Libby Dam RV Park — Libby", "2026-08-15", 7],
  ["BC", "Fernie RV Resort — Fernie", "2026-08-22", 28],
  ["ID", "Silverwood RV Park and Campground — Athol", "2026-09-19", 2],
  ["ID", "Kootenai County Fairgrounds RV Park — Coeur d'Alene", "2026-09-21", 6],
  ["ID", "Bear Den RV Resort — Grangeville", "2026-09-27", 6],
  ["WA", "Steamboat Rock State Park — Electric City", "2026-10-03", 1],
  ["WA", "Skagit River RV — Marblemount", "2026-10-04", 6],
  ["WA", "Taidnapam Park — Glenoma", "2026-10-10", 14],
  ["WA", "Olympic Pines RV Park — Port Angeles", "2026-10-24", 14],
  ["OR", "Fort Stevens State Park — Hammond", "2026-11-07", 7],
  ["OR", "Sun Outdoors Coos Bay — Coos Bay", "2026-11-14", 14],
  ["OR", "Harris Beach State Park — Brookings", "2026-11-28", 21],
  ["CA", "Napa Elks Lodge #832 — Napa", "2026-12-19", 21],
  ["CA", "Park of the Sierras - Escapees Park — Coarsegold", "2027-01-09", 14],
  ["CA", "Camp Kernville — Kernville", "2027-01-23", 14],
  ["AZ", "Lake Mead Recreational Area - Willow Beach — Lake Mead Recreational Area", "2027-02-06", 7],
  ["AZ", "Rancho Sedona RV Park — Sedona", "2027-02-13", 31],
  ["AZ", "Dwayne's Mountain View RV Park — Bowie", "2027-03-16", 1],
  ["TX", "Terlingua Ranch Lodge — Terlingua", "2027-03-17", 14],
  ["TX", "Port Isabel Marina & RV Park — Port Isabel", "2027-03-31", 14],
  ["TX", "Camp Caravan RV Park Waco — Lorena", "2027-04-14", 14],
  ["TX", "Twin Pine RV Park — Slaton", "2027-04-28", 1],
  ["NM", "Pendaries RV Resort — Rociada", "2027-04-29", 14],
  ["NM", "Valley View Mobile Home & RV Park — Fort Sumner", "2027-05-13", 1],
  ["UT", "Zion Canyon Campground and RV Resort — Springdale", "2027-05-14", 31],
  ["WY", "Colter Bay RV Park — Grand Teton National Park", "2027-06-14", 31],
  ["WY", "Colter Bay RV Park — Grand Teton National Park", "2027-07-15", 31],
  ["WY", "Colter Bay RV Park — Grand Teton National Park", "2027-08-15", 31],
  ["SD", "Rafter J Bar Ranch Camping Resort — Hill City", "2027-09-15", 31],
];

export const SEED_STAYS: Stay[] = ITINERARY.map(([state, location, start, nights], index) => ({
  id: `itinerary-${index}`,
  state,
  location,
  start,
  end: toISO(addDays(parseISO(start), nights - 1)),
  kind: "ground",
}));

/** Past includes today. Future starts tomorrow, including the current stay's remainder. */
export function seedForDate(today: string): { stays: Stay[]; planned: PlannedStop[]; routeStart: string } {
  const tomorrow = toISO(addDays(parseISO(today), 1));
  const future = SEED_STAYS.filter((stay) => stay.end > today);
  return {
    stays: SEED_STAYS.filter((stay) => stay.start <= today),
    routeStart: future.length ? (future[0].start > today ? future[0].start : tomorrow) : tomorrow,
    planned: future.map((stay) => {
      const start = stay.start > today ? stay.start : tomorrow;
      // UTC date-only arithmetic avoids a one-day drift at DST boundaries.
      const lengthDays = Math.round((Date.parse(stay.end) - Date.parse(start)) / 86_400_000) + 1;
      return { id: stay.id, state: stay.state, location: stay.location, lengthDays };
    }),
  };
}

export const DEFAULT_SETTINGS: Settings = {
  salary: 120_000,
  margin: 0.75,
  residence: "TN",
  assignedWorkState: "TN",
  trackingStart: "2026-01-01",
  federalReturnRequired: "unknown",
  ilMobileWorkerConfirmed: false,
  regularWagesOnly: true,
  routeStart: "2026-09-22",
  theme: "system",
};
