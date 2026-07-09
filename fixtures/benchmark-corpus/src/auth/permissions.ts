export type Role = 'admin' | 'editor' | 'viewer'

const ROLE_PERMISSIONS: Record<Role, string[]> = {
	admin: ['read', 'write', 'delete', 'manage_users'],
	editor: ['read', 'write'],
	viewer: ['read'],
}

export function hasPermission(role: Role, permission: string): boolean {
	return ROLE_PERMISSIONS[role].includes(permission)
}

export function canManageUsers(role: Role): boolean {
	return hasPermission(role, 'manage_users')
}
