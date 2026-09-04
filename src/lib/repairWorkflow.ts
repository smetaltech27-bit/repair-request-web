import type { AppUser, RepairActionCode, RepairRequest } from '../types/repair'

export type WorkflowAction = Exclude<RepairActionCode, 'create' | 'import'>
export type ApprovalAction = Exclude<WorkflowAction, 'complete'>

export function getAvailableActions(request: RepairRequest, user: AppUser): WorkflowAction[] {
  const sameDepartment = Boolean(user.departmentId && user.departmentId === request.departmentId)
  const approvingOwnRequest = request.requesterId === user.id

  if (request.statusCode === 'pending_supervisor') {
    return user.roleCode === 'supervisor' && sameDepartment && !approvingOwnRequest ? ['reject', 'approve'] : []
  }
  if (request.statusCode === 'pending_department_manager') {
    return user.roleCode === 'department_manager' && sameDepartment && !approvingOwnRequest
      ? ['reject', 'approve']
      : []
  }
  if (request.statusCode === 'pending_factory_manager') {
    return user.roleCode === 'factory_manager' && !approvingOwnRequest ? ['reject', 'approve'] : []
  }
  if (request.statusCode === 'pending_purchasing') {
    return user.roleCode === 'purchasing' && !approvingOwnRequest ? ['reject', 'acknowledge'] : []
  }
  if (request.statusCode === 'purchasing_in_progress') {
    const canComplete =
      user.roleCode === 'factory_manager' ||
      user.roleCode === 'purchasing' ||
      (sameDepartment && ['supervisor', 'department_manager'].includes(user.roleCode))
    return canComplete ? ['complete'] : []
  }
  return []
}

export function getApprovalActions(request: RepairRequest, user: AppUser): ApprovalAction[] {
  return getAvailableActions(request, user).filter(
    (action): action is ApprovalAction => action !== 'complete',
  )
}

export function canCompleteRequest(request: RepairRequest, user: AppUser) {
  return getAvailableActions(request, user).includes('complete')
}
