import React from "react";

export default function PropertyRow({ property, onEdit, onDelete }) {
  return (
    <li className="property-row">
      <div>
        <div className="property-title">{property.title}</div>
        <div className="property-address">{property.address}</div>
        <div className="property-type">{property.propertyType}</div>
        <div className="property-contact">{property.contact}</div>
        <div className="property-dates">
          {property.startDate} – {property.endDate}
        </div>
      </div>

      <div className="property-actions">
        <button onClick={() => onEdit(property)}>Edit</button>
        <button className="danger" onClick={() => onDelete(property.id)}>
          Delete
        </button>
      </div>
    </li>
  );
}
