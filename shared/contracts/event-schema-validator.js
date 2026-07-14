/** Validate the JSON-Schema subset used by SSE event payload contracts. */
export function validateEventPayload(schemas, namespace, type, data) {
  const schema = schemas[type];
  if (!schema) return { ok: false, errors: [`Unknown ${namespace} event type: ${type}`] };
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: [`Event data for ${type} must be a plain object`] };
  }

  const errors = [];
  for (const field of schema.required || []) {
    if (data[field] === undefined || data[field] === null) errors.push(`Missing required field: ${field}`);
  }
  for (const [field, fieldSchema] of Object.entries(schema.properties || {})) {
    const value = data[field];
    if (value === undefined || value === null) continue;
    const error = validateField(field, value, fieldSchema);
    if (error) errors.push(error);
  }
  return { ok: errors.length === 0, errors };
}

function validateField(field, value, schema) {
  if (schema.type === "string") {
    if (typeof value !== "string") return `Field ${field} must be a string`;
    if (schema.minLength != null && value.length < schema.minLength) {
      return `Field ${field} is too short (min ${schema.minLength})`;
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      return `Field ${field} is too long (max ${schema.maxLength})`;
    }
    if (schema.enum && !schema.enum.includes(value)) {
      return `Field ${field} must be one of: ${schema.enum.join(", ")}`;
    }
    return null;
  }
  if (schema.type === "number") {
    return typeof value === "number" && Number.isFinite(value) ? null : `Field ${field} must be a number`;
  }
  if (schema.type === "boolean") return typeof value === "boolean" ? null : `Field ${field} must be a boolean`;
  if (schema.type === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? null
      : `Field ${field} must be an object`;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return `Field ${field} must be an array`;
    if (schema.maxItems != null && value.length > schema.maxItems) {
      return `Field ${field} exceeds max items (${schema.maxItems})`;
    }
    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        const itemError = validateField(`${field}[${index}]`, value[index], schema.items);
        if (itemError) return itemError;
      }
    }
  }
  return null;
}
