let properties = [
  {
    id: "1",
    title: "Sunny Apartment",
    address: "123 Main St",
    propertyType: "Apartment",
    description: "Nice 1-bedroom place in the city center.",
    contact: "alice@example.com",
    startDate: "2025-01-01",
    endDate: "2025-02-01",
  },
  {
    id: "2",
    title: "Cozy Room",
    address: "45 Elm Street",
    propertyType: "Room",
    description: "Small but cozy room in a shared flat.",
    contact: "bob@example.com",
    startDate: "2025-03-05",
    endDate: "2025-03-20",
  },
];

// READ
export function getAll() {
  return [...properties];
}

// CREATE
export function add(property) {
  properties.push(property);
}

// UPDATE
export function update(property) {
  const index = properties.findIndex((p) => p.id === property.id);
  if (index !== -1) properties[index] = property;
}

// DELETE
export function remove(id) {
  properties = properties.filter((p) => p.id !== id);
}

// Utility for ids
export function generateId() {
  return Date.now().toString() + Math.random().toString(16).slice(2);
}
