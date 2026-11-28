// WGS 84 reference points for the Singapore atlas. Game zones keep their
// established names and tiles. `landing` locates a spot on the terrain map,
// and `access` describes the corresponding in-game route.
// The Parks dataset gives representative park points, including the anchors
// for Bukit Timah, MacRitchie, Sungei Buloh, Jurong, Kranji, Punggol, Changi,
// Coney Island, Pulau Ubin and Fort Canning:
// https://data.gov.sg/datasets/d_0542d48f0991541706b58059381a6eca/view
export const GEOGRAPHIC_PLACES = [
  // Sultan Mosque, Chinatown Heritage Centre and Merlion Park mark their districts.
  // https://www.visitsingapore.com/neighbourhood/featured-neighbourhood/kampong-gelam/
  // https://www.visitsingapore.com/neighbourhood/featured-neighbourhood/chinatown/
  // https://www.visitsingapore.com/see-do-singapore/recreation-leisure/viewpoints/merlion-park/
  { id: 'kampong_glam', label: 'Kampong Glam', zone: 'Kampong Glam', kind: 'real', lon: 103.85929, lat: 1.30198, side: 'top', stationId: 'kampong_glam' },
  { id: 'chinatown', label: 'Chinatown', zone: 'Chinatown', kind: 'real', lon: 103.84433, lat: 1.28350, side: 'left', stationId: 'chinatown' },
  { id: 'marina_bay', label: 'Marina Bay', zone: 'Marina Bay', kind: 'real', lon: 103.85416, lat: 1.28569, side: 'bottom', stationId: 'marina_bay' },
  // Bay South and Palawan Beach are the public visitor anchors.
  // https://www.gardensbythebay.com.sg/en/plan-your-visit/gardens-map.html
  // https://www.sentosa.com.sg/en/things-to-do/attractions/palawan-beach/
  { id: 'gardens', label: 'Gardens by the Bay', zone: 'Gardens by the Bay', kind: 'real', lon: 103.86496, lat: 1.28115, side: 'right', stationId: 'gardens' },
  { id: 'sentosa', label: 'Sentosa', zone: 'Sentosa Beach', kind: 'real', lon: 103.82222, lat: 1.24855, side: 'left', stationId: 'sentosa' },
  // St John's is the existing game arrival point for the Southern Islands.
  // https://www.sla.gov.sg/properties/management-of-state-land-and-properties/visiting-the-sla-managed-islands/
  // https://www.sla.gov.sg/articles/lazarus-island/
  // https://www.nparks.gov.sg/visit/parks/park-detail/sisters-islands-marine-park/
  // https://www.nea.gov.sg/our-services/waste-management/waste-management-infrastructure/semakau-landfill
  { id: 'southern_islands', label: "St John's Island", zone: 'Southern Islands', kind: 'real', lon: 103.84863, lat: 1.21867, side: 'bottom', stationId: 'southern_islands', access: 'ferry', ferryFrom: 'marina_bay' },
  { id: 'lazarus_island', label: 'Lazarus Island', zone: 'Southern Islands', subarea: true, kind: 'real', lon: 103.85530, lat: 1.22219, side: 'top', landing: { x: 150, y: 232 }, access: 'walk' },
  { id: 'kusu_island', label: 'Kusu Island', zone: 'Southern Islands', subarea: true, kind: 'real', lon: 103.86120, lat: 1.22311, side: 'right', landing: { x: 40, y: 236 }, access: 'ferry', ferryFrom: 'southern_islands' },
  { id: 'sisters_islands', label: 'Sisters’ Islands', zone: 'Southern Islands', subarea: true, kind: 'real', lon: 103.83455, lat: 1.21395, side: 'left', landing: { x: 168, y: 258 }, access: 'ferry', ferryFrom: 'southern_islands' },
  { id: 'pulau_semakau', label: 'Pulau Semakau', zone: 'Southern Islands', subarea: true, kind: 'real', lon: 103.76986, lat: 1.20318, side: 'bottom', landing: { x: 58, y: 260 }, access: 'ferry', ferryFrom: 'pulau_hantu' },
  { id: 'bukit_timah', label: 'Bukit Timah', zone: 'Bukit Timah', kind: 'real', lon: 103.77910, lat: 1.35406, side: 'left', stationId: 'bukit_timah' },
  { id: 'macritchie', label: 'MacRitchie', zone: 'MacRitchie Reservoir', kind: 'real', lon: 103.83628, lat: 1.34345, side: 'right', stationId: 'macritchie' },
  { id: 'sungei_buloh', label: 'Sungei Buloh', zone: 'Sungei Buloh Wetlands', kind: 'real', lon: 103.72452, lat: 1.44474, side: 'top', stationId: 'sungei_buloh' },
  { id: 'jurong', label: 'Jurong', zone: 'Jurong Forest', kind: 'inspired', realLabel: 'Jurong Lake Gardens', lon: 103.72695, lat: 1.33366, side: 'left', stationId: 'jurong' },
  { id: 'kranji', label: 'Kranji', zone: 'Kranji Farmlands', kind: 'inspired', realLabel: 'Kranji Marshes', lon: 103.73023, lat: 1.41916, side: 'bottom', stationId: 'kranji' },
  // The public Mandai Wildlife Reserve is the reference for the rainforest.
  // https://www.mandai.com/en/plan-your-visit/maps.html
  { id: 'mandai', label: 'Mandai', zone: 'Mandai Rainforest', kind: 'inspired', realLabel: 'Mandai Wildlife Reserve', lon: 103.78522, lat: 1.40444, side: 'left', stationId: 'mandai' },
  // A point on the public stretch of Transit Road near Springleaf.
  // https://www.nparks.gov.sg/docs/default-source/parks-docs/springleaf-nature-park/springleaf-nature-park-map.pdf
  // https://www.openstreetmap.org/way/109738259
  { id: 'transit_road', label: 'Transit Road', zone: 'Transit Road, Nee Soon Camp', kind: 'inspired', realLabel: 'Transit Road, Springleaf', lon: 103.81890, lat: 1.40459, side: 'top', stationId: 'transit_road' },
  { id: 'punggol', label: 'Punggol Waterway', zone: 'Punggol Waterway', kind: 'real', lon: 103.90482, lat: 1.41100, side: 'top', stationId: 'punggol' },
  { id: 'coney', label: 'Coney Island', zone: 'Coney Island', kind: 'real', lon: 103.92151, lat: 1.40946, side: 'bottom', stationId: 'coney', access: 'walk' },
  { id: 'pulau_ubin', label: 'Pulau Ubin', zone: 'Pulau Ubin', kind: 'real', lon: 103.96541, lat: 1.41375, side: 'top', stationId: 'pulau_ubin', access: 'ferry', ferryFrom: 'changi' },
  { id: 'changi', label: 'Changi Coast', zone: 'Changi Coast', kind: 'real', lon: 104.00175, lat: 1.38316, side: 'bottom', stationId: 'changi' },
  // Island reference points use the broad landforms on public MPA charts.
  // https://www.mpa.gov.sg/api/media/fa7f0480-8feb-400e-9d82-96ab6c32e324/-pc17-23.pdf
  // https://www.mpa.gov.sg/api/media/1636d29e-815e-4b98-81d0-cbfbae3fa4cf/pn26-19.pdf
  { id: 'pulau_hantu', label: 'Pulau Hantu', zone: 'Pulau Hantu', kind: 'real', lon: 103.74900, lat: 1.22400, side: 'left', landing: { x: 124, y: 53 }, access: 'ferry', ferryFrom: 'marina_bay' },
  { id: 'pulau_tekong', label: 'Pulau Tekong', zone: 'Tekong Badlands', kind: 'inspired', realLabel: 'Pulau Tekong', lon: 104.05583, lat: 1.40806, side: 'top', landing: { x: 262, y: 150 }, access: 'ferry', ferryFrom: 'changi' },
  // Tuas Port is the reference for the game's docks.
  // https://www.mpa.gov.sg/maritime-singapore/port-of-the-future
  { id: 'tuas', label: 'Tuas', zone: 'Tuas Docklands', kind: 'inspired', realLabel: 'Tuas Port', lon: 103.61472, lat: 1.25665, side: 'top', stationId: 'tuas' },
  // Fort Canning Hill was the historical seat of Temasek.
  // https://www.roots.gov.sg/places/places-landing/Places/landmarks/jubilee-walk/fort-canning-park
  { id: 'temasek', label: 'Temasek Ruins', zone: 'Temasek Ruins', kind: 'inspired', realLabel: 'Fort Canning Park', lon: 103.84661, lat: 1.29589, side: 'left', stationId: 'temasek' },
  { id: 'wilderness', label: 'The Wilderness', zone: 'The Wilderness', kind: 'fictional', landing: { x: 100, y: 52 }, access: 'walk' },
  { id: 'rift_outpost', label: 'The Shadow Rift', zone: 'The Shadow Rift', kind: 'fictional', stationId: 'rift_outpost' },
  { id: 'celestial_peaks', label: 'The Celestial Peaks', zone: 'The Celestial Peaks', kind: 'fictional', stationId: 'celestial_peaks' },
];

export const GEOGRAPHIC_PLACE_BY_ID = Object.fromEntries(GEOGRAPHIC_PLACES.map((place) => [place.id, place]));
export const GEOGRAPHIC_PLACE_BY_ZONE = Object.fromEntries(GEOGRAPHIC_PLACES.filter((place) => !place.subarea).map((place) => [place.zone, place]));
