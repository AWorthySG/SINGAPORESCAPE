// A line for each region's postcard: the arrival card that greets you as you
// walk in (render/postcard.js) and the shareable photo postcard (ui/photomode.js).
// Written like a note on the back of a holiday card, in a cosy, nostalgic,
// family-friendly voice with a light Singlish touch. Region names as world.js
// spells them.

export const SITE_URL = 'adventure.a-worthy.com';
export const TAGLINE = 'Your cosy kampong adventure';

export const REGION_POSTCARDS = {
  'Kampong Glam': 'Kopi’s on and the kampong is waking up. Welcome home!',
  Chinatown: 'Red lanterns, shophouse lights and char siew in the air.',
  'Marina Bay': 'City lights dancing on the water. Not bad, right?',
  'Bukit Timah': 'Highest hill on the island. Bring water, can?',
  'Jurong Forest': 'Tall trees, cool shade, cheeky monkeys. Jaga your bag!',
  'Mandai Rainforest': 'Birdsong and rain on the leaves all day. Shiok.',
  'MacRitchie Reservoir': 'Boardwalk strolls by still water. Shh, the monkeys are listening.',
  'Punggol Waterway': 'Breezy evenings by the waterway. Cycle slowly lah.',
  'Sungei Buloh Wetlands': 'Mangroves, mudskippers and the odd croc. Look, don’t touch!',
  'Sentosa Beach': 'Sand between the toes and the sun going down. Wish you were here!',
  'Changi Coast': 'Sea breeze, satay and planes flying home overhead.',
  'Southern Islands': 'Little islands, big sky, clear water. So chill.',
  'Pulau Ubin': 'The last kampong: bumboat, bicycle and durian. Shiok!',
  'Coney Island': 'Casuarina trees and a quiet beach all to ourselves.',
  'Gardens by the Bay': 'Supertrees glowing at dusk. So pretty, right?',
  'Kranji Farmlands': 'Fresh eggs, frogs and goat’s milk. Farm life best.',
  'Transit Road, Nee Soon Camp': 'Rain on the leaves, hot teh tarik under the awning.',
  'Tuas Docklands': 'Cranes, containers and the hum of the port at night.',
  'Temasek Ruins': 'Old stones from old Temasek. Walk softly here.',
  'The Celestial Peaks': 'Above the clouds, the stars feel close enough to touch.',
  'The Wilderness': 'No kopi out here. Stay sharp, adventurer.',
  'Pulau Hantu': 'Ghost Island. Don’t turn around, ok?',
  'Tekong Badlands': 'Rough ground, rougher foes. Steady lah.',
  'The Shadow Rift': 'Even the lanterns are scared here.',
};

/** The postcard line for a region (a friendly default for anywhere unlisted). */
export const postcardLine = (region) => REGION_POSTCARDS[region] || 'Having a lovely time. Wish you were here!';
