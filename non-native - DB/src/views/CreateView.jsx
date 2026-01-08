import React, { useState } from "react";
import PropertyForm from "../components/PropertyForm";
import * as repo from "../data/indexedDbRepository";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import { logger } from "../utils/logger";

export default function CreateView({ goBack, onPropertyCreated }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const create = async (prop) => {
    try {
      setIsSubmitting(true);
      setError("");
      
      logger.info('[CreateView] Creating property', { property: prop });

      // Create property
      const newProperty = await repo.add(prop);

      // Repository observer will notify subscribers automatically
      if (onPropertyCreated) {
        onPropertyCreated(newProperty);
      }

      logger.info('[CreateView] Property created successfully', { id: newProperty.id });
      goBack();
    } catch (err) {
      const friendlyMessage = getFriendlyErrorMessage(err);
      logger.error('[CreateView] Error creating property', { error: err.message });
      setError(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>Add Property</h2>
      {error && <div className="error">Error: {error}</div>}
      <PropertyForm
        initial={null}
        onSubmit={create}
        onCancel={goBack}
        disabled={isSubmitting}
      />
    </div>
  );
}
