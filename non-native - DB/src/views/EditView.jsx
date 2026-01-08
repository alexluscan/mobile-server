import React, { useState } from "react";
import PropertyForm from "../components/PropertyForm";
import * as repo from "../data/indexedDbRepository";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import { logger } from "../utils/logger";

export default function EditView({ property, goBack, onPropertyUpdated }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = async (updated) => {
    try {
      setIsSubmitting(true);
      setError("");
      
      logger.info('[EditView] Updating property', { id: updated.id, property: updated });

      // Update property
      const updatedProperty = await repo.update(updated);

      // Repository observer will notify subscribers automatically
      if (onPropertyUpdated) {
        onPropertyUpdated(updatedProperty);
      }

      logger.info('[EditView] Property updated successfully', { id: updatedProperty.id });
      goBack();
    } catch (err) {
      const friendlyMessage = getFriendlyErrorMessage(err);
      logger.error('[EditView] Error updating property', { id: property?.id, error: err.message });
      setError(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>Edit Property</h2>
      {error && <div className="error">Error: {error}</div>}
      <PropertyForm
        initial={property}
        onSubmit={update}
        onCancel={goBack}
        disabled={isSubmitting}
      />
    </div>
  );
}
