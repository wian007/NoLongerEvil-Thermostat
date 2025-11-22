import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function mergeValues(current: any, incoming: any): any {
  if (incoming === undefined) {
    return current;
  }
  if (current === undefined) {
    return incoming;
  }
  const isObject = (val: any) => val !== null && typeof val === "object" && !Array.isArray(val);
  if (!isObject(current) || !isObject(incoming)) {
    return incoming;
  }
  const result: Record<string, any> = { ...current };
  for (const key of Object.keys(incoming)) {
    result[key] = mergeValues((current as any)[key], incoming[key]);
  }
  return result;
}


export const upsertState = mutation({
  args: {
    serial: v.string(),
    object_key: v.string(),
    object_revision: v.number(),
    object_timestamp: v.number(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("states")
      .withIndex("by_key", (q) => q.eq("serial", args.serial).eq("object_key", args.object_key))
      .first();
    const updatedAt = Date.now();
    if (existing) {
      const mergedValue = mergeValues(existing.value ?? {}, args.value ?? {});
      await ctx.db.patch(existing._id, {
        object_revision: args.object_revision,
        object_timestamp: args.object_timestamp,
        value: mergedValue,
        updatedAt,
      });
      return { updated: true };
    } else {
      await ctx.db.insert("states", { ...args, value: args.value ?? {}, updatedAt });
      return { inserted: true };
    }
  },
});

export const getState = query({
  args: { serial: v.string(), object_key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("states")
      .withIndex("by_key", (q) => q.eq("serial", args.serial).eq("object_key", args.object_key))
      .first();
    return row;
  },
});

export const getDeviceState = query({
  args: { serial: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("states")
      .withIndex("by_serial", (q) => q.eq("serial", args.serial))
      .collect();
    return rows;
  },
});

/**
 * DEPRECATED: This query had no access control and is a security risk.
 * Use getUserDevicesState instead which checks user permissions.
 *
 * This is kept only for backward compatibility but returns empty data.
 */
export const getAllState = query({
  args: {},
  handler: async () => {
    console.warn('[DEPRECATED] getAllState query called - this query is deprecated and returns empty data. Use getUserDevicesState instead.');
    return {
      devices: [],
      deviceState: {},
    };
  },
});

/**
 * Get all device states for a specific user with access control
 * Includes owned devices and devices shared with the user
 */
export const getUserDevicesState = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get owned devices
    const ownedDevices = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get shared devices
    const sharedDevices = await ctx.db
      .query("deviceShares")
      .withIndex("by_shared_user", (q) => q.eq("sharedWithUserId", args.userId))
      .collect();

    // Combine all accessible serials
    const accessibleSerials = new Set<string>([
      ...ownedDevices.map((d) => d.serial),
      ...sharedDevices.map((d) => d.serial),
    ]);

    if (accessibleSerials.size === 0) {
      return {
        devices: [],
        deviceState: {},
      };
    }

    // Get all state rows for accessible devices
    const allStates = await ctx.db.query("states").collect();
    const deviceState: Record<string, Record<string, any>> = {};

    for (const row of allStates) {
      if (!accessibleSerials.has(row.serial)) {
        continue; // Skip devices user doesn't have access to
      }

      const serial = row.serial;
      const bucket = (deviceState[serial] ||= {});
      bucket[row.object_key] = {
        object_key: row.object_key,
        object_revision: row.object_revision,
        object_timestamp: row.object_timestamp,
        value: row.value,
        updatedAt: row.updatedAt,
      };
    }

    // Return ALL accessible devices, even if they have no state yet
    return {
      devices: Array.from(accessibleSerials),
      deviceState,
    };
  },
});

/**
 * Get state for a single device with access control
 * Checks if user owns or has shared access to the device
 */
export const getUserDeviceState = query({
  args: {
    userId: v.string(),
    serial: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user owns this device
    const ownership = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("serial"), args.serial))
      .first();

    // Check if device is shared with user
    const sharedAccess = await ctx.db
      .query("deviceShares")
      .withIndex("by_shared_user", (q) => q.eq("sharedWithUserId", args.userId))
      .filter((q) => q.eq(q.field("serial"), args.serial))
      .first();

    // User must have ownership or shared access
    if (!ownership && !sharedAccess) {
      throw new Error("Access denied: You do not have permission to view this device");
    }

    // Get all state rows for this device
    const rows = await ctx.db
      .query("states")
      .withIndex("by_serial", (q) => q.eq("serial", args.serial))
      .collect();

    const deviceState: Record<string, any> = {};

    for (const row of rows) {
      deviceState[row.object_key] = {
        object_key: row.object_key,
        object_revision: row.object_revision,
        object_timestamp: row.object_timestamp,
        value: row.value,
        updatedAt: row.updatedAt,
      };
    }

    return {
      serial: args.serial,
      state: deviceState,
      hasWriteAccess: Boolean(ownership || sharedAccess?.permissions.includes("control")),
    };
  },
});

/**
 * Debug query to check database contents
 */
export const debugDatabase = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const deviceOwners = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const allStates = await ctx.db.query("states").collect();

    return {
      userId: args.userId,
      deviceOwnersCount: deviceOwners.length,
      deviceOwners: deviceOwners.map(d => ({ serial: d.serial, createdAt: d.createdAt })),
      totalStatesCount: allStates.length,
      statesByDevice: allStates.reduce((acc, state) => {
        acc[state.serial] = (acc[state.serial] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },
});
