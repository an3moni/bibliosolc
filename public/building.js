let building = [];

async function loadBuilding() {
  const res = await fetch("/api/building");
  building = await res.json();
  return building;
}
