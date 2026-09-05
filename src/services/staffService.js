import { dataService } from "./dataService";
import { activityLogService } from "./activityLogService";

// One toggle per real area of the app, plus a single "full access" switch
// that flips them all at once — exactly what was asked for: an owner can
// hand a cashier as much or as little as they want, up to full owner-level
// access, and take any of it back at any time. Dashboard isn't gated —
// it's just numbers, nothing destructive lives there.
export const PERMISSION_KEYS = [
  "manageProducts",
  "manageSales",
  "manageCredit",
  "manageExpenses",
  "manageSuppliers",
  "manageStaff",
  "manageSettings",
];

export const emptyPermissions = () =>
  PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});

export const fullPermissions = () =>
  PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {});

// The owner is never actually represented in the staff list — they're
// identified by matching settings.ownerPin at login, and implicitly have
// every permission without needing explicit flags. This helper is what
// login/permission checks use for that implicit owner identity.
export const ownerIdentity = () => ({
  id: "owner",
  name: "Owner",
  isOwner: true,
  permissions: fullPermissions(),
});

export const staffService = {
  async addStaff({ name, pin, permissions }) {
    if (!name || !name.trim()) {
      return { success: false, error: "Weka jina la mfanyakazi" };
    }
    if (!pin || pin.length < 4) {
      return { success: false, error: "PIN lazima iwe na tarakimu 4 au zaidi" };
    }
    const staff = await dataService.getStaff();
    if (staff.some((s) => s.pin === pin)) {
      return {
        success: false,
        error: "PIN hii tayari inatumika na mfanyakazi mwingine",
      };
    }
    const newStaff = {
      id: `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      pin,
      permissions: permissions || emptyPermissions(),
    };
    await dataService.saveStaff([...staff, newStaff]);
    await activityLogService.logActivity("added a staff member", name.trim());
    return { success: true, staff: newStaff };
  },

  async updateStaff(staffId, { name, pin, permissions }) {
    if (!name || !name.trim()) {
      return { success: false, error: "Weka jina la mfanyakazi" };
    }
    if (!pin || pin.length < 4) {
      return { success: false, error: "PIN lazima iwe na tarakimu 4 au zaidi" };
    }
    const staff = await dataService.getStaff();
    if (staff.some((s) => s.pin === pin && s.id !== staffId)) {
      return {
        success: false,
        error: "PIN hii tayari inatumika na mfanyakazi mwingine",
      };
    }
    const updated = staff.map((s) =>
      s.id === staffId ? { ...s, name: name.trim(), pin, permissions } : s,
    );
    await dataService.saveStaff(updated);
    return { success: true };
  },

  async deleteStaff(staffId) {
    const staff = await dataService.getStaff();
    const removed = staff.find((s) => s.id === staffId);
    await dataService.saveStaff(staff.filter((s) => s.id !== staffId));
    if (removed)
      await activityLogService.logActivity(
        "removed a staff member",
        removed.name,
      );
    return { success: true };
  },

  // Checks a PIN against the owner first, then every staff member — used
  // at login to figure out both who's signing in and what they're allowed
  // to touch, in one pass.
  async identifyByPin(pin, ownerPin) {
    if (pin === ownerPin) return ownerIdentity();
    const staff = await dataService.getStaff();
    const match = staff.find((s) => s.pin === pin);
    if (match)
      return {
        id: match.id,
        name: match.name,
        isOwner: false,
        permissions: match.permissions,
      };
    return null;
  },
};
