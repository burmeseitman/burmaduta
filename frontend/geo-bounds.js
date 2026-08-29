// Myanmar's extent, shared by the desktop and mobile maps.
//
// Loaded as its own <script> before app.js and mobile.js, which both need it:
// two copies drift, and a copy that drifts means one view drawing a pin the
// other refuses. The backend keeps its own copy in geolocator.py, since it
// cannot import this -- if you widen one, widen both, or a row gets stored that
// the map then declines to draw.
//
// Bounded per latitude band because a single rectangle around the country also
// contains Bangkok and Chiang Mai: Myanmar narrows to a thin coastal strip in
// the south while Shan reaches far east in the north.
const MYANMAR_BANDS = [
    { maxLat: 12.0, minLng: 97.5, maxLng: 99.7 },   // Tanintharyi south, Mergui archipelago
    { maxLat: 15.0, minLng: 97.2, maxLng: 99.3 },   // Dawei / Myeik
    { maxLat: 18.0, minLng: 93.4, maxLng: 99.0 },   // delta, Yangon, Mon, Kayin
    { maxLat: 19.5, minLng: 92.8, maxLng: 98.2 },   // Kayah, south Shan
    { maxLat: 21.0, minLng: 92.1, maxLng: 101.2 },  // Rakhine (Maungdaw) across to Tachileik
    { maxLat: 24.0, minLng: 92.1, maxLng: 101.2 },  // Chin across to Kengtung
    { maxLat: 28.8, minLng: 92.9, maxLng: 98.9 },   // Sagaing north, Kachin
];

// Offshore territory no mainland band can reach: the Coco Islands belong to
// Yangon Region but sit 300km out in the Andaman Sea, Preparis further north.
const MYANMAR_ISLANDS = [
    { minLat: 13.9, maxLat: 15.6, minLng: 93.2, maxLng: 94.5 },
];

// How far the map may be panned. Padded well beyond the country so no edge is
// clipped, and wide enough to contain every coordinate isWithinMyanmar allows.
const MYANMAR_VIEW_BOUNDS = [[7.5, 90.0], [30.5, 103.5]];

function isWithinMyanmar(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!isFinite(latNum) || !isFinite(lngNum)) return false;
    if (latNum < 9.0 || latNum > 28.8) return false;

    const island = MYANMAR_ISLANDS.find(i =>
        latNum >= i.minLat && latNum <= i.maxLat && lngNum >= i.minLng && lngNum <= i.maxLng);
    if (island) return true;

    const band = MYANMAR_BANDS.find(b => latNum <= b.maxLat);
    return Boolean(band) && lngNum >= band.minLng && lngNum <= band.maxLng;
}
