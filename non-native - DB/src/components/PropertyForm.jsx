import React, { useState } from "react";
import { PROPERTY_TYPES } from "../models/PropertyModel";

export default function PropertyForm({ initial, onSubmit, onCancel, disabled = false }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [propertyType, setPropertyType] = useState(
    initial?.propertyType || "Room"
  );
  const [description, setDescription] = useState(
    initial?.description || ""
  );
  const [contact, setContact] = useState(initial?.contact || "");
  const [startDate, setStartDate] = useState(
    initial?.startDate || "2025-01-01"
  );
  const [endDate, setEndDate] = useState(initial?.endDate || "2025-01-02");

  const [error, setError] = useState("");

  const validate = () => {
    if (!title.trim() || !address.trim()) return "Fields cannot be empty.";
    if (title[0] !== title[0].toUpperCase())
      return "Title must begin with a capital letter.";
    if (description.trim().length < 15)
      return "Description must be at least 15 characters.";
    if (new Date(endDate) <= new Date(startDate))
      return "End date must be after start date.";
    return "";
  };

  const submit = (e) => {
    e.preventDefault();

    if (disabled) return;

    const err = validate();
    if (err) return setError(err);

    onSubmit({
      ...initial,
      title,
      address,
      propertyType,
      description,
      contact,
      startDate,
      endDate,
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="form-row">
        <label>Address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div className="form-row">
        <label>Property Type</label>
        <select
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>Description</label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-row">
        <label>Contact</label>
        <input value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>

      <div className="form-row">
        <label>Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="form-row">
        <label>End Date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="form-actions">
        <button type="submit" disabled={disabled}>
          {disabled ? "Saving..." : "Save"}
        </button>
        <button onClick={onCancel} type="button" disabled={disabled}>
          Cancel
        </button>
      </div>
    </form>
  );
}
