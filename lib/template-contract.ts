export type TemplatePageRole = {
  position: string;
  role: string;
  purpose?: string;
  required: boolean;
  repeatable: boolean;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

export function templatePageRoles(contract: unknown): TemplatePageRole[] {
  const root = record(contract);
  const structure = record(root?.structure);
  const source = Array.isArray(structure?.page_roles)
    ? structure.page_roles
    : Array.isArray(root?.page_roles)
      ? root.page_roles
      : [];
  return source.flatMap((value, index) => {
    const item = record(value);
    const role = typeof item?.role === "string" ? item.role.trim().toLowerCase() : "";
    if (!/^[a-z][a-z0-9_]{2,79}$/.test(role)) return [];
    return [{
      position: typeof item?.position === "string" && item.position.trim()
        ? item.position.trim()
        : String(index + 1).padStart(2, "0"),
      role,
      purpose: typeof item?.purpose === "string" ? item.purpose.trim() : undefined,
      required: item?.required !== false,
      repeatable: item?.repeatable === true,
    }];
  });
}

export function templatePageRoleCodes(contract: unknown) {
  return templatePageRoles(contract).map(({ role }) => role);
}
