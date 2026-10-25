// Solar position (NOAA low-precision). Returns azimuth (° clockwise from North) and elevation (°).
export function sunPosition(date, latDeg, lonDeg) {
  const rad = Math.PI / 180, d = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24, lst = ((gmst * 15 + lonDeg) * rad), H = lst - ra, lat = latDeg * rad;
  const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) + Math.PI;
  return { az: ((az / rad) % 360 + 360) % 360, el: el / rad };
}
export function dateFrom(y, m, d, hours, tzOffsetHours) { return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + (hours - tzOffsetHours) * 3600000); }
