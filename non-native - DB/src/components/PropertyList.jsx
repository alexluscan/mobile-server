import React from "react";
import PropertyRow from "./PropertyRow";

export default function PropertyList({ properties, onEdit, onDelete }) {
  return (
    <ul className="property-list">
      {properties.map((p) => (
        <PropertyRow
          key={p.id}
          property={p}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
